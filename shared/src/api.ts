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
  /** Куда вернётся сама, если сейчас в зале или на заказе и место за ней держат. */
  homeZone?: WaifuZone;
  obtainedAt: string;
  power: number;
  /** Базовые статы без бонусов тренировок; stats = baseStats + statBonus */
  baseStats: Stats;
  statBonus: StatBonus;
  xp: number;
  xpNeed: number;
  /** Текущая усталость 0..100 */
  fatigue: number;
  /** Класс терминала. Пусто, пока вайп не включил линию. */
  jobClass?: string | null;
  station?: string | null;
  /** Наёмница смены. Карточки альбома до вайпа — false. */
  hired?: boolean;
  element?: string;
  psycho?: string;
}

export interface TerminalDTO {
  live: boolean;
  intro?: string;
  sectors?: { id: string; name: string; level: number }[];
  neighbors?: string[];
  offer?: { id: string; name: string }[];
  rerolls?: number;
  rerollCost?: number;
  expandCost?: number;
  building?: { sector: string; name: string; until: string } | null;
  stations?: {
    unload: { name: string; rate: number; slots: number; crew: string[] };
    move: { name: string; rate: number; slots: number; crew: string[] };
    store: { name: string; rate: number; slots: number; crew: string[] };
    support: { name: string; open: boolean; slots: number; crew: string[] };
  };
  bottleneck?: 'unload' | 'move' | 'store' | string;
  tonsPerMin?: number;
  shift?: { active: boolean; endsAt: string | null; mode: string; trial: boolean };
  rush?: { until: string | null; readyAt: string | null };
  report?: { grade: string; tons: number; coins: string; defect: number; best: string; joke: string; conflict: boolean } | null;
  morale?: number;
  autoShift?: boolean;
  dispatch?: boolean;
}

export type WaifuZone = 'warehouse' | 'gym' | 'contract' | 'clerk' | null;

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
  /** Линия терминала. live=false, пока скрипт вайпа не включил флаг. */
  terminal?: TerminalDTO;
  /** Превью конвейера v2. Тик монет по-прежнему старый, пока флаг выключен. */
  conveyor?: {
    enabled: boolean;
    tonsPerHour: number;
    bottleneck: string;
    hand: number;
    move: number;
    account: number;
    tier: number;
    forecast: string;
  };
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
  /** Имя waifu, которая уже занимает этот архетип и редкость. Есть только у дубля. */
  ownedName?: string | null;
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
  items: { rarity: Rarity; name: string; archetype: string; duplicate: boolean; pity: PityKind; ownedName?: string | null }[];
}

export interface ApiError {
  error: string;
  message: string;
}
