import { useEffect, useState } from 'react';
import { D, loadContent, upgradeCost, type StateDTO } from '@wl/shared';
import { api } from '../api';
import { useFlavor, useFmt } from '../hooks';
import { useStore } from '../store';
import { ArtSlot, buildingArtUrl, interiorArtUrl, terminalMapUrl } from './ArtSlot';
import { BUILDING_STATION, buildingCaption, buildingCrew } from './Terminal';
import { displayName } from './ui';
import { WaifuDetail as Card } from './WaifuDetail';

const SPOTS: Record<string, { left: string; top: string }> = {
  pier: { left: '6%', top: '16%' },
  warehouse: { left: '34%', top: '30%' },
  dorm: { left: '56%', top: '10%' },
  office: { left: '76%', top: '20%' },
  garage: { left: '70%', top: '58%' },
  rest: { left: '46%', top: '64%' },
  canteen: { left: '16%', top: '62%' },
  school: { left: '18%', top: '38%' },
  crane: { left: '4%', top: '42%' },
  dispatch: { left: '84%', top: '46%' },
  fridge: { left: '38%', top: '50%' },
  workshop: { left: '56%', top: '46%' },
  bunker: { left: '8%', top: '78%' },
  garden: { left: '28%', top: '78%' },
  observatory: { left: '82%', top: '74%' },
};

function stationOf(id: string) {
  return BUILDING_STATION[id] ?? null;
}

export function TerminalHome() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const flavor = useFlavor();
  const focus = useStore((s) => s.terminalFocus);
  const [open, setOpen] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const term = state.terminal;
  const sectors = term?.sectors ?? [];

  useEffect(() => {
    if (!focus) return;
    setOpen(focus);
    useStore.setState({ terminalFocus: null });
  }, [focus]);

  if (!term?.live || !term.stations) return null;

  const claim = () =>
    run(async () => {
      const res = await api.daily();
      apply(res.state);
      toast(`${flavor(loadContent().flavor.daily_claim)} (+${res.reward.tickets} 🎟)`, 'success');
    });

  return (
    <div className="tmap-page">
      <button className="btn primary tmap-daily" disabled={!state.dailyAvailable} onClick={claim}>
        {state.dailyAvailable ? 'Подарок дня' : 'Подарок получен'}
      </button>
      <div className="tmap" style={{ backgroundImage: `url(${terminalMapUrl()})` }}>
        <ArtSlot src={terminalMapUrl()} alt="" fit="cover" className="tmap-back" />
        {sectors.map((s) => {
          const spot = SPOTS[s.id] ?? { left: '40%', top: '40%' };
          const station = stationOf(s.id);
          const block = station ? term.stations![station] : null;
          const crewN = block?.crew.length ?? (s.id === 'dorm' ? buildingCrew(state.waifu, 'dorm').length : 0);
          const canUp = s.level < 20 && D(state.resources.coins).gte(upgradeCost(s.level));
          const status = canUp ? 'Можно улучшить' : crewN > 0 || term.shift?.active ? 'Работает' : 'Ждёт';
          return (
            <button key={s.id} className="tbuilding" style={spot} onClick={() => setOpen(s.id)}>
              <ArtSlot src={buildingArtUrl(s.id)} alt="" fit="contain" className="tbuilding-art" label={s.name} />
              <span className="tplaque">
                <b>{s.name}</b>
                <small>Ур. {s.level}</small>
                <small className={canUp ? 'up' : ''}>
                  {canUp && <img className="pix-up" src={`${import.meta.env.BASE_URL}terminal/ui/up.png`} alt="" />}
                  {status}{crewN ? ` · ${crewN}` : ''}
                </small>
              </span>
            </button>
          );
        })}
        <p className="tmap-hint">Нажмите на строение, чтобы открыть управление</p>
      </div>
      {open && <BuildingModal sectorId={open} onClose={() => setOpen(null)} onCard={setCard} />}
      {card && <Card id={card} onClose={() => setCard(null)} />}
    </div>
  );
}

