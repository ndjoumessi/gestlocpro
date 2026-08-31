import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/**
 * LE DÉLAI DE LA PREMIÈRE LECTURE DE SESSION, et il est MESURÉ, pas choisi.
 *
 * `fetch` n'a aucun délai par défaut : un appel qui pend pend jusqu'à ce que le
 * système d'exploitation abandonne, ce qui se compte en minutes. Sans ce
 * plafond, l'écran d'attente n'a pas de fin — mesuré : « Chargement… » toujours
 * à l'écran après 45 secondes, sans titre ni sortie.
 *
 * POURQUOI TRENTE SECONDES ET PAS DIX. C'est ici que ce lot pouvait se
 * retourner contre le marché qu'il sert. Le chargement LÉGITIME de `/app` a été
 * chronométré sur douze passages, paquet réel, bouchon de session valide, sous
 * bridage réseau et processeur :
 *
 *   3G lente  (400 kb/s, 400 ms de latence, processeur ÷4) : 13 782 → 13 880 ms
 *   3G rapide (1,6 Mb/s, 150 ms, processeur ÷4)            :  3 598 →  3 622 ms
 *
 * Un délai de dix secondes aurait donc déclaré EN PANNE tout utilisateur de 3G
 * lente — c'est-à-dire le marché visé — en échangeant un défaut contre un pire.
 * Trente secondes vaut 2,16× le maximum observé sur le profil le plus lent. La
 * marge n'est pas du confort : l'émulation est propre, sans perte de paquet ni
 * contention, et un réseau réel ajoute une variance que ce banc ne reproduit
 * pas.
 *
 * CE N'EST PAS UN BUDGET D'ATTENTE POUR L'UTILISATEUR. Il n'attend pas trente
 * secondes devant un écran muet : l'écran d'attente porte une sortie dès le
 * premier instant. Ce plafond n'existe que pour l'appel qui ne revient JAMAIS.
 */
const DELAI_DE_SESSION_MS = 30_000

/** Le dépassement, distinct d'une erreur du serveur : le geste proposé diffère. */
class DelaiDepasse extends Error {}

/**
 * Les deux façons dont la première lecture peut échouer SANS être un refus.
 *
 * `technique` : le serveur a répondu autre chose qu'un 401 — un 500, un corps
 * illisible. Réessayer a du sens, l'incident est peut-être passager.
 * `delai`     : rien n'est revenu à temps. Même geste, autre phrase : dire
 * « le serveur a rencontré une erreur » quand il n'a rien dit du tout serait
 * inventer une cause.
 */
export type EchecDeSession = 'technique' | 'delai'

interface SessionContextValue {
  etat: EtatSession
  /** `true` tant que le premier `/auth/me` n'a pas répondu. */
  chargement: boolean
  /** `true` quand le serveur est injoignable — distinct de « déconnecté ». */
  horsLigne: boolean
  /**
   * L'échec TERMINAL de la première lecture, ou `null`.
   *
   * Distinct de `horsLigne`, qui dit « le serveur n'a pas répondu du tout » et
   * laisse la session peut-être valable. Ici le serveur a répondu de travers,
   * ou n'a pas répondu à temps : dans les deux cas l'attente est FINIE, et
   * l'écran doit proposer un geste.
   */
  echecDeSession: EchecDeSession | null
  /** Relance la première lecture. Déclenchée par l'utilisateur, jamais en boucle. */
  reprendreLaSession: () => void
  /** `persistante` : « rester connecté sur cet appareil », tel que l'écran l'a demandé. */
  connecter: (email: string, motDePasse: string, persistante: boolean) => Promise<void>
  inscrire: (donnees: DemandeInscription) => Promise<void>
  deconnecter: () => Promise<void>
  rafraichir: () => Promise<void>
  /** Ouvre l'application sur le jeu de démonstration, sans compte. */
  entrerEnDemo: () => void
  /** `true` quand l'écran affiché est une démonstration et non un vrai parc. */
  estDemo: boolean
  /**
   * `true` une fois que `/auth/me` a répondu.
   *
   * On n'affirme jamais une ABSENCE — « aucun parc » — sur un état qu'on n'a
   * pas reçu du serveur. Voir le commentaire de `resolue` dans le fournisseur.
   */
  sessionResolue: boolean
  /**
   * Le parc REGARDÉ, quand le compte en détient plusieurs.
   *
   * Sept endroits lisaient `adhesions[0]` en dur : la coquille, le fournisseur
   * de données, la quittance, l'invitation. Un compte multi-parcs n'avait donc
   * aucun moyen de choisir lequel il regarde — il voyait le premier, toujours,
   * et les six autres écrans lisaient le même sans que rien ne le dise.
   *
   * `null` tant que la session n'est pas résolue ou qu'aucune adhésion n'existe.
   */
  adhesionActive: AdhesionApi | null
  /** Change de parc. Sans effet si l'identifiant n'est pas une adhésion du compte. */
  choisirParc: (parkId: string) => void
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
  const [echec, setEchec] = useState<EchecDeSession | null>(null)
  /**
   * Le numéro de la tentative en cours.
   *
   * Une lecture qui a dépassé son délai peut TOUJOURS revenir : la requête n'est
   * pas interrompue, elle a seulement perdu la course. Sans ce compteur, sa
   * réponse tardive écrirait l'état pendant que l'utilisateur tend le doigt vers
   * « Réessayer », et l'écran changerait sous sa main. Une tentative dépassée
   * est terminée : seule une reprise EXPLICITE peut aboutir.
   */
  const tentative = useRef(0)

  const entrerEnDemo = useCallback(() => {
    ecrireStockage('session', CLE_DEMO, '1')
    setEtat({ statut: 'demo' })
  }, [])

