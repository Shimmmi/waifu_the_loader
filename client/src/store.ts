import { create } from 'zustand';
import { censor, D, DEFAULT_SETTINGS, loadContent, pickLine, type Decimal, type NoticeDTO, type OfflineReportDTO, type StateDTO, type UserSettings } from '@wl/shared';
import { api, ApiError } from './api';

export type Screen = 'warehouse' | 'buildings' | 'collection' | 'gacha' | 'training' | 'contracts' | 'prestige' | 'events' | 'achievements' | 'shop' | 'profile' | 'admin';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

interface Live {
  cargo: Decimal;
  cargoTotal: Decimal;
  coins: Decimal;
  protein: Decimal;
}

interface Store {
  auth: 'unknown' | 'guest' | 'in';
  state: StateDTO | null;
  /** performance.now() в момент получения state — от него интерполируем */
  receivedAt: number;
  screen: Screen;
  toasts: Toast[];
  offlineReport: OfflineReportDTO | null;
  recoveryCode: string | null;
  busy: boolean;
  settings: UserSettings;

  setScreen(s: Screen): void;
  toast(text: string, kind?: Toast['kind']): void;
  /** Итог тренировки/контракта: сводка + реплика из flavor.m4 */
  notify(n: NoticeDTO): void;
  dropToast(id: number): void;
  apply(s: StateDTO): void;
  load(): Promise<void>;
  /** Обёртка над действием: блокирует повторный клик, показывает ошибку */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  closeOffline(): void;
  setRecovery(code: string | null): void;
  patchSettings(p: Partial<UserSettings>): Promise<void>;
  logout(): Promise<void>;
}

let toastId = 0;

export const useStore = create<Store>((set, get) => ({
  auth: 'unknown',
  state: null,
  receivedAt: 0,
  screen: 'warehouse',
  toasts: [],
  offlineReport: null,
  recoveryCode: null,
  busy: false,
  settings: DEFAULT_SETTINGS,

  setScreen: (screen) => set({ screen }),
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => get().dropToast(id), kind === 'error' ? 5000 : 3500);
  },
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  notify: (n) => {
    const f = loadContent().flavorM4;
    const lines =
      n.kind === 'training'
        ? n.outcome === 'fail'
          ? f.training_fail
          : n.outcome === 'great'
            ? f.training_great
            : f.training_success
        : n.kind === 'contract'
          ? n.outcome === 'contract_success'
            ? f.contract_success
            : f.contract_partial
          : null;
    const swear = get().settings.swear;
    const line = lines ? pickLine(lines, swear, n.vars) : '';
    const text = line ? `${n.text}\n«${line}»` : n.text;
    get().toast(swear === 0 ? censor(text) : text, n.outcome === 'fail' || n.outcome === 'contract_partial' ? 'info' : 'success');
  },

  apply: (s) => {
    set({ state: s, receivedAt: performance.now(), auth: 'in', settings: s.user.settings });
    if (s.offlineReport) set({ offlineReport: s.offlineReport });
    if (s.milestoneTickets) get().toast(`Веха груза! +${s.milestoneTickets} 🎟`, 'success');
    for (const n of s.notices ?? []) get().notify(n);
  },

  load: async () => {
    try {
      get().apply(await api.state());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ auth: 'guest', state: null });
      else {
        get().toast((e as Error).message, 'error');
        if (get().auth === 'unknown') set({ auth: 'guest' });
      }
    }
  },

  run: async (fn) => {
    if (get().busy) return undefined;
    set({ busy: true });
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ auth: 'guest', state: null });
      get().toast((e as Error).message, 'error');
      return undefined;
    } finally {
      set({ busy: false });
    }
  },

  closeOffline: () => set({ offlineReport: null }),
  setRecovery: (recoveryCode) => set({ recoveryCode }),

  patchSettings: async (p) => {
    const prev = get().settings;
    set({ settings: { ...prev, ...p } });
    try {
      const r = await api.settings(p);
      set({ settings: r.settings });
    } catch (e) {
      set({ settings: prev });
      get().toast((e as Error).message, 'error');
    }
  },

  logout: async () => {
    await api.logout().catch(() => undefined);
    set({ auth: 'guest', state: null, screen: 'warehouse' });
  },
}));

/** Текущие значения ресурсов с интерполяцией между серверными тиками (ТЗ 11: 10 тиков/с на UI). */
export function liveResources(s: StateDTO, receivedAt: number, now: number): Live {
  const dt = Math.max(0, (now - receivedAt) / 1000);
  const cargoRate = D(s.rates.cargoPerSec);
  return {
    cargo: D(s.resources.cargo).add(cargoRate.mul(dt)),
    cargoTotal: D(s.resources.cargoTotal).add(cargoRate.mul(dt)),
    coins: D(s.resources.coins).add(D(s.rates.coinsPerSec).mul(dt)),
    protein: D(s.resources.protein).add(D(s.rates.proteinPerSec).mul(dt)),
  };
}
