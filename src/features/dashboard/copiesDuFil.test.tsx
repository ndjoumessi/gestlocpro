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
    expect(screen.queryByText(/copie e-mail/)).toBeNull()
  })

  it('ne dit rien non plus quand le serveur ne rend pas le champ', async () => {
    await ouvrirLeDossier(undefined)
    expect(screen.queryByText(/copie e-mail/)).toBeNull()
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
    expect(screen.queryByText(/copie e-mail/)).toBeNull()
  })
})
