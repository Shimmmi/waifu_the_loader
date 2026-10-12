import type { Banner, Rarity, Stats, SwearLevel, Talent } from './schemas.js';
import type { PityKind } from './gacha.js';
import type { Notation } from './bignum.js';

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
}

export const DEFAULT_SETTINGS: UserSettings = {
  swear: 1,
  theme: 'system',
  notation: 'letters',
  lang: 'ru',
  skipGachaAnim: false,
  chatter: 'rare',
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
  mult: { warehouse: number; talentsCargo: number; talentsCoins: number; crit: number; autopark: number };
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
  zone: 'warehouse' | null;
  obtainedAt: string;
  power: number;
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
