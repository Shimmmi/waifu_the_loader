/**
 * Симулятор прогресса: N игроков × D дней по тем же формулам, что считает сервер.
 * Три типа игроков (казуал / обычный / хардкор) с разным числом и длиной сессий.
 * Стратегия игрока: забрать получку, крутить все билеты ×10, ставить в бригаду самых сильных,
 * тратить монеты на самое дешёвое доступное улучшение.
 * Запуск: npm run sim:progress -- [players=10000] [days=30] [seed]
 */
import {
  baseRates,
  buildingConfig,
  buildingCost,
  cargoMilestoneRewards,
  computeRates,
  contractSlots,
  dispatchMult,
  D,
  formatNumber,
  generateProceduralProfile,
  levelCap,
  loadContent,
  loadEconomy,
  loadGacha,
  mulberry32,
  produce,
  rarityConfig,
  rarityIndex,
  RARITIES,
  rollOnce,
  sealsFor,
  settle,
  starCost,
  waifuLevelCost,
  waifuPower,
  warehouseSlots,
  type BuildingLevels,
  type PityState,
  type Resources,
  type WaifuView,
} from '@wl/shared';

const PLAYERS = Number(process.argv[2] ?? 10_000);
const DAYS = Number(process.argv[3] ?? 30);
const SEED = Number(process.argv[4] ?? 12345);

const econ = loadEconomy();
const gacha = loadGacha();
const content = loadContent();
const base = baseRates(econ);
const rng = mulberry32(SEED);
const archetypes = content.archetypes.map((a) => a.id);
const BUILDINGS = econ.buildings.map((b) => b.id);
const PULL_COST = gacha.banners.find((b) => b.id === 'standard')?.cost_per_pull ?? 1;

/** Каталог: по несколько профилей на (архетип, редкость), чтобы не генерировать на каждый призыв. */
const VARIANTS = 4;
const catalog = new Map<string, ReturnType<typeof generateProceduralProfile>[]>();
for (const a of archetypes)
  for (const r of RARITIES)
    catalog.set(
      `${a}:${r}`,
      Array.from({ length: VARIANTS }, (_, i) => generateProceduralProfile({ rarity: r, archetype: a, seed: 1 + i * 7919 + archetypes.indexOf(a) * 31 + rarityIndex(r) }, content, econ)),
    );

interface Kind {
  name: string;
  share: number;
  sessionsPerDay: [number, number];
  sessionMin: [number, number];
}
const KINDS: Kind[] = [
  { name: 'казуал', share: 0.5, sessionsPerDay: [1, 3], sessionMin: [2, 6] },
  { name: 'обычный', share: 0.35, sessionsPerDay: [3, 6], sessionMin: [5, 15] },
  { name: 'хардкор', share: 0.15, sessionsPerDay: [6, 12], sessionMin: [15, 45] },
];

interface Player {
  kind: Kind;
  res: Resources;
  tickets: number;
  shards: number;
  buildings: BuildingLevels;
  waifu: WaifuView[];
  owned: Set<string>;
  pity: PityState;
  newbieDone: boolean;
  milestoneIdx: number;
  pulls: number;
  firstSsrDay: number | null;
  activeSec: number;
  /** Активных часов до груза 1e9 / 1e12 (порог первой Печати Бригадира и ориентир M4) */
  hoursTo: Record<string, number | null>;
  lastTick: number;
  lastDaily: number;
}

const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
const GOALS = ['1e6', '1e9', '1e12'];

function newPlayer(kind: Kind): Player {
  const starter = catalog.get('fridge_quiet:N')![0]!;
  const buildings: BuildingLevels = {};
  for (const b of econ.buildings) buildings[b.id] = b.start_level;
  return {
    kind,
    res: { cargo: D(0), cargoTotal: D(0), coins: D(econ.start.coins), protein: D(0) },
    tickets: econ.start.tickets,
    shards: 0,
    buildings,
    waifu: [{ id: 'w0', archetype: starter.archetype, rarity: 'N', stats: starter.stats, level: 1, stars: 0, talents: starter.talents }],
    owned: new Set(['fridge_quiet:N']),
    pity: { sinceSsr: 0, sinceSr: 0 },
    newbieDone: false,
    milestoneIdx: 0,
    pulls: 0,
    firstSsrDay: null,
    activeSec: 0,
    hoursTo: Object.fromEntries(GOALS.map((g) => [g, null])),
    lastTick: 0,
    lastDaily: -1,
  };
}

function brigade(p: Player): WaifuView[] {
  const slots = warehouseSlots(p.buildings.warehouse ?? 1, econ);
  return p.waifu
    .map((w) => ({ w, pw: waifuPower(w, econ) }))
    .sort((a, b) => b.pw - a.pw)
    .slice(0, slots)
    .map((x) => x.w);
}

