import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: { '@linden-shelf/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'server', environment: 'node', include: ['packages/**/*.test.ts', 'services/catalogue-api/**/*.test.ts', 'tests/**/*.integration.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'web', environment: 'jsdom',
          include: ['services/catalogue-web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['services/catalogue-web/src/test-setup.ts'],
        },
      },
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['packages/contracts/src/**/*.ts', 'services/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/test-setup.ts', 'services/catalogue-api/src/server.ts', 'services/catalogue-web/src/main.tsx'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { perFile: true, statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});