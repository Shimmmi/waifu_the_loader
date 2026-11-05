import { useEffect, useRef, useState } from 'react';
import { archetypeById, CHATTER_INTERVAL_MS, D, formatNumber, loadContent, loadMeta, type WaifuDTO } from '@wl/shared';
import { useFlavor, useLive } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';
import { displayName, rarityStyle } from './ui';
import { ArtSlot } from './ArtSlot';

interface Bubble {
  id: number;
  workerId: string;
  text: string;
  crit: boolean;
  align: 'left' | 'center' | 'right';
}

const BUBBLE_MS = 3200;
const TRIP_SEC = 3;
const TRUCK_EVERY_SEC = 20;
const BG_LEVELS = [1, 5, 10, 25, 50, 75, 100, 150, 250, 400];
const TRUCK_LEVELS = [0, 5, 15, 40, 100];
const SCENE = import.meta.env.BASE_URL + 'scene/';

const stepAt = (level: number, steps: number[]) => steps.reduce((hit, n) => (level >= n ? n : hit), steps[0]!);
const cargoIcon = (n: number) => `${SCENE}cargo/${String(n).padStart(2, '0')}.webp`;

function quoteOnly(text: string, name: string): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${escaped}\\s*:?\\s*`), '');
}

export function HaulScene({ crew, hideClerk = false, idle, backdrop }: { crew: WaifuDTO[]; hideClerk?: boolean; idle?: string; backdrop?: string }) {
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
  const clerk = hideClerk ? null : (state.waifu.find((w) => w.zone === 'clerk') ?? null);
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
    <div className={`scene ${skin}`} ref={sceneRef} style={backdrop ? undefined : { backgroundImage: `url(${SCENE}bg-${bg}.webp)` }}>
      {backdrop && <ArtSlot src={backdrop} alt="" fit="cover" className="scene-back" />}
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
      {!crew.length && !clerk && <div className="idle">{idle ?? t('wh.noBrigade')}</div>}
    </div>
  );
}
