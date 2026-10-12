/**
 * Процедурный генератор профилей waifu — локальный TextProvider до подключения RouterAI (M3)
 * и fallback при сбое ИИ-генерации. Детерминирован по seed.
 */
import { rarityConfig } from './config.js';
import { fill, type Content } from './content.js';
import { STATS, type EconomyConfig, type Rarity, type Stats, type Talent, type TalentTemplate, type WaifuProfile } from './schemas.js';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(arr: readonly T[], rnd: () => number): T => {
  const v = arr[Math.floor(rnd() * arr.length)];
  if (v === undefined) throw new Error('pick from empty array');
  return v;
};

/** Распределяет бюджет по статам с учётом весов архетипа; каждый стат ≥ 1 и ≤ 60% бюджета. */
export function rollStats(budget: number, bias: Stats, rnd: () => number): Stats {
  const cap = Math.ceil(budget * 0.6);
  const w = STATS.map((k) => bias[k] * (0.6 + rnd() * 0.8));
  const total = w.reduce((a, b) => a + b, 0);
  const s = STATS.map((_, i) => Math.max(1, Math.min(cap, Math.floor(((w[i] ?? 0) / total) * budget))));
  let diff = budget - s.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard++ < 10_000) {
    const i = Math.floor(rnd() * s.length);
    const cur = s[i] ?? 1;
    if (diff > 0 && cur < cap) {
      s[i] = cur + 1;
      diff--;
    } else if (diff < 0 && cur > 1) {
      s[i] = cur - 1;
      diff++;
    }
  }
  return { str: s[0]!, end: s[1]!, spd: s[2]!, cha: s[3]!, lck: s[4]! };
}

export function scaleTalentDescription(desc: string, base: number, value: number): string {
  const from = `${Math.round(base * 100)}%`;
  const to = `${Math.round(value * 100)}%`;
  return desc.split(from).join(to);
}

export function rollTalents(content: Content, archetype: string, rarity: Rarity, cfg: EconomyConfig, rnd: () => number): Talent[] {
  const rc = rarityConfig(cfg, rarity);
  const preferred = content.talents.filter((t) => t.affinity.includes(archetype));
  const out: Talent[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < rc.talent_count && guard++ < 200) {
    const src = preferred.length && rnd() < 0.7 ? preferred : content.talents;
    const t = pick(src, rnd);
    if (used.has(t.id)) continue;
    used.add(t.id);
    out.push(talentFromTemplate(t, rarity, cfg));
  }
  return out;
}

/** Значение таланта всегда считает сервер: base_value × talent_scale редкости. */
export function talentFromTemplate(t: TalentTemplate, rarity: Rarity, cfg: EconomyConfig): Talent {
  const value = Math.round(t.base_value * rarityConfig(cfg, rarity).talent_scale * 1000) / 1000;
  return {
    id: t.id,
    name: t.name,
    description: scaleTalentDescription(t.description, t.base_value, value),
    effect_type: t.effect_type,
    target: t.target,
    value,
    condition: t.condition,
  };
}

const AGE_BANDS: [RegExp, [number, number]][] = [
  [/early twenties/i, [20, 24]],
  [/mid-twenties/i, [24, 27]],
  [/late twenties/i, [27, 29]],
  [/early thirties/i, [30, 33]],
  [/mid-thirties/i, [33, 36]],
  [/late thirties/i, [36, 39]],
  [/thirties/i, [30, 39]],
  [/around forty/i, [38, 43]],
  [/early forties/i, [40, 44]],
  [/forties/i, [40, 49]],
];

/** Диапазон возраста по описанию внешности архетипа, чтобы возраст в БИО не спорил с портретом. */
export function ageRange(look: string): [number, number] {
  return AGE_BANDS.find(([re]) => re.test(look))?.[1] ?? [21, 45];
}

export function ruYears(n: number): string {
  const a = n % 100;
  const b = n % 10;
  if (a > 10 && a < 20) return 'лет';
  if (b === 1) return 'год';
  if (b >= 2 && b <= 4) return 'года';
  return 'лет';
}

export function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?…]\s+)(\p{Ll})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function generateProceduralProfile(
  opts: { rarity: Rarity; archetype?: string; seed: number },
  content: Content,
  cfg: EconomyConfig,
): WaifuProfile {
  const rnd = mulberry32(opts.seed);
  const arch = opts.archetype ? content.archetypes.find((a) => a.id === opts.archetype) : pick(content.archetypes, rnd);
  if (!arch) throw new Error(`Unknown archetype ${opts.archetype}`);
  const first = pick(content.names.first, rnd);
  const nick = pick(content.names.nick, rnd);
  const name = `${first} «${nick}»`.slice(0, 40);
  const [ageMin, ageMax] = ageRange(arch.look);
  const age = ageMin + Math.floor(rnd() * (ageMax - ageMin + 1));
  const cargo = pick(arch.cargo, rnd);
  const yearsDat = age % 10 === 1 && age % 100 !== 11 ? 'году' : 'годам';
  const vars = { name: first, age: String(age), years: ruYears(age), yearsDat, cargo };
  const tpl = (s: string) =>
    capitalizeSentences(fill(s.replace(/\{age\} лет/g, '{age} {years}').replace(/\{age\} годам/g, '{age} {yearsDat}'), vars));
  // Профиль общий для всех игроков: берём тексты не жёстче умеренного, режим «без мата» маскирует их на клиенте
  const soft = <T extends { swear: number }>(arr: T[]): T[] => {
    const f = arr.filter((x) => x.swear <= 1);
    return f.length ? f : arr;
  };
  const bio = tpl(pick(soft(arch.bio_templates), rnd).text);
  const quote = tpl(pick(soft(arch.quotes), rnd).text);
  const rc = rarityConfig(cfg, opts.rarity);
  return {
    name,
    age,
    rarity: opts.rarity,
    archetype: arch.id,
    bio,
    quote,
    appearance: `Женщина, ${age} ${ruYears(age)}. ${arch.look_ru}`,
    stats: rollStats(rc.stat_budget, arch.stat_bias, rnd),
    talents: rollTalents(content, arch.id, opts.rarity, cfg, rnd),
  };
}
