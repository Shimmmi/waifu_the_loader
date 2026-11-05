import type { WaifuDTO } from '@wl/shared';
import { displayName } from './ui';

function cardKind(w: WaifuDTO): 'ok' | 'warn' | 'bad' | 'idle' {
  if (w.zone === 'gym' || w.zone === 'contract') return 'bad';
  if (w.fatigue >= 80) return 'warn';
  if (w.station) return 'ok';
  return 'idle';
}

const MARK = {
  ok: 'status-ok.png',
  warn: 'status-warn.png',
  bad: 'status-bad.png',
  idle: 'status-idle.png',
} as const;
const UI = import.meta.env.BASE_URL + 'terminal/ui/';

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
                <span className="brig-frame">
                  <img className="brig-portrait" src={w.portraitUrl || w.thumbUrl} alt="" />
                  <img className="brig-mark" src={`${UI}${MARK[kind]}`} alt="" />
                </span>
                <b>{displayName(w)}</b>
              </button>
            );
          })}
          {waifu.length === 0 && <p className="small">Наёмниц пока нет. Бесплатные призывы уже на счету.</p>}
        </div>
      </div>
    </div>
  );
}
