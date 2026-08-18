import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * Relance des loyers, et mise en demeure, vues de l'écran.
 *
 * La page de tarifs vend « Relances automatiques · SMS et e-mail déclenchés à
 * J+1, J+7, J+15 » depuis le premier jour, et rien n'en produisait une. La
 * démonstration en affichait pourtant — « relance partie le … » — ce qui est le
 * pire des trois états : vendue, montrée, absente.
 *
 * Ce que ces cas surveillent d'abord n'est pas l'envoi mais le COMPTE RENDU. Le
 * serveur écarte les baux déjà relancés le matin même ; un écran qui annoncerait
 * « 3 relances » quand une seule est partie recréerait, sous une autre forme, le
 * défaut qu'on retire.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const BAIL_RETARD = 'bbbbbbbb-1111-4111-8111-111111111111'
const BAIL_AJOUR = 'bbbbbbbb-2222-4222-8222-222222222222'

function session(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un parc de deux baux : un en retard, un à jour. */
function parc(options: { retard?: boolean } = {}) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Makepe',
          district: 'Makepe',
          units: [
            {
              id: 'cccccccc-1111-4111-8111-111111111111',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: { id: 'dddddddd-1111-4111-8111-111111111111', fullName: 'Paul Kamga', phoneE164: null },
              leaseId: BAIL_RETARD,
              status: options.retard === false ? 'paid' : 'overdue',
              paidMinor: 0,
              overdueDays: options.retard === false ? null : 24,
            },
            {
              id: 'cccccccc-2222-4222-8222-222222222222',
              label: 'A2',
              type: 'T2',
              surfaceSqm: 56,
              rentMinor: 115000,
              tenant: { id: 'dddddddd-2222-4222-8222-222222222222', fullName: 'Esther Manga', phoneE164: null },
              leaseId: BAIL_AJOUR,
              status: 'paid',
              paidMinor: 115000,
              overdueDays: null,
            },
          ],
        },
      ],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

const bouton = (nom: RegExp) => screen.getByRole('button', { name: nom })

describe('relance des loyers', () => {
  it('n’offre pas le geste quand personne n’est en retard', async () => {
    parc({ retard: false })
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    // Un bouton qui ne peut rien faire occupe la place d'une action utile — et
    // le serveur le refuserait de toute façon.
    expect(screen.queryByRole('button', { name: /relancer les retards/i })).not.toBeInTheDocument()
  })

  it('envoie les baux en retard, et EUX SEULS', async () => {
    const serveur = parc()
    serveur.quand('POST', `/parks/${PARC}/reminders`, {
      status: 200,
      body: { sent: [BAIL_RETARD], skipped: [] },
    })
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/relancer les retards/i))
    // La confirmation dit combien, et qui : le geste part vers plusieurs
    // personnes à la fois.
    const dialogue = screen.getByRole('alertdialog')
    expect(dialogue).toHaveTextContent('Paul Kamga')
    expect(dialogue).not.toHaveTextContent('Esther Manga')

    await user.click(within(dialogue).getByRole('button', { name: /confirmer/i }))

    const appel = serveur.appels.find((a) => a.chemin.includes('/reminders'))!
    expect(appel.corps).toEqual({ leaseIds: [BAIL_RETARD] })
  })

  it('annonce ce que le serveur a fait, et non ce qu’on lui a demandé', async () => {
    const serveur = parc()
    // Le serveur n'a rien relancé : ce locataire l'avait déjà été ce matin.
    serveur.quand('POST', `/parks/${PARC}/reminders`, {
      status: 200,
      body: { sent: [], skipped: [{ leaseId: BAIL_RETARD, reason: 'already_reminded_today' }] },
    })
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/relancer les retards/i))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirmer/i }))

    /**
     * « Aucune relance », et surtout PAS « 1 locataire relancé ».
     *
     * C'est le cœur de ce chantier : la maquette annonçait un envoi sur un
     * simple clic, et le produit affichait des relances que rien n'avait
     * produites. Un compte rendu qui recopie la demande est le même mensonge,
     * déplacé d'un cran.
     */
    expect(await screen.findByText(/aucune relance/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 locataire relancé/i)).not.toBeInTheDocument()
  })
})

