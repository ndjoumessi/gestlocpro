import { afterEach, beforeEach, vi } from 'vitest'

/**
 * RENDRE `process.env` TEL QU'ON L'A TROUVÉ — sans dépendre de l'ordre des
 * fichiers.
 *
 * ═══ LE COUPLAGE, ET POURQUOI IL EST RÉEL ═══
 *
 * `vitest.config.ts` pose `fileParallelism: false` : les fichiers de cette
 * suite tournent l'un après l'autre DANS LE MÊME PROCESSUS. Cinq d'entre eux
 * montent l'application en mode production, chacun avec un `CLIENT_DIST` qui
 * pointe sur un répertoire temporaire qu'il efface ensuite.
 *
 * Chacun photographiait `process.env` À SON IMPORT. Or un import a lieu quand
 * vitest charge le fichier, pas quand ses cas s'exécutent : la photographie
 * capture donc l'état laissé par ce qui précède. La restaurer PROPAGE la
 * pollution au lieu de la nettoyer — et le symptôme serait un `CLIENT_DIST`
 * pointant sur un répertoire effacé, donc un `ENOENT` dans un fichier qui n'a
 * rien fait de mal.
 *
 * ═══ CE QUE CE MODULE NE PRÉTEND PAS ═══
 *
 * Avoir corrigé une panne observée. Un passage de la porte serveur a rendu 1
 * rouge sur 436 entre deux verts, sans qu'on ait pu voir lequel, et il ne s'est
 * pas reproduit en huit passages. Ce module retire un couplage qui POUVAIT le
 * produire ; il ne démontre pas que c'était celui-là.
 *
 * Ce qu'il fait, en revanche, est vrai indépendamment : une photographie prise
 * dans `beforeEach` ne dépend d'aucun ordre, parce que chaque cas restaure ce
 * que LUI a trouvé.
 */
export function rendreLEnvironnementIntact() {
  let originaux: NodeJS.ProcessEnv = { ...process.env }

  beforeEach(() => {
    originaux = { ...process.env }
  })

  afterEach(() => {
    process.env = { ...originaux }
    /* Le registre des modules AUSSI : `env.ts` lit `process.env` à son import,
       donc un module gardé en cache porterait la configuration du cas
       précédent, quelle que soit la propreté de l'environnement. */
    vi.resetModules()
  })
}
