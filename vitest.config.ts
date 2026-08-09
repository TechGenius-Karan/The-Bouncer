import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['content-engine/**/*.test.ts', 'netlify/functions/**/*.test.ts'],
  },
})