describe('retrait d’une fiche locataire', () => {
  it('n’est offert qu’au propriétaire', async () => {
    parc()
    renderApp('/app/locataires', { session: session('manager') })
    await screen.findByText('Paul Kamga')

    // Retirer une fiche efface une personne du registre.
    expect(screen.queryByRole('button', { name: /^retirer$/i })).not.toBeInTheDocument()
  })

  it('demande confirmation, puis appelle le serveur', async () => {
    const serveur = parc()
    serveur.quand(
      'DELETE',
      `/parks/${PARC}/tenants/dddddddd-1111-4111-8111-111111111111`,
      { status: 204 },
    )
    const user = userEvent.setup()
    renderApp('/app/locataires', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(screen.getAllByRole('button', { name: /^retirer$/i })[0]!)
    // La confirmation NOMME la personne : le geste est irréversible et porte sur
    // quelqu'un, pas sur une ligne.
    const dialogue = screen.getByRole('alertdialog')
    expect(dialogue).toHaveTextContent('Paul Kamga')

    await user.click(within(dialogue).getByRole('button', { name: /confirmer/i }))

    expect(serveur.appels.some((a) => a.methode === 'DELETE' && a.chemin.includes('/tenants/'))).toBe(
      true,
    )
    expect(await screen.findByText(/fiche retirée/i)).toBeInTheDocument()
  })
})

describe('date du versement', () => {
  it('refuse une date future, et n’appelle pas le serveur', async () => {
    /**
     * Une quittance a été émise pour un règlement daté du 17 septembre alors
     * qu'on était le 18 août : le registre portait de l'argent qui n'était pas
     * arrivé, et « encaissé ce mois » le comptait. Une quittance atteste d'un
     * fait ; la dater en avant en fait une promesse.
     */
    const serveur = parc()
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/enregistrer un paiement/i))
    const dialogue = screen.getByRole('dialog')
    // Le montant d'abord : la modale le vérifie AVANT la date, et un champ vide
    // ferait tomber le cas sur la mauvaise alerte — il passait ainsi pour un
    // refus de date alors qu'il refusait un montant.
    await user.type(within(dialogue).getByLabelText(/^montant/i), '145000')

    // Mois suivant puis le 1er : toujours dans le futur, sans dépendre du jour
    // où la suite tourne.
    await user.click(within(dialogue).getByRole('button', { name: /date du versement/i }))
    const calendrier = screen.getByRole('dialog', { name: /calendrier/i })
    await user.click(within(calendrier).getByLabelText(/mois suivant/i))
    const premier = within(calendrier)
      .getAllByRole('button')
      .find((b) => /(^|\D)1(\D|$)/.test(b.getAttribute('aria-label') ?? ''))!
    await user.click(premier)

    await user.click(within(dialogue).getByRole('button', { name: /^enregistrer$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/date future/i)
    expect(serveur.appels.some((a) => a.chemin.includes('/payments'))).toBe(false)
  })
})

describe('appel de loyers', () => {
  it('dit combien d’échéances sont ÉMISES, pas combien de baux existent', async () => {
    const serveur = parc()
    serveur.quand('POST', `/parks/${PARC}/charges`, { status: 200, body: { issued: 1, leases: 2 } })
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/appeler les loyers/i))

    // `issued` et non `leases` : deux baux, une seule échéance nouvelle — la
    // seconde existait déjà. Annoncer deux ferait croire à une dette doublée.
    expect(await screen.findByText(/1 échéance émise/i)).toBeInTheDocument()
  })

  it('ne laisse pas croire à une seconde dette quand le mois est déjà appelé', async () => {
    const serveur = parc()
    serveur.quand('POST', `/parks/${PARC}/charges`, { status: 200, body: { issued: 0, leases: 2 } })
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/appeler les loyers/i))

    expect(await screen.findByText(/déjà été appelés/i)).toBeInTheDocument()
  })

  it('n’est pas offert au locataire, qui ne s’appelle pas ses propres loyers', async () => {
    parc()
    renderApp('/app/paiements', { session: session('tenant') })
    await screen.findByText(/suivi des paiements/i)

    expect(screen.queryByRole('button', { name: /appeler les loyers/i })).not.toBeInTheDocument()
  })
})

describe('mise en demeure', () => {
  it('n’est offerte qu’au propriétaire', async () => {
    parc()
    renderApp('/app/paiements', { session: session('manager') })
    await screen.findByText('Paul Kamga')

    // Le gestionnaire « propose, ne décide pas » — et le serveur le refuse
    // aussi : ce masquage évite d'offrir un geste voué au refus.
    expect(screen.queryByRole('button', { name: /mettre en demeure/i })).not.toBeInTheDocument()
  })

  it('exige un motif avant d’appeler le serveur', async () => {
    const serveur = parc()
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/mettre en demeure/i))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirmer/i }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/motif/i)
    // Rien n'est parti : le refus arrive avant l'aller-retour, et la modale
    // reste ouverte avec le texte déjà saisi.
    expect(serveur.appels.some((a) => a.chemin.includes('formal-notice'))).toBe(false)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('transmet le motif, qui est la pièce qu’on produira', async () => {
    const serveur = parc()
    serveur.quand('POST', `/parks/${PARC}/leases/${BAIL_RETARD}/formal-notice`, {
      status: 201,
      body: { formalNotice: { leaseId: BAIL_RETARD, dueMinor: 145000 } },
    })
    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('owner') })
    await screen.findByText('Paul Kamga')

    await user.click(bouton(/mettre en demeure/i))
    const dialogue = screen.getByRole('alertdialog')
    await user.type(
      within(dialogue).getByRole('textbox'),
      'Trois échéances impayées malgré deux relances.',
    )
    await user.click(within(dialogue).getByRole('button', { name: /confirmer/i }))

    const appel = serveur.appels.find((a) => a.chemin.includes('formal-notice'))!
    expect((appel.corps as { reason: string }).reason).toMatch(/trois échéances impayées/i)
    expect(await screen.findByText(/mise en demeure enregistrée/i)).toBeInTheDocument()
  })
})
