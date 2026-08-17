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
import { useLocation } from 'react-router-dom'

/**
 * Durée de l'attente SIMULÉE, en démonstration seulement.
 *
 * Ralentir sciemment une vitrine se justifie mal, et c'est pourtant le seul
 * moyen de montrer l'état d'attente sans compte : la démonstration sert un
 * module local, donc n'attend rien. Le choix est assumé, la durée est le prix.
 *
 * 900 ms parce que les deux bornes sont serrées. En dessous de 500 ms environ,
 * le squelette passe pour un clignotement et l'on doute d'avoir vu quelque
 * chose ; au-delà d'une seconde et demie, la démonstration paraît lente, ce qui
 * est le message exactement inverse de celui qu'elle porte. C'est aussi l'ordre
 * de grandeur d'un vrai aller-retour sur le réseau visé — moins que les
 * plusieurs secondes du pire cas, davantage que le réseau d'un bureau.
 *
 * L'attente n'a lieu qu'UNE fois, à l'entrée dans la démonstration : le coût
 * total pour un visiteur est donc de 900 ms, pas de 900 ms par écran.
 */
const ATTENTE_DEMO_MS = 900
import {
  DEMO_TENANT_UNIT,
  type Deposit,
  type TradeKey,
  type Unit,
  type UrgencyKey,
  type WorkOrder,
} from './portfolio'
import { chargerParc, type Immeuble } from './apiPortfolio'
import {
  ALERTS as ALERTS_DEMO,
  BUILDINGS as IMMEUBLES_DEMO,
  COLLECTIONS as COLLECTIONS_DEMO,
  INSPECTIONS as INSPECTIONS_DEMO,
  READINGS as READINGS_DEMO,
  type Alert,
  type Inspection,
  type MeterReading,
  type MonthlyCollection,
} from './portfolio'
import { ApiError, api } from '@/api/client'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { hasStoredState, loadState, resetState, saveState } from './persistence'

/**
 * État partagé du parc.
 *
 * Chaque écran gardait sa propre copie des travaux et des cautions. Valider un
 * devis sur l'écran Travaux laissait donc le tableau de bord réclamer la même
 * décision dans sa carte « Ce qui demande une décision », et arbitrer une
 * caution ne mettait pas à jour l'espace locataire. Une décision prise doit
 * disparaître de partout où on la réclamait.
 *
 * Ce contexte tient la place qu'occuperait le serveur dans le produit réel :
 * une seule source, plusieurs lecteurs. Il est monté à la racine et non dans
 * `AppShell`, pour que l'état survive à la navigation — et il s'enregistre
 * localement, pour qu'il survive aussi au rechargement.
 */
/**
 * La fiche d'une intervention tout juste déclarée.
 *
 * Écrite en toute lettres plutôt qu'avec un `as WorkOrder` sur un objet partiel.
 * Le cast avait masqué `reportedAt` et `urgent` : le type se taisait, et l'écran
 * tombait au rendu sur « Cannot read properties of undefined (reading 'year') ».
 * Un cast n'ajoute rien à ce qu'on sait, il fait seulement taire ce qu'on ignore.
 */
/** `AAAA-MM-JJ` en parties de date, ou aujourd'hui. */
function dateDuJour(iso?: string): { year: number; month: number; day: number } {
  if (iso) {
    const [a, m, j] = iso.split('-').map(Number)
    return { year: a!, month: m!, day: j! }
  }
  const maintenant = new Date()
  return {
    year: maintenant.getFullYear(),
    month: maintenant.getMonth() + 1,
    day: maintenant.getDate(),
  }
}

function nouvelleFiche(
  id: string,
  unitId: string,
  signalement: { title: string; trade: TradeKey; urgency: UrgencyKey; description?: string },
): WorkOrder {
  const maintenant = new Date()
  return {
    id,
    unitId,
    title: signalement.title,
    trade: signalement.trade,
    status: 'reported',
    // Rien n'est chiffré : c'est le gestionnaire qui le fera.
    amount: null,
    reportedAt: {
      year: maintenant.getFullYear(),
      month: maintenant.getMonth() + 1,
      day: maintenant.getDate(),
    },
    urgent: signalement.urgency === 'blocking',
  }
}

