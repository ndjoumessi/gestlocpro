import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Les tests d'API partagent une base : les faire tourner en parallèle
    // ferait s'écraser leurs jeux de données. Un seul processus, séquentiel.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
})