function BuildingModal({ sectorId, onClose, onCard }: { sectorId: string; onClose: () => void; onCard: (id: string) => void }) {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const fmt = useFmt();
  const term = state.terminal!;
  const sector = term.sectors?.find((s) => s.id === sectorId);
  const [tab, setTab] = useState<'overview' | 'crew' | 'upgrade'>('overview');
  const stationId = stationOf(sectorId);
  const station = stationId ? term.stations?.[stationId] : null;
  const crew = buildingCrew(state.waifu, sectorId);
  const cost = sector ? upgradeCost(sector.level) : 0;
  const canUp = !!sector && sector.level < 20 && D(state.resources.coins).gte(cost);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!sector || !term.stations) return null;
  const act = (fn: () => Promise<StateDTO>) => run(async () => apply(await fn()));
  const metrics: { label: string; value: string }[] = [];
  if (station && 'rate' in station) metrics.push({ label: station.name, value: `${station.rate.toFixed(1)} т/мин` });
  if (station) metrics.push({ label: 'Работницы', value: `${station.crew.length}/${station.slots}` });
  if (sectorId === 'dorm') metrics.push({ label: 'Отдыхают', value: String(crew.length) });
  if (!station && sectorId !== 'dorm') metrics.push({ label: 'Эффект', value: buildingCaption(sectorId) });
  const status = term.shift?.active ? 'Работает' : 'Смена не идёт';

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="building-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="head">
          <h2 style={{ margin: 0 }}>
            {sector.name} · уровень {sector.level}
          </h2>
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        {tab === 'overview' && (
          <div className="bmodal-body">
            <div className="bmodal-scene">
              <ArtSlot src={interiorArtUrl(sectorId)} alt="" fit="cover" className="interior-still" label={sector.name} />
            </div>
            <aside>
              <p className="pix-status">
                <i />
                {status}
              </p>
              {metrics.map((m) => (
                <div className="row" key={m.label}>
                  <span className="small muted">{m.label}</span>
                  <span className="spacer" />
                  <b className="small">{m.value}</b>
                </div>
              ))}
              <div className="portraits">
                {(station?.crew ?? []).map((id) => {
                  const w = state.waifu.find((x) => x.id === id);
                  if (!w) return null;
                  return (
                    <button key={id} className="portrait-slot" onClick={() => onCard(id)}>
                      <img src={w.thumbUrl} alt="" />
                      <small>{displayName(w).split(' ')[0]}</small>
                    </button>
                  );
                })}
                {station &&
                  Array.from({ length: Math.max(0, station.slots - station.crew.length) }, (_, i) => (
                    <button key={i} className="portrait-slot empty" onClick={() => setTab('crew')}>
                      +
                    </button>
                  ))}
              </div>
              <button className="pix-upgrade" disabled={!canUp} onClick={() => act(() => api.terminalUpgrade(sectorId))}>
                Улучшить · {fmt(cost)}
              </button>
            </aside>
          </div>
        )}
        {tab === 'crew' && (
          <div className="bmodal-tab">
            {!station && <p className="small">{buildingCaption(sectorId)}</p>}
            {sectorId === 'dorm' && <p className="small muted">{crew.length ? crew.map((w) => displayName(w)).join(', ') : 'В общежитии сейчас пусто.'}</p>}
            {station && stationId && (
              <>
                <p className="small">
                  {station.name}: {station.crew.length}/{station.slots}
                </p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {station.crew.map((id) => {
                    const person = state.waifu.find((w) => w.id === id);
                    const away = person?.zone === 'gym' || person?.zone === 'contract';
                    if (away) return <span key={id} className="small muted">{person ? displayName(person) : 'Слот'} · вернётся</span>;
                    return (
                      <button key={id} className="btn small" onClick={() => act(() => api.terminalAssign(id, null))}>
                        {person ? displayName(person) : 'Слот'} ×
                      </button>
                    );
                  })}
                  {station.slots > 0 && station.crew.length < station.slots && (
                    <p className="small muted">Коллекция на смену не выходит.</p>
                  )}
                  {station.slots === 0 && <p className="small muted">Места откроются, когда строение будет готово к работе.</p>}
                </div>
              </>
            )}
            <p className="small muted">Карточки коллекции на смену не выходят.</p>
          </div>
        )}
        {tab === 'upgrade' && (
          <div className="bmodal-tab">
            <p>
              Уровень {sector.level}. Следующее улучшение стоит {fmt(cost)} монет.
            </p>
            <p className="small muted">{buildingCaption(sectorId)}</p>
            <div className="row">
              <button className="btn primary" disabled={!canUp} onClick={() => act(() => api.terminalUpgrade(sectorId))}>
                Улучшить
              </button>
              {sectorId !== 'pier' && (
                <button className="btn" onClick={() => void run(async () => { apply(await api.terminalDemolish(sectorId)); onClose(); })}>
                  Снести
                </button>
              )}
            </div>
          </div>
        )}
        <div className="bmodal-tabs">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Обзор</button>
          <button className={tab === 'crew' ? 'on' : ''} onClick={() => setTab('crew')}>Работницы</button>
          <button className={tab === 'upgrade' ? 'on' : ''} onClick={() => setTab('upgrade')}>Улучшения</button>
        </div>
        <p className="small muted bmodal-hint">Нажмите на портрет, чтобы открыть карточку.</p>
      </div>
    </div>
  );
}
