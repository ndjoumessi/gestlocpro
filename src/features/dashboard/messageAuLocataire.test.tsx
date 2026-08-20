import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, within, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LE CANAL DANS L'AUTRE SENS.
 *
 * Deux routes livrées sans écran au lot précédent : répondre à un signalement,
 * et prévenir tous les locataires d'un coup. Un canal branché des deux côtés du
 * serveur et muet à l'interface ne répond à personne — c'est la dette que ce
 * dépôt s'était déjà reprochée deux fois, et que ces cas ferment.
 *
 * Ce qui est gardé ici, et qu'aucune autre suite ne garde :
 *   1. le bouton n'existe que là où le serveur accepte le geste ;
 *   2. l'écran dit ce que le serveur a répondu — qui LIRA, et qui reste à
 *      appeler — plutôt qu'un « envoyé » uniforme ;
 *   3. une annonce n'ouvre sur aucun écran, et son bouton disparaît.
 */

const PARC = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'
const A3 = 'aaaaaaaa-1111-4000-8111-111111111111'
const B2 = 'bbbbbbbb-2222-4000-8222-222222222222'
const IMM_1 = 'cccccccc-3333-4000-8333-333333333333'
const IMM_2 = 'dddddddd-4444-4000-8444-444444444444'

function session(role: Role = 'owner'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const unite = (id: string, label: string, tenant: string) => ({
  id,
  label,
  type: 'T2',
  surfaceSqm: 52,
  rentMinor: 90000,
  tenant: { id: `loc-${label}`, fullName: tenant, phoneE164: null },
  status: 'paid',
  leaseId: `bail-${label}`,
  leaseStartsOn: '2025-03-01T00:00:00.000Z',
  paidMinor: 90000,
  overdueDays: null,
})

/** Signalé par le locataire d'A3 : le serveur a quelqu'un à qui répondre. */
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

/** Ouvert par le bailleur lui-même : le serveur rendrait 409 `no_reporter`. */
const CHANTIER = {
  id: 'w-refection',
  reference: 'SIG-2026-034',
  unitId: B2,
  title: 'Réfection du séjour',
  trade: 'painting',
  status: 'reported',
  urgency: 'low',
  reportedAt: '2026-06-22T00:00:00.000Z',
  origin: 'ownerInitiative',
  reportedBy: 'Arsène Nkolo',
}

function installer(options: { works?: unknown[]; notifications?: unknown[] } = {}): FauxServeur {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        { id: IMM_1, name: 'Résidence Bonamoussadi', district: 'Bonamoussadi', units: [unite(A3, 'A3', 'Serge Mbarga')] },
        { id: IMM_2, name: 'Immeuble Akwa Nord', district: 'Akwa', units: [unite(B2, 'B2', 'Nadia Belinga')] },
      ],
      works: options.works ?? [SIGNALEMENT, CHANTIER],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: options.notifications ?? [],
      leaseCharges: [],
    },
  })
  return faux
}

/**
 * ON ATTEND UNE DONNÉE, JAMAIS UN TITRE.
 *
 * Le `<h1>` est rendu par l'écran de chargement autant que par l'écran chargé :
 * l'attendre laisserait les assertions d'ABSENCE — « le bailleur n'a pas ce
 * bouton » — passer sur un DOM encore vide, pour la mauvaise raison.
 */
const carte = (titre: RegExp) =>
  screen.getByRole('heading', { name: titre }).closest<HTMLElement>('[role="listitem"]')!

