import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEPOSITS, WORKS, type Deposit, type WorkOrder } from './portfolio'

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
 * `AppShell`, pour que l'état survive à la navigation.
 */
interface PortfolioContextValue {
  works: WorkOrder[]
  deposits: Deposit[]
  /** Le propriétaire valide un devis proposé par le gestionnaire. */
  approveWork: (id: string) => void
  /** Le propriétaire arbitre une caution : retenue et restitution du solde. */
  settleDeposit: (unitId: string, withheld: number) => void
  worksForUnit: (unitId: string) => WorkOrder[]
  depositForUnit: (unitId: string) => Deposit | undefined
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [works, setWorks] = useState<WorkOrder[]>(WORKS)
  const [deposits, setDeposits] = useState<Deposit[]>(DEPOSITS)

  const approveWork = useCallback((id: string) => {
    setWorks((list) => list.map((w) => (w.id === id ? { ...w, status: 'approved' } : w)))
  }, [])

  const settleDeposit = useCallback((unitId: string, withheld: number) => {
    setDeposits((list) =>
      list.map((d) => (d.unitId === unitId ? { ...d, withheld, status: 'returned' } : d)),
    )
  }, [])

  const value = useMemo<PortfolioContextValue>(
    () => ({
      works,
      deposits,
      approveWork,
      settleDeposit,
      worksForUnit: (unitId) => works.filter((w) => w.unitId === unitId),
      depositForUnit: (unitId) => deposits.find((d) => d.unitId === unitId),
    }),
    [works, deposits, approveWork, settleDeposit],
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('usePortfolio doit être utilisé dans un <PortfolioProvider>')
  return context
}
