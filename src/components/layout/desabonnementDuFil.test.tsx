import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE DÉSABONNEMENT AUX COPIES E-MAIL SE FAIT AU DOIGT.
 *
 * Le serveur sait le lire et l'écrire ; sans cet écran, le réglage n'existe que
 * pour qui sait former un `PATCH`. Or les copies partent RÉELLEMENT — vérifié
 * dans les variables de production — et un gestionnaire qui suit trente
 * logements les reçoit toutes.
 *
 * ═══ DANS LE MENU DU COMPTE, AU-DESSUS DU FILET ═══
 *
 * C'est une préférence PERSONNELLE, pas un réglage de parc : elle vit là où
 * vivent déjà l'identité et la déconnexion. Au-dessus du filet, du côté de ce
 * qui se défait — le filet sépare « on navigue » de « on met fin à la
 * session », et basculer une case appartient au premier.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const session: EtatSession = {
  statut: 'connecte',
  compte: { ...COMPTE_FICTIF, threadEmailOptIn: true },
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

const COMPTE = { ...COMPTE_FICTIF, threadEmailOptIn: true }

async function ouvrirLeMenu(compte = COMPTE) {
  await renderApp('/app', { session: { ...session, compte } as EtatSession })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: new RegExp(COMPTE_FICTIF.fullName) }))
  return user
}

describe('la préférence des copies', () => {
  it('se bascule depuis le menu du compte', async () => {
    serveur.quand('PATCH', '/auth/me', {
      status: 200,
      body: { user: { ...COMPTE_FICTIF, threadEmailOptIn: false } },
    })
    const user = await ouvrirLeMenu()

    await user.click(screen.getByRole('menuitemcheckbox', { name: /copies des signalements/i }))

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH' && a.chemin.endsWith('/auth/me'))
      expect(appel?.corps, 'sans écran, le réglage n’existe que pour qui sait faire un PATCH').toEqual(
        { threadEmailOptIn: false },
      )
    })
  })

  it('montre l’état COURANT, et pas un défaut inventé', async () => {
    /* Une case posée à vrai par défaut d'information ferait croire qu'on reçoit
       encore alors qu'on s'est désabonné — et le geste suivant rallumerait ce
       qui était déjà éteint. */
    await ouvrirLeMenu({ ...COMPTE_FICTIF, threadEmailOptIn: false })
    expect(
      screen.getByRole('menuitemcheckbox', { name: /copies des signalements/i }),
    ).toHaveAttribute('aria-checked', 'false')
  })
})

describe('le résumé du fil', () => {
  it('se bascule depuis le même menu', async () => {
    serveur.quand('PATCH', '/auth/me', {
      status: 200,
      body: { user: { ...COMPTE_FICTIF, threadEmailDigest: true } },
    })
    const user = await ouvrirLeMenu()

    await user.click(screen.getByRole('menuitemcheckbox', { name: /résumé/i }))

    await waitFor(() => {
      const appel = serveur.appels.find(
        (a) => a.methode === 'PATCH' && a.chemin.endsWith('/auth/me'),
      )
      expect(appel?.corps).toEqual({ threadEmailDigest: true })
    })
  })

  it('DISPARAÎT quand les copies sont coupées', async () => {
    /* « Grouper les copies » n'a aucun sens pour qui n'en reçoit aucune. Le
       proposer quand même ferait un réglage dont l'effet dépend d'un autre,
       sans que rien ne le dise. */
    await ouvrirLeMenu({ ...COMPTE_FICTIF, threadEmailOptIn: false })
    expect(screen.queryByRole('menuitemcheckbox', { name: /résumé/i })).toBeNull()
  })

  it('montre l’état COURANT', async () => {
    await ouvrirLeMenu({ ...COMPTE_FICTIF, threadEmailDigest: true })
    expect(screen.getByRole('menuitemcheckbox', { name: /résumé/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
