import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
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
 * Le serveur ne rendait qu'UNE échéance par bail et aucun historique : la bonne
 * réponse n'était pas d'en fabriquer un, c'était de dire que le produit ne
 * l'avait pas. Il le rend depuis — le dernier bloc de ce fichier le vérifie —,
 * et le cas de la case vide reste : un parc sans échéance enregistrée existe,
 * et doit se lire comme tel plutôt que comme une panne.
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

/** Une période facturée, telle que le serveur la rend. */
interface EcheanceApi {
  leaseId: string
  periodStart: string
  dueOn: string
  rentMinor: number
  waterMinor: number
  powerMinor: number
  paidMinor: number
  payments: { amountMinor: number; method: string; paidOn: string }[]
}

/** Un parc réel portant UN bail : celui du compte connecté. */
function serveurAvecBail(leaseCharges: EcheanceApi[] = []) {
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
      leaseCharges,
    },
  })
  return serveur
}

async function ouvrir(route: string, leaseCharges: EcheanceApi[] = []) {
  serveurAvecBail(leaseCharges)
  await renderApp(route, { session: sessionLocataire() })
  await attendreLeChargement()
}

/**
 * Deux périodes du bail, telles que le serveur les rend.
 *
 * Le loyer de juin — 88 000 — n'est PAS celui du bail d'aujourd'hui, qui vaut
 * 90 000. L'écart est là pour être vu : la colonne affichait le loyer courant
 * de l'unité sur chaque ligne, si bien qu'une révision de loyer réécrivait tout
 * l'historique jusqu'au premier mois.
 *
 * Juillet n'est réglé qu'en partie : 90 000 de loyer et 6 500 d'eau couverts,
 * puis 3 000 sur les 7 300 d'électricité. C'est la seule ligne qui appelle un
 * geste, et le tableau doit dire lequel.
 */
const HISTORIQUE: EcheanceApi[] = [
  {
    leaseId: 'bail-1',
    periodStart: '2026-07-01T00:00:00.000Z',
    dueOn: '2026-07-05T00:00:00.000Z',
    rentMinor: 90000,
    waterMinor: 6500,
    powerMinor: 7300,
    paidMinor: 99500,
    payments: [{ amountMinor: 99500, method: 'cash', paidOn: '2026-07-04T00:00:00.000Z' }],
  },
  {
    leaseId: 'bail-1',
    periodStart: '2026-06-01T00:00:00.000Z',
    dueOn: '2026-06-05T00:00:00.000Z',
    rentMinor: 88000,
    waterMinor: 6200,
    powerMinor: 7100,
    paidMinor: 101300,
    payments: [{ amountMinor: 101300, method: 'transfer', paidOn: '2026-06-03T00:00:00.000Z' }],
  },
]

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
   * Ce parc-ci ne porte aucune échéance — la réponse ne contient pas de
   * `leaseCharges` — et l'écran le DIT. Un tableau d'en-têtes sans ligne se
   * lirait comme une panne, et les six périodes de la démonstration se lisaient
   * comme les siennes.
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

/**
 * L'historique servi par le SERVEUR.
 *
 * Il n'existait pas : `/parks/:id/portfolio` ne rendait qu'une échéance par
 * bail, et les deux écrans du locataire annonçaient honnêtement leur case vide.
 * Ces cas montent un parc qui en porte un, et vérifient que ce sont bien ces
 * périodes-là — et rien de la démonstration — qui atteignent l'écran.
 */