  /**
   * LA SESSION VIENT-ELLE DU SERVEUR ?
   *
   * `false` tant que `/auth/me` n'a pas répondu — c'est-à-dire au premier
   * rendu, et pendant toute la durée d'un cas de test qui INJECTE un état
   * initial plutôt que de le faire résoudre.
   *
   * Ce drapeau existe pour une règle qui vaut aussi en production : on
   * n'affirme jamais une ABSENCE sur un état qu'on n'a pas reçu. Dire « vous
   * n'appartenez à aucun parc » à partir d'un état posé par défaut serait
   * conclure d'un silence — et le produit a déjà payé ce raisonnement, sur
   * l'écran des cautions comme sur celui des accès.
   *
   * Sa conséquence visible est `useSansParc`, dans la coquille.
   */
  const [resolue, setResolue] = useState(false)

  const rafraichir = useCallback(async () => {
    try {
      const { user, memberships } = await api.me()
      // Un vrai compte l'emporte toujours sur une visite de démonstration : la
      // trace de l'onglet est effacée, sans quoi le bandeau resterait affiché
      // au-dessus des vraies données du propriétaire.
      effacerStockage('session', CLE_DEMO)
      setEtat({ statut: 'connecte', compte: user, adhesions: memberships })
      setResolue(true)
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

  /**
   * L'AMORÇAGE — le seul chemin qui a des états terminaux, et c'est délibéré.
   *
   * `rafraichir` continue de LEVER : `connecter` et `inscrire` en dépendent pour
   * afficher l'erreur sur leur formulaire, et avaler leurs échecs ici ferait
   * paraître une connexion réussie alors qu'elle a échoué. Ce qu'on borne est
   * l'appel du MONTAGE, celui que personne n'attend et dont l'échec n'avait
   * jusqu'ici aucun lecteur : `void rafraichir()` jetait son rejet dans le vide,
   * et l'état restait « inconnu » pour toujours.
   *
   * MESURÉ AVANT D'ÉCRIRE CECI : sous un serveur qui rend 500, l'écran affichait
   * « Chargement… » à 3 s, 15 s et 45 s — 0 titre, 0 sortie. L'appel REVENAIT
   * pourtant en quelques millisecondes. Le défaut n'était donc pas un appel sans
   * fin, c'était un rejet sans lecteur.
   */
  const chargerLaSession = useCallback(async () => {
    const mienne = ++tentative.current
    setEchec(null)
    let minuterie: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        rafraichir(),
        new Promise<never>((_, rejeter) => {
          minuterie = setTimeout(() => rejeter(new DelaiDepasse()), DELAI_DE_SESSION_MS)
        }),
      ])
    } catch (err) {
      // Une tentative dépassée par une reprise n'écrit plus rien : sa réponse
      // tardive ne doit pas ressusciter un écran que l'utilisateur a quitté.
      if (mienne !== tentative.current) return
      setEchec(err instanceof DelaiDepasse ? 'delai' : 'technique')
    } finally {
      clearTimeout(minuterie)
    }
  }, [rafraichir])

  const reprendreLaSession = useCallback(() => {
    void chargerLaSession()
  }, [chargerLaSession])

  useEffect(() => {
    // Un état fourni est déjà résolu : réinterroger le serveur l'écraserait
    // aussitôt, et la couture ne servirait à rien.
    if (etatInitial) return
    void chargerLaSession()
  }, [etatInitial, chargerLaSession])

  const connecter = useCallback(
    async (email: string, motDePasse: string, persistante: boolean) => {
      await api.login(email, motDePasse, persistante)
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

  const adhesions = etat.statut === 'connecte' ? etat.adhesions : []
  /**
   * Le parc actif est un IDENTIFIANT, pas un index.
   *
   * Retenir « le deuxième » se décalerait dès qu'une adhésion s'ajoute ou se
   * retire — l'utilisateur se retrouverait sur un autre parc sans avoir rien
   * demandé, ce qui est exactement le genre de faute qu'on ne remarque pas.
   */
  const [parcChoisi, setParcChoisi] = useState<string | null>(null)
  const adhesionActive =
    adhesions.find((a) => a.parkId === parcChoisi) ?? adhesions[0] ?? null

  const choisirParc = useCallback((parkId: string) => setParcChoisi(parkId), [])

  const value = useMemo<SessionContextValue>(
    () => ({
      etat,
      // Une démonstration est un état RÉSOLU : il n'y a plus rien à attendre du
      // serveur. La compter comme un chargement laisserait tourner l'attente
      // indéfiniment. Un ÉCHEC est résolu de la même façon : c'est la FIN de
      // l'attente, pas sa poursuite.
      chargement: etat.statut === 'inconnu' && !horsLigne && echec === null,
      horsLigne,
      echecDeSession: echec,
      reprendreLaSession,
      connecter,
      inscrire,
      deconnecter,
      rafraichir,
      entrerEnDemo,
      estDemo: etat.statut === 'demo',
      sessionResolue: resolue,
      adhesionActive,
      choisirParc,
    }),
    // `adhesionActive` et `choisirParc` LISTÉES : une dépendance manquante ne
    // casse pas, elle attend — le changement de parc n'aurait été vu qu'au
    // prochain rendu déclenché par autre chose.
    [
      etat,
      resolue,
      horsLigne,
      echec,
      reprendreLaSession,
      connecter,
      inscrire,
      deconnecter,
      rafraichir,
      entrerEnDemo,
      adhesionActive,
      choisirParc,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const contexte = useContext(SessionContext)
  if (!contexte) throw new Error('useSession doit être utilisé dans un <SessionProvider>')
  return contexte
}
