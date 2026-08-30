import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN SQUELETTE SE MESURE, ET C'EST NOUVEAU.
 *
 * ═══ CE QUE `squelettesFideles.test.ts` TENAIT POUR IMPOSSIBLE ═══
 *
 * Son en-tête dit, et c'était vrai quand il a été écrit : « aucune porte du
 * dépôt ne rend jamais un état de chargement — la démonstration n'attend pas,
 * la vitrine n'a pas de squelette d'écran, et la mesure au navigateur mesure la
 * page CHARGÉE ». Il en tire sa forme : une garde de SOURCE, qui compare des
 * littéraux et ne peut donc exiger qu'une chose, que les deux rangées lisent le
 * même nom.
 *
 * Cette phrase a cessé d'être vraie. `retenir` tient une réponse ouverte aussi
 * longtemps qu'on veut — le harnais l'a écrit pour observer une fenêtre de
 * chargement, et `promessesTenues.test.ts` s'en sert déjà. L'attente est donc
 * un état RENDU comme un autre : on peut la compter.
 *
 * ═══ CE QUE LA GARDE DE SOURCE NE POUVAIT PAS VOIR ═══
 *
 * L'espace documents lisait bien `GRILLE_DEUX_COLONNES` des deux côtés — la
 * règle des littéraux passait au vert. Il rendait pourtant DEUX grilles
 * chargées, quatre cartes, et n'en annonçait qu'UNE, deux cartes. La seconde
 * grille était écrite à la main, `'mt-4 grid gap-4 lg:grid-cols-2'`, à côté de
 * la constante déclarée trente lignes plus haut pour exactement cela : une
 * chaîne de plus, que la règle du même nom ne pouvait pas rapprocher puisqu'elle
 * ne portait pas le même préfixe.
 *
 * Le résultat à l'écran est celui que tout ce travail cherche à empêcher : la
 * page DOUBLE de hauteur à la seconde où elle cesse d'attendre. Le doigt tombe
 * à côté de ce qu'il visait, et ce qu'il visait était « Tout télécharger ».
 *
 * ═══ POURQUOI CE CAS NE BALAIE PAS TOUS LES ÉCRANS ═══
 *
 * Le compte de cartes chargées n'est FIXE que là où la page en dessine un nombre
 * décidé d'avance. Ailleurs — parc, encaissements, travaux — il vient des
 * données, et une règle qui exigerait l'égalité partout serait fausse partout :
 * un squelette ne peut pas savoir combien d'immeubles le serveur va rendre.
 *
 * L'espace documents en dessine quatre, toujours les mêmes, quel que soit le
 * dossier : les pièces contractuelles, les quittances, la demande, la
 * confidentialité. Le compte est donc une propriété de l'écran et non de la
 * réponse, et c'est ce qui rend la comparaison légitime ici et nulle part au
 * hasard. Voir `ECRANS`, plus bas, pour le second.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function sessionLocataire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
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
          id: UNITE,
          label: 'B7',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          tenant: { id: COMPTE_FICTIF.id, fullName: COMPTE_FICTIF.fullName, phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
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
}

/* Assemblé par fragments : Tailwind lit les fichiers de test comme des sources
   et fabriquerait pour de bon toute classe citée ici en clair. */
const DEUX_COLONNES = 'lg:grid-' + 'cols-2'

/** Les cartes de la zone principale, marquées par la primitive elle-même. */
function cartes(): number {
  return screen.getByRole('main').querySelectorAll('[data-carte]').length
}

/** Les conteneurs qui ouvrent la grille à deux colonnes. */
function grilles(): number {
  return screen.getByRole('main').querySelectorAll(`[class*="${DEUX_COLONNES}"]`).length
}

/**
 * Les écrans dont le nombre de cartes est une propriété de l'ÉCRAN.
 *
 * L'espace locataire en dessine trois sous sa rangée d'indicateurs — les
 * quittances, les travaux, le gestionnaire — et l'espace documents quatre. Ni
 * l'un ni l'autre ne dépend de ce que le serveur rend : seuls les CONTENUS en
 * dépendent. Partout ailleurs le compte vient des données, et la comparaison
 * n'aurait aucun sens.
 *
 * L'espace locataire n'était pas comparable avant ce lot : son attente
 * redessinait ses trois cartes à la main, sans le marqueur. Voir
 * `carteNonRecopiee.test.ts`.
 */
const ECRANS = [
  { nom: 'espace documents', adresse: '/app/documents' },
  { nom: 'espace locataire', adresse: '/app/mon-espace' },
]

describe.each(ECRANS)('l’attente de l’$nom', ({ adresse }) => {
  it('annonce la page qui va venir, et non la moitié', async () => {
    const faux = installerFauxServeur()
    const relacher = faux.retenir('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: PORTEFEUILLE,
    })
    await renderApp(adresse, { session: sessionLocataire() })

    /* GARDE DE LA GARDE. Une réponse déjà arrivée rendrait la page chargée des
       deux côtés, l'égalité serait vraie et n'aurait rien mesuré. La région
       d'attente est la preuve que le premier relevé est bien celui du
       squelette. */
    expect(screen.getByRole('main').querySelector('[aria-busy="true"]')).not.toBeNull()

    const cartesAnnoncees = cartes()
    const grillesAnnoncees = grilles()

    /* GARDE DE LA GARDE, SECOND VERROU : une égalité entre deux zéros est vraie
       et ne mesure rien. Un squelette qui cesserait d'appeler `Card` — le défaut
       que `carteNonRecopiee.test.ts` poursuit — rendrait exactement ce cas. */
    expect(cartesAnnoncees, 'aucune carte marquée dans l’attente').toBeGreaterThan(0)

    relacher()
    await attendreLeChargement()

    expect(cartesAnnoncees, 'le squelette annonce un autre nombre de cartes').toBe(cartes())
    expect(grillesAnnoncees, 'le squelette n’ouvre pas les mêmes grilles').toBe(grilles())
  })
})
