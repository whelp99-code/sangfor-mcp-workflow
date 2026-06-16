import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@sangfor/workflow-shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@sangfor/workflow-core': resolve(__dirname, 'packages/workflow-core/src/index.ts'),
      '@sangfor/workflow-engine': resolve(__dirname, 'packages/workflow-engine/src/index.ts'),
      '@sangfor/health-checker': resolve(__dirname, 'packages/health-checker/src/index.ts'),
      '@sangfor/wiki-sync': resolve(__dirname, 'packages/wiki-sync/src/index.ts'),
    },
  },
});
