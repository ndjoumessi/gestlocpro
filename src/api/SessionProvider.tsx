import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { effacerStockage, ecrireStockage, lireStockage } from '@/lib/stockage'
import { ApiError, NetworkError, api, type AdhesionApi, type CompteApi, type DemandeInscription } from './client'

/**
 * Session du compte connecté.
 *
 * L'état d'authentification n'est **jamais** déduit d'une valeur rangée par le
 * client : il est demandé au serveur, qui lit le cookie. Un drapeau
 * `estConnecte` conservé dans `localStorage` se désynchronise du jour où la
 * session expire — l'interface se croit connectée et chaque requête rend 401,
 * sans que rien ne le dise à l'utilisateur.
 *
 * Le sélecteur de profil de la coquille applicative survit à côté de ceci, mais
 * il ne décide plus de rien : les rôles viennent de `memberships`, calculés par
 * le serveur à chaque requête.
 */

/**
 * Trois états, et non deux.
 *
 * `inconnu` est celui qu'on oublie : entre le montage et la réponse de
 * `/auth/me`, on ne sait pas. Le confondre avec « déconnecté » fait clignoter
 * l'écran de connexion à chaque rechargement d'un utilisateur pourtant
 * authentifié — et le renvoie à la connexion s'il y a une redirection.
 */
export type EtatSession =
  | { statut: 'inconnu' }
  | { statut: 'anonyme' }
  | { statut: 'demo' }
  | { statut: 'connecte'; compte: CompteApi; adhesions: AdhesionApi[] }

/**
 * Clé de la visite en démonstration, conservée le temps de l'onglet.
 *
 * `sessionStorage` et non `localStorage` : une démonstration est une visite,
 * pas une préférence. La retrouver trois jours plus tard en ouvrant le produit
 * qu'on a fini par acheter serait absurde, et masquerait ses vraies données
 * derrière un bandeau.
 *
 * Elle ne porte aucun droit — le serveur ne la voit jamais et refuserait de
 * toute façon. Elle ne décide que d'une chose : afficher le jeu de
 * démonstration au lieu de rediriger vers la connexion.
 */
const CLE_DEMO = 'gestlocpro.demo'

interface SessionContextValue {
  etat: EtatSession
  /** `true` tant que le premier `/auth/me` n'a pas répondu. */
  chargement: boolean
  /** `true` quand le serveur est injoignable — distinct de « déconnecté ». */
  horsLigne: boolean
  connecter: (email: string, motDePasse: string) => Promise<void>
  inscrire: (donnees: DemandeInscription) => Promise<void>
  deconnecter: () => Promise<void>
  rafraichir: () => Promise<void>
  /** Ouvre l'application sur le jeu de démonstration, sans compte. */
  entrerEnDemo: () => void
  /** `true` quand l'écran affiché est une démonstration et non un vrai parc. */
  estDemo: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  children,
  etatInitial,
}: {
  children: ReactNode
  /**
   * État de départ, au lieu d'interroger le serveur.
   *
   * Couture réservée aux tests, et elle est nécessaire plutôt que commode : en
   * production le premier rendu vaut forcément `inconnu`, puisque la réponse
   * n'est pas encore arrivée. Sous test, cela obligerait chacun des deux cent
   * cinquante cas à attendre la résolution d'une promesse avant de regarder
   * l'écran qu'il examine — pour une propriété qu'aucun d'eux ne teste.
   *
   * Le chemin réel n'est pas contourné pour autant : la connexion, la
   * déconnexion et la barrière d'accès passent tous par de vrais appels dans
   * `wiring.test.tsx` et `RequireAuth.test.tsx`.
   */
  etatInitial?: EtatSession
}) {
  const [etat, setEtat] = useState<EtatSession>(
    etatInitial ??
      (lireStockage('session', CLE_DEMO) === '1' ? { statut: 'demo' } : { statut: 'inconnu' }),
  )
  const [horsLigne, setHorsLigne] = useState(false)

  const entrerEnDemo = useCallback(() => {
    ecrireStockage('session', CLE_DEMO, '1')
    setEtat({ statut: 'demo' })
  }, [])

  const rafraichir = useCallback(async () => {
    try {
      const { user, memberships } = await api.me()
      // Un vrai compte l'emporte toujours sur une visite de démonstration : la
      // trace de l'onglet est effacée, sans quoi le bandeau resterait affiché
      // au-dessus des vraies données du propriétaire.
      effacerStockage('session', CLE_DEMO)
      setEtat({ statut: 'connecte', compte: user, adhesions: memberships })
      setHorsLigne(false)
    } catch (err) {
      if (err instanceof NetworkError) {
        /**
         * Serveur injoignable : on ne bascule PAS en « anonyme ».
         *
         * Le faire déconnecterait visuellement quelqu'un dont la session est
         * parfaitement valide, pour une coupure de deux secondes — et lui ferait
         * ressaisir son mot de passe sans raison.
         */
        setHorsLigne(true)
        return
      }
      if (err instanceof ApiError && err.status === 401) {
        /**
         * 401 est la réponse ATTENDUE pendant une démonstration : le visiteur
         * n'a pas de compte, c'est tout le principe. Basculer en « anonyme »
         * le renverrait à la connexion au premier rechargement, en plein
         * milieu de la visite qu'on lui a promise.
         */
        const enDemo = lireStockage('session', CLE_DEMO) === '1'
        setEtat(enDemo ? { statut: 'demo' } : { statut: 'anonyme' })
        setHorsLigne(false)
        return
      }
      throw err
    }
  }, [])

  useEffect(() => {
    // Un état fourni est déjà résolu : réinterroger le serveur l'écraserait
    // aussitôt, et la couture ne servirait à rien.
    if (etatInitial) return
    void rafraichir()
  }, [etatInitial, rafraichir])

  const connecter = useCallback(
    async (email: string, motDePasse: string) => {
      await api.login(email, motDePasse)
      // On relit la session plutôt que de se fier au corps de la réponse : les
      // adhésions n'y sont pas, et deux chemins d'hydratation divergeraient.
      await rafraichir()
    },
    [rafraichir],
  )

  const inscrire = useCallback(
    async (donnees: DemandeInscription) => {
      await api.signup(donnees)
      await rafraichir()
    },
    [rafraichir],
  )

  const deconnecter = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      // Même si l'appel échoue, l'interface repasse en anonyme : refuser de
      // déconnecter quelqu'un parce que le réseau a lâché est le mauvais sens
      // de l'erreur.
      effacerStockage('session', CLE_DEMO)
      setEtat({ statut: 'anonyme' })
    }
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      etat,
      // Une démonstration est un état RÉSOLU : il n'y a plus rien à attendre du
      // serveur. La compter comme un chargement laisserait tourner l'attente
      // indéfiniment.
      chargement: etat.statut === 'inconnu' && !horsLigne,
      horsLigne,
      connecter,
      inscrire,
      deconnecter,
      rafraichir,
      entrerEnDemo,
      estDemo: etat.statut === 'demo',
    }),
    [etat, horsLigne, connecter, inscrire, deconnecter, rafraichir, entrerEnDemo],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const contexte = useContext(SessionContext)
  if (!contexte) throw new Error('useSession doit être utilisé dans un <SessionProvider>')
  return contexte
}
