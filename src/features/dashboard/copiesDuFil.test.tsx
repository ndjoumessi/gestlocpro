import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * « LE COURRIEL EST-IL PARTI ? » SE LIT SUR L'ÉCRAN.
 *
 * `WorkThreadEmail` a été posée pour répondre à cette question, et le lot qui
 * l'a écrite s'arrêtait là : la réponse existait en base et ne se consultait
 * qu'en requêtant Postgres à la main. Un demi-lot livré comme un lot entier.
 *
 * ═══ TROIS ÉTATS, ET LE TROISIÈME EST LE PLUS IMPORTANT ═══
 *
 * Tout remis, rien remis, et RIEN TENTÉ. Le troisième n'est pas l'absence des
 * deux autres : un fil sans copie tentée est le cas normal d'un chantier ouvert
 * par le bailleur lui-même — personne à prévenir — et afficher « 0 remise »
 * là-dessus ferait lire un échec dans un silence.
 *
 * ═══ CE QUE LA LIGNE NE DIT PAS ═══
 *
 * Aucune adresse. Le serveur ne les rend pas, et l'écran n'en invente pas :
 * « a-t-il été prévenu ? » se répond par un compte et une date.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const A1 = 'aaaaaaaa-1111-4000-8111-111111111111'
const CHANTIER = 'cccccccc-1111-4000-8111-111111111111'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

function portefeuille(emailCopies: unknown) {
  return {
    scoped: false,
    accessUntil: null,
    collections: [],
    buildings: [
      {
        id: 'imm-1',
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: A1,
            label: 'A1',
            type: 'T2',
            surfaceSqm: 52,
            rentMinor: 90000,
            tenant: { id: 'loc-A1', fullName: 'Bekono Landry', phoneE164: null },
            status: 'paid',
            leaseId: 'bail-A1',
            leaseStartsOn: '2025-03-01T00:00:00.000Z',
            paidMinor: 90000,
            overdueDays: null,
          },
        ],
      },
    ],
    works: [
      {
        id: CHANTIER,
        unitId: A1,
        title: 'Fuite sous l’évier',
        trade: 'plumbing',
        status: 'reported',
        urgency: 'normal',
        reportedAt: '2026-08-20T09:00:00.000Z',
        origin: 'tenantReport',
        reportedBy: 'Bekono Landry',
        ...(emailCopies === undefined ? {} : { emailCopies }),
      },
    ],
    deposits: [],
    readings: [],
    inspections: [],
    notifications: [],
    leaseCharges: [],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLeDossier(emailCopies: unknown) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: portefeuille(emailCopies),
  })
  await renderApp(`/app/parc/${A1}`, { session })
  await attendreLeChargement()
}

describe('les copies du fil', () => {
  it('dit combien sont parties, et quand', async () => {
    await ouvrirLeDossier({
      sent: 2,
      delivered: 2,
      lastAttemptAt: '2026-08-20T09:00:00.000Z',
    })
    const ligne = screen.getByText(/2 copies e-mail remises/)
    expect(ligne, 'la réponse ne doit plus vivre en base seulement').toBeInTheDocument()
    expect(ligne.textContent).toContain('20/08/2026')
  })

  it('distingue la tentative NON remise d’une réussite', async () => {
    /* « 1 tentée » et « 1 remise » ne veulent pas dire la même chose, et c'est
       tout l'intérêt de `deliveredAt` : une date posée par avance ferait mentir
       le dossier le jour où quelqu'un contestera avoir été prévenu. */
    await ouvrirLeDossier({
      sent: 3,
      delivered: 1,
      lastAttemptAt: '2026-08-20T09:00:00.000Z',
    })
    expect(screen.getByText(/1 copie e-mail remise sur 3 tentées/)).toBeInTheDocument()
  })

  it('ne dit RIEN quand aucune copie n’a été tentée', async () => {
    /* Le cas normal d'un chantier ouvert par le bailleur : personne à prévenir.
       Afficher « 0 remise » ferait lire un échec dans un silence. */
    await ouvrirLeDossier({ sent: 0, delivered: 0, lastAttemptAt: null })
    expect(screen.queryByText(/copies? e-mail/)).toBeNull()
  })

  it('ne dit rien non plus quand le serveur ne rend pas le champ', async () => {
    await ouvrirLeDossier(undefined)
    expect(screen.queryByText(/copies? e-mail/)).toBeNull()
  })
})

