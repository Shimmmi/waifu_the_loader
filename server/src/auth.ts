import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { findForbidden, loadEconomy } from '@wl/shared';
import { sql } from './db.js';
import { env } from './env.js';
import { GameError } from './player.js';
import { grantWaifu, pickFromPool } from './pool.js';
import type { Storage } from './storage.js';

export const SESSION_COOKIE = 'wl_session';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: env.basePath + '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.production,
    maxAge: 60 * 60 * 24 * 365,
    signed: true,
  });
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO sessions (token_hash, user_id) VALUES (${sha(token)}, ${userId})`;
  return token;
}

/** Код восстановления: показывается игроку, хранится только хэш. */
export function newRecoveryCode(): string {
  const raw = randomBytes(15).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return raw.match(/.{1,5}/g)!.join('-');
}

export function validateNickname(nick: string): string {
  const n = nick.trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 24) throw new GameError('bad_nick', 'Ник: от 2 до 24 символов');
  const bad = findForbidden(n);
  if (bad) throw new GameError('bad_nick', `Так нельзя: «${bad}»`);
  return n;
}

export async function registerGuest(
  input: { inviteCode: string; nickname: string; ageConfirmed: boolean },
  storage: Storage,
): Promise<{ token: string; recoveryCode: string }> {
  if (!input.ageConfirmed) throw new GameError('age', 'Игра только для взрослых (18+)');
  const nickname = validateNickname(input.nickname);
  const code = input.inviteCode.trim().toUpperCase();
  const cfg = loadEconomy();
  const recoveryCode = newRecoveryCode();

  const userId = await sql.begin(async (tx) => {
    const [inv] = await tx<{ uses: number; max_uses: number }[]>`SELECT uses, max_uses FROM invite_codes WHERE code = ${code} FOR UPDATE`;
    if (!inv || inv.uses >= inv.max_uses) throw new GameError('bad_invite', 'Инвайт-код недействителен или закончился');
    await tx`UPDATE invite_codes SET uses = uses + 1 WHERE code = ${code}`;
    const [u] = await tx<{ id: string }[]>`
      INSERT INTO users (nickname, invite_code, age_confirmed_at, recovery_hash)
      VALUES (${nickname}, ${code}, now(), ${sha(recoveryCode)}) RETURNING id`;
    if (!u) throw new Error('user insert failed');
    await tx`INSERT INTO player_state (user_id, coins, tickets) VALUES (${u.id}, ${String(cfg.start.coins)}, ${cfg.start.tickets})`;
    for (const b of cfg.buildings) {
      await tx`INSERT INTO buildings_state (user_id, building_id, level) VALUES (${u.id}, ${b.id}, ${b.start_level})`;
    }
    // Стартовая waifu: N того же архетипа, что и заготовленная стартовая
    const starter = cfg.start.starter_reserve_id.replace(/^reserve_/, '');
    const row = await pickFromPool(tx, 'N', starter, storage);
    await grantWaifu(tx, u.id, row, 'warehouse');
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason) VALUES (${u.id}, 'tickets', ${String(cfg.start.tickets)}, 'start')`;
    await tx`INSERT INTO analytics_events (user_id, name) VALUES (${u.id}, 'registration')`;
    return u.id;
  });
  return { token: await createSession(userId), recoveryCode };
}

export async function loginWithRecovery(code: string): Promise<string> {
  const clean = code.trim().toUpperCase();
  const [u] = await sql<{ id: string }[]>`SELECT id FROM users WHERE recovery_hash = ${sha(clean)}`;
  if (!u) throw new GameError('bad_recovery', 'Код восстановления не подошёл', 401);
  return createSession(u.id);
}

export async function rotateRecovery(userId: string): Promise<string> {
  const code = newRecoveryCode();
  await sql`UPDATE users SET recovery_hash = ${sha(code)} WHERE id = ${userId}`;
  return code;
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${sha(token)}`;
}

export function readToken(req: FastifyRequest): string | undefined {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return undefined;
  const u = req.unsignCookie(raw);
  return u.valid && u.value ? u.value : undefined;
}

export async function requireUser(req: FastifyRequest): Promise<void> {
  const token = readToken(req);
  if (!token) throw new GameError('unauthorized', 'Нужно войти', 401);
  const [s] = await sql<{ user_id: string; last_seen: Date }[]>`SELECT user_id, last_seen FROM sessions WHERE token_hash = ${sha(token)}`;
  if (!s) throw new GameError('unauthorized', 'Сессия истекла', 401);
  if (Date.now() - s.last_seen.getTime() > 3600_000) {
    await sql`UPDATE sessions SET last_seen = now() WHERE token_hash = ${sha(token)}`;
  }
  req.userId = s.user_id;
}
