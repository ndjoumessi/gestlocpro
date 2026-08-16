import type { PaymentStatus } from '@/components/primitives/StatusPill'

/**
 * Jeu de démonstration : 3 immeubles, 12 unités, 12 mois d'historique.
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

/**
 * Typologie du logement, en clé et non en clair.
 *
 * « T3 » n'est pas un mot français, mais c'est une **notation française** : elle
 * compte les pièces principales, séjour compris, et ne dit rien à un lecteur
 * anglophone — le marché anglo-saxon compte les chambres, un T3 s'y annonce
 * « 2-bed ». Le champ était un `string` libre affiché tel quel sur six écrans.
 *
 * Les valeurs `T1`…`T4` sont conservées à l'identique : ce sont déjà des clés,
 * elles n'étaient simplement pas traitées comme telles. Un enregistrement de
 * `localStorage` antérieur reste donc valide, et `VERSION` n'a pas à bouger —
 * contrairement au corps de métier, dont les valeurs, elles, changeaient.
 */
export type UnitTypeKey = 'T1' | 'T2' | 'T3' | 'T4'

export interface Unit {
  id: string
  buildingId: string
  label: string
  type: UnitTypeKey
  surface: number
  rent: number
  tenant: string | null
  /**
   * Téléphone du locataire, indicatif compris. `null` quand l'unité est vacante.
   *
   * Le formulaire de création réclamait ce numéro en promettant d'y envoyer le
   * code d'invitation, puis le jetait : `addTenant` ne recevait que le nom, et
   * rien dans le modèle ne pouvait l'accueillir. On demandait une donnée pour
   * ne rien en faire, ce qui est pire que de ne pas la demander.
   */
  phone: string | null
  /**
   * Part réellement encaissée sur l'échéance courante, en unité neutre.
   *
   * L'écran Paiements la SIMULAIT — 53 % du loyer pour un règlement partiel —
   * pendant qu'une alerte annonçait 40 000 pour le même versement d'Aline
   * Tchoumi. Deux chiffres pour un seul fait, parce que le fait n'existait
   * nulle part. Côté serveur c'est la somme des versements ; ici c'est la
   * valeur, écrite une fois.
   */
  paid: number
  status: PaymentStatus
  /** Jours de retard, si le statut l'est. */
  overdueDays?: number
}

