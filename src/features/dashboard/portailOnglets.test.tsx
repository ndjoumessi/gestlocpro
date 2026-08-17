import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Motif ARIA des onglets du portail locataire.
 *
 * Les rôles `tablist` / `tab` étaient déclarés sans rien de ce qu'ils
 * annoncent : ni flèches, ni `tabindex` roulant, ni `aria-controls`, ni
 * panneau. Un lecteur d'écran promettait donc une navigation par flèches qui
 * n'existait pas — strictement pire qu'une rangée de boutons ordinaires, qui
 * au moins ne promet rien. Ces tests tiennent la promesse.
 *
 * Le BORNAGE plutôt que le bouclage suit la convention du dépôt, posée par
 * `Combobox` : arriver au bout et se retrouver au début désoriente plus que
 * cela n'aide. L'APG laisse le choix ; le produit n'en a qu'un.
 */
async function ouvrirPortail() {
  const user = userEvent.setup()
  renderApp('/demo/portail')
  const onglets = screen.getAllByRole('tab')
  return { user, onglets }
}

describe('onglets du portail — structure ARIA', () => {
  it('lie chaque onglet à un panneau, et le panneau en retour', async () => {
    const { onglets } = await ouvrirPortail()
    expect(onglets.length).toBeGreaterThan(1)

    const actif = onglets.find((o) => o.getAttribute('aria-selected') === 'true')!
    const panneau = screen.getByRole('tabpanel')
    expect(actif.getAttribute('aria-controls')).toBe(panneau.id)
    expect(panneau.getAttribute('aria-labelledby')).toBe(actif.id)
  })

  it('n’offre qu’un seul arrêt de tabulation pour tout le groupe', async () => {
    const { onglets } = await ouvrirPortail()
    const arrets = onglets.filter((o) => o.getAttribute('tabindex') === '0')
    expect(arrets).toHaveLength(1)
    expect(arrets[0].getAttribute('aria-selected')).toBe('true')
    for (const autre of onglets.filter((o) => o !== arrets[0]))
      expect(autre.getAttribute('tabindex')).toBe('-1')
  })
})

describe('onglets du portail — navigation au clavier', () => {
  it('déplace la sélection et le focus aux flèches', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()

    await user.keyboard('{ArrowRight}')
    expect(onglets[1]).toHaveFocus()
    expect(onglets[1].getAttribute('aria-selected')).toBe('true')
    expect(onglets[0].getAttribute('aria-selected')).toBe('false')

    await user.keyboard('{ArrowLeft}')
    expect(onglets[0]).toHaveFocus()
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
  })

  it('borne aux extrémités au lieu de boucler', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(onglets[0]).toHaveFocus()

    const dernier = onglets[onglets.length - 1]
    dernier.focus()
    await user.keyboard('{ArrowRight}')
    expect(dernier).toHaveFocus()
  })

  it('saute aux extrémités avec Début et Fin', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()

    await user.keyboard('{End}')
    expect(onglets[onglets.length - 1]).toHaveFocus()
    expect(onglets[onglets.length - 1].getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{Home}')
    expect(onglets[0]).toHaveFocus()
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
  })

  it('atteint le contenu de l’onglet en une seule tabulation', async () => {
    // Le `tabindex` roulant n'a de sens que s'il fait vraiment gagner les
    // quatre arrêts qu'il retire : depuis l'onglet actif, la tabulation doit
    // sortir du groupe, pas passer à l'onglet suivant.
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()
    await user.tab()
    for (const onglet of onglets) expect(onglet).not.toHaveFocus()
  })
})
