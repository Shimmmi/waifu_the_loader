/**
 * RouterAI (OpenAI/OpenRouter-совместимый API): текст, картинки и модерация.
 * Ключ берётся только из окружения и никуда, кроме заголовка Authorization, не уходит.
 */
import {
  buildAiProfile,
  extractJson,
  imagePrompt,
  ModerationSchema,
  moderationText,
  moderationVerdict,
  profileUserPrompt,
  type AiSettings,
  type Archetype,
  type Content,
  type EconomyConfig,
  type Moderation,
  type ModerationVerdict,
  type Rarity,
  type WaifuProfile,
} from '@wl/shared';
import { assertBudget, logAiCall, setLogModeration } from '../../server/src/ai-store.js';

export interface RouterAiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CallResult<T> {
  value: T;
  model: string;
  costRub: number;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

interface Usage {
  cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

export class RouterAiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly costRub = 0,
  ) {
    super(message);
  }
}

/** Модели, которые работают только через /images (узнаём по ответу API и запоминаем). */
const imagesEndpointModels = new Set<string>();

export class RouterAiClient {
  constructor(private readonly cfg: RouterAiConfig) {}

  private async post(path: string, body: unknown, timeoutSec: number): Promise<{ json: Record<string, unknown>; ms: number }> {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutSec * 1000),
      });
    } catch (e) {
      const err = e as Error;
      throw new RouterAiError(err.name === 'TimeoutError' ? `таймаут ${timeoutSec} с` : `сеть: ${err.message}`, 0);
    }
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new RouterAiError(`HTTP ${res.status}: не JSON (${text.slice(0, 120)})`, res.status);
    }
    const err = json.error as { message?: string; code?: number } | undefined;
    if (!res.ok || err) throw new RouterAiError(err?.message ?? `HTTP ${res.status}`, err?.code ?? res.status);
    return { json, ms: Date.now() - t0 };
  }

  async chat(
    model: string,
    messages: unknown[],
    opts: { temperature?: number; maxTokens?: number; json?: boolean; timeoutSec: number },
  ): Promise<CallResult<string>> {
    const { json, ms } = await this.post(
      'chat/completions',
      {
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      },
      opts.timeoutSec,
    );
    const choice = (json.choices as { message?: { content?: string } }[] | undefined)?.[0];
    const content = choice?.message?.content;
    const usage = (json.usage ?? {}) as Usage;
    if (!content) throw new RouterAiError('пустой ответ модели', 502, usage.cost ?? 0);
    return { value: content, model, costRub: usage.cost ?? 0, promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null, durationMs: ms };
  }

  async image(model: string, prompt: string, opts: { aspectRatio: string; resolution?: string; seed?: number; timeoutSec: number }): Promise<CallResult<Buffer>> {
    if (!imagesEndpointModels.has(model)) {
      try {
        const { json, ms } = await this.post(
          'chat/completions',
          {
            model,
            modalities: ['image'],
            messages: [{ role: 'user', content: prompt }],
            image_config: { aspect_ratio: opts.aspectRatio, ...(opts.resolution ? { resolution: opts.resolution } : {}) },
            ...(opts.seed ? { seed: opts.seed } : {}),
          },
          opts.timeoutSec,
        );
        const msg = (json.choices as { message?: { images?: { image_url?: { url?: string } }[] } }[] | undefined)?.[0]?.message;
        const url = msg?.images?.[0]?.image_url?.url;
        const usage = (json.usage ?? {}) as Usage;
        if (!url) throw new RouterAiError('модель не вернула картинку', 502, usage.cost ?? 0);
        return { value: await dataUrlToBuffer(url), model, costRub: usage.cost ?? 0, promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null, durationMs: ms };
      } catch (e) {
        if (!(e instanceof RouterAiError) || !/images endpoint/i.test(e.message)) throw e;
        imagesEndpointModels.add(model);
      }
    }
    return this.imagesEndpoint(model, prompt, opts, opts.aspectRatio);
  }

  private async imagesEndpoint(
    model: string,
    prompt: string,
    opts: { resolution?: string; seed?: number; timeoutSec: number },
    aspectRatio: string,
  ): Promise<CallResult<Buffer>> {
    try {
      const { json, ms } = await this.post(
        'images',
        { model, prompt, aspect_ratio: aspectRatio, ...(opts.resolution ? { resolution: opts.resolution } : {}), ...(opts.seed ? { seed: opts.seed } : {}) },
        opts.timeoutSec,
      );
      const item = (json.data as { b64_json?: string; url?: string }[] | undefined)?.[0];
      const usage = (json.usage ?? {}) as Usage;
      const buf = item?.b64_json ? Buffer.from(item.b64_json, 'base64') : item?.url ? await dataUrlToBuffer(item.url) : null;
      if (!buf) throw new RouterAiError('модель не вернула картинку', 502, usage.cost ?? 0);
      return { value: buf, model, costRub: usage.cost ?? 0, promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null, durationMs: ms };
    } catch (e) {
      // Часть моделей не умеет 3:4 — пробуем ближайшую вертикаль и обрезаем при постобработке
      if (e instanceof RouterAiError && /aspect_ratio/i.test(e.message) && aspectRatio !== '2:3') return this.imagesEndpoint(model, prompt, opts, '2:3');
      throw e;
    }
  }
}

