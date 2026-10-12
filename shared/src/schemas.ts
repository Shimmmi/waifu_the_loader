import { z } from 'zod';

export const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR'] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

export const STATS = ['str', 'end', 'spd', 'cha', 'lck'] as const;
export type StatKey = (typeof STATS)[number];
export const StatsSchema = z.object({
  str: z.number().int().min(1),
  end: z.number().int().min(1),
  spd: z.number().int().min(1),
  cha: z.number().int().min(1),
  lck: z.number().int().min(1),
});
export type Stats = z.infer<typeof StatsSchema>;

/** 0 — без мата, 1 — умеренный, 2 — жёсткий. Текст показывается, если level <= настройки игрока. */
export const SwearLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type SwearLevel = z.infer<typeof SwearLevelSchema>;

// ---------- Таланты: только эффекты из белого списка (ТЗ 5.5) ----------
export const TALENT_EFFECTS = [
  'cargo_mult',
  'coins_mult',
  'crit_chance',
  'offline_bonus',
  'synergy',
  'contract_bonus',
  'training_speed',
] as const;
export const TalentEffectSchema = z.enum(TALENT_EFFECTS);
export type TalentEffect = z.infer<typeof TalentEffectSchema>;

/** global | self | building:<id> | archetype:<id> | contract:<type> */
export const TalentTargetSchema = z
  .string()
  .regex(/^(global|self|building:[a-z_]+|archetype:[a-z_]+|contract:[a-z_]+)$/);

export const TalentConditionSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('brigade_has_archetype'), archetype: z.string() }),
    z.object({ type: z.literal('brigade_size_gte'), n: z.number().int().min(1).max(5) }),
  ])
  .nullable();
export type TalentCondition = z.infer<typeof TalentConditionSchema>;

export const TalentSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(60),
  description: z.string().min(5).max(200),
  effect_type: TalentEffectSchema,
  target: TalentTargetSchema,
  /** Доля: 0.3 = +30%. Для crit_chance — абсолютная прибавка к шансу. */
  value: z.number().min(-0.5).max(5),
  condition: TalentConditionSchema,
});
export type Talent = z.infer<typeof TalentSchema>;

/** Шаблон таланта в конфиге: value задаётся для N и масштабируется редкостью. */
export const TalentTemplateSchema = TalentSchema.omit({ value: true }).extend({
  base_value: z.number().min(-0.5).max(2),
  /** Архетипы, которым талант выпадает чаще. Пусто — любой. */
  affinity: z.array(z.string()).default([]),
});
export type TalentTemplate = z.infer<typeof TalentTemplateSchema>;

// ---------- Архетипы ----------
export const ArchetypeSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name: z.string(),
  description: z.string(),
  /** Веса распределения статов при генерации (сумма не важна). */
  stat_bias: StatsSchema,
  /** Подсказки для промпта портрета (M3) и тон БИО. */
  look: z.string(),
  /** Внешность для игрока (поле appearance процедурных waifu). */
  look_ru: z.string().min(20),
  /** Внешность и фирменная деталь без одежды: ИИ-портрет одевает героиню по теме образа. */
  traits: z.string().min(20),
  tone: z.string(),
  /** Шаблоны БИО для процедурной генерации. Плейсхолдеры: {name} {age} {cargo}. */
  bio_templates: z.array(z.object({ text: z.string(), swear: SwearLevelSchema })).min(3),
  quotes: z.array(z.object({ text: z.string(), swear: SwearLevelSchema })).min(3),
  /** Любимые грузы — для сцены склада и текстов. */
  cargo: z.array(z.string()).min(3),
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

// ---------- Профиль waifu (результат TextProvider, проходит валидацию) ----------
export const WaifuProfileSchema = z.object({
  name: z.string().min(2).max(40),
  age: z.number().int().min(18).max(99),
  rarity: RaritySchema,
  archetype: z.string(),
  bio: z.string().min(40).max(700),
  quote: z.string().min(3).max(200),
  appearance: z.string().min(10).max(500),
  stats: StatsSchema,
  talents: z.array(TalentSchema).min(1).max(3),
});
export type WaifuProfile = z.infer<typeof WaifuProfileSchema>;

