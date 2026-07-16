import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const banner = {
  js: [
    '#!/usr/bin/env node',
    "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  ].join('\n'),
};

const common = { bundle: true, platform: 'node', target: 'node20', format: 'esm', banner };

await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js' });
await build({ ...common, entryPoints: ['src/broker/broker.ts'], outfile: 'dist/broker.js' });

// 지식 노트 동봉 — 리포 밖(배포 환경)에서도 maple://knowledge 리소스가 동작하도록
mkdirSync(new URL('dist/', import.meta.url), { recursive: true });
copyFileSync(new URL('../maple_knowledge.md', import.meta.url), new URL('dist/maple_knowledge.md', import.meta.url));

console.log('server built → dist/index.js, dist/broker.js (+maple_knowledge.md)');
