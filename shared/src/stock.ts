import type { Rarity } from './schemas.js';

/** Сколько готовых портретов на пару (редкость, архетип). 10 архетипов × 2 = 20 на редкость. */
export const STOCK_VARIANTS = 2;

/** ИИ рисует только эти редкости. N и R — всегда сток. */
export const AI_POOL_RARITIES: readonly Rarity[] = ['SR', 'SSR', 'UR'];

export function isAiRarity(r: Rarity): boolean {
  return (AI_POOL_RARITIES as readonly string[]).includes(r);
}

export function stockPortraitKey(rarity: Rarity, archetype: string, variant: number): string {
  return `stock/${rarity}/${archetype}_${variant}.webp`;
}

export function stockThumbKey(rarity: Rarity, archetype: string, variant: number): string {
  return `stock/${rarity}/${archetype}_${variant}_thumb.webp`;
}

export function pickStockVariant(seed: number, n = STOCK_VARIANTS): number {
  return ((seed >>> 0) % n + n) % n;
}

export function pickStock(rarity: Rarity, archetype: string, seed: number): { portrait: string; thumb: string; variant: number } {
  const variant = pickStockVariant(seed);
  return { portrait: stockPortraitKey(rarity, archetype, variant), thumb: stockThumbKey(rarity, archetype, variant), variant };
}
