import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA HACHURE DIT « ENCORE OUVERT » — ELLE DOIT DONC REGARDER LA DATE.
 *
 * ═══ CE QUE LA DERNIÈRE COLONNE PROUVAIT, ET CE QU'ELLE PROUVE ═══
 *
 * `StackedBarChart` hachurait `index === bars.length - 1` et posait au-dessus
 * du graphe « Mois en cours, encore ouvert. » La trame et la phrase sont des
 * AFFIRMATIONS sur le calendrier, tirées d'une position dans un tableau.
 *
 * Elles ne coïncident que si la série va jusqu'au mois où nous sommes, et rien
 * ne le garantit : le serveur ne rend que les périodes qui PORTENT une
 * échéance, et aucune n'existe tant que l'appel des loyers n'a pas eu lieu.
 * `Park.autoRentCall` naît à `false` sur tout parc — la série d'un parc dont
 * personne n'a allumé l'automatisme s'arrête au dernier mois appelé à la main.
 *
 * Relevé sur un parc réel le 2026-10-20 : deux colonnes, août et septembre.
 * Septembre était hachuré et le graphe annonçait « Mois en cours, encore
 * ouvert » — d'un mois clos depuis vingt jours. Le lecteur en conclut que son
 * graphique est à jour et que son parc n'encaisse plus ; la vérité est qu'il
 * n'a rien appelé en octobre.
 *
 * ═══ POURQUOI LA SÉRIE SE CONSTRUIT DEPUIS L'HORLOGE DU TEST ═══
 *
 * Ces cas rendent l'écran entier, et l'écran lit `new Date()`. Des mois écrits
 * en dur seraient justes le jour où on les écrit et faux le mois suivant —
 * c'est le défaut exact que ce dépôt a déjà payé cinq fois. On décale donc
 * depuis l'horloge réelle, et les cas restent vrais à perpétuité.
 */

const PARC = '77777777-3333-4444-8888-999999999999'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

const UNITE = {
  id: 'unite-1',
  label: 'A1',
  type: 'T2',
  surfaceSqm: 100,
  rentMinor: 32798,
  tenant: { id: 'loc-1', fullName: 'Bekono Landry', phoneE164: null },
  status: 'pending',
  leaseId: 'bail-1',
  leaseStartsOn: '2026-08-18T00:00:00.000Z',
  paidMinor: 0,
  overdueDays: null,
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [{ id: 'imm-1', name: 'Residence Djoumessi', district: 'Bastos', units: [UNITE] }],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

/**
 * Le mois situé `recul` crans avant celui où nous sommes, en UTC.
 *
 * EN UTC, comme `periodStart` que le serveur estampille à minuit UTC et comme
 * l'ancre du parc de démonstration : comparer une période UTC au calendrier
 * local fabriquerait un décalage d'un mois une nuit sur trente.
 */
function moisAvant(recul: number) {
  const maintenant = new Date()
  const total = maintenant.getUTCFullYear() * 12 + maintenant.getUTCMonth() - recul
  return {
    year: Math.floor(total / 12),
    month: ((total % 12) + 12) % 12,
    rent: 32798,
    rentToDate: 32798,
    water: 0,
    power: 0,
  }
}

async function ouvrirAvec(collections: ReturnType<typeof moisAvant>[]) {
  const faux = installerFauxServeur({ authentifie: true })
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: { ...PORTEFEUILLE, collections },
  })
  await renderApp('/app', { session: sessionProprietaire() })
  await attendreLeChargement()
}

/**
 * LES COLONNES HACHURÉES, LUES AU DOM.
 *
 * `hachureOuverte` est la seule chose du produit qui pose un
 * `repeating-linear-gradient` en style INLINE — les quelques autres vivent dans
 * la feuille de styles, que jsdom n'applique pas à l'attribut `style`. La sonde
 * ne peut donc pas confondre la trame avec un autre fond.
 */
function colonnesHachurees(): number {
  return Array.from(document.querySelectorAll('[style]')).filter((e) =>
    (e.getAttribute('style') ?? '').includes('repeating-linear-gradient'),
  ).length
}

/**
 * LA NOTE DE PÉRIODE OUVERTE, ET ELLE SEULE.
 *
 * Le pied du graphe porte sa propre phrase — « … Le mois en cours est encore
 * ouvert. » — qui décrit la CONVENTION du graphique. Une sonde large sur
 * « encore ouvert » ramassait les deux et ne pouvait plus distinguer
 * l'affirmation de la description. On vise donc le libellé exact.
 */
function noteDePeriodeOuverte(): HTMLElement | null {
  return screen.queryByText('Mois en cours, encore ouvert.')
}

describe('la période ouverte du graphe des encaissements', () => {
  it('ne hachure rien quand la série s’arrête avant le mois courant', async () => {
    /* Deux mois clos, le plus récent remontant à deux crans : AUCUNE colonne ne
       court encore, et la phrase qui l'annonce n'a rien à annoncer. */
    await ouvrirAvec([moisAvant(3), moisAvant(2)])

    await screen.findByText(/encaissements sur/i)
    expect(colonnesHachurees(), 'un mois clos était peint comme un mois en cours').toBe(0)
    expect(
      noteDePeriodeOuverte(),
      'le graphe annonçait un mois en cours qu’il ne montre pas',
    ).toBeNull()
  })

  it('hachure le mois courant quand la série va jusqu’à lui', async () => {
    /* L'AUTRE SENS, et il est le cas nominal : un parc dont l'appel des loyers
       tourne porte bien le mois courant en queue de série. La trame et sa
       phrase doivent y rester — sans quoi le correctif aurait retiré au produit
       le seul signe qui distingue un mois entamé d'un mois clos. */
    await ouvrirAvec([moisAvant(1), moisAvant(0)])

    await screen.findByText(/encaissements sur/i)
    expect(colonnesHachurees(), 'le mois en cours doit se distinguer').toBeGreaterThan(0)
    expect(noteDePeriodeOuverte(), 'et la trame doit se nommer').not.toBeNull()
  })
})
