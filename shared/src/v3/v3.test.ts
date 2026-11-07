import { describe, expect, it } from 'vitest';
import {
  act,
  buildTraits,
  inWindow,
  loadV3,
  mapVeteran,
  mulberry32,
  newGame,
  offerCards,
  production,
  rollRarityIndex,
  sync,
  traitR,
  validAiText,
  validOfferTitle,
  view,
  withTemplates,
  V3_RARITIES,
  type Catalog,
  type Template,
} from './index.js';

function templatesFor(cat: Catalog, n = 2): Template[] {
  const out: Template[] = [];
  for (const race of cat.races) {
    for (const job of cat.classes) {
      for (let i = 0; i < n; i++) {
        const nn = String(i + 1).padStart(2, '0');
        out.push({
          templateId: `tpl_${race.id}_${job.id}_${nn}`,
          race: race.id,
          job: job.id,
          firstName: 'Мира',
          lastName: `Вокс${race.id.slice(0, 2)}${i}`,
          portrait: `/assets/templates/${race.id}/${job.id}/${race.id}_${job.id}_${nn}.webp`,
          thumb: `/assets/templates/${race.id}/${job.id}/${race.id}_${job.id}_${nn}_t.webp`,
        });
      }
    }
  }
  return out;
}

function cat(): Catalog {
  return withTemplates(loadV3(), templatesFor(loadV3()));
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('v3 content', () => {
  it('грузит заглушки', () => {
    const c = loadV3();
    expect(c.races).toHaveLength(8);
    expect(c.classes).toHaveLength(8);
    expect(c.traits).toHaveLength(28);
    expect(c.cards).toHaveLength(42);
    expect(c.buildings).toHaveLength(14);
    expect(c.bios.length).toBeGreaterThanOrEqual(200);
    expect(c.nicknames.length).toBeGreaterThanOrEqual(300);
  });
});

describe('traits', () => {
  it('10 000 наборов попадают в окно', () => {
    const c = loadV3();
    const rng = mulberry32(7);
    for (const rarity of V3_RARITIES) {
      for (let i = 0; i < 2000; i++) {
        const built = buildTraits(rng, rarity, c.traits, c.economy);
        const rows = built.map((id) => c.traits.find((t) => t.id === id.id)!);
        expect(inWindow(traitR(rows), c.economy.r_window[rarity] ?? {})).toBe(true);
        const neg = rows.filter((t) => t.sign === '-').length;
        expect(neg).toBeLessThanOrEqual(2);
        expect(neg).toBeLessThanOrEqual(Math.floor(rows.length / 2));
      }
    }
  });
});

describe('gacha rates', () => {
  it('100 000 роллов рядом со стационаром pity', () => {
    const c = loadV3();
    // Доли с гарантией 10/50/100, оценка по 2 млн роллов. Базовые веса без pity: 0,58 / 0,27 / 0,11 / 0,035 / 0,005.
    const expected = [0.5512895, 0.2563845, 0.1336855, 0.0451665, 0.013474];
    const rng = mulberry32(3);
    let pity = { rare: 0, epic: 0, legend: 0 };
    const got = [0, 0, 0, 0, 0];
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const roll = rollRarityIndex(rng, pity, c.gacha, c.gacha.pity.rare);
      pity = roll.pity;
      got[roll.index] = (got[roll.index] ?? 0) + 1;
    }
    V3_RARITIES.forEach((_, i) => {
      const share = (got[i] ?? 0) / N;
      expect(Math.abs(share - (expected[i] ?? 0))).toBeLessThan(0.003);
    });
  });
});

describe('roll duplicate', () => {
  it('дубль сохраняет портрет шаблона и поднимает ранг', () => {
    const c = cat();
    let g = newGame(0, c);
    const rng = mulberry32(11);
    const id = ids();
    g = act(g, { type: 'roll', count: 1, rng, ids: id }, c);
    const first = g.characters[0];
    expect(first).toBeTruthy();
    const only = c.templates.filter((t) => t.templateId === first!.templateId);
    const narrow = withTemplates(c, only);
    g = act(g, { type: 'roll', count: 1, rng, ids: id }, narrow);
    expect(g.characters).toHaveLength(1);
    expect(g.characters[0]!.starRank).toBe(1);
    expect(g.characters[0]!.portrait).toBe(first!.portrait);
  });
});

