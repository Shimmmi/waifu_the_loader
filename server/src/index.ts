import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Redis } from 'ioredis';
import { buildApp } from './app.js';
import { migrate, registerConfigVersion, sql } from './db.js';
import { env } from './env.js';
import { seedReserve } from './pool.js';
import { LocalDiskStorage } from './storage.js';

async function main(): Promise<void> {
  mkdirSync(env.portraitsDir, { recursive: true });
  const applied = await migrate();
  const configVersion = await registerConfigVersion();
  const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
  const seeded = await seedReserve(storage, resolve(process.cwd(), 'assets', 'portraits', 'base'));

  const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  redis.on('error', (e) => console.error('redis:', e.message));

  const app = await buildApp({ storage, configVersion, redis });
  app.log.info({ applied, configVersion, seeded }, 'startup');
  await app.listen({ port: env.port, host: env.host });

  const shutdown = async () => {
    await app.close();
    redis.disconnect();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
