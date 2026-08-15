import type { PaymentStatus } from '@/components/primitives/StatusPill'

/**
 * Jeu de démonstration, repris du parc de la maquette : 3 immeubles,
 * 12 unités, 12 mois d'historique.
 *
 * Les montants sont exprimés dans une unité neutre : ils s'affichent tels
 * quels dans la devise choisie, sans conversion — voir `currency/currencies`.
 */

export interface Building {
  id: string
  name: string
  district: string
  units: number
  occupied: number
}

export const BUILDINGS: Building[] = [
  { id: 'bon', name: 'Résidence Bonamoussadi', district: 'Bonamoussadi', units: 5, occupied: 5 },
  { id: 'akw', name: 'Immeuble Akwa Nord', district: 'Akwa', units: 4, occupied: 3 },
  { id: 'des', name: 'Villa Deïdo', district: 'Deïdo', units: 3, occupied: 2 },
]

export interface Unit {
  id: string
  buildingId: string
  label: string
  type: string
  surface: number
  rent: number
  tenant: string | null
  status: PaymentStatus
  /** Jours de retard, si le statut l'est. */
  overdueDays?: number
}

export const UNITS: Unit[] = [
  { id: 'A1', buildingId: 'bon', label: 'A1', type: 'T3', surface: 78, rent: 145000, tenant: 'Charles Ngassa', status: 'paid' },
  { id: 'A2', buildingId: 'bon', label: 'A2', type: 'T2', surface: 54, rent: 110000, tenant: 'Mireille Fotso', status: 'paid' },
  { id: 'A3', buildingId: 'bon', label: 'A3', type: 'T2', surface: 56, rent: 115000, tenant: 'Serge Mbarga', status: 'overdue', overdueDays: 24 },
  { id: 'A4', buildingId: 'bon', label: 'A4', type: 'T4', surface: 96, rent: 180000, tenant: 'Famille Owona', status: 'paid' },
  { id: 'A5', buildingId: 'bon', label: 'A5', type: 'T1', surface: 38, rent: 75000, tenant: 'Aline Tchoumi', status: 'partial' },

  { id: 'B1', buildingId: 'akw', label: 'B1', type: 'T3', surface: 82, rent: 160000, tenant: 'Jean-Paul Eboa', status: 'paid' },
  { id: 'B2', buildingId: 'akw', label: 'B2', type: 'T3', surface: 80, rent: 155000, tenant: 'Nadia Belinga', status: 'overdue', overdueDays: 9 },
  { id: 'B3', buildingId: 'akw', label: 'B3', type: 'T2', surface: 58, rent: 120000, tenant: 'Éric Ndongo', status: 'paid' },
  { id: 'B4', buildingId: 'akw', label: 'B4', type: 'T2', surface: 57, rent: 118000, tenant: null, status: 'vacant' },

  { id: 'C1', buildingId: 'des', label: 'C1', type: 'T4', surface: 104, rent: 195000, tenant: 'Cabinet Njoya', status: 'paid' },
  { id: 'C2', buildingId: 'des', label: 'C2', type: 'T3', surface: 76, rent: 142000, tenant: 'Sylvie Manga', status: 'overdue', overdueDays: 3 },
  { id: 'C3', buildingId: 'des', label: 'C3', type: 'T2', surface: 60, rent: 125000, tenant: null, status: 'vacant' },
]

/**
 * Encaissements des 12 derniers mois, ventilés loyer / eau / électricité.
 * Les abréviations d'axe se calculent à l'affichage — voir `lib/dates`.
 */
export interface MonthlyCollection {
  year: number
  /** 0 = janvier. */
  month: number
  rent: number
  water: number
  power: number
}

export const COLLECTIONS: MonthlyCollection[] = [
  { year: 2025, month: 8, rent: 1010000, water: 62000, power: 48000 },
  { year: 2025, month: 9, rent: 1085000, water: 58000, power: 51000 },
  { year: 2025, month: 10, rent: 1040000, water: 61000, power: 46000 },
  { year: 2025, month: 11, rent: 1120000, water: 66000, power: 58000 },
  { year: 2026, month: 0, rent: 1150000, water: 71000, power: 62000 },
  { year: 2026, month: 1, rent: 1095000, water: 64000, power: 54000 },
  { year: 2026, month: 2, rent: 1180000, water: 69000, power: 57000 },
  { year: 2026, month: 3, rent: 1240000, water: 74000, power: 61000 },
  { year: 2026, month: 4, rent: 1205000, water: 70000, power: 59000 },
  { year: 2026, month: 5, rent: 1290000, water: 78000, power: 66000 },
  { year: 2026, month: 6, rent: 1250000, water: 72000, power: 63000 },
  { year: 2026, month: 7, rent: 1040000, water: 68000, power: 55000 },
]

export const KPIS = {
  expected: 1415000,
  collected: 1040000,
  outstanding: 375000,
  expectedDelta: 165000,
  outstandingDelta: 95000,
  occupancyDelta: -8,
  partial: 155000,
  late: 220000,
  waterRebilled: 88,
  powerRebilled: 64,
}

