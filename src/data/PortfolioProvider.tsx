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
import { DEMO_TENANT_UNIT, type Deposit, type Unit, type WorkOrder } from './portfolio'
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
interface PortfolioContextValue {
  units: Unit[]
  works: WorkOrder[]
  deposits: Deposit[]
  /** Le propriétaire valide un devis proposé par le gestionnaire. */
  approveWork: (id: string) => void
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
    bail?: { startsOn?: string; rentMinor?: number },
  ) => void
  /** Crée un immeuble dans le parc. Sans parc serveur, il reste local. */
  addBuilding: (name: string, district: string) => void
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
  const { etat } = useSession()
  const parkId = etat.statut === 'connecte' ? (etat.adhesions[0]?.parkId ?? null) : null
  const role = etat.statut === 'connecte' ? (etat.adhesions[0]?.role ?? null) : null

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
  const [loading, setLoading] = useState(() => parkId !== null)
  /**
   * Le parc effectivement AFFICHÉ, une fois sa réponse arrivée.
   *
   * Une `ref` et non un état : personne ne rend cette valeur, elle ne sert qu'à
   * décider s'il faut rouvrir une attente. En faire un état provoquerait un
   * rendu de plus à chaque chargement, pour rien.
   */
  const parcAffiche = useRef<string | null>(null)
  const [buildings, setBuildings] = useState<Immeuble[]>(IMMEUBLES_DEMO)
  const [readings, setReadings] = useState<MeterReading[]>(READINGS_DEMO)
  const [inspections, setInspections] = useState<Inspection[]>(INSPECTIONS_DEMO)
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS_DEMO)
  const [collections, setCollections] = useState<MonthlyCollection[]>(COLLECTIONS_DEMO)

  useEffect(() => {
    if (!parkId) {
      // Rien en vol : les données locales sont déjà servies. Le cas se produit
      // vraiment — un compte qui quitte son dernier parc, ou une visite en
      // démonstration après une session connectée.
      setLoading(false)
      return
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
  }, [parkId, signalerEchec])

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
    bail?: { startsOn?: string; rentMinor?: number },
  ) => {
    if (parkId) {
      void api
        .addTenant(parkId, {
          unitId,
          fullName: name,
          phoneE164: phone.replace(/\s/g, ''),
          ...(bail?.startsOn ? { startsOn: bail.startsOn } : {}),
          ...(bail?.rentMinor !== undefined ? { rentMinor: bail.rentMinor } : {}),
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
      settleDeposit,
      addTenant,
      addBuilding,
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
      settleDeposit,
      addTenant,
      addBuilding,
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
