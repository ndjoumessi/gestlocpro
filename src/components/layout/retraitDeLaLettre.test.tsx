import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE CONSENTEMENT À LA LETTRE SE RETIRE AU DOIGT, DANS LE MENU DU COMPTE.
 *
 * Même place que les copies des signalements : une préférence personnelle, qui
 * se défait. Sans cet écran, le retrait n'existerait que pour qui sait former un
 * `PATCH` — et la politique de confidentialité promet qu'on peut le retirer.
 */
const PARC = '11111111-2222-4333-8444-555555555555'
let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLeMenu(newsletterOptIn: boolean) {
  const compte = { ...COMPTE_FICTIF, newsletterOptIn }
  const session: EtatSession = {
    statut: 'connecte',
    compte,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
  }
  await renderApp('/app', { session })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: new RegExp(COMPTE_FICTIF.fullName) }))
  return user
}

describe('la lettre d’information dans le menu du compte', () => {
  it('se retire d’un geste', async () => {
    serveur.quand('PATCH', '/auth/me', {
      status: 200,
      body: { user: { ...COMPTE_FICTIF, newsletterOptIn: false } },
    })
    const user = await ouvrirLeMenu(true)

    const caseLettre = screen.getByRole('menuitemcheckbox', { name: /nouveautés produit/i })
    expect(caseLettre).toHaveAttribute('aria-checked', 'true')
    await user.click(caseLettre)

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH' && a.chemin.endsWith('/auth/me'))
      expect(appel?.corps).toEqual({ newsletterOptIn: false })
    })
  })

  it('montre l’état courant, sans défaut inventé', async () => {
    await ouvrirLeMenu(false)
    expect(screen.getByRole('menuitemcheckbox', { name: /nouveautés produit/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