export const UNITS: Unit[] = [
  { id: 'A1', buildingId: 'bon', label: 'A1', type: 'T3', surface: 78, rent: 145000, tenant: 'Charles Ngassa', phone: '+237 6 77 21 44 08', paid: 145000, status: 'paid' },
  { id: 'A2', buildingId: 'bon', label: 'A2', type: 'T2', surface: 54, rent: 110000, tenant: 'Mireille Fotso', phone: '+237 6 99 03 51 72', paid: 110000, status: 'paid' },
  { id: 'A3', buildingId: 'bon', label: 'A3', type: 'T2', surface: 56, rent: 115000, tenant: 'Serge Mbarga', phone: '+237 6 55 84 20 31', paid: 0, status: 'overdue', overdueDays: 24 },
  { id: 'A4', buildingId: 'bon', label: 'A4', type: 'T4', surface: 96, rent: 180000, tenant: 'Famille Owona', phone: '+237 6 70 12 96 45', paid: 180000, status: 'paid' },
  { id: 'A5', buildingId: 'bon', label: 'A5', type: 'T1', surface: 38, rent: 75000, tenant: 'Aline Tchoumi', phone: '+237 6 94 37 08 12', paid: 40000, status: 'partial' },

  { id: 'B1', buildingId: 'akw', label: 'B1', type: 'T3', surface: 82, rent: 160000, tenant: 'Jean-Paul Eboa', phone: '+237 6 78 45 11 90', paid: 160000, status: 'paid' },
  { id: 'B2', buildingId: 'akw', label: 'B2', type: 'T3', surface: 80, rent: 155000, tenant: 'Nadia Belinga', phone: '+237 6 51 60 73 24', paid: 0, status: 'overdue', overdueDays: 9 },
  { id: 'B3', buildingId: 'akw', label: 'B3', type: 'T2', surface: 58, rent: 120000, tenant: 'Éric Ndongo', phone: '+237 6 96 82 30 57', paid: 120000, status: 'paid' },
  { id: 'B4', buildingId: 'akw', label: 'B4', type: 'T2', surface: 57, rent: 118000, tenant: null, phone: null, paid: 0, status: 'vacant' },

  { id: 'C1', buildingId: 'des', label: 'C1', type: 'T4', surface: 104, rent: 195000, tenant: 'Cabinet Njoya', phone: '+237 6 73 55 41 86', paid: 195000, status: 'paid' },
  { id: 'C2', buildingId: 'des', label: 'C2', type: 'T3', surface: 76, rent: 142000, tenant: 'Sylvie Manga', phone: '+237 6 82 19 64 03', paid: 0, status: 'overdue', overdueDays: 3 },
  { id: 'C3', buildingId: 'des', label: 'C3', type: 'T2', surface: 60, rent: 125000, tenant: null, phone: null, paid: 0, status: 'vacant' },
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

/** Vocabulaire des corps de métier, partagé avec les signalements du portail. */
export type TradeKey = 'plumbing' | 'power' | 'painting' | 'multi' | 'lock' | 'other'

/**
 * Intitulés des signalements du jeu de démonstration.
 *
 * **Ce n'est pas une exception à la règle sur la saisie utilisateur, c'est une
 * distinction de nature.** Dans le produit réel, l'intitulé d'un signalement
 * est écrit par le locataire : il ne se traduit pas, au même titre que « Serge
 * Mbarga » ou « Résidence Bonamoussadi ». Traduire la saisie de quelqu'un est
 * toujours faux.
 *
 * Mais ces cinq lignes ne sont la saisie de personne : c'est du contenu
 * d'exemple, écrit par le produit pour se démontrer. Sa raison d'être est
 * d'illustrer l'écran, donc il suit la langue de celui qui regarde — sans quoi
 * la démonstration anglaise montre du français, et l'inverse si on les écrit
 * en anglais.
 *
 * Le champ reste donc typé comme une clé **tant que les données sont un jeu de
 * démonstration**. Le jour où un formulaire crée de vrais signalements, il
 * redeviendra une chaîne libre, et ce sera correct.
 */
export type WorkTitleKey =
  | 'sinkLeak'
  | 'waterHeaterBreaker'
  | 'livingRoomPaint'
  | 'safetyValve'
  | 'fullRefurbishment'

export interface WorkOrder {
  id: string
  unitId: string
  /**
   * Intitulé du jeu de démonstration, en clé — voir `WorkTitleKey`.
   *
   * Absent dès que la donnée vient du serveur : elle porte alors un `title`
   * écrit par le locataire, et une saisie ne se traduit pas.
   */
  titleKey?: WorkTitleKey
  /**
   * Intitulé libre, tel que saisi.
   *
   * Les deux champs coexistent parce que les deux natures coexistent, et c'est
   * la seule façon honnête de le dire : un jeu de démonstration servi en deux
   * langues a besoin d'une clé, une saisie d'utilisateur n'en a pas. Les écrans
   * rendent `title` s'il existe, sinon la clé traduite — jamais l'inverse, et
   * jamais les deux.
   */
  title?: string
  /**
   * Corps de métier, en clé et non en clair.
   *
   * C'était une chaîne libre — « Plomberie », « Électricité » — donc du
   * français figé dans la donnée, qui s'affichait tel quel dans l'interface
   * anglaise. Un corps de métier n'est pas un nom propre comme « Serge
   * Mbarga » ou « Résidence Bonamoussadi » : c'est un vocabulaire fermé que le
   * produit définit, donc il se traduit.
   */
  trade: TradeKey
  status: 'reported' | 'quoted' | 'approved' | 'done'
  amount: number | null
  reportedAt: DateParts
  urgent: boolean
}

export const WORKS: WorkOrder[] = [
  { id: 'SIG-2026-042', unitId: 'A3', titleKey: 'sinkLeak', trade: 'plumbing', status: 'quoted', amount: 45000, reportedAt: { year: 2026, month: 7, day: 12 }, urgent: true },
  { id: 'SIG-2026-041', unitId: 'B2', titleKey: 'waterHeaterBreaker', trade: 'power', status: 'approved', amount: 78000, reportedAt: { year: 2026, month: 7, day: 9 }, urgent: true },
  { id: 'SIG-2026-039', unitId: 'C1', titleKey: 'livingRoomPaint', trade: 'painting', status: 'reported', amount: null, reportedAt: { year: 2026, month: 7, day: 5 }, urgent: false },
  { id: 'SIG-2026-036', unitId: 'A1', titleKey: 'safetyValve', trade: 'plumbing', status: 'done', amount: 32000, reportedAt: { year: 2026, month: 6, day: 28 }, urgent: false },
  { id: 'SIG-2026-034', unitId: 'B4', titleKey: 'fullRefurbishment', trade: 'multi', status: 'approved', amount: 340000, reportedAt: { year: 2026, month: 6, day: 22 }, urgent: false },
]

export interface Deposit {
  /**
   * Identifiant serveur, absent du jeu de démonstration.
   *
   * Une caution est clé par **bail** côté serveur, et non par unité : celle du
   * locataire suivant écraserait sinon celle de l'ancien, retenue et solde
   * compris. Le client la désigne encore par son unité, ce qui suffit tant
   * qu'une unité n'a qu'un bail — mais l'arbitrage a besoin de la vraie clé.
   */
  id?: string
  unitId: string
  /**
   * `null` quand le locataire est parti.
   *
   * Le champ portait « Ancien locataire » en clair, donc du français figé dans
   * la donnée — et surtout deux natures dans un seul champ : un nom propre pour
   * les uns, un libellé de produit pour les autres. `null` dit ce qui est
   * réellement le cas — aucune personne rattachée — et laisse l'interface le
   * nommer dans sa langue.
   */
  tenant: string | null
  held: number
  withheld: number
  status: 'held' | 'settling' | 'returned'
}

export const DEPOSITS: Deposit[] = [
  { unitId: 'A1', tenant: 'Charles Ngassa', held: 290000, withheld: 0, status: 'held' },
  { unitId: 'A2', tenant: 'Mireille Fotso', held: 220000, withheld: 0, status: 'held' },
  { unitId: 'A3', tenant: 'Serge Mbarga', held: 230000, withheld: 45000, status: 'settling' },
  { unitId: 'B4', tenant: null, held: 236000, withheld: 118000, status: 'settling' },
  { unitId: 'C3', tenant: null, held: 250000, withheld: 0, status: 'returned' },
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
  // A1 est l'unité du locataire connecté : sans état des lieux la rubrique
  // affichait toujours son état vide en rôle locataire, et la fonctionnalité
  // restait invisible à qui la regardait depuis ce profil.
  { unitId: 'A1', kind: 'entry', date: { year: 2024, month: 5, day: 15 }, rooms: 4, issues: 2, signed: true },
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

/**
 * Message d'une alerte, en clé et non en clair.
 *
 * `title` et `detail` étaient des phrases françaises complètes — « Devis
 * plomberie à arbitrer », « Serge Mbarga · relance J+15 partie le 04/08 ». Ce
 * ne sont ni des noms propres ni de la saisie utilisateur : ce sont des
 * messages que le produit compose, donc ils se traduisent.
 *
 * Chaque phrase cumulait d'ailleurs trois défauts figés d'un coup : une date au
 * format numérique que `lib/dates` proscrit — « 04/08 » est le 4 août ici et le
 * 8 avril ailleurs —, un montant sans devise ni groupement, et un pluriel
 * concaténé à la main.
 */
export type AlertMessage =
  | 'rentOverdue'
  | 'quotePending'
  | 'metersMissing'
  | 'leaseRenewal'
  | 'partialPayment'
  | 'workDone'
  | 'receiptAvailable'

/**
 * Valeurs d'une alerte, en données brutes.
 *
 * Rien n'est pré-formaté : les montants sont des nombres, les dates des
 * `DateParts`, les décomptes des entiers. C'est l'écran qui les rend, avec la
 * devise et la langue du moment — une chaîne pré-formatée dans la donnée serait
 * à nouveau du français figé, une couche plus bas.
 */
export interface AlertData {
  tenant?: string
  unitId?: string
  workId?: string
  /** Sert aussi d'accord en nombre : voir la convention `_one` / `_other`. */
  count?: number
  amount?: number
  total?: number
  /** Rendue en jour et mois abrégé. */
  on?: DateParts
  /** Rendue en date complète, année comprise. */
  dueOn?: DateParts
  /** Période mensuelle, rendue « août 2026 » / « August 2026 ». */
  period?: Pick<DateParts, 'year' | 'month'>
  /** Unités concernées, énumérées par `Intl.ListFormat`. */
  units?: string[]
}

export interface Alert {
  id: string
  kind: 'payment' | 'work' | 'meter' | 'lease'
  message: AlertMessage
  data: AlertData
  at: RelativeStamp
  severity: 'high' | 'medium' | 'low'
  read: boolean
  /** Unité concernée. Sert au filtrage par rôle. */
  unitId?: string
}

export const ALERTS: Alert[] = [
  { id: 'n1', kind: 'payment', message: 'rentOverdue', data: { unitId: 'A3', tenant: 'Serge Mbarga', count: 24, on: { year: 2026, month: 7, day: 4 } }, at: { value: -2, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3' },
  { id: 'n2', kind: 'work', message: 'quotePending', data: { workId: 'SIG-2026-042', unitId: 'A3', amount: 45000 }, at: { value: -5, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3' },
  { id: 'n3', kind: 'meter', message: 'metersMissing', data: { count: 2, period: { year: 2026, month: 7 }, units: ['A5', 'C2'] }, at: { value: -1, unit: 'day' }, severity: 'medium', read: true },
  { id: 'n4', kind: 'lease', message: 'leaseRenewal', data: { unitId: 'B1', tenant: 'Jean-Paul Eboa', count: 45, dueOn: { year: 2026, month: 8, day: 30 } }, at: { value: -2, unit: 'day' }, severity: 'low', read: true, unitId: 'B1' },
  { id: 'n5', kind: 'payment', message: 'partialPayment', data: { unitId: 'A5', tenant: 'Aline Tchoumi', amount: 40000, total: 75000 }, at: { value: -3, unit: 'day' }, severity: 'medium', read: true, unitId: 'A5' },
  { id: 'n6', kind: 'work', message: 'workDone', data: { workId: 'SIG-2026-036', unitId: 'A1', on: { year: 2026, month: 6, day: 28 } }, at: { value: -5, unit: 'day' }, severity: 'low', read: true, unitId: 'A1' },
  { id: 'n7', kind: 'payment', message: 'receiptAvailable', data: { unitId: 'A1', amount: 145000, period: { year: 2026, month: 7 } }, at: { value: -6, unit: 'day' }, severity: 'low', read: true, unitId: 'A1' },
]

/**
 * Locataire connecté — le « Charles N. » du sélecteur de profil.
 * Tant qu'il n'y a pas d'authentification, cette
 * constante tient lieu de session : c'est elle qui borne ce que le rôle
 * locataire a le droit de voir.
 */
export const DEMO_TENANT_UNIT = 'A1'

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

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((building) => building.id === id)
}
