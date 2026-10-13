import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { loadEconomy, loadMeta, rarityConfig, type Rarity, type WaifuDTO } from '@wl/shared';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useFmt } from '../hooks';

export function rarityStyle(r: Rarity): CSSProperties {
  return { ['--rc' as string]: `var(--r-${r})` };
}

export function rarityName(r: Rarity): string {
  return rarityConfig(loadEconomy(), r).name;
}

export function displayName(w: Pick<WaifuDTO, 'name' | 'customName'>): string {
  return w.customName ?? w.name;
}

export function Modal({ title, onClose, children, wide }: { title?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 980 } : undefined} role="dialog" aria-modal="true">
        <div className="head">
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? '' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function WaifuCard({
  w,
  onClick,
  badge,
  showDuty = true,
  picked = false,
}: {
  w: WaifuDTO;
  onClick?: () => void;
  badge?: ReactNode;
  showDuty?: boolean;
  picked?: boolean;
}) {
  const t = useT();
  const frameId = useStore((s) => s.state?.meta.loadout.frame);
  const cardId = useStore((s) => s.state?.meta.loadout.card);
  const extra = [frameId, cardId].map((id) => loadMeta().cosmetics.find((c) => c.id === id)?.css).filter(Boolean).join(' ');
  return (
    <button className={`card r-${w.rarity}${picked ? ' picked' : ''} ${extra}`} style={rarityStyle(w.rarity)} onClick={onClick} type="button">
      <img src={w.thumbUrl} alt={displayName(w)} loading="lazy" />
      <span className="rar">{w.rarity}</span>
      <span className="lvl">
        {t('b.level')} {w.level}
      </span>
      {showDuty && w.zone && (
        <span className="onduty">{w.zone === 'warehouse' ? '📦' : w.zone === 'gym' ? '🏋️' : w.zone === 'clerk' ? '🗄️' : '📞'}</span>
      )}
      {w.fatigue >= 1 && <span className="fatigue-chip" title="😮‍💨">😮‍💨 {w.fatigue}</span>}
      {badge}
      <div className="meta">
        <div className="name">{displayName(w)}</div>
        <div className="sub">
          <Stars n={w.stars} />
        </div>
      </div>
    </button>
  );
}

/** 90 → «1м 30с», 3900 → «1ч 05м» */
export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}ч${m ? ` ${String(m).padStart(2, '0')}м` : ''}`;
  if (m) return `${m}м${s % 60 && m < 10 ? ` ${s % 60}с` : ''}`;
  return `${s}с`;
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const drop = useStore((s) => s.dropToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`} onClick={() => drop(x.id)}>
          {x.text}
        </div>
      ))}
    </div>
  );
}

export function Cost({ coins, protein, okCoins = true, okProtein = true }: { coins?: string; protein?: string; okCoins?: boolean; okProtein?: boolean }) {
  const fmt = useFmt();
  return (
    <span className="small">
      {coins && <span style={{ color: okCoins ? undefined : 'var(--danger)' }}>🪙 {fmt(coins)}</span>}
      {protein && protein !== '0' && <span style={{ color: okProtein ? undefined : 'var(--danger)', marginLeft: 6 }}>🥤 {fmt(protein)}</span>}
    </span>
  );
}
