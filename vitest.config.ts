import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/test/**/*.test.ts', 'server/src/**/*.test.ts', 'extension/test/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
