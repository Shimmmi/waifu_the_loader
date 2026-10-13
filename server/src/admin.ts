import { Queue } from 'bullmq';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AiSettingsSchema, loadContent, RaritySchema } from '@wl/shared';
import { aiSpend, getAiSettings, listAiSettings, resetDailyBudget, rollbackAiSettings, saveAiSettings } from './ai-store.js';
import { requireUser } from './auth.js';
import { sql } from './db.js';
import { env, QUEUES } from './env.js';
import { GameError } from './player.js';

async function requireAdmin(req: FastifyRequest): Promise<void> {
  await requireUser(req);
  const [u] = await sql<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${req.userId}`;
  if (!u?.is_admin) throw new GameError('forbidden', 'Только для администратора', 403);
}

export interface ModelInfo {
  id: string;
  name: string;
  input: string[];
  output: string[];
  /** ₽ за 1M токенов (вход/выход) или за картинку, как отдаёт RouterAI */
  pricing: Record<string, string>;
}

let modelsCache: { at: number; models: ModelInfo[] } | null = null;

/** Каталог моделей запрашивается сервером: ключ RouterAI не покидает бэкенд (ТЗ 10.3). */
async function routerAiModels(): Promise<ModelInfo[]> {
  if (modelsCache && Date.now() - modelsCache.at < 3600_000) return modelsCache.models;
  const res = await fetch(`${env.routerai.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${env.routerai.apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new GameError('upstream', `RouterAI /models: HTTP ${res.status}`, 502);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const models = (json.data ?? []).map((m) => {
    const arch = (m.architecture ?? {}) as { input_modalities?: string[]; output_modalities?: string[] };
    return {
      id: String(m.id),
      name: String(m.name ?? m.id),
      input: arch.input_modalities ?? ['text'],
      output: arch.output_modalities ?? ['text'],
      pricing: (m.pricing ?? {}) as Record<string, string>,
    };
  });
  modelsCache = { at: Date.now(), models };
  return models;
}

export async function registerAdmin(api: FastifyInstance, connection: { url: string }): Promise<void> {
  const testQueue = new Queue(QUEUES.aiTest, { connection: { url: connection.url, maxRetriesPerRequest: null } });
  api.addHook('onClose', async () => testQueue.close());

  await api.register(async (admin) => {
    admin.addHook('preHandler', requireAdmin);

    admin.get('/admin/ai', async () => {
      const [current, spend, pool, calls, verdicts, themes, funnel] = await Promise.all([
        getAiSettings(),
        aiSpend(),
        sql<{ rarity: string; source: string; status: string; n: number }[]>`
          SELECT rarity, CASE WHEN source = 'ai' THEN 'ai' ELSE 'procedural' END AS source, status, count(*)::int AS n
          FROM waifu_pool GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
        sql<{ kind: string; calls: number; failed: number; first_try: number; cost: number }[]>`
          SELECT kind, count(*)::int AS calls, count(*) FILTER (WHERE NOT ok)::int AS failed,
                 count(*) FILTER (WHERE ok AND attempts = 1)::int AS first_try, coalesce(sum(cost_rub), 0)::float AS cost
          FROM ai_generation_log WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1`,
        sql<{ status: string; n: number }[]>`
          SELECT status, count(*)::int AS n FROM waifu_pool
          WHERE source = 'ai' AND created_at > now() - interval '7 days' GROUP BY 1`,
        sql<{ theme: string; ok: number; review: number; rejected: number }[]>`
          SELECT gen_meta->'look'->>'theme' AS theme,
                 count(*) FILTER (WHERE status IN ('ready', 'taken'))::int AS ok,
                 count(*) FILTER (WHERE status = 'review')::int AS review,
                 count(*) FILTER (WHERE status = 'rejected')::int AS rejected
          FROM waifu_pool WHERE source = 'ai' AND gen_meta->'look' IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,
        sql<{ name: string; n: number }[]>`
          SELECT name, count(DISTINCT user_id)::int AS n FROM analytics_events
          WHERE name IN ('registration', 'first_pull', 'first_prestige', 'first_achievement') GROUP BY 1`,
      ]);
      return {
        current,
        keyConfigured: Boolean(env.routerai.apiKey),
        spend,
        pool,
        week: { calls, verdicts },
        themes,
        funnel,
        archetypes: loadContent().archetypes.map((a) => ({ id: a.id, name: a.name })),
      };
    });

    admin.post('/admin/ai/reset-daily', async (req) => {
      await resetDailyBudget(req.userId, 'сброс из админки');
      return { spend: await aiSpend() };
    });

    admin.get('/admin/ai/versions', async () => ({ versions: await listAiSettings() }));

    admin.put('/admin/ai/settings', async (req) => {
      const body = z.object({ settings: AiSettingsSchema, comment: z.string().max(200).default('') }).parse(req.body);
      return { version: await saveAiSettings(body.settings, req.userId, body.comment) };
    });

    admin.post('/admin/ai/rollback', async (req) => {
      const { version } = z.object({ version: z.number().int().min(0) }).parse(req.body);
      return { version: await rollbackAiSettings(version, req.userId) };
    });

    admin.get('/admin/ai/models', async () => ({ models: env.routerai.apiKey ? await routerAiModels() : [] }));

    admin.get('/admin/ai/log', async (req) => {
      const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
      const rows = await sql`
        SELECT id, kind, purpose, model, ok, error, prompt_tokens, completion_tokens, cost_rub::float AS cost_rub, duration_ms, rarity, pool_id, attempts, created_at
        FROM ai_generation_log ORDER BY id DESC LIMIT ${limit}`;
      return { items: rows };
    });

    // Генерация занимает 30–90 с — дольше таймаутов прокси, поэтому задача ставится в очередь и опрашивается.
    admin.post('/admin/ai/test', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
      const body = z
        .object({ rarity: RaritySchema.default('SSR'), archetype: z.string().max(40).optional() })
        .parse(req.body ?? {});
      if (!env.routerai.apiKey) throw new GameError('no_key', 'Ключ RouterAI не задан в .env', 400);
      const job = await testQueue.add('test', body, { removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 }, attempts: 1 });
      return { jobId: job.id };
    });

    admin.get('/admin/ai/test/:id', async (req) => {
      const { id } = z.object({ id: z.string().max(40) }).parse(req.params);
      const job = await testQueue.getJob(id);
      if (!job) throw new GameError('not_found', 'Задача не найдена', 404);
      const state = await job.getState();
      return { state, result: job.returnvalue ?? null, error: job.failedReason ?? null };
    });

    admin.get('/admin/review', async (req) => {
      const { status } = z.object({ status: z.enum(['review', 'rejected']).default('review') }).parse(req.query);
      const rows = await sql`
        SELECT id, rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url,
               image_prompt, moderation, gen_cost_rub::float AS gen_cost_rub, gen_meta, created_at
        FROM waifu_pool WHERE status = ${status} AND source = 'ai' ORDER BY created_at DESC LIMIT 50`;
      return { items: rows };
    });

    admin.post('/admin/review/:id', async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const { action } = z.object({ action: z.enum(['approve', 'reject']) }).parse(req.body);
      const status = action === 'approve' ? 'ready' : 'rejected';
      const r = await sql`
        UPDATE waifu_pool SET status = ${status}, reviewed_by = ${req.userId}, reviewed_at = now()
        WHERE id = ${id} AND source = 'ai' AND status IN ('review', 'rejected') RETURNING id`;
      if (r.length === 0) throw new GameError('not_found', 'Карточка уже обработана', 404);
      return { ok: true, status };
    });
  });
}