describe('répondre au locataire qui a signalé', () => {
  it('n’offre le geste que là où le serveur a quelqu’un à qui répondre', async () => {
    installer()
    renderApp('/app/travaux', { session: session() })
    // La référence du signalement n'existe qu'une fois la réponse du serveur
    // arrivée, et une seule ligne la porte.
    await screen.findByText(/SIG-2026-042/)

    // Les DEUX moitiés. Sans la seconde, le cas serait vrai d'un écran qui
    // n'affiche aucun bouton du tout.
    expect(carte(/évier/i).textContent).toContain('Répondre')
    expect(carte(/séjour/i).textContent).not.toContain('Répondre')
  })

  it('ne le propose pas au locataire : c’est lui qui a signalé', async () => {
    installer()
    renderApp('/app/travaux', { session: session('tenant') })
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: 'Répondre' })).not.toBeInTheDocument()
  })

  it('envoie le message et dit qui le lira', async () => {
    const faux = installer()
    faux.quand('POST', `/parks/${PARC}/works/w-fuite/reply`, {
      status: 201,
      body: { delivered: true, reporter: { fullName: 'Serge Mbarga' } },
    })
    renderApp('/app/travaux', { session: session() })
    // La référence du signalement n'existe qu'une fois la réponse du serveur
    // arrivée, et une seule ligne la porte.
    await screen.findByText(/SIG-2026-042/)

    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: 'Répondre' }))
    await clavier.type(screen.getByRole('textbox'), 'Le plombier passe jeudi matin.')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    await screen.findByText(/Serge Mbarga la lira dans ses notifications/)

    // Le TEXTE part tel qu'il a été écrit : c'est la seule donnée d'alerte que
    // personne ne formate ni ne traduit.
    const appel = faux.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/reply'))
    expect(appel?.corps).toEqual({ message: 'Le plombier passe jeudi matin.' })
  })

  /**
   * LE CAS QUI JUSTIFIE TOUT LE RESTE.
   *
   * Le serveur consigne la réponse au dossier mais distingue ce qui sera LU :
   * un locataire dont la fiche n'est reliée à aucun compte n'a pas d'espace où
   * la trouver. Annoncer « réponse envoyée » dans ce cas laisserait le
   * gestionnaire croire qu'il a prévenu quelqu'un.
   */
  it('dit qu’il reste un appel à passer quand le locataire n’a pas de compte', async () => {
    const faux = installer()
    faux.quand('POST', `/parks/${PARC}/works/w-fuite/reply`, {
      status: 201,
      body: { delivered: false, reporter: { fullName: 'Serge Mbarga' } },
    })
    renderApp('/app/travaux', { session: session() })
    // La référence du signalement n'existe qu'une fois la réponse du serveur
    // arrivée, et une seule ligne la porte.
    await screen.findByText(/SIG-2026-042/)

    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: 'Répondre' }))
    await clavier.type(screen.getByRole('textbox'), 'Le plombier passe jeudi matin.')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    await screen.findByText(/n’a pas de compte/)
    expect(screen.queryByText(/la lira dans ses notifications/)).not.toBeInTheDocument()
  })

  it('refuse un message trop court sans appeler le serveur', async () => {
    const faux = installer()
    renderApp('/app/travaux', { session: session() })
    // La référence du signalement n'existe qu'une fois la réponse du serveur
    // arrivée, et une seule ligne la porte.
    await screen.findByText(/SIG-2026-042/)

    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: 'Répondre' }))
    await clavier.type(screen.getByRole('textbox'), 'ok')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))

    await screen.findByText(/au moins 3 caractères/)
    expect(faux.appels.some((a) => a.chemin.endsWith('/reply'))).toBe(false)
  })
})

describe('prévenir les locataires', () => {
  async function ouvrirLaModale() {
    const faux = installer()
    renderApp('/app/locataires', { session: session() })
    // Le libellé du logement : le tableau des baux n'existe qu'une fois le parc
    // chargé, et l'en-tête est rendu par le squelette autant que par l'écran.
    await screen.findByText('A3')
    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: /Prévenir les locataires/ }))
    return { faux, clavier }
  }

  it('écrit à tout le parc par défaut', async () => {
    const { faux, clavier } = await ouvrirLaModale()
    faux.quand('POST', `/parks/${PARC}/announcements`, {
      status: 201,
      body: { delivered: 2, unreachable: [] },
    })

    await clavier.type(screen.getByRole('textbox'), 'Coupure d’eau jeudi de 8 h à 12 h.')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer' }))

    await screen.findByText(/2 locataires le liront/)
    const appel = faux.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/announcements'))
    // AUCUN `buildingId` : c'est l'absence du champ, et non une valeur vide,
    // que le serveur lit comme « tout le parc ».
    expect(appel?.corps).toEqual({ message: 'Coupure d’eau jeudi de 8 h à 12 h.' })
  })

  it('borne l’envoi à l’immeuble choisi', async () => {
    const { faux, clavier } = await ouvrirLaModale()
    faux.quand('POST', `/parks/${PARC}/announcements`, {
      status: 201,
      body: { delivered: 1, unreachable: [] },
    })

    await clavier.selectOptions(screen.getByRole('combobox'), IMM_2)
    await clavier.type(screen.getByRole('textbox'), 'L’ascenseur est à l’arrêt.')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer' }))

    await screen.findByText(/1 locataire le lira/)
    const appel = faux.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/announcements'))
    expect(appel?.corps).toEqual({ message: 'L’ascenseur est à l’arrêt.', buildingId: IMM_2 })
  })

  /**
   * CE QUI N'EST PAS PARTI SE DIT, ET SE NOMME.
   *
   * Rendre le seul compte d'envois laisserait croire que tout l'immeuble est
   * prévenu. Le bailleur a besoin de la liste de ceux qu'il lui reste à
   * appeler — des noms, pas un nombre : on ne rappelle pas « deux personnes ».
   */
  it('nomme ceux qui ne liront rien', async () => {
    const { faux, clavier } = await ouvrirLaModale()
    faux.quand('POST', `/parks/${PARC}/announcements`, {
      status: 201,
      body: {
        delivered: 1,
        unreachable: [
          { tenantId: 'loc-B2', fullName: 'Nadia Belinga' },
          { tenantId: 'loc-C1', fullName: 'Cabinet Njoya' },
        ],
      },
    })

    await clavier.type(screen.getByRole('textbox'), 'Coupure d’eau jeudi.')
    await clavier.click(screen.getByRole('button', { name: 'Envoyer' }))

    await screen.findByText(/2 locataires n’ont pas de compte/)
    // DANS LA MODALE : les mêmes noms figurent dans le tableau des locataires,
    // derrière elle. Chercher au niveau de l'écran passerait sans que le compte
    // rendu d'envoi n'ait rien affiché.
    const modale = within(screen.getByRole('dialog'))
    expect(modale.getByText(/Nadia Belinga/)).toBeInTheDocument()
    expect(modale.getByText(/Cabinet Njoya/)).toBeInTheDocument()
  })
})

