import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'

/**
 * L'ATTENTE DE SESSION A TOUJOURS UNE FIN.
 *
 * Ce que ce fichier défend, et pourquoi il existe. `/app` restait indéfiniment
 * sur « Chargement… » quand la première lecture de session échouait : pas de
 * redirection, pas de message, pas de sortie. MESURÉ sur le paquet réel, avant
 * correctif — appel qui pend ET serveur qui rend 500 : « Chargement… » encore à
 * l'écran après 45 secondes, 0 titre, 0 élément interactif. Sur un réseau
 * mobile lent, c'est l'écran d'échec le plus probable du produit, et il
 * enfermait.
 *
 * TROIS ÉCHECS, TROIS ÉTATS TERMINAUX — c'est tout ce que ce fichier vérifie.
 * Il ne vérifie pas que l'application fonctionne, il vérifie qu'elle CESSE
 * D'ATTENDRE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA GARDE DU GARDE, et c'est le premier cas du fichier.
 *
 * « Aucune attente infinie » et « je n'ai pas réussi à déclencher l'attente »
 * s'écrivent pareil dans un journal de test : les deux passent au vert. Si un
 * remaniement change le chemin — la barrière déplacée, l'écran d'attente
 * renommé, le fournisseur qui ne monte plus — les cas suivants continueraient
 * de passer sans avoir rien observé.
 *
 * Le premier cas exige donc de VOIR l'attente. S'il ne la produit plus, il
 * rougit, et il dit que c'est le harnais qui est cassé — pas le produit qui est
 * sain. C'est exactement la panne qu'une mutation a trouvée dans la garde
 * d'exemption du lot précédent : « pas de refus » et « pas regardé » y
 * s'écrivaient pareil.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SESSION_VALIDE = {
  user: COMPTE_FICTIF,
  memberships: [{ parkId: 'parc-1', role: 'owner', parkName: 'Parc', currency: 'XAF' }],
}

/**
 * LE PARC DE CETTE SESSION, BOUCHONNÉ — et son absence était un défaut de ces
 * tests, révélé par le lot qui a rendu l'échec de lecture visible.
 *
 * Cette adhésion implique un parc, donc une lecture de `/parks/parc-1/portfolio`
 * dès que la session se résout. Aucun bouchon ne la servait : elle échouait, et
 * les deux cas qui asseyaient « vue consolidée » l'obtenaient du JEU DE
 * DÉMONSTRATION, servi silencieusement à la place du parc réel. Ils étaient
 * verts en regardant les données de personne.
 *
 * Le bouchon ne les rend pas verts : il leur rend leur sujet. Ce fichier parle
 * de l'attente de session, pas du chargement du parc — et il ne peut en parler
 * que si le parc, lui, aboutit.
 */
const PARC_VIDE = {
  collections: [], buildings: [], works: [], deposits: [],
  readings: [], inspections: [], notifications: [],
}

/** Le délai du fournisseur, en clair : `DELAI_DE_SESSION_MS` vaut 30 s. */
const DELAI_MS = 30_000

afterEach(() => {
  vi.useRealTimers()
})