interface PortfolioContextValue {
  units: Unit[]
  works: WorkOrder[]
  deposits: Deposit[]
  /** Le propriétaire valide un devis proposé par le gestionnaire. */
  approveWork: (id: string) => void
  /** Le gestionnaire chiffre une intervention déclarée : « propose, ne décide pas ». */
  quoteWork: (id: string, quotedMinor: number) => void
  /**
   * Clôt une intervention.
   *
   * `approved` était en pratique TERMINAL : un devis validé restait « à faire »
   * indéfiniment, donc la liste des travaux ne pouvait que grandir.
   */
  completeWork: (id: string) => void
  /**
   * Rouvre une clôture.
   *
   * L'état de retour n'est pas choisi ici : le serveur le déduit — validé si la
   * dépense avait été engagée, déclaré sinon. Le décider côté client rendrait à
   * `quoted` un devis déjà validé, et effacerait la décision du propriétaire.
   */
  reopenWork: (id: string) => void
  /** Défait une validation de devis : le devis redevient à arbitrer. */
  unapproveWork: (id: string) => void
  /**
   * Déclare une intervention. Le LOCATAIRE y a droit, sur son logement.
   *
   * C'est l'origine normale d'une intervention — « elle naît d'un signalement de
   * locataire, jamais d'une saisie du bailleur » — et le produit ne l'offrait
   * nulle part.
   */
  /** Établit un état des lieux sur un logement. */
  addInspection: (
    unitId: string,
    etat: {
      kind: 'entry' | 'exit'
      rooms: number
      performedOn?: string
      signedByName?: string
      findings: { room: string; description: string; severity: 'minor' | 'major'; costMinor?: number }[]
    },
  ) => void
  addWork: (
    unitId: string,
    signalement: { title: string; trade: TradeKey; urgency: UrgencyKey; description?: string },
  ) => void
  /** Défait un arbitrage de caution : elle redevient retenue, sans retenue. */
  unsettleDeposit: (unitId: string) => void
  /** Le propriétaire arbitre une caution : retenue et restitution du solde. */
  /**
   * Arbitre une caution. La justification traverse jusqu'au serveur, qui
   * l'exige dès qu'il y a une retenue — elle était saisie, rendue obligatoire
   * par la modale, et perdue avant l'appel.
   */
  settleDeposit: (unitId: string, withheld: number, reason?: string) => void
  /** Rattache un locataire à une unité vacante. Le bail démarre « en attente ». */
  /**
   * Rattache un locataire. `bail` porte les termes réels du contrat — début et
   * loyer — quand ils diffèrent de « aujourd'hui » et du loyer de référence.
   */
  addTenant: (
    unitId: string,
    name: string,
    phone: string,
    bail?: { startsOn?: string; rentMinor?: number; depositMinor?: number },
  ) => void
  /** Crée un immeuble dans le parc. Sans parc serveur, il reste local. */
  addBuilding: (name: string, district: string) => void
  /**
   * Retire un immeuble VIDE.
   *
   * Le nom n'est pas contraint à l'unicité — deux immeubles peuvent
   * légitimement porter le même dans deux quartiers — et il n'existait aucun
   * moyen de défaire une saisie en double : deux entrées indiscernables, et
   * rien pour en retirer une. Toute faute de frappe était définitive.
   */
  removeBuilding: (buildingId: string) => void
  /**
   * Relance les baux désignés, et rend ce qui a RÉELLEMENT eu lieu.
   *
   * Le serveur revérifie chaque bail — à jour, rien d'exigible, déjà relancé ce
   * matin — et peut donc n'en relancer aucun. L'écran doit dire « 2 relancés,
   * 1 déjà relancé aujourd'hui » plutôt qu'annoncer trois envois : c'est le
   * défaut que ce chantier corrige, pas un défaut à reproduire.
   */
  remindRent: (leaseIds: string[]) => Promise<{ sent: number; skipped: number }>
  /**
   * Appelle les loyers d'une période. Rend le nombre d'échéances ÉMISES.
   *
   * Zéro n'est pas une erreur : appeler deux fois le même mois est sans effet,
   * et c'est voulu — on relance l'appel après avoir ajouté un locataire en
   * cours de mois.
   */
  callRent: (periodStart: string) => Promise<number>
  /** Met en demeure. Droit du seul propriétaire, motif obligatoire. */
  serveFormalNotice: (leaseId: string, reason: string) => Promise<boolean>
  /**
   * Enregistre un encaissement sur une période.
   *
   * La modale affichait « Paiement enregistré · quittance envoyée » sans rien
   * écrire nulle part — le mensonge le plus coûteux d'un logiciel de gestion.
   */
  recordPayment: (
    unitId: string,
    versement: {
      periodStart: string
      amountMinor: number
      method: string
      paidOn?: string
      reference?: string
    },
  ) => void
  /** Crée un logement dans un immeuble. Vacant : aucun bail n'existe encore. */
  addUnit: (
    buildingId: string,
    logement: { label: string; type: Unit['type']; surface: number; rent: number },
  ) => void
  /**
   * Alertes marquées comme lues pendant la session.
   *
   * Cet état vivait dans l'écran des signalements, donc la pastille de la barre
   * latérale ne pouvait pas le connaître : elle affichait « 2 » — une constante
   * écrite en dur — même après que tout ait été marqué comme lu.
   *
   * Délibérément **non persisté**, contrairement aux unités, travaux et
   * cautions : ce n'est pas de la donnée de parc mais l'état d'une session de
   * lecture. L'enregistrer imposerait de faire évoluer le format pour quelque
   * chose que l'utilisateur ne s'attend pas à retrouver au rechargement.
   */
  readAlertIds: string[]
  markAlertsRead: (ids: string[]) => void
  /** Efface le parcours enregistré et remet le jeu de démonstration. */
  reset: () => void
  /** `true` si un parcours a été enregistré, donc s'il y a quelque chose à effacer. */
  hasChanges: boolean
  /**
   * Unités du compte connecté, quand il est locataire.
   *
   * Remplace `CURRENT_TENANT_UNIT`, une constante `'A1'` qui tenait lieu de
   * session. Elle rendait trois cas ordinaires inexprimables — un locataire de
   * deux unités, un locataire parti qui consulte ses quittances, une personne
   * locataire ici et propriétaire ailleurs — et, plus grave, elle serait
   * devenue introuvable le jour où l'identifiant est un `uuid` : l'écran se
   * serait vidé sans la moindre erreur.
   *
   * En mode serveur, la liste se DÉDUIT des unités reçues : l'API ne rend au
   * locataire que ses baux, le périmètre est donc déjà calculé là où il ne peut
   * pas être contourné.
   */
  tenantUnitIds: string[]
  /**
   * Immeubles du parc.
   *
   * Ils venaient d'une constante de module pendant que les unités venaient du
   * serveur : les identifiants ne se correspondaient plus, donc les cartes
   * d'occupation affichaient « 0/0 » et la colonne « Immeuble » restait vide.
   * Rien n'échouait — les deux sources se croisaient sans se rencontrer.
   */
  buildings: Immeuble[]
  buildingById: (id: string) => Immeuble | undefined
  /** Relevés, états des lieux et alertes — même source que le reste du parc. */
  readings: MeterReading[]
  inspections: Inspection[]
  alerts: Alert[]
  collections: MonthlyCollection[]
  readingForUnit: (unitId: string) => MeterReading | undefined
  /** `true` si cette unité relève du compte connecté. */
  isMine: (unitId: string) => boolean
  /** `true` quand les données viennent du serveur et non du jeu local. */
  fromApi: boolean
  /**
   * `true` tant que le parc du SERVEUR est en vol.
   *
   * Il manquait, et son absence ne se lisait pas comme un manque : les écrans
   * avaient toujours quelque chose à afficher — le jeu de démonstration, servi
   * depuis le module en attendant la réponse. Rien n'échouait, rien ne
   * clignotait ; le propriétaire lisait simplement trois immeubles, dix
   * locataires et 447 000 FCFA d'impayés qui n'étaient pas les siens, puis
   * l'écran se remplaçait sous ses yeux. C'est pire qu'une attente sans retour
   * visuel : une attente se reconnaît, un parc inventé se croit.
   *
   * La suite de tests le savait déjà, sans le nommer : `gestures.test.tsx`
   * attend explicitement la charge du serveur avant chaque clic, « sans quoi le
   * geste porte sur le jeu de démonstration encore affiché ». L'utilisateur,
   * lui, n'a pas de `findBy`.
   *
   * `fromApi` ne pouvait pas tenir ce rôle : il confond « pas encore chargé »,
   * « chargement échoué » et « aucun parc » en une seule valeur fausse.
   *
   * Vaut `false` en démonstration, et c'est la moitié importante de la règle :
   * sans parc serveur les données sont locales et déjà là. Annoncer une attente
   * qui n'existe pas serait le même mensonge, dans l'autre sens.
   */
  loading: boolean
  worksForUnit: (unitId: string) => WorkOrder[]
  depositForUnit: (unitId: string) => Deposit | undefined
  unitById: (unitId: string) => Unit | undefined
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast()
  const t = useT()

