import { loadContent, loadEconomy, type AiSettings, type Rarity } from '@wl/shared';
import { aiSpend } from '../../server/src/ai-store.js';
import { sql } from '../../server/src/db.js';
import type { Storage } from '../../server/src/storage.js';
import { generateAiWaifu, takenAiNames } from './ai-pipeline.js';
import { RouterAiClient, RouterAiProvider, type RouterAiConfig } from './routerai.js';

export interface AiRefillReport {
  created: Partial<Record<Rarity, number>>;
  review: number;
  rejected: number;
  failed: number;
  costRub: number;
  stopped?: string;
}

/** ИИ-пополнение: по ai_batch за прогон, редкость с наибольшим дефицитом — первой. */
export async function refillAi(opts: { settings: AiSettings; routerai: RouterAiConfig; storage: Storage; log: (m: string) => void }): Promise<AiRefillReport> {
  const s = opts.settings;
  const report: AiRefillReport = { created: {}, review: 0, rejected: 0, failed: 0, costRub: 0 };
  if (!s.enabled) return { ...report, stopped: 'ИИ выключен в настройках' };
  if (!opts.routerai.apiKey) return { ...report, stopped: 'нет ROUTERAI_API_KEY' };
  const spend = await aiSpend();
  if (spend.todayRub >= s.limits.daily_rub || spend.monthRub >= s.limits.monthly_rub) return { ...report, stopped: 'лимит расходов' };

  const content = loadContent();
  const provider = new RouterAiProvider(new RouterAiClient(opts.routerai), s, content, loadEconomy());
  const takenNames = await takenAiNames();
  const rows = await sql<{ rarity: Rarity; n: number }[]>`
    SELECT rarity, count(*)::int AS n FROM waifu_pool WHERE status = 'ready' AND source = 'ai' GROUP BY rarity`;
  const ready = new Map(rows.map((r) => [r.rarity, r.n]));

  let failedInRow = 0;
  for (let i = 0; i < s.pool.ai_batch; i++) {
    const rarity = [...s.pool.ai_rarities]
      .map((r) => ({ r, deficit: s.pool.ai_target - (ready.get(r) ?? 0) }))
      .filter((x) => x.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)[0]?.r;
    if (!rarity) break;
    const r = await generateAiWaifu({ provider, storage: opts.storage, content, rarity, purpose: 'pool', takenNames, log: opts.log });
    report.costRub += r.costRub;
    if (r.budgetExceeded) {
      report.stopped = 'лимит расходов';
      break;
    }
    if (!r.ok) {
      report.failed++;
      opts.log(`ai ${rarity} failed at ${r.stage}: ${r.error}`);
      // Провайдер лежит — не жжём попытки, ждём следующего прогона
      if (++failedInRow >= 3) {
        report.stopped = 'три ошибки подряд';
        break;
      }
      continue;
    }
    failedInRow = 0;
    if (r.verdict === 'ready') {
      report.created[rarity] = (report.created[rarity] ?? 0) + 1;
      ready.set(rarity, (ready.get(rarity) ?? 0) + 1);
    } else if (r.verdict === 'review') report.review++;
    else report.rejected++;
    opts.log(`ai +${rarity} ${r.profile?.name} → ${r.verdict}${r.reasons?.length ? ` (${r.reasons.join(', ')})` : ''} ${r.costRub.toFixed(2)} ₽ ${(r.durationMs / 1000).toFixed(1)} с`);
  }
  return report;
}
