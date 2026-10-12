import { describe, expect, it } from 'vitest';
import {
  D,
  NO_MODS,
  applyXp,
  boardSize,
  buildingConfig,
  cargoForSeals,
  computeRates,
  contractChance,
  contractSlots,
  fatigueGain,
  fatigueNow,
  gymSlots,
  loadEconomy,
  makeOffer,
  mulberry32,
  nodeCost,
  offlineExtraHours,
  prestigeMods,
  rollTraining,
  sealsFor,
  statBonusCap,
  trainingSeconds,
  trainingSpeed,
  xpNeed,
  type ContractOffer,
  type ContractTeamMember,
  type Talent,
  type WaifuView,
} from './index.js';

const cfg = loadEconomy();

const waifu = (over: Partial<WaifuView> = {}): WaifuView => ({
  id: 'w1',
  archetype: 'fridge_quiet',
  rarity: 'N',
  stats: { str: 10, end: 10, spd: 10, cha: 10, lck: 10 },
  level: 1,
  stars: 0,
  talents: [],
  ...over,
});

const talent = (over: Partial<Talent> & Pick<Talent, 'effect_type' | 'target' | 'value'>): Talent => ({
  id: 'talent_1',
  name: 'Талант',
  description: 'Тестовый талант',
  condition: null,
  ...over,
});

const member = (over: Partial<ContractTeamMember> = {}): ContractTeamMember => ({
  rarity: 'N',
  stats: { str: 10, end: 10, spd: 10, cha: 10, lck: 10 },
  level: 1,
  stars: 0,
  talents: [],
  power: 100,
  fatigue: 0,
  ...over,
});

const seq = (values: readonly number[]): (() => number) => {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
};

const strength = () => {
  const type = cfg.training.types.find((t) => t.id === 'strength');
  if (!type) throw new Error('нет тренировки strength');
  return type;
};

describe('sealsFor', () => {
  it('0 при грузе меньше 1e9, 1 при 1e9 и 10 при 1e11', () => {
    expect(sealsFor(D(0), cfg)).toBe(0);
    expect(sealsFor(D(1e9).sub(1), cfg)).toBe(0);
    expect(sealsFor(D(1e9), cfg)).toBe(1);
    expect(sealsFor(D(1e11), cfg)).toBe(10);
  });

  it('согласован с cargoForSeals для n от 1 до 50', () => {
    for (let n = 1; n <= 50; n++) {
      const cargo = cargoForSeals(n, cfg);
      const exact = sealsFor(cargo, cfg);
      const bumped = sealsFor(cargo.mul(1.000001), cfg);
      expect(exact === n || bumped === n).toBe(true);
    }
  });
});

describe('prestigeMods', () => {
  it('пустые улучшения и 0 печатей — множители 1, флаги false', () => {
    const m = prestigeMods({}, 0, cfg);
    expect(m.cargoMult).toBe(1);
    expect(m.coinsMult).toBe(1);
    expect(m.proteinMult).toBe(1);
    expect(m.xpMult).toBe(1);
    expect(m.offlineHours).toBe(0);
    expect(m.trainingSlots).toBe(0);
    expect(m.contractSlots).toBe(0);
    expect(m.startCoins).toBe(0);
    expect(m.prestigeTickets).toBe(0);
    expect(m.autoClaim).toBe(false);
    expect(m.autoBuildings).toBe(false);
  });

  it('печати дают 1 + seal_bonus×N, уровень cargo складывается и обрезается по длине costs', () => {
    const seals = 4;
    const seal = 1 + cfg.prestige.seal_bonus * seals;
    const onlySeals = prestigeMods({}, seals, cfg);
    expect(onlySeals.cargoMult).toBeCloseTo(seal, 9);
    expect(onlySeals.coinsMult).toBeCloseTo(seal, 9);
    expect(onlySeals.proteinMult).toBe(1);

    const node = cfg.prestige.tree.find((n) => n.id === 'cargo');
    if (!node) throw new Error('нет узла cargo');
    const level = 2;
    expect(prestigeMods({ cargo: level }, 0, cfg).cargoMult).toBeCloseTo(1 + node.value * level, 9);
    expect(prestigeMods({ cargo: level }, seals, cfg).cargoMult).toBeCloseTo(seal * (1 + node.value * level), 9);
    expect(prestigeMods({ cargo: node.costs.length + 50 }, 0, cfg).cargoMult).toBeCloseTo(1 + node.value * node.costs.length, 9);
  });

  it('auto_claim и auto_buildings включают флаги', () => {
    const claim = prestigeMods({ auto_claim: 1 }, 0, cfg);
    expect(claim.autoClaim).toBe(true);
    expect(claim.autoBuildings).toBe(false);
    expect(prestigeMods({ auto_buildings: 1 }, 0, cfg).autoBuildings).toBe(true);
    expect(prestigeMods({}, 0, cfg).autoClaim).toBe(false);
  });
});