describe('la même ligne sur l’écran des travaux', () => {
  /**
   * ═══ POURQUOI LES DEUX ÉCRANS, ET PAS UN SEUL ═══
   *
   * Le lot qui a posé cette ligne ne l'a mise que dans le dossier du logement,
   * et le nommait en dette à sa dernière section : « `Travaux` porte le même
   * fil et ne la montre pas — l'écran où l'on relance un artisan est justement
   * celui où “l'a-t-il reçu ?” se pose. »
   *
   * Les deux écrans portent le MÊME fil, avec le même regroupement et le même
   * ordre : un échange n'a pas deux histoires selon l'écran qui l'ouvre, et sa
   * trace d'envoi non plus.
   */
  async function ouvrirLesTravaux(emailCopies: unknown) {
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: portefeuille(emailCopies),
    })
    await renderApp('/app/travaux', { session })
    await attendreLeChargement()
  }

  it('dit combien sont parties, et quand', async () => {
    await ouvrirLesTravaux({
      sent: 2,
      delivered: 2,
      lastAttemptAt: '2026-08-20T09:00:00.000Z',
    })
    expect(screen.getByText(/2 copies e-mail remises/)).toBeInTheDocument()
  })

  it('ne dit rien quand aucune copie n’a été tentée', async () => {
    await ouvrirLesTravaux({ sent: 0, delivered: 0, lastAttemptAt: null })
    expect(screen.queryByText(/copies? e-mail/)).toBeNull()
  })
})

describe('l’écran du locataire', () => {
  /**
   * ═══ L'ABSENCE NE TENAIT QUE PAR LE SERVEUR ═══
   *
   * `Signaler` porte le même fil et ne montre pas la trace : c'est voulu — un
   * journal d'envoi est une question de GESTION, et le serveur ne rend pas le
   * champ à un locataire. Mais rien ne gardait cette absence côté écran : le
   * jour où un autre lot ferait remonter `emailCopies` au locataire, ou où
   * quelqu'un monterait `CopiesDuFil` ici par symétrie, personne ne le verrait.
   *
   * Ce cas force le champ DANS la réponse, ce que le serveur ne fait pas, et
   * vérifie que l'écran ne l'affiche pas pour autant. Une règle tenue des deux
   * côtés plutôt que d'un seul.
   */
  it('ne montre RIEN, même si le champ arrivait', async () => {
    const sessionLocataire: EtatSession = {
      statut: 'connecte',
      compte: COMPTE_FICTIF,
      adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc Bastos', currency: 'XAF' }],
    }
    /* LE LOGEMENT DOIT ÊTRE LE SIEN, sans quoi `miens` est vide et l'écran ne
       rend aucun fil : la garde passerait À VIDE, en ne prouvant rien. C'est le
       témoin qui l'a dit — il refusait de rougir. Le rattachement se fait par le
       NOM, comme partout ailleurs dans ces fixtures. */
    const sien = portefeuille({ sent: 3, delivered: 3, lastAttemptAt: '2026-08-20T09:00:00.000Z' })
    sien.buildings[0]!.units[0]!.tenant = {
      id: 'loc-A1',
      fullName: COMPTE_FICTIF.fullName,
      phoneE164: null,
    }
    sien.works[0]!.reportedBy = COMPTE_FICTIF.fullName
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: sien })
    await renderApp('/app/signaler', { session: sessionLocataire })
    await attendreLeChargement()

    expect(
      screen.queryByText(/copies? e-mail/),
      'un journal d’envoi est une question de gestion, pas la sienne',
    ).toBeNull()
  })
})

describe('la copie d’un MESSAGE, sous le message', () => {
  /**
   * ═══ « TOUS MESSAGES CONFONDUS » ═══
   *
   * Le compteur du fil disait « 3 copies remises · 20/08 » pour un échange de
   * cinq messages : la date était la dernière tentative, toutes confondues. On
   * ne savait pas laquelle des cinq n'avait pas trouvé son destinataire.
   *
   * Chaque avis du fil porte désormais SA copie, et la ligne se rend sous lui.
   * Celle du chantier reste : le signalement initial n'est rattaché à aucun
   * message — il EST le fil — et les copies écrites avant cette colonne non
   * plus.
   */
  it('rend la copie sous la réponse, et non seulement sous le chantier', async () => {
    const avecFil = portefeuille({ sent: 1, delivered: 1, lastAttemptAt: '2026-08-20T09:00:00.000Z' })
    avecFil.notifications = [
      {
        id: 'avis-reponse',
        kind: 'work',
        messageKey: 'workReply',
        params: { workId: CHANTIER, text: 'Le plombier passe jeudi.', reference: 'SIG-1' },
        unitId: A1,
        createdAt: '2026-08-21T09:00:00.000Z',
        severity: 'medium',
        read: true,
        channel: 'in_app',
        /* LA COPIE DE CE MESSAGE — le compte que le serveur rattache à l'avis. */
        emailCopies: { sent: 2, delivered: 1, lastAttemptAt: '2026-08-21T09:00:00.000Z' },
      },
    ] as never
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: avecFil })
    await renderApp(`/app/parc/${A1}`, { session })
    await attendreLeChargement()

    expect(
      screen.getByText(/1 copie e-mail remise sur 2 tentées/),
      'la carte d’un message doit dire SA copie, pas celle du fil',
    ).toBeInTheDocument()
  })
})
