import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
  | { statut: 'connecte'; compte: CompteApi; adhesions: AdhesionApi[] }

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
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatSession>({ statut: 'inconnu' })
  const [horsLigne, setHorsLigne] = useState(false)

  const rafraichir = useCallback(async () => {
    try {
      const { user, memberships } = await api.me()
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
        setEtat({ statut: 'anonyme' })
        setHorsLigne(false)
        return
      }
      throw err
    }
  }, [])

  useEffect(() => {
    void rafraichir()
  }, [rafraichir])

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
      setEtat({ statut: 'anonyme' })
    }
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      etat,
      chargement: etat.statut === 'inconnu' && !horsLigne,
      horsLigne,
      connecter,
      inscrire,
      deconnecter,
      rafraichir,
    }),
    [etat, horsLigne, connecter, inscrire, deconnecter, rafraichir],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const contexte = useContext(SessionContext)
  if (!contexte) throw new Error('useSession doit être utilisé dans un <SessionProvider>')
  return contexte
}