describe('ce que le locataire lit', () => {
  const ANNONCE = {
    id: 'n-annonce',
    kind: 'announcement',
    messageKey: 'announcement',
    params: { text: 'Coupure d’eau jeudi de 8 h à 12 h.' },
    severity: 'medium',
    unitId: null,
    createdAt: '2026-08-19T09:00:00.000Z',
    read: false,
  }

  const REPONSE = {
    id: 'n-reponse',
    kind: 'work',
    messageKey: 'workReply',
    params: { text: 'Le plombier passe jeudi matin.', workId: 'w-fuite', reference: 'SIG-2026-042' },
    severity: 'medium',
    unitId: A3,
    createdAt: '2026-08-19T10:00:00.000Z',
    read: false,
  }

  /**
   * Sans les libellés, l'écran composait `app.alerts.msg.announcement.title` et
   * l'affichait EN TOUTES LETTRES : la clé absente d'un dictionnaire est rendue
   * telle quelle. C'est le premier défaut relevé sur la maquette, et il serait
   * revenu par la porte du serveur.
   */
  it('rend le texte du bailleur, et non le nom de la clé', async () => {
    installer({ notifications: [ANNONCE, REPONSE] })
    renderApp('/app/signalements', { session: session() })
    await screen.findByText(/Coupure d’eau jeudi de 8 h à 12 h/)

    expect(screen.getByText('Message de votre bailleur')).toBeInTheDocument()
    expect(screen.getByText('Réponse à votre signalement')).toBeInTheDocument()
    // La référence rattache la réponse au signalement : sans elle, les réponses
    // s'empilent dans une liste sans dire de quoi elles parlent.
    expect(screen.getByText(/SIG-2026-042 · Le plombier passe jeudi matin/)).toBeInTheDocument()
    expect(screen.queryByText(/app\.alerts\.msg/)).not.toBeInTheDocument()
  })

  /**
   * Une annonce n'appelle AUCUN geste : elle informe. Le bouton « Ouvrir »
   * l'aurait renvoyée à la racine de l'espace — `lien(base, '')` — en faisant
   * chercher un écran de traitement qui n'existe pas.
   */
  it('n’offre pas d’issue à une annonce, et en garde une à la réponse', async () => {
    installer({ notifications: [ANNONCE, REPONSE] })
    renderApp('/app/signalements', { session: session() })
    await screen.findByText(/Coupure d’eau jeudi de 8 h à 12 h/)

    const annonce = screen.getByText('Message de votre bailleur').closest<HTMLElement>('[role="listitem"]')!
    expect(annonce.textContent).not.toContain('Ouvrir')

    // La moitié qui empêche de tout masquer : une réponse à un signalement
    // renvoie bien aux travaux.
    const reponse = screen.getByText('Réponse à votre signalement').closest<HTMLElement>('[role="listitem"]')!
    await waitFor(() => expect(reponse.textContent).toContain('Ouvrir'))
  })
})
