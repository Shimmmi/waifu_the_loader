import { useEffect, useMemo, useState } from 'react';
import { v3 } from '@wl/shared';
import { api, ApiError, type V3Client } from '../api';
import '../v3.css';

const RARITY: Record<string, { label: string; color: string }> = {
  common: { label: 'Обычная', color: '#9aa' },
  uncommon: { label: 'Необычная', color: '#3dba6a' },
  rare: { label: 'Редкая', color: '#3d7dff' },
  epic: { label: 'Эпическая', color: '#b44dff' },
  legendary: { label: 'Легендарная', color: '#e2b43a' },
};

const JOB_ICON: Record<string, string> = {
  loader: '📦', forklift: '🚜', crane: '🏗️', stocker: '📋', dispatcher: '📡', mechanic: '🔧', guard: '🛡️', medic_cook: '🍲',
};

const PIXEL: Record<string, string> = {
  dock: 'terminal/buildings/pier.webp',
  dispatch: 'terminal/buildings/dispatch.webp',
  dorm: 'terminal/buildings/dorm.webp',
  warehouse: 'terminal/buildings/warehouse.webp',
  canteen: 'terminal/buildings/canteen.webp',
  workshop: 'terminal/buildings/workshop.webp',
  gym: 'terminal/buildings/school.webp',
  medbay: 'terminal/buildings/rest.webp',
  hr_office: 'terminal/buildings/office.webp',
  security: 'terminal/buildings/bunker.webp',
  comms: 'terminal/buildings/observatory.webp',
  greenhouse: 'terminal/buildings/garden.webp',
  bar: 'terminal/buildings/garage.webp',
  reactor: 'terminal/buildings/fridge.webp',
};

const TAB_ICON: Record<string, string> = {
  terminal: '🏢', crew: '👥', hire: '🧑‍🔧', contracts: '📋', world: '🌍', cabinet: '🪪', menu: '⚙️',
};

const base = import.meta.env.BASE_URL;

function dealTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} мин`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

function src(path: string): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('/')) return path;
  return base + path;
}

type SortKey = 'rarity' | 'level' | 'power' | 'race' | 'job';

const STATS: { id: keyof V3Client['characters'][number]['stats']; name: string; icon: string; hint: string }[] = [
  { id: 'str', name: 'Сила', icon: 'v3/stats/str.webp', hint: 'Половина мощности. Тянет тоннаж смены.' },
  { id: 'spd', name: 'Скорость', icon: 'v3/stats/spd.webp', hint: '30% мощности. Крутит циклы погрузки.' },
  { id: 'acc', name: 'Точность', icon: 'v3/stats/acc.webp', hint: '20% мощности. Меньше брака в зачёте.' },
  { id: 'end', name: 'Выносливость', icon: 'v3/stats/end.webp', hint: 'Запас смены: выше — дольше держит темп. Раса и трейты меняют его.' },
  { id: 'cha', name: 'Харизма', icon: 'v3/stats/cha.webp', hint: 'Помогает контрактам и тому, как бригада держится вместе.' },
  { id: 'lck', name: 'Удача', icon: 'v3/stats/lck.webp', hint: 'Сдвигает редкие исходы найма и смены.' },
];

const RACE_TONE: Record<string, { bg: string; ink: string; text: string }> = {
  terran: { bg: '#e4c48a', ink: '#3a2a12', text: '#ffe3a4' },
  felid: { bg: '#f0b15a', ink: '#3a240c', text: '#ffd27a' },
  kitsune: { bg: '#f09a62', ink: '#3a1c0c', text: '#ffc8a4' },
  astrel: { bg: '#9eb6ef', ink: '#162038', text: '#d7e4ff' },
  drakei: { bg: '#e08a78', ink: '#3a1410', text: '#ffc8bc' },
  synth: { bg: '#7ec8d4', ink: '#102830', text: '#d6fbff' },
  aquali: { bg: '#7eb6e4', ink: '#102030', text: '#d4ecff' },
  inferni: { bg: '#ef8a55', ink: '#3a140c', text: '#ffd0b0' },
};

const CLASS_TEXT: Record<string, string> = {
  loader: '#ffe08a',
  forklift: '#fff09a',
  crane: '#ffc07a',
  stocker: '#c8f0b0',
  dispatcher: '#b7dcff',
  mechanic: '#f0d2a4',
  guard: '#ffc0c0',
  medic_cook: '#ffc8dc',
};

function CrewSheet({ c, onClose }: { c: V3Client['characters'][number]; onClose: () => void }) {
  const [tip, setTip] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const tone = RACE_TONE[c.race] ?? { bg: '#f3cc75', ink: '#3a2a12', text: '#ffe3a4' };
  const classText = CLASS_TEXT[c.job] ?? '#ffe08a';
  const trait = c.traits.find((t) => t.id === tip);
  const stat = STATS.find((s) => s.id === tip);
  const toggle = (id: string) => setTip((cur) => (cur === id ? null : id));
  return (
    <div className="v3-modal" onClick={onClose}>
      <div className="hire-sheet" role="dialog" aria-modal="true" style={{ ['--race' as string]: tone.bg, ['--race-ink' as string]: tone.ink }} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{c.name}</h3>
        </header>
        <div className="hire-shot">
          <img src={src(c.portrait || c.thumb)} alt={c.name} />
          <span className="rarity-tag">{RARITY[c.rarity]?.label}</span>
          <span className="hire-level">ур. {c.level}</span>
          <div className="hire-face">
            <button type="button" className={`hire-link${tip === 'race' ? ' on' : ''}`} style={{ color: tone.text }} onClick={() => toggle('race')}>{c.raceName}</button>
            <button type="button" className={`hire-link${tip === 'job' ? ' on' : ''}`} style={{ color: classText }} onClick={() => toggle('job')}>{c.jobName}</button>
            {(tip === 'race' || tip === 'job') && (
              <div className="hire-tip" role="status">
                <b>{tip === 'race' ? c.raceName : c.jobName}</b>
                <p>{tip === 'race' ? c.raceHint : c.jobHint}</p>
              </div>
            )}
          </div>
        </div>
        <div className="hire-pad">
          <div className="hire-stats">
            <button type="button" className={`hire-stat${tip === 'power' ? ' on' : ''}`} onClick={() => toggle('power')}>
              <img src={src('v3/stats/power.webp')} alt="" /><b>{Math.round(c.power)}</b>
            </button>
            {STATS.map((s) => (
              <button key={s.id} type="button" className={`hire-stat${tip === s.id ? ' on' : ''}`} onClick={() => toggle(s.id)}>
                <img src={src(s.icon)} alt="" /><b>{Math.round(c.stats[s.id])}</b>
              </button>
            ))}
            {(tip === 'power' || stat) && (
              <div className="hire-tip" role="status">
                <b>{tip === 'power' ? `Мощность ${Math.round(c.power)}` : `${stat!.name} ${Math.round(c.stats[stat!.id])}`}</b>
                <p>{tip === 'power' ? 'Сводка силы, скорости и точности. Из неё считается тоннаж наёмницы.' : stat!.hint}</p>
              </div>
            )}
          </div>
          <div className="hire-traits">
            {c.traits.map((t) => (
              <button key={t.id} type="button" className={`hire-tag${t.sign === '-' ? ' minus' : ''}${tip === t.id ? ' on' : ''}`} onClick={() => toggle(t.id)}>
                {t.name}
              </button>
            ))}
            {trait && (
              <div className="hire-tip" role="status">
                <b>{trait.name}</b>
                <p>{trait.hint}</p>
              </div>
            )}
          </div>
          <button type="button" className="hire-bio" onClick={() => { setTip(null); setBio(true); }}>Биография</button>
        </div>
      </div>
      {bio && (
        <div className="v3-modal" onClick={(e) => { e.stopPropagation(); setBio(false); }}>
          <div className="hire-lore" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p>{c.bio}</p>
            {c.quote && <p className="hire-quote">«{c.quote}»</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function V3App() {
  const [tab, setTab] = useState('terminal');
  const [state, setState] = useState<V3Client | null>(null);
  const [popup, setPopup] = useState('');
  const [page, setPage] = useState(0);
  const [buildPage, setBuildPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [buildFor, setBuildFor] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState('');
  const [race, setRace] = useState('');
  const [job, setJob] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState<SortKey>('rarity');
  const [openId, setOpenId] = useState<string | null>(null);
  const [company, setCompany] = useState('');

  async function run(fn: () => Promise<V3Client>) {
    try {
      setState(await fn());
    } catch (e) {
      setPopup(e instanceof ApiError ? e.message : 'Не вышло');
    }
  }

  useEffect(() => {
    void run(() => api.v3state());
  }, []);
  useEffect(() => {
    setBuildPage(0);
  }, [buildFor]);
  useEffect(() => {
    if (tab !== 'contracts') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tab]);

  const crew = useMemo(() => {
    if (!state) return [];
    const rank: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    const list = state.characters.filter((c) => !c.reserve && (!race || c.race === race) && (!job || c.job === job) && (!rarity || c.rarity === rarity));
    return [...list].sort((a, b) => {
      if (sort === 'level') return b.level - a.level;
      if (sort === 'power') return b.power - a.power;
      if (sort === 'race') return a.raceName.localeCompare(b.raceName, 'ru');
      if (sort === 'job') return a.jobName.localeCompare(b.jobName, 'ru');
      return (rank[b.rarity] ?? 0) - (rank[a.rarity] ?? 0);
    });
  }, [state, race, job, rarity, sort]);

  if (!state) return <div className="v3"><p className="v3-body">Склад просыпается…</p></div>;
  const detail = state.characters.find((c) => c.id === openId);
  const plot = state.floors.flatMap((f) => f.cells.map((c) => ({ ...c, z: f.z }))).find((c) => c.plotId === buildFor);
  const buildChoices = plot
    ? state.catalogBuildings.filter((b) => v3.zoneOk(b.zone, plot.z) && b.maxLevel > 0 && b.count < b.maxCopies)
    : [];
  const buildPages = Math.ceil(buildChoices.length / 9);
  const room = state.floors.flatMap((f) => f.cells.map((c) => ({ ...c, z: f.z }))).find((c) => c.plotId === roomId);
  const roomDef = state.catalogBuildings.find((b) => b.id === room?.typeId);
  const onShift = state.characters.filter((c) => !c.reserve).length;
  const cellPrice = (z: number): number | null => {
    if (state.pendingCards) return null;
    let best: number | null = null;
    for (const b of state.catalogBuildings) {
      if (!v3.zoneOk(b.zone, z) || b.maxLevel <= 0 || b.count >= b.maxCopies || state.credits < b.cost) continue;
      best = best == null ? b.cost : Math.min(best, b.cost);
    }
    return best;
  };

  return (
    <div className="v3" data-motion={state.motion ? 'on' : 'off'}>
      <header className="v3-top">
        <div className="v3-brand"><span>📦</span><span>{state.company}</span></div>
        <div className="v3-res">🪙 {state.credits}</div>
        <div className="v3-res">⭐ {state.stars}</div>
        <div className="v3-res">📦 {state.tonsPerSec} т/с</div>
        <div className="v3-res">перерождений {state.rebirths}</div>
      </header>
      <div className="v3-layout">
        <nav className="v3-side">
          {state.tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><span>{TAB_ICON[t.id] ?? '•'} </span>{t.name}</button>
          ))}
        </nav>
        <main className="v3-panel">
          {tab === 'terminal' && (
            <div className="v3-shaft">
              {state.floors.map((floor) => {
                const layer = floor.z > 0 ? Math.min(floor.z, 4) : floor.z < 0 ? Math.min(-floor.z, 4) : 0;
                const bg = floor.z > 0 ? `v3/zones/sky-${layer}.webp` : floor.z < 0 ? `v3/zones/ground-${layer}.webp` : 'v3/zones/surface.webp';
                const price = cellPrice(floor.z);
                return (
                  <div key={floor.z} className="v3-floor" style={{ backgroundImage: `url(${src(bg)})` }}>
                    {floor.cells.map((cell) => (
                      <button
                        key={cell.plotId}
                        className={`v3-cell ${cell.state === 'built' ? 'built' : ''}`}
                        onClick={() => (cell.state === 'empty' ? setBuildFor(cell.plotId) : setRoomId(cell.plotId))}
                      >
                        {cell.state === 'built' && cell.typeId ? (
                          <>
                            <img src={src(`v3/plots/${cell.typeId}.webp`)} alt="" />
                            <span className="cap">{state.catalogBuildings.find((b) => b.id === cell.typeId)?.name} · ур. {cell.level ?? 1}</span>
                          </>
                        ) : price != null ? (
                          <span className="v3-price">{price}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'crew' && (
            <>
              <div className="heading">
                <div aria-hidden>👷🏻‍♀️</div>
                <h1>Бригада</h1>
                <div className="capacity"><span>👥</span><div><span>{onShift} / {state.crewCap}</span><small>Макс. {state.crewCap}</small></div></div>
              </div>
              <div className="toolbar">
                <select className="filter" value={race} onChange={(e) => { setRace(e.target.value); setPage(0); }}><option value="">Все расы</option>{state.races.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                <select className="filter" value={job} onChange={(e) => { setJob(e.target.value); setPage(0); }}><option value="">Все классы</option>{state.classes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                <select className="filter" value={rarity} onChange={(e) => { setRarity(e.target.value); setPage(0); }}><option value="">Все редкости</option>{Object.entries(RARITY).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}</select>
                <span className="sort-label">Сортировка:</span>
                <div className="sorts">
                  {(['rarity', 'level', 'power', 'race', 'job'] as SortKey[]).map((key) => (
                    <button key={key} className={`sort ${sort === key ? 'on' : ''}`} title={key === 'rarity' ? 'По редкости' : key === 'level' ? 'По уровню' : key === 'power' ? 'По силе' : key === 'race' ? 'По расе' : 'По классу'} onClick={() => setSort(key)}>
                      {key === 'rarity' ? '✦' : key === 'level' ? '▥' : key === 'power' ? '⚔' : key === 'race' ? '♟' : '💼'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="crew-hire">
                {!state.hireOpen && state.freeRolls === 0 ? (
                  <p>Найм откроется после первых 10 тонн.</p>
                ) : (
                  <>
                    <button type="button" className="crew-roll" disabled={onShift >= state.crewCap && state.freeRolls === 0} onClick={() => void run(() => api.v3roll(1, crypto.randomUUID()))}>
                      {state.freeRolls > 0 ? 'Бесплатный найм' : `Найм · ${state.rollCost}`}
                    </button>
                    <button type="button" className="crew-roll" disabled={onShift + 10 > state.crewCap} onClick={() => void run(() => api.v3roll(10, crypto.randomUUID()))}>
                      ×10 · {state.roll10}
                    </button>
                    {onShift >= state.crewCap && state.freeRolls === 0 && <span>Нужно общежитие выше</span>}
                  </>
                )}
              </div>
              <div className="roster">
                {crew.slice(page * 8, page * 8 + 8).map((c) => (
                  <article key={c.id} className={`waifu-card ${c.rarity}`} onClick={() => setOpenId(c.id)}>
                    <div className="portrait">
                      <img src={src(c.thumb || c.portrait)} alt="" />
                      <span className="level">{c.level}</span>
                      <span className="stars">{'★'.repeat((['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(c.rarity) + 1) || 1)}</span>
                      <span className="rarity-tag">{RARITY[c.rarity]?.label}</span>
                    </div>
                    <div className="card-info">
                      <div className="name">{c.name}</div>
                      <div className="stats"><span>✊ <b>{c.power}</b></span><span>🥾 <b>{c.stats.end}</b></span><span className="role" title={c.jobName}>{JOB_ICON[c.job] ?? '•'}</span></div>
                    </div>
                  </article>
                ))}
              </div>
              {crew.length > 8 && (
                <div className="pager">
                  <button className="sort" onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
                  <span>{page + 1} / {Math.ceil(crew.length / 8)}</span>
                  <button className="sort" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 8 >= crew.length}>›</button>
                </div>
              )}
            </>
          )}
          {tab === 'contracts' && (
            <div className="deal-board">
              <div className="deal-row">
                {state.offers.map((o) => (
                  <button key={o.id} type="button" className={`deal ${o.rarity}`} onClick={() => void run(() => api.v3contract(o.id))}>
                    <img src={src(o.starter ? `v3/contracts/${o.id}.webp` : `v3/contracts/${o.kind}_${o.rarity}.webp`)} alt="" />
                    <span className="deal-top">
                      <b className="deal-name">{o.name}</b>
                      <span className="deal-pay">
                        <span>{o.credits}<small>кр</small></span>
                        <span>{o.stars}<small>зв</small></span>
                        <span>{dealTime(o.seconds)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {state.offers.length === 0 && <p className="deal-live">Доска пуста. Новые заказы скоро появятся.</p>}
              {state.active.map((a) => {
                const left = Math.max(0, (a.endsAt - now) / 1000);
                const total = a.seconds > 0 ? a.seconds : left;
                const done = Math.min(100, Math.max(0, (1 - left / total) * 100));
                return (
                  <div key={a.uid} className="deal-run">
                    <div className="deal-run-top">
                      <b>{a.name}</b>
                      <span>{dealTime(left)}</span>
                    </div>
                    <div className="deal-bar" role="progressbar" aria-valuenow={Math.round(done)} aria-valuemin={0} aria-valuemax={100}>
                      <i style={{ width: `${done}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'world' && (
            <div className="panel">
              <h3>Журнал</h3>
              {state.journal.map((j) => (
                <article key={j.id}><b>{j.title}</b>{j.lines.map((line, i) => <p key={i}>{line}</p>)}</article>
              ))}
            </div>
          )}
          {tab === 'cabinet' && (
            <div className="cab">
              <img className="cab-banner" src={src(`v3/logos/logo-${(state.logoRev ?? 0) % 3}.webp`)} alt="" />
              <div className="cab-name">
                <input className="input" value={company} placeholder={state.company} onChange={(e) => setCompany(e.target.value)} />
                <button type="button" className="cab-rename" onClick={() => void run(() => api.v3company(company || state.company))}>Переименовать</button>
              </div>
              <div className="cab-id">
                <span>{state.hero}</span>
                <span>Акт {state.act}</span>
                <span>Переезд {state.rebirths}</span>
              </div>
              <h3>Грамоты</h3>
              {state.meta.filter((m) => m.level > 0).length === 0 && <p className="cab-empty">Грамот пока нет. Первая выдаётся при переезде на новую базу.</p>}
              {state.meta.filter((m) => m.level > 0).map((m) => (
                <div className="cab-deed" key={m.id}>
                  <b>{m.name}</b>
                  <span>{m.effect}</span>
                  <small>{m.level}/{m.max}</small>
                </div>
              ))}
              <p className="cab-move">Переезд стоит {Math.round(state.rebirthPrice)}.</p>
              <p className="cab-move">База стоит {state.baseValue}.</p>
              <p className="cab-move">Нужно наличными {Math.round(state.rebirthDue)}.</p>
              <button type="button" className="crew-roll" disabled={!state.canRebirth} onClick={() => void run(() => api.v3preview())}>Переехать</button>
            </div>
          )}
          {tab === 'menu' && (
            <div className="cab">
              <button type="button" className="crew-roll" onClick={() => void api.logout().then(() => location.reload())}>Выйти</button>
            </div>
          )}
        </main>
      </div>
      {state.offline && (
        <div className="v3-modal" onClick={() => void run(() => api.v3offline())}>
          <div className="away-note">
            <p>Вас не было: {Math.round(state.offline.seconds / 60)} мин;</p>
            <p>Вы заработали: {Math.round(state.offline.credits)} кредитов;</p>
            <p>Перенесено: {Math.round(state.offline.tons * 10) / 10} тонн.</p>
          </div>
        </div>
      )}
      {state.queue.length > 0 && !state.offline && (
        <div className="v3-modal"><div className="v3-sheet"><header><h3>{state.queue[0]?.speaker === 'hero' ? state.hero : state.queue[0]?.speaker}</h3></header><div className="pad"><p>{state.queue[0]?.text}</p><div className="row"><button className="btn primary v3-btn" onClick={() => void run(() => api.v3ack(false))}>Дальше</button><button className="btn v3-btn" onClick={() => void run(() => api.v3ack(true))}>Пропустить</button></div></div></div></div>
      )}
      {state.pendingCards && (
        <div className="v3-modal">
          <div className="bonus-sheet" role="dialog" aria-modal="true">
            <header><h3>Выберите бонус для строящегося помещения</h3></header>
            <div className="bonus-row">
              {state.pendingCards.map((c) => (
                <button key={c.id} type="button" className="bonus-card" onClick={() => void run(() => api.v3pick(c.id))}>
                  <b>{c.name}</b>
                  <img src={src(`v3/bonuses/${c.id}.webp`)} alt="" />
                  <span className="bonus-effect">{c.text}{c.curse ? `. ${c.curse}` : ''}</span>
                </button>
              ))}
            </div>
            <div className="bonus-actions">
              <button type="button" className="bonus-reroll" onClick={() => void run(() => api.v3reroll())}>{state.freeRerolls > 0 ? 'Реролл бесплатно' : `Реролл · ${state.rerollCost}`}</button>
              <button type="button" className="bonus-skip" onClick={() => void run(() => api.v3skip())}>Пропустить</button>
            </div>
          </div>
        </div>
      )}
      {state.pendingGramoty.length > 0 && (
        <div className="v3-modal">
          <div className="bonus-sheet" role="dialog" aria-modal="true">
            <header><h3>Грамота за переезд</h3></header>
            <div className="bonus-row">
              {state.pendingGramoty.map((g, i) => (
                <button key={g.id} type="button" className="bonus-card" onClick={() => void run(() => api.v3gramota(i as 0 | 1 | 2))}>
                  <b>{g.name}</b>
                  <span className="bonus-effect">{g.effect}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {state.pendingBases && (
        <div className="v3-modal">
          <div className="v3-sheet">
            <header><h3>Новая база</h3></header>
            <div className="pad v3-bonus">
              {state.pendingBases.map((b) => (
                <button key={b.id} style={{ borderColor: RARITY[b.rarity]?.color }} onClick={() => void run(() => api.v3confirm(b.id))}>
                  <b>{b.name}</b>
                  <div>{RARITY[b.rarity]?.label} · риск {b.risk}</div>
                  <p>{b.flavor}</p>
                  <div>{b.buff}</div>
                  {b.debuff && <small>{b.debuff}</small>}
                </button>
              ))}
            </div>
            <div className="pad"><button className="btn v3-btn" onClick={() => void run(() => api.v3baseReroll())}>Реролл · {state.baseRerollCost} звёзд</button></div>
          </div>
        </div>
      )}
      {state.endingOpen && (
        <div className="v3-modal"><div className="v3-sheet"><header><h3>Омникон предлагает выкуп</h3></header><div className="pad row"><button className="btn v3-btn" onClick={() => void run(() => api.v3ending('sell'))}>Продать</button><button className="btn v3-btn" onClick={() => void run(() => api.v3ending('refuse'))}>Отказать</button><button className="btn primary v3-btn" onClick={() => void run(() => api.v3ending('buy'))}>Купить корпорацию</button></div></div></div>
      )}
      {detail && <CrewSheet c={detail} onClose={() => setOpenId(null)} />}
      {popup && (
        <div className="v3-modal" onClick={() => setPopup('')}>
          <p className="pix-note">{popup}</p>
        </div>
      )}
      {room && roomDef && (
        <div className="v3-modal" onClick={() => setRoomId(null)}>
          <div className="room-sheet" onClick={(e) => e.stopPropagation()}>
            <header><h3>{roomDef.name}</h3><button className="close" onClick={() => setRoomId(null)}>×</button></header>
            <div className="room-art">
              <img src={src(PIXEL[roomDef.id] ?? '')} alt="" />
              <button className="upgrade" disabled={(room.level ?? 1) >= roomDef.maxLevel} onClick={() => void run(() => api.v3upgrade(room.plotId))}>Улучшить</button>
            </div>
            <div className="bonus-frame">
              <b>Уровень {room.level ?? 1} из {roomDef.maxLevel}. Тир {roomDef.tier}.</b>
              <p>Комната: {roomDef.effect || 'без постоянного бонуса'}</p>
              <p>Карточка: {state.runCards.find((c) => c.id === room.bonusId)?.text || 'бонус при постройке не выбран'}</p>
            </div>
            {(() => {
              const post = state.posts.find((p) => p.plotId === room.plotId);
              if (!post) return null;
              const taken = new Set(state.posts.flatMap((p) => p.crew.map((m) => m.id)));
              const free = state.characters.filter((c) => !taken.has(c.id));
              return (
                <div className="staff-box">
                  <b>Смена комнаты · мест {post.slots}</b>
                  <p>Ключ: {post.keyName} {post.baseline}. Бонус ×{post.k.toFixed(2)}.</p>
                  <p>Лучше: {post.classNames.join(', ') || 'любой класс'}{post.raceNames.length ? ` · ${post.raceNames.join(', ')}` : ''}.</p>
                  <p>Наёмница умножает базовый бонус. Удвоения на 10, 20 и 30 уровне остаются отдельно.</p>
                  {post.crew.map((m) => (
                    <div key={m.id} className="staff-row">
                      <span>{m.name}</span>
                      <small>{post.keyName} {m.stat}{m.classMatch ? ' · класс' : ''}{m.raceMatch ? ' · раса' : ''}</small>
                      <button type="button" onClick={() => void run(() => api.v3unassign(room.plotId, m.id))}>Снять</button>
                    </div>
                  ))}
                  {post.crew.length < post.slots && (
                    <div className="staff-row">
                      <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                        <option value="">Кого поставить</option>
                        {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="button" disabled={!staffId} onClick={() => { const id = staffId; setStaffId(''); void run(() => api.v3assign(room.plotId, id)); }}>Поставить</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {plot && (
        <div className="v3-modal" onClick={() => setBuildFor(null)}>
          <div className="build-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Расширение базы</h3>
              <span className="build-credits"><img src={src('terminal/ui/coin.png')} alt="" />{Math.round(state.credits)}</span>
              <button className="close" onClick={() => setBuildFor(null)} aria-label="Закрыть">×</button>
            </header>
            <div className="build-grid">
              {buildChoices.slice(buildPage * 9, buildPage * 9 + 9).map((b) => {
                const poor = state.credits < b.cost || !!state.pendingCards;
                return (
                  <button key={b.id} type="button" className={`build-card${poor ? ' poor' : ''}`} disabled={poor} onClick={() => { const id = plot.plotId; setBuildFor(null); void run(() => api.v3build(id, b.id)); }}>
                    <b>{b.name}</b>
                    <img src={src(PIXEL[b.id] ?? '')} alt="" />
                    <small>{b.cost}</small>
                  </button>
                );
              })}
            </div>
            {buildPages > 1 && (
              <div className="build-nav">
                <button type="button" disabled={buildPage === 0} onClick={() => setBuildPage((p) => p - 1)}>‹</button>
                <span>{buildPage + 1} / {buildPages}</span>
                <button type="button" disabled={buildPage + 1 >= buildPages} onClick={() => setBuildPage((p) => p + 1)}>›</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
