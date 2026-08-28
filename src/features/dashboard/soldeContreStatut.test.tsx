import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA LIGNE RENDAIT DEUX VERDICTS, EN DEUX COULEURS CONTRAIRES.
 *
 * ═══ CE QU'ON VOYAIT ═══
 *
 *   SOLDE CUMULÉ            STATUT
 *   −5 058 FCFA  (rouge)    ⊘ À jour  (vert)
 *
 * Les deux sont exacts, et ils ne répondent pas à la même question. La pastille
 * porte sur la PÉRIODE COURANTE — c'est le champ `status` du bail, celui que le
 * serveur calcule sur l'échéance en cours. Le solde porte sur le BAIL ENTIER,
 * toutes périodes confondues. Un locataire qui a réglé son mois mais laissé un
 * reliquat au printemps est donc, littéralement, les deux à la fois.
 *
 * L'écran ne le disait nulle part. Il posait un nombre en rouge d'alerte à côté
 * d'une pastille verte de succès et laissait le lecteur trancher — c'est-à-dire
 * conclure que l'un des deux se trompe.
 *
 * ═══ L'ÉCRAN VOISIN, LUI, LE DIT ═══
 *
 * Le Parc porte la même colonne, avec le même mot, et l'annonce dans son
 * sous-titre : « Le statut porte sur le mois affiché. » Les paiements n'ont pas
 * cette phrase — leur sous-titre parle du SOLDE, et dans l'autre sens : « un
 * règlement partiel reste possible : LE SOLDE SUIT SUR LA PÉRIODE SUIVANTE. »
 *
 * Lues ensemble, ces deux phrases disent que le reliquat est reporté sur le mois
 * en cours ; l'écran, lui, montrait le mois en cours soldé. La prose et la
 * grille se contredisaient, et c'est la grille qui avait raison — le report est
 * COMPTABLE, il n'ajoute rien à l'échéance courante.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Trois choses, et la troisième est celle qui empêche la garde d'être creuse :
 *
 *   1. la colonne NOMME sa portée — le mois, pas le bail ;
 *   2. quand les deux divergent, la ligne le DIT, à l'endroit même où elle
 *      qualifie déjà la pastille (« +24 j » y vit depuis toujours) ;
 *   3. un bail dont le solde est nul ne porte AUCUNE mention — sans quoi la
 *      règle serait vraie de toutes les lignes et ne distinguerait rien.
 *
 * Le cas est CONSTRUIT, et il le faut : la démonstration ne porte qu'un seul
 * bail dans cet état — A1, dont l'historique est écrit à la main — et une garde
 * qui ne tiendrait que par lui rougirait le jour où quelqu'un retouche le jeu
 * d'essai pour une raison sans rapport.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const AUTRE = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

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

/** Une période soldée jusqu'au dernier franc. */
function soldee(leaseId: string, mois: string): EcheanceApi {
  return {
    leaseId,
    periodStart: `2026-${mois}-01T00:00:00.000Z`,
    dueOn: `2026-${mois}-05T00:00:00.000Z`,
    rentMinor: 90000,
    waterMinor: 6000,
    powerMinor: 7000,
    paidMinor: 103000,
    payments: [
      { amountMinor: 103000, method: 'transfer', paidOn: `2026-${mois}-03T00:00:00.000Z` },
    ],
  }
}

/**
 * LE CAS : le mois courant est soldé, un mois antérieur ne l'est pas.
 *
 * Août 2026 est réglé en entier — le serveur rend donc `status: 'paid'` et
 * `overdueDays: null`, exactement ce qu'il rendrait pour un locataire
 * irréprochable. Juin laisse 5 000 F : c'est ce reliquat, et lui seul, qui rend
 * le solde cumulé positif.
 */
const AVEC_RELIQUAT: EcheanceApi[] = [
  soldee('bail-1', '08'),
  soldee('bail-1', '07'),
  { ...soldee('bail-1', '06'), paidMinor: 98000, payments: [] },
]

