/** Упрощённая JSON Schema для обмена с Godot. Поля совпадают с zod в schema.ts. */
export function contentSchemaDocument(): Record<string, unknown> {
  const effect = {
    type: 'object',
    required: ['type'],
    properties: {
      type: { enum: ['mult', 'tag_mult', 'global_mult', 'stat_mult', 'cost_mult', 'slot_add', 'contract_mult', 'gacha_mod', 'event_mod', 'adjacency_bonus', 'timed_burst', 'grant', 'meta_mod', 'card_pick', 'flag', 'stamina_regen', 'morale', 'passive_credits', 'loss_mult', 'theft_mult', 'xp_mult', 'roll_cost_mult', 'tonnage_mult', 'crew_mult', 'output_add'] },
      stat: { type: 'string' },
      tag: { type: 'string' },
      target: { type: 'string' },
      value: { type: 'number' },
      cond: { type: 'string' },
      key: { type: 'string' },
      amount: { type: 'number' },
    },
    additionalProperties: false,
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'waifu_loader_v3_content',
    $defs: { effect, stats: { type: 'object', required: ['str', 'spd', 'acc', 'end', 'cha', 'lck'], additionalProperties: false } },
    properties: {
      races: { type: 'array' },
      classes: { type: 'array' },
      traits: { type: 'array' },
      buildings: { type: 'array' },
      cards: { type: 'array' },
      bases: { type: 'array' },
      milestones: { type: 'array' },
    },
  };
}
