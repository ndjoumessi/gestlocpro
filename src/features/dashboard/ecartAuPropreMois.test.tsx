import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * L'ÉCRAN DIT QUEL RELEVÉ MÉRITE UN SECOND REGARD.
 *
 * ═══ CE QU'IL NE SAVAIT PAS DIRE ═══
 *
 * Dix consommations et leur filet proportionnel : de quoi comparer les
 * logements ENTRE EUX, jamais un logement à SON PROPRE PASSÉ. Or c'est là
 * qu'une fuite se voit — pas dans le fait qu'un appartement consomme plus que
 * son voisin, mais dans le fait qu'il consomme soudain le double de ce qu'il
 * consommait. Une fuite non vue coûte plus que tout ce que cet écran refacture.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 *   1. le logement qui a doublé est NOMMÉ en tête d'écran, avec sa tournée ;
 *   2. la cellule dit LEQUEL des deux fluides — une fuite d'eau et un
 *      chauffe-eau resté allumé n'envoient pas la même personne ;
 *   3. le voisin qui n'a pas doublé n'est PAS marqué. Sans ce troisième cas,
 *      une marque inconditionnelle passerait les deux premiers, et un écran qui
 *      signale tout ne signale rien.
 *
 * ═══ CE QU'IL NE VOIT PAS ═══
 *
 * La démonstration ne porte AUCUN écart — son profil saisonnier monte à 1,20 —
 * et c'est pourquoi la fixture est montée à la main ici. La note est donc
 * déclarée non mesurable à `notes-conditionnelles` : aucune porte navigateur ne
 * la peint, et c'est nommé au rapport du lot.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const FUITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SAGE = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const JUIN = { year: 2026, month: 5 }
const JUILLET = { year: 2026, month: 6 }
const iso = ({ year, month }: { year: number; month: number }) =>
  new Date(Date.UTC(year, month, 1)).toISOString()

/**
 * DEUX LOGEMENTS, LE MÊME MOIS, ET UN SEUL QUI A CHANGÉ.
 *
 * B7 consommait 10 m³ en juin et en consomme 30 en juillet — le TRIPLE. C1 passe
 * de 20 à 22, ce que n'importe quel été explique. Sans ce second logement, une
 * marque posée sur toutes les lignes rendrait le cas vert.
 *
 * L'ÉLECTRICITÉ NE BOUGE CHEZ PERSONNE, et c'est le troisième axe : la marque
 * doit se poser sur la colonne qui a doublé, pas sur la rangée.
 */
const INDEX = [
  { unitId: FUITE, utility: 'water' as const, periode: JUIN, valeur: 100 },
  { unitId: FUITE, utility: 'water' as const, periode: JUILLET, valeur: 110 },
  { unitId: FUITE, utility: 'power' as const, periode: JUIN, valeur: 1000 },
  { unitId: FUITE, utility: 'power' as const, periode: JUILLET, valeur: 1100 },
  { unitId: SAGE, utility: 'water' as const, periode: JUIN, valeur: 200 },
  { unitId: SAGE, utility: 'water' as const, periode: JUILLET, valeur: 220 },
  { unitId: SAGE, utility: 'power' as const, periode: JUIN, valeur: 2000 },
  { unitId: SAGE, utility: 'power' as const, periode: JUILLET, valeur: 2200 },
]

/** Le mois AFFICHÉ : juillet pour B7 triple son juin, août pour C1 normal. */
const AOUT = { year: 2026, month: 7 }

const HISTORIQUE = [
  ...INDEX.map((l) => ({
    unitId: l.unitId,
    utility: l.utility,
    periodStart: iso(l.periode),
    indexValue: l.valeur,
  })),
  /* AOÛT : l'eau de B7 bondit de 10 à 30 m³, celle de C1 de 20 à 22. */
  { unitId: FUITE, utility: 'water' as const, periodStart: iso(AOUT), indexValue: 140 },
  { unitId: FUITE, utility: 'power' as const, periodStart: iso(AOUT), indexValue: 1200 },
  { unitId: SAGE, utility: 'water' as const, periodStart: iso(AOUT), indexValue: 242 },
  { unitId: SAGE, utility: 'power' as const, periodStart: iso(AOUT), indexValue: 2400 },
]

