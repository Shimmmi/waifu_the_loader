import economyJson from '../../config/economy.json';
import gachaJson from '../../config/gacha.json';
import { EconomyConfigSchema, GachaConfigSchema, type EconomyConfig, type GachaConfig, type Rarity, type RarityConfig } from './schemas.js';

let economyCache: EconomyConfig | null = null;
let gachaCache: GachaConfig | null = null;

export function loadEconomy(): EconomyConfig {
  return (economyCache ??= EconomyConfigSchema.parse(economyJson));
}

export function loadGacha(): GachaConfig {
  return (gachaCache ??= GachaConfigSchema.parse(gachaJson));
}

export function rarityConfig(cfg: EconomyConfig, r: Rarity): RarityConfig {
  const rc = cfg.rarities.find((x) => x.id === r);
  if (!rc) throw new Error(`Unknown rarity ${r}`);
  return rc;
}

export function rarityIndex(r: Rarity): number {
  return ['N', 'R', 'SR', 'SSR', 'UR'].indexOf(r);
}
