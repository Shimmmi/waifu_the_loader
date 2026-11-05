import { useState } from 'react';
import { D, upgradeCost, type WaifuDTO } from '@wl/shared';
import { api } from '../api';
import { useFmt } from '../hooks';
import { useStore } from '../store';
import { buildingArtUrl } from './ArtSlot';
import { BrigadePick } from './BrigadePick';
import { BUILDING_STATION, buildingCaption, type StationId } from './Terminal';

type Lamp = 'ok' | 'warn' | 'bad';

function lampOf(sectorId: string, shift: boolean, crew: string[], waifu: WaifuDTO[]): Lamp {
  const station = BUILDING_STATION[sectorId];
  if (!station) return shift ? 'ok' : 'warn';
  if (crew.length === 0) return 'bad';
  const tired = waifu.some((w) => crew.includes(w.id) && w.fatigue >= 80);
  if (!shift || tired) return 'warn';
  return 'ok';
}

export function TerminalBuildings() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const fmt = useFmt();
  const term = state.terminal!;
  const sectors = term.sectors ?? [];
  const stations = term.stations!;
  const [pick, setPick] = useState<{ sector: string; station: StationId } | null>(null);

  const act = (fn: () => Promise<typeof state>) => run(async () => apply(await fn()));

  return (
    <div className="bmanage">
      <table className="btable">
        <thead>
          <tr>
            <th />
            <th>Строение</th>
            <th>Уровень</th>
            <th>Статус</th>
            <th>Слоты</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => {
            const station = BUILDING_STATION[s.id] ?? null;
            const block = station ? stations[station] : null;
            const crew = block?.crew ?? [];
            const slots = block?.slots ?? 0;
            const lamp = lampOf(s.id, !!term.shift?.active, crew, state.waifu);
            const cost = upgradeCost(s.level);
            const canUp = s.level < 20 && D(state.resources.coins).gte(cost);
            return (
              <tr key={s.id}>
                <td>
                  <img className="bicon-img" src={buildingArtUrl(s.id)} alt="" />
                </td>
                <td>
                  <b>{s.name}</b>
                  <div className="small muted">{buildingCaption(s.id)}</div>
                </td>
                <td>{s.level}</td>
                <td>
                  <span className={`lamp ${lamp}`} title={lamp === 'ok' ? 'Работает' : lamp === 'warn' ? 'Нужно внимание' : 'Не работает'} />
                </td>
                <td>
                  {station && slots > 0 ? (
                    <div className="slot-row">
                      {Array.from({ length: slots }, (_, i) => {
                        const id = crew[i];
                        const w = id ? state.waifu.find((x) => x.id === id) : undefined;
                        if (!id || !w) {
                          return (
                            <button key={i} className="slot-cell" onClick={() => setPick({ sector: s.id, station })}>
                              +
                            </button>
                          );
                        }
                        return (
                          <button key={id} className="slot-cell filled" title="Снять" onClick={() => act(() => api.terminalAssign(id, null))}>
                            <img src={w.thumbUrl} alt="" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="small muted">—</span>
                  )}
                </td>
                <td>
                  <button className="pix-upgrade slim" disabled={!canUp} onClick={() => act(() => api.terminalUpgrade(s.id))}>
                    Улучшить · {fmt(cost)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Расширение</h3>
        <p className="small muted">Новое строение выбирается из трёх карточек. Переброс до трёх раз.</p>
        <button className="pix-upgrade slim" onClick={() => act(() => api.terminalExpand())}>
          Расширить · {fmt(term.expandCost ?? 0)}
        </button>
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {(term.offer ?? []).map((card) => (
            <button key={card.id} className="pix-upgrade slim" onClick={() => act(() => api.terminalPick(card.id))}>
              {card.name}
            </button>
          ))}
          {(term.offer ?? []).length > 0 && (term.rerolls ?? 0) < 3 && (
            <button className="btn" onClick={() => act(() => api.terminalReroll())}>
              Переброс · {fmt(term.rerollCost ?? 0)}
            </button>
          )}
        </div>
      </div>

      {pick && (
        <BrigadePick
          waifu={state.waifu}
          onClose={() => setPick(null)}
          onPick={(id) => {
            const station = pick.station;
            setPick(null);
            void act(() => api.terminalAssign(id, station));
          }}
        />
      )}
    </div>
  );
}
