import { AiSettingsSchema, DEFAULT_AI_SETTINGS, type AiSettings, type Rarity } from '@wl/shared';
import { sql } from './db.js';
import { GameError } from './player.js';

export interface AiSettingsVersion {
  version: number;
  settings: AiSettings;
  comment: string;
  createdAt: string;
  createdBy: string | null;
}

/** Настройки поверх значений по умолчанию: новые поля из кода появляются и в старых версиях. */
function mergeDefaults(raw: unknown): AiSettings {
  const r = (raw ?? {}) as Partial<AiSettings>;
  const d = DEFAULT_AI_SETTINGS;
  const merged = {
    ...d,
    ...r,
    text: { ...d.text, ...r.text },
    image: { ...d.image, ...r.image, rarity_modifiers: { ...d.image.rarity_modifiers, ...r.image?.rarity_modifiers } },
    moderation: { ...d.moderation, ...r.moderation },
    limits: { ...d.limits, ...r.limits },
    pool: { ...d.pool, ...r.pool },
  };
  const parsed = AiSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : d;
}

export async function getAiSettings(): Promise<AiSettingsVersion> {
  const [row] = await sql<{ version: number; settings: unknown; comment: string; created_at: Date; nickname: string | null }[]>`
    SELECT s.version, s.settings, s.comment, s.created_at, u.nickname
    FROM ai_settings s LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.version DESC LIMIT 1`;
  if (!row) return { version: 0, settings: DEFAULT_AI_SETTINGS, comment: 'по умолчанию', createdAt: new Date(0).toISOString(), createdBy: null };
  return { version: row.version, settings: mergeDefaults(row.settings), comment: row.comment, createdAt: row.created_at.toISOString(), createdBy: row.nickname };
}

export async function listAiSettings(limit = 30): Promise<AiSettingsVersion[]> {
  const rows = await sql<{ version: number; settings: unknown; comment: string; created_at: Date; nickname: string | null }[]>`
    SELECT s.version, s.settings, s.comment, s.created_at, u.nickname
    FROM ai_settings s LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.version DESC LIMIT ${limit}`;
  return rows.map((r) => ({ version: r.version, settings: mergeDefaults(r.settings), comment: r.comment, createdAt: r.created_at.toISOString(), createdBy: r.nickname }));
}

export async function saveAiSettings(settings: AiSettings, userId: string | null, comment: string): Promise<number> {
  const valid = AiSettingsSchema.parse(settings);
  const [row] = await sql<{ version: number }[]>`
    INSERT INTO ai_settings (settings, comment, created_by) VALUES (${sql.json(valid as never)}, ${comment}, ${userId}) RETURNING version`;
  return row!.version;
}

/** Версия 0 — значения по умолчанию из кода. */
export async function rollbackAiSettings(version: number, userId: string | null): Promise<number> {
  if (version === 0) return saveAiSettings(DEFAULT_AI_SETTINGS, userId, 'откат к настройкам по умолчанию');
  const [row] = await sql<{ settings: unknown }[]>`SELECT settings FROM ai_settings WHERE version = ${version}`;
  if (!row) throw new GameError('not_found', `Версии v${version} нет`, 404);
  return saveAiSettings(mergeDefaults(row.settings), userId, `откат к версии v${version}`);
}

export interface AiSpend {
  todayRub: number;
  monthRub: number;
  /** Время ручного сброса дневного лимита сегодня */
  resetAt?: string | null;
}

/** Сутки и месяц считаются по Москве, как ежедневная награда. */
export async function aiSpend(): Promise<AiSpend> {
  const [r] = await sql<{ today: string; month: string; reset_at: Date | null }[]>`
    WITH b AS (
      SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') AS day_start,
             (date_trunc('month', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') AS month_start
    ), rs AS (
      SELECT max(created_at) AS reset_at FROM ai_budget_resets, b WHERE created_at >= b.day_start
    )
    SELECT
      coalesce(sum(cost_rub) FILTER (WHERE created_at >= greatest(b.day_start, coalesce(rs.reset_at, b.day_start))), 0) AS today,
      coalesce(sum(cost_rub) FILTER (WHERE created_at >= b.month_start), 0) AS month,
      rs.reset_at
    FROM b, rs LEFT JOIN ai_generation_log l ON l.created_at >= now() - interval '32 days'
    GROUP BY rs.reset_at`;
  return { todayRub: Number(r?.today ?? 0), monthRub: Number(r?.month ?? 0), resetAt: r?.reset_at?.toISOString() ?? null };
}

/** Сегодняшний расход начинает считаться заново; месячный не меняется. */
export async function resetDailyBudget(userId: string | null, comment = ''): Promise<void> {
  await sql`INSERT INTO ai_budget_resets (created_by, comment) VALUES (${userId}, ${comment})`;
}

export class BudgetExceededError extends Error {
  constructor(public readonly spend: AiSpend) {
    super(`лимит расходов на ИИ исчерпан (сегодня ${spend.todayRub.toFixed(2)} ₽, месяц ${spend.monthRub.toFixed(2)} ₽)`);
  }
}

/** Бросает BudgetExceededError, если следующий вызов (с запасом reserveRub) выйдет за лимиты. */
export async function assertBudget(s: AiSettings, reserveRub = 0): Promise<AiSpend> {
  const spend = await aiSpend();
  if (spend.todayRub + reserveRub > s.limits.daily_rub || spend.monthRub + reserveRub > s.limits.monthly_rub) throw new BudgetExceededError(spend);
  return spend;
}

export interface AiCallLog {
  kind: 'text' | 'image' | 'moderation' | 'validation';
  purpose: 'pool' | 'test';
  model: string;
  ok: boolean;
  error?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  costRub: number;
  durationMs: number;
  rarity?: Rarity | null;
  poolId?: string | null;
  moderation?: unknown;
  attempts?: number | null;
}

export async function logAiCall(c: AiCallLog): Promise<number> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO ai_generation_log (kind, purpose, model, ok, error, prompt_tokens, completion_tokens, cost_rub, duration_ms, rarity, pool_id, moderation, attempts)
    VALUES (${c.kind}, ${c.purpose}, ${c.model}, ${c.ok}, ${c.error?.slice(0, 1000) ?? null}, ${c.promptTokens ?? null}, ${c.completionTokens ?? null},
            ${c.costRub}, ${c.durationMs}, ${c.rarity ?? null}, ${c.poolId ?? null}, ${c.moderation === undefined ? null : sql.json(c.moderation as never)},
            ${c.attempts ?? null})
    RETURNING id`;
  return Number(row!.id);
}

export async function setLogModeration(id: number, moderation: unknown): Promise<void> {
  await sql`UPDATE ai_generation_log SET moderation = ${sql.json(moderation as never)} WHERE id = ${id}`;
}

export async function attachLogsToPool(logIds: number[], poolId: string): Promise<void> {
  if (logIds.length) await sql`UPDATE ai_generation_log SET pool_id = ${poolId} WHERE id IN ${sql(logIds)}`;
}
