import { beforeEach, describe, expect, it, vi } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Tiroir de navigation mobile.
 *
 * Il assombrit la page et bloque le défilement : c'est une fenêtre modale. Il
 * n'en avait pourtant aucune des obligations — le focus restait sur le bouton
 * d'ouverture, et le contenu de la page restait atteignable au clavier derrière
 * l'assombrissement. Un utilisateur au clavier tabulait dans ce qu'il ne voyait
 * pas.
 *
 * jsdom n'applique pas les media queries de Tailwind : le tiroir y est donc
 * monté quelle que soit la « largeur ». C'est sans importance pour ce qui est
 * vérifié ici, qui relève du DOM et non de la mise en page — sauf pour
 * `matchMedia`, que jsdom n'implémente pas et qu'il faut donc fournir.
 */
function poserLargeur(large: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: large,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

/**
 * Le bouton d'ouverture se cherche dans la barre supérieure : la barre latérale
 * de bureau porte le même libellé pour son bouton de repli. Elle est masquée en
 * mobile par une media query, que jsdom n'applique pas — les deux coexistent
 * donc ici. Le libellé partagé mériterait d'être distingué.
 */
const ouvrir = () =>
  within(screen.getByRole('banner')).getByRole('button', { name: /déplier la navigation/i })

describe('tiroir de navigation', () => {
  beforeEach(() => poserLargeur(false))

  it('s’annonce comme fenêtre modale', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(ouvrir())

    const tiroir = screen.getByRole('dialog')
    expect(tiroir).toHaveAttribute('aria-modal', 'true')
    expect(tiroir).toHaveAccessibleName()
  })

  it('prend le focus à l’ouverture', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    await user.click(ouvrir())
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('retire l’arrière-plan du parcours de tabulation', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    const contenu = screen.getByRole('main').parentElement
    expect(contenu).not.toHaveAttribute('inert')

    await user.click(ouvrir())
    // Sans cela, sept éléments de la page restaient tabulables derrière
    // l'assombrissement.
    expect(contenu).toHaveAttribute('inert')
  })

  it('rend le focus au bouton d’ouverture à la fermeture', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    const declencheur = ouvrir()
    await user.click(declencheur)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(declencheur).toHaveFocus()
    expect(screen.getByRole('main').parentElement).not.toHaveAttribute('inert')
  })

  it('se referme si l’écran passe en grand format', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    poserLargeur(true)
    await user.click(ouvrir())

    // Laisser l'état ouvert neutraliserait l'arrière-plan alors que plus rien
    // ne le recouvre.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('main').parentElement).not.toHaveAttribute('inert')
  })
})