describe('cards', () => {
  it('набор без повторов, сухая серия даёт редкую', () => {
    const c = loadV3();
    const offer = offerCards(mulberry32(1), { expansions: 1, runCards: [], cardDry: 5 }, c);
    expect(new Set(offer.ids).size).toBe(offer.ids.length);
    expect(offer.ids.some((id) => c.cards.find((card) => card.id === id)?.rarity !== 'common')).toBe(true);
  });

  it('выбор нельзя переиграть тем же состоянием', () => {
    const c = cat();
    let g = newGame(0, c);
    g.credits = 10_000;
    const empty = g.base.floors[0]?.cells.find((cell) => cell.state === 'empty');
    expect(g.base.floors[0]?.cells[1]?.typeId).toBe('dock');
    g = act(g, { type: 'build', plotId: empty!.plotId, typeId: 'dorm', rng: mulberry32(2) }, c);
    const pending = g.pendingCards;
    expect(pending?.length).toBeGreaterThan(0);
    expect(g.pendingCards?.every((id) => {
      const card = c.cards.find((item) => item.id === id);
      return !card?.buildings.length || card.buildings.includes('dorm');
    })).toBe(true);
    expect(() => act(g, { type: 'build', plotId: 'missing', typeId: 'canteen', rng: mulberry32(9) }, c)).toThrow(/карточк/);
  });
});

describe('rebirth', () => {
  it('продаёт базу в счёт цены и оставляет пол кошелька', () => {
    const c = cat();
    let g = newGame(0, c);
    g.stars = 40;
    g.spent = 100_000;
    g.credits = 400_000;
    g.characters.push({
      id: 'keep',
      templateId: 'tpl_terran_loader_01',
      legacy: false,
      race: 'terran',
      job: 'loader',
      rarity: 'common',
      firstName: 'Мира',
      lastName: 'Вокс',
      nickname: 'Ржавая',
      bio: 'bio',
      quote: 'quote',
      traits: ['iron_back'],
      level: 4,
      xp: 0,
      starRank: 2,
      portrait: '/p.webp',
      thumb: '/t.webp',
      reserve: false,
    });
    g = act(g, { type: 'rebirth-preview', rng: mulberry32(4) }, c);
    const pick = g.pendingBases?.[0];
    expect(pick).toBeTruthy();
    const stars = g.stars;
    g = act(g, { type: 'rebirth-confirm', id: pick! }, c);
    expect(g.rebirths).toBe(1);
    expect(g.characters.some((ch) => ch.id === 'keep')).toBe(true);
    expect(g.stars).toBe(stars + 30);
    expect(g.base.templateId).toBe(pick);
    expect(g.credits).toBe(1000);
    expect(view(g, c).canRebirth).toBe(false);
  });

  it('без сюжета пускает, когда наличных хватает на разницу', () => {
    const c = cat();
    const g = newGame(0, c);
    g.spent = 100_000;
    g.credits = 399_999;
    expect(() => act(g, { type: 'rebirth-preview', rng: mulberry32(1) }, c)).toThrow(/кредит/);
    g.credits = 400_000;
    const next = act(g, { type: 'rebirth-preview', rng: mulberry32(1) }, c);
    expect(next.pendingBases?.length).toBeGreaterThan(0);
    expect(view(next, c).rebirthDue).toBe(400_000);
  });
});

describe('story', () => {
  it('пролог один раз', () => {
    const c = cat();
    const g = newGame(0, c);
    expect(g.seen.filter((id) => id === 'm01_prologue')).toHaveLength(1);
    const v = view(g, c);
    expect(v.queue.length).toBeGreaterThan(0);
  });
});

