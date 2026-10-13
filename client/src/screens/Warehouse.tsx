import { useEffect, useRef, useState } from 'react';
import { archetypeById, CHATTER_INTERVAL_MS, D, formatNumber, loadContent, loadMeta, type WaifuDTO } from '@wl/shared';
import { api } from '../api';
import { useFlavor, useFmt, useLive } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';
import { displayName, Modal, rarityStyle, WaifuCard } from '../components/ui';
import { WaifuDetail } from '../components/WaifuDetail';

interface Bubble {
  id: number;
  workerId: string;
  text: string;
  crit: boolean;
  /** С какой стороны от иконки раскрыть облачко, чтобы оно не обрезалось краем сцены */
  align: 'left' | 'center' | 'right';
}

const BUBBLE_MS = 3200;
/** Условная «ходка» для цифры в реплике: сколько кг одна грузчица приносит примерно за 3 секунды. */
const TRIP_SEC = 3;
/** Грузовик уезжает примерно раз в 20 секунд текущей добычи. */
const TRUCK_EVERY_SEC = 20;
const BG_LEVELS = [1, 5, 10, 25, 50, 75, 100, 150, 250, 400];
const TRUCK_LEVELS = [0, 5, 15, 40, 100];
const SCENE = import.meta.env.BASE_URL + 'scene/';

const stepAt = (level: number, steps: number[]) => steps.reduce((hit, n) => (level >= n ? n : hit), steps[0]!);
const cargoIcon = (n: number) => `${SCENE}cargo/${String(n).padStart(2, '0')}.webp`;

