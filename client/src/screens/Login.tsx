import { useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import { useStore } from '../store';

const COLLAGE = ['fridge_quiet', 'sleepy_piano', 'shout_commander', 'gym_philosopher', 'tape_maniac'];

export function Login() {
  const t = useT();
  const run = useStore((s) => s.run);
  const load = useStore((s) => s.load);
  const setRecovery = useStore((s) => s.setRecovery);
  const busy = useStore((s) => s.busy);
  const [mode, setMode] = useState<'new' | 'recover'>('new');
  const [invite, setInvite] = useState(() => new URLSearchParams(location.search).get('invite') ?? '');
  const [nick, setNick] = useState('');
  const [age, setAge] = useState(false);
  const [code, setCode] = useState('');

  const register = () =>
    run(async () => {
      const r = await api.register(invite, nick);
      setRecovery(r.recoveryCode);
      await load();
    });
  const recover = () =>
    run(async () => {
      await api.recover(code);
      await load();
    });

  return (
    <div className="login">
      <div className="panel taped">
        <div className="collage">
          {COLLAGE.map((a) => (
            <img key={a} src={`${import.meta.env.BASE_URL}portraits/base/${a}_thumb.webp`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ))}
        </div>
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.subtitle')}</p>
        {mode === 'new' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void register();
            }}
          >
            <div className="field">
              <label>{t('login.invite')}</label>
              <input className="input" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="GRUZ-XXXXXXXX" required autoFocus />
            </div>
            <div className="field">
              <label>{t('login.nickname')}</label>
              <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} minLength={2} maxLength={24} required />
            </div>
            <label className="check field">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
              <span>{t('login.age')}</span>
            </label>
            <button className="btn primary big" style={{ width: '100%' }} disabled={!age || busy}>
              {t('login.start')}
            </button>
            <p className="small" style={{ textAlign: 'center' }}>
              <a href="#" onClick={(e) => (e.preventDefault(), setMode('recover'))}>
                {t('login.haveCode')}
              </a>
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void recover();
            }}
          >
            <div className="field">
              <label>{t('login.recoveryCode')}</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required autoFocus />
            </div>
            <button className="btn primary big" style={{ width: '100%' }} disabled={busy}>
              {t('login.recover')}
            </button>
            <p className="small" style={{ textAlign: 'center' }}>
              <a href="#" onClick={(e) => (e.preventDefault(), setMode('new'))}>
                {t('login.newPlayer')}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
