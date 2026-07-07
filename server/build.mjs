import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    ].join('\n'),
  },
});
console.log('server built → dist/index.js');
