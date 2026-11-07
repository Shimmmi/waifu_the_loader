import { z } from 'zod';

export const V3_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type V3Rarity = (typeof V3_RARITIES)[number];

export const STAT_KEYS = ['str', 'spd', 'acc', 'end', 'cha', 'lck'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const EFFECT_TYPES = [
  'mult',
  'tag_mult',
  'global_mult',
  'stat_mult',
  'cost_mult',
  'slot_add',
  'contract_mult',
  'gacha_mod',
  'event_mod',
  'adjacency_bonus',
  'timed_burst',
  'grant',
  'meta_mod',
  'card_pick',
  'flag',
  'stamina_regen',
  'morale',
  'passive_credits',
  'loss_mult',
  'theft_mult',
  'xp_mult',
  'roll_cost_mult',
  'tonnage_mult',
  'crew_mult',
  'output_add',
] as const;

export const EffectSchema = z
  .object({
    type: z.enum(EFFECT_TYPES),
    stat: z.string().optional(),
    tag: z.string().optional(),
    target: z.string().optional(),
    value: z.number().optional(),
    cond: z.string().optional(),
    pool: z.string().optional(),
    rarity_min: z.string().optional(),
    key: z.string().optional(),
    amount: z.number().optional(),
  })
  .strict();
export type Effect = z.infer<typeof EffectSchema>;

const StatsSchema = z.object({ str: z.number(), spd: z.number(), acc: z.number(), end: z.number(), cha: z.number(), lck: z.number() });

export const RaceSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  mult: StatsSchema,
  passive: z.string(),
  weakness: z.string(),
  effects: z.array(EffectSchema).default([]),
});
export const ClassSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  role: z.string(),
  key_stat: z.string(),
  synergy_building: z.string(),
  class_mult: z.number(),
  base: StatsSchema,
  growth: StatsSchema,
  weight: z.number(),
});
export const TraitSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  sign: z.enum(['+', '-']),
  tier: z.number().int().min(1).max(3),
  kind: z.enum(['skill', 'character', 'quirk']),
  effects: z.array(EffectSchema),
  conflicts: z.array(z.string()),
  tags: z.array(z.string()),
  weight: z.number(),
  min_rarity: z.enum(V3_RARITIES),
});
export const BuildingSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  tag: z.string(),
  base_cost: z.number(),
  zone: z.enum(['any', 'underground', 'above', 'surface']),
  tier: z.number().int().min(1).max(4),
  effects: z.array(EffectSchema),
  shift_slots: z.object({ base: z.number(), per_levels: z.number() }).optional(),
  crew_slots: z.object({ at_1: z.number(), extra_at: z.array(z.number()) }).optional(),
  contract_slots: z.object({ base: z.number(), extra_at: z.array(z.number()) }).optional(),
  passive_credits: z.number().optional(),
  key_stat: z.enum(STAT_KEYS),
  baseline: z.number(),
  class_affinity: z.array(z.string()),
  race_affinity: z.array(z.string()),
  staff_slots: z.object({ base: z.number(), extra_at: z.array(z.number()) }),
});
export const CardSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  tags: z.array(z.string()),
  buildings: z.array(z.string()).default([]),
  text_ru: z.string().default(''),
  curse_ru: z.string().nullable().default(null),
  effects: z.array(EffectSchema),
  curse: z.array(EffectSchema).nullable(),
  max_stacks: z.number().int(),
  weight: z.number(),
  min_expansion_index: z.number().int(),
  requires: z.array(z.string()),
  persist: z.boolean(),
});
export const BaseCardSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  risk: z.enum(['low', 'medium', 'high']),
  layout_type: z.enum(['shaft', 'panorama']),
  start_buildings: z.array(z.object({ type: z.string(), level: z.number() })),
  buffs: z.array(EffectSchema),
  debuffs: z.array(EffectSchema),
  flavor_ru: z.string(),
  min_rebirth: z.number().int(),
  weight: z.number(),
  floors: z.number().optional(),
  cell_cap: z.number().optional(),
});

const TriggerSchema: z.ZodType<Trigger> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('counter'), key: z.string(), gte: z.number() }),
    z.object({ type: z.literal('flag'), key: z.string() }),
    z.object({ type: z.literal('building_level'), id: z.string(), gte: z.number() }),
    z.object({ type: z.literal('crew_size'), gte: z.number() }),
    z.object({ type: z.literal('rarity_obtained'), rarity: z.enum(V3_RARITIES) }),
    z.object({ type: z.literal('rebirth_count'), gte: z.number() }),
    z.object({ type: z.literal('chain_step'), id: z.string() }),
    z.object({ type: z.literal('all'), of: z.array(TriggerSchema) }),
  ]),
);
export type Trigger =
  | { type: 'counter'; key: string; gte: number }
  | { type: 'flag'; key: string }
  | { type: 'building_level'; id: string; gte: number }
  | { type: 'crew_size'; gte: number }
  | { type: 'rarity_obtained'; rarity: V3Rarity }
  | { type: 'rebirth_count'; gte: number }
  | { type: 'chain_step'; id: string }
  | { type: 'all'; of: Trigger[] };

