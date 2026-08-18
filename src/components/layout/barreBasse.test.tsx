import { describe, expect, it, beforeEach, vi } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'

/**
 * Barre de navigation basse.
 *
 * Toute la navigation mobile tenait dans un tiroir déclenché par un hamburger
 * en HAUT À GAUCHE. Sur un Android grand format tenu à une main — la cible
 * principale du produit — c'est le coin le plus éloigné du pouce, et il fallait
 * l'atteindre pour changer d'écran, à chaque fois.
 *
 * Ce que ces tests NE PEUVENT PAS vérifier : jsdom n'évalue pas les requêtes
 * média. La barre est donc montée quelle que soit la « largeur » de la fenêtre,
 * et l'on ne peut pas prouver ici qu'elle disparaît au-dessus de `lg`. Ce qui
 * est vérifiable est la CAUSE de cette disparition — l'utilitaire `lg:hidden`,
 * exactement comme le tiroir — et c'est ce qu'on vérifie, en le disant. La
 * hauteur réservée sous la barre et la composition avec `env(safe-area-inset-*)`
 * relèvent de la même limite : elles sont gardées par `zonesSures.test.ts`, qui
 * lit les sources plutôt que le DOM, pour cette raison précise.
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

const barre = () => screen.getByRole('navigation', { name: 'Navigation rapide' })
const entrees = () => within(barre()).getAllByRole('link')
const libelles = () => entrees().map((lien) => lien.textContent?.replace(/\d+$/, '').trim())

describe('barre de navigation basse', () => {
  beforeEach(() => poserLargeur(false))

  it('n’existe qu’en deçà de `lg`, comme le tiroir', () => {
    renderApp('/app')
    // Ce que jsdom permet d'affirmer : la classe qui la retire en grand écran
    // est bien posée. Qu'elle produise l'effet attendu relève du navigateur.
    expect(barre().className).toMatch(/(?<![-\w])lg:hidden(?![-\w])/)
  })

  it('tient en cinq cibles au plus, dont une sortie vers le reste', () => {
    renderApp('/app')

    // Au-delà de cinq, les cibles passent sous les 44 px à 360 px de large.
    expect(entrees().length).toBeLessThanOrEqual(4)
    expect(within(barre()).getByRole('button', { name: 'Plus' })).toBeInTheDocument()
  })

  it('donne à chaque cible un libellé visible, pas une icône seule', () => {
    renderApp('/app')
    for (const lien of entrees()) expect(lien.textContent?.trim()).not.toBe('')
  })

  it('respecte le filtrage par rôle', async () => {
    // Sous `/demo`, où vit le sélecteur de profil. Ce cas éprouve le FILTRAGE
    // de la barre basse, pas la provenance du rôle : il lui faut donc un moyen
    // d'en changer sans remonter, et c'est ce que la démonstration offre.
    renderApp('/demo')
    expect(libelles()).toContain('Parc immobilier')

    // Le locataire n'a pas une navigation filtrée, il en a une AUTRE — trois
    // entrées, celles de son espace. La barre basse les porte toutes les trois
    // sans passer par l'ordre de priorité : cet ordre sert à choisir parmi une
    // douzaine d'entrées, et aucune des siennes n'y figure. L'y soumettre
    // rendrait une barre vide.
    await switchRole('tenant')
    await attendreLeChargement()
    expect(libelles()).not.toContain('Parc immobilier')
    expect(libelles()).toEqual(
      expect.arrayContaining(['Mon espace', 'Documents', 'Signaler']),
    )
  })

  it('signale l’entrée courante autrement que par la seule couleur', () => {
    renderApp('/app/paiements')

    const courante = within(barre()).getByRole('link', { current: 'page' })
    expect(courante).toHaveTextContent('Paiements')
    // La graisse double l'indication : la couleur seule ne se lit pas en plein
    // soleil ni pour un daltonien.
    expect(courante.className).toMatch(/font-semibold/)
  })

  it('porte les mêmes pastilles que la barre latérale', () => {
    renderApp('/app')

    const laterale = screen.getByRole('navigation', { name: 'Tableau de bord' })
    const attendu = within(laterale)
      .getByRole('link', { name: /^Paiements/ })
      .textContent?.replace('Paiements', '')

    expect(attendu, 'aucun impayé dans le jeu de test : la pastille ne prouve rien').toBeTruthy()
    // Le compteur précède le libellé ici et le suit dans la barre latérale :
    // c'est la valeur qui doit coïncider, pas l'ordre de lecture.
    expect(within(barre()).getByRole('link', { name: /Paiements/ })).toHaveTextContent(
      attendu as string,
    )
  })

  it('ouvre le tiroir par « Plus » sans lui retirer son traitement clavier', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    const plus = within(barre()).getByRole('button', { name: 'Plus' })
    await user.click(plus)

    const tiroir = screen.getByRole('dialog')
    expect(tiroir).toHaveFocus()
    expect(screen.getByRole('main').parentElement).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Rendu à « Plus » et non au hamburger : c'est de là qu'on est parti.
    expect(plus).toHaveFocus()
  })
})
