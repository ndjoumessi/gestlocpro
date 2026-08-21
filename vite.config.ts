import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { writeFileSync } from 'node:fs'

/**
 * ÉCRIT LA CARTE DES PAQUETS, pour que `scripts/mesure-ui.mjs` sache quel
 * fichier SOURCE a fini dans quel paquet CONSTRUIT — sans quoi la garde de
 * fuite de ce fichier devrait deviner, ou pire, recopier une liste qui se
 * périme dès le prochain écran ajouté.
 *
 * `generateBundle` est le SEUL moment où Rollup connaît la réponse : avant,
 * les paquets n'existent pas encore ; après (`closeBundle`), le fichier est
 * déjà écrit sur disque et il faudrait le relire pour en tirer la même
 * information que ce module a déjà en mémoire.
 *
 * ÉCRITE HORS DE `dist/`, volontairement. `dist/` est ce qu'un navigateur
 * télécharge ; cette carte ne sert qu'à la porte, jamais au produit, et
 * l'ajouter au dossier déployé exposerait la disposition interne du dépôt
 * pour zéro bénéfice. Elle est donc écrite à la racine, sous un nom que
 * `.gitignore` connaît déjà — un artefact de build, régénéré à chaque
 * `vite build`, jamais commité.
 */
function carteDesPaquets(): Plugin {
  return {
    name: 'carte-des-paquets',
    apply: 'build',
    generateBundle(_options, bundle) {
      const carte: Record<string, { isDynamicEntry: boolean; modules: string[] }> = {}
      for (const [nomFichier, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue
        carte[nomFichier] = {
          isDynamicEntry: chunk.isDynamicEntry,
          // Filtré à `/src/` : les dépendances de `node_modules` ne sont pas
          // ce que la garde de fuite examine, et les lister alourdirait le
          // fichier sans rien ajouter à ce qu'il sert.
          modules: Object.keys(chunk.modules)
            .filter((id) => id.includes('/src/'))
            .map((id) => id.slice(id.indexOf('/src/') + '/src/'.length)),
        }
      }
      writeFileSync(path.resolve(__dirname, '.carte-des-paquets.json'), JSON.stringify(carte))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), carteDesPaquets()],
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
