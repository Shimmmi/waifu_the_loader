import type { Banner, Rarity, Stats, SwearLevel, Talent } from './schemas.js';
import type { PityKind } from './gacha.js';
import type { Notation } from './bignum.js';
import type { Rates } from './economy.js';
import type { StatBonus, TrainingOutcome } from './management.js';

export type Chatter = 'off' | 'rare' | 'normal' | 'often';
/** Средний интервал между репликами на складе, мс */
export const CHATTER_INTERVAL_MS: Record<Exclude<Chatter, 'off'>, number> = { rare: 12_000, normal: 6_000, often: 3_000 };

export interface UserSettings {
  swear: SwearLevel;
  theme: 'dark' | 'light' | 'system';
  notation: Notation;
  lang: 'ru' | 'en';
  skipGachaAnim: boolean;
  /** Частота реплик грузчиц на складе */
  chatter: Chatter;
  /** Короткие звуки интерфейса */
  sound: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  swear: 1,
  theme: 'system',
  notation: 'letters',
  lang: 'ru',
  skipGachaAnim: false,
  chatter: 'rare',
  sound: true,
};

export interface ResourcesDTO {
  cargo: string;
  cargoTotal: string;
  coins: string;
  protein: string;
  seals: string;
  tickets: number;
  tokens: number;
  shards: number;
}

export interface RatesDTO {
  power: number;
  cargoPerSec: string;
  coinsPerSec: string;
  proteinPerSec: string;
  pricePerKg: number;
  critChance: number;
  offlineEfficiency: number;
  mult: Rates['mult'];
}

export interface WaifuDTO {
  id: string;
  name: string;
  customName: string | null;
  age: number;
  rarity: Rarity;
  archetype: string;
  bio: string;
  quote: string;
  appearance: string;
  stats: Stats;
  talents: Talent[];
  portraitUrl: string;
  thumbUrl: string;
  level: number;
  stars: number;
  zone: WaifuZone;
  obtainedAt: string;
  power: number;
  /** Базовые статы без бонусов тренировок; stats = baseStats + statBonus */
  baseStats: Stats;
  statBonus: StatBonus;
  xp: number;
  xpNeed: number;
  /** Текущая усталость 0..100 */
  fatigue: number;
}

export type WaifuZone = 'warehouse' | 'gym' | 'contract' | null;

export interface TrainingJobDTO {
  id: string;
  instanceId: string;
  type: string;
  durationMin: number;
  startedAt: string;
  endsAt: string;
}

export interface ContractDTO {
  id: string;
  clientId: string;
  cargoId: string;
  tag: string;
  stat: string;
  durationMin: number;
  requiredPower: number;
  rewardCoins: string;
  rewardProtein: string;
  ticketChance: number;
  status: 'offer' | 'active';
  expiresAt: string;
  team: string[];
  successChance: number | null;
  startedAt: string | null;
  endsAt: string | null;
}

export interface PrestigeDTO {
  count: number;
  sealsEarned: number;
  sealsOnReset: number;
  /** Груз забега, нужный для следующей печати */
  nextSealCargo: string;
  upgrades: Record<string, number>;
  auto: { buildings: boolean };
  unlocked: { autoClaim: boolean; autoBuildings: boolean };
}

export interface NoticeDTO {
  kind: 'training' | 'contract' | 'auto_buildings' | 'achievement';
  outcome: TrainingOutcome | 'contract_success' | 'contract_partial' | 'info';
  waifuIds: string[];
  text: string;
  vars: Record<string, string>;
}

export interface PityDTO {
  sinceSsr: number;
  sinceSr: number;
  pulls: number;
  uses: number;
}

export interface BannerDTO extends Banner {
  active: boolean;
  pity: PityDTO;
}

export interface OfflineReportDTO {
  offlineSec: number;
  lostSec: number;
  efficiency: number;
  cargo: string;
  coins: string;
  protein: string;
}

export interface StateDTO {
  serverTime: number;
  configVersion: string;
  user: { id: string; nickname: string; isAdmin: boolean; settings: UserSettings };
  resources: ResourcesDTO;
  rates: RatesDTO;
  buildings: Record<string, number>;
  slots: number;
  waifu: WaifuDTO[];
  banners: BannerDTO[];
  dailyAvailable: boolean;
  cargoMilestone: number;
  offlineReport?: OfflineReportDTO;
  /** Билеты, начисленные за вехи груза при этом запросе */
  milestoneTickets?: number;
  limits: { gymSlots: number; contractSlots: number; boardSize: number; offlineCapHours: number };
  trainings: TrainingJobDTO[];
  contracts: ContractDTO[];
  prestige: PrestigeDTO;
  /** События автоматики и автозабора с прошлого запроса */
  notices?: NoticeDTO[];
  meta: MetaDTO;
}

export interface MetaDTO {
  claimed: string[];
  owned: string[];
  loadout: { frame: string | null; title: string | null; warehouse: string | null; card: string | null; summon: string | null };
  event: { id: string; score: number; claimed: number[] } | null;
  quests: { id: string; progress: number; claimed: boolean }[];
  mini: { id: string; templateId: string } | null;
  board: { nickname: string; cargo: string; rank: number }[];
  myRank: number | null;
  myCargo: string;
  regen: Record<string, string>;
  metrics: {
    cargoTotal: string;
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
  };
}

export interface PullItemDTO {
  rarity: Rarity;
  pity: PityKind;
  duplicate: boolean;
  shards: number;
  waifu: WaifuDTO;
}

export interface PullResponseDTO {
  bannerId: string;
  requestId: string;
  items: PullItemDTO[];
  state: StateDTO;
}

export interface GachaHistoryItemDTO {
  bannerId: string;
  createdAt: string;
  items: { rarity: Rarity; name: string; archetype: string; duplicate: boolean; pity: PityKind }[];
}

export interface ApiError {
  error: string;
  message: string;
}
