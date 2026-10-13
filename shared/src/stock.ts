import type { Rarity } from './schemas.js';

/** Три готовых кадра на архетип, во всех пяти редкостях. */
export const STOCK_VARIANTS = 3;

/** ИИ может рисовать только эти редкости. По умолчанию пул их не заказывает: портреты уже готовы. */
export const AI_POOL_RARITIES: readonly Rarity[] = ['SR', 'SSR', 'UR'];

export function isAiRarity(r: Rarity): boolean {
  return (AI_POOL_RARITIES as readonly string[]).includes(r);
}

export function stockPortraitKey(rarity: Rarity, archetype: string, variant = 0): string {
  return `stock/${rarity}/${archetype}_${variant}.webp`;
}

export function stockThumbKey(rarity: Rarity, archetype: string, variant = 0): string {
  return `stock/${rarity}/${archetype}_${variant}_thumb.webp`;
}

export function pickStockVariant(seed: number, n = STOCK_VARIANTS): number {
  return ((seed >>> 0) % n + n) % n;
}

export function pickStock(rarity: Rarity, archetype: string, seed: number): { portrait: string; thumb: string; variant: number } {
  const variant = pickStockVariant(seed);
  return { portrait: stockPortraitKey(rarity, archetype, variant), thumb: stockThumbKey(rarity, archetype, variant), variant };
}
