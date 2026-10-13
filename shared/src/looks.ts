/**
 * Темы образов для ИИ-портретов: грузчица узнаётся по абсурдно тяжёлому грузу, а не по каске.
 * Тема задаёт место, варианты одежды, груз и свет; поза и план выбираются отдельно.
 */
import { z } from 'zod';
import { mulberry32 } from './procedural.js';
import { RARITIES, RaritySchema, type Rarity } from './schemas.js';

export const ThemeSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,32}$/),
  /** Название для админки */
  name: z.string().min(2),
  /** 0 — тема выключена */
  weight: z.number().min(0),
  min_rarity: RaritySchema,
  /** Сцена для художника (англ.) */
  scene: z.string().min(10),
  outfits: z.array(z.string().min(5)).min(1),
  cargo: z.array(z.string().min(3)).min(1),
  lighting: z.array(z.string().min(3)).min(1),
  /** Подсказка сценаристу, почему героиня сегодня здесь (рус.) */
  story_ru: z.string().min(10),
  /** work — смена грузчицы, rest — выходной. Других профессий нет. */
  kind: z.enum(['work', 'rest']).default('work'),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEMES: Theme[] = [
  {
    id: 'warehouse',
    name: 'Склад',
    weight: 1.4,
    min_rarity: 'N',
    kind: 'work',
    scene: 'busy warehouse with stacked cardboard boxes, pallets and yellow-black hazard stripes',
    outfits: [
      'canvas work coveralls, work gloves and a yellow hard hat',
      'tank top, cargo pants tied at the waist and work gloves',
      'high-visibility vest over a hoodie, work gloves, hard hat clipped to the belt',
      'denim overalls over a t-shirt, bandana in her hair',
    ],
    cargo: ['a huge refrigerator', 'a heavy steel safe', 'a tower of cardboard boxes', 'a wooden crate bigger than she is', 'a washing machine'],
    lighting: ['warm industrial lamps', 'daylight from high windows', 'cool fluorescent light'],
    story_ru: 'обычная смена на складе «Грузчицы Inc.»',
  },
  {
    id: 'delivery',
    name: 'Доставка',
    weight: 1.3,
    min_rarity: 'N',
    kind: 'work',
    scene: 'residential courtyard with a parked delivery van, mailboxes and apartment doors',
    outfits: [
      'courier jacket, cargo pants and a cap',
      'hoodie under a high-visibility vest, sneakers and a scanner on the belt',
      'windbreaker, jeans and work gloves',
    ],
    cargo: ['a stack of sealed parcel boxes', 'a large taped delivery box', 'two bulky parcels on a hand truck', 'a refrigerator still in delivery wrap'],
    lighting: ['daylight in the courtyard', 'overcast afternoon light'],
    story_ru: 'смена на доставке: адрес найден, груз ещё у машины',
  },
  {
    id: 'loading',
    name: 'Погрузка',
    weight: 1.1,
    min_rarity: 'N',
    kind: 'work',
    scene: 'warehouse loading dock, open truck rear and a metal ramp',
    outfits: ['canvas coveralls and work gloves', 'high-visibility vest over a t-shirt, cargo pants and boots'],
    cargo: ['a pallet of boxes at the truck ramp', 'a washing machine on a dolly', 'a stack of crates halfway onto the truck'],
    lighting: ['daylight at the open dock', 'cool fluorescent light inside the truck'],
    story_ru: 'погрузка фуры: груз едет к рампе, а не в зал',
  },
  {
    id: 'unloading',
    name: 'Разгрузка',
    weight: 1.1,
    min_rarity: 'N',
    kind: 'work',
    scene: 'open box truck at a curb, tailgate down, boxes already on the pavement',
    outfits: ['work jacket, gloves and sturdy boots', 'sleeveless hoodie, cargo pants and a high-visibility vest'],
    cargo: ['boxes coming off the truck onto the pavement', 'a sofa just set down by the curb', 'a wardrobe standing next to the open truck'],
    lighting: ['morning street light', 'late afternoon sun'],
    story_ru: 'разгрузка у подъезда, лифт снова не работает',
  },
  {
    id: 'apartment',
    name: 'Переезд',
    weight: 1.2,
    min_rarity: 'N',
    kind: 'work',
    scene: 'narrow stairwell of an old apartment building with plants on windowsills',
    outfits: ['hoodie, sweatpants and work gloves', 'flannel shirt, jeans and a cap', 't-shirt, cargo pants and sneakers'],
    cargo: ['a sofa', 'a wardrobe', 'a bathtub', 'a stack of moving boxes taller than her'],
    lighting: ['warm afternoon light', 'dim stairwell light'],
    story_ru: 'квартирный переезд, пятый этаж без лифта',
  },
  {
    id: 'beach',
    name: 'Пляж',
    weight: 1.4,
    min_rarity: 'N',
    kind: 'rest',
    scene: 'sunny sandy beach with turquoise sea, palm trees and beach umbrellas',
    outfits: [
      'sporty two-piece swimsuit with board shorts',
      'one-piece swimsuit with an open beach shirt over it',
      'rash guard top and swim shorts, sunglasses on her head',
      'bikini top with a sarong tied around the waist, straw hat',
    ],
    cargo: ['a giant beach cooler', 'a surfboard', 'a stack of sun loungers', 'an inflatable boat'],
    lighting: ['bright midday sun', 'golden sunset light'],
    story_ru: 'выходной на пляже, смена осталась на складе',
  },
  {
    id: 'gym',
    name: 'Спортзал',
    weight: 1.2,
    min_rarity: 'N',
    kind: 'rest',
    scene: 'gym with weight racks, rubber floor and plain walls',
    outfits: ['sports top, track jacket tied at the waist and leggings', 'loose tank top, shorts and wrist wraps'],
    cargo: ['her gym bag and a stack of iron plates', 'a treadmill she just stepped off', 'a punching bag standing beside her'],
    lighting: ['bright gym lights', 'sunlight through big windows'],
    story_ru: 'выходной в зале, без склада и без смены',
  },
  {
    id: 'park',
    name: 'Парк',
    weight: 1,
    min_rarity: 'N',
    kind: 'rest',
    scene: 'city park with trees, a bench and a path',
    outfits: ['sundress and sneakers', 't-shirt, shorts and a cap', 'light cardigan, jeans and canvas shoes'],
    cargo: ['a bicycle beside the bench', 'a picnic basket', 'a folded blanket and a thermos'],
    lighting: ['dappled daylight', 'late afternoon sun'],
    story_ru: 'выходной в парке, телефон со складом на беззвучном',
  },
  {
    id: 'hobby',
    name: 'Хобби',
    weight: 1,
    min_rarity: 'N',
    kind: 'rest',
    scene: 'small apartment room with a desk, houseplants and a window',
    outfits: ['oversized sweater and jeans', 'paint-stained t-shirt and shorts', 'hoodie and sweatpants'],
    cargo: ['a stack of finished canvases', 'a row of potted plants', 'a camera bag and a tripod'],
    lighting: ['soft window light', 'warm lamp light'],
    story_ru: 'вечер дома за хобби, ящики сегодня не её забота',
  },
  {
    id: 'winter',
    name: 'Зимняя прогулка',
    weight: 0.9,
    min_rarity: 'N',
    kind: 'rest',
    scene: 'snowy park path with soft falling snow and warm street lamps',
    outfits: ['puffer jacket, scarf and knit beanie', 'long wool coat, earmuffs and mittens'],
    cargo: ['a pair of skis', 'a sled', 'a thermos and a pair of ice skates'],
    lighting: ['blue winter dusk with warm street lamps', 'soft overcast snow light'],
    story_ru: 'выходной на зимней прогулке',
  },
];

