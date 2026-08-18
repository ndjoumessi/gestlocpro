import { api } from '@/api/client'
import type { PaymentStatus } from '@/components/primitives/StatusPill'
import type {
  Alert,
  AlertData,
  AlertMessage,
  Deposit,
  Inspection,
  MeterReading,
  MonthlyCollection,
  TradeKey,
  Unit,
  UnitTypeKey,
  WorkOrder,
} from './portfolio'

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
      leaseId: string | null
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
  collections: { year: number; month: number; rent: number; water: number; power: number }[]
  readings: {
    unitId: string
    utility: 'water' | 'power'
    indexValue: number | null
    previousIndex: number | null
    readAt: string | null
  }[]
  inspections: {
    id: string
    unitId: string
    kind: 'entry' | 'exit'
    performedOn: string
    rooms: number
    issues: number
    signedAt: string | null
  }[]
  notifications: {
    id: string
    kind: Alert['kind']
    messageKey: AlertMessage
    params: AlertData
    severity: Alert['severity']
    unitId: string | null
    createdAt: string
    read: boolean
  }[]
  deposits: {
    id: string
    unitId: string
    tenant: string | null
    heldMinor: number
    withheldMinor: number
    status: Deposit['status']
    /** Ce que les réserves de sortie justifieraient de retenir. */
    billableMinor: number
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
  readings: MeterReading[]
  inspections: Inspection[]
  alerts: Alert[]
  collections: MonthlyCollection[]
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
        // La somme des versements réellement encaissés, calculée par le
        // serveur. Elle remplace la part simulée à 53 % du loyer.
        paid: u.paidMinor,
        status: u.status as PaymentStatus,
        ...(u.leaseId !== null ? { leaseId: u.leaseId } : {}),
        ...(u.tenant ? { tenantId: u.tenant.id } : {}),
        ...(u.overdueDays !== null ? { overdueDays: u.overdueDays } : {}),
      })
    }
  }

  return {
    buildings,
    units,
    works: data.works.map((w) => ({
      id: w.id,
      reference: w.reference,
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
      billable: d.billableMinor,
    })),
    /**
     * Les deux fluides du serveur se replient en UNE ligne d'écran.
     *
     * Le serveur rend une ligne par (unité, fluide), ce qui est la bonne forme
     * pour une base — un relevé d'eau et un relevé d'électricité sont deux
     * faits distincts, saisis séparément. L'écran, lui, montre une ligne par
     * unité avec ses deux colonnes. La conversion vit ici et nulle part
     * ailleurs.
     */
    readings: (() => {
      const parUnite = new Map<string, MeterReading>()
      for (const r of data.readings) {
        const ligne = parUnite.get(r.unitId) ?? {
          unitId: r.unitId,
          waterPrevious: 0,
          waterCurrent: null,
          powerPrevious: 0,
          powerCurrent: null,
          readAt: null,
        }
        if (r.utility === 'water') {
          ligne.waterPrevious = r.previousIndex ?? 0
          ligne.waterCurrent = r.indexValue
        } else {
          ligne.powerPrevious = r.previousIndex ?? 0
          ligne.powerCurrent = r.indexValue
        }
        if (r.readAt) ligne.readAt = enParties(r.readAt)
        parUnite.set(r.unitId, ligne)
      }
      return [...parUnite.values()]
    })(),
    inspections: data.inspections.map((i) => ({
      unitId: i.unitId,
      kind: i.kind,
      date: enParties(i.performedOn),
      rooms: i.rooms,
      issues: i.issues,
      // `signedAt` porte qui et quand ; l'écran n'affiche encore que le fait.
      signed: i.signedAt !== null,
    })),
    alerts: data.notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      message: n.messageKey,
      data: n.params,
      // L'horodatage relatif se CALCULE à l'affichage : le client stockait
      // `{ value: -2, unit: 'hour' }`, un décalage figé qui n'a jamais vieilli.
      at: relatif(new Date(n.createdAt)),
      severity: n.severity,
      read: n.read,
      ...(n.unitId ? { unitId: n.unitId } : {}),
    })),
    // Le serveur rend déjà la forme attendue : mois indexé à zéro et montants
    // entiers. Rien à convertir, ce qui est le signe que les deux modèles se
    // sont rapprochés.
    collections: data.collections,
    paidByUnit,
  }
}

/**
 * Décalage relatif depuis une date, en unités que `Intl.RelativeTimeFormat`
 * sait rendre. Le client portait ce décalage EN DUR dans la donnée : rouvrir
 * l'enregistrement le lendemain affichait encore « il y a 2 heures ».
 */
function relatif(quand: Date): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const secondes = (quand.getTime() - Date.now()) / 1000
  const heures = secondes / 3600
  if (Math.abs(heures) < 24) return { value: Math.round(heures), unit: 'hour' }
  return { value: Math.round(heures / 24), unit: 'day' }
}