export const ReserveWaifuSchema = WaifuProfileSchema.extend({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Файл в server/assets/portraits/base/ */
  portrait: z.string(),
});
export type ReserveWaifu = z.infer<typeof ReserveWaifuSchema>;

// ---------- Флейвор-тексты ----------
export const FlavorLineSchema = z.object({ text: z.string(), swear: SwearLevelSchema });
export type FlavorLine = z.infer<typeof FlavorLineSchema>;
export const FlavorSchema = z.object({
  /** Отчёт «Пока вас не было». Плейсхолдеры: {hours} {cargo} {coins} {name} */
  offline_report: z.array(FlavorLineSchema).min(5),
  /** Реплики при открытии коробки призыва по редкостям */
  gacha_reveal: z.record(RaritySchema, z.array(FlavorLineSchema).min(3)),
  /** Реплика при дубликате. {name} {shards} */
  gacha_duplicate: z.array(FlavorLineSchema).min(3),
  /** Летающие подписи над сценой склада. {cargo} {kg} {name} */
  scene_popups: z.array(FlavorLineSchema).min(10),
  /** Подсказки-советы внизу экрана */
  tips: z.array(FlavorLineSchema).min(8),
  /** Реплика при улучшении здания, по id здания */
  building_upgrade: z.record(z.string(), z.array(FlavorLineSchema).min(2)),
  /** Ежедневная награда */
  daily_claim: z.array(FlavorLineSchema).min(3),
  /** Повышение уровня / звёзд. {name} */
  level_up: z.array(FlavorLineSchema).min(3),
  star_up: z.array(FlavorLineSchema).min(3),
});
export type Flavor = z.infer<typeof FlavorSchema>;

export const NamesSchema = z.object({
  first: z.array(z.string()).min(40),
  /** Прозвища: «Кувалда», «Два Шкафа» */
  nick: z.array(z.string()).min(30),
});
export type Names = z.infer<typeof NamesSchema>;

// ---------- Экономика ----------
export const MilestonesSchema = z.object({
  levels: z.array(z.number().int().positive()),
  /** После последней явной вехи — каждые N уровней */
  every_after: z.number().int().positive(),
  mult: z.number().positive(),
});

export const BuildingConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  start_level: z.number().int().min(0),
  base_cost: z.number().positive(),
  cost_growth: z.number().gt(1),
  /** Линейная часть эффекта за уровень */
  per_level: z.number(),
});
export type BuildingConfig = z.infer<typeof BuildingConfigSchema>;

export const RarityConfigSchema = z.object({
  id: RaritySchema,
  name: z.string(),
  weight: z.number().positive(),
  stat_budget: z.number().int().positive(),
  talent_count: z.number().int().min(1).max(3),
  power_mult: z.number().positive(),
  /** Множитель значений талантов относительно base_value */
  talent_scale: z.number().positive(),
  shards_on_duplicate: z.number().int().positive(),
  /** Множитель стоимости прокачки уровня */
  level_cost_mult: z.number().positive(),
  color: z.string(),
});
export type RarityConfig = z.infer<typeof RarityConfigSchema>;

export const STAT_KEY = z.enum(STATS);

export const CONTRACT_TAGS = ['piano', 'fridge', 'office', 'safe', 'fragile', 'weird', 'boxes'] as const;
export type ContractTag = (typeof CONTRACT_TAGS)[number];

export const ContractsContentSchema = z.object({
  clients: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), name: z.string().min(2), blurb: z.string().max(160) })).min(5),
  cargo: z
    .array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), name: z.string().min(2), tag: z.enum(CONTRACT_TAGS), stat: STAT_KEY, blurb: z.string().max(160) }))
    .min(5),
});
export type ContractsContent = z.infer<typeof ContractsContentSchema>;