async function dataUrlToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new RouterAiError(`не скачать картинку: HTTP ${r.status}`, r.status);
  return Buffer.from(await r.arrayBuffer());
}

// ---------- Провайдер ----------

export interface GenContext {
  purpose: 'pool' | 'test';
  rarity: Rarity;
  /** Сюда складываются id записей ai_generation_log, чтобы потом привязать их к waifu. */
  logIds: number[];
  log?: (m: string) => void;
}

/** Ориентировочная цена вызова для проверки лимита до запроса. */
const RESERVE_RUB = { text: 0.3, image: 6, moderation: 0.3 } as const;

export class RouterAiProvider {
  readonly name = 'routerai';
  constructor(
    private readonly client: RouterAiClient,
    private readonly settings: AiSettings,
    private readonly content: Content,
    private readonly cfg: EconomyConfig,
  ) {}

  /** Основная модель, при ошибке или таймауте — резервная (ТЗ 10.3). Каждый вызов логируется. */
  private async withFallback<T>(
    kind: keyof typeof RESERVE_RUB,
    block: { model: string; fallback: string },
    ctx: GenContext,
    call: (model: string) => Promise<CallResult<T>>,
  ): Promise<CallResult<T>> {
    const models = [block.model, block.fallback].filter((m, i, a) => m && a.indexOf(m) === i);
    let last: unknown;
    for (const model of models) {
      await assertBudget(this.settings, RESERVE_RUB[kind]);
      const t0 = Date.now();
      try {
        const r = await call(model);
        ctx.logIds.push(
          await logAiCall({ kind, purpose: ctx.purpose, model, ok: true, costRub: r.costRub, promptTokens: r.promptTokens, completionTokens: r.completionTokens, durationMs: r.durationMs, rarity: ctx.rarity }),
        );
        return r;
      } catch (e) {
        last = e;
        const msg = (e as Error).message;
        ctx.logIds.push(
          await logAiCall({ kind, purpose: ctx.purpose, model, ok: false, error: msg, costRub: e instanceof RouterAiError ? e.costRub : 0, durationMs: Date.now() - t0, rarity: ctx.rarity }),
        );
        ctx.log?.(`${kind} ${model} failed: ${msg}`);
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }

  /** Генерация профиля с валидацией и повтором до 3 попыток (ТЗ 10.1 п.1–2). */
  async generateProfile(
    req: { rarity: Rarity; archetype: Archetype; seed: number; takenNames: Set<string> },
    ctx: GenContext,
  ): Promise<{ profile: WaifuProfile; imagePrompt: string; attempts: number; errors: string[]; costRub: number; model: string; repairedStats: boolean }> {
    const errors: string[] = [];
    let costRub = 0;
    const s = this.settings.text;
    const t0 = Date.now();
    const outcome = async (ok: boolean, attempts: number, model: string) =>
      ctx.logIds.push(
        await logAiCall({ kind: 'validation', purpose: ctx.purpose, model, ok, error: errors.join(' | ') || null, costRub: 0, durationMs: Date.now() - t0, rarity: ctx.rarity, attempts }),
      );
    let lastModel = s.model;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const user = profileUserPrompt({ rarity: req.rarity, archetype: req.archetype, seed: req.seed + attempt, avoidNames: [...req.takenNames].slice(-30) }, this.content, this.cfg, this.settings);
      const feedback = errors.length ? `\nПрошлый ответ отклонён: ${errors.at(-1)}. Исправь это.` : '';
      const r = await this.withFallback('text', s, ctx, (model) =>
        this.client.chat(
          model,
          [
            { role: 'system', content: s.system_prompt },
            { role: 'user', content: user + feedback },
          ],
          { temperature: s.temperature, maxTokens: s.max_tokens, json: true, timeoutSec: s.timeout_sec },
        ),
      );
      costRub += r.costRub;
      lastModel = r.model;
      let raw: unknown;
      try {
        raw = extractJson(r.value);
      } catch (e) {
        errors.push(`попытка ${attempt}: ${(e as Error).message}`);
        continue;
      }
      const built = buildAiProfile(raw, { rarity: req.rarity, archetype: req.archetype }, this.content, this.cfg, req.takenNames);
      if (built.ok) {
        await outcome(true, attempt, r.model);
        return { ...built.value, attempts: attempt, errors, costRub, model: r.model };
      }
      errors.push(`попытка ${attempt}: ${built.errors.join('; ')}`);
      ctx.log?.(`profile rejected (${req.rarity}, try ${attempt}): ${built.errors.join('; ')}`);
    }
    await outcome(false, 3, lastModel);
    throw new ProfileValidationError(errors, costRub);
  }

  async generatePortrait(req: { rarity: Rarity; imagePrompt: string; seed: number }, ctx: GenContext): Promise<CallResult<Buffer> & { prompt: string }> {
    const s = this.settings.image;
    const prompt = imagePrompt(req.imagePrompt, req.rarity, this.settings);
    const r = await this.withFallback('image', s, ctx, (model) =>
      this.client.image(model, prompt, { aspectRatio: s.aspect_ratio, resolution: s.resolution || undefined, seed: s.seed || undefined, timeoutSec: s.timeout_sec }),
    );
    return { ...r, prompt };
  }

  /** Автомодерация картинки и текста одной vision-моделью (ТЗ 10.1 п.4). */
  async moderate(
    profile: WaifuProfile,
    image: Buffer,
    ctx: GenContext,
  ): Promise<{ verdict: ModerationVerdict; reasons: string[]; result: Moderation | null; costRub: number; model: string }> {
    const s = this.settings.moderation;
    if (!s.enabled) return { verdict: 'review', reasons: ['автомодерация выключена'], result: null, costRub: 0, model: '' };
    const dataUrl = `data:image/webp;base64,${image.toString('base64')}`;
    const r = await this.withFallback('moderation', s, ctx, (model) =>
      this.client.chat(
        model,
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${s.prompt}\n\n${moderationText(profile)}` },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        { temperature: 0, maxTokens: 400, json: true, timeoutSec: s.timeout_sec },
      ),
    );
    let result: Moderation;
    try {
      result = ModerationSchema.parse(extractJson(r.value));
    } catch (e) {
      return { verdict: 'review', reasons: [`ответ модерации не разобран: ${(e as Error).message}`], result: null, costRub: r.costRub, model: r.model };
    }
    const v = moderationVerdict(result);
    const logId = ctx.logIds.at(-1);
    if (logId !== undefined) await setLogModeration(logId, { ...result, verdict: v.verdict, reasons: v.reasons });
    return { ...v, result, costRub: r.costRub, model: r.model };
  }
}

export class ProfileValidationError extends Error {
  constructor(
    public readonly errors: string[],
    public readonly costRub: number,
  ) {
    super(`профиль не прошёл валидацию за 3 попытки: ${errors.at(-1) ?? ''}`);
  }
}
