import { archetypeById, loadContent, loadEconomy, RaritySchema, type Rarity } from '@wl/shared';
import { getAiSettings } from '../../server/src/ai-store.js';
import { env } from '../../server/src/env.js';
import { LocalDiskStorage } from '../../server/src/storage.js';
import { generateAiWaifu, takenAiNames, type AiWaifuResult } from './ai-pipeline.js';
import { refillAi } from './ai-refill.js';
import { ProceduralTextProvider, StockImageProvider } from './providers.js';
import { refillPool } from './refill.js';
import { RouterAiClient, RouterAiProvider } from './routerai.js';

const storage = () => new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);

export function makeRefill(log: (m: string) => void) {
  const cfg = loadEconomy();
  const st = storage();
  const text = new ProceduralTextProvider(loadContent(), cfg);
  const image = new StockImageProvider((key) => st.get(key));
  return async () => {
    const s = (await getAiSettings()).settings;
    const aiRarities = s.pool.ai_rarities.filter((r) => r !== 'N' && r !== 'R');
    const ai = s.enabled && env.routerai.apiKey ? { rarities: aiRarities, reserve: s.pool.procedural_reserve } : undefined;
    return refillPool({ text, image, storage: st, cfg, target: env.poolTarget, batch: env.poolBatch, ai, log });
  };
}

export function makeAiRefill(log: (m: string) => void) {
  const st = storage();
  return async () => refillAi({ settings: (await getAiSettings()).settings, routerai: env.routerai, storage: st, log });
}

/** Кнопка «Тест» в админке: одна пробная waifu текущими (или переданными) настройками, в пул не попадает. */
export function makeAiTest(log: (m: string) => void) {
  const st = storage();
  return async (data: { rarity?: string; archetype?: string }): Promise<AiWaifuResult> => {
    const s = (await getAiSettings()).settings;
    const content = loadContent();
    const rarity: Rarity = RaritySchema.catch('SSR').parse(data.rarity);
    if (rarity === 'N' || rarity === 'R') throw new Error('N и R рисуются из стока, не через RouterAI');
    const archetype = data.archetype ? archetypeById(content, data.archetype) : undefined;
    const provider = new RouterAiProvider(new RouterAiClient(env.routerai), s, content, loadEconomy());
    return generateAiWaifu({ provider, storage: st, content, rarity, archetype, purpose: 'test', takenNames: await takenAiNames(), log });
  };
}
