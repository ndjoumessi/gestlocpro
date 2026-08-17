import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Menu mobile de la vitrine.
 *
 * Il recouvre la page et bloque le défilement, exactement comme le tiroir de
 * l'espace connecté — et il n'en avait aucune des obligations clavier : le
 * focus restait sur le bouton d'ouverture, tout l'arrière-plan restait
 * tabulable derrière le panneau, et refermer laissait le focus retomber au
 * début du document. Le tiroir avait déjà été corrigé ; la vitrine, non.
 *
 * La solution est celle du tiroir, dont le raisonnement est écrit en tête de
 * l'effet correspondant dans `AppShell.tsx` : `inert` sur l'arrière-plan plutôt
 * qu'un piège à focus écrit à la main.
 *
 * Une différence de fond avec le tiroir, et elle se voit ici : l'en-tête reste
 * VISIBLE au-dessus du panneau, et c'est lui qui porte le bouton de fermeture.
 * Il n'est donc pas de l'arrière-plan et ne doit surtout pas être neutralisé.
 *
 * jsdom n'applique pas les requêtes média : le menu y est monté quelle que soit
 * la « largeur ». Sans importance pour ce qui est vérifié ici, qui relève du
 * DOM et non de la mise en page.
 */
const ouvrir = () => screen.getByRole('button', { name: 'Ouvrir le menu' })

describe('menu mobile de la vitrine', () => {
  it('retire l’arrière-plan du parcours de tabulation, sans toucher à l’en-tête', async () => {
    const user = userEvent.setup()
    renderApp('/')

    expect(screen.getByRole('main')).not.toHaveAttribute('inert')

    // Le même bouton ouvre et ferme : son nom accessible change à l'ouverture,
    // il faut donc le garder plutôt que le rechercher ensuite.
    const declencheur = ouvrir()
    await user.click(declencheur)

    expect(screen.getByRole('main')).toHaveAttribute('inert')
    expect(screen.getByRole('contentinfo')).toHaveAttribute('inert')
    // L'en-tête porte le bouton qui referme le panneau : le neutraliser
    // enfermerait l'utilisateur au clavier dans un menu qu'il ne peut plus
    // quitter que par Échap.
    expect(declencheur.closest('header')).not.toHaveAttribute('inert')
  })

  it('prend le focus à l’ouverture', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(ouvrir())
    expect(screen.getByTestId('menu-mobile')).toHaveFocus()
  })

  it('rend le focus au bouton d’ouverture à la fermeture', async () => {
    const user = userEvent.setup()
    renderApp('/')

    const declencheur = ouvrir()
    await user.click(declencheur)
    // Une tabulation d'abord : sans elle le focus n'a jamais quitté le bouton,
    // et le retrouver dessus ne prouverait rien.
    await user.tab()
    expect(declencheur).not.toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('menu-mobile')).not.toBeInTheDocument()
    expect(declencheur).toHaveFocus()
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
  })
})