function pull(p: Player, day: number) {
  if (!p.newbieDone) {
    p.newbieDone = true;
    roll10(p, day, { sinceSsr: 0, sinceSr: 0 });
  }
  while (p.tickets >= PULL_COST * 10) {
    p.tickets -= PULL_COST * 10;
    p.pity = roll10(p, day, p.pity);
  }
}

function roll10(p: Player, day: number, pity: PityState): PityState {
  for (let i = 0; i < 10; i++) {
    const r = rollOnce(pity, base, gacha, rng);
    pity = r.state;
    p.pulls++;
    if ((r.rarity === 'SSR' || r.rarity === 'UR') && p.firstSsrDay === null) p.firstSsrDay = day;
    const arch = archetypes[Math.floor(rng() * archetypes.length)]!;
    const key = `${arch}:${r.rarity}`;
    if (p.owned.has(key)) {
      p.shards += rarityConfig(econ, r.rarity).shards_on_duplicate;
      continue;
    }
    p.owned.add(key);
    const prof = catalog.get(key)![Math.floor(rng() * VARIANTS)]!;
    p.waifu.push({ id: `w${p.waifu.length}`, archetype: arch, rarity: r.rarity, stats: prof.stats, level: 1, stars: 0, talents: prof.talents });
  }
  return pity;
}

interface Option {
  coins: number;
  protein: number;
  buy: () => void;
}

/** Здания без влияния на добычу игрок качает умеренно */
const UTILITY_CAP: Record<string, number> = { gym: 10, dormitory: 10, bath: 10 };

function buildingOption(p: Player, id: string): Option | null {
  if ((p.buildings[id] ?? 0) >= (UTILITY_CAP[id] ?? Infinity)) return null;
  return {
    coins: buildingCost(buildingConfig(econ, id), p.buildings[id] ?? 0).toNumber(),
    protein: 0,
    buy: () => {
      p.buildings[id] = (p.buildings[id] ?? 0) + 1;
    },
  };
}

function levelOption(w: WaifuView): Option | null {
  if (w.level >= levelCap(w.stars, econ)) return null;
  const lc = waifuLevelCost(w.rarity, w.level, econ);
  return {
    coins: lc.coins.toNumber(),
    protein: lc.protein.toNumber(),
    buy: () => {
      w.level++;
    },
  };
}

/** Покупает самое дешёвое доступное улучшение, пока хватает денег. Цены пересчитываются только у купленного. */
function spend(p: Player) {
  const team = brigade(p);
  const opts: (Option | null)[] = [...BUILDINGS.map((id) => buildingOption(p, id)), ...team.map(levelOption)];
  const refresh = (i: number) => (i < BUILDINGS.length ? buildingOption(p, BUILDINGS[i]!) : levelOption(team[i - BUILDINGS.length]!));
  let coins = p.res.coins.toNumber();
  let protein = p.res.protein.toNumber();
  let spentCoins = 0;
  let spentProtein = 0;
  for (let guard = 0; guard < 5000; guard++) {
    let bi = -1;
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      if (o && o.coins <= coins && o.protein <= protein && (bi < 0 || o.coins < opts[bi]!.coins)) bi = i;
    }
    if (bi < 0) break;
    const o = opts[bi]!;
    coins -= o.coins;
    protein -= o.protein;
    spentCoins += o.coins;
    spentProtein += o.protein;
    o.buy();
    opts[bi] = refresh(bi);
  }
  const nonNeg = (v: ReturnType<typeof D>) => (v.lt(0) ? D(0) : v);
  p.res.coins = nonNeg(p.res.coins.sub(spentCoins));
  p.res.protein = nonNeg(p.res.protein.sub(spentProtein));
  for (const w of [...p.waifu].sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity))) {
    const sc = starCost(w.rarity, w.stars, econ);
    if (sc !== null && sc <= p.shards) {
      p.shards -= sc;
      w.stars++;
    }
  }
}

/**
 * Контракты (упрощённо): скамейка (не в бригаде) едет на заказы, пока игрок онлайн.
 * Ожидаемая выплата = шанс × полная + (1 − шанс) × частичная.
 */
