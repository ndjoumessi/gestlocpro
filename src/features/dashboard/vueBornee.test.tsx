import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * UN CHIFFRE JUSTE SUR UN PÉRIMÈTRE INCONNU.
 *
 * ═══ CE QUE LA DÉLÉGATION PAR IMMEUBLE A CRÉÉ EN LE RÉSOLVANT ═══
 *
 * Le périmètre est STRICT — c'est la décision de produit : un gestionnaire à
 * qui l'on a confié deux immeubles sur trois ne voit ni le troisième ni ses
 * chiffres. Le cloisonnement est complet, et c'est ce qu'on voulait.
 *
 * Son effet de bord ne l'était pas. Il lit un tableau de bord entièrement
 * COHÉRENT — encaissé, impayés, taux d'occupation, douze mois de graphique —
 * qui ne porte que sur sa part, sans que rien ne l'en avertisse. Le risque
 * n'est pas qu'il voie trop : c'est qu'il annonce « le parc a encaissé
 * 1,2 million ce mois-ci » à un propriétaire qui en attend le double.
 *
 * Un chiffre juste sur un périmètre inconnu est plus dangereux qu'un chiffre
 * absent, parce que rien en lui n'invite à le vérifier.
 *
 * ═══ CE QUE CES CAS GARDENT ═══
 *
 *  1. l'avertissement paraît quand la vue est bornée, et LÀ où les chiffres
 *     consolidés vivent ;
 *  2. il ne paraît pas quand rien ne borne — l'afficher à qui gère tout le parc
 *     ferait chercher une restriction inexistante ;
 *  3. il ne dit ni le compte ni le nom de ce qui est caché. « 2 sur 3 » dirait
 *     qu'un troisième immeuble existe, et le périmètre strict a été décidé
 *     autrement.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const IMM = 'cccccccc-3333-4000-8333-333333333333'
const A1 = 'aaaaaaaa-1111-4000-8111-111111111111'

function session(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

/** Le portefeuille tel que le serveur le rend — `scoped` en est le sujet. */
function portefeuille(scoped: boolean | undefined) {
  return {
    ...(scoped === undefined ? {} : { scoped }),
    collections: [],
    buildings: [
      {
        id: IMM,
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: A1,
            label: 'A1',
            type: 'T2',
            surfaceSqm: 52,
            rentMinor: 90000,
            tenant: { id: 'loc-A1', fullName: 'Charles Ngassa', phoneE164: null },
            status: 'paid',
            leaseId: 'bail-A1',
            leaseStartsOn: '2025-03-01T00:00:00.000Z',
            paidMinor: 90000,
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
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrir(role: Role, scoped: boolean | undefined) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: portefeuille(scoped) })
  await renderApp('/app', { session: session(role) })
  await attendreLeChargement()
}

const AVERTISSEMENT = /ne gérez qu’une partie de ce parc/i

describe('le gestionnaire dont la vue est bornée', () => {
  it('le lit sur le tableau de bord, où vivent les chiffres consolidés', async () => {
    await ouvrir('manager', true)

    expect(
      screen.getByText(AVERTISSEMENT),
      'il annoncerait les encaissements de sa part comme ceux du parc entier',
    ).toBeInTheDocument()
  })

  it('n’apprend ni le compte ni le nom de ce qu’on lui cache', async () => {
    await ouvrir('manager', true)

    const texte = screen.getByRole('main').textContent ?? ''
    /* « 2 sur 3 » dirait qu'un troisième immeuble existe. Le périmètre strict a
       été décidé autrement : le FAIT, jamais son étendue. */
    expect(texte).not.toMatch(/sur 3|sur trois|2\/3/)
  })
})

describe('celui que rien ne borne', () => {
  it('ne lit aucun avertissement', async () => {
    await ouvrir('manager', false)
    expect(
      screen.queryByText(AVERTISSEMENT),
      'l’afficher à qui gère tout ferait chercher une restriction inexistante',
    ).toBeNull()
  })

  it('n’en lit pas davantage quand le serveur ne dit rien', async () => {
    /* Un serveur antérieur à ce lot ne rend pas le champ. L'absence doit valoir
       « non borné » — l'inverse peindrait tout le monde d'un avertissement.
       C'est le repli CONTRAIRE de `tenantHasAccount`, où l'absence vaut
       « reliée » : là, se taire est prudent ; ici, se taire est de peindre. */
    await ouvrir('manager', undefined)
    expect(screen.queryByText(AVERTISSEMENT)).toBeNull()
  })
})

describe('le propriétaire', () => {
  it('ne le lit jamais, parce qu’il n’est jamais borné', async () => {
    await ouvrir('owner', false)
    expect(screen.queryByText(AVERTISSEMENT)).toBeNull()
  })
})
