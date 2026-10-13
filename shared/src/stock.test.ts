import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS } from './ai.js';
import { AI_POOL_RARITIES, isAiRarity, pickStock, STOCK_VARIANTS, stockPortraitKey } from './stock.js';

describe('стоковые портреты', () => {
  it('пул по умолчанию не заказывает картинки у RouterAI', () => {
    expect(AI_POOL_RARITIES).toEqual(['SR', 'SSR', 'UR']);
    expect(isAiRarity('N')).toBe(false);
    expect(isAiRarity('SR')).toBe(true);
    expect(DEFAULT_AI_SETTINGS.pool.ai_rarities).toEqual([]);
    expect(DEFAULT_AI_SETTINGS.image.model).toBe('google/gemini-nano-banana-2.1');
  });

  it('у каждого архетипа три кадра, seed выбирает один и тот же', () => {
    expect(STOCK_VARIANTS).toBe(3);
    const a = pickStock('UR', 'goth_packer', 42);
    const b = pickStock('UR', 'goth_packer', 42);
    expect(a).toEqual(b);
    expect(a.variant).toBeGreaterThanOrEqual(0);
    expect(a.variant).toBeLessThan(3);
    expect(a.portrait).toBe(stockPortraitKey('UR', 'goth_packer', a.variant));
    expect(pickStock('SSR', 'forklift_accountant', 1).portrait).toContain('forklift_accountant_');
  });
});