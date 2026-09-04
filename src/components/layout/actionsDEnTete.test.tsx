import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * DEUX ACTIONS SOUS LES YEUX, LE RESTE DERRIÈRE UN MENU.
 *
 * ═══ CE QUE L'AUDIT A COMPTÉ ═══
 *
 * Quatre écrans dépassent le motif « une secondaire, une primaire » :
 *
 *     paiements    4  — exporter, appeler les loyers, relancer, encaisser
 *     locataires   3  — prévenir, inviter par code, créer une fiche
 *     parc         3  — corriger le parc, ajouter un immeuble, ajouter un logement
 *     relevés      1 + 1 posée HORS de l'en-tête, sur sa propre ligne
 *
 * Ce n'est pas qu'une affaire de goût. `PageHeader` porte déjà la mesure du
 * dégât : « 812 px de boutons dans 700 px de fenêtre, scrollX=160 ». Et à 360 px
 * les quatre boutons des paiements s'empilent sur ~250 px — un tiers de la
 * hauteur utile d'un téléphone avant le premier chiffre, avec l'action
 * principale en dernier et des largeurs en dents de scie.
 *
 * ═══ POURQUOI UN MENU, ET NON UNE COUPE ═══
 *
 * Aucune des onze actions n'est de trop : elles font toutes quelque chose que
 * l'écran est le seul à offrir. Les retirer déplacerait le travail ailleurs. Ce
 * qu'il faut, c'est une HIÉRARCHIE — ce qu'on fait tous les jours reste sous les
 * yeux, ce qu'on fait parfois se demande.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 *   1. l'en-tête ne montre jamais plus de deux commandes ;
 *   2. les autres sont ATTEIGNABLES — pas retirées : le menu les rend toutes ;
 *   3. un écran à deux actions ou moins n'a PAS de menu — sans ce troisième
 *      cas, un déclencheur vide passerait, et « un bouton qui n'ouvre rien est
 *      le défaut » est déjà écrit dans la coquille.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Résidence Essos',
      district: 'Essos',
      units: [
        {
          id: 'u-1',
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
}

function serveur() {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  return faux
}

async function ouvrir(adresse: string) {
  serveur()
  await renderApp(adresse, { session: sessionProprietaire() })
  await attendreLeChargement()
}

/**
 * L'en-tête de page, désigné par son marqueur.
 *
 * Pas `getByRole('banner')` : la coquille en a déjà un. Pas un saut de parent
 * depuis le titre non plus — c'est le chemin qui casse au premier niveau
 * intermédiaire, et ce dépôt l'a déjà payé une fois.
 */
function enTete(): HTMLElement {
  const el = document.querySelector('[data-en-tete-de-page]')
  if (!el) throw new Error('aucun en-tête de page')
  return el as HTMLElement
}

/**
 * Les ACTIONS visibles de l'en-tête — le déclencheur du menu n'en est pas une.
 *
 * Trois points n'agissent pas : ils ouvrent une porte. Les compter parmi les
 * commandes ferait dire à la règle qu'un écran replié en porte toujours une de
 * trop, c'est-à-dire qu'elle ne pourrait jamais être satisfaite par le remède
 * qu'elle prescrit.
 */
function commandes(): HTMLElement[] {
  const dans = within(enTete())
  return [...dans.queryAllByRole('button'), ...dans.queryAllByRole('link')].filter(
    (el) => el.getAttribute('aria-haspopup') !== 'menu',
  )
}

/** Ouvre l'écran, déplie son menu s'il en porte un, et compte ce qu'il contient. */
async function verifierLeMenu(adresse: string) {
  await ouvrir(adresse)
  const declencheur = enTete().querySelector('[aria-haspopup="menu"]') as HTMLElement | null
  if (!declencheur) return
  await userEvent.setup().click(declencheur)
  expect(
    within(screen.getByRole('menu')).queryAllByRole('menuitem').length,
    `${adresse} : un déclencheur qui n’ouvre rien`,
  ).toBeGreaterThan(0)
}

describe('les actions d’en-tête', () => {
  for (const [nom, adresse] of [
    ['les paiements', '/app/paiements'],
    ['les locataires', '/app/locataires'],
    ['le parc', '/app/parc'],
  ] as const) {
    it(`n’en montre pas plus de deux sur ${nom}`, async () => {
      await ouvrir(adresse)
      expect(
        commandes().map((c) => c.textContent?.trim() || c.getAttribute('aria-label')),
        'plus de deux commandes sous les yeux',
      ).toHaveLength(2)
    })
  }

  it('rend les autres atteignables par le menu, sans en perdre une', async () => {
    await ouvrir('/app/paiements')
    const declencheur = enTete().querySelector('[aria-haspopup="menu"]') as HTMLElement
    expect(declencheur, 'aucun menu de débordement').not.toBeNull()
    await userEvent.setup().click(declencheur)

    /*
      LES QUATRE SONT LÀ, deux sous les yeux et deux dans le menu. On les compte
      sur l'ÉCRAN ENTIER et non dans le menu seul : ce qui compte est qu'aucune
      n'ait disparu, pas l'endroit où elle a atterri.
    */
    for (const libelle of [/exporter/i, /appeler les loyers/i, /relancer/i, /encaisser|enregistrer/i]) {
      expect(screen.getAllByText(libelle).length, String(libelle)).toBeGreaterThan(0)
    }
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('n’ouvre jamais un menu VIDE', async () => {
    /*
      GARDE DU GARDE — et ce cas disait autre chose jusqu'au 2026-09-05.

      Il exigeait : « le tableau de bord tient déjà dans deux actions », donc
      `/app` ne doit porter AUCUN déclencheur. C'était un RACCOURCI vers
      l'intention, écrite trois lignes plus haut : empêcher « un déclencheur
      vide ». Le raccourci supposait qu'un écran ne se replie que par manque de
      place en LARGEUR ; il ignorait la HAUTEUR.

      Mesuré depuis, sur la porte au navigateur à 360×640 en police large : les
      deux boutons du tableau de bord s'EMPILENT — `PageHeader` est `flex-col`
      sous 640 px — et pesaient 112 px des 171 de l'en-tête. Le premier chiffre
      tombait à 656 px pour un pli à 640 sur l'exécuteur public : un
      gestionnaire ouvrant son parc sur un téléphone ne voyait pas un chiffre.
      L'export replié rend 119 px d'en-tête et 582 px de premier chiffre.

      LE CAS TIENT DONC L'INTENTION PLUTÔT QUE SON RACCOURCI, et il est plus
      LARGE qu'avant : plus aucun écran ne peut porter un déclencheur qui
      n'ouvre rien, là où la version d'avant ne regardait que `/app`.
    */
    await verifierLeMenu('/app')
  })

  /* UN CAS PAR ÉCRAN, et non une boucle dans un seul : `renderApp` monte un
     arbre de plus sans démonter le précédent, et `enTete()` retombait alors sur
     le premier écran rendu — le cas passait au vert sur `/app` quatre fois. */
  it('n’ouvre jamais un menu VIDE sur les paiements', async () => {
    await verifierLeMenu('/app/paiements')
  })

  it('n’ouvre jamais un menu VIDE sur les locataires', async () => {
    await verifierLeMenu('/app/locataires')
  })

  it('n’ouvre jamais un menu VIDE sur le parc', async () => {
    await verifierLeMenu('/app/parc')
  })
})