/** Узнаваемые марки доставки. Попадают только на рабочие кадры и не на каждый. */
export const WORK_BRANDS = [
  {
    id: 'ozon',
    name: 'Ozon',
    marks: [
      'Her work vest has a bright blue rounded-square patch with the white word OZON.',
      'The cardboard boxes beside her are bright blue with the white word OZON.',
      'A blue delivery van behind her shows the white word OZON on the side.',
    ],
  },
  {
    id: 'wildberries',
    name: 'Wildberries',
    marks: [
      'Her work vest has a purple-to-pink rounded-square patch with the white letters wb.',
      'The parcels beside her are purple-pink with the white letters wb.',
      'A purple delivery van behind her shows the white letters wb.',
    ],
  },
  {
    id: 'yandex_market',
    name: 'Яндекс Маркет',
    marks: [
      'Her work vest has a red rounded-square patch with a bold yellow angular M.',
      'The boxes beside her are red with a bold yellow angular M.',
      'A red delivery van behind her shows a bold yellow angular M on the side.',
    ],
  },
] as const;

/** Доля рабочих кадров с маркой. Остальные рабочие кадры без фирмы. */
export const WORK_BRAND_CHANCE = 0.5;

/** Груз только в руках или рядом. Не на спине, плечах и голове. */
export const CARGO_PLACEMENTS = [
  'She holds the cargo with both hands in front of her, at waist height.',
  'The cargo stands on the ground beside her; one hand rests on it.',
  'She walks next to the cargo, pulling it on a small dolly.',
  'She grips a side handle; the cargo is next to her, not on her body.',
  'The cargo sits on a low cart beside her, and she pushes the handle.',
  'She has just set the cargo down and stands next to it.',
] as const;