/** Le témoin : le même bail, sans rien laisser derrière lui. */
const SANS_RELIQUAT: EcheanceApi[] = [
  soldee('bail-2', '08'),
  soldee('bail-2', '07'),
  soldee('bail-2', '06'),
]

function serveur(leaseCharges: EcheanceApi[]) {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              /* `paid` ET `paidMinor` disent le mois COURANT réglé : c'est ce
                 qui produit la pastille verte, et c'est tout l'intérêt du cas. */
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2026-06-01T00:00:00.000Z',
              paidMinor: 90000,
              overdueDays: null,
            },
            {
              id: AUTRE,
              label: 'B8',
              type: 'T2',
              surfaceSqm: 50,
              rentMinor: 90000,
              tenant: { id: 'loc-2', fullName: 'Paul Nkodo', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-2',
              leaseStartsOn: '2026-06-01T00:00:00.000Z',
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
  return faux
}

async function ouvrir(leaseCharges: EcheanceApi[]) {
  serveur(leaseCharges)
  await renderApp('/app/paiements', { session: sessionProprietaire() })
  await attendreLeChargement()
}

/** La ligne du bail, désignée par son locataire. */
function ligneDe(nom: string): HTMLElement {
  const cellule = screen.getByText(nom)
  const ligne = cellule.closest('tr')
  if (!ligne) throw new Error(`aucune ligne pour ${nom}`)
  return ligne
}

describe('le solde du bail et le statut du mois', () => {
  it('nomme la portée de la colonne d’état', async () => {
    await ouvrir([...AVEC_RELIQUAT, ...SANS_RELIQUAT])
    /*
      « Statut » seul est ambigu sur CET écran, parce qu'une seconde colonne y
      porte l'autre portée — « Solde cumulé » dit le bail, l'état doit dire le
      mois. Le Parc, lui, l'annonce dans son sous-titre ; ici la colonne le
      porte elle-même, ce qui vaut mieux : un en-tête reste sous les yeux quand
      on lit la vingtième ligne.
    */
    const entetes = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim() ?? '')
    expect(entetes.join(' | ')).toMatch(/statut du mois/i)
  })

  it('dit le reliquat quand le mois est soldé mais que le bail doit encore', async () => {
    await ouvrir([...AVEC_RELIQUAT, ...SANS_RELIQUAT])
    const ligne = ligneDe('Awa Bello')

    // La pastille reste juste : le mois EST réglé. Ce n'est pas elle qu'on
    // corrige, c'est le silence à côté.
    expect(within(ligne).getByText(/à jour/i)).toBeInTheDocument()
    /* 5 000 F laissés en juin : le solde cumulé les porte. LES ESPACES SONT
       NORMALISÉES, et il a fallu s'y reprendre : `Intl` compose les milliers
       avec une insécable ÉTROITE (U+202F), tandis que `toHaveTextContent`
       normalise les espaces du DOM et la rend ordinaire. Une expression
       régulière écrite avec le caractère réel ne trouvait donc rien, sur un
       texte qui le contient bel et bien. Le piège est documenté dans
       `mesure-ui` ; il se paie aussi ici. */
    expect((ligne.textContent ?? '').replace(/\s/g, ' ')).toContain('5 000')
    // Et la ligne NOMME ce que le vert ne dit pas.
    expect(ligne, 'rien ne relie la pastille verte au solde rouge').toHaveTextContent(
      /reliquat/i,
    )
  })

  it('ne porte aucune mention sur un bail qui ne doit rien', async () => {
    await ouvrir([...AVEC_RELIQUAT, ...SANS_RELIQUAT])
    /*
      SANS CE CAS, LA RÈGLE SERAIT VRAIE PARTOUT ET NE DIRAIT RIEN. Une mention
      posée sur toutes les lignes soldées cesserait d'être une information pour
      devenir un ornement — c'est le reproche que ce dépôt fait ailleurs à
      l'alerte permanente, et il vaut aussi pour une mention permanente.
    */
    const ligne = ligneDe('Paul Nkodo')
    expect(within(ligne).getByText(/à jour/i)).toBeInTheDocument()
    expect(ligne).not.toHaveTextContent(/reliquat/i)
  })
})
