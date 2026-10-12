import type { GachaHistoryItemDTO, PullResponseDTO, StateDTO, UserSettings } from '@wl/shared';

const BASE = `${import.meta.env.BASE_URL}api`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? `Ошибка ${res.status}`);
  return data as T;
}

export const api = {
  register: (inviteCode: string, nickname: string) =>
    req<{ ok: true; recoveryCode: string }>('POST', '/auth/guest', { inviteCode, nickname, ageConfirmed: true }),
  recover: (code: string) => req<{ ok: true }>('POST', '/auth/recover', { code }),
  logout: () => req<{ ok: true }>('POST', '/auth/logout', {}),
  state: () => req<StateDTO>('GET', '/state'),
  heartbeat: () => req<StateDTO>('POST', '/heartbeat', {}),
  upgrade: (id: string, count: number | 'max') => req<StateDTO>('POST', `/buildings/${id}/upgrade`, { count }),
  levelUp: (id: string, count: number) => req<StateDTO>('POST', `/waifu/${id}/level`, { count }),
  starUp: (id: string) => req<StateDTO>('POST', `/waifu/${id}/star`, {}),
  assign: (id: string, zone: 'warehouse' | null) => req<StateDTO>('POST', `/waifu/${id}/assign`, { zone }),
  rename: (id: string, name: string | null) => req<StateDTO>('POST', `/waifu/${id}/rename`, { name }),
  daily: () => req<{ reward: { tickets: number; coins: string }; state: StateDTO }>('POST', '/daily/claim', {}),
  pull: (bannerId: string, count: number, requestId: string) =>
    req<PullResponseDTO>('POST', `/gacha/${bannerId}/pull`, { count, requestId }),
  history: () => req<{ items: GachaHistoryItemDTO[] }>('GET', '/gacha/history'),
  settings: (patch: Partial<UserSettings>) => req<{ settings: UserSettings }>('PATCH', '/settings', patch),
  nickname: (nickname: string) => req<{ ok: true }>('POST', '/profile/nickname', { nickname }),
  newRecovery: () => req<{ recoveryCode: string }>('POST', '/profile/recovery', {}),
  track: (name: string, props: Record<string, unknown> = {}) => req<{ ok: true }>('POST', '/analytics', { name, props }).catch(() => undefined),
};
