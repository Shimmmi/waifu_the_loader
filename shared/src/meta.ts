import { z } from 'zod';
import achievementsJson from '../../config/achievements.json';
import cosmeticsJson from '../../config/cosmetics.json';
import eventsJson from '../../config/events.json';
import { D, type Decimal } from './bignum.js';

const TierSchema = z.object({
  id: z.enum(['bronze', 'silver', 'gold']),
  threshold: z.number().nonnegative(),
  tokens: z.number().int().min(0),
  tickets: z.number().int().min(0),
  cosmetic: z.string().nullable().optional(),
});
export type AchievementTier = z.infer<typeof TierSchema>;

export const METRICS = [
  'cargo_total',
  'collection',
  'full_archetypes',
  'ssr',
  'ur',
  'pulls',
  'hard_pity',
  'building',
  'trainings',
  'contracts',
  'piano',
  'prestiges',
  'streak',
  'minis',
] as const;
export type MetricKey = (typeof METRICS)[number];

const AchievementSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  hidden: z.boolean(),
  metric: z.enum(METRICS),
  tiers: z.array(TierSchema).min(1),
});
export type AchievementDef = z.infer<typeof AchievementSchema>;

const CosmeticSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  kind: z.enum(['frame', 'warehouse', 'summon', 'card', 'title']),
  name: z.string(),
  description: z.string(),
  price: z.number().int().min(0),
  unlock: z.enum(['shop', 'grant']),
  rotation: z.number().int().min(0).max(2).nullable(),
  css: z.string(),
});
export type CosmeticDef = z.infer<typeof CosmeticSchema>;

const RewardSchema = z.object({
  score: z.number().int().positive(),
  tokens: z.number().int().min(0),
  tickets: z.number().int().min(0),
  cosmetic: z.string().nullable(),
});

const EventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  milestones: z.array(RewardSchema).min(1),
});
export type LiveEvent = z.infer<typeof EventSchema>;

const QuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  metric: z.enum(['trainings', 'contracts', 'pulls']),
  need: z.number().int().positive(),
  tokens: z.number().int().positive(),
});
export type DailyQuest = z.infer<typeof QuestSchema>;

const MiniSchema = z.object({
  id: z.string(),
  text: z.string(),
  choices: z.array(z.object({ text: z.string(), tokens: z.number().int().min(0), tickets: z.number().int().min(0) })).min(2).max(3),
});
export type MiniTemplate = z.infer<typeof MiniSchema>;

export interface MetaContent {
  achievements: AchievementDef[];
  cosmetics: CosmeticDef[];
  regenTokens: number;
  events: LiveEvent[];
  quests: DailyQuest[];
  minis: MiniTemplate[];
  miniChance: number;
  miniGapMin: number;
}

let cache: MetaContent | null = null;

export function loadMeta(): MetaContent {
  if (cache) return cache;
  const a = z.object({ items: z.array(AchievementSchema).min(1) }).parse(achievementsJson);
  const c = z.object({ regen_tokens: z.number().int().positive(), items: z.array(CosmeticSchema).min(1) }).parse(cosmeticsJson);
  const e = z
    .object({
      mini_chance: z.number().min(0).max(1),
      mini_gap_min: z.number().int().positive(),
      events: z.array(EventSchema),
      quests: z.array(QuestSchema).min(1),
      minis: z.array(MiniSchema).min(1),
    })
    .parse(eventsJson);
  cache = {
    achievements: a.items,
    cosmetics: c.items,
    regenTokens: c.regen_tokens,
    events: e.events,
    quests: e.quests,
    minis: e.minis,
    miniChance: e.mini_chance,
    miniGapMin: e.mini_gap_min,
  };
  return cache;
}

export interface Metrics {
  cargoTotal: Decimal;
  collection: number;
  fullArchetypes: number;
  ssr: number;
  ur: number;
  pulls: number;
  hardPity: boolean;
  building: number;
  trainings: number;
  contracts: number;
  piano: number;
  prestiges: number;
  streak: number;
  minis: number;
}

const num = (m: Metrics, key: MetricKey): number => {
  switch (key) {
    case 'cargo_total':
      return m.cargoTotal.toNumber();
    case 'collection':
      return m.collection;
    case 'full_archetypes':
      return m.fullArchetypes;
    case 'ssr':
      return m.ssr;
    case 'ur':
      return m.ur;
    case 'pulls':
      return m.pulls;
    case 'hard_pity':
      return m.hardPity ? 1 : 0;
    case 'building':
      return m.building;
    case 'trainings':
      return m.trainings;
    case 'contracts':
      return m.contracts;
    case 'piano':
      return m.piano;
    case 'prestiges':
      return m.prestiges;
    case 'streak':
      return m.streak;
    case 'minis':
      return m.minis;
  }
};

export function meets(m: Metrics, key: MetricKey, threshold: number): boolean {
  if (key === 'cargo_total') return m.cargoTotal.gte(threshold);
  return num(m, key) >= threshold;
}

export const tierKey = (achievementId: string, tierId: string) => `${achievementId}:${tierId}`;

export interface DueTier {
  achievement: AchievementDef;
  tier: AchievementTier;
}

/** Уровни, которые ещё не выданы. Повторный вызов с пополненным claimed ничего не возвращает. */
export function dueTiers(list: AchievementDef[], m: Metrics, claimed: Set<string>): DueTier[] {
  const out: DueTier[] = [];
  for (const a of list) {
    for (const tier of a.tiers) {
      if (claimed.has(tierKey(a.id, tier.id))) continue;
      if (meets(m, a.metric, tier.threshold)) out.push({ achievement: a, tier });
    }
  }
  return out;
}

/** Понедельник календарной недели в часовом поясе, YYYY-MM-DD. */
export function weekStart(now = new Date(), tz = 'Europe/Moscow'): string {
  const [y, mo, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  const utc = new Date(Date.UTC(y!, mo! - 1, d!));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - (day === 0 ? 6 : day - 1));
  return utc.toISOString().slice(0, 10);
}

export function weekIndex(now = new Date()): number {
  return Math.floor(Date.parse(`${weekStart(now)}T00:00:00Z`) / (7 * 86_400_000));
}

export function inShop(item: CosmeticDef, now = new Date()): boolean {
  return item.unlock === 'shop' && (item.rotation === null || item.rotation === weekIndex(now) % 3);
}

export function activeEvent(events: LiveEvent[], now = new Date()): LiveEvent | null {
  return events.find((e) => now >= new Date(e.starts_at) && now <= new Date(e.ends_at)) ?? null;
}

export function dueMilestones(event: LiveEvent, score: number, claimed: Set<number>): number[] {
  return event.milestones.map((ms, i) => (score >= ms.score && !claimed.has(i) ? i : -1)).filter((i) => i >= 0);
}

export function questClaimable(q: DailyQuest, progress: number, claimed: boolean): boolean {
  return !claimed && progress >= q.need;
}

export function streakNext(prev: number, lastOn: string | null, today: string): number {
  if (lastOn === today) return prev;
  if (!lastOn) return 1;
  const prevDate = new Date(`${lastOn}T00:00:00Z`);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const diff = (todayDate.getTime() - prevDate.getTime()) / 86_400_000;
  return diff === 1 ? prev + 1 : 1;
}

export const emptyMetrics = (): Metrics => ({
  cargoTotal: D(0),
  collection: 0,
  fullArchetypes: 0,
  ssr: 0,
  ur: 0,
  pulls: 0,
  hardPity: false,
  building: 0,
  trainings: 0,
  contracts: 0,
  piano: 0,
  prestiges: 0,
  streak: 0,
  minis: 0,
});
