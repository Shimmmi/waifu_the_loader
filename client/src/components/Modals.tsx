import { useMemo } from 'react';
import { formatDuration, loadContent, loadEconomy } from '@wl/shared';
import { useFlavor, useFmt } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';
import { displayName, Modal } from './ui';

export function OfflineModal() {
  const rep = useStore((s) => s.offlineReport);
  const close = useStore((s) => s.closeOffline);
  const state = useStore((s) => s.state);
  const t = useT();
  const fmt = useFmt();
  const flavor = useFlavor();
  const line = useMemo(() => {
    if (!rep) return '';
    const crew = state?.waifu.filter((w) => w.zone === 'warehouse') ?? [];
    const pick = crew[Math.floor(Math.random() * crew.length)];
    return flavor(loadContent().flavor.offline_report, {
      hours: (rep.offlineSec / 3600).toFixed(1),
      cargo: fmt(rep.cargo),
      coins: fmt(rep.coins),
      name: pick ? displayName(pick) : 'Бригада',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep]);
  if (!rep) return null;
  return (
    <Modal title={`🌙 ${t('off.title')}`} onClose={close}>
      <p style={{ fontSize: 17 }}>{line}</p>
      <div className="kv" style={{ margin: '12px 0' }}>
        <span>{t('off.time')}</span>
        <span>{formatDuration(rep.offlineSec)}</span>
        <span>📦 {t('res.cargo')}</span>
        <span>+{fmt(rep.cargo)} {t('unit.kg')}</span>
        <span>🪙 {t('res.coins')}</span>
        <span>+{fmt(rep.coins)}</span>
        <span>🥤 {t('res.protein')}</span>
        <span>+{fmt(rep.protein)}</span>
        <span>{t('off.eff')}</span>
        <span>{Math.round(rep.efficiency * 100)}%</span>
      </div>
      {rep.lostSec > 60 && (
        <p className="small muted">
          {t('off.lost', { cap: loadEconomy().offline.cap_hours })}: {formatDuration(rep.lostSec)}
        </p>
      )}
      <button className="btn primary big" style={{ width: '100%' }} onClick={close}>
        {t('off.ok')}
      </button>
    </Modal>
  );
}

export function RecoveryModal() {
  const code = useStore((s) => s.recoveryCode);
  const set = useStore((s) => s.setRecovery);
  const toast = useStore((s) => s.toast);
  const t = useT();
  if (!code) return null;
  return (
    <Modal title={`🔑 ${t('recovery.title')}`} onClose={() => set(null)}>
      <p>{t('recovery.text')}</p>
      <div className="code">{code}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => toast('📋 Скопировано', 'success'));
          }}
        >
          {t('recovery.copy')}
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={() => set(null)}>
          {t('recovery.ok')}
        </button>
      </div>
    </Modal>
  );
}
