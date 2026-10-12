import { useState } from 'react';
import { D, loadContent, loadEconomy, nodeCost, pickLine, prestigeMods } from '@wl/shared';
import { api } from '../api';
import { useFmt, useLive, useText } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';
import { Modal } from '../components/ui';

export function Prestige() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const busy = useStore((s) => s.busy);
  const swear = useStore((s) => s.settings.swear);
  const t = useT();
  const fmt = useFmt();
  const text = useText();
  const live = useLive();
  const [confirm, setConfirm] = useState(false);
  const cfg = loadEconomy();
  const p = state.prestige;
  const mods = prestigeMods(p.upgrades, p.sealsEarned, cfg);
  const seals = D(state.resources.seals);
  const canEnd = p.sealsOnReset >= 1;

  const endShift = () =>
    run(async () => {
      const r = await api.endShift();
      apply(r.state);
      setConfirm(false);
      const line = pickLine(loadContent().flavorM4.prestige, swear, { seals: String(r.seals) });
      toast(text(`🔰 +${r.seals}${r.tickets ? ` · 🎟 +${r.tickets}` : ''}\n«${line}»`), 'success');
    });

  return (
    <div>
      <div className="panel taped">
        <h2 style={{ marginTop: 0 }}>🔰 {t('pr.title')}</h2>
        <div className="grid2">
          <div>
            <div className="small muted">{t('pr.run')}</div>
            <div className="big-number">{fmt(live?.cargo ?? state.resources.cargo)} кг</div>
            <div className="small muted">{t('pr.next', { kg: fmt(p.nextSealCargo) })}</div>
          </div>
          <div>
            <div className="small muted">{t('pr.seals')}</div>
            <div className="big-number">+{p.sealsOnReset}</div>
            <div className="small muted">{t('pr.count', { n: p.count })}</div>
          </div>
        </div>
        <p className="small">{t('pr.mult', { m: (1 + cfg.prestige.seal_bonus * p.sealsEarned).toFixed(2) })}</p>
        {canEnd ? (
          <button className="btn danger big" disabled={busy} onClick={() => setConfirm(true)}>
            {t('pr.end')}
          </button>
        ) : (
          <p className="muted">{t('pr.notYet', { kg: fmt(p.nextSealCargo) })}</p>
        )}
      </div>

      <div className="panel">
        <div className="row">
          <h3 style={{ margin: 0 }}>{t('pr.tree')}</h3>
          <span className="spacer" />
          <span className="tag">🔰 {t('pr.have', { n: fmt(seals) })}</span>
        </div>
        <div className="tree" style={{ marginTop: 10 }}>
          {cfg.prestige.tree.map((n) => {
            const lvl = p.upgrades[n.id] ?? 0;
            const cost = nodeCost(n, lvl);
            return (
              <div key={n.id} className={`node ${cost === null ? 'maxed' : ''}`}>
                <b>
                  {n.icon} {n.name}
                </b>
                <span className="small muted">{text(n.description)}</span>
                <div className="pips">
                  {n.costs.map((_, i) => (
                    <i key={i} className={i < lvl ? 'on' : ''} />
                  ))}
                </div>
                {cost === null ? (
                  <span className="small ok">{t('pr.max')}</span>
                ) : (
                  <button className="btn small primary" disabled={busy || seals.lt(cost)} onClick={() => run(async () => apply(await api.prestigeUpgrade(n.id)))}>
                    {t('pr.buy')} · 🔰 {cost}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t('pr.auto')}</h3>
        <div className="row">
          <span>{t('pr.autoClaim')}</span>
          <span className="spacer" />
          <span className={`tag ${mods.autoClaim ? 'ok' : ''}`}>{mods.autoClaim ? t('pr.on') : t('pr.locked')}</span>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span>{t('pr.autoBuildings')}</span>
          <span className="spacer" />
          {p.unlocked.autoBuildings ? (
            <div className="seg">
              {[true, false].map((v) => (
                <button key={String(v)} className={p.auto.buildings === v ? 'on' : ''} disabled={busy} onClick={() => run(async () => apply(await api.prestigeAuto({ buildings: v })))}>
                  {v ? t('pr.on') : t('pr.off')}
                </button>
              ))}
            </div>
          ) : (
            <span className="tag">{t('pr.locked')}</span>
          )}
        </div>
      </div>

      {confirm && (
        <Modal onClose={() => setConfirm(false)} title={t('pr.confirm')}>
          <p>
            🔰 <b>+{p.sealsOnReset}</b>
          </p>
          <p className="small">{t('pr.resets')}</p>
          <p className="small">{t('pr.keeps')}</p>
          <div className="row">
            <button className="btn danger" disabled={busy} onClick={endShift}>
              {t('pr.end')}
            </button>
            <button className="btn" onClick={() => setConfirm(false)}>
              ✕
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
