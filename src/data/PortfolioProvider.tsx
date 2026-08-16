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
import { type Deposit, type Unit, type WorkOrder } from './portfolio'
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
  settleDeposit: (unitId: string, withheld: number) => void
  /** Rattache un locataire à une unité vacante. Le bail démarre « en attente ». */
  addTenant: (unitId: string, name: string, phone: string) => void
  /** Efface le parcours enregistré et remet le jeu de démonstration. */
  reset: () => void
  /** `true` si un parcours a été enregistré, donc s'il y a quelque chose à effacer. */
  hasChanges: boolean
  worksForUnit: (unitId: string) => WorkOrder[]
  depositForUnit: (unitId: string) => Deposit | undefined
  unitById: (unitId: string) => Unit | undefined
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const initial = loadState()
  const [units, setUnits] = useState<Unit[]>(initial.units)
  const [works, setWorks] = useState<WorkOrder[]>(initial.works)
  const [deposits, setDeposits] = useState<Deposit[]>(initial.deposits)
  const [stored, setStored] = useState(hasStoredState)

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

  const approveWork = useCallback((id: string) => {
    setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'approved' } : w)))
  }, [])

  const settleDeposit = useCallback((unitId: string, withheld: number) => {
    setDeposits((list) =>
      list.map((d) => (d.unitId === unitId ? { ...d, withheld, status: 'returned' } : d)),
    )
  }, [])

  const addTenant = useCallback((unitId: string, name: string, phone: string) => {
    setUnits((list) =>
      // « En attente » et non « À jour » : le bail commence, la première
      // quittance n'est pas encore due. Marquer le locataire à jour d'un loyer
      // qu'il n'a pas payé fausserait les indicateurs d'encaissement.
      list.map((u) => (u.id === unitId ? { ...u, tenant: name, phone, status: 'pending' } : u)),
    )
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
      reset,
      hasChanges: stored,
      worksForUnit: (unitId) => works.filter((w) => w.unitId === unitId),
      depositForUnit: (unitId) => deposits.find((d) => d.unitId === unitId),
      unitById: (unitId) => units.find((u) => u.id === unitId),
    }),
    [units, works, deposits, approveWork, settleDeposit, addTenant, reset, stored],
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('usePortfolio doit être utilisé dans un <PortfolioProvider>')
  return context
}