function contractCoinsPerSec(p: Player, rates: ReturnType<typeof computeRates>): number {
  const slots = contractSlots(p.buildings, econ);
  if (slots < 1) return 0;
  const c = econ.contracts;
  const team = brigade(p);
  const inTeam = new Set(team.map((w) => w.id));
  const powers = p.waifu.map((w) => waifuPower(w, econ)).sort((a, b) => b - a);
  const refPower = powers.slice(0, c.team_max).reduce((s, v) => s + v, 0);
  const bench = p.waifu.filter((w) => !inTeam.has(w.id)).map((w) => waifuPower(w, econ)).sort((a, b) => b - a);
  let earned = 0;
  for (let i = 0; i < slots; i++) {
    const members = bench.slice(i * c.team_max, (i + 1) * c.team_max);
    if (!members.length) break;
    const ratio = Math.min(c.ratio_cap, members.reduce((s, v) => s + v, 0) / Math.max(1, refPower * ((c.required_power_range[0] + c.required_power_range[1]) / 2)));
    const chance = Math.min(c.chance_max, Math.max(c.chance_min, c.chance_base + c.chance_per_ratio * ratio));
    earned += c.reward_coin_seconds_mult * (chance + (1 - chance) * c.partial_reward);
  }
  return rates.coinsPerSec.toNumber() * earned * dispatchMult(p.buildings, econ) * CONTRACT_UPTIME;
}
const CONTRACT_UPTIME = 0.7;

function gain(p: Player, sec: number, online = false) {
  if (sec <= 0) return;
  const rates = computeRates(brigade(p), p.buildings, econ);
  p.res = produce(p.res, rates, sec);
  if (online) p.res.coins = p.res.coins.add(contractCoinsPerSec(p, rates) * sec);
  const m = cargoMilestoneRewards(p.res.cargoTotal, p.milestoneIdx, econ);
  p.milestoneIdx = m.newIdx;
  p.tickets += m.tickets;
  for (const g of GOALS) if (p.hoursTo[g] === null && p.res.cargoTotal.gte(g)) p.hoursTo[g] = p.activeSec / 3600;
}

function session(p: Player, startSec: number, lenSec: number, day: number) {
  const rates = computeRates(brigade(p), p.buildings, econ);
  const s = settle(p.lastTick * 1000, startSec * 1000, rates, econ);
  gain(p, s.effectiveSec);
  if (p.lastDaily !== day) {
    p.lastDaily = day;
    p.tickets += econ.daily.tickets;
    p.res.coins = p.res.coins.add(rates.coinsPerSec.mul(econ.daily.coins_seconds));
  }
  pull(p, day);
  spend(p);
  // Онлайн-время дробим, чтобы игрок тратил монеты по ходу сессии
  const chunks = Math.max(1, Math.round(lenSec / 300));
  for (let i = 0; i < chunks; i++) {
    p.activeSec += lenSec / chunks;
    gain(p, lenSec / chunks, true);
    pull(p, day);
    spend(p);
  }
  p.lastTick = startSec + lenSec;
}

const CHECKPOINTS = [1, 3, 7, 14, 30, 60, 90].filter((d) => d <= DAYS);
type Snap = { cargo: number; wh: number; cn: number; ap: number; power: number; coll: number; pulls: number; best: number; stars: number };
const snaps = new Map<string, Snap[]>();
const firstSsr = new Map<string, (number | null)[]>();
const hoursTo = new Map<string, (number | null)[]>();

const t0 = performance.now();
for (let i = 0; i < PLAYERS; i++) {
  const x = rng();
  let acc = 0;
  const kind = KINDS.find((k) => (acc += k.share) >= x) ?? KINDS[0]!;
  const p = newPlayer(kind);
  for (let day = 0; day < DAYS; day++) {
    const n = Math.round(between(...kind.sessionsPerDay));
    const starts = Array.from({ length: n }, () => day * 86400 + 8 * 3600 + rng() * 15 * 3600).sort((a, b) => a - b);
    for (const st of starts) session(p, Math.max(st, p.lastTick + 60), between(...kind.sessionMin) * 60, day);
    if (CHECKPOINTS.includes(day + 1)) {
      const b = brigade(p);
      const key = `${kind.name}:${day + 1}`;
      if (!snaps.has(key)) snaps.set(key, []);
      snaps.get(key)!.push({
        cargo: p.res.cargoTotal.toNumber(),
        wh: p.buildings.warehouse ?? 0,
        cn: p.buildings.canteen ?? 0,
        ap: p.buildings.autopark ?? 0,
        power: b.reduce((s, w) => s + waifuPower(w, econ), 0),
        coll: p.owned.size,
        pulls: p.pulls,
        best: Math.max(...p.waifu.map((w) => rarityIndex(w.rarity))),
        stars: p.waifu.reduce((s, w) => s + w.stars, 0),
      });
    }
  }
  if (!firstSsr.has(kind.name)) firstSsr.set(kind.name, []);
  firstSsr.get(kind.name)!.push(p.firstSsrDay);
  for (const g of GOALS) {
    const key = `${kind.name}:${g}`;
    if (!hoursTo.has(key)) hoursTo.set(key, []);
    hoursTo.get(key)!.push(p.hoursTo[g] ?? null);
  }
}
const ms = performance.now() - t0;

