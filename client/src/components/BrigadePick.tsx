import type { WaifuDTO } from '@wl/shared';
import { displayName } from './ui';

function cardKind(w: WaifuDTO): 'ok' | 'warn' | 'bad' | 'idle' {
  if (w.zone === 'gym' || w.zone === 'contract') return 'bad';
  if (w.fatigue >= 80) return 'warn';
  if (w.station) return 'ok';
  return 'idle';
}

const KIND_LABEL = { ok: 'На смене', warn: 'Устала', bad: 'Занята', idle: 'Свободна' };

export function BrigadePick({
  waifu,
  onPick,
  onClose,
}: {
  waifu: WaifuDTO[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="building-modal brigade-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="head">
          <h2 style={{ margin: 0 }}>Бригада игрока</h2>
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="brig-grid">
          {waifu.map((w) => {
            const kind = cardKind(w);
            const busy = kind === 'bad';
            return (
              <button key={w.id} className={`brig-card ${kind}`} disabled={busy} onClick={() => onPick(w.id)}>
                <img src={w.portraitUrl || w.thumbUrl} alt="" />
                <b>{displayName(w)}</b>
                <small>{KIND_LABEL[kind]}{w.station ? '' : ''}</small>
              </button>
            );
          })}
          {waifu.length === 0 && <p className="small">В коллекции пока пусто.</p>}
        </div>
      </div>
    </div>
  );
}
