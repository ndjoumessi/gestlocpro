import { afterEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { StackedBarChart, type StackedBar } from './Charts'

/**
 * LE GRAPHE DES DOUZE MOIS MONTRE LE MOIS COURANT À LA PREMIÈRE PEINTURE.
 *
 * À 360 px, la boîte de tracé mesure 286 px de large et son contenu 440 — douze
 * colonnes d'au moins 24 px, une gouttière de 48. Elle défile, et elle
 * s'ouvrait défilée À GAUCHE : les quatre dernières colonnes, dont celle que la
 * lecture fixe choisit par défaut (`lu = active ?? bars.length - 1`), étaient
 * hors écran. La donnée la plus récente, celle qu'on vient chercher, était la
 * seule qu'on ne voyait pas — mesuré le 2026-09-06 : `clientWidth` 286,
 * `scrollWidth` 440, `scrollLeft` 0.
 *
 * Le conteneur se place désormais à droite au montage : le mois courant est
 * visible, l'historique défile vers la gauche. jsdom ne mesure rien, donc on
 * lui prête une largeur de contenu ; ce qui est vérifié est le GESTE, pas la
 * géométrie — la géométrie, `mesure-ui` la tient.
 */

const DOUZE: StackedBar[] = Array.from({ length: 12 }, (_, i) => ({
  label: `m${i + 1}`,
  segments: [{ key: 'rent', value: 100 + i }],
}))

const descripteur = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')

afterEach(() => {
  if (descripteur) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', descripteur)
  else delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth
})

describe('le graphe des douze mois', () => {
  it('s’ouvre défilé sur le mois courant, pas sur le plus ancien', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => 440,
    })
    const { container } = renderWithProviders(
      <StackedBarChart bars={DOUZE} seriesLabels={{ rent: 'Loyers' }} caption="Douze mois" />,
      { largeur: 360 },
    )
    const boite = container.querySelector<HTMLElement>('[class*="overflow-x-auto"]')
    expect(boite, 'la boîte défilante du tracé').not.toBeNull()
    expect(boite!.scrollLeft).toBeGreaterThan(0)
  })
})
