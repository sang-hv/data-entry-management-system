import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Integration tests share the same Postgres database; running them in
    // parallel causes test pollution. Force single-thread sequential execution.
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
