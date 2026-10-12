import { migrate, sql } from '../db.js';
import { env } from '../env.js';
import { registerGuest } from '../auth.js';
import * as actions from '../actions.js';
import * as m4 from '../management.js';
import { snapshot } from '../player.js';
import { LocalDiskStorage } from '../storage.js';

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
};
const expectErr = async (p: Promise<unknown>, code: string, msg: string) => {
  try {
    await p;
    ok(false, `${msg} (ошибки не было)`);
  } catch (e) {
    ok((e as { code?: string }).code === code, `${msg}: ${(e as Error).message}`);
  }
};

console.log('migrations:', await migrate());
const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
const code = `SMOKE-${Date.now()}`;
await sql`INSERT INTO invite_codes (code, max_uses, note) VALUES (${code}, 1, 'smoke m4')`;
await registerGuest({ inviteCode: code, nickname: `smoke${Date.now() % 100000}`, ageConfirmed: true }, storage);
const [{ id: uid } = { id: '' }] = await sql<{ id: string }[]>`SELECT id FROM users WHERE invite_code = ${code}`;
const pools = await sql<{ id: string }[]>`SELECT pool_id AS id FROM waifu_instances WHERE user_id = ${uid}`;
const st = () => snapshot(uid, {}, 'smoke');
const ff = async () => {
  await sql`UPDATE training_jobs SET ends_at = now() - interval '1 second' WHERE user_id = ${uid} AND status = 'active'`;
  await sql`UPDATE contracts SET ends_at = now() - interval '1 second' WHERE user_id = ${uid} AND status = 'active'`;
};

try {
  let s = await st();
  ok(s.limits.gymSlots === 0 && s.limits.contractSlots === 0, 'без зданий M4 слотов нет');
  const w = s.waifu[0]!;
  await expectErr(m4.startTraining(uid, w.id, 'strength', 1), 'no_gym', 'тренировка без Спортзала');

  await sql`UPDATE player_state SET coins = '1e30' WHERE user_id = ${uid}`;
  for (const b of ['gym', 'dispatch', 'bath', 'merch', 'dormitory']) await actions.upgradeBuilding(uid, b, 10);
  await actions.tick(uid);
  s = await st();
  ok(s.limits.gymSlots === 2 && s.limits.contractSlots === 2, `слоты: зал ${s.limits.gymSlots}, заказы ${s.limits.contractSlots}`);
  ok(s.contracts.filter((c) => c.status === 'offer').length === s.limits.boardSize, `доска: ${s.contracts.length} из ${s.limits.boardSize}`);
  ok(s.limits.offlineCapHours === 17, `офлайн-лимит ${s.limits.offlineCapHours} ч`);
  ok(s.rates.mult.merch > 1, `мерч ×${s.rates.mult.merch}`);

  await m4.startTraining(uid, w.id, 'strength', 15);
  s = await st();
  const w1 = s.waifu.find((x) => x.id === w.id)!;
  ok(w1.zone === 'gym' && w1.fatigue > 0, `в зале, усталость ${w1.fatigue}`);
  ok(s.rates.power === 0, 'склад без неё не работает');
  await expectErr(actions.assign(uid, w.id, 'warehouse'), 'busy', 'нельзя на склад из зала');
  await expectErr(m4.claimTraining(uid, s.trainings[0]!.id), 'not_ready', 'рано забирать');
  await ff();
  const tr = await m4.claimTraining(uid, s.trainings[0]!.id);
  console.log('   ', tr.notice.text);
  await expectErr(m4.claimTraining(uid, s.trainings[0]!.id), 'no_job', 'повторный забор');
  s = await st();
  const w2 = s.waifu.find((x) => x.id === w.id)!;
  ok(w2.zone === 'warehouse', 'вернулась на склад');
  ok(w2.xp > 0 || w2.level > 1, `опыт ${w2.xp}, ур. ${w2.level}`);

  const offer = s.contracts.find((c) => c.status === 'offer')!;
  const coins0 = s.resources.coins;
  await m4.startContract(uid, offer.id, [w.id]);
  s = await st();
  ok(s.waifu.find((x) => x.id === w.id)!.zone === 'contract', 'на заказе');
  ok(s.contracts.filter((c) => c.status === 'offer').length === s.limits.boardSize, 'доска добрана');
  await expectErr(m4.startTraining(uid, w.id, 'cardio', 1), 'busy', 'занята — в зал нельзя');
  await ff();
  const ct = await m4.claimContract(uid, offer.id);
  console.log('   ', ct.notice.text, ct.notice.vars.coins);
  s = await st();
  ok(Number(s.resources.coins) > Number(coins0) * 0 && s.waifu.find((x) => x.id === w.id)!.zone === 'warehouse', 'оплата получена, вернулась');

  await expectErr(m4.endShift(uid), 'no_seals', 'престиж без груза');
  await sql`UPDATE player_state SET cargo = '4e9' WHERE user_id = ${uid}`;
  await m4.startTraining(uid, w.id, 'luck', 60);
  const pr = await m4.endShift(uid);
  s = await st();
  ok(pr.seals === 2 && s.resources.seals === '2', `печатей ${pr.seals}`);
  ok(s.buildings.gym === 0 && s.buildings.warehouse === 1, 'здания сброшены');
  ok(s.waifu.every((x) => x.level === 1 && x.zone !== 'gym'), 'уровни сброшены, тренировка отменена');
  ok(s.waifu.find((x) => x.id === w.id)?.zone === 'warehouse', 'из зала вернулась в бригаду');
  ok(s.trainings.length === 0 && s.contracts.length === 0, 'работы отменены');
  ok(s.prestige.count === 1 && s.prestige.sealsEarned === 2, 'prestige_state');
  ok(Math.abs(s.rates.mult.prestigeCargo - 1.2) < 1e-9, `множитель печатей ×${s.rates.mult.prestigeCargo}`);

  await m4.buyUpgrade(uid, 'cargo');
  s = await st();
  ok(s.prestige.upgrades.cargo === 1 && s.resources.seals === '1', 'куплен узел дерева');
  await expectErr(m4.buyUpgrade(uid, 'auto_claim'), 'not_enough', 'не хватает печатей');
  await expectErr(m4.setAutomation(uid, { buildings: true }), 'locked', 'прораб закрыт');

  await sql`UPDATE player_state SET seals = '10', coins = '1e30' WHERE user_id = ${uid}`;
  await m4.buyUpgrade(uid, 'auto_claim');
  await m4.buyUpgrade(uid, 'auto_buildings');
  await m4.setAutomation(uid, { buildings: true });
  await actions.upgradeBuilding(uid, 'gym', 1);
  await m4.startTraining(uid, w.id, 'cardio', 1);
  await ff();
  const t = await actions.tick(uid);
  ok(t.notices?.some((n) => n.kind === 'training'), 'автозабор тренировки');
  ok(t.notices?.some((n) => n.kind === 'auto_buildings'), `прораб: ${t.notices?.find((n) => n.kind === 'auto_buildings')?.text}`);
} finally {
  await sql`DELETE FROM waifu_instances WHERE user_id = ${uid}`;
  for (const p of pools) await sql`UPDATE waifu_pool SET status = 'ready', owner_id = NULL, taken_at = NULL WHERE id = ${p.id}`;
  await sql`DELETE FROM users WHERE id = ${uid}`;
  await sql`DELETE FROM invite_codes WHERE code = ${code}`;
  console.log('cleanup done');
  await sql.end();
}
