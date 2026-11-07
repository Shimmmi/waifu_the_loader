/**
 * Пиксельные карточки заказов: 3 вида × 5 редкостей.
 * Запуск: npx tsx tools/contracts/cards.ts
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const W = 64;
const H = 96;
type RGB = [number, number, number];

const RARITY: Record<string, { sky: RGB; accent: RGB; trim: RGB }> = {
  common: { sky: [168, 196, 214], accent: [196, 164, 96], trim: [90, 78, 64] },
  uncommon: { sky: [150, 206, 170], accent: [72, 168, 96], trim: [40, 90, 58] },
  rare: { sky: [150, 186, 230], accent: [70, 130, 230], trim: [36, 64, 120] },
  epic: { sky: [186, 160, 220], accent: [168, 80, 210], trim: [78, 36, 110] },
  legendary: { sky: [230, 196, 120], accent: [230, 170, 40], trim: [120, 78, 20] },
};

function blank(c: RGB): Buffer {
  const data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

function put(data: Buffer, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = 255;
}

function rect(data: Buffer, x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(data, xx, yy, c);
}

function crate(data: Buffer, x: number, y: number, wood: RGB, band: RGB): void {
  rect(data, x, y, 22, 16, wood);
  rect(data, x, y + 7, 22, 2, band);
  rect(data, x + 10, y, 2, 16, band);
  rect(data, x, y, 22, 1, [40, 28, 18]);
  rect(data, x, y + 15, 22, 1, [40, 28, 18]);
}

function coin(data: Buffer, x: number, y: number, gold: RGB): void {
  rect(data, x + 1, y, 4, 1, gold);
  rect(data, x, y + 1, 6, 4, gold);
  rect(data, x + 1, y + 5, 4, 1, gold);
  put(data, x + 2, y + 2, [120, 78, 20]);
  put(data, x + 3, y + 3, [120, 78, 20]);
}

function star(data: Buffer, x: number, y: number, c: RGB): void {
  rect(data, x + 3, y, 2, 9, c);
  rect(data, x, y + 3, 8, 2, c);
  put(data, x + 1, y + 1, c);
  put(data, x + 6, y + 1, c);
  put(data, x + 1, y + 6, c);
  put(data, x + 6, y + 6, c);
  put(data, x + 2, y + 2, c);
  put(data, x + 5, y + 2, c);
}

function ground(data: Buffer, c: RGB): void {
  rect(data, 0, 70, W, 26, c);
  rect(data, 0, 70, W, 2, [70, 56, 40]);
}

async function draw(kind: string, rarity: string, out: string): Promise<void> {
  const pal = RARITY[rarity]!;
  const data = blank(kind === 'stars' ? [28, 36, 72] : pal.sky);
  if (kind === 'stars') {
    for (const [x, y] of [[8, 10], [50, 16], [20, 28], [40, 8], [14, 40]] as const) put(data, x, y, [240, 236, 210]);
  }
  ground(data, kind === 'stars' ? [48, 42, 64] : [120, 96, 64]);
  const wood: RGB = [150, 104, 58];
  const band = pal.trim;
  if (kind === 'credits' || kind === 'hybrid') {
    crate(data, 8, 54, wood, band);
    crate(data, 32, 50, [170, 120, 68], pal.accent);
    coin(data, 18, 46, pal.accent);
    coin(data, 40, 42, pal.accent);
    coin(data, 26, 40, [230, 190, 70]);
  }
  if (kind === 'stars' || kind === 'hybrid') {
    star(data, kind === 'hybrid' ? 46 : 28, kind === 'hybrid' ? 28 : 36, pal.accent);
    if (kind === 'stars') {
      star(data, 12, 48, [240, 220, 120]);
      star(data, 44, 52, pal.accent);
    }
  }
  rect(data, 0, 0, W, 3, pal.trim);
  rect(data, 0, H - 3, W, 3, pal.trim);
  rect(data, 0, 0, 3, H, pal.trim);
  rect(data, W - 3, 0, 3, H, pal.trim);
  const png = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .resize(W * 3, H * 3, { kernel: 'nearest' })
    .webp({ quality: 90 })
    .toBuffer();
  await sharp(png).toFile(out);
}

const dir = resolve('client/public/v3/contracts');
mkdirSync(dir, { recursive: true });
const kinds = ['credits', 'stars', 'hybrid'];
const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
for (const kind of kinds) {
  for (const rarity of rarities) {
    const file = resolve(dir, `${kind}_${rarity}.webp`);
    await draw(kind, rarity, file);
    console.log(file);
  }
}
