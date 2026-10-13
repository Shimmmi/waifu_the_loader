import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS } from './ai.js';
import { AI_POOL_RARITIES, isAiRarity, pickStock, STOCK_SIZE, stockArchetype, stockPortraitKey } from './stock.js';

describe('стоковые портреты', () => {
  it('пул по умолчанию не заказывает картинки у RouterAI', () => {
    expect(AI_POOL_RARITIES).toEqual(['SR', 'SSR', 'UR']);
    expect(isAiRarity('N')).toBe(false);
    expect(isAiRarity('SR')).toBe(true);
    expect(DEFAULT_AI_SETTINGS.pool.ai_rarities).toEqual([]);
    expect(DEFAULT_AI_SETTINGS.image.model).toBe('google/gemini-nano-banana-2.1');
  });

  it('N/R/SR — свой кадр на архетип, SSR/UR — пять кадров на всех', () => {
    expect(STOCK_SIZE).toEqual({ N: 10, R: 10, SR: 10, SSR: 5, UR: 5 });
    expect(stockArchetype('N', 'goth_packer')).toBe('goth_packer');
    expect(stockArchetype('SSR', 'fridge_quiet')).toBe('fridge_quiet');
    expect(stockArchetype('UR', 'forklift_accountant')).toBe('fridge_quiet');
    const a = pickStock('SR', 'sleepy_piano', 42);
    const b = pickStock('SR', 'sleepy_piano', 99);
    expect(a).toEqual(b);
    expect(a.portrait).toBe(stockPortraitKey('SR', 'sleepy_piano', 0));
    expect(a.thumb).toContain('_thumb.webp');
  });
});