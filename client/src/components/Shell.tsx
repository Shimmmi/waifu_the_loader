import { useMemo, type ReactNode } from 'react';
import { D, formatNumber, loadContent, pickLine } from '@wl/shared';
import { useLive, useText } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore, type Screen } from '../store';

const NAV: { id: Screen; icon: string; key: TKey }[] = [
  { id: 'warehouse', icon: '🏭', key: 'nav.warehouse' },
  { id: 'buildings', icon: '🏗️', key: 'nav.buildings' },
  { id: 'collection', icon: '👷‍♀️', key: 'nav.collection' },
  { id: 'gacha', icon: '📦', key: 'nav.gacha' },
  { id: 'training', icon: '🏋️', key: 'nav.training' },
  { id: 'contracts', icon: '📞', key: 'nav.contracts' },
  { id: 'prestige', icon: '🔰', key: 'nav.prestige' },
  { id: 'events', icon: '🎹', key: 'nav.events' },
  { id: 'achievements', icon: '🏅', key: 'nav.achievements' },
  { id: 'shop', icon: '🛍️', key: 'nav.shop' },
  { id: 'profile', icon: '⚙️', key: 'nav.profile' },
];
const ADMIN_NAV = { id: 'admin' as const, icon: '🤖', key: 'nav.admin' as const };

function ResourceBar() {
  const state = useStore((s) => s.state);
  const live = useLive();
  const notation = useStore((s) => s.settings.notation);
  const fmt = (v: Parameters<typeof formatNumber>[0]) => formatNumber(v, notation, true);
  const t = useT();
  if (!state || !live) return null;
  const r = state.resources;
  return (
    <div className="resbar">
      <span className="logo">{t('app.title')}</span>
      <span className="res" title={t('res.cargo')}>
        <span className="ico">📦</span>
        <b>{fmt(live.cargoTotal)}</b>
        <small>{t('unit.kg')}</small>
      </span>
      <span className="res" title={t('res.coins')}>
        <span className="ico">🪙</span>
        <b>{fmt(live.coins)}</b>
        <small>+{fmt(state.rates.coinsPerSec)}{t('unit.perSec')}</small>
      </span>
      <span className="res" title={t('res.protein')}>
        <span className="ico">🥤</span>
        <b>{fmt(live.protein)}</b>
      </span>
      <span className="res" title={t('res.tokens')}>
        <span className="ico">🎖️</span>
        <b>{r.tokens}</b>
      </span>
      <span className="res" title={t('res.tickets')}>
        <span className="ico">🎟️</span>
        <b>{r.tickets}</b>
      </span>
      <span className="res" title={t('res.shards')}>
        <span className="ico">💠</span>
        <b>{r.shards}</b>
      </span>
      {D(r.seals).gt(0) && (
        <span className="res" title={t('res.seals')}>
          <span className="ico">🔰</span>
          <b>{fmt(r.seals)}</b>
        </span>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const state = useStore((s) => s.state);
  const t = useT();
  const text = useText();
  const swear = useStore((s) => s.settings.swear);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- новая подсказка при смене экрана
  const roll = useMemo(() => Math.random(), [screen]);
  const tip = text(pickLine(loadContent().flavor.tips, swear, {}, () => roll));
  const badges: Partial<Record<Screen, number>> = {
    warehouse: state?.dailyAvailable ? 1 : 0,
    training: state ? state.trainings.filter((j) => Date.parse(j.endsAt) <= Date.now()).length : 0,
    contracts: state ? state.contracts.filter((c) => c.status === 'active' && c.endsAt && Date.parse(c.endsAt) <= Date.now()).length : 0,
    prestige: state ? state.prestige.sealsOnReset : 0,
    gacha: state ? Math.floor(state.resources.tickets / 10) + (state.banners.some((b) => b.type === 'newbie' && b.active) ? 1 : 0) : 0,
  };
  return (
    <div className="app">
      <header className="topbar">
        <div className="stripe hazard" />
        <ResourceBar />
      </header>
      <nav className="sidenav">
        {(state?.user.isAdmin ? [...NAV, ADMIN_NAV] : NAV).map((n) => (
          <button key={n.id} className={`navbtn ${screen === n.id ? 'active' : ''}`} onClick={() => setScreen(n.id)}>
            <span className="ico">{n.icon}</span>
            <span>{t(n.key)}</span>
            {!!badges[n.id] && <span className="badge">{badges[n.id]}</span>}
          </button>
        ))}
      </nav>
      <main>
        {children}
        <div className="tip" key={screen}>
          💡 {tip}
        </div>
      </main>
    </div>
  );
}
