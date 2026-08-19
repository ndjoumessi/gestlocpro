import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La consommation du locataire sur douze mois.
 *
 * Son espace ne montrait qu'un chiffre — « 16 m³ » — alors que sa seule vraie
 * question, quand sa facture double, est de savoir à quoi le comparer : est-ce
 * moi, une fuite, ou le mois d'août ? Le serveur lisait DÉJÀ toutes les
 * périodes et n'en projetait que deux points avant de jeter le reste.
 *
 * Ces cas portent sur la DÉRIVATION — la consommation se déduit de deux index
 * successifs — parce que c'est là que tout se joue et que le jeu de
 * démonstration, régulier et complet, ne révèle aucun de ses pièges.
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

interface RelevéApi {
  unitId: string
  utility: 'water' | 'power'
  periodStart: string
  indexValue: number
}

/** Les douze périodes du jeu, de septembre 2025 à août 2026. */
const PERIODES = [
  { year: 2025, month: 8 },
  { year: 2025, month: 9 },
  { year: 2025, month: 10 },
  { year: 2025, month: 11 },
  { year: 2026, month: 0 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
  { year: 2026, month: 4 },
  { year: 2026, month: 5 },
  { year: 2026, month: 6 },
  { year: 2026, month: 7 },
] as const

/** Minuit UTC, comme le serveur sérialise une colonne `date`. */
const iso = ({ year, month }: { year: number; month: number }) =>
  new Date(Date.UTC(year, month, 1)).toISOString()

/**
 * Une série d'index, période par période. `null` = période NON RELEVÉE, la
 * ligne n'est simplement pas envoyée.
 */
function serie(utility: 'water' | 'power', index: (number | null)[]): RelevéApi[] {
  return index.flatMap((valeur, i) =>
    valeur === null
      ? []
      : [{ unitId: UNITE, utility, periodStart: iso(PERIODES[i]!), indexValue: valeur }],
  )
}

/**
 * L'eau est relevée TOUS les mois ; l'électricité saute février 2026.
 *
 * Deux profils différents dans le même jeu : le trou d'un fluide ne doit pas
 * effacer l'autre, et la barre de mars ne doit pas absorber celle de février.
 * Consommation d'eau d'août : 250 − 234 = 16 m³.
 */
const EAU = [100, 112, 125, 141, 158, 172, 184, 195, 205, 218, 234, 250]
const ELEC = [1000, 1150, 1290, 1450, 1620, null, 1930, 2080, 2210, 2330, 2470, 2620]

const HISTORIQUE: RelevéApi[] = [...serie('water', EAU), ...serie('power', ELEC)]

function serveurAvecReleves(readingHistory: RelevéApi[] | null) {
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
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2025-09-01T00:00:00.000Z',
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
      // `null` : le champ est ABSENT de la réponse, comme le rendrait un
      // serveur antérieur. Passer `undefined` déclencherait la valeur par
      // défaut du paramètre et le cas passerait pour la mauvaise raison.
      ...(readingHistory === null ? {} : { readingHistory }),
    },
  })
  return serveur
}

async function ouvrir(readingHistory: RelevéApi[] | null) {
  serveurAvecReleves(readingHistory)
  renderApp('/app/mon-espace', { session: sessionLocataire() })
  await attendreLeChargement()
}

/** Le repli accessible du graphe d'un fluide : une ligne par période. */
const serieDe = (libelle: string) =>
  screen.getByRole('table', { name: new RegExp(`^${libelle} —`) })

