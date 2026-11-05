import { useState } from 'react';
import { JOB_NAME, type StateDTO, type TerminalJob } from '@wl/shared';
import { api } from '../api';
import { useStore } from '../store';
import { displayName, Modal } from './ui';

const PREVIEW = { up: 'Линия станет быстрее', same: 'Линия останется такой же', down: 'Линия станет медленнее' };
const MODES = [
  ['easy', 'Лёгкий'],
  ['normal', 'Обычный'],
  ['hard', 'Ударный'],
] as const;

export function TerminalPanel() {
  const state = useStore((s) => s.state);
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const term = state?.terminal;
  const [slot, setSlot] = useState<'unload' | 'move' | 'store' | 'support' | null>(null);
  const [pick, setPick] = useState<{ id: string; preview: 'up' | 'same' | 'down' } | null>(null);
  if (!state || !term?.live || !term.stations) return null;

  const act = (fn: () => Promise<StateDTO>) => run(async () => apply(await fn()));
  const stations = [
    ['unload', term.stations.unload],
    ['move', term.stations.move],
    ['store', term.stations.store],
  ] as const;
  const max = Math.max(1, ...stations.map(([, s]) => s.rate));
  const names = new Map(state.waifu.map((w) => [w.id, displayName(w)]));
  const bench = state.waifu.filter((w) => w.zone !== 'gym' && w.zone !== 'contract');

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
        Узкое место: {term.stations[term.bottleneck as 'unload']?.name ?? 'линия'} · {term.tonsPerMin?.toFixed(2)} т/мин · мораль {term.morale ?? 0}
      </p>
      {stations.map(([id, s]) => (
        <div key={id} style={{ marginBottom: 8 }}>
          <div className="row">
            <b className="small">{s.name}</b>
            <span className="spacer" />
            <span className="small muted">
              {s.crew.length}/{s.slots}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, (s.rate / max) * 100)}%` }} />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {s.crew.map((idCrew) => (
              <button key={idCrew} className="btn small" onClick={() => act(() => api.terminalAssign(idCrew, null))}>
                {names.get(idCrew) ?? 'Слот'} ×
              </button>
            ))}
            {s.crew.length < s.slots && (
              <button className="btn small primary" onClick={() => { setSlot(id); setPick(null); }}>
                Назначить
              </button>
            )}
          </div>
        </div>
      ))}
      {term.stations.support.open && (
        <p className="small">
          Поддержка {term.stations.support.crew.length}/{term.stations.support.slots}{' '}
          <button className="btn small" onClick={() => { setSlot('support'); setPick(null); }}>
            Назначить
          </button>
        </p>
      )}
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
      <h3>Сектора</h3>
      {(term.sectors ?? []).map((s) => (
        <div key={s.id} className="row">
          <span>
            {s.name} · ур. {s.level}
          </span>
          <span className="spacer" />
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
      {term.neighbors && term.neighbors.length > 0 && <p className="small muted">Соседство: {term.neighbors.join(', ')}</p>}
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
