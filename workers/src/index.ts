import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from '../../server/src/db.js';
import { env, QUEUES } from '../../server/src/env.js';
import { regenPortrait } from './regen.js';
import { makeAiRefill, makeAiTest, makeRefill } from './setup.js';

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
const log = (m: string) => console.log(new Date().toISOString(), m);
const refill = makeRefill(log);
const aiRefill = makeAiRefill(log);
const aiTest = makeAiTest(log);

const jobOpts = { removeOnComplete: 50, removeOnFail: 50 };
const poolQueue = new Queue(QUEUES.pool, { connection });
await poolQueue.upsertJobScheduler('refill', { every: 60_000 }, { name: 'refill', opts: jobOpts });
const aiQueue = new Queue(QUEUES.ai, { connection });
await aiQueue.upsertJobScheduler('ai-refill', { every: 120_000 }, { name: 'ai-refill', opts: jobOpts });

const workers = [
  new Worker(
    QUEUES.pool,
    async () => {
      const r = await refill();
      log(`refill done: created=${JSON.stringify(r.created)} rejected=${r.rejected} ready=${JSON.stringify(r.ready)}`);
      return r;
    },
    { connection, concurrency: 1 },
  ),
  // ИИ отдельной очередью: долгие вызовы RouterAI не тормозят процедурное пополнение
  new Worker(
    QUEUES.ai,
    async (job) => {
      if (job.name === 'regen') {
        await regenPortrait((job.data as { instanceId: string }).instanceId, log);
        return;
      }
      const r = await aiRefill();
      if (r.stopped || r.failed || Object.keys(r.created).length || r.review || r.rejected)
        log(`ai refill: created=${JSON.stringify(r.created)} review=${r.review} rejected=${r.rejected} failed=${r.failed} cost=${r.costRub.toFixed(2)}₽${r.stopped ? ` stopped: ${r.stopped}` : ''}`);
      return r;
    },
    { connection, concurrency: 1, lockDuration: 15 * 60_000 },
  ),
  new Worker(QUEUES.aiTest, async (job) => aiTest(job.data as { rarity?: string; archetype?: string }), { connection, concurrency: 1, lockDuration: 10 * 60_000 }),
];
for (const w of workers) w.on('failed', (job, err) => log(`${w.name} job ${job?.name} failed: ${err.message}`));
log('pool workers started');

const shutdown = async () => {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([poolQueue.close(), aiQueue.close()]);
  connection.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