describe('consommation sur douze mois', () => {
  it('trace un mois par période, du plus ancien au plus récent', async () => {
    await ouvrir(HISTORIQUE)
    const lignes = within(serieDe('Eau')).getAllByRole('rowheader')
    expect(lignes).toHaveLength(12)
    // L'ordre EST le contrat : c'est celui des barres, de gauche à droite.
    expect(lignes[0]!.textContent).toMatch(/sept/i)
    expect(lignes[11]!.textContent).toMatch(/août/i)
  })

  /**
   * Ce qu'on montre est la CONSOMMATION, jamais l'index.
   *
   * Le compteur d'août porte 250 ; le locataire n'a pas consommé 250 m³ ce
   * mois-là, il en a consommé 16. Afficher l'index brut donnerait une courbe
   * qui monte toujours, où aucune anomalie ne se voit.
   */
  it('montre la consommation, et non l’index du compteur', async () => {
    await ouvrir(HISTORIQUE)
    const serie = serieDe('Eau')
    expect(serie).toHaveTextContent('16 m³')
    expect(serie).not.toHaveTextContent('250 m³')
  })

  /**
   * Le PREMIER mois n'a pas d'antérieur : sa consommation ne se dérive pas.
   *
   * Ni l'index (100), qui serait un mensonge, ni zéro, qui se lirait comme une
   * absence à domicile.
   */
  it('n’invente pas la consommation du premier mois', async () => {
    await ouvrir(HISTORIQUE)
    const septembre = within(serieDe('Eau')).getAllByRole('row')[0]!
    expect(septembre).toHaveTextContent('Relevé manquant')
    expect(septembre).not.toHaveTextContent('100')
    expect(septembre).not.toHaveTextContent('0 m³')
  })

  /**
   * Un trou de FLUIDE ne se comble pas avec le mois d'après.
   *
   * L'électricité n'est pas relevée en février : ni février — pas d'index — ni
   * mars — pas d'antérieur — n'ont de consommation dérivable. Reporter les deux
   * mois sur mars donnerait 310 kWh et ferait passer un mois ordinaire pour une
   * anomalie.
   */
  it('laisse sans consommation le mois qui suit un trou', async () => {
    await ouvrir(HISTORIQUE)
    const lignes = within(serieDe('Électricité')).getAllByRole('row')
    const mars = lignes.find((l) => /mars/i.test(l.textContent ?? ''))!
    expect(mars).toHaveTextContent('Relevé manquant')
    expect(mars).not.toHaveTextContent('310')
  })

  /**
   * Le mois précédent DU CALENDRIER, et non le point précédent de la liste.
   *
   * Ici février manque pour les DEUX fluides : la liste des périodes n'en
   * compte que onze, et janvier devient le voisin de mars dans le tableau.
   * S'appuyer sur l'ordre de la liste ferait 26 m³ sur la barre de mars.
   */
  it('ne reporte pas deux mois sur une seule barre', async () => {
    const sansFevrier = [
      ...serie('water', EAU.map((v, i) => (i === 5 ? null : v))),
      ...serie('power', ELEC.map((v, i) => (i === 5 ? null : v))),
    ]
    await ouvrir(sansFevrier)
    const serieEau = serieDe('Eau')
    expect(within(serieEau).getAllByRole('rowheader')).toHaveLength(11)
    const mars = within(serieEau)
      .getAllByRole('row')
      .find((l) => /mars/i.test(l.textContent ?? ''))!
    expect(mars).toHaveTextContent('Relevé manquant')
    expect(mars).not.toHaveTextContent('26')
  })

  /**
   * La moyenne ne compte QUE les mois relevés.
   *
   * L'électricité a dix mois dérivables totalisant 1 460 kWh, soit 146 de
   * moyenne. Traiter les mois inconnus comme des zéros diviserait par douze et
   * donnerait 119 — un chiffre qui ferait paraître anormal chaque mois normal.
   */
  it('moyenne sur les seuls mois relevés', async () => {
    await ouvrir(HISTORIQUE)
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('moy. 146 kWh')
    expect(main).not.toHaveTextContent('moy. 119 kWh')
  })

  /**
   * DEUX séries, chacune dans son unité — jamais une pile.
   *
   * 16 m³ et 150 kWh ne s'additionnent pas, et un empilement ferait paraître
   * haute la barre d'un locataire économe en eau au seul motif qu'il a chaud.
   */
  it('sépare les deux fluides, chacun dans son unité', async () => {
    await ouvrir(HISTORIQUE)
    expect(serieDe('Eau')).toHaveTextContent('16 m³')
    expect(serieDe('Électricité')).toHaveTextContent('150 kWh')
    // Et les francs ne s'invitent pas sur des mètres cubes.
    expect(serieDe('Eau')).not.toHaveTextContent('FCFA')
  })

  /**
   * Un index qui RECULE n'est pas une consommation négative.
   *
   * Compteur remplacé, reprise de saisie, faute de frappe : on ne sait pas. La
   * barre partirait sous l'axe et le locataire lirait un chiffre qui n'existe
   * pas.
   */
  it('ne rend pas une consommation négative', async () => {
    const aoutQuiRecule = [
      ...serie('water', EAU.map((v, i) => (i === 11 ? 200 : v))),
      ...serie('power', ELEC),
    ]
    await ouvrir(aoutQuiRecule)
    const aout = within(serieDe('Eau'))
      .getAllByRole('row')
      .find((l) => /août/i.test(l.textContent ?? ''))!
    expect(aout).toHaveTextContent('Relevé manquant')
    expect(aout).not.toHaveTextContent('-34')
  })

  /**
   * Sans historique servi, aucune série — et rien qui l'annonce.
   *
   * Un parc dont aucun relevé n'est enregistré n'a pas de série à montrer ;
   * un titre suivi de deux cadres vides se lirait comme une panne.
   */
  it('n’affiche aucune série quand le serveur n’en rend pas', async () => {
    await ouvrir(null)
    expect(screen.getByRole('main')).not.toHaveTextContent('Ma consommation sur douze mois')
  })

  /**
   * Une seule période n'est pas une série : elle ne porte aucune consommation
   * dérivable, et répéterait la carte du mois juste au-dessus.
   */
  it('n’affiche rien sur une période unique', async () => {
    await ouvrir(serie('water', [100]))
    expect(screen.getByRole('main')).not.toHaveTextContent('Ma consommation sur douze mois')
  })
})
