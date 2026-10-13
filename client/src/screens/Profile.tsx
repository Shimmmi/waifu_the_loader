import { useState } from 'react';
import { loadMeta, type UserSettings } from '@wl/shared';
import { api } from '../api';
import { useFmt, useLive } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore } from '../store';

function Seg<K extends keyof UserSettings>({ k, options }: { k: K; options: UserSettings[K][] }) {
  const settings = useStore((s) => s.settings);
  const patch = useStore((s) => s.patchSettings);
  const t = useT();
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o)} className={settings[k] === o ? 'on' : ''} onClick={() => void patch({ [k]: o } as Partial<UserSettings>)}>
          {t(`p.${String(k)}.${String(o)}` as TKey)}
        </button>
      ))}
    </div>
  );
}

export function Profile() {
  const state = useStore((s) => s.state)!;
  const settings = useStore((s) => s.settings);
  const patch = useStore((s) => s.patchSettings);
  const run = useStore((s) => s.run);
  const load = useStore((s) => s.load);
  const toast = useStore((s) => s.toast);
  const setRecovery = useStore((s) => s.setRecovery);
  const logout = useStore((s) => s.logout);
  const live = useLive();
  const fmt = useFmt();
  const t = useT();
  const [nick, setNick] = useState(state.user.nickname);

  return (
    <div className="grid2">
      <div className="panel taped">
        <h3>👷 {state.user.nickname}</h3>
        {state.meta.loadout.title && <div className="tag">{loadMeta().cosmetics.find((c) => c.id === state.meta.loadout.title)?.name}</div>}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.nickname(nick);
              await load();
              toast('✅', 'success');
            });
          }}
        >
          <input className="input" style={{ flex: 1 }} value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
          <button className="btn">{t('p.save')}</button>
        </form>
        <h3 style={{ marginTop: 16 }}>{t('p.stats')}</h3>
        <div className="kv">
          <span>{t('p.totalCargo')}</span>
          <span>
            {live ? fmt(live.cargoTotal) : '…'} {t('unit.kg')}
          </span>
          <span>{t('nav.collection')}</span>
          <span>{state.waifu.length}</span>
          <span>{t('res.tickets')}</span>
          <span>{state.resources.tickets}</span>
          <span>{t('res.shards')}</span>
          <span>{state.resources.shards}</span>
          <span>{t('res.tokens')}</span>
          <span>{state.resources.tokens}</span>
        </div>
        <h3 style={{ marginTop: 16 }}>🔑 {t('p.recovery')}</h3>
        <p className="small muted">{t('p.recoveryHint')}</p>
        <button
          className="btn"
          onClick={() =>
            void run(async () => {
              setRecovery((await api.newRecovery()).recoveryCode);
            })
          }
        >
          {t('p.recoveryNew')}
        </button>
        <div className="row" style={{ marginTop: 16 }}>
          <span className="small muted">
            {t('p.version')}: {state.configVersion}
          </span>
          <span className="spacer" />
          <button className="btn danger" onClick={() => void logout()}>
            {t('p.logout')}
          </button>
        </div>
      </div>

      <div className="panel taped">
        <h3>{t('p.settings')}</h3>
        <div className="field">
          <label>{t('p.theme')}</label>
          <Seg k="theme" options={['dark', 'light', 'system']} />
        </div>
        <div className="field">
          <label>{t('p.swear')}</label>
          <Seg k="swear" options={[0, 1, 2]} />
        </div>
        <div className="field">
          <label>{t('p.notation')}</label>
          <Seg k="notation" options={['letters', 'scientific']} />
        </div>
        <div className="field">
          <label>{t('p.chatter')}</label>
          <Seg k="chatter" options={['off', 'rare', 'normal', 'often']} />
        </div>
        <div className="field">
          <label>{t('p.lang')}</label>
          <div className="seg">
            {(['ru', 'en'] as const).map((l) => (
              <button key={l} className={settings.lang === l ? 'on' : ''} onClick={() => void patch({ lang: l })}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <label className="check field">
          <input type="checkbox" checked={settings.skipGachaAnim} onChange={(e) => void patch({ skipGachaAnim: e.target.checked })} />
          <span>{t('p.skipAnim')}</span>
        </label>
      </div>
    </div>
  );
}
