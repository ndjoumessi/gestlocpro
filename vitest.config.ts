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
    // Les tests d'i18n comparent des chaînes formatées par Intl : sans fuseau
    // ni langue fixes, ils passeraient sur une machine et pas sur une autre.
    env: { TZ: 'UTC' },
  },
})
