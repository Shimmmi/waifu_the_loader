import { useEffect, useRef, useState } from 'react';
import { archetypeById, CHATTER_INTERVAL_MS, D, formatNumber, loadContent, loadMeta, type WaifuDTO } from '@wl/shared';
import { api } from '../api';
import { useFlavor, useFmt, useLive } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';
import { displayName, Modal, rarityStyle, WaifuCard } from '../components/ui';
import { WaifuDetail } from '../components/WaifuDetail';

export const ARCH_ICON: Record<string, string> = {
  fridge_quiet: '🧊',
  gymnast_rigger: '🪢',
  sleepy_piano: '🎹',
  shout_commander: '📣',
  dreamy_courier: '📦',
  forklift_accountant: '🧾',
  goth_packer: '⚰️',
  gym_philosopher: '🔒',
  tape_maniac: '🎞️',
  retired_waitress: '🍽️',
};

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
          const text = crit
            ? `💥 КРИТ! +${kgText} ${t('unit.kg')}`
            : flavor(content.flavor.scene_popups, {
                kg: kgText,
                cargo: arch ? arch.cargo[Math.floor(Math.random() * arch.cargo.length)]! : 'коробка',
                name: displayName(w).split(' ')[0] ?? '',
              });
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

  const boxes = [
    [6, 8], [16, 8], [46, 8], [72, 8], [84, 8],
    [10, 32], [30, 32], [58, 32], [80, 32],
    [4, 56], [22, 56], [40, 56], [66, 56], [90, 56],
  ];

  const skinId = useStore((s) => s.state?.meta.loadout.warehouse);
  const skin = loadMeta().cosmetics.find((c) => c.id === skinId)?.css ?? '';
  return (
    <div className={`scene ${skin}`} ref={sceneRef}>
      {boxes.map(([l, top], i) => (
        <div key={i} className="shelf-box" style={{ left: `${l}%`, top: `${top}%` }} />
      ))}
      <div className="floor-stripe hazard" />
      {crew.map((w, i) => (
        <div
          key={w.id}
          ref={(el) => {
            if (el) workerRefs.current.set(w.id, el);
            else workerRefs.current.delete(w.id);
          }}
          className="worker"
          style={{ ...rarityStyle(w.rarity), animationDuration: `${Math.max(3, 14 - w.stats.spd / 6)}s`, animationDelay: `${-i * 2.3}s`, bottom: 14 + (i % 3) * 8 }}
        >
          {bubbles
            .filter((b) => b.workerId === w.id)
            .slice(-1)
            .map((b) => (
              <div key={b.id} className={`bubble ${b.align} ${b.crit ? 'crit' : ''}`}>
                {b.text}
              </div>
            ))}
          <span className="carry">{ARCH_ICON[w.archetype] ?? '📦'}</span>
          <div className="avatar" style={{ backgroundImage: `url(${w.thumbUrl})` }} />
          <div className="label">{displayName(w).split(' ')[0]}</div>
        </div>
      ))}
      {!crew.length && <div className="idle">{t('wh.noBrigade')}</div>}
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
            {live ? fmt(live.cargoTotal) : '…'} {t('unit.kg')}
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
