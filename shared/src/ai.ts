/**
 * ИИ-пайплайн (ТЗ 10): настройки моделей, промпты, разбор ответа LLM, валидация и решение модерации.
 * Сетевые вызовы живут в workers (RouterAiProvider), здесь — только чистая логика.
 */
import { z } from 'zod';
import { rarityConfig } from './config.js';
import type { Content } from './content.js';
import { talentFromTemplate } from './procedural.js';
import { RaritySchema, STATS, type Archetype, type EconomyConfig, type Rarity, type Stats, type WaifuProfile } from './schemas.js';
import { DEFAULT_POSES, DEFAULT_SHOTS, DEFAULT_THEMES, ThemeSchema, type Look } from './looks.js';
import { isAiRarity } from './stock.js';
import { findForbidden, validateProfile } from './validate.js';

// ---------- Настройки (таблица ai_settings, версии и откат) ----------

const ModelBlock = z.object({
  model: z.string().min(3),
  fallback: z.string().default(''),
  timeout_sec: z.number().int().min(10).max(600),
});

export const AiSettingsSchema = z.object({
  /** Общий выключатель генерации через ИИ. Выключено — пул пополняется процедурно. */
  enabled: z.boolean(),
  text: ModelBlock.extend({
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().int().min(300).max(8000),
    system_prompt: z.string().min(20),
    /** Режим мата в генерации: off — без мата, on — умеренный (жёсткий маскируется в клиенте всё равно). */
    swear: z.boolean(),
    lang: z.enum(['ru', 'en']),
  }),
  image: ModelBlock.extend({
    aspect_ratio: z.enum(['3:4', '2:3', '1:1']),
    resolution: z.string().default(''),
    /** 0 — случайный seed на каждую картинку. */
    seed: z.number().int().min(0),
    style_prompt: z.string().min(10),
    negative_prompt: z.string().min(10),
    rarity_modifiers: z.record(RaritySchema, z.string()),
    /** Темы образов: место, одежда, груз, свет (ТЗ 10: разнообразие портретов) */
    themes: z.array(ThemeSchema).min(1),
    poses: z.array(z.string().min(5)).min(1),
    shots: z.array(z.string().min(5)).min(1),
  }),
  moderation: ModelBlock.extend({
    enabled: z.boolean(),
    prompt: z.string().min(20),
  }),
  limits: z.object({
    daily_rub: z.number().min(0),
    monthly_rub: z.number().min(0),
  }),
  pool: z.object({
    /** Редкости, которые генерирует ИИ. N и R всегда со стоковых портретов — их сюда не кладём. */
    ai_rarities: z.array(RaritySchema).transform((xs) => xs.filter(isAiRarity)),
    /** Сколько ИИ-waifu держать готовыми на каждую ИИ-редкость. */
    ai_target: z.number().int().min(0).max(1000),
    /** Сколько ИИ-waifu делать за один прогон воркера. */
    ai_batch: z.number().int().min(1).max(50),
    /** Процедурный запас для ИИ-редкостей на случай остановки ИИ. */
    procedural_reserve: z.number().int().min(0).max(1000),
  }),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  text: {
    model: '~anthropic/claude-haiku-latest',
    fallback: 'deepseek/deepseek-v3.2',
    timeout_sec: 90,
    temperature: 0.95,
    max_tokens: 3000,
    swear: true,
    lang: 'ru',
    system_prompt: [
      'Ты — сценарист юмористической браузерной игры 18+ «Грузчицы Inc.» про аниме-девушек из бригады грузчиц, которые где угодно — на складе, пляже, в офисе, на фестивале, в фэнтези-мире — с серьёзным лицом таскают холодильники, рояли и сейфы.',
      'Ты пишешь карточки персонажей: короткие, смешные, с бытовым абсурдом и чёрным юмором. Что она грузчица, должно быть понятно из ситуации и груза, а не из униформы.',
      'Жёсткие правила:',
      '- Каждый персонаж — взрослая женщина от 21 года. Никаких упоминаний детства в настоящем, школы, школьной формы, подросткового возраста.',
      '- Контент SFW: без эротики, флирта с телом, обнажёнки и сексуальных намёков. Купальник на пляже — просто одежда, без акцента на теле.',
      '- Без реальных людей, знаменитостей, брендов и чужих персонажей.',
      '- Без оскорблений по расе, национальности, религии, полу, ориентации.',
      '- Отвечаешь строго одним JSON-объектом без пояснений и без markdown.',
    ].join('\n'),
  },
  image: {
    model: 'google/gemini-nano-banana-2.1',
    fallback: 'bytedance-seed/seedream-5-0-flash',
    timeout_sec: 180,
    aspect_ratio: '3:4',
    resolution: '',
    seed: 0,
    style_prompt:
      'Modern TV anime style, like a frame from a seasonal anime series. Simple cel shading with one shadow tone, clean bold outlines, flat bright colors, expressive anime eyes. Simplified background with few details, soft even lighting. Vertical character card art.',
    negative_prompt:
      'child, kid, teen, teenager, loli, schoolgirl, school uniform, childlike face, baby face, petite childlike body, chibi, nudity, see-through clothing, lingerie, cleavage focus, sexualized pose, hyper-detailed realistic rendering, text, letters, watermark, logo, brand names, real person likeness',
    rarity_modifiers: {
      N: 'Plain everyday look, simple composition.',
      R: 'Subtle cool blue rim light.',
      SR: 'Soft violet glow outline around the character.',
      SSR: 'Golden rim light and a few simple anime sparkles.',
      UR: 'Heroic pose with a bold crimson-and-gold aura drawn as simple flat anime effect shapes.',
    },
    themes: DEFAULT_THEMES,
    poses: DEFAULT_POSES,
    shots: DEFAULT_SHOTS,
  },
  moderation: {
    enabled: true,
    model: 'google/gemini-3.5-flash-lite',
    fallback: 'google/gemini-3.8-flash',
    timeout_sec: 60,
    prompt: [
      'You are a strict content moderator for an 18+ SFW game. All characters must be clearly adult women (21+) with mature adult faces and adult body proportions, no sexualization.',
      'Allowed: any normal clothing, including modest swimwear (swimsuit, bikini with shorts or sarong) in a beach or pool setting.',
      '"nsfw" is true for nudity, see-through clothing, lingerie, sexual poses or a camera focus on breasts, buttocks or crotch.',
      'Check the attached image and the character text. Answer with ONE JSON object only:',
      '{"adult_appearance": boolean, "estimated_min_age": integer, "childlike_features": boolean, "nsfw": boolean, "real_person_or_celebrity": boolean, "brand_or_ip": boolean, "discrimination": boolean, "text_or_watermark": boolean, "notes": "short reason"}',
      '"childlike_features" is true if the face, body proportions or clothing look like a child or teenager (school uniform, very small body, baby face).',
      '"estimated_min_age" is your lowest plausible age estimate for the person in the image.',
    ].join('\n'),
  },
  limits: { daily_rub: 100, monthly_rub: 1500 },
  pool: { ai_rarities: [], ai_target: 40, ai_batch: 4, procedural_reserve: 40 },
};

// ---------- Генерация профиля ----------

export const AiProfileSchema = z.object({
  name: z.string().min(2).max(40),
  age: z.number().int(),
  bio: z.string().min(40).max(700),
  quote: z.string().min(3).max(200),
  appearance: z.string().min(10).max(500),
  image_prompt: z.string().min(30).max(900),
  stats: z.record(z.string(), z.number()),
  talent_ids: z.array(z.string()).min(1).max(3),
});
export type AiProfile = z.infer<typeof AiProfileSchema>;

export interface ProfileRequest {
  rarity: Rarity;
  archetype: Archetype;
  seed: number;
  /** Образ для портрета: тема, одежда, груз */
  look?: Look;
  /** Имена, которые уже заняты — модель должна придумать другое. */
  avoidNames: string[];
}

export function profileUserPrompt(req: ProfileRequest, content: Content, cfg: EconomyConfig, s: AiSettings): string {
  const rc = rarityConfig(cfg, req.rarity);
  const a = req.archetype;
  const talents = content.talents.filter((t) => t.affinity.length === 0 || t.affinity.includes(a.id));
  const cap = Math.ceil(rc.stat_budget * 0.6);
  const swear = s.text.swear
    ? 'Обязателен умеренный русский мат: в bio или quote 1–2 крепких слова к месту (вроде «бля», «нахрен», «охуеть», «ёб твою мать», «похер»), как ругаются уставшие грузчицы. Мат — про ситуацию и груз, без оскорблений людей и групп.'
    : 'Без мата: только литературная ругань вроде «блин», «чёрт».';
  const lang = s.text.lang === 'en' ? 'Тексты name/bio/quote/appearance пиши на английском.' : 'Тексты name/bio/quote/appearance пиши на русском.';
  return [
    `Создай персонажа. Редкость: ${req.rarity} («${rc.name}»). Чем выше редкость, тем эпичнее и абсурднее легенда.`,
    `Архетип: ${a.name}. ${a.description} Тон: ${a.tone}.`,
    `Типичный груз архетипа: ${a.cargo.slice(0, 6).join('; ')}.`,
    `Характерные черты архетипа (причёску и цвет волос можно варьировать, фирменную деталь сохрани): ${a.traits}`,
    ...(req.look
      ? [
          `Ситуация: ${req.look.story}. В bio обыграй её и груз (${req.look.cargo}) — название груза пиши по-русски, без английских слов.`,
          `Одежда в этой карточке (англ., для портрета): ${req.look.outfit}.`,
        ]
      : []),
    swear,
    lang,
    `Имя в формате «Имя «Прозвище»» (японское или русское имя + смешное складское прозвище), до 40 символов.${req.avoidNames.length ? ` Не используй имена: ${req.avoidNames.slice(0, 30).join(', ')}.` : ''}`,
    'bio: 3–5 коротких предложений, не длиннее 550 символов. quote: одна фраза до 120 символов.',
    'Возраст — целое число от 21 до 55. В bio возраст упоминается ровно один раз в форме «N лет»/«N год»/«N года» и совпадает с полем age. Другие числа с «лет» не используй.',
    `stats: положительные целые str, end, spd, cha, lck, каждое от 1 до ${cap}, сумма строго ${rc.stat_budget} (например ${exampleStats(rc.stat_budget)}). Распредели под характер архетипа.`,
    `talent_ids: ровно ${rc.talent_count} разных id из списка (подходящих по смыслу):`,
    ...talents.map((t) => `- ${t.id}: ${t.name} — ${t.description}`),
    'image_prompt: на английском, 35–80 слов, только сама героиня: "adult woman in her <twenties|thirties|forties>", взрослые черты лица, причёска и цвет волос, телосложение, выражение лица, одежда из ситуации со своими деталями, фирменная деталь архетипа. Фон, свет и позу не описывай — их добавит сервер. Без имён, без цифр возраста, без текста на картинке.',
    'appearance: 1–2 предложения для игрока о внешности и одежде, взрослые черты.',
    `Seed для разнообразия: ${req.seed}.`,
    'Формат ответа — только JSON: {"name": "...", "age": 0, "bio": "...", "quote": "...", "appearance": "...", "image_prompt": "...", "stats": {"str": 0, "end": 0, "spd": 0, "cha": 0, "lck": 0}, "talent_ids": ["..."]}',
  ].join('\n');
}

/** Достаёт JSON-объект из ответа модели (иногда приходит в ```json … ``` или с текстом вокруг). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('в ответе нет JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function exampleStats(budget: number): string {
  const s = [0.3, 0.25, 0.2, 0.15].map((k) => Math.round(budget * k));
  return JSON.stringify({ str: s[0], end: s[1], spd: s[2], cha: s[3], lck: budget - s.reduce((a, b) => a + b, 0) });
}

/**
 * Статы от модели — это пропорции: точную сумму под бюджет редкости подгоняет сервер
 * (каждый стат ≥ 1 и ≤ 60% бюджета). Ошибка — только если статов нет или они некорректны.
 */
export function repairStats(raw: Record<string, number>, budget: number): { stats: Stats; repaired: boolean } | null {
  const cap = Math.ceil(budget * 0.6);
  const vals = STATS.map((k) => Math.round(Number(raw[k] ?? NaN)));
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const s = vals.map((v) => Math.max(1, Math.min(cap, Math.round((v / sum) * budget))));
  let diff = budget - s.reduce((a, b) => a + b, 0);
  for (let guard = 0; diff !== 0 && guard < 1000; guard++) {
    const order = [...s.keys()].sort((i, j) => (diff > 0 ? s[i]! - s[j]! : s[j]! - s[i]!));
    const i = order.find((k) => (diff > 0 ? s[k]! < cap : s[k]! > 1));
    if (i === undefined) return null;
    s[i] = s[i]! + Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const repaired = s.some((v, i) => v !== vals[i]);
  return { stats: { str: s[0]!, end: s[1]!, spd: s[2]!, cha: s[3]!, lck: s[4]! }, repaired };
}

const AGE_MENTION = /(?<!\d)(\d{1,3})\s*(?:-?\s*)(лет|года|год)(?!\p{L})/giu;

/** Все упоминания возраста в тексте должны совпадать с полем age (ТЗ M3: 0 несоответствий по возрасту). */
export function ageMismatches(p: Pick<WaifuProfile, 'age' | 'bio' | 'quote' | 'appearance'>): number[] {
  const bad: number[] = [];
  for (const text of [p.bio, p.quote, p.appearance]) {
    for (const m of text.matchAll(AGE_MENTION)) {
      const n = Number(m[1]);
      if (n !== p.age) bad.push(n);
    }
  }
  return bad;
}

export interface BuiltProfile {
  profile: WaifuProfile;
  imagePrompt: string;
  repairedStats: boolean;
}

/**
 * Превращает ответ LLM в профиль игры и проверяет его (ТЗ 10.1 п.2).
 * Таланты собираются из белого списка на сервере, значения не доверяются модели.
 */
export function buildAiProfile(
  raw: unknown,
  req: { rarity: Rarity; archetype: Archetype },
  content: Content,
  cfg: EconomyConfig,
  takenNames: Set<string>,
): { ok: true; value: BuiltProfile } | { ok: false; errors: string[] } {
  const parsed = AiProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const ai = parsed.data;
  const rc = rarityConfig(cfg, req.rarity);
  const errors: string[] = [];

  const st = repairStats(ai.stats, rc.stat_budget);
  if (!st) errors.push(`статы ${JSON.stringify(ai.stats)} некорректны: нужны все пять, положительные целые, сумма ${rc.stat_budget}`);

  const ids = [...new Set(ai.talent_ids)];
  const templates = ids.map((id) => content.talents.find((t) => t.id === id));
  if (templates.some((t) => !t)) errors.push(`неизвестный талант: ${ids.filter((_, i) => !templates[i]).join(', ')}`);
  if (ids.length !== rc.talent_count) errors.push(`талантов ${ids.length}, нужно ${rc.talent_count}`);

  if (ai.age < 21 || ai.age > 60) errors.push(`возраст ${ai.age} вне 21–60`);
  if (takenNames.has(ai.name.trim().toLowerCase())) errors.push(`имя «${ai.name}» уже занято`);
  if (!/\badult\b/i.test(ai.image_prompt)) errors.push('image_prompt без указания adult');
  const badPrompt = findForbidden(ai.image_prompt);
  if (badPrompt) errors.push(`запрещённое в image_prompt: «${badPrompt}»`);
  if (errors.length || !st) return { ok: false, errors };

  const profile: WaifuProfile = {
    name: ai.name.trim(),
    age: ai.age,
    rarity: req.rarity,
    archetype: req.archetype.id,
    bio: ai.bio.trim(),
    quote: ai.quote.trim(),
    appearance: ai.appearance.trim(),
    stats: st.stats,
    talents: templates.filter((t) => !!t).map((t) => talentFromTemplate(t, req.rarity, cfg)),
  };
  const mism = ageMismatches(profile);
  if (mism.length) errors.push(`возраст в тексте (${mism.join(', ')}) ≠ age ${profile.age}`);
  errors.push(...validateProfile(profile, cfg));
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { profile, imagePrompt: ai.image_prompt.trim(), repairedStats: st.repaired } };
}

// ---------- Портрет ----------

export const ADULT_CLAUSE =
  'The character is an adult woman, 21 or older, with a mature adult face and adult body proportions. SFW: no nudity, non-sexualized pose.';

export function imagePrompt(characterPrompt: string, rarity: Rarity, s: AiSettings, look?: Look): string {
  const scene = look
    ? `Scene: ${look.scene}, ${look.lighting}. Composition: ${look.shot}, she is ${look.pose}; the cargo is ${look.cargo}.`
    : '';
  return [s.image.style_prompt, s.image.rarity_modifiers[rarity] ?? '', scene, `Character: ${characterPrompt}`, ADULT_CLAUSE, `Avoid: ${s.image.negative_prompt}.`]
    .filter(Boolean)
    .join('\n');
}

// ---------- Модерация ----------

export const ModerationSchema = z.object({
  adult_appearance: z.boolean(),
  estimated_min_age: z.number(),
  childlike_features: z.boolean(),
  nsfw: z.boolean(),
  real_person_or_celebrity: z.boolean().default(false),
  brand_or_ip: z.boolean().default(false),
  discrimination: z.boolean().default(false),
  text_or_watermark: z.boolean().default(false),
  notes: z.string().default(''),
});
export type Moderation = z.infer<typeof ModerationSchema>;
export type ModerationVerdict = 'ready' | 'review' | 'rejected';

/** Детские черты, NSFW и дискриминация — сразу в брак; всё сомнительное — на ручную проверку (ТЗ 10.1 п.4). */
export function moderationVerdict(m: Moderation): { verdict: ModerationVerdict; reasons: string[] } {
  const reject: string[] = [];
  const review: string[] = [];
  if (m.childlike_features) reject.push('детские черты');
  if (m.nsfw) reject.push('NSFW');
  if (m.discrimination) reject.push('дискриминация');
  if (m.estimated_min_age < 18) reject.push(`оценка возраста ${m.estimated_min_age}`);
  else if (m.estimated_min_age < 21) review.push(`оценка возраста ${m.estimated_min_age}`);
  if (!m.adult_appearance) review.push('не выглядит взрослой');
  if (m.real_person_or_celebrity) review.push('похожа на реального человека');
  if (m.brand_or_ip) review.push('бренд или чужой персонаж');
  if (m.text_or_watermark) review.push('текст или водяной знак');
  if (reject.length) return { verdict: 'rejected', reasons: [...reject, ...review] };
  if (review.length) return { verdict: 'review', reasons: review };
  return { verdict: 'ready', reasons: [] };
}

export function moderationText(p: WaifuProfile): string {
  return `Character card text:\nName: ${p.name}\nAge: ${p.age}\nBio: ${p.bio}\nQuote: ${p.quote}\nAppearance: ${p.appearance}`;
}