import { useEffect } from 'react';
import { api } from './api';
import { OfflineModal, RecoveryModal } from './components/Modals';
import { Shell } from './components/Shell';
import { Toasts } from './components/ui';
import { Buildings } from './screens/Buildings';
import { Collection } from './screens/Collection';
import { Gacha } from './screens/Gacha';
import { Login } from './screens/Login';
import { Profile } from './screens/Profile';
import { Warehouse } from './screens/Warehouse';
import { useStore } from './store';

const HEARTBEAT_MS = 20_000;

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const set = () => {
      const t = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = t;
    };
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, [theme]);
}

/** Серверный тик: heartbeat, пока вкладка видима; при возвращении — полный state (с офлайн-отчётом). */
function useHeartbeat(enabled: boolean) {
  const apply = useStore((s) => s.apply);
  const load = useStore((s) => s.load);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (!document.hidden && !useStore.getState().busy) api.heartbeat().then(apply).catch(() => undefined);
      }, HEARTBEAT_MS);
    };
    const onVis = () => {
      if (!document.hidden) {
        void load();
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, apply, load]);
}

export function App() {
  const auth = useStore((s) => s.auth);
  const screen = useStore((s) => s.screen);
  const load = useStore((s) => s.load);
  useTheme();
  useHeartbeat(auth === 'in');

  useEffect(() => {
    void load();
  }, [load]);

  if (auth === 'unknown') return <div className="login"><div className="counter-big">📦…</div></div>;
  if (auth === 'guest')
    return (
      <>
        <Login />
        <Toasts />
      </>
    );

  return (
    <>
      <Shell>
        {screen === 'warehouse' && <Warehouse />}
        {screen === 'buildings' && <Buildings />}
        {screen === 'collection' && <Collection />}
        {screen === 'gacha' && <Gacha />}
        {screen === 'profile' && <Profile />}
      </Shell>
      <OfflineModal />
      <RecoveryModal />
      <Toasts />
    </>
  );
}
