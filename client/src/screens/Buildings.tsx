import {
  buildingBulkCost,
  buildingCost,
  buildingMaxAffordable,
  loadContent,
  loadEconomy,
  milestoneCount,
  milestoneMult,
  warehouseSlots,
  type BuildingConfig,
} from '@wl/shared';
import { api } from '../api';
import { useFlavor, useFmt, useLive, useText } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore } from '../store';

function effect(b: BuildingConfig, level: number): string {
  const cfg = loadEconomy();
  const m = milestoneMult(level, cfg);
  if (b.id === 'warehouse') return ((1 + b.per_level * Math.max(0, level - 1)) * m).toFixed(2);
  if (b.id === 'canteen') return (b.per_level * level * m).toFixed(2);
  if (b.id === 'autopark') return ((1 + b.per_level * level) * m).toFixed(2);
  return '';
}

function nextMilestone(level: number): number {
  const cfg = loadEconomy();
  const c = milestoneCount(level, cfg);
  let l = level + 1;
  while (milestoneCount(l, cfg) === c) l++;
  return l;
}

export function Buildings() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const busy = useStore((s) => s.busy);
  const live = useLive();
  const t = useT();
  const fmt = useFmt();
  const text = useText();
  const flavor = useFlavor();
  const cfg = loadEconomy();
  const content = loadContent();

  const upgrade = (b: BuildingConfig, count: number | 'max') =>
    run(async () => {
      apply(await api.upgrade(b.id, count));
      const lines = content.flavor.building_upgrade[b.id];
      if (lines) toast(flavor(lines), 'success');
    });

  return (
    <div className="grid2">
      {cfg.buildings.map((b) => {
        const level = state.buildings[b.id] ?? b.start_level;
        const cost1 = buildingCost(b, level);
        const cost10 = buildingBulkCost(b, level, 10);
        const max = live ? buildingMaxAffordable(b, level, live.coins) : 0;
        const can1 = !!live?.coins.gte(cost1);
        const can10 = !!live?.coins.gte(cost10);
        const nm = nextMilestone(level);
        const prevM = (() => {
          let l = level;
          while (l > 0 && milestoneCount(l - 1, cfg) === milestoneCount(level, cfg)) l--;
          return l;
        })();
        const progress = Math.min(100, ((level - prevM) / Math.max(1, nm - prevM)) * 100);
        return (
          <div className="panel taped" key={b.id}>
            <div className="bcard">
              <div className="bicon">{b.icon}</div>
              <div>
                <div className="row">
                  <h3 style={{ margin: 0 }}>{b.name}</h3>
                  <span className="tag">
                    {t('b.level')} {level}
                  </span>
                </div>
                <p className="small muted" style={{ margin: '4px 0' }}>
                  {text(b.description)}
                </p>
                <div className="small">
                  {t(`b.effect.${b.id}` as TKey, {
                    now: effect(b, level),
                    next: effect(b, level + 1),
                    slots: `${warehouseSlots(level, cfg)}${warehouseSlots(level + 1, cfg) > warehouseSlots(level, cfg) ? ' → ' + warehouseSlots(level + 1, cfg) : ''}`,
                  })}
                </div>
                <div className="progress" title={`${t('b.next')} ${nm}`}>
                  <i style={{ width: `${progress}%` }} />
                </div>
                <div className="small muted">
                  {t('b.next')} {nm}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn primary" disabled={!can1 || busy} onClick={() => upgrade(b, 1)}>
                    {t('b.buy1')} · 🪙 {fmt(cost1)}
                  </button>
                  <button className="btn" disabled={!can10 || busy} onClick={() => upgrade(b, 10)}>
                    {t('b.buy10')} · {fmt(cost10)}
                  </button>
                  <button className="btn" disabled={max < 1 || busy} onClick={() => upgrade(b, 'max')}>
                    {t('b.buyMax')} {max > 0 ? `(+${max})` : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