const m4Lines = z.array(FlavorLineSchema).min(3);
export const FlavorM4Schema = z.object({
  /** {name} {training} {stat} {amount} */
  training_success: m4Lines,
  training_great: m4Lines,
  training_fail: m4Lines,
  /** {name} {client} {cargo} {coins} */
  contract_success: m4Lines,
  contract_partial: m4Lines,
  /** {name} */
  fatigue: m4Lines,
  /** {seals} */
  prestige: m4Lines,
});
export type FlavorM4 = z.infer<typeof FlavorM4Schema>;

export const TrainingTypeSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name: z.string(),
  icon: z.string(),
  description: z.string(),
  stats: z.array(STAT_KEY).min(1),
  xp_mult: z.number().positive(),
  stat_chance_mult: z.number().positive().optional(),
});
export type TrainingType = z.infer<typeof TrainingTypeSchema>;

export const TrainingConfigSchema = z.object({
  durations_min: z.array(z.number().int().positive()).min(1),
  types: z.array(TrainingTypeSchema).min(1),
  xp_per_min: z.number().positive(),
  xp_level_base: z.number().positive(),
  xp_level_growth: z.number().gt(1),
  stat_chance_base: z.number().min(0).max(1),
  stat_chance_per_hour: z.number().min(0),
  stat_chance_max: z.number().max(1),
  stat_gain_per_hour: z.number().positive(),
  great_chance: z.number().min(0).max(1),
  fail_chance: z.number().min(0).max(1),
  stat_bonus_cap_ratio: z.number().positive(),
  fatigue_per_hour: z.number().min(0),
  fatigue_min: z.number().min(0),
});

export const ContractsConfigSchema = z.object({
  durations_min: z.array(z.number().int().positive()).min(1),
  offer_ttl_min: z.number().int().positive(),
  team_max: z.number().int().positive(),
  reward_coin_seconds_mult: z.number().positive(),
  reward_protein_seconds_mult: z.number().min(0),
  ticket_chance_per_hour: z.number().min(0),
  ticket_chance_max: z.number().max(1),
  required_power_range: z.tuple([z.number().positive(), z.number().positive()]),
  chance_base: z.number(),
  chance_per_ratio: z.number(),
  ratio_cap: z.number().positive(),
  stat_bonus_max: z.number().min(0),
  lck_bonus: z.number().min(0),
  chance_min: z.number().min(0),
  chance_max: z.number().max(1),
  partial_reward: z.number().min(0).max(1),
  xp_per_min: z.number().min(0),
  fatigue_per_hour: z.number().min(0),
  fatigue_min: z.number().min(0),
});

export const PRESTIGE_EFFECTS = [
  'cargo_mult',
  'coins_mult',
  'protein_mult',
  'xp_mult',
  'offline_hours',
  'training_slots',
  'contract_slots',
  'start_coins',
  'prestige_tickets',
  'auto_claim',
  'auto_buildings',
] as const;
export type PrestigeEffect = (typeof PRESTIGE_EFFECTS)[number];

export const PrestigeNodeSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name: z.string(),
  icon: z.string(),
  description: z.string(),
  effect: z.enum(PRESTIGE_EFFECTS),
  value: z.number(),
  costs: z.array(z.number().int().positive()).min(1),
});
export type PrestigeNode = z.infer<typeof PrestigeNodeSchema>;

export const PrestigeConfigSchema = z.object({
  seals_divisor: z.number().positive(),
  seals_exponent: z.number().positive(),
  seal_bonus: z.number().min(0),
  tree: z.array(PrestigeNodeSchema).min(1),
});

