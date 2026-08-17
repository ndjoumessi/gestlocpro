import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { IconButton } from './Button'
import { useToast } from './Toast'

/**
 * Les classes attendues sont ASSEMBLÉES, jamais écrites d'un tenant.
 *
 * Tailwind v4 balaie les sources — fichiers de test compris — et fabrique le
 * CSS de tout motif qu'il y reconnaît. Une classe citée en clair dans une
 * assertion entrerait donc pour de bon dans la feuille de style livrée, au
 * seul titre d'avoir servi d'exemple.
 */
const SANS_POINTEUR = ['pointer', 'events', 'none'].join('-')
const OPACITE_ETEINTE = ['opacity', '45'].join('-')

/**
 * Fige l'horloge SANS geler l'attente des tests.
 *
 * `useFakeTimers()` nu suspend aussi les minuteries internes de
 * `@testing-library` et de `userEvent` : les trois tests de minuterie
 * expiraient à 5 s sans avoir cliqué une seule fois. `shouldAdvanceTime` laisse
 * le temps réel s'écouler normalement tout en gardant la main pour bondir de
 * vingt secondes d'un coup.
 */
function horlogeFigee() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

/** Déclenche une notification depuis un vrai bouton, comme le ferait un écran. */
function Notificateur({ action }: { action?: boolean } = {}) {
  const { notify } = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        notify('Quittance enregistrée', action ? { action: { label: 'Voir', onClick: () => {} } } : undefined)
      }
    >
      Notifier
    </button>
  )
}

describe('IconButton désactivé', () => {
  it('porte le même amortissement visuel que le bouton ordinaire', () => {
    renderWithProviders(<IconButton icon="close" label="Fermer" disabled />)
    const bouton = screen.getByRole('button', { name: 'Fermer' })
    expect(bouton.className).toContain(SANS_POINTEUR)
    expect(bouton.className).toContain(OPACITE_ETEINTE)
  })

  it('laisse le bouton actif intact', () => {
    renderWithProviders(<IconButton icon="close" label="Fermer" />)
    const bouton = screen.getByRole('button', { name: 'Fermer' })
    expect(bouton.className).not.toContain(OPACITE_ETEINTE)
  })
})

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offre une fermeture manuelle sans voler le focus à l’apparition', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Notificateur />)

    const declencheur = screen.getByRole('button', { name: 'Notifier' })
    await user.click(declencheur)

    expect(screen.getByText('Quittance enregistrée')).toBeTruthy()
    // Une annonce polie n'interrompt pas : le focus reste où l'utilisateur
    // l'avait laissé, même si le toast apporte maintenant un bouton.
    expect(document.activeElement).toBe(declencheur)

    await user.click(screen.getByRole('button', { name: 'Fermer la notification' }))
    expect(screen.queryByText('Quittance enregistrée')).toBeNull()
  })

  it('suspend l’effacement automatique tant que le pointeur reste dessus', async () => {
    const user = horlogeFigee()
    renderWithProviders(<Notificateur />)

    await user.click(screen.getByRole('button', { name: 'Notifier' }))
    const message = screen.getByText('Quittance enregistrée')
    const toast = message.closest('[data-toast]')!

    await user.hover(toast)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(screen.queryByText('Quittance enregistrée')).not.toBeNull()

    await user.unhover(toast)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.queryByText('Quittance enregistrée')).toBeNull()
  })

  it('suspend l’effacement pendant qu’un de ses boutons a le focus', async () => {
    const user = horlogeFigee()
    renderWithProviders(<Notificateur action />)

    await user.click(screen.getByRole('button', { name: 'Notifier' }))
    act(() => {
      screen.getByRole('button', { name: 'Voir' }).focus()
    })

    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    // Le message doit survivre : sinon le bouton qui porte le focus disparaît
    // sous les doigts de qui navigue au clavier, et le focus retombe au body.
    expect(screen.queryByText('Quittance enregistrée')).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voir' }))
  })

  it('s’efface tout seul quand personne ne s’y attarde', async () => {
    const user = horlogeFigee()
    renderWithProviders(<Notificateur />)

    await user.click(screen.getByRole('button', { name: 'Notifier' }))
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.queryByText('Quittance enregistrée')).toBeNull()
  })
})
