import { describe, expect, it } from 'vitest';
import { ageMismatches, buildAiProfile, extractJson, imagePrompt, DEFAULT_AI_SETTINGS, moderationVerdict, profileUserPrompt, repairStats, type Moderation } from './ai.js';
import { loadEconomy, rarityConfig } from './config.js';
import { loadContent } from './content.js';

const content = loadContent();
const cfg = loadEconomy();
const arch = content.archetypes.find((a) => a.id === 'gym_philosopher')!;
const talentIds = (n: number) => content.talents.filter((t) => t.affinity.length === 0 || t.affinity.includes(arch.id)).slice(0, n).map((t) => t.id);

const good = (over: Record<string, unknown> = {}) => ({
  name: 'Сумирэ «Становая»',
  age: 34,
  bio: 'Сумирэ 34 года, и она уверена, что сейф — это просто штанга с характером. Цитирует Сенеку между подходами и ругается только на кривые палеты. Бригада слушает, потому что спорить с ней тяжело.',
  quote: 'Тяжело — значит, работаем.',
  appearance: 'Взрослая женщина с сильной челюстью и спокойным взглядом, в каске и брезентовой робе.',
  image_prompt: 'adult woman in her thirties with a thoughtful mature face, strong jaw, dark hair in a bun, hard hat, work gloves, lifting straps, squatting under a wooden crate in a warehouse',
  stats: { str: 50, end: 30, spd: 15, cha: 35, lck: 10 },
  talent_ids: talentIds(rarityConfig(cfg, 'SSR').talent_count),
  ...over,
});

describe('ИИ: разбор ответа', () => {
  it('достаёт JSON из markdown и текста вокруг', () => {
    expect(extractJson('Вот:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('prefix {"b": [1,2]} suffix')).toEqual({ b: [1, 2] });
    expect(() => extractJson('нет json')).toThrow();
  });

  it('статы — пропорции, сумма подгоняется под бюджет с ограничениями', () => {
    for (const budget of [50, 70, 100, 140, 200]) {
      const r = repairStats({ str: 9, end: 5, spd: 3, cha: 2, lck: 1 }, budget)!;
      const vals = Object.values(r.stats);
      expect(vals.reduce((a, b) => a + b, 0)).toBe(budget);
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...vals)).toBeLessThanOrEqual(Math.ceil(budget * 0.6));
    }
    expect(repairStats({ str: 28, end: 28, spd: 28, cha: 28, lck: 28 }, 140)!.repaired).toBe(false);
    expect(repairStats({ str: 10, end: 10 }, 100)).toBeNull();
    expect(repairStats({ str: 0, end: 0, spd: 0, cha: 0, lck: 0 }, 100)).toBeNull();
  });

  it('ловит расхождение возраста в тексте', () => {
    expect(ageMismatches({ age: 34, bio: 'Ей 34 года.', quote: 'ок', appearance: 'взрослая' })).toEqual([]);
    expect(ageMismatches({ age: 34, bio: 'В 19 лет пришла на склад, сейчас ей 34 года.', quote: 'ок', appearance: 'x' })).toEqual([19]);
  });
});

describe('ИИ: сборка профиля', () => {
  it('корректный ответ превращается в валидный профиль; таланты и их значения — с сервера', () => {
    const r = buildAiProfile(good(), { rarity: 'SSR', archetype: arch }, content, cfg, new Set());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.value.profile;
    expect(Object.values(p.stats).reduce((a, b) => a + b, 0)).toBe(rarityConfig(cfg, 'SSR').stat_budget);
    const tpl = content.talents.find((t) => t.id === p.talents[0]!.id)!;
    expect(p.talents[0]!.value).toBeCloseTo(tpl.base_value * rarityConfig(cfg, 'SSR').talent_scale, 3);
  });

  it('отклоняет: молодой возраст, чужие таланты, занятое имя, промпт без adult, запрещёнку', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ age: 19 }, /возраст/],
      [{ talent_ids: ['no_such_talent', 'x'] }, /неизвестный талант/],
      [{ bio: 'Сумирэ 34 года. Свисток она使用 не для красоты, а чтобы бригада не уронила сейф на лестнице между этажами.' }, /посторонние символы/],
      [{ talent_ids: talentIds(1) }, /талантов 1/],
      [{ image_prompt: 'woman with hard hat lifting a big wooden crate in a warehouse, strong arms' }, /adult/],
      [{ image_prompt: 'adult woman, schoolgirl uniform, lifting a big wooden crate in a warehouse' }, /запрещённое/],
      [{ bio: 'Сумирэ 34 года, но выглядит как подросток. Таскает сейфы и цитирует Сенеку, бригада в восторге от её подходов.' }, /запрещённое/],
    ];
    for (const [over, re] of cases) {
      const r = buildAiProfile(good(over), { rarity: 'SSR', archetype: arch }, content, cfg, new Set());
      expect(r.ok, JSON.stringify(over)).toBe(false);
      if (!r.ok) expect(r.errors.join('; ')).toMatch(re);
    }
    const dup = buildAiProfile(good(), { rarity: 'SSR', archetype: arch }, content, cfg, new Set(['сумирэ «становая»']));
    expect(dup.ok).toBe(false);
  });

  it('промпты: требования к возрасту и бюджету в тексте, adult-оговорка и негатив в портрете', () => {
    const u = profileUserPrompt({ rarity: 'UR', archetype: arch, seed: 1, avoidNames: [] }, content, cfg, DEFAULT_AI_SETTINGS);
    expect(u).toContain('от 21 до 55');
    expect(u).toContain(`сумма строго ${rarityConfig(cfg, 'UR').stat_budget}`);
    const ip = imagePrompt('adult woman in her thirties', 'UR', DEFAULT_AI_SETTINGS);
    expect(ip).toMatch(/adult woman, 21 or older/);
    expect(ip).toMatch(/Avoid: .*child/);
    expect(ip).toContain(DEFAULT_AI_SETTINGS.image.rarity_modifiers.UR);
  });
});

describe('ИИ: решение модерации', () => {
  const ok: Moderation = {
    adult_appearance: true,
    estimated_min_age: 28,
    childlike_features: false,
    nsfw: false,
    real_person_or_celebrity: false,
    brand_or_ip: false,
    discrimination: false,
    text_or_watermark: false,
    notes: '',
  };
  it('чистая картинка — в пул, детские черты и NSFW — в брак, сомнения — на проверку', () => {
    expect(moderationVerdict(ok).verdict).toBe('ready');
    expect(moderationVerdict({ ...ok, childlike_features: true }).verdict).toBe('rejected');
    expect(moderationVerdict({ ...ok, nsfw: true }).verdict).toBe('rejected');
    expect(moderationVerdict({ ...ok, estimated_min_age: 16 }).verdict).toBe('rejected');
    expect(moderationVerdict({ ...ok, estimated_min_age: 19 }).verdict).toBe('review');
    expect(moderationVerdict({ ...ok, text_or_watermark: true }).verdict).toBe('review');
    expect(moderationVerdict({ ...ok, adult_appearance: false }).verdict).toBe('review');
  });
});
