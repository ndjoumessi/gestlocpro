import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, screen, waitFor } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UNE VITRINE SANS SERVEUR NE MONTRE PAS DE FORMULAIRE DE CONNEXION.
 *
 * ═══ CE QUE LES REDIRECTIONS DU BORD NE PEUVENT PAS FAIRE ═══
 *
 * `vercel.json` renvoie `/connexion`, `/inscription` et `/app` vers l'hôte
 * applicatif. Ces règles ne s'exécutent qu'à une VRAIE requête HTTP — or React
 * Router change l'adresse sans jamais toucher le bord. Cliquer « Se connecter »
 * depuis la vitrine rendait donc le formulaire, sur un hôte où
 * `/api/auth/login` n'existe pas : un visiteur pouvait y taper son mot de passe
 * dans un champ qui n'avait personne à qui parler. Seul un rafraîchissement
 * déclenchait enfin la redirection.
 *
 * Ce n'est pas seulement inutile, c'est nuisible : un gestionnaire de mots de
 * passe qui voit un formulaire d'identification l'associe à l'ORIGINE qui
 * l'affiche, et proposerait ensuite ce mot de passe sur la vitrine.
 *
 * ═══ LE RENVOI SE FAIT DONC AUSSI DANS LE NAVIGATEUR ═══
 *
 * Quand `VITE_HOTE_APPLICATIF` est posé — il ne l'est QUE sur la vitrine —, ces
 * routes ne rendent rien et remplacent l'adresse. `replace` et non `assign` :
 * revenir en arrière ramènerait sur la page qu'on vient de quitter, en boucle.
 *
 * Sur l'hôte applicatif la variable est absente, et rien de tout ceci n'existe.
 */

const HOTE = 'https://exemple-applicatif.test'

let remplacee: string | null = null

beforeEach(() => {
  installerFauxServeur()
  remplacee = null
  vi.stubGlobal('location', {
    ...window.location,
    replace: (url: string) => {
      remplacee = url
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('la vitrine, quand un hôte applicatif est déclaré', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_HOTE_APPLICATIF', HOTE)
  })

  it('n’affiche AUCUN formulaire de connexion, et renvoie', async () => {
    await renderApp('/connexion')
    await waitFor(() => expect(remplacee).toBe(`${HOTE}/connexion`))
    expect(
      screen.queryByLabelText(/Mot de passe/),
      'un champ de mot de passe sur un hôte sans API est un piège',
    ).toBeNull()
  })

  it('emporte le chemin complet, pas seulement la racine', async () => {
    /* `/inscription/proprietaire` est le lien de la vitrine : renvoyer sur
       `/inscription` ferait recommencer le choix du rôle. */
    await renderApp('/inscription/proprietaire')
    await waitFor(() => expect(remplacee).toBe(`${HOTE}/inscription/proprietaire`))
  })

  it('renvoie aussi l’espace applicatif', async () => {
    await renderApp('/app/paiements')
    await waitFor(() => expect(remplacee).toBe(`${HOTE}/app/paiements`))
  })

  it('laisse la DÉMONSTRATION tranquille — c’est tout l’objet de la vitrine', async () => {
    await renderApp('/demo')
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
    expect(remplacee, 'la démonstration ne parle à aucun serveur').toBeNull()
  })

  it('laisse la page d’accueil tranquille', async () => {
    await renderApp('/')
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
    expect(remplacee).toBeNull()
  })
})

describe('l’hôte applicatif lui-même', () => {
  it('rend le formulaire, la variable étant absente', async () => {
    /* Le témoin de ce lot : sans la variable, RIEN ne change. C'est ce qui
       garantit que la production ne dépend pas de ce mécanisme. */
    await renderApp('/connexion')
    await waitFor(() => expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument())
    expect(remplacee).toBeNull()
  })
})