describe('l’attente de session a toujours une fin', () => {
  it('GARDE DU GARDE — le harnais sait encore mettre l’écran EN ATTENTE', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    const relacher = serveur.retenir('GET', '/auth/me', { status: 200, body: SESSION_VALIDE })

    await renderApp('/app', { session: null })

    /*
      Si CETTE assertion tombe, ne corrigez pas les cas suivants : ils sont
      devenus vides. Le chemin qui mène à l'attente a changé, et tout ce fichier
      ne mesure plus rien.
    */
    expect(
      screen.queryByText(/chargement/i),
      'le harnais ne parvient plus à produire l’écran d’attente — les cas suivants ne mesurent rien',
    ).toBeInTheDocument()

    relacher()
  })

  it('un appel qui PEND finit par un état terminal, avec reprise', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    const relacher = serveur.retenir('GET', '/auth/me', { status: 200, body: SESSION_VALIDE })

    await renderApp('/app', { session: null })
    // On a bien traversé l'attente : sans cela, l'assertion finale serait vraie
    // pour la mauvaise raison.
    expect(screen.queryByText(/chargement/i)).toBeInTheDocument()

    /*
      `act` autour de l'avancée : le minuteur factice rejette la course, ce qui
      appelle `setEchec` — une mise à jour d'état React. Sans `act`, l'assertion
      qui suit lit le DOM d'avant le rendu, et le test rougit pour une raison
      qui n'est pas celle qu'il défend. Mesuré : c'est exactement ce qui est
      arrivé à la première écriture de ce cas.
    */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAI_MS + 100)
    })

    expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/impossible d’ouvrir/i)
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
    relacher()
  })

  it('un 401 renvoie à la connexion, sans attente', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/auth/me', { status: 401 })

    await renderApp('/app', { session: null })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /content de vous revoir/i,
    )
    expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument()
  })

  it('un 500 finit par un état terminal, avec reprise — sans attendre le délai', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    serveur.quand('GET', '/auth/me', { status: 500 })

    await renderApp('/app', { session: null })

    /*
      SANS DÉLAI, et c'est le cœur de ce lot. L'appel REVIENT — en quelques
      millisecondes — et l'écran restait pourtant en attente : `rafraichir`
      relançait l'erreur dans un `void`, personne ne lisait ce rejet, et l'état
      demeurait « inconnu » pour toujours. Un plafond de temps n'aurait JAMAIS
      corrigé ce cas-là : il n'y avait rien à interrompre.
    */
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /impossible d’ouvrir/i,
    )
    expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
  })

  it('l’écran d’attente porte une SORTIE dès le premier instant', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    const relacher = serveur.retenir('GET', '/auth/me', { status: 200, body: SESSION_VALIDE })

    await renderApp('/app', { session: null })

    expect(screen.queryByText(/chargement/i)).toBeInTheDocument()
    // Pas « au bout de quelques secondes » : maintenant. C'est précisément
    // pendant les premières secondes qu'on se demande si l'on est bloqué.
    expect(screen.getByRole('link', { name: /retour à l’accueil/i })).toBeInTheDocument()

    relacher()
  })

  it('un chargement LENT mais légitime n’est PAS déclaré en échec', async () => {
    /*
      LA GARDE QUI PROTÈGE LE MARCHÉ VISÉ CONTRE SON PROPRE CORRECTIF.

      Un plafond de temps posé sous le chargement légitime transforme un réseau
      lent en panne : ce serait échanger un défaut contre un pire, et le pire
      tomberait exactement sur les utilisateurs que ce produit sert.

      LE CHIFFRE VIENT D'UNE MESURE, pas d'une intuition. Chargement complet de
      `/app`, paquet réel, session valide, douze passages :
        3G lente  (400 kb/s, 400 ms, processeur ÷4) : 13 782 → 13 880 ms
        3G rapide (1,6 Mb/s, 150 ms, processeur ÷4) :  3 598 →  3 622 ms
      On simule ici 14 secondes — au-dessus du pire cas observé, sous le délai
      du fournisseur. L'écran doit aboutir, pas s'excuser.
    */
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    const relacher = serveur.retenir('GET', '/auth/me', { status: 200, body: SESSION_VALIDE })

    await renderApp('/app', { session: null })
    expect(screen.queryByText(/chargement/i)).toBeInTheDocument()

    const LENT_MAIS_LEGITIME_MS = 14_000
    expect(LENT_MAIS_LEGITIME_MS).toBeLessThan(DELAI_MS)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LENT_MAIS_LEGITIME_MS)
    })

    // Toujours en attente, et surtout PAS en échec : rien n'est encore perdu.
    expect(screen.queryByRole('heading', { name: /impossible d’ouvrir/i })).not.toBeInTheDocument()

    await act(async () => {
      relacher()
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
    expect(screen.queryByRole('heading', { name: /impossible d’ouvrir/i })).not.toBeInTheDocument()
  })

  it('la reprise RELANCE une vraie lecture, et aboutit', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/parks/parc-1/portfolio', { status: 200, body: PARC_VIDE })
    serveur.quand('GET', '/auth/me', { status: 500 })

    await renderApp('/app', { session: null })
    await screen.findByRole('heading', { level: 1 })

    const avant = serveur.appels.filter((a) => a.chemin === '/auth/me').length
    expect(avant).toBeGreaterThan(0)

    // Le serveur se remet d'aplomb, puis l'utilisateur reprend LUI-MÊME.
    serveur.quand('GET', '/auth/me', { status: 200, body: SESSION_VALIDE })
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }))

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
    // Le bouton n'est pas un décor : il a produit un appel de plus.
    expect(serveur.appels.filter((a) => a.chemin === '/auth/me').length).toBeGreaterThan(avant)
  })
})