describe('nodeCost', () => {
  it('возвращает costs[level] и null на максимуме', () => {
    const node = cfg.prestige.tree.find((n) => n.id === 'cargo');
    if (!node) throw new Error('нет узла cargo');
    expect(nodeCost(node, 0)).toBe(node.costs[0]);
    expect(nodeCost(node, node.costs.length - 1)).toBe(node.costs[node.costs.length - 1]);
    expect(nodeCost(node, node.costs.length)).toBeNull();
  });
});

describe('слоты зданий', () => {
  it('gymSlots: 0 на уровне 0, растёт и не выше slots_max плюс моды', () => {
    const g = cfg.gym;
    expect(gymSlots({ gym: 0 }, cfg)).toBe(0);
    expect(gymSlots({ gym: 1 }, cfg)).toBe(g.slots_base);
    expect(gymSlots({ gym: g.slots_per_levels }, cfg)).toBeGreaterThan(gymSlots({ gym: 1 }, cfg));
    expect(gymSlots({ gym: 10_000 }, cfg)).toBe(g.slots_max);
    expect(gymSlots({ gym: 10_000 }, cfg, { ...NO_MODS, trainingSlots: 2 })).toBe(g.slots_max + 2);
  });

  it('contractSlots и boardSize: 0 без диспетчерской, растут и упираются в max', () => {
    const d = cfg.dispatch;
    expect(contractSlots({ dispatch: 0 }, cfg)).toBe(0);
    expect(boardSize({ dispatch: 0 }, cfg)).toBe(0);
    expect(contractSlots({ dispatch: 1 }, cfg)).toBe(d.active_base);
    expect(contractSlots({ dispatch: d.active_per_levels }, cfg)).toBeGreaterThan(contractSlots({ dispatch: 1 }, cfg));
    expect(contractSlots({ dispatch: 10_000 }, cfg)).toBe(d.active_max);
    expect(contractSlots({ dispatch: 10_000 }, cfg, { ...NO_MODS, contractSlots: 2 })).toBe(d.active_max + 2);
    expect(boardSize({ dispatch: 1 }, cfg)).toBe(d.board_base);
    expect(boardSize({ dispatch: d.board_per_levels }, cfg)).toBeGreaterThan(boardSize({ dispatch: 1 }, cfg));
    expect(boardSize({ dispatch: 10_000 }, cfg)).toBe(d.board_max);
  });
});

describe('offlineExtraHours', () => {
  it('ограничено dormitory.max_extra_hours + mods.offlineHours', () => {
    const per = buildingConfig(cfg, 'dormitory').per_level;
    expect(offlineExtraHours({ dormitory: 0 }, cfg)).toBe(0);
    expect(offlineExtraHours({ dormitory: 4 }, cfg)).toBeCloseTo(per * 4, 9);
    expect(offlineExtraHours({ dormitory: 10_000 }, cfg)).toBe(cfg.dormitory.max_extra_hours);
    expect(offlineExtraHours({ dormitory: 10_000 }, cfg, { ...NO_MODS, offlineHours: 3 })).toBe(cfg.dormitory.max_extra_hours + 3);
  });
});

describe('усталость', () => {
  it('до fatigueAt не падает, за час снимает recovery, Баня быстрее, не ниже 0', () => {
    const at = 10_000_000;
    expect(fatigueNow(40, at, at - 3_600_000, {}, cfg)).toBe(40);
    expect(fatigueNow(40, at, at, {}, cfg)).toBe(40);
    const hourLater = fatigueNow(40, at, at + 3_600_000, { bath: 0 }, cfg);
    expect(hourLater).toBeCloseTo(40 - cfg.fatigue.recovery_per_hour, 9);
    const bathLevel = 5;
    const withBath = fatigueNow(40, at, at + 3_600_000, { bath: bathLevel }, cfg);
    const bathRecovery = cfg.fatigue.recovery_per_hour + buildingConfig(cfg, 'bath').per_level * bathLevel;
    expect(withBath).toBeCloseTo(40 - bathRecovery, 9);
    expect(withBath).toBeLessThan(hourLater);
    expect(fatigueNow(5, at, at + 100 * 3_600_000, {}, cfg)).toBe(0);
  });

  it('Столовая уменьшает прирост, но не сильнее canteen_reduction_max', () => {
    const duration = 60;
    const raw = cfg.training.fatigue_min + (cfg.training.fatigue_per_hour * duration) / 60;
    const plain = fatigueGain('training', duration, { canteen: 0 }, cfg);
    const reduced = fatigueGain('training', duration, { canteen: 10 }, cfg);
    const capped = fatigueGain('training', duration, { canteen: 10_000 }, cfg);
    expect(plain).toBeCloseTo(raw, 9);
    expect(reduced).toBeLessThan(plain);
    expect(reduced).toBeGreaterThan(raw * (1 - cfg.fatigue.canteen_reduction_max));
    expect(capped).toBeCloseTo(raw * (1 - cfg.fatigue.canteen_reduction_max), 9);
    expect(fatigueGain('training', duration, { canteen: 80 }, cfg)).toBeCloseTo(capped, 9);
  });
});

