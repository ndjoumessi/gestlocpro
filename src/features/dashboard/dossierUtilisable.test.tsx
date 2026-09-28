import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE DOSSIER DU LOGEMENT DIT CE QU'IL CACHE, ET OFFRE SES GESTES.
 *
 * ═══ TROIS DÉFAUTS, ET LE PREMIER EST LE PLUS COÛTEUX ═══
 *
 * 1. LA LISTE DES PÉRIODES COUPAIT À SIX, EN SILENCE. `periodes.slice(0, 6)`,
 *    sans compte ni suite. Un logement occupé depuis deux ans en montrait six
 *    et taisait dix-huit. Le dossier est l'écran qu'on ouvre pendant un litige :
 *    y cacher les trois quarts d'un historique sans un mot est pire qu'une
 *    absence, parce qu'on croit avoir tout lu.
 *
 * 2. LA CONSOMMATION S'ÉCRIVAIT À LA MAIN — `${courant - precedent} m³`, sans
 *    passer par le formateur. `lib/numbers` existe pour ça et le dit : « le
 *    défaut ne se voit qu'à partir de quatre chiffres : les jeux de
 *    démonstration à trois chiffres passent la relecture, et le premier relevé
 *    réel ne passe pas ».
 *
 * 3. L'ÉTAT VIDE DES TRAVAUX NE PORTAIT AUCUN GESTE, alors que `EmptyState`
 *    prend une action et que l'écran sait ouvrir un chantier depuis son menu.
 *    Une case vide qui ne dit pas quoi faire renvoie chercher le geste ailleurs.
 *
 * ═══ ET UNE QUITTANCE PAR PÉRIODE ═══
 *
 * L'écran n'en émettait qu'UNE, celle du mois courant, depuis son en-tête. La
 * question qu'on pose à un dossier est « la quittance de juin », pas « celle de
 * ce mois-ci » — et la liste des périodes est exactement l'endroit où on la
 * pose.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const BAIL = 'bail-1'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const iso = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month, day)).toISOString()

/**
 * NEUF PÉRIODES, TROIS DE PLUS QUE LA COUPE.
 *
 * Six exactement laisserait le cas vert sur le code fautif : c'est l'écart qui
 * porte la règle, pas la longueur.
 */
const PERIODES = Array.from({ length: 9 }, (_, rang) => ({
  leaseId: BAIL,
  periodStart: iso(2026, rang),
  dueOn: iso(2026, rang, 5),
  rentMinor: 90000,
  waterMinor: 5000,
  powerMinor: 4000,
  paidMinor: 99000,
  payments: [{ amountMinor: 99000, method: 'cash' as const, paidOn: iso(2026, rang, 3) }],
}))

/** Une consommation d'eau à QUATRE chiffres — le seuil où le groupement se voit. */
const INDEX_PRECEDENT = 4000
const INDEX_COURANT = 5234

function serveur() {
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
              status: 'paid',
              leaseId: BAIL,
              leaseStartsOn: iso(2025, 8),
              paidMinor: 90000,
              overdueDays: null,
            },
          ],
        },
      ],
      works: [],
      deposits: [],
      readings: [
        {
          unitId: UNITE,
          utility: 'water',
          id: 'r1',
          periodStart: iso(2026, 8),
          indexValue: INDEX_COURANT,
          previousIndex: INDEX_PRECEDENT,
          readAt: iso(2026, 8, 20),
        },
      ],
      inspections: [],
      notifications: [],
      leases: [
        {
          id: BAIL,
          unitId: UNITE,
          tenant: 'Awa Bello',
          startsOn: iso(2025, 8),
          endsOn: null,
          rentMinor: 90000,
          status: 'active',
        },
      ],
      leaseCharges: PERIODES,
    },
  })
  return faux
}

async function ouvrirLeDossier() {
  serveur()
  await renderApp(`/app/parc/${UNITE}`, { session: sessionProprietaire() })
  await attendreLeChargement()
  await screen.findByRole('heading', { level: 1, name: /Résidence Essos — B7/ })
}

/**
 * La carte portant ce titre de niveau 2.
 *
 * `data-carte` et non `closest('div')` : depuis le titre, le premier `div`
 * rencontré est l'EN-TÊTE de la carte, qui ne contient aucune de ses listes.
 * La première rédaction de ce fichier rougissait donc sur sa propre sonde —
 * « Unable to find an accessible element with the role listitem » — et non sur
 * le produit. L'attribut existe pour être interrogé ; il fait foi.
 */
function carte(titre: RegExp): HTMLElement {
  const entete = screen.getByRole('heading', { level: 2, name: titre })
  const boite = entete.closest<HTMLElement>('[data-carte]')
  if (!boite) throw new Error(`aucune carte pour ${titre}`)
  return boite
}

describe('le dossier du logement dit ce qu’il cache', () => {
  it('annonce les périodes qu’il ne montre pas, et sait les montrer', async () => {
    const user = userEvent.setup()
    await ouvrirLeDossier()
    const periodes = carte(/Périodes facturées/)

    expect(
      within(periodes).getAllByRole('listitem').length,
      'la coupe a disparu : la carte déroule tout sans qu’on le demande',
    ).toBe(6)

    /*
      UN GESTE NOMMÉ, ET NON UNE PHRASE QUELCONQUE.

      Première rédaction : « le texte de la carte contient 9 ». Elle passait sur
      le code FAUTIF — « 99 000 FCFA » porte deux 9 — et ne mesurait rien. C'est
      le même piège qu'un `/2/` satisfait par « 2026 », déjà payé une fois dans
      ce dépôt. On cherche donc une COMMANDE qui nomme le total, et on vérifie
      ce qu'elle fait.
    */
    const tout = within(periodes).getByRole('button', { name: /9/ })
    await user.click(tout)

    expect(
      within(periodes).getAllByRole('listitem').length,
      'la commande ne déplie rien : neuf périodes existent et six restent affichées',
    ).toBe(9)
  })

  it('offre la quittance de CHAQUE période, pas seulement du mois courant', async () => {
    await ouvrirLeDossier()
    const periodes = carte(/Périodes facturées/)
    const quittances = within(periodes).getAllByRole('button', { name: /quittance/i })
    expect(
      quittances.length,
      'la liste des périodes n’offre aucune quittance : on demande « celle de juin », l’écran ne sait émettre que celle du mois courant',
    ).toBe(6)
    /* NOMMÉE PAR SA PÉRIODE. Six boutons identiques ne disent pas lequel on
       active — la règle que `Meters` a écrite pour ses douze « Corriger ». */
    expect(
      quittances.map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '').join(' | '),
      'les quittances ne portent pas le mois qu’elles émettent',
    ).toMatch(/janvier|février|mars/i)
  })

  it('groupe la consommation comme tout autre nombre', async () => {
    await ouvrirLeDossier()
    const dossier = carte(/Pièces du dossier/)
    /* 5 234 − 4 000 = 1 234. Écrit à la main, il rendait « 1234 m³ ». */
    expect(
      dossier.textContent ?? '',
      'la consommation est écrite à la main : quatre chiffres collés, là où tout le reste de l’écran est groupé',
    ).toMatch(/1\s234\s*m³/)
  })

  it('offre le geste quand aucun travail n’est enregistré', async () => {
    await ouvrirLeDossier()
    const travaux = carte(/Travaux du logement/)
    expect(
      within(travaux).queryAllByRole('button').length,
      'la case vide ne dit pas quoi faire : elle renvoie chercher le geste dans le menu de l’en-tête',
    ).toBeGreaterThan(0)
  })
})
