import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de la page de palette.
 *
 * Les pastilles de `KitchenSink` récitaient leur couleur : la surface venait
 * d'une classe utilitaire, l'étiquette d'une chaîne hexadécimale écrite à côté.
 * Deux sources pour une même donnée, dont une seule est vraie. Trois jetons ont
 * déjà été recorrigés pour le contraste depuis, et rien n'obligeait l'étiquette
 * à suivre — sur la page dont l'unique fonction est de dire la vérité sur la
 * palette, c'est le mensonge le plus coûteux du dépôt.
 *
 * Le thème sombre redéfinit ces mêmes jetons : une constante ne peut de toute
 * façon pas être juste dans les deux thèmes à la fois. Seule une lecture au
 * moment du rendu l'est.
 *
 * Pourquoi lire la SOURCE et non monter la page : jsdom ne charge pas
 * `tokens.css` et ne résout ni les couches ni `prefers-color-scheme`. Un test
 * de rendu constaterait `rgba(0, 0, 0, 0)` sur chaque pastille et validerait un
 * composant creux. Ce que le fichier peut prouver, c'est qu'aucune valeur n'y
 * est plus écrite en dur et que la lecture passe bien par le style calculé ; la
 * justesse des deux thèmes se constate au navigateur, et elle l'a été.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const PAGE = join(ICI, '..', 'routes', 'KitchenSink.tsx')
const CODE = readFileSync(PAGE, 'utf8')

describe('page de palette', () => {
  it('ne récite aucune couleur en hexadécimal', () => {
    const recitees = [...CODE.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(([v]) => v)
    expect(recitees).toEqual([])
  })

  it('lit la couleur réellement peinte plutôt qu’une constante', () => {
    expect(CODE).toContain('getComputedStyle')
  })
})