/**
 * Date en valeurs machine. Les libellés se calculent à l'affichage selon la
 * langue de l'interface — voir `lib/dates`. Stocker « 12/08 » figeait le format
 * français jusque dans l'interface anglaise.
 */
export interface DateParts {
  year: number
  /** 0 = janvier. */
  month: number
  day: number
}

/** Relevés de compteurs du mois. */
export interface MeterReading {
  unitId: string
  waterPrevious: number
  waterCurrent: number | null
  powerPrevious: number
  powerCurrent: number | null
  readAt: DateParts | null
}

export const READINGS: MeterReading[] = [
  { unitId: 'A1', waterPrevious: 342, waterCurrent: 358, powerPrevious: 4120, powerCurrent: 4298, readAt: { year: 2026, month: 7, day: 20 } },
  { unitId: 'A2', waterPrevious: 289, waterCurrent: 301, powerPrevious: 3540, powerCurrent: 3671, readAt: { year: 2026, month: 7, day: 20 } },
  { unitId: 'A3', waterPrevious: 415, waterCurrent: 436, powerPrevious: 5210, powerCurrent: 5402, readAt: { year: 2026, month: 7, day: 20 } },
  { unitId: 'A4', waterPrevious: 502, waterCurrent: 529, powerPrevious: 6180, powerCurrent: 6455, readAt: { year: 2026, month: 7, day: 20 } },
  { unitId: 'A5', waterPrevious: 176, waterCurrent: null, powerPrevious: 2140, powerCurrent: null, readAt: null },
  { unitId: 'B1', waterPrevious: 388, waterCurrent: 402, powerPrevious: 4870, powerCurrent: 5033, readAt: { year: 2026, month: 7, day: 19 } },
  { unitId: 'B2', waterPrevious: 356, waterCurrent: 371, powerPrevious: 4405, powerCurrent: 4560, readAt: { year: 2026, month: 7, day: 19 } },
  { unitId: 'B3', waterPrevious: 271, waterCurrent: 284, powerPrevious: 3290, powerCurrent: 3418, readAt: { year: 2026, month: 7, day: 19 } },
  { unitId: 'C1', waterPrevious: 611, waterCurrent: 644, powerPrevious: 7320, powerCurrent: 7640, readAt: { year: 2026, month: 7, day: 18 } },
  { unitId: 'C2', waterPrevious: 334, waterCurrent: null, powerPrevious: 4010, powerCurrent: null, readAt: null },
]

/** Tarifs unitaires de refacturation des charges. */
export const UTILITY_RATES = { water: 520, power: 99 }

export interface WorkOrder {
  id: string
  unitId: string
  title: string
  trade: string
  status: 'reported' | 'quoted' | 'approved' | 'done'
  amount: number | null
  reportedAt: DateParts
  urgent: boolean
}

export const WORKS: WorkOrder[] = [
  { id: 'SIG-2026-042', unitId: 'A3', title: 'Fuite sous l’évier de la cuisine', trade: 'Plomberie', status: 'quoted', amount: 45000, reportedAt: { year: 2026, month: 7, day: 12 }, urgent: true },
  { id: 'SIG-2026-041', unitId: 'B2', title: 'Disjoncteur qui saute au démarrage du chauffe-eau', trade: 'Électricité', status: 'approved', amount: 78000, reportedAt: { year: 2026, month: 7, day: 9 }, urgent: true },
  { id: 'SIG-2026-039', unitId: 'C1', title: 'Peinture du séjour à reprendre', trade: 'Peinture', status: 'reported', amount: null, reportedAt: { year: 2026, month: 7, day: 5 }, urgent: false },
  { id: 'SIG-2026-036', unitId: 'A1', title: 'Remplacement du groupe de sécurité', trade: 'Plomberie', status: 'done', amount: 32000, reportedAt: { year: 2026, month: 6, day: 28 }, urgent: false },
  { id: 'SIG-2026-034', unitId: 'B4', title: 'Réfection complète avant relocation', trade: 'Multi-corps', status: 'approved', amount: 340000, reportedAt: { year: 2026, month: 6, day: 22 }, urgent: false },
]

export interface Deposit {
  unitId: string
  tenant: string
  held: number
  withheld: number
  status: 'held' | 'settling' | 'returned'
}

export const DEPOSITS: Deposit[] = [
  { unitId: 'A1', tenant: 'Charles Ngassa', held: 290000, withheld: 0, status: 'held' },
  { unitId: 'A2', tenant: 'Mireille Fotso', held: 220000, withheld: 0, status: 'held' },
  { unitId: 'A3', tenant: 'Serge Mbarga', held: 230000, withheld: 45000, status: 'settling' },
  { unitId: 'B4', tenant: 'Ancien locataire', held: 236000, withheld: 118000, status: 'settling' },
  { unitId: 'C3', tenant: 'Ancien locataire', held: 250000, withheld: 0, status: 'returned' },
]

export interface Inspection {
  unitId: string
  kind: 'entry' | 'exit'
  date: DateParts
  rooms: number
  issues: number
  signed: boolean
}

