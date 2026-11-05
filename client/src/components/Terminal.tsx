import { useState } from 'react';
import { JOB_NAME, type StateDTO, type TerminalJob, type WaifuDTO } from '@wl/shared';
import { api } from '../api';
import { useStore } from '../store';
import { displayName, Modal } from './ui';

export type StationId = 'unload' | 'move' | 'store' | 'support';

export const BUILDING_STATION: Record<string, StationId | null> = {
  pier: 'unload',
  warehouse: 'store',
  garage: 'move',
  office: 'support',
};

const PLACE_NAME: Record<StationId, string> = {
  unload: 'Причал',
  move: 'Гараж',
  store: 'Склад',
  support: 'Офис',
};

const NEIGHBOR_NAME: Record<string, string> = {
  flow: 'поток',
  morale: 'мораль',
  rest: 'отдых',
  move: 'ход',
  repair: 'ремонт',
  heavy: 'тяжёлое',
  xp: 'опыт',
  contract: 'заказы',
  parts: 'запчасти',
  spoil: 'сохранность',
};

const BLURB: Record<string, string> = {
  pier: 'Разгружает машины у причала.',
  warehouse: 'Размещает груз по местам.',
  garage: 'Перевозит груз по терминалу.',
  office: 'Бригадир и механик держат линию.',
  dorm: 'Отдыхает между сменами.',
  canteen: 'Кормит смену. Рядом с общежитием снимает усталость, рядом с причалом поднимает мораль.',
  rest: 'Комната отдыха. Рядом с учебкой даёт опыт.',
  school: 'Учебка. Рядом с комнатой отдыха даёт опыт.',
  crane: 'Кран-ангар. Рядом с причалом берёт тяжёлое.',
  dispatch: 'Диспетчерская. Рядом с офисом ведёт контракты.',
  fridge: 'Рефрижератор. Рядом со складом бережёт груз.',
  workshop: 'Мастерская. Рядом с гаражом чинит технику, рядом со складом даёт запчасти.',
  bunker: 'Редкая находка. Людей на линию не ставит.',
  garden: 'Редкая находка. Людей на линию не ставит.',
  observatory: 'Редкая находка. Людей на линию не ставит.',
};

export function buildingCaption(sector: string): string {
  return BLURB[sector] ?? 'Строение терминала.';
}

export function buildingPlace(station: string | null | undefined): string | null {
  if (!station || !(station in PLACE_NAME)) return null;
  return PLACE_NAME[station as StationId];
}

export function buildingCrew(waifu: WaifuDTO[], sector: string): WaifuDTO[] {
  if (sector === 'dorm') {
    return waifu.filter((w) => w.zone !== 'gym' && w.zone !== 'contract' && (!w.station || w.fatigue >= 80));
  }
  const station = BUILDING_STATION[sector];
  if (!station) return [];
  const onStation = waifu.filter((w) => w.station === station && w.zone !== 'gym' && w.zone !== 'contract');
  if (sector !== 'warehouse') return onStation;
  const strays = waifu.filter((w) => w.zone === 'warehouse' && !w.station);
  return [...onStation, ...strays];
}

const PREVIEW = { up: 'Линия станет быстрее', same: 'Линия останется такой же', down: 'Линия станет медленнее' };
const MODES = [
  ['easy', 'Лёгкий'],
  ['normal', 'Обычный'],
  ['hard', 'Ударный'],
] as const;

