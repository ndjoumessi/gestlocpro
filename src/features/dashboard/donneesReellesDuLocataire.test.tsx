import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Ce que voit un locataire sur un VRAI parc.
 *
 * Le trou que ces cas bouchent est d'abord un trou de la suite : tous les
 * autres tests du locataire tournent en démonstration, où la constante ET la
 * vérité coïncident. Trois fuites y ont donc survécu sans qu'un seul cas rougisse.
 *
 * Les quittances, la consommation et l'état des lieux étaient importés EN DUR
 * depuis le module de démonstration. Un locataire réel lisait « Loyer · Août
 * 2026 », « payé le 3 août par Mobile Money » et six périodes d'eau et
 * d'électricité inventées, À CÔTÉ de son loyer et de son encaissé véritables.
 * Sur le seul écran du produit où il n'a aucun moyen de recouper — il ne
 * connaît pas le parc, il ne connaît que son bail.
 *
 * Le serveur ne rend qu'UNE échéance par bail et aucun historique : la bonne
 * réponse n'est pas d'en fabriquer un, c'est de dire que le produit ne l'a pas.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LOCATAIRE = 'ffffffff-1111-4222-8333-444444444444'

function sessionLocataire(): EtatSession {
  return {
    statut: 'connecte',
    compte: { ...COMPTE_FICTIF, id: LOCATAIRE },
    adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un parc réel portant UN bail : celui du compte connecté. */
function serveurAvecBail() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: UNITE,
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: '+237 6 00 00 00 00' },
              status: 'paid',
              leaseId: 'bail-1',
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
    },
  })
  return serveur
}

async function ouvrir(route: string) {
  serveurAvecBail()
  renderApp(route, { session: sessionLocataire() })
  await attendreLeChargement()
}

/**
 * Tout ce qui n'appartient QU'AU jeu de démonstration.
 *
 * « Août 2026 » n'y figure pas, et c'est délibéré : la carte du mois affiche
 * désormais la période de l'HORLOGE, qui peut tomber sur ce mois-là sans rien
 * emprunter à la démonstration. Une assertion dessus mesurerait la date du jour
 * plutôt que la provenance des données. Les entrées retenues ci-dessous n'ont,
 * elles, aucune raison légitime d'apparaître.
 */
const DEMONSTRATION = [
  'Mobile Money',
  'Juillet 2026',
  'Charles Ngassa',
  'Résidence Bonamoussadi',
]

describe('espace du locataire sur un vrai parc', () => {
  it('montre SON logement, et non celui de la démonstration', async () => {
    await ouvrir('/app/mon-espace')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Résidence Essos — B7')
  })

  it('ne lui présente aucune période ni aucun moyen de paiement inventés', async () => {
    await ouvrir('/app/mon-espace')
    const main = screen.getByRole('main')
    for (const trace of DEMONSTRATION) expect(main, trace).not.toHaveTextContent(trace)
  })

  /**
   * Le serveur n'a pas d'historique à rendre : l'écran le DIT. Un tableau
   * d'en-têtes sans ligne se lirait comme une panne, et les six périodes de la
   * démonstration se lisaient comme les siennes.
   */
  it('annonce l’absence d’historique au lieu d’en fabriquer un', async () => {
    await ouvrir('/app/mon-espace')
    expect(screen.getByRole('main')).toHaveTextContent('Aucune quittance disponible')
  })

  it('n’invente pas de consommation d’eau ni d’électricité', async () => {
    // Aucun relevé côté serveur : les deux cartes le disent au lieu de servir
    // les 16 m³ et 178 kWh de l'unité A1 de la démonstration.
    await ouvrir('/app/mon-espace')
    const main = screen.getByRole('main')
    expect(main).not.toHaveTextContent('16 m³')
    expect(main).not.toHaveTextContent('178 kWh')
  })
})

describe('documents du locataire sur un vrai parc', () => {
  it('ne lui sert pas les quittances de la démonstration', async () => {
    await ouvrir('/app/documents')
    const main = screen.getByRole('main')
    for (const trace of DEMONSTRATION) expect(main, trace).not.toHaveTextContent(trace)
    expect(main).toHaveTextContent('Aucune quittance disponible')
  })

  /**
   * L'état des lieux venait du module de démonstration, dont les clés sont
   * « A1 », « B4 »… : sur un vrai parc les identifiants sont des `uuid`, la
   * recherche ne trouvait jamais rien, et la ligne annonçait « aucun document
   * déposé » même quand le parc en portait un. Elle passe désormais par l'état
   * partagé — ici vide, donc la case l'est aussi, mais pour la bonne raison.
   */
  it('lit l’état des lieux sur l’état partagé, pas sur la démonstration', async () => {
    await ouvrir('/app/documents')
    const ligne = screen.getByText('État des lieux d’entrée').closest('li')!
    expect(ligne).toHaveTextContent('Aucun document déposé')
  })
})