describe('applyXp', () => {
  it('один уровень, несколько уровней за раз и упор в cap', () => {
    expect(applyXp(1, 0, xpNeed(1, cfg), 10, cfg)).toEqual({ level: 2, xp: 0, levels: 1 });
    const jump = xpNeed(1, cfg) + xpNeed(2, cfg) + xpNeed(3, cfg);
    expect(applyXp(1, 0, jump, 10, cfg)).toEqual({ level: 4, xp: 0, levels: 3 });
    const cap = 3;
    const stuck = applyXp(1, 0, 1_000_000, cap, cfg);
    expect(stuck.level).toBe(cap);
    expect(stuck.levels).toBe(cap - 1);
    expect(applyXp(cap, xpNeed(cap, cfg), 500, cap, cfg).level).toBe(cap);
  });
});

describe('rollTraining', () => {
  const input = {
    type: strength(),
    durationMin: 60,
    fatigue: 0,
    rarity: 'N' as const,
    bonus: null,
    xpMult: 1,
  };

  it('rnd = 0 даёт fail и половину опыта', () => {
    const res = rollTraining(() => 0, input, cfg);
    const baseXp = cfg.training.xp_per_min * input.durationMin * input.type.xp_mult * input.xpMult;
    expect(res.outcome).toBe('fail');
    expect(res.xp).toBe(Math.floor(baseXp * 0.5));
    expect(res.stat).toBeNull();
    expect(res.amount).toBe(0);
  });

  it('последовательность 0.99, 0, 0 даёт great со статом', () => {
    const res = rollTraining(seq([0.99, 0, 0]), input, cfg);
    expect(res.outcome).toBe('great');
    expect(res.stat).toBe('str');
    expect(res.amount).toBeGreaterThan(0);
    expect(res.capped).toBe(false);
  });

  it('бонус уже на потолке: amount 0 и capped', () => {
    const cap = statBonusCap('N', cfg);
    const res = rollTraining(seq([0.99, 0, 0]), { ...input, bonus: { str: cap } }, cfg);
    expect(res.amount).toBe(0);
    expect(res.capped).toBe(true);
  });

  it('на 10000 бросках доля fail около fail_chance при усталости 0', () => {
    const rnd = mulberry32(1);
    let fails = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      if (rollTraining(rnd, input, cfg).outcome === 'fail') fails++;
    }
    expect(Math.abs(fails / n - cfg.training.fail_chance)).toBeLessThanOrEqual(0.02);
  });
});

describe('makeOffer', () => {
  it('поля из списков, длительность из durations_min, мощность в диапазоне, награда > 0', () => {
    const clients = [{ id: 'client_a' }, { id: 'client_b' }];
    const cargo = [
      { id: 'cargo_piano', tag: 'piano' as const, stat: 'str' as const },
      { id: 'cargo_safe', tag: 'safe' as const, stat: 'end' as const },
    ];
    const [lo, hi] = cfg.contracts.required_power_range;
    const refPower = 1000;
    const base = {
      clients,
      cargo,
      refCoinsPerSec: D(3),
      refProteinPerSec: D(1),
      refPower,
      buildings: { dispatch: 1 },
    };
    const scripted = makeOffer(seq([0.99, 0, 0, 0]), base, cfg);
    expect(scripted.clientId).toBe('client_b');
    expect(scripted.cargoId).toBe('cargo_piano');
    expect(scripted.tag).toBe('piano');
    expect(scripted.stat).toBe('str');
    expect(scripted.durationMin).toBe(cfg.contracts.durations_min[0]);
    expect(scripted.rewardCoins.gt(0)).toBe(true);

    const rnd = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const offer = makeOffer(rnd, base, cfg);
      expect(clients.some((c) => c.id === offer.clientId)).toBe(true);
      const item = cargo.find((c) => c.id === offer.cargoId);
      expect(item).toBeDefined();
      expect(offer.tag).toBe(item?.tag);
      expect(offer.stat).toBe(item?.stat);
      expect(cfg.contracts.durations_min).toContain(offer.durationMin);
      expect(offer.requiredPower).toBeGreaterThanOrEqual(Math.max(10, Math.floor(refPower * lo)));
      expect(offer.requiredPower).toBeLessThanOrEqual(Math.max(10, Math.ceil(refPower * hi)));
      expect(offer.rewardCoins.gt(0)).toBe(true);
    }

    const tiny = makeOffer(() => 0, { ...base, refPower: 1, refCoinsPerSec: D(0) }, cfg);
    expect(tiny.requiredPower).toBe(10);
    expect(tiny.rewardCoins.gt(0)).toBe(true);
  });
});

