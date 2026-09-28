import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA LIGNE QUI APPELLE UN GESTE LE PORTE, ET LA COLONNE SE TOTALISE.
 *
 * ═══ CE QUE LA LIGNE MANQUANTE N'OFFRAIT PAS ═══
 *
 * Un relevé manquant est la SEULE ligne de cet écran qui appelle un travail :
 * elle bloque la facturation du mois, et le bandeau du haut le dit en toutes
 * lettres. Elle n'offrait pourtant aucune commande — le garde est écrit, et il
 * est juste pour ce qu'il visait : « rien à corriger sans relevé, le bouton
 * mènerait à une modale qui ne saurait rien corriger ». Mais CORRIGER n'est pas
 * le seul geste : il y a SAISIR, et c'est celui-là que la ligne demande.
 *
 * On devait donc remonter en tête d'écran, rouvrir « Saisir un relevé », et y
 * rechoisir le logement qu'on venait de lire.
 *
 * ═══ ET LE TOTAL QUI MANQUAIT ═══
 *
 * Le pied totalise l'ARGENT et rien d'autre. Or ce qu'un bailleur compare à sa
 * facture, c'est la somme des mètres cubes : l'écart entre ce que le compteur
 * général a compté et ce que les logements ont consommé EST la perte. Le
 * produit n'a pas le compteur général ; il a l'autre moitié, et ne l'additionnait
 * pas.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * Que le geste ABOUTISSE : la modale s'ouvre, et ce qu'elle écrit se garde
 * ailleurs. Ce qui est tenu ici est qu'elle s'ouvre SUR LE BON LOGEMENT, ce qui
 * est exactement ce que le détour par l'en-tête faisait perdre.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const AVEC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SANS = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const AOUT = new Date(Date.UTC(2026, 7, 1)).toISOString()

function unite(id: string, label: string) {
  return {
    id,
    label,
    type: 'T2',
    surfaceSqm: 52,
    rentMinor: 90000,
    tenant: { id: `loc-${label}`, fullName: `Occupant ${label}`, phoneE164: null },
    status: 'paid',
    leaseId: `bail-${label}`,
    leaseStartsOn: '2025-09-01T00:00:00.000Z',
    paidMinor: 90000,
    overdueDays: null,
  }
}

/**
 * DEUX LOGEMENTS, ET UN SEUL RELEVÉ.
 *
 * B7 consomme 120 m³ d'eau, C1 n'a aucun index — ni courant ni identifiant,
 * comme un serveur réel le rend pour une tournée qui n'est pas passée. C'est
 * l'écart entre les deux qui porte les deux règles.
 */
async function ouvrirLesReleves() {
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
          units: [unite(AVEC, 'B7'), unite(SANS, 'C1')],
        },
      ],
      works: [],
      deposits: [],
      readings: [
        {
          unitId: AVEC,
          utility: 'water',
          id: 'r1',
          periodStart: AOUT,
          indexValue: 1120,
          previousIndex: 1000,
          readAt: AOUT,
        },
        {
          unitId: SANS,
          utility: 'water',
          id: null,
          periodStart: AOUT,
          indexValue: null,
          previousIndex: 900,
          readAt: null,
        },
      ],
      inspections: [],
      notifications: [],
    },
  })
  await renderApp('/app/releves', { session: sessionProprietaire() })
  await attendreLeChargement()
  return faux
}

/** La rangée dont l'en-tête de ligne porte ce numéro. */
function rangee(label: string): HTMLElement {
  const main = screen.getByRole('main')
  const trouvees = within(main)
    .getAllByRole('row')
    .filter((l) => (l.textContent ?? '').trimStart().startsWith(label))
  if (trouvees.length !== 1) throw new Error(`${trouvees.length} rangée(s) pour ${label}`)
  return trouvees[0]!
}

describe('la ligne sans relevé porte son geste', () => {
  it('offre de SAISIR, et non de corriger', async () => {
    await ouvrirLesReleves()
    const commandes = within(rangee('C1'))
      .queryAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')

    expect(
      commandes.length,
      'la ligne qui bloque la facturation du mois n’offre aucune commande : il faut remonter en tête d’écran et y rechoisir le logement',
    ).toBeGreaterThan(0)
    /* SAISIR ET NON MODIFIER : le mot dit le geste. « Modifier » sur une ligne
       vide promet une correction de rien, et c'est ce que le garde d'origine
       refusait à juste titre. */
    expect(
      commandes.join(' | '),
      'la ligne vide propose de « modifier » ce qui n’existe pas',
    ).toMatch(/saisir/i)
  })

  it('ouvre la saisie SUR CE LOGEMENT', async () => {
    const user = userEvent.setup()
    await ouvrirLesReleves()
    await user.click(within(rangee('C1')).getAllByRole('button')[0]!)

    const modale = await screen.findByRole('dialog')
    /*
      LE LOGEMENT PRÉ-CHOISI, et c'est tout le gain : ouvrir une modale vide
      depuis la ligne ne fait économiser que le clic du haut, pas la recherche
      du logement dans une liste de douze.
    */
    /* LE CHAMP CACHÉ du `Combobox` et non son rôle : le composant porte son
       `name` sur un `input` masqué — sa propre prose l'explique — et c'est
       cette valeur-là que le formulaire enverra. */
    const choix = modale.querySelector<HTMLInputElement>('input[name="unitId"]')
    expect(choix, 'la modale ne porte aucun choix de logement').not.toBeNull()
    expect(
      choix!.value,
      'la modale s’ouvre sur le premier logement de la liste, pas sur celui qu’on a désigné',
    ).toBe(SANS)
  })
})

describe('le pied des relevés', () => {
  it('totalise les mètres cubes, pas seulement l’argent', async () => {
    await ouvrirLesReleves()
    const main = screen.getByRole('main')
    const pied = within(main)
      .getAllByRole('row')
      .find((l) => /total/i.test(l.textContent ?? ''))
    expect(pied, 'aucune rangée de total').toBeDefined()

    /* 1 120 − 1 000 = 120 m³, et C1 n'en apporte aucun. C'est ce nombre que le
       bailleur oppose à la facture de son compteur général. */
    expect(
      pied!.textContent ?? '',
      'le pied ne somme que l’argent : la consommation du parc, celle qu’on compare à la facture, n’est additionnée nulle part',
    ).toMatch(/120/)
  })
})
