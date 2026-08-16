import { api } from '@/api/client'
import type { PaymentStatus } from '@/components/primitives/StatusPill'
import type { Deposit, TradeKey, Unit, UnitTypeKey, WorkOrder } from './portfolio'

/**
 * Traduction entre la forme du serveur et celle des écrans.
 *
 * Les deux ne coïncident pas, et c'est voulu : le serveur porte le modèle réel
 * — bail, échéance, versements — quand les écrans veulent une unité et son état
 * courant. Cette couche est le seul endroit où le second se calcule à partir du
 * premier ; ailleurs, il se recalculerait douze fois, différemment.
 *
 * Elle est **provisoire par nature**. À mesure que les écrans apprendront à
 * parler de baux et d'échéances, elle rétrécira. Elle ne doit pas grossir : une
 * couche d'adaptation qui s'épaissit finit par devenir le modèle, sans que
 * personne n'ait décidé qu'elle le serait.
 */

/** Réponse de `GET /api/parks/:id/portfolio`. */
interface PortefeuilleApi {
  buildings: {
    id: string
    name: string
    district: string
    units: {
      id: string
      label: string
      type: UnitTypeKey
      surfaceSqm: number
      rentMinor: number
      tenant: { id: string; fullName: string; phoneE164: string | null } | null
      status: string
      paidMinor: number
      overdueDays: number | null
    }[]
  }[]
  works: {
    id: string
    reference: string
    unitId: string
    title: string
    trade: TradeKey
    status: WorkOrder['status']
    urgency: 'blocking' | 'normal' | 'low'
    quotedAmountMinor: number | null
    approvedAmountMinor: number | null
    reportedAt: string
  }[]
  deposits: {
    id: string
    unitId: string
    tenant: string | null
    heldMinor: number
    withheldMinor: number
    status: Deposit['status']
  }[]
}

export interface Immeuble {
  id: string
  name: string
  district: string
}

export interface ParcCharge {
  buildings: Immeuble[]
  units: Unit[]
  works: WorkOrder[]
  deposits: Deposit[]
  /**
   * Versement réellement encaissé, par unité.
   *
   * Remplace `paidShare()`, qui déduisait la part réglée du statut — 53 % du
   * loyer pour un règlement partiel. L'écran affichait ainsi 39 750 pour A5
   * pendant qu'une alerte annonçait 40 000 : deux chiffres pour un seul fait.
   */
  paidByUnit: Record<string, number>
}

/** Date ISO vers `DateParts`, dont le mois est indexé à zéro. */
function enParties(iso: string) {
  const d = new Date(iso)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

export async function chargerParc(parkId: string): Promise<ParcCharge> {
  const data = await api.portfolio<PortefeuilleApi>(parkId)

  const buildings: Immeuble[] = []
  const units: Unit[] = []
  const paidByUnit: Record<string, number> = {}

  for (const b of data.buildings) {
    buildings.push({ id: b.id, name: b.name, district: b.district })
    for (const u of b.units) {
      paidByUnit[u.id] = u.paidMinor
      units.push({
        // L'identifiant est celui du serveur, le libellé reste « A1 ».
        // Les confondre marcherait tant qu'aucun immeuble ne réutilise un
        // numéro d'unité — ce que rien ne garantit hors démonstration.
        id: u.id,
        buildingId: b.id,
        label: u.label,
        type: u.type,
        surface: u.surfaceSqm,
        rent: u.rentMinor,
        tenant: u.tenant?.fullName ?? null,
        phone: u.tenant?.phoneE164 ?? null,
        status: u.status as PaymentStatus,
        ...(u.overdueDays !== null ? { overdueDays: u.overdueDays } : {}),
      })
    }
  }

  return {
    buildings,
    units,
    works: data.works.map((w) => ({
      id: w.id,
      unitId: w.unitId,
      // Un intitulé libre, écrit par qui signale : pas de clé de traduction ici
      // — traduire la saisie de quelqu'un est toujours faux.
      title: w.title,
      trade: w.trade,
      status: w.status,
      amount: w.approvedAmountMinor ?? w.quotedAmountMinor,
      reportedAt: enParties(w.reportedAt),
      urgent: w.urgency === 'blocking',
    })),
    deposits: data.deposits.map((d) => ({
      id: d.id,
      unitId: d.unitId,
      tenant: d.tenant,
      held: d.heldMinor,
      withheld: d.withheldMinor,
      status: d.status,
    })),
    paidByUnit,
  }
}
