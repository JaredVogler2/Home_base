import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'shared',
          environment: 'node',
          include: ['tests/shared/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Each file gets its own database; files run in parallel, tests inside a file in order.
          fileParallelism: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: ['tests/client/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/client/setup.ts'],
        },
      },
    ],
  },
});
