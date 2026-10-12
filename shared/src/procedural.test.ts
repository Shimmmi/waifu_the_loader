import { describe, expect, it } from 'vitest';
import { loadEconomy } from './config.js';
import { loadContent } from './content.js';
import { ageRange, capitalizeSentences, generateProceduralProfile, ruYears } from './procedural.js';
import { RARITIES } from './schemas.js';
import { validateProfile } from './validate.js';

describe('процедурные профили', () => {
  const content = loadContent();
  const cfg = loadEconomy();

  it('2000 профилей проходят валидацию, возраст совпадает с внешностью архетипа', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const rarity = RARITIES[seed % RARITIES.length]!;
      const p = generateProceduralProfile({ rarity, seed }, content, cfg);
      expect(validateProfile(p, cfg)).toEqual([]);
      const arch = content.archetypes.find((a) => a.id === p.archetype)!;
      const [lo, hi] = ageRange(arch.look);
      expect(p.age).toBeGreaterThanOrEqual(Math.max(18, lo));
      expect(p.age).toBeLessThanOrEqual(hi);
      expect(p.bio).not.toMatch(/\b\d*[1-4] лет/);
      expect(p.appearance).not.toMatch(/[A-Za-z]{4,}/);
    }
  });

  it('детерминирован по seed', () => {
    const a = generateProceduralProfile({ rarity: 'SR', seed: 42 }, content, cfg);
    const b = generateProceduralProfile({ rarity: 'SR', seed: 42 }, content, cfg);
    expect(a).toEqual(b);
  });

  it('склонение и заглавные буквы', () => {
    expect([21, 22, 25, 11, 34, 41].map(ruYears)).toEqual(['год', 'года', 'лет', 'лет', 'года', 'год']);
    expect(capitalizeSentences('раз. два! три… четыре')).toBe('Раз. Два! Три… Четыре');
  });
});
