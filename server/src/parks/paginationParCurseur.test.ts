import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ORDRE_DE_PAGE,
  TAILLE_DE_PAGE,
  bornesDuCurseur,
  decouperLaPage,
  lireCurseur,
} from './curseurDePage.js'

/**
 * LA GARDE DES PAGINATIONS À VENIR.
 *
 * Le registre des décisions a perdu une ligne par frontière de page pendant
 * toute la vie de sa route. Le lot qui l'a corrigé s'est fermé sur ce qu'il ne
 * couvrait pas : « ce registre est le seul de ce produit à paginer, donc
 * l'inventaire est complet AUJOURD'HUI — il ne l'est pas pour la prochaine
 * liste qu'on paginera, et rien dans le dépôt ne rappellera cette règle à qui
 * l'écrira. » Nelson a demandé cette garde.
 *
 * ═══ ELLE NE PRÉVIENT PAS, ELLE ORIENTE ═══
 *
 * Un cas qui dirait « attention aux ex æquo » ne serait qu'un commentaire
 * exécutable : il rougirait APRÈS coup, sur du code déjà écrit et déjà
 * raisonné de travers. Ce fichier fait autre chose — il exige que toute
 * pagination passe par `curseurDePage`, où la règle est appliquée une fois pour
 * toutes. Le geste correct devient le geste le plus court ; le geste faux
 * devient celui qui fait rougir une porte.
 *
 * ═══ LE SIGNAL, ET POURQUOI CELUI-LÀ ═══
 *
 * `take:` dont la valeur n'est pas `1`. Mesuré sur tout `server/src` au moment
 * d'écrire : DEUX occurrences, dont une dans un commentaire — le signal ne
 * coûte donc aucun faux positif aujourd'hui. Il est choisi sur la FORME du
 * défaut et non sur un nom : une route qui appellerait son curseur `next`
 * plutôt que `suivant` serait tout de même attrapée, parce qu'on ne pagine pas
 * sans lire plus d'une ligne.
 *
 * `take: 1` est exclu à dessein : « la dernière échéance de ce bail » n'est pas
 * une page, c'est une sélection. Ce fichier en compte plusieurs, et aucune ne
 * pose la question du curseur.
 */

const RACINE = new URL('..', import.meta.url).pathname

/** Tous les `.ts` du serveur, sauf le généré et les cas eux-mêmes. */
function sourcesDuServeur(dossier = RACINE): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) {
      if (entree.name === 'generated' || entree.name === 'node_modules') continue
      trouves.push(...sourcesDuServeur(chemin))
    } else if (entree.name.endsWith('.ts') && !entree.name.endsWith('.test.ts')) {
      trouves.push(chemin)
    }
  }
  return trouves
}

/** Les lignes `take:` qui paginent — `take: 1` sélectionne, il ne pagine pas. */
function lignesQuiPaginent(source: string): string[] {
  return source
    .split('\n')
    .filter((ligne) => /(^|\s)take:\s*[^1\s]/.test(ligne) || /(^|\s)take:\s*1\s*\+/.test(ligne))
    .map((l) => l.trim())
}

describe('toute pagination passe par le curseur partagé', () => {
  it('n’écrit aucune pagination à la main dans le serveur', () => {
    const fautifs: string[] = []
    for (const fichier of sourcesDuServeur()) {
      if (fichier.endsWith('curseurDePage.ts')) continue
      const source = readFileSync(fichier, 'utf8')
      /* Le commentaire ne pagine pas : on ne regarde que le CODE, en retirant
         les blocs et les lignes de commentaire avant de chercher le signal. */
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const paginantes = lignesQuiPaginent(code)
      if (paginantes.length === 0) continue

      if (!/from '\.{1,2}(\/parks)?\/curseurDePage\.js'/.test(source)) {
        fautifs.push(
          `${fichier.replace(RACINE, '')} pagine (${paginantes[0]}) sans importer curseurDePage`,
        )
      }
    }
    expect(
      fautifs,
      'une pagination écrite à la main reperdra les ex æquo : voir `curseurDePage.ts`',
    ).toEqual([])
  })
})

/**
 * ET LA RÈGLE ELLE-MÊME, GARDÉE SUR LE HELPER.
 *
 * La garde de source ci-dessus dit « on passe bien par là » ; ces cas disent
 * « et là, c'est juste ». Sans eux, un helper cassé serait employé partout,
 * uniformément, et la première garde resterait verte.
 */
describe('le curseur partagé', () => {
  it('ordonne sur un COUPLE, jamais sur un seul champ', () => {
    /* C'est la moitié qu'on oublie : le tri et le curseur doivent porter sur
       les mêmes champs. Un ordre à un seul champ rend la frontière ambiguë
       même avec un curseur composé. */
    expect(ORDRE_DE_PAGE.length).toBeGreaterThan(1)
    expect(ORDRE_DE_PAGE[ORDRE_DE_PAGE.length - 1]).toEqual({ id: 'desc' })
  })

  it('compare le couple, et non la seule date', () => {
    const quand = new Date('2026-09-07T12:00:00.000Z')
    const bornes = bornesDuCurseur({ quand, id: 'b' }) as {
      OR: { createdAt: unknown; id?: unknown }[]
    }
    expect(bornes.OR, 'deux branches : date antérieure, OU date égale et id plus petit').toHaveLength(
      2,
    )
    expect(bornes.OR[1]).toEqual({ createdAt: quand, id: { lt: 'b' } })
  })

  it('accepte un curseur d’avant le couple, sans le refuser bruyamment', () => {
    /* Une page ouverte pendant un déploiement tient l'ancien format. Elle
       retombe sur l'ancien comportement pour ce clic-là plutôt que de rendre
       une erreur au milieu d'un défilement. */
    const ancien = lireCurseur('2026-09-07T12:00:00.000Z')
    expect(ancien?.id).toBeNull()
    expect(bornesDuCurseur(ancien)).toEqual({ createdAt: { lt: ancien!.quand } })
  })

  it('rend `null` sur un curseur illisible, plutôt qu’une erreur', () => {
    expect(lireCurseur('pas-une-date')).toBeNull()
    expect(lireCurseur(undefined)).toBeNull()
    expect(bornesDuCurseur(null), 'pas de curseur, pas de borne').toEqual({})
  })

  it('ne rend un curseur suivant QUE s’il y a une suite', () => {
    const ligne = (i: number) => ({ id: `id-${i}`, createdAt: new Date(2026, 8, 1, 0, i) })
    const pleine = Array.from({ length: TAILLE_DE_PAGE + 1 }, (_, i) => ligne(i))
    const courte = Array.from({ length: 3 }, (_, i) => ligne(i))

    const avecSuite = decouperLaPage(pleine)
    expect(avecSuite.page).toHaveLength(TAILLE_DE_PAGE)
    /* LA LIGNE DE PLUS EST DEMANDÉE, PAS RENDUE : elle ne sert qu'à savoir
       qu'il y a une suite, sans un second appel de comptage. */
    expect(avecSuite.suivant, 'le curseur porte le couple').toContain('|id-99')

    expect(decouperLaPage(courte).suivant, 'trois lignes tiennent en une page').toBeNull()
  })
})
