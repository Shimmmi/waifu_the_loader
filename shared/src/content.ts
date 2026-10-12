import { z } from 'zod';
import archetypesJson from '../../config/archetypes.json';
import contractsJson from '../../config/contracts.json';
import flavorM4Json from '../../config/flavor.m4.ru.json';
import flavorJson from '../../config/flavor.ru.json';
import namesJson from '../../config/names.json';
import reserveJson from '../../config/reserve_waifu.json';
import talentsJson from '../../config/talents.json';
import {
  ArchetypeSchema,
  ContractsContentSchema,
  FlavorM4Schema,
  FlavorSchema,
  NamesSchema,
  ReserveWaifuSchema,
  TalentTemplateSchema,
  type Archetype,
  type ContractsContent,
  type FlavorM4,
  type Flavor,
  type FlavorLine,
  type Names,
  type ReserveWaifu,
  type SwearLevel,
  type TalentTemplate,
} from './schemas.js';

export interface Content {
  archetypes: Archetype[];
  talents: TalentTemplate[];
  reserve: ReserveWaifu[];
  names: Names;
  flavor: Flavor;
  flavorM4: FlavorM4;
  contracts: ContractsContent;
}

let cache: Content | null = null;

export function loadContent(): Content {
  return (cache ??= {
    archetypes: z.array(ArchetypeSchema).parse(archetypesJson),
    talents: z.array(TalentTemplateSchema).parse(talentsJson),
    reserve: z.array(ReserveWaifuSchema).parse(reserveJson),
    names: NamesSchema.parse(namesJson),
    flavor: FlavorSchema.parse(flavorJson),
    flavorM4: FlavorM4Schema.parse(flavorM4Json),
    contracts: ContractsContentSchema.parse(contractsJson),
  });
}

export function archetypeById(c: Content, id: string): Archetype | undefined {
  return c.archetypes.find((a) => a.id === id);
}

export function linesFor(lines: FlavorLine[], swear: SwearLevel): FlavorLine[] {
  const ok = lines.filter((l) => l.swear <= swear);
  return ok.length ? ok : lines.filter((l) => l.swear === 0);
}

export function pickLine(lines: FlavorLine[], swear: SwearLevel, vars: Record<string, string> = {}, rnd = Math.random): string {
  const pool = linesFor(lines, swear);
  const line = pool[Math.floor(rnd() * pool.length)];
  return line ? fill(line.text, vars) : '';
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
