import type { Rarity } from './schemas.js';

/** Порядок архетипов. Первые пять закрывают SSR и UR. */
export const STOCK_ARCHETYPES = [
  'fridge_quiet',
  'gymnast_rigger',
  'sleepy_piano',
  'shout_commander',
  'dreamy_courier',
  'forklift_accountant',
  'goth_packer',
  'gym_philosopher',
  'tape_maniac',
  'retired_waitress',
] as const;

/** Сколько разных готовых портретов на редкость. N/R/SR — по одному на архетип, SSR/UR — пять на всех. */
export const STOCK_SIZE: Record<Rarity, number> = { N: 10, R: 10, SR: 10, SSR: 5, UR: 5 };

/** ИИ может рисовать только эти редкости. По умолчанию пул их не заказывает: портреты уже готовы. */
export const AI_POOL_RARITIES: readonly Rarity[] = ['SR', 'SSR', 'UR'];

export function isAiRarity(r: Rarity): boolean {
  return (AI_POOL_RARITIES as readonly string[]).includes(r);
}

/** Для SSR/UR архетипы без своего кадра берут один из пяти готовых. */
export function stockArchetype(rarity: Rarity, archetype: string): string {
  const size = STOCK_SIZE[rarity];
  if (size >= STOCK_ARCHETYPES.length) return archetype;
  const i = STOCK_ARCHETYPES.indexOf(archetype as (typeof STOCK_ARCHETYPES)[number]);
  const slot = i < 0 ? 0 : i % size;
  return STOCK_ARCHETYPES[slot] ?? STOCK_ARCHETYPES[0];
}

export function stockPortraitKey(rarity: Rarity, archetype: string, variant = 0): string {
  return `stock/${rarity}/${stockArchetype(rarity, archetype)}_${variant}.webp`;
}

export function stockThumbKey(rarity: Rarity, archetype: string, variant = 0): string {
  return `stock/${rarity}/${stockArchetype(rarity, archetype)}_${variant}_thumb.webp`;
}

export function pickStockVariant(seed: number, n = 1): number {
  return ((seed >>> 0) % n + n) % n;
}

export function pickStock(rarity: Rarity, archetype: string, seed: number): { portrait: string; thumb: string; variant: number } {
  const variant = 0;
  void seed;
  return { portrait: stockPortraitKey(rarity, archetype, variant), thumb: stockThumbKey(rarity, archetype, variant), variant };
}
