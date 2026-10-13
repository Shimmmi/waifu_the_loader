import type { AiSettings, Look, GachaHistoryItemDTO, NoticeDTO, PullResponseDTO, Rarity, StateDTO, UserSettings } from '@wl/shared';

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
  assign: (id: string, zone: 'warehouse' | 'clerk' | null) => req<StateDTO>('POST', `/waifu/${id}/assign`, { zone }),
  rename: (id: string, name: string | null) => req<StateDTO>('POST', `/waifu/${id}/rename`, { name }),
  daily: () => req<{ reward: { tickets: number; coins: string }; state: StateDTO }>('POST', '/daily/claim', {}),
  pull: (bannerId: string, count: number, requestId: string) =>
    req<PullResponseDTO>('POST', `/gacha/${bannerId}/pull`, { count, requestId }),
  history: () => req<{ items: GachaHistoryItemDTO[] }>('GET', '/gacha/history'),
  settings: (patch: Partial<UserSettings>) => req<{ settings: UserSettings }>('PATCH', '/settings', patch),
  nickname: (nickname: string) => req<{ ok: true }>('POST', '/profile/nickname', { nickname }),
  newRecovery: () => req<{ recoveryCode: string }>('POST', '/profile/recovery', {}),
  trainingStart: (waifuId: string, type: string, durationMin: number) => req<StateDTO>('POST', '/training/start', { waifuId, type, durationMin }),
  trainingClaim: (id: string) => req<{ notice: NoticeDTO; state: StateDTO }>('POST', `/training/${id}/claim`, {}),
  contractStart: (id: string, team: string[]) => req<StateDTO>('POST', `/contracts/${id}/start`, { team }),
  contractClaim: (id: string) => req<{ notice: NoticeDTO; state: StateDTO }>('POST', `/contracts/${id}/claim`, {}),
  contractDismiss: (id: string) => req<StateDTO>('POST', `/contracts/${id}/dismiss`, {}),
  endShift: () => req<{ seals: number; tickets: number; state: StateDTO }>('POST', '/prestige/end-shift', {}),
  prestigeUpgrade: (id: string) => req<StateDTO>('POST', `/prestige/upgrade/${id}`, {}),
  prestigeAuto: (patch: { buildings?: boolean }) => req<StateDTO>('POST', '/prestige/auto', patch),
  claimQuest: (id: string) => req<StateDTO>('POST', `/quests/${id}/claim`, {}),
  claimEvent: (index: number) => req<StateDTO>('POST', '/events/claim', { index }),
  resolveMini: (id: string, choice: number) => req<StateDTO>('POST', `/events/mini/${id}`, { choice }),
  buyCosmetic: (id: string) => req<StateDTO>('POST', `/shop/buy/${id}`, {}),
  equipCosmetic: (kind: 'frame' | 'title' | 'warehouse' | 'card' | 'summon', id: string | null) => req<StateDTO>('POST', '/shop/equip', { kind, id }),
  regenPortrait: (id: string) => req<StateDTO>('POST', `/waifu/${id}/regen`, {}),
  track: (name: string, props: Record<string, unknown> = {}) => req<{ ok: true }>('POST', '/analytics', { name, props }).catch(() => undefined),
};

// ---------- админка ИИ (ТЗ 10.3) ----------
export interface AiSettingsVersion {
  version: number;
  settings: AiSettings;
  comment: string;
  createdAt: string;
  createdBy: string | null;
}
export interface AiOverview {
  current: AiSettingsVersion;
  keyConfigured: boolean;
  spend: { todayRub: number; monthRub: number; resetAt?: string | null };
  pool: { rarity: Rarity; source: 'ai' | 'procedural'; status: string; n: number }[];
  week: {
    calls: { kind: string; calls: number; failed: number; first_try: number; cost: number }[];
    verdicts: { status: string; n: number }[];
  };
  themes: { theme: string; ok: number; review: number; rejected: number }[];
  funnel?: { name: string; n: number }[];
  archetypes: { id: string; name: string }[];
}
export interface ModelInfo {
  id: string;
  name: string;
  input: string[];
  output: string[];
  pricing: Record<string, string>;
}
export interface AiTestResult {
  ok: boolean;
  stage: string;
  error?: string;
  profile?: { name: string; age: number; rarity: Rarity; archetype: string; bio: string; quote: string; appearance: string; stats: Record<string, number>; talents: { name: string; description: string }[] };
  imagePrompt?: string;
  portraitUrl?: string;
  verdict?: string;
  reasons?: string[];
  moderation?: unknown;
  costRub: number;
  durationMs: number;
  models: { text?: string; image?: string; moderation?: string };
  attempts?: number;
  validationErrors?: string[];
  look?: Look;
}
export interface AiLogItem {
  id: string;
  kind: string;
  purpose: string;
  model: string;
  ok: boolean;
  error: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_rub: number;
  duration_ms: number;
  rarity: Rarity | null;
  attempts: number | null;
  created_at: string;
}
export interface ReviewItem {
  id: string;
  rarity: Rarity;
  archetype: string;
  name: string;
  age: number;
  bio: string;
  quote: string;
  portrait_url: string;
  image_prompt: string | null;
  moderation: { verdict?: string; reasons?: string[]; estimated_min_age?: number; notes?: string } | null;
  gen_cost_rub: number | null;
  created_at: string;
}

export const adminApi = {
  overview: () => req<AiOverview>('GET', '/admin/ai'),
  resetDaily: () => req<{ spend: AiOverview['spend'] }>('POST', '/admin/ai/reset-daily', {}),
  versions: () => req<{ versions: AiSettingsVersion[] }>('GET', '/admin/ai/versions'),
  save: (settings: AiSettings, comment: string) => req<{ version: number }>('PUT', '/admin/ai/settings', { settings, comment }),
  rollback: (version: number) => req<{ version: number }>('POST', '/admin/ai/rollback', { version }),
  models: () => req<{ models: ModelInfo[] }>('GET', '/admin/ai/models'),
  log: (limit = 100) => req<{ items: AiLogItem[] }>('GET', `/admin/ai/log?limit=${limit}`),
  test: (rarity: Rarity, archetype?: string) => req<{ jobId: string }>('POST', '/admin/ai/test', { rarity, archetype }),
  testStatus: (id: string) => req<{ state: string; result: AiTestResult | null; error: string | null }>('GET', `/admin/ai/test/${id}`),
  acceptTest: (id: string) => req<{ poolId: string }>('POST', `/admin/ai/test/${id}/pool`, {}),
  review: (status: 'review' | 'rejected') => req<{ items: ReviewItem[] }>('GET', `/admin/review?status=${status}`),
  decide: (id: string, action: 'approve' | 'reject') => req<{ ok: true }>('POST', `/admin/review/${id}`, { action }),
};
