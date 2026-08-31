import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LE FIL RÉPOND DANS LES DEUX SENS.
 *
 * ═══ OÙ LA CONVERSATION S'ARRÊTAIT ═══
 *
 * Trois lots ont posé les maillons un par un : la réponse du gestionnaire
 * descend, le signalement du locataire monte, et l'écran du locataire affiche
 * enfin l'échange sous le signalement où il a été déclaré.
 *
 * Il s'arrêtait là. Le gestionnaire écrit « le plombier passe jeudi entre 8 h et
 * 12 h, serez-vous là ? » — et le locataire n'avait AUCUN moyen de répondre. La
 * question était posée dans le produit, la réponse se donnait au téléphone, et
 * la décision qui en sortait ne figurait nulle part dans le dossier.
 *
 * ═══ CE QUE CES CAS GARDENT, ET QU'AUCUNE AUTRE SUITE NE GARDE ═══
 *
 *  1. le locataire peut RÉPONDRE depuis l'écran où il a déclaré, et sa phrase
 *     part vers la route qui existe ;
 *  2. le fil dit QUI a parlé — sans quoi un échange se lit comme un monologue ;
 *  3. la BOÎTE AUX LETTRES ne renvoie à personne sa propre voix. C'est un
 *     défaut qui vivait déjà, invisible tant que le fil ne tournait que dans un
 *     sens : le gestionnaire lisait « Réponse à VOTRE signalement » à propos de
 *     ce qu'il venait d'écrire ;
 *  4. l'écran des TRAVAUX porte le fil, pour que le gestionnaire relise
 *     l'échange là où il décide, et non dans une liste d'avis mêlée d'impayés.
 */

const PARC = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'
const A3 = 'aaaaaaaa-1111-4000-8111-111111111111'
const IMM = 'cccccccc-3333-4000-8333-333333333333'

function session(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const UNITE = {
  id: A3,
  label: 'A3',
  type: 'T2',
  surfaceSqm: 52,
  rentMinor: 90000,
  tenant: { id: 'loc-A3', fullName: 'Serge Mbarga', phoneE164: null },
  status: 'paid',
  leaseId: 'bail-A3',
  leaseStartsOn: '2025-03-01T00:00:00.000Z',
  paidMinor: 90000,
  overdueDays: null,
}

const SIGNALEMENT = {
  id: 'w-fuite',
  reference: 'SIG-2026-042',
  unitId: A3,
  title: 'Fuite sous l’évier',
  trade: 'plumbing',
  status: 'reported',
  urgency: 'normal',
  reportedAt: '2026-07-12T00:00:00.000Z',
  origin: 'tenantReport',
  reportedBy: 'Serge Mbarga',
}

/** Ce que le gestionnaire a écrit : le fil commence par lui. */
const DESCENDANTE = {
  id: 'n-descend',
  kind: 'work',
  messageKey: 'workReply',
  params: {
    text: 'Le plombier passe jeudi entre 8 h et 12 h, serez-vous là ?',
    workId: 'w-fuite',
    reference: 'SIG-2026-042',
  },
  severity: 'medium',
  unitId: A3,
  createdAt: '2026-08-19T10:00:00.000Z',
  read: true,
}

/** Ce que le locataire a répondu : le maillon que ce lot ajoute. */
const MONTANTE = {
  id: 'n-monte',
  kind: 'work',
  messageKey: 'tenantReply',
  params: {
    text: 'Jeudi je travaille, vendredi matin je suis là.',
    workId: 'w-fuite',
    reference: 'SIG-2026-042',
    tenant: 'Serge Mbarga',
    unitId: 'A3',
  },
  severity: 'medium',
  unitId: A3,
  createdAt: '2026-08-20T10:00:00.000Z',
  read: false,
}

function installer(notifications: unknown[]): FauxServeur {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [{ id: IMM, name: 'Résidence Bonamoussadi', district: 'Bonamoussadi', units: [UNITE] }],
      works: [SIGNALEMENT],
      deposits: [],
      readings: [],
      inspections: [],
      notifications,
      leaseCharges: [],
    },
  })
  return faux
}

