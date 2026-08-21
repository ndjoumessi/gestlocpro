import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { captureDownloads } from '@/test/downloads'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La grille des paiements, période par période.
 *
 * L'écran ne montrait que le mois courant : « dû », « réglé », « solde ». On y
 * lisait l'état d'un bail à un instant, jamais son histoire — impossible de
 * distinguer un retard de ce mois-ci d'une dette qui court depuis six mois, ni
 * de voir que l'eau est réglée quand le loyer ne l'est pas.
 *
 * La donnée était déjà là : le serveur rend toutes les périodes de tous les
 * baux depuis l'historique des quittances, et l'espace du locataire affiche
 * cette grille pour son logement. Seul l'écran du gestionnaire l'ignorait.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

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

/**
 * Trois périodes d'un même bail, dans trois états différents.
 *
 * Juin est soldé. Juillet ne l'est qu'en partie : le loyer et l'eau sont
 * couverts, l'électricité non — c'est le cas que trois pastilles distinguent et
 * qu'un statut unique écrasait. Août n'a rien reçu.
 *
 * Le cumul est donc : 7 300 (le reste de juillet) + 103 800 (tout août).
 */
const HISTORIQUE: EcheanceApi[] = [
  {
    leaseId: 'bail-1',
    periodStart: '2026-08-01T00:00:00.000Z',
    dueOn: '2026-08-05T00:00:00.000Z',
    rentMinor: 90000,
    waterMinor: 6500,
    powerMinor: 7300,
    paidMinor: 0,
    payments: [],
  },
  {
    leaseId: 'bail-1',
    periodStart: '2026-07-01T00:00:00.000Z',
    dueOn: '2026-07-05T00:00:00.000Z',
    rentMinor: 90000,
    waterMinor: 6500,
    powerMinor: 7300,
    paidMinor: 96500,
    payments: [{ amountMinor: 96500, method: 'cash', paidOn: '2026-07-04T00:00:00.000Z' }],
  },
  {
    leaseId: 'bail-1',
    periodStart: '2026-06-01T00:00:00.000Z',
    dueOn: '2026-06-05T00:00:00.000Z',
    rentMinor: 90000,
    waterMinor: 6200,
    powerMinor: 7100,
    paidMinor: 103300,
    payments: [{ amountMinor: 103300, method: 'transfer', paidOn: '2026-06-03T00:00:00.000Z' }],
  },
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
              status: 'overdue',
              leaseId: 'bail-1',
              leaseStartsOn: '2026-06-01T00:00:00.000Z',
              paidMinor: 0,
              overdueDays: 12,
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
  renderApp('/app/paiements', { session: sessionProprietaire() })
  await attendreLeChargement()
}

describe('grille des paiements — les périodes', () => {
  it('donne une colonne à chaque période servie par le serveur', async () => {
    await ouvrir(HISTORIQUE)
    const table = screen.getByRole('table')
    for (const mois of ['juin', 'juil', 'août'])
      expect(table.textContent?.toLowerCase(), mois).toContain(mois)
  })

  /**
   * Chaque cellule énonce ses trois postes en toutes lettres.
   *
   * La couleur ne porte pas l'information seule : une grille de pastilles
   * vertes et rouges est illisible pour qui ne distingue pas les deux, et c'est
   * la règle que le dépôt applique déjà à l'entrée de navigation courante.
   *
   * On interroge le RÔLE, et le nom par `toHaveAccessibleName`. La rédaction
   * précédente demandait `getByLabelText` puis relisait `aria-label` : deux
   * lectures d'attribut qui ne passent jamais par le calcul du nom accessible.
   * Elles réussissaient sur un `<span>` nu, dont le rôle implicite `generic`
   * interdit pourtant d'être nommé — le test promettait une cellule parlante là
   * où un navigateur conforme n'énonçait rien.
   */
  it('nomme l’état de chaque poste, sans compter sur la couleur', async () => {
    await ouvrir(HISTORIQUE)
    const juillet = screen.getByRole('img', { name: /juillet 2026/i })
    // Loyer et eau soldés, électricité impayée : le versement couvre 96 500 des
    // 103 800 dus, imputés dans l'ordre loyer → eau → électricité.
    expect(juillet).toHaveAccessibleName(/loyer soldé/i)
    expect(juillet).toHaveAccessibleName(/eau soldé/i)
    expect(juillet).toHaveAccessibleName(/électricité impayé/i)
  })

  it('cumule la dette sur toutes les périodes, et non sur le seul mois', async () => {
    await ouvrir(HISTORIQUE)
    // 7 300 de juillet + 103 800 d'août = 111 100. Le mois courant seul en
    // aurait annoncé 103 800, et le tableau ne disait pas que la dette courait
    // depuis le mois d'avant.
    expect(screen.getByRole('table')).toHaveTextContent('111 100')
  })

  /**
   * ET L'EXPORT DIT LE MÊME CHIFFRE QUE LE TABLEAU.
   *
   * Il écrivait `dû − encaissé`, c'est-à-dire le mois COURANT, sous un en-tête
   * qui promettait le cumul : 103 800 au lieu de 111 100, soit tout l'arriéré
   * de juillet passé à la trappe. Et c'est le fichier exporté qui sert à
   * réclamer — on a lu le chiffre à l'écran, on le croit sur parole dans le
   * tableur.
   *
   * Le cas vit ICI et non dans le fichier des exports : celui-là s'exécute sur
   * un parc SANS historique, où les deux formules coïncident et où aucune
   * mutation ne peut les séparer. Une garde qui ne peut pas distinguer les deux
   * réponses ne garde rien.
   */
  it('exporte le solde cumulé, et non l’écart du mois', async () => {
    await ouvrir(HISTORIQUE)

    const capture = captureDownloads()
    try {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /exporter le relevé/i }))

      const fichiers = await capture.settle()
      expect(fichiers).toHaveLength(1)
      // Le montant exporté est brut, sans séparateur de milliers : c'est ce
      // qu'un tableur sait additionner.
      expect(fichiers[0].text).toContain('111100')
      expect(fichiers[0].text).not.toContain('103800')
    } finally {
      capture.restore()
    }
  })

  /**
   * Sur un parc sans échéance enregistrée, la grille ne s'affiche pas.
   *
   * Six colonnes de tirets se liraient comme une panne. L'écran retombe alors
   * sur ce qu'il sait — le dû et l'encaissé du mois.
   */
  it('garde les colonnes du mois quand aucune période n’est connue', async () => {
    await ouvrir([])
    const table = screen.getByRole('table')
    expect(table.textContent?.toLowerCase()).not.toContain('juin')
    expect(screen.queryByText('Par cellule : loyer · eau · électricité')).toBeNull()
    // Le loyer dû reste lisible : c'est la seule mesure disponible.
    expect(table).toHaveTextContent('90 000')
  })
})
