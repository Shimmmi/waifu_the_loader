import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS, imagePrompt, profileUserPrompt } from './ai.js';
import { loadEconomy } from './config.js';
import { loadContent } from './content.js';
import { DEFAULT_POSES, DEFAULT_SHOTS, DEFAULT_THEMES, pickLook, ThemeSchema } from './looks.js';
import { findForbidden } from './validate.js';

const opts = { themes: DEFAULT_THEMES, poses: DEFAULT_POSES, shots: DEFAULT_SHOTS };

describe('Образы ИИ-портретов', () => {
  it('темы по умолчанию валидны и не содержат запрещённого', () => {
    expect(ThemeSchema.array().safeParse(DEFAULT_THEMES).success).toBe(true);
    for (const t of DEFAULT_THEMES) {
      for (const s of [t.scene, t.story_ru, ...t.outfits, ...t.cargo, ...t.lighting]) expect(findForbidden(s), `${t.id}: ${s}`).toBeNull();
    }
  });

  it('только смена грузчицы или отдых, без фэнтези и чужих профессий', () => {
    const banned = ['fantasy', 'space', 'office', 'kitchen', 'stage', 'conservatory', 'festival'];
    expect(DEFAULT_THEMES.map((t) => t.id).some((id) => banned.includes(id))).toBe(false);
    for (const t of DEFAULT_THEMES) {
      expect(t.kind === 'work' || t.kind === 'rest').toBe(true);
      const blob = [t.scene, ...t.outfits, ...t.cargo, t.story_ru].join(' ');
      expect(blob).not.toMatch(/dragon|crystal|mage|chef|office|piano|concert|idol/i);
    }
    expect(pickLook(opts, 'UR', 123)).toEqual(pickLook(opts, 'UR', 123));
    let work = 0;
    let branded = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const look = pickLook(opts, 'N', seed);
      expect(banned).not.toContain(look.theme);
      if (look.kind === 'rest') expect(look.brand).toBe('');
      else {
        work++;
        if (look.brand) branded++;
      }
    }
    expect(branded / work).toBeGreaterThan(0.35);
    expect(branded / work).toBeLessThan(0.65);
  });

  it('без истории доли тем близки к весам, а перекос в пуле выравнивается', () => {
    const n = 20000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const t = pickLook(opts, 'SR', i).theme;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    const eligible = DEFAULT_THEMES.filter((t) => ['N', 'R', 'SR'].includes(t.min_rarity));
    const W = eligible.reduce((a, t) => a + t.weight, 0);
    for (const t of eligible) expect(Math.abs(counts[t.id]! / n - t.weight / W)).toBeLessThan(0.015);

    const usage = { warehouse: 30 };
    let warehouse = 0;
    for (let i = 0; i < 2000; i++) if (pickLook(opts, 'SR', i, usage).theme === 'warehouse') warehouse++;
    expect(warehouse / 2000).toBeLessThan(0.05);
  });

  it('образ попадает в промпт сценариста и в промпт портрета', () => {
    const content = loadContent();
    const look = pickLook(opts, 'SSR', 7);
    const arch = content.archetypes[0]!;
    const user = profileUserPrompt({ rarity: 'SSR', archetype: arch, seed: 1, avoidNames: [], look }, content, loadEconomy(), DEFAULT_AI_SETTINGS);
    expect(user).toContain(look.outfit);
    expect(user).toContain(arch.traits);
    expect(user).not.toMatch(/каска, перчатки/);
    const ip = imagePrompt('adult woman in her thirties', 'SSR', DEFAULT_AI_SETTINGS, look);
    expect(ip).toContain(look.scene);
    expect(ip).toContain(look.cargo);
    expect(ip).toContain('Do not place it on her back');
    expect(ip).not.toMatch(/on her back with straps|on one shoulder/);
    expect(ip).not.toMatch(/work clothes/);
    expect(ip).not.toMatch(/Avoid:/);
    expect(ip).not.toMatch(/\bSFW\b/);
    expect(ip).toMatch(/Modern TV anime style/);
    if (look.brand) expect(ip).toContain(look.brand);
  });
});