export const MilestoneSchema = z.object({
  id: z.string(),
  act: z.number().int(),
  title_ru: z.string(),
  trigger: TriggerSchema,
  messages: z.array(z.object({ speaker: z.string(), key: z.string() })),
  rewards: z.array(EffectSchema),
  once: z.boolean(),
});
export const EconomyV3Schema = z.object({
  version: z.string(),
  output_scale: z.number(),
  credits_per_ton: z.number(),
  start_credits: z.number(),
  daily_stars: z.number(),
  offline_hours: z.number(),
  offline_rate: z.number(),
  online_grace_sec: z.number(),
  base_crew_slots: z.number(),
  level_cost_growth: z.number(),
  level_cap_building: z.number(),
  milestone_levels: z.array(z.number()),
  expand_base: z.number(),
  expand_growth: z.number(),
  max_cells_per_floor: z.number(),
  second_copy: z.number(),
  adjacency: z.number(),
  skip_refund: z.number(),
  reroll_base: z.number(),
  reroll_growth: z.number(),
  base_reroll_stars: z.number(),
  rebirth_base: z.number(),
  rebirth_growth: z.number(),
  rebirth_refund: z.number(),
  rebirth_floor: z.number(),
  contracts_offer: z.object({
    kind_weights: z.object({ credits: z.number(), stars: z.number(), hybrid: z.number() }),
    rarity_weights: z.record(z.enum(V3_RARITIES), z.number()),
    seconds: z.record(z.enum(V3_RARITIES), z.number()),
    credits_per_hour: z.number(),
    stars_per_hour: z.number(),
    rarity_mult: z.record(z.enum(V3_RARITIES), z.number()),
    hybrid_splits: z.array(z.number()),
    titles: z.object({
      credits: z.array(z.string()).min(1),
      stars: z.array(z.string()).min(1),
      hybrid: z.array(z.string()).min(1),
    }),
  }),
  legacy_tons: z.number(),
  star_stat: z.number(),
  star_cap: z.number(),
  xp_base: z.number(),
  xp_growth: z.number(),
  duplicate_stars: z.record(z.enum(V3_RARITIES), z.number()),
  rarity_mult: z.record(z.enum(V3_RARITIES), z.number()),
  level_cap: z.record(z.enum(V3_RARITIES), z.number()),
  r_window: z.record(z.enum(V3_RARITIES), z.object({ min: z.number().optional(), max: z.number().optional() })),
  trait_slots: z.record(z.enum(V3_RARITIES), z.object({ min: z.number(), max: z.number() })),
  tag_sets: z.record(z.string(), z.array(EffectSchema)),
});
export const GachaV3Schema = z.object({
  version: z.string(),
  cost: z.number(),
  cost10: z.number(),
  weights: z.record(z.enum(V3_RARITIES), z.number()),
  pity: z.object({ rare: z.number(), epic: z.number(), legendary: z.number() }),
  race_weight: z.number(),
  focus_mult: z.number(),
  focus_cost: z.number(),
  banners_enabled: z.boolean(),
  new_template_weight: z.number(),
  card_weights: z.array(z.object({
    until: z.number().nullable(),
    common: z.number(),
    rare: z.number(),
    epic: z.number(),
    legendary: z.number(),
  })),
  card_guarantee_dry: z.number(),
  card_stacks: z.record(z.enum(['common', 'rare', 'epic', 'legendary']), z.number()),
  base_weights: z.array(z.object({
    until: z.number().nullable(),
    common: z.number(),
    rare: z.number(),
    epic: z.number(),
    legendary: z.number(),
  })),
});
export const MetaNodeSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  effect_ru: z.string(),
  per_level: z.number(),
  max_level: z.number().int(),
  costs: z.array(z.number()),
});
export const ContractSchema = z.object({
  id: z.string(),
  name_ru: z.string(),
  seconds: z.number(),
  credits: z.number(),
  stars: z.number(),
  starter: z.boolean(),
});
export const BioSchema = z.object({
  bios: z.array(z.object({ class_id: z.string(), tags: z.array(z.string()), text: z.string() })),
  nicknames: z.array(z.string()),
});
export const MigrationSchema = z.object({
  shard_to_star: z.number(),
  rarity: z.record(z.string(), z.enum(V3_RARITIES)),
  archetype_class: z.record(z.string(), z.string()),
  default_race: z.string(),
});
export const UiSchema = z.object({
  tabs: z.array(z.object({ id: z.string(), name_ru: z.string() })),
});
export const StorySchema = z.object({
  hero_default: z.string(),
  hero_age: z.number(),
  corp: z.string(),
  planet: z.string(),
  company_default: z.string(),
  rival: z.string(),
  rival_boss: z.string(),
});
export const LocaleSchema = z.record(z.string());

export const COND_OK = new Set(['', 'night', 'morning', 'crew_gte_3', 'stamina_gt_50', 'shift_start']);