  /**
   * Ce que devient un refus du serveur.
   *
   * Les trois mutations faisaient `void api….then(…)` sans capture : un 403 ou
   * un 404 partait en promesse rejetée, et l'écran ne changeait pas d'un pixel.
   * Un gestionnaire qui n'a pas le droit de valider un devis cliquait, et rien
   * — ni succès, ni refus. C'est exactement ce qui a fait passer le bouton
   * d'inscription pour inerte, au même moment, pour une autre raison.
   *
   * On distingue le refus de la panne : « le serveur a dit non » et « le
   * serveur n'a pas répondu » n'appellent pas le même geste. Les confondre
   * produit « une erreur est survenue », qui n'aide personne.
   *
   * Et l'on affirme ce qu'on sait : rien n'a été enregistré. C'est la question
   * que se pose l'utilisateur, et la seule à laquelle on puisse répondre avec
   * certitude — l'état local n'a pas été touché.
   */
  const signalerEchec = useCallback(
    (err: unknown) => {
      notify(t(err instanceof ApiError ? 'common.actionRefused' : 'common.actionFailed'), {
        tone: 'danger',
      })
    },
    [notify, t],
  )

  /**
   * Deux sources, et une seule à la fois.
   *
   * Sans parc — visiteur, ou compte qui n'a rejoint aucun parc — le jeu de
   * démonstration reste servi depuis le module, exactement comme avant. Avec un
   * parc, tout vient du serveur.
   *
   * Le mélange serait le pire des trois : des unités réelles à côté de
   * cautions de démonstration, sans que rien à l'écran ne dise laquelle est
   * laquelle.
   */
  const { adhesionActive } = useSession()
  const parkId = adhesionActive?.parkId ?? null
  /**
   * La démonstration se reconnaît à son ADRESSE, comme le reste du produit.
   *
   * Elle a sa propre route depuis qu'un bandeau ne suffisait pas à la
   * distinguer de l'espace réel ; on lit donc la même chose que l'utilisateur.
   * Ce fournisseur vit sous `BrowserRouter`, le crochet y est disponible.
   *
   * Il rend ce composant à chaque navigation, ce qui est le prix à payer. La
   * valeur de contexte reste mémoïsée sur ses propres dépendances : les
   * consommateurs, eux, ne rendent pas pour autant.
   */
  const enDemonstration = useLocation().pathname.startsWith('/demo')
  const role = adhesionActive?.role ?? null

