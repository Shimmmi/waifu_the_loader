import { useState } from 'react';
import { D, loadMeta, tierKey, type MetaDTO, type MetricKey } from '@wl/shared';
import { useFmt } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';

const TIER = { bronze: 'бронза', silver: 'серебро', gold: 'золото' };

export function Achievements() {
  const state = useStore((s) => s.state)!;
  const t = useT();
  const fmt = useFmt();
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const meta = loadMeta();
  const claimed = new Set(state.meta.claimed);
  const metrics = state.meta.metrics;

  const list = meta.achievements.filter((a) => {
    const done = a.tiers.every((tier) => claimed.has(tierKey(a.id, tier.id)));
    if (filter === 'done') return done;
    if (filter === 'open') return !done && (!a.hidden || a.tiers.some((tier) => claimed.has(tierKey(a.id, tier.id))));
    return true;
  });

  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        {(['all', 'open', 'done'] as const).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {t(f === 'all' ? 'ac.all' : f === 'open' ? 'ac.open' : 'ac.done')}
          </button>
        ))}
      </div>
      <div className="tree">
        {list.map((a) => {
          const any = a.tiers.some((tier) => claimed.has(tierKey(a.id, tier.id)));
          const hidden = a.hidden && !any;
          const next = a.tiers.find((tier) => !claimed.has(tierKey(a.id, tier.id)));
          const value = metricOf(metrics, a.metric);
          const width = next ? Math.min(100, (value / Math.max(1, next.threshold)) * 100) : 100;
          return (
            <div key={a.id} className={`node ${!next ? 'maxed' : ''}`}>
              <b>{hidden ? t('ac.hidden') : a.name}</b>
              <span className="small muted">{hidden ? '???' : a.description}</span>
              {!hidden && (
                <>
                  <div className="pips">
                    {a.tiers.map((tier) => (
                      <i key={tier.id} className={claimed.has(tierKey(a.id, tier.id)) ? 'on' : ''} title={TIER[tier.id]} />
                    ))}
                  </div>
                  <div className="progress">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <span className="small muted">
                    {a.metric === 'cargo_total' ? fmt(value) : Math.floor(value)}
                    {next ? ` / ${a.metric === 'cargo_total' ? fmt(next.threshold) : next.threshold}` : ''}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function metricOf(m: MetaDTO['metrics'], key: MetricKey): number {
  switch (key) {
    case 'cargo_total':
      return D(m.cargoTotal).toNumber();
    case 'full_archetypes':
      return m.fullArchetypes;
    case 'hard_pity':
      return m.hardPity ? 1 : 0;
    default:
      return m[key];
  }
}
