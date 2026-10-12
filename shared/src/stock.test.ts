import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS } from './ai.js';
import { AI_POOL_RARITIES, isAiRarity, pickStock, pickStockVariant, STOCK_VARIANTS, stockPortraitKey } from './stock.js';

describe('стоковые портреты', () => {
  it('N и R не входят в ИИ-редкости', () => {
    expect(AI_POOL_RARITIES).toEqual(['SR', 'SSR', 'UR']);
    expect(isAiRarity('N')).toBe(false);
    expect(isAiRarity('R')).toBe(false);
    expect(isAiRarity('SSR')).toBe(true);
    expect(DEFAULT_AI_SETTINGS.pool.ai_rarities).toEqual(['SR', 'SSR', 'UR']);
    expect(DEFAULT_AI_SETTINGS.image.model).toBe('google/gemini-nano-banana-2.1');
  });

  it('вариант детерминирован по seed', () => {
    expect(pickStockVariant(7)).toBe(pickStockVariant(7));
    expect(pickStockVariant(0)).toBeGreaterThanOrEqual(0);
    expect(pickStockVariant(0)).toBeLessThan(STOCK_VARIANTS);
    const a = pickStock('N', 'fridge_quiet', 42);
    const b = pickStock('N', 'fridge_quiet', 42);
    expect(a).toEqual(b);
    expect(a.portrait).toBe(stockPortraitKey('N', 'fridge_quiet', a.variant));
    expect(a.thumb).toContain('_thumb.webp');
  });
});