  const initial = loadState()
  const [units, setUnits] = useState<Unit[]>(initial.units)
  const [works, setWorks] = useState<WorkOrder[]>(initial.works)
  const [deposits, setDeposits] = useState<Deposit[]>(initial.deposits)
  const [stored, setStored] = useState(hasStoredState)
  const [fromApi, setFromApi] = useState(false)
  /**
   * Initialisé DANS le premier rendu, et non par l'effet.
   *
   * L'effet ne s'exécute qu'après la première peinture : le poser à `false` au
   * départ laisserait passer une image complète de parc de démonstration avant
   * le squelette — le clignotement exact qu'on cherche à supprimer, et il se
   * verrait d'autant mieux que l'appareil est lent.
   */
  const [loading, setLoading] = useState(() => parkId !== null || enDemonstration)
  /**
   * Le parc effectivement AFFICHÉ, une fois sa réponse arrivée.
   *
   * Une `ref` et non un état : personne ne rend cette valeur, elle ne sert qu'à
   * décider s'il faut rouvrir une attente. En faire un état provoquerait un
   * rendu de plus à chaque chargement, pour rien.
   */
  const parcAffiche = useRef<string | null>(null)
  /** Pendant de `parcAffiche` pour l'attente simulée : une fois servie, jamais rejouée. */
  const attenteDemoServie = useRef(false)
  const [buildings, setBuildings] = useState<Immeuble[]>(IMMEUBLES_DEMO)
  const [readings, setReadings] = useState<MeterReading[]>(READINGS_DEMO)
  const [inspections, setInspections] = useState<Inspection[]>(INSPECTIONS_DEMO)
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS_DEMO)
  const [collections, setCollections] = useState<MonthlyCollection[]>(COLLECTIONS_DEMO)

  useEffect(() => {
    if (!parkId) {
      /**
       * Rien en vol : les données locales sont déjà servies — SAUF en
       * démonstration, où l'on simule l'attente une fois.
       *
       * Les huit écrans ont un squelette câblé que personne n'avait jamais vu.
       * La démonstration sert un module local, de façon synchrone : `loading`
       * restait faux du premier rendu au dernier, et la branche
       * `if (loading) return <…Skeleton/>` n'était jamais prise. Le seul moyen
       * de la déclencher était un compte relié à un parc, qui n'existe pas
       * encore sur le déploiement. Du code livré, jamais regardé — et le
       * débordement de `SkeletonTable` à 375px, coupé en silence, montre ce que
       * cela coûtait.
       *
       * L'attente simulée est un COUP UNIQUE, comme la vraie. Le chargement
       * réel n'est rouvert que si le parc affiché change (`parcAffiche`) ; il
       * ne se rejoue pas d'un écran à l'autre, puisque ce fournisseur ne se
       * remonte jamais. Ici, l'effet ne dépend que de l'ENTRÉE dans la
       * démonstration : naviguer de `/demo/travaux` à `/demo/cautions` laisse
       * `enDemonstration` à `true`, donc ne relance rien. Faire attendre à
       * chaque clic aurait été une invention, et une démonstration poussive.
       *
       * La garde est posée à la FIN du minuteur, jamais à son ouverture.
       * `StrictMode` rejoue les effets au montage : marquée d'entrée, elle
       * survivrait au faux démontage et la seconde exécution effacerait
       * l'attente aussitôt — le squelette ne se verrait qu'en production, donc
       * jamais pendant qu'on le met au point. Le même piège a déjà été payé
       * plus bas, sur `intact`.
       */
      if (!enDemonstration || attenteDemoServie.current) {
        setLoading(false)
        return
      }
      setLoading(true)
      const minuteur = setTimeout(() => {
        attenteDemoServie.current = true
        setLoading(false)
      }, ATTENTE_DEMO_MS)
      return () => clearTimeout(minuteur)
    }
    let annule = false
    /**
     * On n'ouvre une attente que si le parc à l'écran n'est PAS celui qu'on
     * demande.
     *
     * Cet effet ne se rejoue pas seulement au changement de parc : il dépend de
     * `signalerEchec`, donc du dictionnaire, donc de la langue. Basculer en
     * anglais relit le parc — vérifié, une lecture avant, deux après. Sans ce
     * garde, le squelette recouvrirait alors des données valides et déjà lues,
     * le temps d'un aller-retour réseau. On aurait remplacé un écran qui ment
     * par un écran qui clignote.
     */
    if (parcAffiche.current !== parkId) setLoading(true)
    void chargerParc(parkId).then((parc) => {
      // Une réponse qui arrive après un changement de parc écraserait le
      // nouveau par l'ancien : la garde est indispensable, et le défaut ne se
      // reproduirait qu'au ralenti du réseau réel.
      if (annule) return
      setBuildings(parc.buildings)
      setReadings(parc.readings)
      setInspections(parc.inspections)
      setAlerts(parc.alerts)
      setCollections(parc.collections)
      setUnits(parc.units)
      setWorks(parc.works)
      setDeposits(parc.deposits)
      setFromApi(true)
      // Posé APRÈS l'écriture, et seulement en cas de succès : un échec laisse
      // le jeu de démonstration à l'écran, et une relecture ultérieure a alors
      // toutes les raisons de rouvrir l'attente.
      parcAffiche.current = parkId
    })
      /**
       * Le chargement du parc peut échouer, lui aussi.
       *
       * Sans capture, un 404 — parc supprimé, adhésion périmée — devenait une
       * promesse rejetée : l'écran gardait le jeu de démonstration, et
       * l'utilisateur regardait des données qui n'étaient pas les siennes sans
       * que rien ne le dise. `fromApi` reste faux, ce qui est exact : ces
       * données ne viennent pas du serveur.
       *
       * Silencieux si la requête a été annulée : changer de parc en cours de
       * chargement n'est pas une panne.
       */
      .catch((err: unknown) => {
        if (annule) return
        signalerEchec(err)
      })
      /**
       * L'attente se termine dans TOUS les cas, y compris l'échec.
       *
       * Un squelette qu'aucune réponse ne vient effacer est pire qu'une erreur :
       * il promet que quelque chose arrive. La panne, elle, est déjà dite par
       * `signalerEchec`.
       *
       * Silencieux si la requête a été annulée : le rendu suivant a déjà posé
       * sa propre attente, et l'effacer ici la ferait sauter.
       */
      .finally(() => {
        if (annule) return
        setLoading(false)
      })
    return () => {
      annule = true
    }
  }, [parkId, signalerEchec, enDemonstration])

  /**
   * Enregistré à chaque changement d'état plutôt qu'à chaque geste : un seul
   * endroit à maintenir, et aucun risque d'oublier la sauvegarde en ajoutant
   * une action.
   *
   * La condition compare les **références** à l'état non modifié — celui chargé
   * au démarrage, puis celui remis par `reset()`. Tant que rien n'a muté,
   * `useState` rend exactement les tableaux reçus, donc l'égalité tient et l'on
   * n'écrit pas. Une garde « premier rendu » par `ref` ne suffisait pas :
   * `StrictMode` rejoue les effets au montage, la ref survivait au faux
   * remontage, et l'application écrivait le jeu de démonstration inchangé dès
   * l'ouverture — `hasChanges` devenait vrai avant toute modification, et le
   * bouton « repartir de zéro » proposait d'effacer un parcours inexistant.
   */
  const intact = useRef(initial)
  useEffect(() => {
    if (
      units === intact.current.units &&
      works === intact.current.works &&
      deposits === intact.current.deposits
    ) {
      return
    }
    saveState({ units, works, deposits })
    setStored(true)
  }, [units, works, deposits])

  /**
   * Les mutations écrivent d'abord au serveur, puis rejouent la réponse.
   *
   * L'inverse — poser l'état localement puis appeler — donnerait une interface
   * qui affiche un devis validé que le serveur a refusé. Le refus existe
   * vraiment : c'est le droit du seul propriétaire, et il est vérifié là-bas.
   */
  const approveWork = useCallback(
    (id: string) => {
      if (!parkId) {
        setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'approved' } : w)))
        return
      }
      void api
        .approveWork<{ work: { id: string; status: WorkOrder['status'] } }>(parkId, id)
        .then(({ work }) => {
          setWorks((list) => list.map((w) => (w.id === work.id ? { ...w, status: work.status } : w)))
        })
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const quoteWork = useCallback(
    (id: string, quotedMinor: number) => {
      if (!parkId) {
        setWorks((list) =>
          list.map((w) => (w.id === id ? { ...w, status: 'quoted', amount: quotedMinor } : w)),
        )
        return
      }
      void api
        .quoteWork<{ work: { id: string; status: WorkOrder['status']; quotedAmountMinor: number } }>(
          parkId,
          id,
          quotedMinor,
        )
        .then(({ work }) =>
          setWorks((list) =>
            list.map((w) =>
              w.id === work.id ? { ...w, status: work.status, amount: work.quotedAmountMinor } : w,
            ),
          ),
        )
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const completeWork = useCallback(
    (id: string) => {
      if (!parkId) {
        setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'done' } : w)))
        return
      }
      void api
        .completeWork<{ work: { id: string; status: WorkOrder['status'] } }>(parkId, id)
        // L'état ne change qu'APRÈS l'accord du serveur : il refuse un devis en
        // attente d'arbitrage, et le marquer terminé d'abord montrerait une
        // clôture qui n'a pas eu lieu.
        .then(({ work }) =>
          setWorks((list) => list.map((w) => (w.id === work.id ? { ...w, status: work.status } : w))),
        )
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const reopenWork = useCallback(
    (id: string) => {
      if (!parkId) {
        setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'approved' } : w)))
        return
      }
      void api
        .reopenWork<{ work: { id: string; status: WorkOrder['status'] } }>(parkId, id)
        .then(({ work }) =>
          setWorks((list) => list.map((w) => (w.id === work.id ? { ...w, status: work.status } : w))),
        )
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const unapproveWork = useCallback(
    (id: string) => {
      if (!parkId) {
        setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'quoted' } : w)))
        return
      }
      void api
        .unapproveWork<{ work: { id: string; status: WorkOrder['status'] } }>(parkId, id)
        .then(({ work }) =>
          setWorks((list) => list.map((w) => (w.id === work.id ? { ...w, status: work.status } : w))),
        )
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const unsettleDeposit = useCallback(
    (unitId: string) => {
      const caution = deposits.find((d) => d.unitId === unitId)
      const local = () =>
        setDeposits((list) =>
          list.map((d) => (d.unitId === unitId ? { ...d, withheld: 0, status: 'held' } : d)),
        )
      if (!parkId || !caution?.id) {
        local()
        return
      }
      void api
        .unsettleDeposit(parkId, caution.id)
        .then(local)
        .catch(signalerEchec)
    },
    [parkId, deposits, signalerEchec],
  )

  const addWork = useCallback(
    (
      unitId: string,
      signalement: { title: string; trade: TradeKey; urgency: UrgencyKey; description?: string },
    ) => {
      if (!parkId) {
        // Sans parc serveur — démonstration — le signalement ne vit qu'en
        // mémoire. La référence est locale et le dit.
        setWorks((list) => [nouvelleFiche(`LOCAL-${list.length + 1}`, unitId, signalement), ...list])
        return
      }
      void api
        .addWork<{ work: { id: string; reference: string; status: WorkOrder['status'] } }>(
          parkId,
          unitId,
          signalement,
        )
        .then(({ work }) =>
          setWorks((list) => [nouvelleFiche(work.id, unitId, signalement), ...list]),
        )
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const addInspection = useCallback(
    (
      unitId: string,
      etat: {
        kind: 'entry' | 'exit'
        rooms: number
        performedOn?: string
        signedByName?: string
        findings: {
          room: string
          description: string
          severity: 'minor' | 'major'
          costMinor?: number
        }[]
      },
    ) => {
      const local = () =>
        setInspections((liste) => [
          {
            unitId,
            kind: etat.kind,
            date: dateDuJour(etat.performedOn),
            rooms: etat.rooms,
            // Le nombre de réserves, pas leur détail : c'est ce que l'écran
            // affiche, et l'inventer complet ici en ferait une seconde source.
            issues: etat.findings.length,
            signed: Boolean(etat.signedByName),
          },
          ...liste,
        ])
      if (!parkId) {
        local()
        return
      }
      void api.addInspection(parkId, unitId, etat).then(local).catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const settleDeposit = useCallback(
    (unitId: string, withheld: number, reason?: string) => {
      const local = () =>
        setDeposits((list) =>
          list.map((d) => (d.unitId === unitId ? { ...d, withheld, status: 'returned' } : d)),
        )
      const caution = deposits.find((d) => d.unitId === unitId)
      // Sans identifiant serveur, la caution vient du jeu local.
      if (!parkId || !caution?.id) {
        local()
        return
      }
      void api
        .settleDeposit(parkId, caution.id, {
          withheldMinor: withheld,
          ...(reason ? { reason } : {}),
        })
        .then(local)
        .catch(signalerEchec)
    },
    [parkId, deposits, signalerEchec],
  )

  const addBuilding = useCallback(
    (name: string, district: string) => {
      if (!parkId) {
        // Sans parc serveur — démonstration — l'immeuble reste local, comme
        // tout le reste du jeu de données.
        setBuildings((liste) => [...liste, { id: `local-${liste.length + 1}`, name, district }])
        return
      }
      void api
        .addBuilding<{ building: { id: string; name: string; district: string } }>(parkId, {
          name,
          district,
        })
        // On rejoue la réponse du SERVEUR et non la saisie : c'est lui qui
        // décide de l'identifiant, et c'est par cet identifiant que les
        // logements s'y rattacheront.
        .then(({ building }) => setBuildings((liste) => [...liste, building]))
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const removeBuilding = useCallback(
    (buildingId: string) => {
      if (!parkId) {
        // Sans parc serveur — démonstration — l'immeuble ne vit qu'en mémoire.
        setBuildings((liste) => liste.filter((b) => b.id !== buildingId))
        return
      }
      void api
        .deleteBuilding(parkId, buildingId)
        // On ne retire de l'écran qu'APRÈS l'accord du serveur : il refuse un
        // immeuble qui porte des logements, et le faire disparaître d'abord
        // montrerait une suppression qui n'a pas eu lieu.
        .then(() => setBuildings((liste) => liste.filter((b) => b.id !== buildingId)))
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  /**
   * Relance, et rend le compte de ce qui est parti.
   *
   * Rien n'est modifié dans l'état local : une relance ne change ni le loyer ni
   * le statut du bail. Elle laisse une trace côté serveur, que la prochaine
   * lecture du parc rapportera avec les notifications.
   */
  const remindRent = useCallback(
    async (leaseIds: string[]): Promise<{ sent: number; skipped: number }> => {
      if (!parkId || leaseIds.length === 0) return { sent: 0, skipped: leaseIds.length }
      try {
        const reponse = await api.remindRent<{
          sent: string[]
          skipped: { leaseId: string; reason: string }[]
        }>(parkId, leaseIds)
        return { sent: reponse.sent.length, skipped: reponse.skipped.length }
      } catch (erreur) {
        signalerEchec(erreur)
        // Zéro, et non le nombre demandé : annoncer un envoi après un échec
        // réseau est précisément le mensonge qu'on retire du produit.
        return { sent: 0, skipped: leaseIds.length }
      }
    },
    [parkId, signalerEchec],
  )

  const callRent = useCallback(
    async (periodStart: string): Promise<number> => {
      if (!parkId) return 0
      try {
        const { issued } = await api.callRent<{ issued: number }>(parkId, periodStart)
        return issued
      } catch (erreur) {
        signalerEchec(erreur)
        return 0
      }
    },
    [parkId, signalerEchec],
  )

  const serveFormalNotice = useCallback(
    async (leaseId: string, reason: string): Promise<boolean> => {
      if (!parkId) return false
      try {
        await api.serveFormalNotice(parkId, leaseId, reason)
        return true
      } catch (erreur) {
        signalerEchec(erreur)
        return false
      }
    },
    [parkId, signalerEchec],
  )

  const recordPayment = useCallback(
    (
      unitId: string,
      versement: {
        periodStart: string
        amountMinor: number
        method: string
        paidOn?: string
        reference?: string
      },
    ) => {
      const local = () =>
        setUnits((liste) =>
          liste.map((u) => {
            if (u.id !== unitId) return u
            const paid = u.paid + versement.amountMinor
            return {
              ...u,
              paid,
              // Le statut se dérive du montant : « à jour » n'est vrai que si
              // la totalité du loyer est couverte. Le poser à « payé » dès le
              // premier versement ferait disparaître un impayé réel.
              status: paid >= u.rent ? 'paid' : 'partial',
            }
          }),
        )

      if (!parkId) {
        local()
        return
      }
      void api
        .recordPayment(parkId, { unitId, ...versement })
        .then(local)
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const addUnit = useCallback(
    (
      buildingId: string,
      logement: { label: string; type: Unit['type']; surface: number; rent: number },
    ) => {
      const local = (id: string) =>
        setUnits((liste) => [
          ...liste,
          {
            id,
            buildingId,
            label: logement.label,
            type: logement.type,
            surface: logement.surface,
            rent: logement.rent,
            // Vacant, et non « à jour » : aucun bail n'existe. Marquer un
            // logement occupé fausserait le taux d'occupation dès sa création.
            tenant: null,
            phone: null,
            paid: 0,
            status: 'vacant',
          } as Unit,
        ])

      if (!parkId) {
        local(`local-${logement.label}-${buildingId}`)
        return
      }
      void api
        .addUnit<{ unit: { id: string } }>(parkId, buildingId, {
          label: logement.label,
          type: logement.type,
          surfaceSqm: logement.surface,
          baseRentMinor: logement.rent,
        })
        // L'identifiant vient du SERVEUR : c'est par lui que le bail, les
        // relevés et les charges s'y rattacheront.
        .then(({ unit }) => local(unit.id))
        .catch(signalerEchec)
    },
    [parkId, signalerEchec],
  )

  const addTenant = useCallback((
    unitId: string,
    name: string,
    phone: string,
    bail?: { startsOn?: string; rentMinor?: number; depositMinor?: number },
  ) => {
    if (parkId) {
      void api
        .addTenant(parkId, {
          unitId,
          fullName: name,
          phoneE164: phone.replace(/\s/g, ''),
          ...(bail?.startsOn ? { startsOn: bail.startsOn } : {}),
          ...(bail?.rentMinor !== undefined ? { rentMinor: bail.rentMinor } : {}),
          // Sans ce relais, le champ de la modale se saisissait et se perdait :
          // le parc n'aurait toujours porté aucune caution.
          ...(bail?.depositMinor !== undefined ? { depositMinor: bail.depositMinor } : {}),
        })
        .then(() => chargerParc(parkId))
        .then((parc) => {
          // On relit le parc plutôt que de deviner l'état résultant : le
          // serveur décide du statut du bail, et deux calculs de la même chose
          // finissent toujours par diverger.
          setUnits(parc.units)
          setWorks(parc.works)
          setDeposits(parc.deposits)
        })
        .catch(signalerEchec)
      return
    }
    setUnits((list) =>
      // « En attente » et non « À jour » : le bail commence, la première
      // quittance n'est pas encore due. Marquer le locataire à jour d'un loyer
      // qu'il n'a pas payé fausserait les indicateurs d'encaissement.
      list.map((u) => (u.id === unitId ? { ...u, tenant: name, phone, status: 'pending' } : u)),
    )
  }, [parkId, signalerEchec])

  /**
   * Périmètre du locataire.
   *
   * En mode serveur il se DÉDUIT : l'API ne rend au locataire que les unités de
   * ses baux, donc tout ce qui est chargé lui appartient. Le client n'a plus à
   * connaître son unité — c'est le serveur qui l'a bornée, là où l'on ne peut
   * pas contourner la règle.
   */
  const tenantUnitIds = useMemo(
    () =>
      fromApi
        ? role === 'tenant'
          ? units.map((u) => u.id)
          : []
        : [DEMO_TENANT_UNIT],
    [fromApi, role, units],
  )

  const [readAlertIds, setReadAlertIds] = useState<string[]>([])
  const markAlertsRead = useCallback((ids: string[]) => {
    setReadAlertIds((current) => [...new Set([...current, ...ids])])
  }, [])

  const reset = useCallback(() => {
    const initial = resetState()
    // Le témoin suit, sinon l'effet verrait un écart entre l'état chargé et
    // l'état initial et réécrirait aussitôt l'enregistrement qu'on vient
    // d'effacer — le bouton n'aurait aucun effet visible.
    intact.current = initial
    setUnits(initial.units)
    setWorks(initial.works)
    setDeposits(initial.deposits)
    setReadAlertIds([])
    setStored(false)
  }, [])

  const value = useMemo<PortfolioContextValue>(
    () => ({
      units,
      works,
      deposits,
      approveWork,
      quoteWork,
      completeWork,
      reopenWork,
      unapproveWork,
      addInspection,
      addWork,
      unsettleDeposit,
      settleDeposit,
      addTenant,
      addBuilding,
      removeBuilding,
      remindRent,
      callRent,
      serveFormalNotice,
      addUnit,
      recordPayment,
      readAlertIds,
      markAlertsRead,
      reset,
      hasChanges: stored,
      fromApi,
      loading,
      buildings,
      buildingById: (id: string) => buildings.find((b) => b.id === id),
      readings,
      inspections,
      alerts,
      collections,
      readingForUnit: (unitId) => readings.find((r) => r.unitId === unitId),
      tenantUnitIds,
      isMine: (unitId: string) => tenantUnitIds.includes(unitId),
      worksForUnit: (unitId) => works.filter((w) => w.unitId === unitId),
      depositForUnit: (unitId) => deposits.find((d) => d.unitId === unitId),
      unitById: (unitId) => units.find((u) => u.id === unitId),
    }),
    /**
     * TOUT ce que la valeur expose figure ici.
     *
     * `buildings`, `readings`, `inspections`, `alerts`, `collections` et
     * `fromApi` en étaient absents alors que le contexte les rend. La valeur
     * n'était donc pas recalculée quand l'un d'eux changeait SEUL, et les
     * écrans gardaient l'ancienne liste.
     *
     * Le défaut est resté invisible parce qu'il ne se manifeste jamais au
     * chargement : celui-ci change huit états d'un coup, dont `units` qui était
     * listé — le mémo se recalculait alors et ramassait les autres au passage.
     * Il a fallu la première mutation ne touchant QU'À `buildings` — créer un
     * immeuble — pour qu'il se voie.
     *
     * Une dépendance manquante ne casse pas : elle attend. C'est ce qui la rend
     * coûteuse à trouver, et c'est pourquoi on les liste toutes plutôt que
     * celles qu'on croit utiles.
     */
    [
      units,
      works,
      deposits,
      buildings,
      readings,
      inspections,
      alerts,
      collections,
      fromApi,
      loading,
      approveWork,
      quoteWork,
      completeWork,
      reopenWork,
      unapproveWork,
      addInspection,
      addWork,
      unsettleDeposit,
      settleDeposit,
      addTenant,
      addBuilding,
      removeBuilding,
      remindRent,
      callRent,
      serveFormalNotice,
      addUnit,
      recordPayment,
      readAlertIds,
      markAlertsRead,
      reset,
      stored,
    ],
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('usePortfolio doit être utilisé dans un <PortfolioProvider>')
  return context
}
