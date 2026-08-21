import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'

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

  /*
    LE MENU EST DÉSORMAIS LE SEUL PORTEUR DES RÉGLAGES.

    La barre les affichait au-delà de 1280 px et les a rendus au menu : douze
    pixels de jeu en français, un libellé traduit d'avoir à se replier. Le
    retrait n'est légitime que si le panneau les porte VRAIMENT — sinon ce n'est
    pas une délégation, c'est une disparition, et aucune mesure de pixels ne
    voit une commande absente puisque la retirer fait de la place.

    Ce cas tient le CÂBLAGE : un déclencheur qui ouvre, un panneau qui contient
    les trois réglages. C'est `mesure-ui` qui tient l'autre moitié — que ce
    déclencheur soit encore atteignable au clavier à 1440 px, ce que jsdom ne
    peut pas savoir : il n'applique aucune requête média, donc `xl:hidden` y est
    invisible et le bouton y répond quelle que soit la « largeur ».
  */
  it('porte les trois réglages, et la barre ne les porte plus', async () => {
    const user = userEvent.setup()
    renderApp('/')

    const declencheur = ouvrir()
    const barre = declencheur.closest('header') as HTMLElement

    await user.click(declencheur)
    const panneau = screen.getByTestId('menu-mobile')

    // Les noms accessibles sont cherchés en ENTIER, sans expression régulière :
    // le dépôt tient qu'aucune commande ne vit sans nom, et un motif partiel
    // accepterait un nom rogné sans le dire. La devise porte le sien suivi de
    // sa valeur courante, d'où le seul appariement souple des trois.
    const reglages = [
      () => within(panneau).getByRole('group', { name: 'Langue' }),
      () => within(panneau).getByRole('group', { name: 'Thème' }),
      () => within(panneau).getByRole('button', { name: /^Devise/ }),
    ]
    for (const trouver of reglages) expect(trouver()).toBeInTheDocument()

    // Et la barre n'en porte plus aucun : c'est la moitié du lot que le
    // panneau seul ne prouverait pas — les deux endroits les ont portés
    // ensemble pendant des lots, et c'est ce doublon qui coûtait les pixels.
    expect(within(barre).queryByRole('group', { name: 'Langue' })).not.toBeInTheDocument()
    expect(within(barre).queryByRole('group', { name: 'Thème' })).not.toBeInTheDocument()
    expect(within(barre).queryByRole('button', { name: /^Devise/ })).not.toBeInTheDocument()
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