/** Имя уже написано под портретом, в облачке остаётся только реплика. */
function quoteOnly(text: string, name: string): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${escaped}\\s*:?\\s*`), '');
}

function Scene({ crew }: { crew: WaifuDTO[] }) {
  const state = useStore((s) => s.state)!;
  const notation = useStore((s) => s.settings.notation);
  const chatter = useStore((s) => s.settings.chatter ?? 'rare');
  const flavor = useFlavor();
  const t = useT();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const idRef = useRef(0);
  const live = useRef<Bubble[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const workerRefs = useRef(new Map<string, HTMLDivElement>());
  live.current = bubbles;
  const content = loadContent();

  useEffect(() => {
    if (!crew.length || chatter === 'off') return;
    const base = CHATTER_INTERVAL_MS[chatter];
    let timer: ReturnType<typeof setTimeout>;
    const say = () => {
      if (!document.hidden) {
        const busy = new Set(live.current.map((b) => b.workerId));
        const free = crew.filter((w) => !busy.has(w.id));
        const w = free[Math.floor(Math.random() * free.length)];
        if (w) {
          const arch = archetypeById(content, w.archetype);
          const crit = Math.random() < state.rates.critChance;
          const kg = D(state.rates.cargoPerSec).mul(TRIP_SEC / crew.length).mul(crit ? 3 : 1);
          const kgText = formatNumber(kg, notation);
          const name = displayName(w).split(' ')[0] ?? '';
          const raw = crit
            ? `💥 КРИТ! +${kgText} ${t('unit.kg')}`
            : flavor(content.flavor.scene_popups, {
                kg: kgText,
                cargo: arch ? arch.cargo[Math.floor(Math.random() * arch.cargo.length)]! : 'коробка',
                name,
              });
          const text = quoteOnly(raw, name);
          const id = ++idRef.current;
          const sc = sceneRef.current?.getBoundingClientRect();
          const el = workerRefs.current.get(w.id)?.getBoundingClientRect();
          const rel = sc && el ? (el.left + el.width / 2 - sc.left) / sc.width : 0.5;
          const align = rel < 0.25 ? 'left' : rel > 0.75 ? 'right' : 'center';
          setBubbles((p) => [...p, { id, workerId: w.id, text, crit, align }]);
          setTimeout(() => setBubbles((p) => p.filter((x) => x.id !== id)), BUBBLE_MS);
        }
      }
      timer = setTimeout(say, base * (0.6 + Math.random() * 0.8));
    };
    timer = setTimeout(say, base * (0.3 + Math.random() * 0.5));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew.map((c) => c.id).join(), state.rates.cargoPerSec, notation, chatter]);

  const skinId = useStore((s) => s.state?.meta.loadout.warehouse);
  const skin = loadMeta().cosmetics.find((c) => c.id === skinId)?.css ?? '';
  const resources = useLive();
  const whLevel = state.buildings.warehouse ?? 1;
  const apLevel = state.buildings.autopark ?? 0;
  const bg = BG_LEVELS.indexOf(stepAt(whLevel, BG_LEVELS)) + 1;
  const truck = stepAt(apLevel, TRUCK_LEVELS);
  const clerk = state.waifu.find((w) => w.zone === 'clerk') ?? null;
  const [icons, setIcons] = useState<Record<string, number>>({});
  const [truckOut, setTruckOut] = useState(false);
  const hauled = useRef(0);
  const seenAt = useRef(0);

  useEffect(() => {
    const missing = crew.some((w) => icons[w.id] == null);
    if (!missing) return;
    setIcons((prev) => {
      const next = { ...prev };
      for (const w of crew) if (next[w.id] == null) next[w.id] = 1 + Math.floor(Math.random() * 50);
      return next;
    });
  }, [crew, icons]);

  useEffect(() => {
    if (!resources) return;
    const now = performance.now();
    if (seenAt.current && !truckOut) {
      hauled.current += D(state.rates.cargoPerSec).toNumber() * ((now - seenAt.current) / 1000);
      const need = Math.max(1, D(state.rates.cargoPerSec).toNumber() * TRUCK_EVERY_SEC);
      if (D(state.rates.cargoPerSec).gt(0) && hauled.current >= need) {
        hauled.current = 0;
        setTruckOut(true);
        setIcons((prev) => {
          const next = { ...prev };
          for (const w of crew) next[w.id] = 1 + Math.floor(Math.random() * 50);
          return next;
        });
      }
    }
    seenAt.current = now;
  }, [resources, truckOut, state.rates.cargoPerSec, crew]);

  useEffect(() => {
    if (!truckOut) return;
    const timer = setTimeout(() => setTruckOut(false), 900);
    return () => clearTimeout(timer);
  }, [truckOut]);

  return (
    <div className={`scene ${skin}`} ref={sceneRef} style={{ backgroundImage: `url(${SCENE}bg-${bg}.webp)` }}>
      <img className="prop shelves" src={`${SCENE}shelves.webp`} alt="" />
      {clerk && (
        <div className="clerk" style={rarityStyle(clerk.rarity)}>
          <div className="avatar" style={{ backgroundImage: `url(${clerk.thumbUrl})` }} />
          <div className="label">{displayName(clerk).split(' ')[0]}</div>
        </div>
      )}
      <img className={`prop truck ${truckOut ? 'out' : 'in'}`} src={`${SCENE}truck-${truck}.webp`} alt="" />
      {crew.map((w, i) => {
        const dur = `${Math.max(3, 14 - w.stats.spd / 6)}s`;
        const delay = `${-i * 1.7}s`;
        return (
          <div
            key={w.id}
            ref={(el) => {
              if (el) workerRefs.current.set(w.id, el);
              else workerRefs.current.delete(w.id);
            }}
            className="worker"
            style={{ ...rarityStyle(w.rarity), animationDuration: dur, animationDelay: delay, bottom: 18 + (i % 3) * 10 }}
          >
            {bubbles
              .filter((b) => b.workerId === w.id)
              .slice(-1)
              .map((b) => (
                <div key={b.id} className={`bubble ${b.align} ${b.crit ? 'crit' : ''}`}>
                  {b.text}
                </div>
              ))}
            <img className="carry" src={cargoIcon(icons[w.id] ?? 1)} alt="" style={{ animationDuration: dur, animationDelay: delay }} />
            <div className="avatar" style={{ backgroundImage: `url(${w.thumbUrl})` }} />
            <div className="label">{displayName(w).split(' ')[0]}</div>
          </div>
        );
      })}
      {!crew.length && !clerk && <div className="idle">{t('wh.noBrigade')}</div>}
    </div>
  );
}

export function Warehouse() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const t = useT();
  const fmt = useFmt();
  const notation = useStore((s) => s.settings.notation);
  const flavor = useFlavor();
  const live = useLive();
  const [picker, setPicker] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const crew = state.waifu.filter((w) => w.zone === 'warehouse');
  const bench = state.waifu.filter((w) => !w.zone).sort((a, b) => b.power - a.power);
  const r = state.rates;

  const claim = () =>
    run(async () => {
      const res = await api.daily();
      apply(res.state);
      toast(`${flavor(loadContent().flavor.daily_claim)} (+${res.reward.tickets} 🎟, +${fmt(res.reward.coins)} 🪙)`, 'success');
    });

  const assign = (id: string) =>
    run(async () => {
      apply(await api.assign(id, 'warehouse'));
      setPicker(false);
    });

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <div>
          <div className="muted small">{t('res.cargo')}</div>
          <div className="counter-big">
            {live ? formatNumber(live.cargoTotal, notation, true) : '…'} {t('unit.kg')}
          </div>
        </div>
        <span className="spacer" />
        <button className="btn primary" disabled={!state.dailyAvailable} onClick={claim}>
          🎁 {state.dailyAvailable ? t('wh.daily') : t('wh.dailyDone')}
        </button>
      </div>

      <Scene crew={crew} />

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="panel taped">
          <h3>{t('wh.stats')}</h3>
          <div className="kv">
            <span>📦 {t('res.cargo')}</span>
            <span>
              {fmt(r.cargoPerSec)} {t('unit.kg')}
              {t('unit.perSec')}
            </span>
            <span>🪙 {t('res.coins')}</span>
            <span>
              {fmt(r.coinsPerSec)}
              {t('unit.perSec')}
            </span>
            <span>🥤 {t('res.protein')}</span>
            <span>
              {fmt(r.proteinPerSec)}
              {t('unit.perSec')}
            </span>
            <span>💪 {t('wh.power')}</span>
            <span>{fmt(r.power)}</span>
            <span>🚚 {t('wh.price')}</span>
            <span>{r.pricePerKg.toFixed(3)}</span>
            <span>💥 {t('wh.crit')}</span>
            <span>{(r.critChance * 100).toFixed(1)}%</span>
            <span>🌙 {t('wh.offline')}</span>
            <span>
              {Math.round(r.offlineEfficiency * 100)}% · {state.limits.offlineCapHours} ч
            </span>
            {r.mult.merch > 1 && (
              <>
                <span>👕 {t('wh.merch')}</span>
                <span>×{r.mult.merch.toFixed(2)}</span>
              </>
            )}
            {r.mult.prestigeCargo > 1 && (
              <>
                <span>🔰 {t('res.seals')}</span>
                <span>×{r.mult.prestigeCargo.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
        <div className="panel taped">
          <h3>
            {t('wh.brigade')} ({crew.length}/{state.slots})
          </h3>
          <div className="slots">
            {crew.map((w) => (
              <button key={w.id} className="slot filled" style={rarityStyle(w.rarity)} onClick={() => setDetail(w.id)}>
                <span className="thumb" style={{ backgroundImage: `url(${w.thumbUrl})` }} />
                <span>
                  <b className="small">{displayName(w)}</b>
                  <br />
                  <span className="small muted">
                    {w.rarity} · {t('b.level')} {w.level}
                  </span>
                  <br />
                  <span className="small">💪 {fmt(w.power)}</span>
                </span>
              </button>
            ))}
            {Array.from({ length: Math.max(0, state.slots - crew.length) }, (_, i) => (
              <button key={i} className="slot" onClick={() => setPicker(true)} disabled={!bench.length}>
                <span className="muted small">
                  ➕ {bench.length ? t('wh.add') : t('wh.empty')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {picker && (
        <Modal title={t('wh.add')} onClose={() => setPicker(false)} wide>
          <div className="cards">
            {bench.map((w) => (
              <WaifuCard key={w.id} w={w} onClick={() => assign(w.id)} />
            ))}
          </div>
        </Modal>
      )}
      {detail && <WaifuDetail id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