const RELEVES = [
  { unitId: FUITE, utility: 'water' as const, id: 'r1', periodStart: iso(AOUT), indexValue: 140, previousIndex: 110, readAt: iso(AOUT) },
  { unitId: FUITE, utility: 'power' as const, id: 'r2', periodStart: iso(AOUT), indexValue: 1200, previousIndex: 1100, readAt: iso(AOUT) },
  { unitId: SAGE, utility: 'water' as const, id: 'r3', periodStart: iso(AOUT), indexValue: 242, previousIndex: 220, readAt: iso(AOUT) },
  { unitId: SAGE, utility: 'power' as const, id: 'r4', periodStart: iso(AOUT), indexValue: 2400, previousIndex: 2200, readAt: iso(AOUT) },
]

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

async function ouvrir() {
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
          units: [unite(FUITE, 'B7'), unite(SAGE, 'C1')],
        },
      ],
      works: [],
      deposits: [],
      readings: RELEVES,
      readingHistory: HISTORIQUE,
      inspections: [],
      notifications: [],
    },
  })
  await renderApp('/app/releves', { session: sessionProprietaire() })
  await attendreLeChargement()
}

/** La rangée du tableau qui porte ce logement. */
function rangee(label: string): HTMLElement {
  const main = screen.getByRole('main')
  /*
    LE DÉBUT DU TEXTE DE LA RANGÉE, et surtout PAS `\b` derrière le numéro.

    Première rédaction : /^\s*B7\b/. Elle ne trouvait rien, et pour une raison
    qui ne saute pas aux yeux — la rangée rend « B7Occupant B7… », et entre le
    « 7 » et le « O » il n'y a AUCUNE frontière de mot : deux caractères de mot
    se suivent. L'ancre `\b` ne vaut que devant une ponctuation ou une espace,
    qu'un tableau sans blanc entre ses cellules ne donne jamais.
  */
  const rangees = within(main)
    .getAllByRole('row')
    .filter((l) => (l.textContent ?? '').trimStart().startsWith(label))
  if (rangees.length !== 1)
    throw new Error(`${rangees.length} rangée(s) pour ${label}, une attendue`)
  const cible = rangees[0]!
  return cible
}

describe('l’écart au propre passé du logement', () => {
  it('nomme en tête d’écran le logement dont la consommation a doublé', async () => {
    await ouvrir()
    const main = screen.getByRole('main')
    const note = within(main).getByText(/au moins doublé/i)
    const bloc = note.closest('div')?.parentElement ?? note.parentElement!

    expect(
      bloc.textContent,
      'la note ne nomme pas le logement : un compte sans nom n’envoie personne nulle part',
    ).toMatch(/B7/)
    expect(
      bloc.textContent,
      'le logement dont la consommation est stable est nommé lui aussi',
    ).not.toMatch(/C1/)
  })

  it('marque la colonne qui a doublé, et pas la rangée entière', async () => {
    await ouvrir()
    const ligne = rangee('B7')
    const cellules = Array.from(ligne.children) as HTMLElement[]

    /* TROIS FOIS 10 m³ EN JUIN, 30 EN AOÛT — le multiple est 3. On le cherche
       tel qu'il s'écrit en français, séparateur compris. */
    const eau = cellules.find((c) => /×3\b/.test(c.textContent ?? ''))
    expect(eau, 'aucune cellule ne porte le multiple : la marque n’est pas rendue').toBeDefined()

    /* L'ÉLECTRICITÉ N'A PAS DOUBLÉ chez B7 — 100 kWh en juin, 100 en août. Une
       marque posée par rangée plutôt que par colonne la toucherait aussi. */
    const marques = cellules.filter((c) => /×\d/.test(c.textContent ?? ''))
    expect(marques.length, 'la marque touche les deux fluides alors qu’un seul a doublé').toBe(1)
  })

  it('ne marque pas le logement dont la consommation est stable', async () => {
    /* LA GARDE DU GARDE. Une marque inconditionnelle passerait les deux cas
       précédents ; celui-ci est le seul qui la voie. C1 passe de 20 à 22 m³ —
       une variation d'été, pas un signal. */
    await ouvrir()
    expect(
      rangee('C1').textContent ?? '',
      'un logement stable est marqué : l’écran signale tout, donc il ne signale rien',
    ).not.toMatch(/×\d/)
  })
})
