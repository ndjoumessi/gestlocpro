import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  /**
   * L'API est servie sous la même origine que le client en développement.
   *
   * Elle tourne sur le port 3001, et le client pourrait l'appeler directement —
   * la politique CORS du serveur l'autorise. Passer par un mandataire vaut
   * mieux pour une raison qui n'est pas le confort : le cookie de session
   * devient **de première partie**. Deux origines distinctes en font un cookie
   * tiers, que Safari bloque par défaut et que Chrome s'apprête à bloquer —
   * l'authentification marcherait sur la machine du développeur et nulle part
   * ailleurs.
   *
   * C'est aussi la disposition de la production, où le client et l'API vivent
   * derrière un même domaine : le développement cesse de tester un montage que
   * personne ne déploiera.
   */
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
})
