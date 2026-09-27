import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * TOUT DÉFILEMENT PROGRAMMÉ EN DOUCEUR CONSULTE LA PRÉFÉRENCE DE MOUVEMENT.
 *
 * ═══ L'ANGLE MORT DE LA RÈGLE GLOBALE, ET IL EST DANS LA SPEC ═══
 *
 * `tokens.css` pose `scroll-behavior: auto !important` sous
 * `prefers-reduced-motion: reduce`, et `durees.test.ts` garde cette ligne. Elle
 * ne gouvernait RIEN là où ça comptait : CSSOM-View ne consulte le
 * `scroll-behavior` calculé que si l'appel passe `'auto'` ou ne dit rien. Un
 * `behavior: 'smooth'` explicite fait défiler en douceur quoi qu'en dise la
 * feuille de style — un `!important` l'emporte sur les déclarations
 * concurrentes, jamais sur un argument de fonction.
 *
 * MESURÉ EN LISANT LES APPELS le 2026-09-27 : un seul `behavior: 'smooth'` dans
 * tout `src/`, aux flèches du rail des logements, et c'était le SEUL mouvement du
 * produit qui ignorait la préférence. Il y échappait par le seul chemin que la
 * règle globale ne peut pas couvrir. Les deux autres appels de défilement —
 * `scrollIntoView` dans `Combobox` et `SignUp` — ne passent pas de `behavior` et
 * obéissent bien au CSS.
 *
 * ═══ POURQUOI UNE LECTURE DE SOURCE ET NON UN CAS D'ÉCRAN ═══
 *
 * Les flèches du rail ne paraissent que si le rail déborde, et sous jsdom aucun
 * rectangle n'existe : il ne déborde jamais, `glisser` y est inatteignable par
 * l'interface. Un cas d'écran n'aurait donc rien gardé ici — et surtout, il
 * n'aurait gardé QUE cet appel. Celle-ci tient la règle pour tout le dépôt : le
 * prochain `'smooth'` écrit ailleurs rougira sans qu'on ait à y penser.
 *
 * ═══ ELLE LIT LE CODE, PAS LA PROSE — ET C'EST LA MUTATION QUI L'A EXIGÉ ═══
 *
 * Premier jet : la recherche portait sur la source BRUTE. Le docbloc que le
 * correctif a posé dans `RailDeLogements` nomme `prefers-reduced-motion` sur
 * quatre lignes d'explication — donc retirer le CODE en gardant le COMMENTAIRE
 * laissait cette garde verte. Elle comparait une intention écrite à une absence
 * de garde, exactement comme la garde de l'en-tête de quittance qui « cherchait
 * `zone-imprimable` dans la source brute, où le nom apparaît trois fois en
 * commentaire avant le JSX ».
 *
 * Les commentaires sont donc retirés des DEUX côtés avant de chercher. Un
 * `'smooth'` cité en exemple dans un docbloc n'accuse plus personne, et une
 * préférence nommée en prose ne disculpe plus.
 *
 * ═══ CE QUE CETTE GARDE NE VOIT PAS ═══
 *
 * C'est une garde de PRÉSENCE. Elle exige que le fichier qui passe `'smooth'`
 * contienne, en code, une consultation de `prefers-reduced-motion` ; elle ne sait
 * pas si la condition est branchée sur le bon appel, ni si elle est inversée. Ce
 * qu'elle ferme est l'oubli — le cas réel, et celui qu'aucune lecture de
 * `tokens.css` ne pouvait montrer.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** `fs.globSync` n'existe qu'à partir de Node 22 ; le dépôt tourne en 20. */
function toutesLesSources(repertoire: string): string[] {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(repertoire, e.name)
    if (e.isDirectory()) return toutesLesSources(chemin)
    if (!/\.tsx?$/.test(e.name)) return []
    /* LES CAS SONT ÉCARTÉS, et il faut le dire : ce fichier-ci porte la chaîne
       cherchée dans sa propre prose. Se lire lui-même le rendrait éternellement
       rouge, et pour une raison qui n'est pas un défaut du produit. */
    if (/\.test\.tsx?$/.test(e.name)) return []
    return [chemin]
  })
}

/**
 * La source privée de ses commentaires.
 *
 * APPROXIMATION ASSUMÉE, et elle est du bon côté : une chaîne de caractères qui
 * contiendrait `/*` serait tronquée, ce qui ne peut que faire DISPARAÎTRE du code
 * de la vue — donc relâcher la garde, jamais inventer un fautif. Aucun fichier du
 * dépôt n'est dans ce cas, vérifié par le compte de sources plus haut et par le
 * fait que le seul appel connu est toujours trouvé.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('le défilement programmé', () => {
  it('ne part jamais en douceur sans consulter la préférence de mouvement', () => {
    const fichiers = toutesLesSources(SRC)
    /* LE COMPTE, POUR LA MÊME RAISON QUE PARTOUT AILLEURS DANS CE DÉPÔT :
       « zéro fautif » et « zéro fichier lu » s'écrivent pareil dans un rapport.
       Un chemin faux rendrait le plus rassurant des verts. */
    expect(
      fichiers.length,
      'aucune source parcourue : le chemin est faux, et ce cas ne mesure rien',
    ).toBeGreaterThan(100)

    const fautifs: string[] = []
    for (const fichier of fichiers) {
      const code = sansCommentaires(readFileSync(fichier, 'utf8'))
      if (!/behavior:\s*['"]smooth['"]/.test(code)) continue
      if (/prefers-reduced-motion/.test(code)) continue
      fautifs.push(relative(SRC, fichier))
    }

    expect(
      fautifs,
      `défilement en douceur sans garde de mouvement réduit : ${fautifs.join(', ')} — ` +
        'la règle de `tokens.css` ne les atteint pas, un argument de fonction battant le style calculé',
    ).toEqual([])
  })
})
