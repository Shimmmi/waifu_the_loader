import { loadContent, loadEconomy } from '@wl/shared';
import { env } from '../../server/src/env.js';
import { basePortraitKey } from '../../server/src/pool.js';
import { LocalDiskStorage } from '../../server/src/storage.js';
import { ProceduralTextProvider, VariantImageProvider } from './providers.js';
import { refillPool } from './refill.js';

export function makeRefill(log: (m: string) => void) {
  const cfg = loadEconomy();
  const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
  const text = new ProceduralTextProvider(loadContent(), cfg);
  const image = new VariantImageProvider((a) => storage.get(basePortraitKey(a)));
  return () => refillPool({ text, image, storage, cfg, target: env.poolTarget, batch: env.poolBatch, log });
}