describe('staff and contracts', () => {
  it('назначение на док поднимает тоннаж и не снимает со смены', () => {
    const c = cat();
    let g = newGame(0, c);
    g.characters.push({
      id: 'keep',
      templateId: null,
      legacy: false,
      race: 'terran',
      job: 'loader',
      rarity: 'common',
      firstName: 'Мира',
      lastName: 'Вокс',
      nickname: 'Ржавая',
      bio: 'bio',
      quote: 'quote',
      traits: [],
      level: 1,
      xp: 0,
      starRank: 0,
      portrait: '/p.webp',
      thumb: '/t.webp',
      reserve: false,
    });
    const dock = g.base.floors.flatMap((f) => f.cells).find((cell) => cell.typeId === 'dock');
    expect(dock).toBeTruthy();
    const before = production(g, c).tonsPerSec;
    g = act(g, { type: 'assign', plotId: dock!.plotId, characterId: 'keep' }, c);
    expect(g.characters[0]!.reserve).toBe(false);
    expect(production(g, c).tonsPerSec).toBeGreaterThan(before);
    const post = view(g, c).posts.find((p) => p.plotId === dock!.plotId);
    expect(post?.k).toBeGreaterThan(1);
    expect(post?.crew[0]?.classMatch).toBe(true);
    g = act(g, { type: 'unassign', plotId: dock!.plotId, characterId: 'keep' }, c);
    expect(production(g, c).tonsPerSec).toBeCloseTo(before, 6);
  });

  it('доска роллится один раз и не переписывает награду', () => {
    const c = cat();
    let g = newGame(0, c);
    g.seen.push('m04_first_contract');
    g = sync(g, 1_000, c);
    expect(g.offers).toHaveLength(3);
    for (const o of g.offers) {
      expect(o.stars).toBeLessThanOrEqual(72);
      expect(o.credits).toBeLessThanOrEqual(12_000);
      if (o.kind === 'credits') expect(o.stars).toBe(0);
      if (o.kind === 'stars') expect(o.credits).toBe(0);
    }
    const snap = g.offers.map((o) => ({ id: o.id, credits: o.credits, stars: o.stars, name: o.name }));
    const again = sync(g, 2_000, c);
    expect(again.offers.map((o) => ({ id: o.id, credits: o.credits, stars: o.stars, name: o.name }))).toEqual(snap);
    const taken = snap[0]!;
    g = act(g, { type: 'contract-start', id: taken.id }, c);
    const running = g.active.find((a) => a.id === taken.id);
    expect(running?.credits).toBe(taken.credits);
    expect(running?.stars).toBe(taken.stars);
    expect(g.offers).toHaveLength(3);
    expect(g.offers.some((o) => o.id === taken.id)).toBe(false);
  });

  it('старая доска без вида пересобирается, а взятый заказ доигрывает свои числа', () => {
    const c = cat();
    const g = newGame(0, c);
    g.seen.push('m04_first_contract');
    g.offers = [{ id: 'flour', name: 'Мука', seconds: 7200, credits: 12000, stars: 60, starter: false } as never];
    g.active = [{ uid: 'old', id: 'flour', name: 'Мука', endsAt: 9_000, credits: 12000, stars: 60 }];
    const next = sync(g, 1_000, c);
    expect(next.offers.every((o) => o.kind && o.id !== 'flour')).toBe(true);
    expect(next.active[0]?.credits).toBe(12000);
    expect(next.active[0]?.stars).toBe(60);
  });
});

describe('ai text', () => {
  it('отклоняет короткий и некириллический ответ', () => {
    expect(validAiText({ nickname: 'Ржа', bio: 'а'.repeat(300), quote: 'Ну и смена.' }, new Set())).toBeTruthy();
    expect(validAiText({ nickname: 'Ржа', bio: 'hello '.repeat(80), quote: 'no' }, new Set())).toBeNull();
    expect(validOfferTitle({ title: 'Ночной фургон вёз муку мимо таможни прямо в бар Тупик' })).toBeTruthy();
    expect(validOfferTitle({ title: 'коротко' })).toBeNull();
  });
});

describe('migration map', () => {
  it('ветеран сохраняет портрет и получает класс по таблице', () => {
    const c = loadV3();
    const ch = mapVeteran({
      id: 'abc',
      archetype: 'tape_maniac',
      rarity: 'SSR',
      name: 'Нина «Скотч» Клей',
      bio: 'Клеила всё.',
      quote: 'Держит.',
      portrait: '/old.webp',
      thumb: '/old_t.webp',
      stars: 2,
      traits: c.traits,
      eco: c.economy,
      migration: c.migration,
    });
    expect(ch.legacy).toBe(true);
    expect(ch.templateId).toBeNull();
    expect(ch.job).toBe('mechanic');
    expect(ch.rarity).toBe('epic');
    expect(ch.starRank).toBe(2);
    expect(ch.portrait).toBe('/old.webp');
    expect(ch.race).toBe('terran');
  });
});

describe('offline', () => {
  it('дольше 8 часов не копится', () => {
    const c = cat();
    let g = newGame(0, c);
    g = act(g, { type: 'roll', count: 1, rng: mulberry32(1), ids: ids() }, c);
    const early = sync(g, 2 * 3600 * 1000, c);
    const late = sync(g, 40 * 3600 * 1000, c);
    expect(late.tonsTotal).toBeGreaterThan(0);
    expect(late.offline!.seconds).toBeLessThanOrEqual(8 * 3600);
    expect(late.tonsTotal).toBeLessThan(early.tonsTotal * 8);
  });
});