describe('le locataire répond depuis son écran', () => {
  it('envoie sa phrase à la route, et ne l’annonce qu’après', async () => {
    const faux = installer([DESCENDANTE])
    faux.quand('POST', `/parks/${PARC}/works/w-fuite/reply`, {
      status: 201,
      body: { delivered: true, reporter: { fullName: 'Serge Mbarga' } },
    })
    await renderApp('/app/signaler', { session: session('tenant') })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Répondre' }))
    await user.type(
      screen.getByRole('textbox', { name: /Répondre/ }),
      'Jeudi je travaille, vendredi matin je suis là.',
    )
    await user.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    await screen.findByText('Réponse envoyée')
    const appel = faux.appels.find(
      (a) => a.methode === 'POST' && a.chemin.endsWith('/works/w-fuite/reply'),
    )
    expect(
      appel?.corps,
      'la question est posée dans le produit et la réponse se donne au téléphone',
    ).toEqual({ message: 'Jeudi je travaille, vendredi matin je suis là.' })
  })

  it('relit sa propre phrase dans le fil, sans attendre un rechargement', async () => {
    /* Sans écriture locale, elle n'apparaîtrait qu'au prochain chargement
       complet : il croirait avoir écrit dans le vide et récrirait. */
    const faux = installer([DESCENDANTE])
    faux.quand('POST', `/parks/${PARC}/works/w-fuite/reply`, {
      status: 201,
      body: { delivered: true, reporter: { fullName: 'Serge Mbarga' } },
    })
    await renderApp('/app/signaler', { session: session('tenant') })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Répondre' }))
    await user.type(screen.getByRole('textbox', { name: /Répondre/ }), 'Vendredi matin, sans faute.')
    await user.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    expect(await screen.findByText('Vendredi matin, sans faute.')).toBeInTheDocument()
  })

  it('garde ce qu’il a écrit quand le serveur refuse', async () => {
    /* Vidé d'avance, un refus le laisserait sans même de quoi recommencer —
       le défaut que le formulaire de signalement, au-dessus, a déjà payé. */
    const faux = installer([DESCENDANTE])
    faux.quand('POST', `/parks/${PARC}/works/w-fuite/reply`, {
      status: 404,
      body: { error: 'not_found' },
    })
    await renderApp('/app/signaler', { session: session('tenant') })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Répondre' }))
    const champ = screen.getByRole('textbox', { name: /Répondre/ })
    await user.type(champ, 'La fuite a empiré.')
    await user.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    expect((champ as HTMLTextAreaElement).value).toBe('La fuite a empiré.')
    expect(screen.queryByText('Réponse envoyée')).not.toBeInTheDocument()
  })

  it('peut répondre sur un signalement CLOS, où l’impasse se rouvrait', async () => {
    /* Le gestionnaire répond à tout statut — « c'est réparé, l'artisan est
       passé jeudi ». Refuser au locataire de rendre « non, ça fuit encore »
       rouvrirait l'impasse que ce lot ferme, un cran plus loin. */
    const faux = installer([DESCENDANTE])
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [{ id: IMM, name: 'Résidence Bonamoussadi', district: 'Bonamoussadi', units: [UNITE] }],
        works: [{ ...SIGNALEMENT, status: 'done' }],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [DESCENDANTE],
        leaseCharges: [],
      },
    })
    await renderApp('/app/signaler', { session: session('tenant') })
    await attendreLeChargement()

    expect(screen.getByRole('button', { name: 'Répondre' })).toBeInTheDocument()
  })
})


describe('le fil dit qui a parlé', () => {
  it('distingue les deux voix sous le signalement du locataire', async () => {
    installer([DESCENDANTE, MONTANTE])
    await renderApp('/app/signaler', { session: session('tenant') })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    /* La MÊME étiquette sur les deux lignes ferait d'un échange un monologue :
       le locataire lirait « Réponse de votre gestionnaire » au-dessus de sa
       propre phrase. */
    expect(within(main).getByText(/Réponse de votre gestionnaire/)).toBeInTheDocument()
    expect(within(main).getByText(/Votre réponse/)).toBeInTheDocument()
  })

  it('porte l’échange sur l’écran des travaux, où le gestionnaire décide', async () => {
    installer([DESCENDANTE, MONTANTE])
    await renderApp('/app/travaux', { session: session('manager') })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(
      within(main).getByText(/Le plombier passe jeudi entre 8 h et 12 h/),
      'il répondait sans relire ce qu’il avait déjà écrit',
    ).toBeInTheDocument()
    expect(within(main).getByText(/Jeudi je travaille, vendredi matin je suis là/)).toBeInTheDocument()
    expect(within(main).getByText(/Réponse du locataire/)).toBeInTheDocument()
  })
})

describe('la boîte aux lettres ne renvoie à personne sa propre voix', () => {
  it('cache au gestionnaire la réponse qu’il a lui-même écrite', async () => {
    installer([DESCENDANTE, MONTANTE])
    await renderApp('/app/signalements', { session: session('manager') })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    /* « Réponse à VOTRE signalement » s'adresse au locataire. Affichée au
       gestionnaire, elle lui présente sa propre phrase comme une nouvelle
       reçue — un défaut qui vivait déjà, invisible tant que le fil ne tournait
       que dans un sens. */
    expect(within(main).queryByText(/Réponse à votre signalement/)).not.toBeInTheDocument()
    /* Et la moitié qui empêche de tout masquer : ce qui lui est ADRESSÉ reste. */
    expect(within(main).getByText(/Réponse de Serge Mbarga · A3/)).toBeInTheDocument()
  })

  it('cache au locataire la réponse qu’il a lui-même écrite', async () => {
    installer([DESCENDANTE, MONTANTE])
    await renderApp('/app/signalements', { session: session('tenant') })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(within(main).queryByText(/Réponse de Serge Mbarga/)).not.toBeInTheDocument()
    expect(within(main).getByText(/Réponse à votre signalement/)).toBeInTheDocument()
  })
})
