import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
/*
  `./dates.js` ET NON `./dates` : ce fichier est compilé par
  `tsconfig.node.json`, qui résout en `node16` — la spécification ESM y exige
  une extension explicite, et l'extension d'un module TypeScript compilé est
  `.js`. Vite et Vitest remappent vers la source `.ts` à l'exécution.

  Les gardes voisines n'ont pas ce problème parce qu'aucune n'importe de code du
  produit : elles lisent des fichiers en TEXTE. Celle-ci le doit — son premier
  cas vérifie un CALCUL, et un test qui relirait la soustraction dans la source
  serait d'accord avec elle par construction.
*/
import { formatFullDate, partiesDeDateISO } from './dates.js'

/**
 * UNE DATE ISO SE CONVERTIT PAR UN SEUL CHEMIN, ET IL RETRANCHE UN.
 *
 * LE DÉFAUT, ET IL ÉTAIT EN PRODUCTION. `AAAA-MM-JJ` compte ses mois à partir
 * de UN ; tout le reste de ce produit les compte à partir de ZÉRO, parce que
 * c'est la convention de `new Date(y, m, d)` que les formateurs emploient et
 * celle que `getMonth()` rend. La conversion doit donc retrancher un.
 *
 * Elle était recopiée QUATRE fois, et TROIS copies l'oubliaient. Trois écrans
 * affichaient donc leurs dates avec un mois de trop :
 *
 *   · l'historique des prix de refacturation — un prix posé au 1ᵉʳ août se
 *     lisait « 01/09 », sur l'écran dont toute la doctrine est qu'un prix n'est
 *     jamais modifié mais REDATÉ ;
 *   · la date de règlement d'une QUITTANCE, que le locataire garde comme preuve ;
 *   · la date d'un état des lieux fraîchement enregistré.
 *
 * POURQUOI RIEN NE L'A VU. 1 167 cas passaient avant la correction et 1 167
 * après : aucun ne rendait une date VENUE DU SERVEUR. La démonstration porte
 * ses dates en parties déjà découpées — elle ne passe jamais par cette
 * conversion — et c'est elle que jouent les tests d'écran. Le seul chemin qui
 * l'exerce est le parc réel, qu'aucun test ne monte.
 *
 * ET LE PREMIER DES TROIS ÉTAIT INATTEIGNABLE : la modale des prix était gardée
 * par une adhésion réelle, donc invisible aux trois portes et à tout regard. Il
 * a fallu la rendre ouvrable en démonstration pour que le décalage se montre —
 * à la première capture, en toutes lettres.
 *
 * CE FICHIER TIENT LES DEUX BOUTS. Le premier cas vérifie le CALCUL, jusqu'au
 * texte rendu : un test sur les parties seules resterait d'accord avec
 * lui-même si la convention du formateur changeait. Le second interdit la
 * QUATRIÈME copie — c'est la recopie, et non l'erreur, qui a fait le défaut.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

function sources(depuis: string): string[] {
  const trouves: string[] = []
  for (const nom of readdirSync(depuis)) {
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) trouves.push(...sources(chemin))
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) trouves.push(chemin)
  }
  return trouves
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('conversion d’une date ISO', () => {
  it('retranche un au mois, jusqu’au texte rendu', () => {
    // `en-GB` rend jour/mois/année : l'ordre est stable, donc l'assertion porte
    // sur le mois et non sur une position devinée.
    const parties = partiesDeDateISO('2026-08-01')
    expect(parties).toEqual({ year: 2026, month: 7, day: 1 })
    expect(formatFullDate(parties.year, parties.month, parties.day, 'en-GB')).toBe('01/08/2026')
  })

  it('ne dérape ni en janvier ni en décembre', () => {
    // Les deux bornes : un mois ISO de 1 doit rendre l'index 0, un de 12 rendre
    // 11. Un décalage de signe ferait basculer l'un des deux d'une ANNÉE.
    expect(formatFullDate(...bornes('2026-01-15'), 'en-GB')).toBe('15/01/2026')
    expect(formatFullDate(...bornes('2026-12-31'), 'en-GB')).toBe('31/12/2026')
  })

  it('ignore l’heure quand le serveur en rend une', () => {
    // Sans `slice(0, 10)`, le découpage mettrait « 01T00:00:00Z » dans le jour.
    expect(partiesDeDateISO('2026-08-01T14:30:00Z')).toEqual({ year: 2026, month: 7, day: 1 })
  })

  it('n’est écrite qu’une fois dans tout le dépôt', () => {
    /*
      LE MOTIF VISE LE DÉCOUPAGE, pas la soustraction : c'est la recopie qui a
      produit le défaut, et une copie CORRECTE serait le prochain endroit d'où
      il repartirait. `dates.ts` est le seul fichier autorisé, parce que c'est
      lui qui définit la convention que la conversion doit respecter.
    */
    const decoupage = /\.split\(\s*['"]-['"]\s*\)\s*\.map\(\s*Number\s*\)/
    const fautifs: string[] = []
    let fichiersLus = 0

    for (const chemin of sources(SRC)) {
      fichiersLus++
      if (relative(SRC, chemin) === 'lib/dates.ts') continue
      const source = sansCommentaires(readFileSync(chemin, 'utf8'))
      for (const [index, ligne] of source.split('\n').entries()) {
        if (!decoupage.test(ligne)) continue
        /*
          `periodStart` de la quittance est EXCLU, et c'est mesuré : il ne
          découpe que l'année et le mois d'une PÉRIODE — « 2026-08 » — pour les
          comparer, jamais pour les formater. Le jour n'y est pas, la convention
          d'index non plus. L'inclure obligerait à l'exempter par un commentaire
          plutôt que par sa forme, ce qui est moins solide.
        */
        if (/\[\s*\w+\s*,\s*\w+\s*\]/.test(ligne)) continue
        fautifs.push(`${relative(SRC, chemin)}:${index + 1}`)
      }
    }

    // GARDE DE LA GARDE : un parcours cassé ne lirait rien et la liste des
    // fautifs serait vide pour la pire des raisons.
    expect(fichiersLus).toBeGreaterThan(50)
    expect(fautifs).toEqual([])
  })
})

/** Les trois parties dans l'ordre qu'attend `formatFullDate`. */
function bornes(iso: string): [number, number, number] {
  const { year, month, day } = partiesDeDateISO(iso)
  return [year, month, day]
}
