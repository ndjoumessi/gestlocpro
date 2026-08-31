import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * ON INVITE DEPUIS L'ÉCRAN QUI DIT QUI ENTRE.
 *
 * ═══ OÙ LE GESTE VIVAIT, ET POURQUOI PERSONNE NE LE TROUVAIT ═══
 *
 * « Inviter par code » n'existait que sur LE FICHIER DES LOCATAIRES. Le choix
 * se défend pour un code de locataire — on écrit à des gens, et c'est là qu'on
 * lit qui ils sont. Il ne se défend plus du tout pour le second usage du même
 * bouton : RECRUTER UN GESTIONNAIRE. Un propriétaire qui cherche à déléguer son
 * parc ouvre « Accès au parc » — l'écran s'intitule « qui détient une clé, et
 * quels codes attendent encore d'être utilisés » — et n'y trouvait aucune
 * commande. Il listait des codes en attente sans offrir d'en émettre un.
 *
 * Signalé sur la production dans ces termes : « dans la page propriétaire il
 * n'y a pas de fonctionnalité qui permet de déléguer son logement ». Le geste
 * existait, la route existait, le réglage existait — trois écrans plus loin.
 *
 * ═══ ET LE PARC QUI SE GÈRE SEUL A UNE SORTIE ═══
 *
 * Un propriétaire ayant répondu « je gère seul » à l'inscription voit la note
 * qui le lui rappelle. Elle disait quoi faire — « changez la politique de
 * délégation » — sans dire OÙ, et le réglage vit derrière les trois points de
 * l'écran du parc. La note porte donc désormais le chemin, comme celle de
 * « prise en main » le fait déjà.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const REGISTRE = {
  members: [
    {
      id: 'm-moi',
      role: 'owner',
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-01-15T09:00:00.000Z',
    },
  ],
  invitations: [],
}

function sessionDuRole(role: Role, delegation: 'solo' | 'delegate' = 'delegate'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [
      { parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF', delegation },
    ],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
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
    body: { code: 'GES-1234-5678', envoye: false },
  })
})

async function ouvrirLesAcces(role: Role, delegation: 'solo' | 'delegate' = 'delegate') {
  await renderApp('/app/acces', { session: sessionDuRole(role, delegation) })
  await attendreLeChargement()
}

describe('inviter depuis le registre des accès', () => {
  it('propose au propriétaire d’émettre un code', async () => {
    await ouvrirLesAcces('owner')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Inviter par code' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('mène le propriétaire jusqu’au rôle de gestionnaire', async () => {
    await ouvrirLesAcces('owner')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Inviter par code' }))
    // Le champ du rôle EST la délégation : c'est par lui qu'un gestionnaire
    // entre, et c'est ce que la production disait ne trouver nulle part.
    expect(await screen.findByRole('combobox', { name: /Rôle invité/ })).toBeInTheDocument()
  })

  it('le propose aussi au gestionnaire, dont c’est le geste quotidien', async () => {
    await ouvrirLesAcces('manager')

    /* L'écran lui est déjà ouvert — il émet des codes de locataire tous les
       jours, et un code qu'on ne peut pas retrouver est un code réémis en
       double. La modale, elle, ne lui offre que le rôle qu'il peut émettre. */
    await userEvent.setup().click(screen.getByRole('button', { name: 'Inviter par code' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Rôle invité/ })).not.toBeInTheDocument()
  })

  it('donne au parc en gestion seule le chemin du réglage', async () => {
    await ouvrirLesAcces('owner', 'solo')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Inviter par code' }))
    const dialogue = await screen.findByRole('dialog')

    /* La note disait quoi faire sans dire où : le réglage vit derrière les
       trois points de l'écran du parc, que personne ne devine. */
    const vers = screen.getByRole('link', { name: /réglages du parc/i })
    expect(dialogue.contains(vers), 'le chemin du réglage n’est pas dans la modale').toBe(true)
    expect(vers).toHaveAttribute('href', '/app/parc')
  })
})
