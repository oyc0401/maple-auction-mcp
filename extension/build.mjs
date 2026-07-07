import { build } from 'esbuild';

await build({
  entryPoints: ['src/background.ts'],
  bundle: true,
  outfile: 'dist/background.js',
  format: 'esm',
  target: 'chrome120',
});
console.log('extension built → dist/background.js');
