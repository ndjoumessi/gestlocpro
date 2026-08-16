import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Le front seulement. `server/` est un paquet à part, avec son propre
    // `vitest.config.ts`, son environnement Node et sa base de données : sans
    // cette borne, la suite du client ramasse les tests d'API et les fait
    // échouer sur une configuration qu'elle n'a jamais eu à connaître.
    include: ['src/**/*.test.{ts,tsx}'],
    // Les tests d'i18n comparent des chaînes formatées par Intl : sans fuseau
    // ni langue fixes, ils passeraient sur une machine et pas sur une autre.
    env: { TZ: 'UTC' },
  },
})
