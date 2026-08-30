import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LE ROUTAGE DE L'AGENT DE SERVICE, ÉPROUVÉ SANS NAVIGATEUR.
 *
 * ═══ POURQUOI CE FICHIER EXISTE, ET PAS SEULEMENT UNE RELECTURE ═══
 *
 * Un agent de service est le seul code du produit qui SURVIT à son correctif.
 * Une page mal peinte se répare au déploiement suivant ; un `index.html` mis en
 * cache renvoie éternellement vers un paquet qui n'existe plus, l'écran reste
 * blanc, et l'utilisateur n'a aucun geste à sa disposition. Le routage est ce
 * qui décide de tout cela, et c'est la seule partie qu'on peut éprouver sans
 * ouvrir un navigateur.
 *
 * ═══ COMMENT ON L'ÉPROUVE ═══
 *
 * `public/sw.js` est LU et évalué avec un `self` de comédie. C'est le procédé
 * que `mesure-ui.mjs` emploie déjà pour `contrast-audit.js` : le fichier réel,
 * pas une copie — une seconde rédaction dériverait, et ce dépôt a déjà payé ce
 * silence-là.
 *
 * L'agent expose `self.strategiePour` pour cette raison, et c'est une couture
 * assumée : le reste du fichier est fait d'écouteurs d'événements, qui ne se
 * testent qu'avec un vrai navigateur et un vrai réseau.
 *
 * ═══ CE QUE CES CAS NE DISENT PAS ═══
 *
 * Que le cache fonctionne. Ils disent QUELLE stratégie s'applique à quelle
 * requête ; ils ne mettent rien en cache et n'en relisent rien. Qu'une page
 * s'ouvre vraiment hors ligne se vérifie dans un navigateur, en coupant le
 * réseau — et aucune porte de ce dépôt ne le fait aujourd'hui.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ORIGINE = 'https://exemple.test'

/**
 * Charge le VRAI `public/sw.js` et rend sa fonction de routage.
 *
 * `new Function` EST ICI SANS RISQUE, et il faut le dire parce que la
 * construction alarme à juste titre partout ailleurs : ce qu'on évalue est un
 * FICHIER DE CE DÉPÔT, lu sur le disque, dans un test qui ne tourne jamais en
 * production. Aucune entrée extérieure n'entre dans cette chaîne, et rien n'y
 * est interpolé. C'est le même procédé — et la même justification écrite — que
 * `mesure-ui.mjs` emploie pour `contrast-audit.js`.
 */
function routageDeLAgent(): (requete: unknown, origine: string) => string {
  const source = readFileSync(join(RACINE, 'public', 'sw.js'), 'utf8')
  const faux: Record<string, unknown> = {
    addEventListener: () => {},
    location: { origin: ORIGINE },
  }
  new Function('self', 'caches', 'fetch', source)(faux, undefined, undefined)
  const routage = faux.strategiePour
  expect(typeof routage, '`sw.js` n’expose plus `self.strategiePour`').toBe('function')
  return routage as (requete: unknown, origine: string) => string
}

const requete = (url: string, extra: Record<string, unknown> = {}) => ({
  method: 'GET',
  mode: 'no-cors',
  url,
  ...extra,
})

describe('le routage de l’agent de service', () => {
  const strategiePour = routageDeLAgent()
  const decide = (r: Record<string, unknown>) => strategiePour(r, ORIGINE)

  it('va au RÉSEAU d’abord pour une navigation', () => {
    /* Le document nomme les paquets : servi depuis un cache, il désignerait des
       fichiers qui n'existent plus. C'est LA règle qui rend un déploiement
       capable de passer devant l'agent. */
    expect(decide(requete(`${ORIGINE}/demo/paiements`, { mode: 'navigate' }))).toBe(
      'reseau-d-abord',
    )
  })

  it('va au CACHE d’abord pour un actif haché', () => {
    /* Sans risque : le nom porte un hachage de CONTENU. `index-BWrRwvP9.js` ne
       désignera jamais deux paquets différents. */
    expect(decide(requete(`${ORIGINE}/assets/index-BWrRwvP9.js`))).toBe('cache-d-abord')
    expect(decide(requete(`${ORIGINE}/assets/index-DBZtOzaE.css`))).toBe('cache-d-abord')
  })

  it('IGNORE l’API, toujours', () => {
    /* Le cas le plus grave si on se trompait : servir depuis un cache l'état
       d'un parc montrerait un loyer encaissé qui ne l'est plus, une caution
       rendue qui ne l'est pas. */
    expect(decide(requete(`${ORIGINE}/api/parks`))).toBe('ignorer')
    expect(decide(requete(`${ORIGINE}/api/auth/me`))).toBe('ignorer')
  })

  it('IGNORE ce qui n’est pas un GET', () => {
    /* Un encaissement mis en cache serait rejoué ou avalé. Aucune écriture ne
       passe par ici. */
    expect(decide(requete(`${ORIGINE}/api/parks`, { method: 'POST' }))).toBe('ignorer')
    expect(decide(requete(`${ORIGINE}/demo`, { method: 'POST', mode: 'navigate' }))).toBe('ignorer')
  })

  it('IGNORE les autres origines', () => {
    /* La fonderie pose ses propres en-têtes, et le cache HTTP fait déjà ce
       travail. S'en mêler ajouterait un cache par-dessus un cache. */
    expect(decide(requete('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans'))).toBe(
      'ignorer',
    )
    expect(decide(requete('https://fonts.gstatic.com/s/plusjakartasans/x.woff2'))).toBe('ignorer')
  })

  it('IGNORE ce qui n’est ni navigation ni actif haché', () => {
    /* `/logo.svg`, `/manifest.webmanifest`, `/icone-192.png` : servis rarement,
       et leur nom ne porte AUCUN hachage — les mettre en cache demanderait une
       stratégie de péremption que ce fichier n'a pas. */
    expect(decide(requete(`${ORIGINE}/logo.svg`))).toBe('ignorer')
    expect(decide(requete(`${ORIGINE}/manifest.webmanifest`))).toBe('ignorer')
  })
})

describe('l’enregistrement de l’agent', () => {
  const main = readFileSync(join(RACINE, 'src', 'main.tsx'), 'utf8')

  it('n’a lieu qu’en production', () => {
    /* En développement, un cache entre le serveur de Vite et la page rendrait le
       rechargement à chaud imprévisible — un doute qui coûte une heure avant
       qu'on y pense. */
    expect(main).toMatch(/import\.meta\.env\.PROD[\s\S]{0,80}serviceWorker/)
  })

  it('ne lit jamais l’agent depuis le cache HTTP', () => {
    /* `express.static` pose `max-age=1h` sur tout, `/sw.js` compris. Sans
       `updateViaCache: 'none'`, une correction d'agent pourrait attendre une
       heure avant d'être seulement TÉLÉCHARGÉE — exactement le délai qu'on ne
       veut pas entre une bévue de cache et son remède. */
    expect(main).toContain("updateViaCache: 'none'")
  })

  it('porte une version de cache, qui est la sortie de secours', () => {
    /* Changer `VERSION` fait table rase à l'activation. C'est le geste qui
       répare une bévue de cache, et il doit rester trouvable : sans lui, la
       seule issue serait de demander à chaque utilisateur de vider son
       navigateur. */
    const agent = readFileSync(join(RACINE, 'public', 'sw.js'), 'utf8')
    expect(agent).toMatch(/const VERSION = '[^']+'/)
    expect(agent, 'les caches doivent être nommés PAR la version').toMatch(
      /gestlocpro-\w+-\$\{VERSION\}/,
    )
  })
})
