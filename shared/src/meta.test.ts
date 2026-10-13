import { describe, expect, it } from 'vitest';
import { D } from './bignum.js';
import {
  activeEvent,
  dueMilestones,
  dueTiers,
  emptyMetrics,
  inShop,
  loadMeta,
  questClaimable,
  streakNext,
  tierKey,
  weekStart,
} from './meta.js';

const meta = loadMeta();

describe('достижения', () => {
  it('выдаёт уровень один раз', () => {
    const m = emptyMetrics();
    m.cargoTotal = D(5000);
    const first = dueTiers(meta.achievements, m, new Set());
    expect(first.some((d) => d.achievement.id === 'hernia' && d.tier.id === 'bronze')).toBe(true);
    expect(first.some((d) => d.tier.id === 'silver')).toBe(false);
    const claimed = new Set(first.map((d) => tierKey(d.achievement.id, d.tier.id)));
    expect(dueTiers(meta.achievements, m, claimed).some((d) => d.achievement.id === 'hernia')).toBe(false);
  });

  it('скрытое «Невезучая» ждёт жёсткий pity', () => {
    const m = emptyMetrics();
    expect(dueTiers(meta.achievements, m, new Set()).some((d) => d.achievement.id === 'unlucky')).toBe(false);
    m.hardPity = true;
    expect(dueTiers(meta.achievements, m, new Set()).some((d) => d.achievement.id === 'unlucky')).toBe(true);
  });
});

describe('магазин и событие', () => {
  it('купленное не продаётся второй раз, грант не в магазине', () => {
    const shop = meta.cosmetics.filter((c) => inShop(c, new Date('2026-10-13T12:00:00+03:00')));
    expect(shop.every((c) => c.unlock === 'shop')).toBe(true);
    expect(shop.some((c) => c.id === 'title_pianist')).toBe(false);
    const owned = new Set(shop.map((c) => c.id));
    expect(meta.cosmetics.filter((c) => inShop(c, new Date('2026-10-13T12:00:00+03:00')) && !owned.has(c.id))).toEqual([]);
  });

  it('вехи события не повторяются', () => {
    const ev = activeEvent(meta.events, new Date('2026-10-13T12:00:00+03:00'));
    expect(ev?.id).toBe('piano_2026_10');
    expect(activeEvent(meta.events, new Date('2026-11-01T00:00:00+03:00'))).toBeNull();
    const due = dueMilestones(ev!, 3, new Set());
    expect(due).toEqual([0, 1]);
    expect(dueMilestones(ev!, 3, new Set(due))).toEqual([]);
  });

  it('ежедневка забирается один раз', () => {
    const q = meta.quests[0]!;
    expect(questClaimable(q, 0, false)).toBe(false);
    expect(questClaimable(q, q.need, false)).toBe(true);
    expect(questClaimable(q, q.need, true)).toBe(false);
  });
});

describe('календарь', () => {
  it('неделя начинается в понедельник по Москве', () => {
    expect(weekStart(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-12');
    expect(weekStart(new Date('2026-10-11T20:00:00Z'))).toBe('2026-10-05');
  });

  it('серия заходов', () => {
    expect(streakNext(4, '2026-10-12', '2026-10-13')).toBe(5);
    expect(streakNext(4, '2026-10-13', '2026-10-13')).toBe(4);
    expect(streakNext(4, '2026-10-01', '2026-10-13')).toBe(1);
    expect(streakNext(0, null, '2026-10-13')).toBe(1);
  });
});
