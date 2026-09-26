import { describe, expect, it } from 'vitest'
import { installerFauxServeur } from '@/test/api'
import { renderApp, attendreLeChargement } from '@/test/render'

/**
 * ═══ DEUX GRAPHES VOISINS PEINTS DE LA MÊME ENCRE ═══
 *
 * L'espace du locataire pose côte à côte douze colonnes d'eau et douze
 * colonnes d'électricité. `MiniBarChart` peignait toutes ses barres
 * `--color-data-1`, sans réglage : relevé au navigateur, `rgb(19, 26, 34)` des
 * deux côtés. Seul le titre distinguait les deux séries, et il est AU-DESSUS —
 * à mi-hauteur du graphe, plus rien ne disait lequel on lisait.
 *
 * ET LE PRODUIT SE CONTREDISAIT D'UN RÔLE À L'AUTRE. Le tableau de bord du
 * propriétaire encode les mêmes deux quantités depuis toujours : l'eau en
 * `--color-data-4`, l'électricité en `--color-data-3`. Le locataire lisait donc
 * un autre code que son bailleur, pour ses propres relevés.
 *
 * CE QUE CE CAS GARDE, ET CE QU'IL NE GARDE PAS. Il n'inscrit aucune valeur
 * RGB : les jetons peuvent être recalibrés — le fichier des jetons raconte
 * quatre corrections de contraste — sans que ce cas ait à bouger. Ce qu'il
 * refuse est que les DEUX SÉRIES redeviennent identiques, et que le locataire
 * cesse d'employer les jetons de son bailleur.
 *
 * LA COULEUR NE PORTE PAS SEULE POUR AUTANT : les libellés restent écrits, et
 * c'est `couleur-non-seule` qui le vérifie au navigateur, sur les deux thèmes.
 * Ce cas-ci ne garde que la DISTINCTION.
 */
describe('les deux séries de consommation du locataire', () => {
  it('ne se peignent pas de la même encre', async () => {
    installerFauxServeur()
    await renderApp('/demo/mon-espace')
    await attendreLeChargement()

    /* Les barres portent leur couleur en style en ligne — une hauteur et un
       fond calculés par point. On lit donc l'attribut, et non une classe. */
    const barres = Array.from(document.querySelectorAll<HTMLElement>('figure span[style*="background"]'))
    expect(barres.length, 'les graphes de consommation ont disparu').toBeGreaterThan(12)

    const series = new Set(
      barres
        .map((b) => b.style.background)
        /* La période ouverte porte une hachure d'accent et les mois sans relevé
           un filet gris : ni l'une ni l'autre ne dit QUELLE quantité on lit. */
        .filter((fond) => fond.includes('--color-data-')),
    )

    expect(series.size, 'les deux séries emploient le même jeton').toBe(2)
    expect(
      Array.from(series).some((f) => f.includes('data-4')),
      'l’eau n’emploie plus le jeton du tableau de bord',
    ).toBe(true)
    expect(
      Array.from(series).some((f) => f.includes('data-3')),
      'l’électricité n’emploie plus le jeton du tableau de bord',
    ).toBe(true)
  })
})
