/**
 * Проверка контент-конфигов: npm run validate -w scripts
 * Падает с кодом 1 и списком ошибок, если что-то не так.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  ArchetypeSchema,
  FlavorSchema,
  NamesSchema,
  ReserveWaifuSchema,
  TalentTemplateSchema,
  validateProfile,
  loadEconomy,
} from '@wl/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config');
const read = (f: string): unknown => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
const errors: string[] = [];

function check<T>(file: string, schema: z.ZodType<T>): T | null {
  try {
    const r = schema.safeParse(read(file));
    if (!r.success) {
      for (const i of r.error.issues) errors.push(`${file}: ${i.path.join('.')} — ${i.message}`);
      return null;
    }
    return r.data;
  } catch (e) {
    errors.push(`${file}: ${(e as Error).message}`);
    return null;
  }
}

const economy = loadEconomy();
const archetypes = check('archetypes.json', z.array(ArchetypeSchema).length(10));
const talents = check('talents.json', z.array(TalentTemplateSchema).min(30));
const reserve = check('reserve_waifu.json', z.array(ReserveWaifuSchema).length(10));
check('names.json', NamesSchema);
const flavor = check('flavor.ru.json', FlavorSchema);

const archIds = new Set(archetypes?.map((a) => a.id) ?? []);
const buildingIds = new Set(economy.buildings.map((b) => b.id));

if (talents) {
  const ids = new Set<string>();
  for (const t of talents) {
    if (ids.has(t.id)) errors.push(`talents.json: дубль id ${t.id}`);
    ids.add(t.id);
    for (const a of t.affinity ?? []) if (!archIds.has(a)) errors.push(`talents.json: ${t.id} affinity неизвестный архетип ${a}`);
    if (t.target.startsWith('archetype:') && !archIds.has(t.target.slice(10)))
      errors.push(`talents.json: ${t.id} target неизвестный архетип`);
    if (t.condition?.type === 'brigade_has_archetype' && !archIds.has(t.condition.archetype))
      errors.push(`talents.json: ${t.id} condition неизвестный архетип`);
  }
}

if (reserve) {
  const archSeen = new Set<string>();
  for (const w of reserve) {
    if (!archIds.has(w.archetype)) errors.push(`reserve_waifu.json: ${w.id} неизвестный архетип ${w.archetype}`);
    if (archSeen.has(w.archetype)) errors.push(`reserve_waifu.json: архетип ${w.archetype} повторяется`);
    archSeen.add(w.archetype);
    for (const e of validateProfile(w, economy)) errors.push(`reserve_waifu.json: ${w.id} — ${e}`);
  }
  if (!reserve.some((w) => w.id === economy.start.starter_reserve_id))
    errors.push(`reserve_waifu.json: нет стартовой waifu ${economy.start.starter_reserve_id}`);
}

if (flavor) {
  for (const b of buildingIds)
    if (!flavor.building_upgrade[b]) errors.push(`flavor.ru.json: building_upgrade нет ключа ${b}`);
}

if (errors.length) {
  console.error(`❌ Ошибок: ${errors.length}`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('✅ Контент валиден');
