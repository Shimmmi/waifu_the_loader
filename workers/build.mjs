import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@wl/'));

await build({
  entryPoints: { index: 'src/index.ts', 'refill-once': 'src/refill-once.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
console.log('workers built');