export function TerminalPanel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const state = useStore((s) => s.state);
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const term = state?.terminal;
  const [slot, setSlot] = useState<StationId | null>(null);
  const [pick, setPick] = useState<{ id: string; preview: 'up' | 'same' | 'down' } | null>(null);
  const stations = term?.live ? term.stations : undefined;
  if (!state || !term?.live || !stations) return null;

  const act = (fn: () => Promise<StateDTO>) => run(async () => apply(await fn()));
  const lineMax = Math.max(1, stations.unload.rate, stations.move.rate, stations.store.rate);
  const stationId = BUILDING_STATION[selected] ?? null;
  const station = stationId === 'unload' ? stations.unload : stationId === 'move' ? stations.move : stationId === 'store' ? stations.store : stationId === 'support' ? stations.support : null;
  const names = new Map(state.waifu.map((w) => [w.id, displayName(w)]));
  const bench = state.waifu.filter((w) => w.zone !== 'gym' && w.zone !== 'contract');
  const strays = state.waifu.filter((w) => w.zone === 'warehouse' && !w.station);
  const resting = buildingCrew(state.waifu, 'dorm');

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Терминал</h3>
      {term.intro && (
        <p className="small">
          {term.intro}{' '}
          <button className="btn small" onClick={() => act(() => api.terminalAck('intro'))}>
            Понятно
          </button>
        </p>
      )}
      {term.report && (
        <div className="panel">
          <b>Смена {term.report.grade}</b>
          <p className="small">
            {term.report.tons.toFixed(2)} т · {term.report.coins} монет · брак {term.report.defect}. Лучшая — {term.report.best}. {term.report.joke}
            {term.report.conflict ? ' Конфликт: кого-то сняли со слота.' : ''}
          </p>
          <button className="btn small" onClick={() => act(() => api.terminalAck('report'))}>
            Закрыть отчёт
          </button>
        </div>
      )}
      <p className="small muted">
        Узкое место: {stations[term.bottleneck as 'unload']?.name ?? 'линия'} · {term.tonsPerMin?.toFixed(2)} т/мин · мораль {term.morale ?? 0}
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        {MODES.map(([id, label]) => (
          <button key={id} className={`btn small ${term.shift?.mode === id ? 'primary' : ''}`} onClick={() => act(() => api.terminalMode(id))}>
            {label}
          </button>
        ))}
        <button className="btn small" onClick={() => act(() => api.terminalRush())}>
          Рывок
        </button>
        {!term.shift?.active && (
          <button className="btn small primary" onClick={() => act(() => api.terminalShift())}>
            Начать смену
          </button>
        )}
      </div>
      {term.dispatch && (
        <p className="small">
          Автосмена{' '}
          <button className="btn small" onClick={() => act(() => api.terminalAuto(!term.autoShift))}>
            {term.autoShift ? 'вкл' : 'выкл'}
          </button>
        </p>
      )}
      <h3>Строения</h3>
      {(term.sectors ?? []).map((s) => (
        <div key={s.id} className="row" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
          <button className={`btn small ${selected === s.id ? 'primary' : ''}`} onClick={() => onSelect(s.id)}>
            {s.name} · ур. {s.level}
          </button>
          <button className="btn small" onClick={() => act(() => api.terminalUpgrade(s.id))}>
            Улучшить
          </button>
          {s.id !== 'pier' && (
            <button className="btn small" onClick={() => act(() => api.terminalDemolish(s.id))}>
              Снести
            </button>
          )}
        </div>
      ))}
      <p className="small">{buildingCaption(selected)}</p>
      {station && stationId && (
        <div style={{ marginBottom: 8 }}>
          <div className="row">
            <b className="small">{station.name}</b>
            <span className="spacer" />
            <span className="small muted">
              {station.crew.length}/{station.slots}
            </span>
          </div>
          {'rate' in station && (
            <div className="bar">
              <i style={{ width: `${Math.min(100, (station.rate / lineMax) * 100)}%` }} />
            </div>
          )}
          {station.slots > 0 ? (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {station.crew.map((idCrew) => {
                const person = state.waifu.find((w) => w.id === idCrew);
                const away = person?.zone === 'gym' || person?.zone === 'contract';
                if (away) {
                  return (
                    <span key={idCrew} className="small muted">
                      {names.get(idCrew) ?? 'Слот'} · вернётся
                    </span>
                  );
                }
                return (
                  <button key={idCrew} className="btn small" onClick={() => act(() => api.terminalAssign(idCrew, null))}>
                    {names.get(idCrew) ?? 'Слот'} ×
                  </button>
                );
              })}
              {station.crew.length < station.slots && (
                <button className="btn small primary" onClick={() => { setSlot(stationId); setPick(null); }}>
                  Назначить
                </button>
              )}
            </div>
          ) : (
            <p className="small muted">Места откроются, когда строение будет готово к работе.</p>
          )}
        </div>
      )}
      {selected === 'warehouse' && strays.length > 0 && (
        <div>
          {strays.map((w) => (
            <div key={w.id} className="row" style={{ marginBottom: 6 }}>
              <span className="small">{displayName(w)} — на складе, не на линии</span>
              <span className="spacer" />
              <button
                className="btn small primary"
                disabled={stations.store.crew.length >= stations.store.slots}
                onClick={() => act(() => api.terminalAssign(w.id, 'store'))}
              >
                Поставить на размещение
              </button>
            </div>
          ))}
        </div>
      )}
      {selected === 'dorm' && (
        <p className="small muted">{resting.length ? resting.map((w) => displayName(w)).join(', ') : 'В общежитии сейчас пусто.'}</p>
      )}
      {term.neighbors && term.neighbors.length > 0 && (
        <p className="small muted">Соседство: {term.neighbors.map((id) => NEIGHBOR_NAME[id] ?? id).join(', ')}</p>
      )}
      {term.building && (
        <p className="small">
          Строится {term.building.name} до {new Date(term.building.until).toLocaleTimeString()}{' '}
          <button className="btn small" onClick={() => act(() => api.terminalCancel())}>
            Отмена, 80%
          </button>
        </p>
      )}
      <button className="btn small" onClick={() => act(() => api.terminalExpand())}>
        Расширить · {term.expandCost} монет
      </button>
      {(term.offer ?? []).length > 0 && (
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {term.offer!.map((card) => (
            <button key={card.id} className="btn small primary" onClick={() => act(() => api.terminalPick(card.id))}>
              {card.name}
            </button>
          ))}
          {(term.rerolls ?? 0) < 3 && (
            <button className="btn small" onClick={() => act(() => api.terminalReroll())}>
              Переброс {term.rerollCost}
            </button>
          )}
        </div>
      )}
      {slot && (
        <Modal title="Кого поставить" onClose={() => setSlot(null)}>
          {bench.map((w) => (
            <div key={w.id} className="row" style={{ marginBottom: 6 }}>
              <span className="small">
                {displayName(w)}
                {w.jobClass ? ` · ${JOB_NAME[w.jobClass as TerminalJob] ?? w.jobClass}` : ''}
              </span>
              <span className="spacer" />
              <button
                className="btn small"
                onClick={() =>
                  run(async () => {
                    const r = await api.terminalPreview(w.id, slot);
                    apply(r.state);
                    setPick({ id: w.id, preview: r.preview });
                  })
                }
              >
                Прикинуть
              </button>
            </div>
          ))}
          {pick && (
            <p className="small">
              {PREVIEW[pick.preview]}{' '}
              <button
                className="btn small primary"
                onClick={() =>
                  run(async () => {
                    apply(await api.terminalAssign(pick.id, slot));
                    setSlot(null);
                    setPick(null);
                  })
                }
              >
                Поставить
              </button>
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
