import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * QUI RECRUTE UN GESTIONNAIRE.
 *
 * Le serveur ne l'accorde qu'au propriétaire : un gestionnaire qui émettait un
 * code `GES` faisait entrer un pair sur tout le parc, sans validation et sans
 * retrait possible — aucune route ne révoque une adhésion.
 *
 * La règle posée côté serveur laissait l'écran en arrière : le menu offrait
 * toujours « Gestionnaire délégué », et le refus revenait en « L'action a
 * échoué », sans dire ni pourquoi ni que c'était définitif. Ces cas tiennent
 * l'écran sur la même ligne que la route — proposer exactement ce qu'on
 * accorde, et expliquer ce qu'on retire.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un parc réel et minimal : l'adhésion implique un parc, donc un chargement. */
function serveurAvecParc() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  serveur.quand('POST', `/parks/${PARC}/invitations`, {
    status: 201,
    body: { code: 'LOC-1234-5678', envoye: false },
  })
  return serveur
}

/** Ouvre la modale d'invitation depuis l'écran des locataires. */
async function ouvrirLInvitation(role: Role) {
  const serveur = serveurAvecParc()
  await renderApp('/app/locataires', { session: sessionDuRole(role) })
  await screen.findByRole('heading', { level: 1 })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Inviter par code' }))
  await screen.findByRole('dialog')
  return serveur
}

describe('qui recrute un gestionnaire', () => {
  it('laisse le propriétaire choisir le rôle qu’il invite', async () => {
    await ouvrirLInvitation('owner')

    const menu = screen.getByRole('combobox', { name: /Rôle invité/ })
    expect(within(menu).getByRole('option', { name: 'Gestionnaire délégué' })).toBeInTheDocument()
    expect(within(menu).getByRole('option', { name: 'Locataire' })).toBeInTheDocument()
  })

  it('n’offre plus au gestionnaire de recruter un pair', async () => {
    await ouvrirLInvitation('manager')

    // Le cas tient sur ses DEUX moitiés : sans la seconde, une modale vide le
    // satisferait — or le gestionnaire garde le droit d'inviter un locataire.
    expect(screen.queryByRole('combobox', { name: /Rôle invité/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Émettre le code' })).toBeInTheDocument()
  })

  it('dit au gestionnaire qui recrute, plutôt que de le laisser deviner', async () => {
    await ouvrirLInvitation('manager')

    expect(
      screen.getByText('Seul le propriétaire recrute un gestionnaire. Vous invitez des locataires.'),
    ).toBeInTheDocument()
  })

  it('garde cette note pour le seul gestionnaire', async () => {
    await ouvrirLInvitation('owner')

    // Elle expliquerait au propriétaire l'absence d'un champ qu'il a sous les
    // yeux : une note qui décrit le contraire de l'écran se retourne contre lui.
    expect(screen.queryByText(/Seul le propriétaire recrute un gestionnaire/)).not.toBeInTheDocument()
  })

  it('émet bien un code de locataire quand c’est le gestionnaire qui invite', async () => {
    const serveur = await ouvrirLInvitation('manager')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Émettre le code' }))
    await screen.findByText('LOC-1234-5678')

    // C'est le CORPS envoyé qui compte : masquer l'option sans corriger la
    // valeur émise laisserait passer un `role: 'manager'` figé dans l'état.
    const emission = serveur.appels.find(
      (appel) => appel.methode === 'POST' && appel.chemin === `/parks/${PARC}/invitations`,
    )
    expect(emission?.corps).toMatchObject({ role: 'tenant' })
  })
})
