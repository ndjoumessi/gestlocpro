import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ToastProvider } from './Toast'

/**
 * LES TOASTS SE POSENT AU-DESSUS DE LA BARRE DE NAVIGATION BASSE, PAS DESSUS.
 *
 * Le conteneur était `fixed bottom-0` à `--z-toast` (100) ; la barre basse est
 * `fixed bottom-0` à `--z-sticky` (20), haute de 4 rem sous 64 rem. Un toast —
 * `pointer-events-auto`, 4,5 s — recouvrait donc les onglets Paiements et
 * Signalements exactement le temps où l'on vient de finir un geste et où l'on
 * veut changer d'écran. `BandeauVersion` se décale déjà de `--h-barre-basse`,
 * la variable que la coquille élève tant qu'elle monte sa barre ; le toast
 * prend le même décalage. Sur le bureau et dans la coquille du locataire, la
 * variable vaut 0 : rien ne bouge.
 */

describe('le conteneur des toasts', () => {
  it('se décale de la hauteur de la barre basse', () => {
    const { container } = renderWithProviders(
      <ToastProvider>
        <p>contenu</p>
      </ToastProvider>,
    )
    const conteneur = container.parentElement!.querySelector('[aria-live="polite"]')
    expect(conteneur, 'la région vivante des toasts').not.toBeNull()
    expect(conteneur!.className).toContain('bottom-[var(--h-barre-basse,0px)]')
    expect(conteneur!.className).not.toMatch(/\bbottom-0\b/)
  })
})
