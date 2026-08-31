import { beforeEach, describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  screen,
  switchRole,
  within,
} from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UNE ABSENCE DIT CE QU'ELLE EST.
 *
 * ═══ TROIS TIRETS POUR TROIS CHOSES DIFFÉRENTES ═══
 *
 * Capturé sur la production, dans l'espace d'un vrai locataire :
 *
 *  · « Contrat de bail signé — Aucun document déposé ». Il ne le sera JAMAIS :
 *    le produit n'enregistre pas le texte d'un bail, et le fabriquer
 *    reviendrait, dit le code lui-même, à « fabriquer un document que rien
 *    n'atteste ». Le locataire, lui, attend un dépôt qui ne viendra pas — alors
 *    qu'un duplicata se demande, sur cet écran, dix centimètres plus bas.
 *  · « État des lieux d'entrée — Aucun document déposé ». Celui-là viendra,
 *    quand il aura été établi.
 *  · « Ma caution versée : — ». Un tiret. Oubli de saisie, ou pas de caution ?
 *    La phrase existait pourtant dans les deux dictionnaires — `leaseDepositNone`,
 *    « Aucune caution enregistrée à votre nom » — et n'était appelée NULLE PART.
 *
 * Trois absences de natures opposées, rendues par la même formule creuse. Un
 * locataire ne peut ni les distinguer, ni savoir laquelle appelle un geste.
 *
 * ═══ POURQUOI ÇA COMPTE PLUS QU'IL N'Y PARAÎT ═══
 *
 * C'est le seul écran du produit où l'utilisateur n'a AUCUN moyen de recouper —
 * il ne connaît pas le parc, il ne connaît que son bail. Une absence muette y
 * devient soit une inquiétude sans objet, soit une relance qu'il n'ose pas
 * faire.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc Bastos', currency: 'XAF' }],
}

/** Un bail SANS caution enregistrée — l'état de la capture. */
const SANS_CAUTION = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Residence Djoumessi',
      district: 'Bastos',
      units: [
        {
          id: 'u-a1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 100,
          rentMinor: 32798,
          tenant: { id: 'loc-1', fullName: COMPTE_FICTIF.fullName, phoneE164: null, hasAccount: true },
          status: 'paid',
          leaseId: 'bail-a1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 32798,
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
  leaseCharges: [],
}

describe('le dossier du locataire', () => {
  beforeEach(async () => {
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()
  })

  it('dit que le bail ne sera pas déposé, et ce qui se demande à la place', async () => {
    const ligne = screen.getByText(/Contrat de bail signé/i).closest('li')!
    /* Le produit n'enregistre pas le texte d'un bail — c'est une décision
       écrite dans le code, pas un oubli. Le locataire doit l'apprendre ici,
       sans quoi il attend un dépôt qui ne viendra jamais. */
    expect(
      within(ligne).getByText(/duplicata/i),
      'la ligne laisse attendre un dépôt qui ne viendra jamais',
    ).toBeInTheDocument()
  })

  it('ne dit rien de tel sur une pièce qui EST là', async () => {
    // La moitié sans laquelle expliquer partout satisferait les cas précédents.
    const ligne = screen.getByText(/Reçu de caution/i).closest('li')!
    expect(within(ligne).queryByText(/pas encore/i)).not.toBeInTheDocument()
    expect(within(ligne).getByRole('link', { name: /consulter/i })).toBeInTheDocument()
  })
})

describe('les absences que la démonstration ne produit pas', () => {
  beforeEach(() => {
    const serveur = installerFauxServeur({ authentifie: true })
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: SANS_CAUTION })
  })

  it('dit que l’état des lieux n’a pas encore été établi', async () => {
    /**
     * CELUI-LÀ VIENDRA, et c'est toute la différence avec le bail.
     *
     * MESURÉ ICI ET NON SUR `/demo`, faute de pouvoir l'y produire : A1 PORTE
     * un état des lieux d'entrée dans le jeu de démonstration, et son
     * commentaire dit pourquoi — « sans état des lieux la rubrique affichait
     * toujours son état vide en rôle locataire, et la fonctionnalité restait
     * invisible ». Le lui retirer rendrait cette absence-ci mesurable en
     * cachant la présence, qui l'était déjà : l'échange est perdant. Sa
     * GÉOMÉTRIE reste donc non mesurée au navigateur.
     */
    await renderApp('/app/documents', { session: SESSION })
    await attendreLeChargement()

    const ligne = (await screen.findByText(/État des lieux d’entrée/i)).closest('li')!
    expect(within(ligne).getByText(/pas encore été établi/i)).toBeInTheDocument()
  })

  it('dit qu’aucune caution n’est enregistrée, au lieu d’un tiret', async () => {
    await renderApp('/app/mon-espace', { session: SESSION })
    await attendreLeChargement()

    /* `leaseDepositNone` existait dans les deux dictionnaires et n'était
       appelée nulle part — une phrase écrite, traduite, et jamais rendue. */
    expect(
      await screen.findByText(/aucune caution enregistrée/i),
      'un tiret ne dit pas si c’est un oubli de saisie ou l’absence de caution',
    ).toBeInTheDocument()
  })
})
