import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/api/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    pool: 'forks',
    reporters: ['default'],
  },
})