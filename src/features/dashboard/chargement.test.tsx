import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderApp, screen, switchRole, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Ce que l'écran montre PENDANT que le parc arrive.
 *
 * Le fournisseur part du jeu de démonstration et le remplace quand la réponse
 * du serveur arrive. Entre les deux — plusieurs secondes sur un réseau lent,
 * qui est le réseau du marché visé — le propriétaire regardait les immeubles,
 * les locataires et les impayés de la DÉMONSTRATION en croyant lire les siens.
 * Ce n'est pas un écran vide : c'est un écran faux, ce qui coûte plus cher.
 *
 * Le défaut était déjà connu de la suite, mais seulement comme une gêne à
 * contourner : `gestures.test.tsx` attend explicitement la charge du serveur
 * avant de cliquer, « sans quoi le geste porte sur le jeu de démonstration
 * encore affiché ». Personne n'avait écrit que l'utilisateur, lui, ne peut pas
 * attendre : il clique.
 *
 * Ces cas décrivent donc les deux moitiés de la règle — dire qu'on charge
 * quand on charge, et ne rien dire quand il n'y a rien à charger.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_AVEC_PARC: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/**
 * Charge du serveur, réduite à ce que ces cas observent.
 *
 * Recopiée plutôt qu'importée de `noTechnicalIds.test` : importer un fichier de
 * test RÉENREGISTRE ses cas dans celui qui l'importe — `gestures.test.tsx` en
 * exécute onze qui ne lui appartiennent pas. Un parc d'un immeuble et de deux
 * logements suffit ici, et se distingue du jeu de démonstration, qui en porte
 * trois.
 */
function portefeuille() {
  return {
    collections: [{ year: 2026, month: 7, rent: 255000, water: 9000, power: 7000 }],
    buildings: [
      {
        id: 'aaaaaaaa-2222-4333-8444-555555555555',
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: 'bbbbbbbb-2222-4333-8444-555555555555',
            label: 'A1',
            type: 'T3',
            surfaceSqm: 78,
            rentMinor: 145000,
            tenant: {
              id: 'dddddddd-2222-4333-8444-555555555555',
              fullName: 'Charles Ngassa',
              phoneE164: '+237677214408',
            },
            status: 'paid',
            paidMinor: 145000,
            overdueDays: null,
          },
          {
            id: 'cccccccc-2222-4333-8444-555555555555',
            label: 'A3',
            type: 'T2',
            surfaceSqm: 56,
            rentMinor: 115000,
            tenant: null,
            status: 'vacant',
            paidMinor: 0,
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
}

function serveurAvecParc() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: portefeuille() })
  return serveur
}

describe('tableau de bord pendant le chargement du parc', () => {
  it('ne sert pas le parc de démonstration à la place du parc réel', async () => {
    serveurAvecParc()
    renderApp('/app', { session: SESSION_AVEC_PARC })

    // « Villa Deïdo » n'appartient qu'au jeu de démonstration : le parc du
    // serveur ne porte qu'un immeuble. Le voir ici, c'est lire le parc de
    // quelqu'un d'autre.
    expect(screen.getByRole('main')).not.toHaveTextContent('Villa Deïdo')

    // Et le parc réel finit bien par s'afficher : le squelette est une attente,
    // pas une impasse.
    expect(await screen.findByText('Résidence Bonamoussadi')).toBeInTheDocument()
  })

  it('annonce le chargement sans décrire le décor aux lecteurs d’écran', async () => {
    serveurAvecParc()
    renderApp('/app', { session: SESSION_AVEC_PARC })

    const region = within(screen.getByRole('main')).getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    // La région ne dit QUE cela : une dizaine de pavés gris n'ont rien à
    // annoncer, et les énumérer noierait l'information utile.
    expect(region.textContent).toBe('Chargement…')
    expect(region.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)

    // L'annonce disparaît avec l'attente : une région qui reste occupée après
    // l'arrivée des données ment dans l'autre sens.
    await screen.findByText('Résidence Bonamoussadi')
    expect(within(screen.getByRole('main')).queryByRole('status')).toBeNull()
  })
})

describe('parc immobilier pendant le chargement', () => {
  it('ne fabrique aucune ligne de tableau, ni vraie ni fausse', async () => {
    serveurAvecParc()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })

    // Zéro : ni les douze lignes de la démonstration, ni des lignes de
    // squelette qu'un lecteur d'écran annoncerait comme des logements.
    expect(screen.queryAllByRole('row')).toHaveLength(0)
    // L'écran n'est pas vide pour autant — sans quoi l'assertion ci-dessus
    // serait satisfaite par une page blanche.
    expect(within(screen.getByRole('main')).getByRole('status')).toBeInTheDocument()

    // Puis le tableau réel : une ligne d'en-tête et deux logements.
    await screen.findByText('A3')
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })
})