describe('historique des quittances servi par le serveur', () => {
  it('affiche les périodes du bail, et non la case vide', async () => {
    await ouvrir('/app/mon-espace', HISTORIQUE)
    const main = screen.getByRole('main')
    expect(main).not.toHaveTextContent('Aucune quittance disponible')
    expect(main).toHaveTextContent('Juin 2026')
    /* Les traces de démonstration SAUF les périodes : « Juillet 2026 » est
       ici une période du serveur, et l'exclure de la liste dirait le
       contraire de ce que ce cas vérifie. */
    for (const trace of ['Mobile Money', 'Charles Ngassa', 'Résidence Bonamoussadi'])
      expect(main, trace).not.toHaveTextContent(trace)
  })

  it('porte le loyer DE LA PÉRIODE, et non celui du bail d’aujourd’hui', async () => {
    await ouvrir('/app/mon-espace', HISTORIQUE)
    /**
     * L'assertion porte sur LA LIGNE de juin, pas sur la table.
     *
     * Écrite sur la table entière, elle ne mordait pas : rendre à nouveau le
     * loyer courant — 90 000 — laissait « 88 000 » à l'écran, cette fois comme
     * part réglée d'une ligne devenue partielle. Le chiffre attendu était là,
     * au mauvais titre, et le cas restait vert. Une ligne soldée de 88 000 et
     * une ligne partielle de 90 000 dont il reste 2 000 ne se distinguent que
     * dans leur ligne.
     */
    const juin = screen.getByRole('row', { name: /Juin 2026/ })
    expect(juin).toHaveTextContent('88 000')
    expect(juin).not.toHaveTextContent('90 000')
    // Juin est soldé : aucun reste à réclamer sur cette ligne.
    expect(juin).not.toHaveTextContent('reste')
  })

  it('montre le reste dû d’une période partiellement réglée', async () => {
    await ouvrir('/app/mon-espace', HISTORIQUE)
    // 7 300 d'électricité, 3 000 versés une fois le loyer et l'eau couverts :
    // il reste 4 300, et c'est le seul chiffre qui appelle un geste.
    expect(screen.getByRole('table')).toHaveTextContent('reste 4 300')
  })

  it('sert les mêmes périodes à l’écran des documents', async () => {
    await ouvrir('/app/documents', HISTORIQUE)
    const main = screen.getByRole('main')
    expect(main).not.toHaveTextContent('Aucune quittance disponible')
    expect(main).toHaveTextContent('Juin 2026')
    expect(main).toHaveTextContent('Juillet 2026')
  })

  /**
   * UNE QUITTANCE PORTE UN MONTANT, sinon elle n'est qu'une date.
   *
   * La liste ne rendait que le mois et un bouton. Six lignes identiques à
   * l'exception d'un nom de mois : rien ne distinguait la période à 101 300 de
   * celle à 103 800, et le locataire téléchargeait pour savoir ce qu'il
   * téléchargeait. La donnée était là — `receiptDue` la calcule pour les deux
   * autres écrans, et l'export de cette carte-ci l'écrit déjà dans son fichier.
   *
   * C'est le TOTAL DÛ de la période, ce que la quittance couvre — et non le
   * réglé. Juillet est partiellement soldé : 99 500 versés sur 103 800. Afficher
   * le versement ici ferait lire « 99 500 » comme le montant du document. Le
   * reste dû a son écran, avec la primitive qui distingue les deux ; celui-ci
   * identifie une pièce.
   *
   * Les nombres sont cherchés avec un séparateur souple : `Intl` compose les
   * milliers avec une espace fine insécable, qui n'est pas l'espace ordinaire.
   */
  it('nomme le montant de chaque quittance', async () => {
    await ouvrir('/app/documents', HISTORIQUE)
    const main = screen.getByRole('main')
    expect(main, 'juillet ne porte pas son total').toHaveTextContent(/103\s?800/)
    expect(main, 'juin ne porte pas son total').toHaveTextContent(/101\s?300/)
    /* Le versement partiel de juillet ne doit PAS passer pour le montant de la
       pièce : c'est le chiffre qu'on lirait si la ligne montrait le réglé. */
    expect(main, 'la ligne montre le versement au lieu du dû').not.toHaveTextContent(/99\s?500/)
  })
})

/**
 * La barre du locataire CONNECTÉ.
 *
 * Elle porte son identité, et par elle la sortie : sur un poste partagé — le
 * cas courant du marché visé — la déconnexion est le geste qui compte, et la
 * coquille précédente la logeait dans une barre latérale que le locataire n'a
 * plus. Le sélecteur de profil, lui, appartient à la démonstration : proposer
 * à un vrai locataire de « regarder en propriétaire » annoncerait un pouvoir
 * que le serveur lui refuse.
 */
describe('barre du locataire connecté', () => {
  it('porte le menu du compte, et non le sélecteur de profil', async () => {
    await ouvrir('/app/mon-espace')
    const barre = screen.getByRole('banner')
    expect(within(barre).getByRole('button', { name: /Sarah Ngassa/ })).toBeInTheDocument()
    expect(within(barre).queryByRole('combobox')).toBeNull()
  })
})

/**
 * Les demandes de pièces, sur un vrai parc.
 *
 * Le jeu de démonstration en porte deux, sur l'unité A1 — « Attestation de bon
 * paiement » en attente, « Attestation de résidence » fournie. Ce sont des
 * dates et des états qui n'appartiennent à personne d'autre qu'au personnage de
 * la démonstration : servis à un locataire réel, ils lui annonceraient qu'on
 * lui a fourni une pièce qu'il n'a jamais demandée.
 */
describe('demandes de documents sur un vrai parc', () => {
  it('n’affiche aucune demande tant que le serveur n’en rend pas', async () => {
    await ouvrir('/app/documents')
    const main = screen.getByRole('main')
    // La liste de suivi n'existe pas : elle ne s'affiche que s'il y a quelque
    // chose à suivre.
    expect(screen.queryByRole('list', { name: 'Mes demandes' })).toBeNull()
    expect(main).not.toHaveTextContent('Attestation de bon paiement · Demandée')
    // Et les trois cases restent proposables : rien n'est « déjà en attente ».
    expect(screen.getByRole('radio', { name: 'Attestation de résidence' })).toBeEnabled()
  })
})