describe('contractChance', () => {
  const offer = (tag: ContractOffer['tag'], requiredPower = 1000): Pick<ContractOffer, 'requiredPower' | 'stat' | 'tag'> => ({
    requiredPower,
    stat: 'str',
    tag,
  });

  it('пустая команда даёт 0; мощность повышает шанс, усталость 100 снижает; шанс в пределах', () => {
    expect(contractChance([], offer('boxes'), cfg)).toBe(0);
    const weak = contractChance([member({ power: 50 })], offer('boxes'), cfg);
    const strong = contractChance([member({ power: 800 })], offer('boxes'), cfg);
    expect(strong).toBeGreaterThan(weak);
    const fresh = contractChance([member({ power: 400, fatigue: 0 })], offer('boxes'), cfg);
    const tired = contractChance([member({ power: 400, fatigue: 100 })], offer('boxes'), cfg);
    expect(tired).toBeLessThan(fresh);
    const samples = [
      weak,
      strong,
      fresh,
      tired,
      contractChance([member({ power: 1, fatigue: 100 })], offer('boxes', 1e9), cfg),
      contractChance(
        [member({ power: 1e9, fatigue: 0, stats: { str: 3000, end: 10, spd: 10, cha: 10, lck: 5000 } })],
        offer('boxes', 1),
        cfg,
      ),
    ];
    for (const chance of samples) {
      expect(chance).toBeGreaterThanOrEqual(cfg.contracts.chance_min);
      expect(chance).toBeLessThanOrEqual(cfg.contracts.chance_max);
    }
  });

  it('талант contract:piano повышает шанс только для тега piano', () => {
    const pianoTalent = talent({
      id: 'piano_grip',
      name: 'Хват пианино',
      description: 'Увереннее таскает клавишные',
      effect_type: 'contract_bonus',
      target: 'contract:piano',
      value: 0.4,
    });
    const team = [member({ power: 200, talents: [pianoTalent] })];
    const piano = contractChance(team, offer('piano'), cfg);
    const fridge = contractChance(team, offer('fridge'), cfg);
    const plain = contractChance([member({ power: 200 })], offer('piano'), cfg);
    expect(piano).toBeGreaterThan(fridge);
    expect(piano).toBeGreaterThan(plain);
    expect(fridge).toBeCloseTo(plain, 9);
  });
});

describe('тренировки', () => {
  it('талант training_speed на себя ускоряет, trainingSeconds не меньше 30', () => {
    const slow = trainingSpeed(waifu(), [], { gym: 0 }, cfg);
    const fast = trainingSpeed(
      waifu({
        talents: [
          talent({
            effect_type: 'training_speed',
            target: 'self',
            value: 1,
          }),
        ],
      }),
      [],
      { gym: 0 },
      cfg,
    );
    expect(fast).toBeGreaterThan(slow);
    expect(trainingSeconds(60, fast)).toBeLessThan(trainingSeconds(60, slow));
    expect(trainingSeconds(60, slow)).toBeGreaterThanOrEqual(30);
    expect(trainingSeconds(1, 1000)).toBe(30);
  });
});

describe('computeRates', () => {
  it('мерч увеличивает монеты и не меняет груз, cargoMult удваивает груз', () => {
    const buildings = { warehouse: 5, canteen: 1, autopark: 0, merch: 0 };
    const plain = computeRates([waifu()], buildings, cfg);
    const merchLevel = 5;
    const withMerch = computeRates([waifu()], { ...buildings, merch: merchLevel }, cfg);
    expect(withMerch.cargoPerSec.toNumber()).toBeCloseTo(plain.cargoPerSec.toNumber(), 9);
    expect(withMerch.coinsPerSec.toNumber()).toBeGreaterThan(plain.coinsPerSec.toNumber());
    expect(withMerch.coinsPerSec.toNumber() / plain.coinsPerSec.toNumber()).toBeCloseTo(1 + buildingConfig(cfg, 'merch').per_level * merchLevel, 6);
    const doubled = computeRates([waifu()], buildings, cfg, { cargoMult: 2, coinsMult: 1, proteinMult: 1 });
    expect(doubled.cargoPerSec.toNumber()).toBeCloseTo(plain.cargoPerSec.toNumber() * 2, 6);
  });
});
