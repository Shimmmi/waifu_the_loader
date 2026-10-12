import { useEffect, useRef, useState } from 'react';
import { archetypeById, D, formatNumber, loadContent, type WaifuDTO } from '@wl/shared';
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

interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  crit: boolean;
}

function Scene({ crew }: { crew: WaifuDTO[] }) {
  const state = useStore((s) => s.state)!;
  const notation = useStore((s) => s.settings.notation);
  const flavor = useFlavor();
  const t = useT();
  const [popups, setPopups] = useState<Popup[]>([]);
  const idRef = useRef(0);
  const content = loadContent();

  useEffect(() => {
    if (!crew.length) return;
    const every = 1800;
    const h = setInterval(() => {
      if (document.hidden) return;
      const w = crew[Math.floor(Math.random() * crew.length)]!;
      const arch = archetypeById(content, w.archetype);
      const crit = Math.random() < state.rates.critChance;
      const kg = D(state.rates.cargoPerSec).mul(every / 1000 / crew.length).mul(crit ? 3 : 1);
      const kgText = formatNumber(kg, notation);
      const text = crit
        ? `💥 КРИТ! +${kgText} ${t('unit.kg')}`
        : flavor(content.flavor.scene_popups, {
            kg: kgText,
            cargo: arch ? arch.cargo[Math.floor(Math.random() * arch.cargo.length)]! : 'коробка',
            name: displayName(w).split(' ')[0] ?? '',
          });
      const id = ++idRef.current;
      setPopups((p) => [...p.slice(-5), { id, x: 5 + Math.random() * 55, y: 20 + Math.random() * 40, text, crit }]);
      setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 2700);
    }, every);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew.map((c) => c.id).join(), state.rates.cargoPerSec, notation]);

  const boxes = [
    [6, 8], [16, 8], [46, 8], [72, 8], [84, 8],
    [10, 32], [30, 32], [58, 32], [80, 32],
    [4, 56], [22, 56], [40, 56], [66, 56], [90, 56],
  ];

  return (
    <div className="scene">
      {boxes.map(([l, top], i) => (
        <div key={i} className="shelf-box" style={{ left: `${l}%`, top: `${top}%` }} />
      ))}
      <div className="floor-stripe hazard" />
      {crew.map((w, i) => (
        <div
          key={w.id}
          className="worker"
          style={{ ...rarityStyle(w.rarity), animationDuration: `${Math.max(3, 14 - w.stats.spd / 6)}s`, animationDelay: `${-i * 2.3}s`, bottom: 14 + (i % 3) * 8 }}
        >
          <span className="carry">{ARCH_ICON[w.archetype] ?? '📦'}</span>
          <div className="avatar" style={{ backgroundImage: `url(${w.thumbUrl})` }} />
          <div className="label">{displayName(w).split(' ')[0]}</div>
        </div>
      ))}
      {!crew.length && <div className="idle">{t('wh.noBrigade')}</div>}
      {popups.map((p) => (
        <div key={p.id} className={`popup ${p.crit ? 'crit' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          {p.text}
        </div>
      ))}
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
  const bench = state.waifu.filter((w) => w.zone !== 'warehouse').sort((a, b) => b.power - a.power);
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
            <span>{Math.round(r.offlineEfficiency * 100)}%</span>
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
