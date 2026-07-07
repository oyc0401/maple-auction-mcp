import { build } from 'esbuild';

const banner = {
  js: [
    '#!/usr/bin/env node',
    "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  ].join('\n'),
};

const common = { bundle: true, platform: 'node', target: 'node20', format: 'esm', banner };

await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js' });
await build({ ...common, entryPoints: ['src/broker.ts'], outfile: 'dist/broker.js' });

console.log('server built → dist/index.js, dist/broker.js');
