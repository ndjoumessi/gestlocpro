/**
 * Node peut-il CHARGER le serveur compilé ?
 *
 * La question n'a l'air de rien, et pourtant aucune des deux portes du dépôt ne
 * la posait. `tsc -b` vérifie les types ; Vitest exécute les sources avec son
 * propre résolveur, qui accepte des imports que Node refuse. Le déploiement du
 * 19 août l'a montré : les 247 cas serveur au vert, l'image construite,
 * `migrate deploy` passé — et le conteneur en boucle de redémarrage sur
 *
 *   Cannot find module '/app/server/dist/src/generated/prisma/enums'
 *
 * Le client généré par Prisma 7 écrivait `from './enums'` sans extension. Le
 * fichier existait, à trois caractères près : la résolution ESM de Node ne
 * devine pas, là où TypeScript et Vitest complètent.
 *
 * On charge `app.js` et `db.js`, et non `index.js` : ce dernier appelle
 * `listen` à l'import, et une porte n'a pas à ouvrir un port. Les deux couvrent
 * tout le graphe sauf les trois lignes de démarrage — dont celle qui échouait,
 * puisque `db.js` est précisément ce qui importe le client généré.
 */
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const cibles = ['dist/src/app.js', 'dist/src/db.js']

for (const cible of cibles) {
  const chemin = resolve(process.cwd(), cible)
  if (!existsSync(chemin)) {
    console.error(`✗ ${cible} est absent — lancez \`npm run build\` avant.`)
    process.exit(1)
  }
  try {
    await import(pathToFileURL(chemin).href)
  } catch (erreur) {
    console.error(`✗ Node refuse de charger ${cible} :`)
    console.error(`  ${erreur.message}`)
    process.exit(1)
  }
}

console.log('✓ Node charge le serveur compilé.')
