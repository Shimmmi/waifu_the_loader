import racesJson from '../../../config/v3/races.json';
import classesJson from '../../../config/v3/classes.json';
import traitsJson from '../../../config/v3/traits.json';
import buildingsJson from '../../../config/v3/buildings.json';
import cardsJson from '../../../config/v3/cards_expansion.json';
import basesJson from '../../../config/v3/cards_base.json';
import milestonesJson from '../../../config/v3/milestones.json';
import economyJson from '../../../config/v3/economy.json';
import gachaJson from '../../../config/v3/gacha.json';
import metaJson from '../../../config/v3/meta.json';
import contractsJson from '../../../config/v3/contracts.json';
import bioJson from '../../../config/v3/bio_fallback.json';
import migrationJson from '../../../config/v3/migration.json';
import uiJson from '../../../config/v3/ui.json';
import storyJson from '../../../config/v3/story.json';
import localeJson from '../../../config/v3/locale.ru.json';
import {
  BaseCardSchema,
  BioSchema,
  BuildingSchema,
  CardSchema,
  ClassSchema,
  COND_OK,
  ContractSchema,
  EconomyV3Schema,
  GachaV3Schema,
  LocaleSchema,
  MetaNodeSchema,
  MigrationSchema,
  MilestoneSchema,
  RaceSchema,
  StorySchema,
  TraitSchema,
  UiSchema,
} from './schema.js';
import type { Catalog } from './engine.js';

let cache: Catalog | null = null;

function effectsCond(effects: { cond?: string }[], where: string): void {
  for (const e of effects) {
    if (e.cond && !COND_OK.has(e.cond)) throw new Error(`${where}: неизвестное условие ${e.cond}`);
  }
}

export function loadV3(): Catalog {
  if (cache) return cache;
  const races = RaceSchema.array().parse(racesJson);
  const classes = ClassSchema.array().parse(classesJson);
  const traits = TraitSchema.array().parse(traitsJson);
  const buildings = BuildingSchema.array().parse(buildingsJson);
  const cards = CardSchema.array().parse(cardsJson);
  const bases = BaseCardSchema.array().parse(basesJson);
  const milestones = MilestoneSchema.array().parse(milestonesJson);
  const economy = EconomyV3Schema.parse(economyJson);
  const gacha = GachaV3Schema.parse(gachaJson);
  const meta = MetaNodeSchema.array().parse(metaJson);
  const contracts = ContractSchema.array().parse(contractsJson);
  const bio = BioSchema.parse(bioJson);
  const migration = MigrationSchema.parse(migrationJson);
  const ui = UiSchema.parse(uiJson);
  const story = StorySchema.parse(storyJson);
  const locale = LocaleSchema.parse(localeJson);
  if (bio.bios.length < 200) throw new Error('bio_fallback: нужно минимум 200 заготовок');
  if (bio.nicknames.length < 300) throw new Error('bio_fallback: нужно минимум 300 прозвищ');
  for (const t of traits) effectsCond(t.effects, t.id);
  for (const b of buildings) {
    effectsCond(b.effects, b.id);
    for (const id of b.class_affinity) {
      if (!classes.some((c) => c.id === id)) throw new Error(`${b.id}: нет класса ${id}`);
    }
    for (const id of b.race_affinity) {
      if (!races.some((r) => r.id === id)) throw new Error(`${b.id}: нет расы ${id}`);
    }
  }
  for (const c of cards) effectsCond([...c.effects, ...(c.curse ?? [])], c.id);
  for (const id of Object.keys(migration.archetype_class)) {
    const job = migration.archetype_class[id];
    if (!classes.some((c) => c.id === job)) throw new Error(`migration: класс ${job} для ${id}`);
  }
  if (!races.some((r) => r.id === migration.default_race)) throw new Error('migration: нет расы по умолчанию');
  cache = {
    races,
    classes,
    traits,
    buildings,
    cards,
    bases,
    milestones,
    economy,
    gacha,
    meta,
    contracts,
    bios: bio.bios,
    nicknames: bio.nicknames,
    locale,
    story,
    migration,
    ui,
    templates: [],
  };
  return cache;
}

export function withTemplates(cat: Catalog, templates: Catalog['templates']): Catalog {
  return { ...cat, templates };
}
