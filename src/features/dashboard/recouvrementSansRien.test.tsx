import { describe, expect, it } from 'vitest'
import { renderApp, screen, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA CARTE « RECOUVREMENT DU MOIS » MONTRAIT DEUX FOIS RIEN, EN CHIFFRES.
 *
 * ═══ DEUX ZÉROS INDÉPENDANTS, ET DEUX DÉNOMINATEURS ABSENTS ═══
 *
 * 1. L'ANNEAU. `DonutChart` divise chaque part par le total ; total nul, toutes
 *    les fractions valent zéro et le cercle se peint VIDE — un anneau de 128 px
 *    qui ne porte aucune bande, avec « 0 % · encaissé » en son centre. Sur un
 *    parc sans bail actif, c'est ce que la carte offrait : un graphique qui a
 *    l'air cassé, là où il n'y a simplement rien à recouvrer. Le dépôt a déjà
 *    énoncé la règle pour le graphe voisin, mot pour mot : « un cadre d'axes sans
 *    barre n'est pas un graphique : c'est un graphique qui a l'air cassé ».
 *
 * 2. LES DEUX BARRES DE REFACTURATION. `waterRebilled` est la part des relevés
 *    dont l'eau est saisie, SUR LES RELEVÉS — avec zéro relevé, `computeKpis`
 *    rend 0 pour ne pas diviser par zéro, et la carte écrit « Eau 0 % ».
 *    Zéro pour cent se lit « rien n'a été refacturé », alors que la vérité est
 *    « aucun relevé n'a encore été pris ». Ce n'est pas le même fait, et ce n'est
 *    pas le même travail à faire.
 *
 * LES DEUX CONDITIONS SONT DISTINCTES, et c'est ce que ce fichier tient : un parc
 * peut avoir des baux actifs sans aucun relevé — le cas de tout début de mois —
 * et l'inverse ne se produit pas. Une seule garde pour les deux aurait effacé les
 * barres sur un parc qui recouvre très bien.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const IMMEUBLE = {
  id: 'aaaaaaaa-2222-4333-8444-555555555555',
  name: 'Résidence Bonamoussadi',
  district: 'Bonamoussadi',
}

const LOGEMENT_VACANT = {
  id: 'bbbbbbbb-2222-4333-8444-555555555555',
  label: 'A1',
  type: 'T3',
  surfaceSqm: 78,
  rentMinor: 145000,
  tenant: null,
  status: 'vacant',
  paidMinor: 0,
  overdueDays: null,
}

const LOGEMENT_LOUE = {
  ...LOGEMENT_VACANT,
  tenant: {
    id: 'dddddddd-2222-4333-8444-555555555555',
    fullName: 'Charles Ngassa',
    phoneE164: '+237677214408',
  },
  status: 'partial',
  paidMinor: 100000,
  overdueDays: null,
}

const RELEVE = {
  id: 'eeeeeeee-2222-4333-8444-555555555555',
  unitId: LOGEMENT_VACANT.id,
  year: 2026,
  month: 9,
  waterPrevious: 100,
  waterCurrent: 117,
  powerPrevious: 800,
  powerCurrent: 992,
}

/** Un parc servi tel quel, avec ou sans bail, avec ou sans relevé. */
function parc({ loue, releves }: { loue: boolean; releves: boolean }) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [{ ...IMMEUBLE, units: [loue ? LOGEMENT_LOUE : LOGEMENT_VACANT] }],
      works: [],
      deposits: [],
      readings: releves ? [RELEVE] : [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

/** La carte du recouvrement, par son titre — pas par sa place dans la grille. */
async function carteDuRecouvrement() {
  const titre = await screen.findByRole('heading', { name: /recouvrement du mois/i })
  const carte = titre.closest('[data-carte]')
  if (!carte) throw new Error('le titre du recouvrement n’est pas dans une carte')
  return carte as HTMLElement
}

describe('le recouvrement d’un mois sans rien à recouvrer', () => {
  it('ne peint pas un anneau vide', async () => {
    parc({ loue: false, releves: false })
    await renderApp('/app', { session: SESSION })
    const carte = await carteDuRecouvrement()

    /* `data-jauge` MARQUE CHAQUE PART de l'anneau — c'est l'attribut par lequel
       `couleur-non-seule` les retrouve et les compte. Aucune part : aucun anneau.
       On interroge le marqueur et non un `<svg>`, pour la même raison que la
       porte : une forme peut changer, un marqueur dit ce que la chose EST. */
    expect(
      carte.querySelectorAll('[data-jauge]').length,
      'l’anneau se peint encore, vide, sur un parc sans bail',
    ).toBe(0)
  })

  it('dit à la place qu’il n’y a rien à recouvrer', async () => {
    parc({ loue: false, releves: false })
    await renderApp('/app', { session: SESSION })
    const carte = await carteDuRecouvrement()

    /* UN CERCLE VIDE NE DIT PAS « RIEN À RECOUVRER », il dit « en panne ». La
       phrase distingue les deux, et c'est la seule chose qu'un anneau à zéro ne
       saura jamais faire. */
    expect(carte.textContent, 'la carte laisse le vide s’expliquer tout seul').toMatch(
      /rien à recouvrer/i,
    )
  })

  it('garde l’anneau dès qu’un bail est actif', async () => {
    /* LE CONTREPOIDS, et il vaut le cas : une garde trop large effacerait
       l'anneau sur un parc qui recouvre. Un seul logement loué, partiellement
       réglé — donc les trois parts existent. */
    parc({ loue: true, releves: false })
    await renderApp('/app', { session: SESSION })
    const carte = await carteDuRecouvrement()

    expect(
      carte.querySelectorAll('[data-jauge]').length,
      'l’anneau a disparu d’un parc qui a un bail actif',
    ).toBeGreaterThan(0)
    expect(carte.textContent).not.toMatch(/rien à recouvrer/i)
  })

  it('ne rapporte pas la refacturation à un relevé qui n’existe pas', async () => {
    /* UN BAIL ACTIF ET AUCUN RELEVÉ : le cas de tout début de mois, et la preuve
       que les deux gardes sont DISTINCTES. L'anneau doit rester, les barres
       doivent partir. */
    parc({ loue: true, releves: false })
    await renderApp('/app', { session: SESSION })
    const carte = await carteDuRecouvrement()

    expect(
      within(carte).queryAllByRole('progressbar').length,
      'les barres rapportent encore une part à zéro relevé',
    ).toBe(0)
    expect(carte.textContent, 'rien ne dit qu’aucun relevé n’a été pris').toMatch(
      /aucun relevé/i,
    )
  })

  it('garde les barres dès qu’un relevé est pris', async () => {
    parc({ loue: true, releves: true })
    await renderApp('/app', { session: SESSION })
    const carte = await carteDuRecouvrement()

    expect(
      within(carte).queryAllByRole('progressbar').length,
      'les barres ont disparu alors qu’un relevé existe',
    ).toBe(2)
  })
})
