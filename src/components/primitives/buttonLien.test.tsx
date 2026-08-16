import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Button } from './Button'

/**
 * Un bouton-lien doit se comporter comme ce qu'il promet.
 *
 * Les branches « lien » de `Button` jetaient silencieusement les propriétés
 * restantes : un `onClick` posé par l'appelant n'était jamais appelé, un
 * `aria-label` disparaissait. Rien n'échouait, rien ne prévenait — un composant
 * partagé qui trahit ses appelants en silence est le pire des trois : il ne
 * casse pas, il ment.
 *
 * Et « désactivé » n'était qu'un `aria-disabled` : l'ancre restait cliquable,
 * focalisable et activable au clavier. L'état était annoncé aux technologies
 * d'assistance et démenti par le comportement.
 */
describe('bouton-lien', () => {
  it('appelle le gestionnaire que l’appelant lui confie', async () => {
    const clic = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <Button to="/app" onClick={clic}>
        Ouvrir
      </Button>,
    )

    await user.click(screen.getByRole('link', { name: 'Ouvrir' }))
    expect(clic).toHaveBeenCalledTimes(1)
  })

  it('transmet les attributs d’accessibilité', async () => {
    renderWithProviders(
      <Button href="https://example.test" aria-label="Ouvrir le relevé">
        Relevé
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Ouvrir le relevé' })).toBeInTheDocument()
  })

  it('désactivé, il ne navigue plus et sort du parcours de tabulation', () => {
    renderWithProviders(
      <Button to="/app" disabled>
        Ouvrir
      </Button>,
    )
    // Plus un lien du tout : sans destination, il n'est ni focalisable ni
    // activable — ce que « désactivé » veut dire.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Ouvrir').closest('[aria-disabled="true"]')).not.toBeNull()
  })
})
