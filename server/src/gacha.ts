import {
  baseRates,
  isSsrPlus,
  loadEconomy,
  loadGacha,
  rarityConfig,
  rollOnce,
  type GachaHistoryItemDTO,
  type PityState,
  type PullItemDTO,
} from '@wl/shared';
import { sql } from './db.js';
import { advance, bannerActive, GameError, type AdvanceResult } from './player.js';
import { grantWaifu, pickFromPool, poolToPreviewDTO, toWaifuDTO } from './pool.js';
import { cryptoRandom } from './rng.js';
import type { Storage } from './storage.js';

interface PullOutcome {
  items: PullItemDTO[];
  adv: Pick<AdvanceResult, 'offlineReport' | 'milestoneTickets' | 'notices'>;
  replay: boolean;
}

/**
 * Призыв ×1/×10. Всё на сервере: криптографический RNG, pity по баннерам, лог.
 * Идемпотентность: повтор с тем же requestId возвращает сохранённый результат без списаний.
 */
export async function pull(userId: string, bannerId: string, count: number, requestId: string, storage: Storage): Promise<PullOutcome> {
  const g = loadGacha();
  const econ = loadEconomy();
  const banner = g.banners.find((b) => b.id === bannerId);
  if (!banner) throw new GameError('no_banner', 'Нет такого баннера', 404);
  if (!banner.pull_sizes.includes(count as 1 | 10)) throw new GameError('bad_count', 'Недопустимое число призывов');

  const prev = await sql<{ results: PullItemDTO[] }[]>`SELECT results FROM gacha_log WHERE user_id = ${userId} AND request_id = ${requestId}`;
  if (prev[0]) return { items: prev[0].results, adv: {}, replay: true };

  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    // Повтор, пришедший параллельно, увидит запись лога после нашей блокировки player_state
    const again = await tx<{ results: PullItemDTO[] }[]>`SELECT results FROM gacha_log WHERE user_id = ${userId} AND request_id = ${requestId}`;
    if (again[0]) return { items: again[0].results, adv: {}, replay: true };

    if (!bannerActive(banner)) throw new GameError('banner_closed', 'Баннер закрыт');
    await tx`INSERT INTO gacha_pity (user_id, banner_id) VALUES (${userId}, ${bannerId}) ON CONFLICT DO NOTHING`;
    const [pityRow] = await tx<{ since_ssr: number; since_sr: number; pulls: number; uses: number }[]>`
      SELECT since_ssr, since_sr, pulls, uses FROM gacha_pity WHERE user_id = ${userId} AND banner_id = ${bannerId} FOR UPDATE`;
    if (!pityRow) throw new Error('pity row missing');
    if (banner.max_uses !== null && pityRow.uses >= banner.max_uses) throw new GameError('banner_used', 'Этот баннер уже использован');

    const cost = banner.cost_per_pull * count;
    if (adv.player.row.tickets < cost) throw new GameError('not_enough', 'Не хватает Билетов призыва');

    const base = baseRates(econ);
    let state: PityState = { sinceSsr: pityRow.since_ssr, sinceSr: pityRow.since_sr };
    const owned = new Set(
      (await tx<{ archetype: string; rarity: string }[]>`SELECT archetype, rarity FROM waifu_instances WHERE user_id = ${userId}`).map(
        (r) => `${r.archetype}:${r.rarity}`,
      ),
    );

    const items: PullItemDTO[] = [];
    let shardsTotal = 0;
    for (let i = 0; i < count; i++) {
      const roll = rollOnce(state, base, g, cryptoRandom);
      state = roll.state;
      const featured =
        banner.featured_archetype && isSsrPlus(roll.rarity) && cryptoRandom() < banner.featured_share ? banner.featured_archetype : null;
      const poolRow = await pickFromPool(tx, roll.rarity, featured, storage);
      const key = `${poolRow.archetype}:${poolRow.rarity}`;
      // Дубликат = уже есть waifu того же архетипа и редкости → Осколки душ, запись остаётся в пуле
      if (owned.has(key)) {
        const shards = rarityConfig(econ, roll.rarity).shards_on_duplicate;
        shardsTotal += shards;
        items.push({ rarity: roll.rarity, pity: roll.pity, duplicate: true, shards, waifu: poolToPreviewDTO(poolRow) });
      } else {
        owned.add(key);
        const inst = await grantWaifu(tx, userId, poolRow);
        items.push({ rarity: roll.rarity, pity: roll.pity, duplicate: false, shards: 0, waifu: toWaifuDTO(inst) });
      }
    }

    await tx`
      UPDATE gacha_pity SET since_ssr = ${state.sinceSsr}, since_sr = ${state.sinceSr}, pulls = pulls + ${count}, uses = uses + 1
      WHERE user_id = ${userId} AND banner_id = ${bannerId}`;
    await tx`
      UPDATE player_state SET tickets = tickets - ${cost}, shards = shards + ${shardsTotal}, total_pulls = total_pulls + ${count}
      WHERE user_id = ${userId}`;
    if (cost > 0) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(-cost)}, 'gacha', ${requestId})`;
    if (shardsTotal > 0) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'shards', ${String(shardsTotal)}, 'duplicate', ${requestId})`;
    await tx`
      INSERT INTO gacha_log (user_id, banner_id, request_id, pull_count, results)
      VALUES (${userId}, ${bannerId}, ${requestId}, ${count}, ${tx.json(items as never)})`;
    if (adv.player.row.total_pulls === 0) {
      await tx`INSERT INTO analytics_events (user_id, name, props) VALUES (${userId}, 'first_pull', ${tx.json({ bannerId } as never)})`;
    }
    return { items, adv: { offlineReport: adv.offlineReport, milestoneTickets: adv.milestoneTickets, notices: adv.notices }, replay: false };
  });
}

export async function history(userId: string, limit = 50): Promise<GachaHistoryItemDTO[]> {
  const rows = await sql<{ banner_id: string; created_at: Date; results: PullItemDTO[] }[]>`
    SELECT banner_id, created_at, results FROM gacha_log WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    bannerId: r.banner_id,
    createdAt: r.created_at.toISOString(),
    items: r.results.map((i) => ({ rarity: i.rarity, name: i.waifu.name, archetype: i.waifu.archetype, duplicate: i.duplicate, pity: i.pity })),
  }));
}
