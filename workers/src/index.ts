import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from '../../server/src/db.js';
import { env } from '../../server/src/env.js';
import { makeRefill } from './setup.js';

const QUEUE = 'waifu-pool';
const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
const log = (m: string) => console.log(new Date().toISOString(), m);
const refill = makeRefill(log);

const queue = new Queue(QUEUE, { connection });
await queue.upsertJobScheduler('refill', { every: 60_000 }, { name: 'refill', opts: { removeOnComplete: 50, removeOnFail: 50 } });

const worker = new Worker(
  QUEUE,
  async () => {
    const r = await refill();
    log(`refill done: created=${JSON.stringify(r.created)} rejected=${r.rejected} ready=${JSON.stringify(r.ready)}`);
    return r;
  },
  { connection, concurrency: 1 },
);
worker.on('failed', (_job, err) => log(`refill failed: ${err.message}`));
log('pool worker started');

const shutdown = async () => {
  await worker.close();
  await queue.close();
  connection.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
