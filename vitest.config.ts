import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'content-engine/**/*.test.ts',
      'netlify/functions/**/*.test.ts',
      'lib/**/*.test.ts',
      'src/**/*.test.ts',
      // vite.config.test.ts — the PWA navigation denylist lives in the build config.
      '*.test.ts',
    ],
  },
})
