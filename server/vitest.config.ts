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
    /**
     * Chargé AVANT tout module applicatif : il pose `DATABASE_URL` sur la base
     * de test et refuse de laisser tourner la suite sur une autre. Sans lui,
     * `env.ts` lit `server/.env` — celle du DÉVELOPPEMENT —, et les
     * `deleteMany()` de chaque cas la vident.
     */
    setupFiles: ['./src/test/setupEnv.ts'],
    // Les tests d'API partagent une base : les faire tourner en parallèle
    // ferait s'écraser leurs jeux de données. Un seul processus, séquentiel.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
})
