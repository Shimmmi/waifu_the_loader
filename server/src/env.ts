import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Минимальный загрузчик .env (Node 18 не умеет --env-file). Переменные окружения имеют приоритет. */
function loadDotEnv(): void {
  for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || m[1] === undefined) continue;
      const val = (m[2] ?? '').replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
    return;
  }
}
loadDotEnv();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Env ${name} is required`);
  return v;
}

export const env = {
  databaseUrl: req('DATABASE_URL'),
  redisUrl: req('REDIS_URL', 'redis://127.0.0.1:6390'),
  port: Number(process.env.PORT ?? 8040),
  host: process.env.HOST ?? '127.0.0.1',
  basePath: (process.env.BASE_PATH ?? '/waifu_loader').replace(/\/$/, ''),
  cookieSecret: req('COOKIE_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-secret-dev-secret-dev-secret-0000'),
  portraitsDir: resolve(process.env.PORTRAITS_DIR ?? './data/portraits'),
  portraitsPublicUrl: (process.env.PORTRAITS_PUBLIC_URL ?? '/waifu_loader/portraits').replace(/\/$/, ''),
  /** В dev сервер сам раздаёт портреты; в проде это делает Nginx */
  serveStatic: process.env.SERVE_STATIC === '1',
  production: process.env.NODE_ENV === 'production',
  poolTarget: Number(process.env.POOL_TARGET_PER_RARITY ?? 300),
  poolBatch: Number(process.env.POOL_BATCH ?? 25),
  routerai: {
    baseUrl: (process.env.ROUTERAI_BASE_URL || 'https://routerai.ru/api/v1').replace(/\/$/, ''),
    apiKey: process.env.ROUTERAI_API_KEY ?? '',
  },
};

export const QUEUES = { pool: 'waifu-pool', ai: 'waifu-ai', aiTest: 'waifu-ai-test' } as const;