/**
 * Retarde la seule réponse du portefeuille.
 *
 * Sans ce délai le cas suivant passerait POUR DE MAUVAISES RAISONS : la réponse
 * du faux serveur se résout dans les micro-tâches qu'attend déjà `user.click`,
 * donc l'attente s'ouvre et se referme avant la première assertion. Vérifié en
 * comptant les appels : un changement de langue relit bien le parc — une fois
 * avant, deux après. Le squelette clignotait ; le test ne le voyait pas.
 */
function ralentirLePortefeuille(millisecondes = 200) {
  const courant = globalThis.fetch
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    if (String(args[0]).includes('/portfolio')) {
      await new Promise((resoudre) => setTimeout(resoudre, millisecondes))
    }
    return courant(...args)
  })
}

describe('quand le parc est déjà à l’écran', () => {
  it('ne rouvre pas l’attente pour un changement de langue', async () => {
    /**
     * L'effet de charge dépend de `signalerEchec`, qui dépend du dictionnaire :
     * basculer en anglais le rejoue, et relit le parc. C'était inoffensif tant
     * que rien n'affichait l'attente ; ça ne l'est plus. Recouvrir d'un
     * squelette des données valides et déjà lues, parce que l'utilisateur a
     * changé de langue, serait une régression apportée par ce correctif — et
     * elle durerait le temps d'un aller-retour réseau, c'est-à-dire longtemps
     * sur le réseau visé.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: portefeuille() })
    ralentirLePortefeuille()

    const user = userEvent.setup()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    await screen.findByText('A3')

    await user.click(screen.getAllByRole('button', { name: /english/i })[0]!)

    // La relecture est en vol — mais elle porte sur le parc DÉJÀ affiché.
    expect(within(screen.getByRole('main')).queryByRole('status')).toBeNull()
    expect(screen.getByText('A3')).toBeInTheDocument()
  })
})

describe('sans parc serveur', () => {
  it('n’invente aucun chargement : les données locales sont déjà là', () => {
    renderApp('/app')

    // Aucune annonce d'attente…
    expect(within(screen.getByRole('main')).queryByRole('status')).toBeNull()
    // …et le contenu est à l'écran dès le premier rendu, sans `await`. Un
    // squelette ici serait un faux chargement : rien n'est en vol.
    expect(screen.getByRole('main')).toHaveTextContent('Villa Deïdo')
  })
})

describe('quand le parc ne se charge pas', () => {
  it('efface le squelette au lieu de faire attendre indéfiniment', async () => {
    // La route du portefeuille n'est pas programmée : le faux serveur rend 404.
    installerFauxServeur()
    renderApp('/app', { session: SESSION_AVEC_PARC })

    expect(within(screen.getByRole('main')).getByRole('status')).toBeInTheDocument()

    // Un squelette qui ne s'efface jamais est pire qu'une erreur : il promet
    // que quelque chose arrive.
    await waitFor(() =>
      expect(within(screen.getByRole('main')).queryByRole('status')).toBeNull(),
    )
  })
})

/**
 * Les huit autres écrans.
 *
 * Le tableau de bord et le parc étaient câblés ; les huit suivants servaient
 * encore la démonstration, chacun avec son coût propre — un impayé imputé au
 * mauvais locataire, une tournée de relevés pour des logements qu'on n'a pas,
 * un devis validé sur une dépense inventée.
 *
 * Chaque cas cherche une valeur qui n'existe QUE dans le jeu local : le parc de
 * test ne porte qu'un immeuble, deux logements et un seul locataire. Voir
 * `portefeuille()` plus haut — c'est ce contraste qui fait la preuve, et non un
 * « écran vide », qu'une page blanche satisferait aussi.
 */
const ECRANS = [
  // « Mireille Fotso » loue A2 dans la démonstration, et n'apparaît nulle part
  // dans le parc du serveur. Elle est visible telle quelle sur les quatre
  // écrans qui nomment les occupants.
  { nom: 'les paiements', route: '/app/paiements', temoin: 'Mireille Fotso' },
  { nom: 'les relevés de compteurs', route: '/app/releves', temoin: 'Mireille Fotso' },
  { nom: 'les cautions', route: '/app/cautions', temoin: 'Mireille Fotso' },
  { nom: 'les locataires', route: '/app/locataires', temoin: 'Mireille Fotso' },
  // Une référence de signalement : elle a l'air d'un dossier ouvert chez soi.
  { nom: 'les travaux', route: '/app/travaux', temoin: 'SIG-2026-042' },
  // Le locataire nommé dans la notification « loyer en retard de 24 jours ».
  { nom: 'les signalements', route: '/app/signalements', temoin: 'Serge Mbarga' },
  // A4 porte un état des lieux d'entrée dans la démonstration, pas dans le parc
  // du serveur : la carte en annonce l'occupant.
  { nom: 'les états des lieux', route: '/app/etats-des-lieux', temoin: 'Famille Owona' },
] as const

describe.each(ECRANS)('$nom pendant le chargement', ({ route, temoin }) => {
  it('ne sert pas le parc de démonstration', async () => {
    serveurAvecParc()
    /**
     * La réponse est RALENTIE, et c'est ce qui donne sa valeur au cas.
     *
     * Sans délai, le faux serveur résout dans les micro-tâches : un `await`
     * placé plus bas — ou même le simple `findBy` de la seconde moitié — suffit
     * à faire passer l'écran en données réelles, et l'assertion d'attente
     * deviendrait vraie pour la mauvaise raison. Le piège est documenté sur
     * `ralentirLePortefeuille`, il a déjà servi une fois dans ce fichier.
     */
    ralentirLePortefeuille()
    renderApp(route, { session: SESSION_AVEC_PARC })

    const main = () => screen.getByRole('main')

    expect(main()).not.toHaveTextContent(temoin)
    // L'écran n'est pas vide pour autant : il annonce l'attente, une fois.
    expect(within(main()).getByRole('status')).toBeInTheDocument()

    /**
     * On repasse APRÈS un tour de boucle d'événements, le délai n'étant pas
     * encore écoulé. C'est la technique de `attendreLeParcDuServeur()`
     * (`gestures.test.tsx`) prise à l'envers : là-bas on attend que le parc du
     * serveur ait remplacé la démonstration avant de cliquer ; ici on vérifie
     * qu'entre-temps la démonstration n'a jamais été montrée. Le contournement
     * qu'un test s'accordait devient la règle qu'on éprouve.
     */
    await new Promise((resoudre) => setTimeout(resoudre, 50))
    expect(main()).not.toHaveTextContent(temoin)
    expect(within(main()).getByRole('status')).toBeInTheDocument()

    // Puis le parc réel arrive, et l'attente se referme : le squelette est une
    // attente, pas une impasse.
    await waitFor(() => expect(within(main()).queryByRole('status')).toBeNull())
  })

  it('annonce l’attente une seule fois', async () => {
    serveurAvecParc()
    ralentirLePortefeuille()
    renderApp(route, { session: SESSION_AVEC_PARC })

    const main = screen.getByRole('main')
    // Une région, pas quinze : les pavés sont décoratifs, l'annonce est unique.
    expect(within(main).getAllByRole('status')).toHaveLength(1)
    expect(within(main).getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(within(main).getByRole('status').textContent).toBe('Chargement…')

    await waitFor(() => expect(within(main).queryByRole('status')).toBeNull())
  })
})

/**
 * Le tableau de bord du locataire.
 *
 * C'est le cas le plus coûteux des huit, et le seul où l'utilisateur n'a aucun
 * moyen de recouper : il ne connaît pas le parc, il connaît son bail. Pendant
 * l'attente, l'écran lui présentait le logement A1 de la démonstration — sa
 * surface, son loyer, sa caution de 290 000 FCFA et six quittances datées.
 *
 * Le profil se choisit dans la barre latérale et non dans la session : c'est un
 * commutateur d'affichage, `AppShell` le pose à « propriétaire » au montage.
 * D'où le détour par `switchRole`, et d'où le délai long — le clic consomme les
 * micro-tâches, donc une réponse instantanée serait déjà arrivée quand on
 * regarde. C'est exactement le piège décrit sur `ralentirLePortefeuille` :
 * vérifié en retirant le correctif, ce cas échoue alors sur la caution.
 */
describe('l’espace locataire pendant le chargement', () => {
  /**
   * Deux « rôles » cohabitent, et il faut les deux.
   *
   * Celui de la SESSION borne le périmètre — c'est lui qui décide que les
   * unités reçues du serveur sont celles du compte connecté. Celui de la barre
   * latérale ne commande que l'affichage. Ne poser que le second rendait bien
   * l'espace locataire, mais sur un périmètre vide : l'écran finissait à
   * `null`, et le cas tombait sur la mauvaise assertion.
   */
  const SESSION_LOCATAIRE: EtatSession = {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
  }

  it('ne présente pas le bail d’un autre', async () => {
    serveurAvecParc()
    ralentirLePortefeuille(800)
    renderApp('/app', { session: SESSION_LOCATAIRE })

    await switchRole('tenant')

    const main = () => screen.getByRole('main')

    /**
     * La caution de A1 dans la démonstration. Le parc de test n'en porte
     * aucune : après chargement, la carte affiche « — ».
     *
     * Une expression régulière, et l'espace y est `\s` : le formatage des
     * montants insère une espace fine insécable (U+202F) et non l'espace du
     * clavier. Écrit en littéral, le montant ne correspondait à rien et le cas
     * passait sans jamais mordre.
     */
    expect(main()).not.toHaveTextContent(/290\s*000/)
    expect(within(main()).getByRole('status')).toBeInTheDocument()

    // Le parc finit par arriver, et l'espace locataire s'affiche pour de bon.
    await waitFor(() => expect(within(main()).queryByRole('status')).toBeNull(), {
      timeout: 3000,
    })
    expect(main()).toHaveTextContent('A1')
  })
})

/**
 * L'attente SIMULÉE de la démonstration.
 *
 * Tout ce fichier décrit ce que le produit montre pendant que le parc arrive —
 * et pas une seule de ces images n'a jamais été vue à l'écran. La démonstration
 * sert un module local, donc `loading` y restait faux du premier rendu au
 * dernier ; le seul déclencheur possible était un compte relié à un parc, qui
 * n'existe toujours pas sur le déploiement. Du code livré, vérifié par des
 * tests, jamais regardé — et le débordement de `SkeletonTable` à 375px, coupé
 * en silence par `overflow-hidden`, dit ce que cet angle mort coûtait : les
 * tests tenaient le comportement, pas la géométrie.
 *
 * La démonstration ouvre donc une attente, une fois, pour la rendre observable
 * sans compte. Ce que ces cas tiennent, c'est le « une fois » : une attente qui
 * se rejouerait à chaque écran rendrait la vitrine poussive et mentirait sur le
 * produit, dont le chargement réel est un coup unique par parc — c'est ce que
 * vérifie déjà, plus haut, « ne rouvre pas l'attente pour un changement de
 * langue ».
 *
 * Le cas symétrique — un compte sans parc hors démonstration n'attend rien — est
 * tenu par « sans parc serveur » et n'est pas redit ici.
 */
describe('démonstration', () => {
  const attente = () => within(screen.getByRole('main')).queryByRole('status')

  it('ouvre une attente dès le premier rendu, puis la referme', async () => {
    renderApp('/demo/travaux', { session: { statut: 'demo' } })

    // Dès la première image, posée par `useState` et non par l'effet : sinon
    // une image complète de données passerait avant le squelette.
    expect(attente()).not.toBeNull()

    await waitFor(() => expect(attente()).toBeNull(), { timeout: 4000 })
    expect(screen.getByRole('button', { name: /valider le devis/i })).toBeInTheDocument()
  })

  it('ne la rejoue pas d’un écran à l’autre', async () => {
    const user = userEvent.setup()
    renderApp('/demo/travaux', { session: { statut: 'demo' } })
    await waitFor(() => expect(attente()).toBeNull(), { timeout: 4000 })

    const liens = screen.getAllByRole('link', { name: /^cautions/i })
    await user.click(liens[0])

    expect(attente()).toBeNull()
    expect(screen.getAllByRole('button', { name: /^arbitrer$/i }).length).toBeGreaterThan(0)
  })
})

/**
 * La vitrine des états JOUE son chargement au lieu de le figer.
 *
 * `SystemStates` rendait son squelette sans condition : il ne se terminait
 * jamais. Tant qu'il valait quatre barres grises, on lisait un échantillon ; du
 * jour où il a pris l'allure exacte d'un écran réel — rangée d'indicateurs et
 * tableau, mêmes primitives que les huit écrans —, on a lu un écran BLOQUÉ.
 * Plus la vitrine est fidèle, plus un état figé passe pour une panne, et c'est
 * la fidélité qui a rendu le défaut visible plutôt que de le créer.
 *
 * Ses trois voisines montrent chacune un état abouti, et « Erreur » porte même
 * un bouton. Celle-ci aboutit donc elle aussi, et se rejoue : la TRANSITION est
 * le seul morceau que la vitrine ne montrait pas, alors que c'est exactement ce
 * que vit l'utilisateur.
 */
describe('vitrine des états', () => {
  const attente = () => within(screen.getByRole('main')).queryByRole('status')

  it('joue l’attente puis aboutit sur du contenu réel', async () => {
    renderApp('/app/systeme')

    expect(attente()).not.toBeNull()

    // Elle se termine d'elle-même — c'est tout ce qui manquait.
    await waitFor(() => expect(attente()).toBeNull(), { timeout: 4000 })
    // Et sur le contenu que le squelette annonçait, aux mêmes places.
    expect(screen.getByRole('main')).toHaveTextContent('Bonamoussadi')
  })

  it('se rejoue à la demande', async () => {
    const user = userEvent.setup()
    renderApp('/app/systeme')
    await waitFor(() => expect(attente()).toBeNull(), { timeout: 4000 })

    await user.click(screen.getByRole('button', { name: /rejouer le chargement/i }))

    expect(attente()).not.toBeNull()
    await waitFor(() => expect(attente()).toBeNull(), { timeout: 4000 })
  })
})