export const CARRY_BAN =
  'The cargo is in her hands or on the ground beside her. Do not place it on her back, shoulders, head, or strap it to her body.';

export const HAIR = [
  'short black bob',
  'long wavy chestnut hair',
  'messy auburn ponytail',
  'silver-streaked dark hair in a loose bun',
  'curly honey-blonde hair',
  'straight ash-brown hair past the shoulders',
  'pixie cut, dark plum',
  'thick braid over one shoulder, black hair',
  'windblown sandy hair',
  'neat low bun, jet black',
];

export const FACES = [
  'soft round face, calm eyes',
  'sharp cheekbones, narrow eyes',
  'broad face, kind tired eyes',
  'heart-shaped face, bright eyes',
  'strong jaw, thoughtful eyes',
  'oval face, slight smile',
  'angular face, focused look',
  'warm face, raised eyebrow',
];

export const BUILDS = ['lean', 'athletic', 'broad-shouldered', 'sturdy', 'tall and lanky', 'compact and strong'];

export const EXPRESSIONS = ['focused', 'amused', 'deadpan', 'slightly annoyed', 'quietly proud', 'mid-laugh', 'concentrating', 'unbothered'];

export const DEFAULT_POSES = [
  'standing beside the cargo with one hand on it',
  'holding the cargo in both hands',
  'pushing a dolly that carries the cargo',
  'walking next to the cargo, a hand on its handle',
  'crouching beside the cargo she just set down',
  'pulling a low cart with the cargo on it',
];

export const DEFAULT_SHOTS = ['full-body shot', 'full-body shot, slightly low angle', 'three-quarter view from the knees up', 'dynamic full-body shot, slight dutch angle'];

export interface Look {
  theme: string;
  themeName: string;
  scene: string;
  outfit: string;
  cargo: string;
  lighting: string;
  pose: string;
  shot: string;
  story: string;
  /** Случайные черты, чтобы архетип не штамповал одно лицо */
  hair: string;
  face: string;
  build: string;
  expression: string;
  placement: string;
  kind: 'work' | 'rest';
  /** Пусто, если марки на кадре нет. */
  brand: string;
  brandName: string;
}

const rank = (r: Rarity) => RARITIES.indexOf(r);

/**
 * Детерминированно по seed выбирает образ. Темы, которых в пуле этой редкости меньше их доли по весу
 * (usage — сколько раз тема уже встречается), выпадают чаще, перебор — реже.
 */
export function pickLook(
  opts: { themes: Theme[]; poses: string[]; shots: string[] },
  rarity: Rarity,
  seed: number,
  usage: Record<string, number> = {},
): Look {
  const rnd = mulberry32(seed);
  const eligible = opts.themes.filter((t) => t.weight > 0 && rank(t.min_rarity) <= rank(rarity));
  const pool = eligible.length ? eligible : opts.themes;
  const W = pool.reduce((a, t) => a + t.weight, 0);
  const used = pool.reduce((a, t) => a + (usage[t.id] ?? 0), 0);
  const scores = pool.map((t) => {
    const expected = (used * t.weight) / W;
    return t.weight * Math.max(0.1, 1 + (expected - (usage[t.id] ?? 0)) / (expected + 1));
  });
  const total = scores.reduce((a, b) => a + b, 0);
  let x = rnd() * total;
  let theme = pool[pool.length - 1]!;
  for (let i = 0; i < pool.length; i++) {
    x -= scores[i]!;
    if (x <= 0) {
      theme = pool[i]!;
      break;
    }
  }
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const branded = theme.kind === 'work' && rnd() < WORK_BRAND_CHANCE;
  const brand = branded ? pick(WORK_BRANDS) : null;
  return {
    theme: theme.id,
    themeName: theme.name,
    scene: theme.scene,
    outfit: pick(theme.outfits),
    cargo: pick(theme.cargo),
    lighting: pick(theme.lighting),
    pose: pick(opts.poses.length ? opts.poses : DEFAULT_POSES),
    shot: pick(opts.shots.length ? opts.shots : DEFAULT_SHOTS),
    story: theme.story_ru,
    hair: pick(HAIR),
    face: pick(FACES),
    build: pick(BUILDS),
    expression: pick(EXPRESSIONS),
    placement: pick(CARGO_PLACEMENTS),
    kind: theme.kind,
    brand: brand ? pick(brand.marks) : '',
    brandName: brand?.name ?? '',
  };
}