const q = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
const fmt = (v: number) => formatNumber(D(v), 'letters');
const tri = (arr: number[], f: (v: number) => string = (v) => String(Math.round(v))) => `${f(q(arr, 0.1))} / ${f(q(arr, 0.5))} / ${f(q(arr, 0.9))}`;

console.log(`Игроков: ${PLAYERS.toLocaleString('ru')} · дней: ${DAYS} · seed ${SEED} · ${(ms / 1000).toFixed(1)} с`);
console.log('Значения в таблицах: p10 / медиана / p90\n');
for (const k of KINDS) {
  const ssr = firstSsr.get(k.name) ?? [];
  if (!ssr.length) continue;
  const got = ssr.filter((d): d is number => d !== null);
  console.log(`── ${k.name} (${ssr.length}) · сессий в день ${k.sessionsPerDay.join('–')}, по ${k.sessionMin.join('–')} мин`);
  console.log(`   первая SSR+ за ${DAYS} дн.: у ${((got.length / ssr.length) * 100).toFixed(0)}% игроков, медиана — день ${q(got, 0.5) + 1}`);
  for (const g of GOALS) {
    const h = hoursTo.get(`${k.name}:${g}`) ?? [];
    const reached = h.filter((v): v is number => v !== null);
    console.log(
      `   груз ${g}: достигли ${((reached.length / Math.max(1, h.length)) * 100).toFixed(0)}%, активных часов ${reached.length ? tri(reached, (v) => v.toFixed(1)) : '—'}`,
    );
  }
  console.log('   день │ груз всего         │ склад     │ столовая │ автопарк │ мощность бригады │ коллекция │ призывов     │ лучшая ≥SSR');
  for (const d of CHECKPOINTS) {
    const s = snaps.get(`${k.name}:${d}`) ?? [];
    const bestSsr = s.filter((x) => x.best >= rarityIndex('SSR')).length / Math.max(1, s.length);
    console.log(
      `   ${String(d).padStart(4)} │ ${tri(s.map((x) => x.cargo), fmt).padEnd(18)} │ ${tri(s.map((x) => x.wh)).padEnd(9)} │ ${tri(s.map((x) => x.cn)).padEnd(8)} │ ${tri(s.map((x) => x.ap)).padEnd(8)} │ ${tri(s.map((x) => x.power)).padEnd(16)} │ ${tri(s.map((x) => x.coll)).padEnd(9)} │ ${tri(s.map((x) => x.pulls)).padEnd(12)} │ ${(bestSsr * 100).toFixed(0)}%`,
    );
  }
  console.log('');
}
const all30 = KINDS.flatMap((k) => snaps.get(`${k.name}:${Math.min(30, DAYS)}`) ?? []);
const full = all30.filter((x) => x.coll >= archetypes.length * RARITIES.length).length;
console.log(`Полная коллекция (${archetypes.length * RARITIES.length}) к дню ${Math.min(30, DAYS)}: ${full} игроков`);

// ---------- Приёмка M4: от нуля до первого престижа непрерывной игрой (без офлайна) ----------
const ACCEPT_PLAYERS = Math.min(300, PLAYERS);
const toPrestige: number[] = [];
for (let i = 0; i < ACCEPT_PLAYERS; i++) {
  const p = newPlayer(KINDS[2]!);
  let t = 0;
  while (sealsFor(p.res.cargo, econ) < 1 && p.activeSec < 20 * 3600) {
    session(p, t, 1800, Math.floor(t / 86400));
    t = p.lastTick;
  }
  if (sealsFor(p.res.cargo, econ) >= 1) toPrestige.push(p.activeSec / 3600);
  if (process.env.SIM_DEBUG && i < 12)
    console.log(
      `  ${(p.activeSec / 3600).toFixed(1)} ч: здания ${JSON.stringify(p.buildings)} · waifu ${p.waifu.length} · лучшая ${Math.max(...p.waifu.map((w) => rarityIndex(w.rarity)))} · уровни ${brigade(p).map((w) => w.level).join(',')} · протеин ${fmt(p.res.protein.toNumber())}`,
    );
}
console.log(
  `Приёмка M4 — первый престиж непрерывной игрой: ${toPrestige.length}/${ACCEPT_PLAYERS} игроков, часов ${tri(toPrestige, (v) => v.toFixed(1))} (цель 3–6)`,
);