export const INSPECTIONS: Inspection[] = [
  { unitId: 'B4', kind: 'exit', date: { year: 2026, month: 6, day: 22 }, rooms: 4, issues: 6, signed: true },
  { unitId: 'B4', kind: 'entry', date: { year: 2024, month: 8, day: 1 }, rooms: 4, issues: 1, signed: true },
  { unitId: 'C3', kind: 'exit', date: { year: 2026, month: 5, day: 30 }, rooms: 3, issues: 2, signed: true },
  { unitId: 'A4', kind: 'entry', date: { year: 2026, month: 2, day: 15 }, rooms: 5, issues: 0, signed: true },
  { unitId: 'A5', kind: 'entry', date: { year: 2026, month: 1, day: 2 }, rooms: 2, issues: 1, signed: false },
]

/** Horodatage relatif en valeurs machine, rendu par `formatRelative`. */
export interface RelativeStamp {
  value: number
  unit: Intl.RelativeTimeFormatUnit
}

export interface Alert {
  id: string
  kind: 'payment' | 'work' | 'meter' | 'lease'
  title: string
  detail: string
  at: RelativeStamp
  severity: 'high' | 'medium' | 'low'
  read: boolean
  /** Unité concernée. Sert au filtrage par rôle. */
  unitId?: string
}

export const ALERTS: Alert[] = [
  { id: 'n1', kind: 'payment', title: 'Loyer A3 en retard de 24 jours', detail: 'Serge Mbarga · relance J+15 partie le 04/08', at: { value: -2, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3' },
  { id: 'n2', kind: 'work', title: 'Devis plomberie à arbitrer', detail: 'SIG-2026-042 · A3 · 45 000 proposés par le gestionnaire', at: { value: -5, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3' },
  { id: 'n3', kind: 'meter', title: '2 relevés manquants pour août', detail: 'A5 et C2 · à saisir avant la facturation', at: { value: -1, unit: 'day' }, severity: 'medium', read: true },
  { id: 'n4', kind: 'lease', title: 'Bail B1 à renouveler dans 45 jours', detail: 'Jean-Paul Eboa · échéance au 30/09/2026', at: { value: -2, unit: 'day' }, severity: 'low', read: true, unitId: 'B1' },
  { id: 'n5', kind: 'payment', title: 'Règlement partiel enregistré sur A5', detail: 'Aline Tchoumi · 40 000 sur 75 000', at: { value: -3, unit: 'day' }, severity: 'medium', read: true, unitId: 'A5' },
  { id: 'n6', kind: 'work', title: 'Groupe de sécurité remplacé', detail: 'SIG-2026-036 · A1 · intervention terminée le 28/07', at: { value: -5, unit: 'day' }, severity: 'low', read: true, unitId: 'A1' },
  { id: 'n7', kind: 'payment', title: 'Quittance d’août disponible', detail: 'A1 · règlement de 145 000 enregistré', at: { value: -6, unit: 'day' }, severity: 'low', read: true, unitId: 'A1' },
]

/**
 * Locataire connecté dans la démonstration — le « Charles N. » du sélecteur de
 * profil de la maquette. Tant qu'il n'y a pas d'authentification, cette
 * constante tient lieu de session : c'est elle qui borne ce que le rôle
 * locataire a le droit de voir.
 */
export const CURRENT_TENANT_UNIT = 'A1'

/* Les sélecteurs sur les travaux et les cautions vivent dans
   `PortfolioProvider` et non ici : ces deux collections sont modifiables, et
   deux fonctions homonymes — l'une lisant la constante figée, l'autre l'état
   partagé — auraient fini par être confondues. Les collections ci-dessous ne
   changent pas, elles restent servies depuis le module. */

export function inspectionsForUnit(unitId: string): Inspection[] {
  return INSPECTIONS.filter((inspection) => inspection.unitId === unitId)
}

export function readingForUnit(unitId: string): MeterReading | undefined {
  return READINGS.find((reading) => reading.unitId === unitId)
}

export function alertsForUnit(unitId: string): Alert[] {
  return ALERTS.filter((alert) => alert.unitId === unitId)
}

/**
 * Historique de quittances simulé pour l'espace locataire.
 *
 * Les périodes sont stockées en valeurs machine — année et index de mois — et
 * non en chaînes : un nom de mois est du formatage, pas du contenu, et doit
 * suivre la langue de l'interface. Voir `lib/dates`.
 */
export interface Receipt {
  year: number
  /** 0 = janvier. */
  month: number
  paidDay: number
  status: PaymentStatus
}

export const TENANT_RECEIPTS: Receipt[] = [
  { year: 2026, month: 7, paidDay: 3, status: 'paid' },
  { year: 2026, month: 6, paidDay: 2, status: 'paid' },
  { year: 2026, month: 5, paidDay: 5, status: 'paid' },
  { year: 2026, month: 4, paidDay: 4, status: 'paid' },
  { year: 2026, month: 3, paidDay: 2, status: 'paid' },
  { year: 2026, month: 2, paidDay: 6, status: 'paid' },
]

export function unitById(id: string): Unit | undefined {
  return UNITS.find((unit) => unit.id === id)
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((building) => building.id === id)
}
