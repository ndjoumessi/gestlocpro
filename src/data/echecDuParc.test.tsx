import { describe, expect, it, vi } from 'vitest'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { renderApp, screen, userEvent } from '@/test/render'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN ÉCHEC PENDANT L'USAGE A UN ÉTAT TERMINAL, comme un échec au chargement.
 *
 * MESURÉ sur le paquet construit, application montée et session valide, avant
 * correctif — la requête du parc rendant 401 puis 500 :
 *   · un toast pendant 4,5 s, disant « Le serveur a refusé cette action. Rien
 *     n'a été enregistré. » pour une LECTURE, où rien n'était en cours
 *     d'enregistrement ;
 *   · puis plus rien. À 5 s, 7 s et 9 s : aucun toast, et l'écran affichait
 *     532 éléments — le jeu de DÉMONSTRATION — là où le parc réel, vide, en
 *     rendait 165. L'utilisateur regardait des données qui n'étaient pas les
 *     siennes, sans rien pour le lui dire et sans rien à toucher.
 *
 * CE FICHIER NE GARDE QUE ÇA : que l'échec cesse d'être transitoire, et qu'il
 * propose un geste. Il ne garde pas que l'application marche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX GARDES DU GARDE, même forme qu'aux deux lots précédents.
 *
 *  1. Si le harnais ne parvient plus à FAIRE ÉCHOUER la requête — la route
 *     renommée, le parc plus chargé, l'adhésion ignorée — les cas suivants
 *     passeraient au vert sans avoir rien cassé. Le premier cas exige donc de
 *     voir l'appel PARTIR et l'échec ARRIVER.
 *  2. Un cas SAIN asserte que l'écran normal arrive. Sans lui, un état d'erreur
 *     permanent rendrait tout le fichier vert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const PARC_VIDE = {
  collections: [], buildings: [], works: [], deposits: [],
  readings: [], inspections: [], notifications: [],
}

describe('un échec pendant l’usage a un état terminal', () => {
  it('GARDE DU GARDE nº 1 — le harnais fait bien PARTIR l’appel et ÉCHOUER la lecture', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 500 })

    await renderApp('/app', { session: SESSION })

    const appels = serveur.appels.filter((a) => a.chemin.includes('/portfolio'))
    expect(
      appels.length,
      'le parc n’est plus chargé du tout — les cas suivants ne mesurent rien',
    ).toBeGreaterThan(0)
    /* `findBy` et non `queryBy` : l'état d'échec naît d'une promesse rejetée,
       donc d'un rendu POSTÉRIEUR à celui que `renderApp` attend. Le lire tout
       de suite le déclarait absent alors qu'il arrivait au tour suivant. */
    expect(
      await screen.findByRole('heading', { name: /données indisponibles/i }),
      'la lecture ne mène plus à un état d’échec — le harnais ne casse plus rien',
    ).toBeInTheDocument()
  })

  it('GARDE DU GARDE nº 2 — un parc qui charge rend son écran, pas une erreur', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PARC_VIDE })

    await renderApp('/app', { session: SESSION })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
    expect(screen.queryByRole('heading', { name: /session a expiré/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /données indisponibles/i })).not.toBeInTheDocument()
  })

  it('un 500 en cours d’usage : état terminal, dans le CADRE, avec reprise', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 500 })

    await renderApp('/app', { session: SESSION })

    expect(await screen.findByRole('heading', { name: /données indisponibles/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
    /*
      DANS LE CADRE, ET PAS PLEIN ÉCRAN. La coquille doit survivre : c'est elle
      qui porte les commandes permettant de s'en sortir — changer de parc, se
      déconnecter, aller ailleurs. Le lot précédent a fait l'échange inverse
      pour une exception de rendu, où l'arbre était démonté et où il n'y avait
      plus de coquille à garder. Ici il y en a une.
    */
    expect(screen.getByRole('navigation', { name: /sections du produit/i })).toBeInTheDocument()
  })

  it('un 401 en cours d’usage : dit la SESSION, et ne redirige PAS', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 401 })

    await renderApp('/app', { session: SESSION })

    expect(await screen.findByRole('heading', { name: /session a expiré/i })).toBeInTheDocument()
    /*
      PAS DE REDIRECTION, et c'est l'échange central de ce lot. Mesuré avant
      correctif : un 401 en cours d'usage ne provoquait AUCUNE navigation, donc
      ne perdait rien. Rediriger automatiquement aurait CRÉÉ la perte — un
      formulaire à moitié rempli jeté sur un réseau lent coûte plus cher que
      l'écran qu'on remplace. L'utilisateur part quand il a fini.
    */
    expect(screen.getByRole('link', { name: /se reconnecter/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /content de vous revoir/i })).not.toBeInTheDocument()
  })

  it('le message d’ACTION n’est plus emprunté par une LECTURE', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 401 })

    await renderApp('/app', { session: SESSION })
    await screen.findByRole('heading', { name: /session a expiré/i })

    // « Rien n'a été enregistré » n'a aucun sens quand rien n'était en cours
    // d'enregistrement. Le toast des actions reste aux actions.
    expect(screen.queryByText(/rien n’a été enregistré/i)).not.toBeInTheDocument()
  })

  it('la reprise RELANCE une vraie lecture, et aboutit', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 500 })

    await renderApp('/app', { session: SESSION })
    await screen.findByRole('heading', { name: /données indisponibles/i })
    const avant = serveur.appels.filter((a) => a.chemin.includes('/portfolio')).length
    expect(avant).toBeGreaterThan(0)

    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PARC_VIDE })
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }))

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
    expect(serveur.appels.filter((a) => a.chemin.includes('/portfolio')).length).toBeGreaterThan(avant)
  })

  it('ne montre PLUS le jeu de démonstration à la place du parc réel', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 500 })

    await renderApp('/app', { session: SESSION })
    await screen.findByRole('heading', { name: /données indisponibles/i })

    /*
      LE DÉFAUT LE PLUS CHER DES TROIS, et le plus silencieux. Avant, l'échec
      laissait le jeu de démonstration à l'écran : 532 éléments d'un parc
      inventé, présentés comme le parc de quelqu'un. On vérifie ici qu'aucun
      immeuble de démonstration ne subsiste sous l'état d'erreur.
    */
    expect(screen.queryByText(/résidence/i)).not.toBeInTheDocument()
  })
})

// Aucun espion de console n'est posé : ce lot ne fait lever aucune exception,
// il traite des réponses HTTP. Si React se met à écrire ici, c'est un signal.
vi.setConfig({ testTimeout: 15000 })
