import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN TEST QUI LIT LE DISQUE EST INSCRIT DANS LES DEUX PROJETS TYPESCRIPT.
 *
 * ═══ CE QUE SON ABSENCE A COÛTÉ ═══
 *
 * Le 2026-09-03, le déploiement de `ce86a65` a été REFUSÉ par le build de
 * production, sur les deux services à la fois :
 *
 *     portesSansApiLocale.test.ts(1,30): error TS2307:
 *     Cannot find module 'node:fs' or its corresponding type declarations.
 *
 * Le fichier était neuf et n'était inscrit nulle part. Il tombait donc dans
 * `tsconfig.app.json`, dont l'`include` vaut `["src"]` — le seul projet où ses
 * trois imports sont interdits.
 *
 * ═══ LA RÈGLE, ET POURQUOI ELLE EXISTE ═══
 *
 * `tsconfig.app.json` porte `"types": ["vite/client"]`, et son commentaire dit
 * pourquoi : « éviter d'ouvrir les types Node à tout le code d'application, où
 * `process` et `Buffer` n'ont rien à faire ». C'est une bonne règle. Son prix
 * est que tout test qui lit le disque doit être déplacé À LA MAIN vers
 * `tsconfig.node.json`, qui lui porte `"types": ["node"]` — donc inscrit DEUX
 * fois : en `exclude` du projet applicatif, en `include` du projet Node.
 *
 * DEUX LISTES TENUES À LA MAIN QUI DOIVENT RESTER D'ACCORD : c'est la forme
 * même de la panne. Rien ne rougissait quand elles divergeaient, et rien ne
 * rougissait quand un fichier neuf n'était dans ni l'une ni l'autre. La seule
 * chose qui l'a dit est un build de production, quarante minutes plus tard.
 *
 * ═══ CE QUE LA GARDE VÉRIFIE, ET DANS LES DEUX SENS ═══
 *
 * Elle n'exige pas un NOMBRE — il changera, et une garde qui refuse un test
 * neuf parce qu'il est neuf ne sert personne. Elle exige une ÉGALITÉ entre
 * trois ensembles : ce que le disque contient, ce que le projet applicatif
 * écarte, ce que le projet Node reprend. Mesuré au jour de l'écriture : 41,
 * 41 et 41, sans un écart.
 *
 * Le sens inverse compte autant. Une entrée qui reste après que son fichier a
 * disparu, ou après qu'il a cessé d'importer `node:`, est une exemption morte :
 * elle sort le fichier du projet applicatif sans raison, et personne ne le
 * remarque puisque rien ne casse.
 *
 * ═══ CE QUE CETTE GARDE NE DIT PAS ═══
 *
 * Que le projet compile. C'est `tsc -b` qui le dit, et lui seul. Cette garde
 * tient une CONVENTION DE RANGEMENT ; elle serait verte sur un fichier
 * parfaitement rangé et par ailleurs plein d'erreurs de type.
 *
 * Elle lit aussi les deux `tsconfig` comme du TEXTE, par expression régulière,
 * et non comme du JSON — ces fichiers portent des commentaires, que `JSON.parse`
 * refuse. Un chemin de test cité DANS un commentaire serait donc compté comme
 * une inscription. C'est une faiblesse connue, et le prix d'une lecture qui
 * n'ajoute pas de dépendance.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Tous les fichiers de test sous `src`, en chemins relatifs à la racine. */
function tousLesTests(repertoire: string): string[] {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(repertoire, e.name)
    if (e.isDirectory()) return tousLesTests(chemin)
    return /\.test\.tsx?$/.test(e.name) ? [relative(RACINE, chemin)] : []
  })
}

/**
 * Les chemins de test cités dans un `tsconfig`.
 *
 * Lecture textuelle : ces fichiers portent des commentaires, et `JSON.parse`
 * les refuse. Voir l'en-tête pour ce que cela coûte.
 */
function inscritsDans(fichier: string): Set<string> {
  const source = readFileSync(join(RACINE, fichier), 'utf8')
  return new Set(
    [...source.matchAll(/"(src\/[^"]+\.test\.tsx?)"/g)].map((m) => m[1]),
  )
}

/** Ceux qui atteignent Node, et ne peuvent donc pas vivre dans le projet applicatif. */
function lisentLeDisque(): Set<string> {
  return new Set(
    tousLesTests(join(RACINE, 'src')).filter((rel) =>
      /from 'node:/.test(readFileSync(join(RACINE, rel), 'utf8')),
    ),
  )
}

function manquants(attendu: Set<string>, liste: Set<string>): string[] {
  return [...attendu].filter((f) => !liste.has(f)).sort()
}

describe('les tests qui lisent le disque', () => {
  it('sont tous ÉCARTÉS du projet applicatif', () => {
    const absents = manquants(lisentLeDisque(), inscritsDans('tsconfig.app.json'))
    expect(
      absents,
      'ces tests importent `node:` et restent dans `tsconfig.app.json`, ' +
        'dont les types ne connaissent pas Node — `tsc -b` les refusera :\n  ' +
        absents.join('\n  '),
    ).toEqual([])
  })

  it('sont tous REPRIS par le projet Node', () => {
    const absents = manquants(lisentLeDisque(), inscritsDans('tsconfig.node.json'))
    expect(
      absents,
      'écartés du projet applicatif sans être repris ailleurs, ces tests ne ' +
        'seraient plus typés du tout :\n  ' + absents.join('\n  '),
    ).toEqual([])
  })

  it('ne laissent AUCUNE inscription morte derrière eux', () => {
    /* Le sens inverse : une entrée qui survit à son fichier, ou à son besoin
       de Node, sort ce fichier du projet applicatif sans raison — et rien ne
       casse, donc personne ne le voit. */
    const besoin = lisentLeDisque()
    for (const fichier of ['tsconfig.app.json', 'tsconfig.node.json']) {
      const mortes = [...inscritsDans(fichier)].filter((f) => !besoin.has(f)).sort()
      expect(
        mortes,
        `${fichier} inscrit des tests qui n'importent plus \`node:\` ` +
          '(ou qui ont disparu) :\n  ' + mortes.join('\n  '),
      ).toEqual([])
    }
  })

  it('sont inscrits IDENTIQUEMENT dans les deux projets', () => {
    /* Les deux listes sont tenues à la main. Qu'elles couvrent chacune le
       besoin ne dit pas qu'elles s'accordent entre elles : un fichier écarté
       ici et repris là sous un autre chemin passerait les trois cas ci-dessus. */
    const app = [...inscritsDans('tsconfig.app.json')].sort()
    const node = [...inscritsDans('tsconfig.node.json')].sort()
    expect(app, 'les deux listes ont divergé').toEqual(node)
  })
})
