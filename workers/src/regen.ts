import { archetypeById, loadContent, loadEconomy } from '@wl/shared';
import { getAiSettings } from '../../server/src/ai-store.js';
import { sql } from '../../server/src/db.js';
import { env } from '../../server/src/env.js';
import { refundRegen } from '../../server/src/meta.js';
import { LocalDiskStorage } from '../../server/src/storage.js';
import { postprocess } from './ai-pipeline.js';
import { RouterAiClient, RouterAiProvider } from './routerai.js';

/** Один новый портрет для уже выданной waifu. Файл свой, сток не перезаписываем. */
export async function regenPortrait(instanceId: string, log: (m: string) => void): Promise<void> {
  const [job] = await sql<{ status: string }[]>`SELECT status FROM portrait_regens WHERE instance_id = ${instanceId}`;
  if (!job || job.status !== 'pending') return;
  try {
    const [row] = await sql<{ pool_id: string; rarity: 'N' | 'R' | 'SR' | 'SSR' | 'UR'; archetype: string; appearance: string }[]>`
      SELECT i.pool_id, p.rarity, p.archetype, p.appearance
      FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.id = ${instanceId}`;
    if (!row) throw new Error('нет waifu');
    const settings = (await getAiSettings()).settings;
    const content = loadContent();
    const arch = archetypeById(content, row.archetype);
    const provider = new RouterAiProvider(new RouterAiClient(env.routerai), settings, content, loadEconomy());
    const prompt = arch?.traits ?? row.appearance;
    const img = await provider.generatePortrait(
      { rarity: row.rarity, imagePrompt: prompt, seed: Date.now() % 1_000_000_000 },
      { purpose: 'test', rarity: row.rarity, logIds: [], log },
    );
    const pic = await postprocess(img.value);
    const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
    const key = `regen/${instanceId}`;
    const portraitUrl = await storage.put(`${key}.webp`, pic.image);
    const thumbUrl = await storage.put(`${key}_thumb.webp`, pic.thumb);
    await sql`UPDATE waifu_pool SET portrait_url = ${portraitUrl}, thumb_url = ${thumbUrl} WHERE id = ${row.pool_id}`;
    await sql`UPDATE portrait_regens SET status = 'done' WHERE instance_id = ${instanceId} AND status = 'pending'`;
    log(`regen ${instanceId} ${img.costRub.toFixed(2)}₽`);
  } catch (e) {
    log(`regen ${instanceId} failed: ${(e as Error).message}`);
    await refundRegen(instanceId);
  }
}
