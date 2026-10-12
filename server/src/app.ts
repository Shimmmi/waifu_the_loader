import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { z } from 'zod';
import type { PullResponseDTO } from '@wl/shared';
import * as actions from './actions.js';
import { registerAdmin } from './admin.js';
import { loginWithRecovery, logout, readToken, registerGuest, requireUser, rotateRecovery, setSessionCookie, SESSION_COOKIE } from './auth.js';
import { sql } from './db.js';
import { env } from './env.js';
import { history, pull } from './gacha.js';
import * as m4 from './management.js';
import { GameError, snapshot } from './player.js';
import { poolStats } from './pool.js';
import type { Storage } from './storage.js';

export async function buildApp(opts: { storage: Storage; configVersion: string; redis?: Redis }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.production ? 'info' : 'debug' },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  await app.register(cookie, { secret: env.cookieSecret });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: 'bad_request', message: err.issues.map((i) => i.message).join('; ') });
    if ((err as { statusCode?: number }).statusCode === 429) return reply.status(429).send({ error: 'rate_limited', message: 'Помедленнее, бригадир. Слишком много запросов' });
    req.log.error(err);
    return reply.status(500).send({ error: 'internal', message: 'Что-то упало на складе. Уже разгребаем' });
  });

  if (env.serveStatic) {
    const fstatic = (await import('@fastify/static')).default;
    await app.register(fstatic, { root: env.portraitsDir, prefix: `${env.basePath}/portraits/`, decorateReply: false });
  }

  await app.register(
    async (api) => {
      // Защита от автокликеров и перебора (ТЗ 15)
      await api.register(rateLimit, {
        max: 240,
        timeWindow: '1 minute',
        redis: opts.redis,
        nameSpace: 'wl-rl:',
        keyGenerator: (req) => readToken(req) ?? req.ip,
      });

      const { storage, configVersion } = opts;
      const state = async (userId: string, extras: Parameters<typeof snapshot>[1] = {}) => snapshot(userId, extras, configVersion);

      api.get('/health', async () => ({ ok: true, version: configVersion, pool: await poolStats() }));

      // ---------- auth ----------
      api.post('/auth/guest', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
        const body = z
          .object({ inviteCode: z.string().min(1).max(64), nickname: z.string().max(64), ageConfirmed: z.literal(true) })
          .parse(req.body);
        const { token, recoveryCode } = await registerGuest(body, storage);
        setSessionCookie(reply, token);
        return { ok: true, recoveryCode };
      });

      api.post('/auth/recover', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
        const { code } = z.object({ code: z.string().min(5).max(64) }).parse(req.body);
        setSessionCookie(reply, await loginWithRecovery(code));
        return { ok: true };
      });

      api.post('/auth/logout', async (req, reply) => {
        await logout(readToken(req));
        reply.clearCookie(SESSION_COOKIE, { path: env.basePath + '/' });
        return { ok: true };
      });

      // ---------- игра (только для авторизованных) ----------
      await api.register(async (game) => {
        game.addHook('preHandler', requireUser);

        game.get('/state', async (req) => state(req.userId, await actions.tick(req.userId)));
        game.post('/heartbeat', async (req) => state(req.userId, await actions.tick(req.userId)));

        game.post('/buildings/:id/upgrade', async (req) => {
          const { id } = z.object({ id: z.string().max(32) }).parse(req.params);
          const { count } = z.object({ count: z.union([z.number().int().min(1).max(1000), z.literal('max')]).default(1) }).parse(req.body ?? {});
          return state(req.userId, await actions.upgradeBuilding(req.userId, id, count));
        });

        const waifuId = z.object({ id: z.string().max(40) });
        game.post('/waifu/:id/level', async (req) => {
          const { id } = waifuId.parse(req.params);
          const { count } = z.object({ count: z.number().int().min(1).max(100).default(1) }).parse(req.body ?? {});
          return state(req.userId, await actions.levelUp(req.userId, id, count));
        });
        game.post('/waifu/:id/star', async (req) => {
          const { id } = waifuId.parse(req.params);
          return state(req.userId, await actions.starUp(req.userId, id));
        });
        game.post('/waifu/:id/assign', async (req) => {
          const { id } = waifuId.parse(req.params);
          const { zone } = z.object({ zone: z.enum(['warehouse']).nullable() }).parse(req.body);
          return state(req.userId, await actions.assign(req.userId, id, zone));
        });
        game.post('/waifu/:id/rename', async (req) => {
          const { id } = waifuId.parse(req.params);
          const { name } = z.object({ name: z.string().max(80).nullable() }).parse(req.body);
          await actions.rename(req.userId, id, name);
          return state(req.userId);
        });

        const uuidParam = z.object({ id: z.string().uuid() });
        game.post('/training/start', async (req) => {
          const b = z.object({ waifuId: z.string().uuid(), type: z.string().max(32), durationMin: z.number().int().positive() }).parse(req.body);
          return state(req.userId, await m4.startTraining(req.userId, b.waifuId, b.type, b.durationMin));
        });
        game.post('/training/:id/claim', async (req) => {
          const { id } = uuidParam.parse(req.params);
          const r = await m4.claimTraining(req.userId, id);
          return { notice: r.notice, state: await state(req.userId, r) };
        });
        game.post('/contracts/:id/start', async (req) => {
          const { id } = uuidParam.parse(req.params);
          const { team } = z.object({ team: z.array(z.string().uuid()).min(1).max(5) }).parse(req.body);
          return state(req.userId, await m4.startContract(req.userId, id, team));
        });
        game.post('/contracts/:id/claim', async (req) => {
          const { id } = uuidParam.parse(req.params);
          const r = await m4.claimContract(req.userId, id);
          return { notice: r.notice, state: await state(req.userId, r) };
        });
        game.post('/contracts/:id/dismiss', async (req) => {
          const { id } = uuidParam.parse(req.params);
          return state(req.userId, await m4.dismissContract(req.userId, id));
        });
        game.post('/prestige/end-shift', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
          const r = await m4.endShift(req.userId);
          return { seals: r.seals, tickets: r.tickets, state: await state(req.userId, r) };
        });
        game.post('/prestige/upgrade/:id', async (req) => {
          const { id } = z.object({ id: z.string().max(32) }).parse(req.params);
          return state(req.userId, await m4.buyUpgrade(req.userId, id));
        });
        game.post('/prestige/auto', async (req) => {
          const patch = z.object({ buildings: z.boolean() }).partial().parse(req.body);
          return state(req.userId, await m4.setAutomation(req.userId, patch));
        });

        game.post('/daily/claim', async (req) => {
          const r = await actions.claimDaily(req.userId);
          return { reward: { tickets: r.tickets, coins: r.coins }, state: await state(req.userId, r) };
        });

        game.post('/gacha/:bannerId/pull', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req): Promise<PullResponseDTO> => {
          const { bannerId } = z.object({ bannerId: z.string().max(64) }).parse(req.params);
          const body = z.object({ count: z.number().int(), requestId: z.string().uuid() }).parse(req.body);
          const r = await pull(req.userId, bannerId, body.count, body.requestId, storage);
          return { bannerId, requestId: body.requestId, items: r.items, state: await state(req.userId, r.adv) };
        });
        game.get('/gacha/history', async (req) => ({ items: await history(req.userId) }));

        game.patch('/settings', async (req) => {
          const patch = z
            .object({
              swear: z.union([z.literal(0), z.literal(1), z.literal(2)]),
              theme: z.enum(['dark', 'light', 'system']),
              notation: z.enum(['letters', 'scientific']),
              lang: z.enum(['ru', 'en']),
              skipGachaAnim: z.boolean(),
              chatter: z.enum(['off', 'rare', 'normal', 'often']),
            })
            .partial()
            .parse(req.body);
          return { settings: await actions.updateSettings(req.userId, patch) };
        });
        game.post('/profile/nickname', async (req) => {
          const { nickname } = z.object({ nickname: z.string().max(64) }).parse(req.body);
          await actions.setNickname(req.userId, nickname);
          return { ok: true };
        });
        game.post('/profile/recovery', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req) => ({
          recoveryCode: await rotateRecovery(req.userId),
        }));
        game.post('/analytics', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
          const { name, props } = z.object({ name: z.string().regex(/^[a-z_]{2,40}$/), props: z.record(z.unknown()).default({}) }).parse(req.body);
          await sql`INSERT INTO analytics_events (user_id, name, props) VALUES (${req.userId}, ${name}, ${sql.json(props as never)})`;
          return { ok: true };
        });
      });

      await registerAdmin(api, { url: env.redisUrl });
    },
    { prefix: `${env.basePath}/api` },
  );

  return app;
}
