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
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEMES: Theme[] = [
  {
    id: 'warehouse',
    name: 'Склад',
    weight: 3,
    min_rarity: 'N',
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
    id: 'beach',
    name: 'Пляж',
    weight: 1.5,
    min_rarity: 'N',
    scene: 'sunny sandy beach with turquoise sea, palm trees and beach umbrellas',
    outfits: [
      'sporty two-piece swimsuit with board shorts',
      'one-piece swimsuit with an open beach shirt over it',
      'rash guard top and swim shorts, sunglasses on her head',
      'bikini top with a sarong tied around the waist, straw hat',
    ],
    cargo: ['a jet ski', 'a full-size vending machine', 'a giant beach cooler', 'a stack of sun loungers', 'a lifeguard tower'],
    lighting: ['bright midday sun', 'golden sunset light'],
    story_ru: 'бригада на летнем выезде: пляжному кафе срочно понадобился переезд',
  },
  {
    id: 'office',
    name: 'Офис',
    weight: 1,
    min_rarity: 'N',
    scene: 'modern open-plan office with desks, monitors and potted plants',
    outfits: ['business suit with a pencil skirt and rolled-up sleeves', 'white blouse, loosened tie and slacks', 'smart cardigan and trousers, lanyard badge'],
    cargo: ['a huge office copier', 'a server rack', 'a water cooler with spare bottles', 'a filing cabinet full of papers'],
    lighting: ['soft office light', 'late evening light through glass walls'],
    story_ru: 'офис переезжает на другой этаж, а лифт, как всегда, сломан',
  },
  {
    id: 'kitchen',
    name: 'Кухня ресторана',
    weight: 1,
    min_rarity: 'N',
    scene: 'steamy restaurant kitchen with steel counters and hanging pans',
    outfits: ['white chef jacket and chef hat', 'black kitchen apron over a t-shirt, bandana'],
    cargo: ['a giant cauldron of soup', 'a commercial oven', 'a tower of crates of vegetables', 'a whole industrial fridge'],
    lighting: ['warm kitchen light with steam'],
    story_ru: 'ресторану к банкету нужно перетащить кухню целиком',
  },
  {
    id: 'festival',
    name: 'Летний фестиваль',
    weight: 1,
    min_rarity: 'R',
    scene: 'Japanese summer festival street with paper lanterns and food stalls',
    outfits: ['colorful yukata with an obi sash', 'festival happi coat over a t-shirt and shorts, headband'],
    cargo: ['a portable mikoshi shrine', 'a giant taiko drum', 'an entire food stall', 'a huge paper lantern'],
    lighting: ['warm lantern light at dusk', 'fireworks in the night sky'],
    story_ru: 'на фестивале некому нести святилище-микоси, и бригаду позвали на подмогу',
  },
  {
    id: 'stage',
    name: 'Сцена',
    weight: 1,
    min_rarity: 'R',
    scene: 'concert stage with spotlights and a cheering silhouette crowd',
    outfits: ['sparkly stage idol outfit with a jacket and long skirt', 'rock band outfit: leather jacket, band t-shirt, ripped jeans'],
    cargo: ['a stack of giant speakers', 'a full drum kit', 'a grand piano', 'a lighting truss'],
    lighting: ['colorful stage spotlights', 'backlight with haze'],
    story_ru: 'звёздный концерт, а техники не приехали — монтаж сцены на бригаде',
  },
  {
    id: 'conservatory',
    name: 'Консерватория',
    weight: 1,
    min_rarity: 'R',
    scene: 'grand marble staircase of a music conservatory with tall arched windows',
    outfits: ['elegant black concert dress', 'university music student look: knit sweater, long skirt, sheet music folder', 'music teacher look: blazer, blouse and trousers'],
    cargo: ['a grand piano', 'an upright piano', 'a pipe organ section', 'a double bass case and a harp'],
    lighting: ['soft daylight through arched windows', 'warm evening light'],
    story_ru: 'консерватория меняет зал, и рояль по лестнице поднимают руками',
  },
  {
    id: 'gym',
    name: 'Спортзал',
    weight: 1,
    min_rarity: 'N',
    scene: 'gym with weight racks, rubber floor and motivational posters without text',
    outfits: ['sports top, track jacket tied at the waist and leggings', 'loose tank top, shorts and wrist wraps'],
    cargo: ['an entire squat rack', 'a treadmill', 'a stack of iron plates', 'a sumo-sized punching bag'],
    lighting: ['bright gym lights', 'sunlight through big windows'],
    story_ru: 'зал переезжает, и бригада решила совместить работу с тренировкой',
  },
  {
    id: 'winter',
    name: 'Зимний город',
    weight: 1,
    min_rarity: 'N',
    scene: 'snowy city street with soft falling snow and warm shop windows',
    outfits: ['puffer jacket, scarf and knit beanie', 'long wool coat, earmuffs and mittens'],
    cargo: ['a decorated Christmas tree with its stand', 'a sled loaded with gift boxes', 'a vending machine with hot drinks', 'a giant snowman'],
    lighting: ['blue winter dusk with warm street lamps', 'soft overcast snow light'],
    story_ru: 'зимний аврал: все переезжают перед праздниками',
  },
  {
    id: 'apartment',
    name: 'Переезд',
    weight: 1.5,
    min_rarity: 'N',
    scene: 'narrow stairwell of an old apartment building with plants on windowsills',
    outfits: ['oversized hoodie, sweatpants and sneakers', 'flannel shirt, jeans and a cap', 'cozy sweater, jeans and work gloves'],
    cargo: ['a sofa', 'a wardrobe', 'a bathtub', 'a stack of moving boxes taller than her'],
    lighting: ['warm afternoon light', 'dim stairwell light'],
    story_ru: 'квартирный переезд, пятый этаж без лифта',
  },
  {
    id: 'fantasy',
    name: 'Фэнтези',
    weight: 1,
    min_rarity: 'SSR',
    scene: 'fantasy castle courtyard with banners, stone walls and a distant dragon',
    outfits: ['knight armor with a cape', 'adventurer leather armor with a hooded cloak', 'elegant mage robes'],
    cargo: ['an overflowing treasure chest', 'a sleeping dragon egg the size of a car', 'a castle gate', 'a giant magic crystal'],
    lighting: ['epic golden sunlight', 'magical glowing light'],
    story_ru: 'заказ из параллельного мира: королевству нужна бригада, которая поднимет что угодно',
  },
  {
    id: 'space',
    name: 'Космос',
    weight: 0.7,
    min_rarity: 'UR',
    scene: 'futuristic space station cargo bay with a view of a planet through a huge window',
    outfits: ['sleek sci-fi spacesuit without helmet', 'cyberpunk jacket with glowing trims'],
    cargo: ['a satellite', 'a spaceship engine', 'a glowing cargo container'],
    lighting: ['neon sci-fi light', 'planet glow through the window'],
    story_ru: 'межпланетная доставка: на орбите тоже кто-то должен таскать',
  },
];

export const DEFAULT_POSES = [
  'carrying the cargo on one shoulder with a calm face',
  'lifting the cargo overhead with both arms',
  'hauling the cargo on her back with straps',
  'dragging the cargo with a rope',
  'pushing the cargo on a hand truck',
  'taking a break sitting on top of the cargo',
  'balancing the cargo on one hand',
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
  const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
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
  };
}
