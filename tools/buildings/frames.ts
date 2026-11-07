/** Локальные картинки комнат: четыре оболочки на каждую постройку. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ids = ['dock', 'dispatch', 'dorm', 'warehouse', 'canteen', 'workshop', 'gym', 'medbay', 'hr_office', 'security', 'comms', 'greenhouse', 'bar', 'reactor'];
const shells = ['buried', 'basement', 'surface', 'sky'] as const;

function frame(shell: (typeof shells)[number], fill: string): string {
  const earth = '#6b4a2b';
  const sky = '#7eb6d8';
  const top = shell === 'buried' || shell === 'basement' ? earth : sky;
  const bottom = shell === 'sky' ? sky : earth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256">
    <rect width="512" height="256" fill="${fill}"/>
    <rect width="512" height="36" fill="${top}"/>
    <rect y="220" width="512" height="36" fill="${bottom}"/>
    <rect x="70" y="70" width="370" height="120" fill="#f4e2b8" stroke="#3a2a1a" stroke-width="6"/>
  </svg>`;
}

async function main(): Promise<void> {
  for (const id of ids) {
    const hash = createHash('sha256').update(id).digest();
    const fill = `rgb(${80 + (hash[0] ?? 0) % 120},${70 + (hash[1] ?? 0) % 100},${60 + (hash[2] ?? 0) % 80})`;
    const dir = resolve(root, 'client/public/assets/buildings', id);
    mkdirSync(dir, { recursive: true });
    for (const shell of shells) {
      const buf = await sharp(Buffer.from(frame(shell, fill))).webp({ quality: 80 }).toBuffer();
      writeFileSync(resolve(dir, `${shell}.webp`), buf);
    }
  }
  console.log(`комнат: ${ids.length * shells.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