export const EconomyConfigSchema = z.object({
  version: z.string(),
  rarities: z.array(RarityConfigSchema).length(5),
  power: z.object({
    weights: StatsSchema.extend({
      str: z.number(),
      end: z.number(),
      spd: z.number(),
      cha: z.number(),
      lck: z.number(),
    }),
    level_bonus: z.number(),
    star_bonus: z.number(),
  }),
  production: z.object({
    cargo_per_power: z.number().positive(),
    base_price_per_kg: z.number().positive(),
    cha_price_bonus: z.number(),
    lck_crit_chance: z.number(),
    crit_mult: z.number().gt(1),
    crit_cap: z.number().max(1),
  }),
  buildings: z.array(BuildingConfigSchema).min(1),
  building_milestones: MilestonesSchema,
  warehouse_slots: z.object({ base: z.number().int(), per_levels: z.number().int(), max: z.number().int() }),
  waifu_level: z.object({
    coin_base: z.number().positive(),
    protein_base: z.number().min(0),
    protein_from_level: z.number().int().min(1),
    growth: z.number().gt(1),
    cap_base: z.number().int().positive(),
    cap_per_star: z.number().int().positive(),
  }),
  stars: z.object({
    max: z.number().int().positive(),
    /** Стоимость n-й звезды в Осколках (индекс 0 — первая звезда) */
    shard_cost: z.array(z.number().int().positive()),
    rarity_cost_mult: z.record(RaritySchema, z.number().positive()),
  }),
  offline: z.object({
    cap_hours: z.number().positive(),
    online_grace_sec: z.number().int().positive(),
    report_min_sec: z.number().int().positive(),
    base_efficiency: z.number().min(0).max(1),
    end_efficiency: z.number().min(0),
    max_efficiency: z.number().max(1),
  }),
  start: z.object({
    coins: z.number().min(0),
    tickets: z.number().int().min(0),
    starter_reserve_id: z.string(),
  }),
  daily: z.object({ tickets: z.number().int(), coins_seconds: z.number(), timezone: z.string() }),
  cargo_milestones: z.array(z.object({ kg: z.number().positive(), tickets: z.number().int().positive() })),
  collection_base_capacity: z.number().int().positive(),
  gym: z.object({ slots_base: z.number().int().min(0), slots_per_levels: z.number().int().positive(), slots_max: z.number().int().positive() }),
  dispatch: z.object({
    active_base: z.number().int().min(0),
    active_per_levels: z.number().int().positive(),
    active_max: z.number().int().positive(),
    board_base: z.number().int().positive(),
    board_per_levels: z.number().int().positive(),
    board_max: z.number().int().positive(),
  }),
  dormitory: z.object({ max_extra_hours: z.number().min(0) }),
  fatigue: z.object({
    max: z.number().positive(),
    recovery_per_hour: z.number().positive(),
    canteen_reduction_per_level: z.number().min(0),
    canteen_reduction_max: z.number().min(0).max(1),
    penalty_at_max: z.number().min(0).max(1),
  }),
  training: TrainingConfigSchema,
  contracts: ContractsConfigSchema,
  prestige: PrestigeConfigSchema,
});
export type EconomyConfig = z.infer<typeof EconomyConfigSchema>;

// ---------- Gacha ----------
export const BannerSchema = z.object({
  id: z.string(),
  type: z.enum(['standard', 'event', 'newbie']),
  name: z.string(),
  description: z.string(),
  cost_per_pull: z.number().int().min(0),
  /** Разрешённые размеры призыва */
  pull_sizes: z.array(z.union([z.literal(1), z.literal(10)])),
  /** Для newbie: сколько раз можно призвать (1 = одноразово) */
  max_uses: z.number().int().positive().nullable(),
  /** Событийный: архетип с повышенным шансом на SSR+ */
  featured_archetype: z.string().nullable(),
  featured_share: z.number().min(0).max(1),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});
export type Banner = z.infer<typeof BannerSchema>;

export const GachaConfigSchema = z.object({
  version: z.string(),
  soft_pity_start: z.number().int().positive(),
  soft_pity_step: z.number().positive(),
  hard_pity: z.number().int().positive(),
  sr_guarantee_every: z.number().int().positive(),
  banners: z.array(BannerSchema).min(1),
});
export type GachaConfig = z.infer<typeof GachaConfigSchema>;
