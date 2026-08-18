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
   * Début du bail EN COURS. `null` quand l'unité est vacante.
   *
   * Le portail annonçait « bail en cours depuis le … » et « depuis mon entrée
   * le … » sans que rien dans le modèle ne porte cette date. Elle s'aligne sur
   * l'état des lieux d'entrée là où il y en a un : les deux dateraient sinon
   * la même arrivée à deux jours différents.
   *
   * Et le mois est INDEXÉ À ZÉRO, comme partout dans `DateParts`. Les trois
   * unités concernées portaient un mois de moins que leur état des lieux —
   * A1 entrait le 15/05 pour un état des lieux le 15/06 —, l'écart exact d'un
   * mois lu en base 1 puis réécrit en base 0. `alignementDuBail` le garde.
   */
  leaseStart: DateParts | null
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
  /**
   * Bail courant, quand l'unité en porte un.
   *
   * Le serveur le rendait déjà et la conversion le jetait. Il est la clé des
   * actions qui portent sur le CONTRAT et non sur les murs — relancer, mettre
   * en demeure — et sans lui l'écran n'a rien à désigner. Absent en
   * démonstration, où aucun bail n'a d'identifiant serveur.
   */
  leaseId?: string
  /**
   * Fiche du locataire, quand l'unité en porte une.
   *
   * Le serveur la rendait déjà et la conversion ne gardait que le NOM. Un nom ne
   * désigne pas une fiche — deux locataires peuvent être homonymes, et le
   * retrait porte sur la personne, pas sur son étiquette.
   */
  tenantId?: string
}

export const UNITS: Unit[] = [
  { id: 'A1', buildingId: 'bon', label: 'A1', type: 'T3', surface: 78, rent: 145000, tenant: 'Charles Ngassa', phone: '+237 6 77 21 44 08', leaseStart: { year: 2024, month: 5, day: 15 }, paid: 145000, status: 'paid' },
  { id: 'A2', buildingId: 'bon', label: 'A2', type: 'T2', surface: 54, rent: 110000, tenant: 'Mireille Fotso', phone: '+237 6 99 03 51 72', leaseStart: { year: 2023, month: 9, day: 1 }, paid: 110000, status: 'paid' },
  { id: 'A3', buildingId: 'bon', label: 'A3', type: 'T2', surface: 56, rent: 115000, tenant: 'Serge Mbarga', phone: '+237 6 55 84 20 31', leaseStart: { year: 2025, month: 2, day: 1 }, paid: 0, status: 'overdue', overdueDays: 24 },
  { id: 'A4', buildingId: 'bon', label: 'A4', type: 'T4', surface: 96, rent: 180000, tenant: 'Famille Owona', phone: '+237 6 70 12 96 45', leaseStart: { year: 2026, month: 2, day: 15 }, paid: 180000, status: 'paid' },
  { id: 'A5', buildingId: 'bon', label: 'A5', type: 'T1', surface: 38, rent: 75000, tenant: 'Aline Tchoumi', phone: '+237 6 94 37 08 12', leaseStart: { year: 2026, month: 1, day: 2 }, paid: 40000, status: 'partial' },

  { id: 'B1', buildingId: 'akw', label: 'B1', type: 'T3', surface: 82, rent: 160000, tenant: 'Jean-Paul Eboa', phone: '+237 6 78 45 11 90', leaseStart: { year: 2023, month: 7, day: 1 }, paid: 160000, status: 'paid' },
  { id: 'B2', buildingId: 'akw', label: 'B2', type: 'T3', surface: 80, rent: 155000, tenant: 'Nadia Belinga', phone: '+237 6 51 60 73 24', leaseStart: { year: 2024, month: 10, day: 1 }, paid: 0, status: 'overdue', overdueDays: 9 },
  { id: 'B3', buildingId: 'akw', label: 'B3', type: 'T2', surface: 58, rent: 120000, tenant: 'Éric Ndongo', phone: '+237 6 96 82 30 57', leaseStart: { year: 2025, month: 5, day: 1 }, paid: 120000, status: 'paid' },
  { id: 'B4', buildingId: 'akw', label: 'B4', type: 'T2', surface: 57, rent: 118000, tenant: null, phone: null, leaseStart: null, paid: 0, status: 'vacant' },

  { id: 'C1', buildingId: 'des', label: 'C1', type: 'T4', surface: 104, rent: 195000, tenant: 'Cabinet Njoya', phone: '+237 6 73 55 41 86', leaseStart: { year: 2022, month: 3, day: 1 }, paid: 195000, status: 'paid' },
  { id: 'C2', buildingId: 'des', label: 'C2', type: 'T3', surface: 76, rent: 142000, tenant: 'Sylvie Manga', phone: '+237 6 82 19 64 03', leaseStart: { year: 2025, month: 8, day: 1 }, paid: 0, status: 'overdue', overdueDays: 3 },
  { id: 'C3', buildingId: 'des', label: 'C3', type: 'T2', surface: 60, rent: 125000, tenant: null, phone: null, leaseStart: null, paid: 0, status: 'vacant' },
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

/**
 * Corps de métier proposés AU DÉCLARANT, dans l'ordre où ils lui sont montrés.
 *
 * Sous-ensemble ordonné de `TradeKey` : « multi-corps » qualifie un chantier
 * que le bailleur arbitre, jamais un problème que le locataire constate. Il vit
 * ici plutôt que dans l'un des deux écrans qui le proposent — la modale du
 * bailleur et l'écran du locataire — sans quoi le second l'aurait recopié, et
 * les deux listes auraient divergé au premier ajout.
 */
export const TRADES_REPORTABLE = ['plumbing', 'power', 'lock', 'painting', 'other'] as const

/** Vocabulaire des corps de métier, partagé avec les signalements du portail. */
export type UrgencyKey = 'blocking' | 'normal' | 'low'

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
  /**
   * Référence lisible — « SIG-2026-042 ». Absente du jeu de démonstration, où
   * `id` la portait déjà.
   *
   * Même distinction que `Unit.id` et `Unit.label`, et même piège : tant que
   * les deux coïncident, rien ne se voit. Venue du serveur, `id` est un `uuid`,
   * et l'écran affichait « aaa63f51-0283-4ffb-b981-… » à la place.
   */
  reference?: string
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
   * Ce que les réserves de SORTIE justifieraient de retenir.
   *
   * Proposé, jamais appliqué : la retenue reste une décision du propriétaire, et
   * l'état des lieux en est la pièce, pas l'auteur.
   */
  billable?: number
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
   * Les deux que le SERVEUR écrit et que le client ne connaissait pas.
   *
   * Une relance et une mise en demeure créent chacune une notification. Aucune
   * des deux n'existait ici ni dans les dictionnaires : l'écran composait une
   * clé introuvable et affichait la clé elle-même. Elles n'apparaissent jamais
   * en démonstration — le jeu de données ne relance personne —, ce qui est
   * exactement pourquoi le défaut a tenu.
   */
  | 'rentReminder'
  | 'formalNotice'

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
 * Une période de facturation du locataire : ce qui était dû, ce qui a été reçu.
 *
 * Les périodes sont stockées en valeurs machine — année et index de mois — et
 * non en chaînes : un nom de mois est du formatage, pas du contenu, et doit
 * suivre la langue de l'interface. Voir `lib/dates`.
 *
 * **Les montants sont FIGÉS, jamais dérivés d'un tarif courant.** Ce type
 * portait des quantités — 16 m³, 178 kWh — que l'écran multipliait par
 * `UTILITY_RATES` pour obtenir ce qu'il affichait. Tant que le tarif ne bouge
 * pas, les deux coïncident ; le jour où il change, tout l'historique se
 * recalcule et juillet se relit au prix d'août. C'est précisément ce que le
 * serveur refuse de faire — `RentCharge.waterMinor` le dit dans son propre
 * commentaire —, et une quittance réémise doit rendre exactement la première.
 *
 * La quantité consommée n'est pas perdue pour autant : elle vit au RELEVÉ, une
 * ligne par unité, fluide et période, d'où l'espace locataire tire déjà sa
 * consommation du mois.
 */
export interface Receipt {
  year: number
  /** 0 = janvier. */
  month: number
  /** Loyer de la période — celui du bail d'alors, pas celui d'aujourd'hui. */
  rentMinor: number
  /** Eau et électricité refacturées, figées à l'émission. */
  waterMinor: number
  powerMinor: number
  /** Jour d'échéance : ce qui distingue « pas encore dû » de « en retard ». */
  dueOn: DateParts
  /**
   * Total encaissé sur la période, tous versements confondus.
   *
   * UN total et non une part par poste : un versement solde une échéance, il ne
   * se rattache pas à l'eau plutôt qu'à l'électricité. La ventilation que le
   * tableau affiche est une convention d'affichage — voir `imputation`.
   */
  paidMinor: number
  /** Les versements reçus, dans l'ordre où ils l'ont été. */
  payments: ReceiptPayment[]
}

/** Un versement reçu sur une période. */
export interface ReceiptPayment {
  amountMinor: number
  method: PaymentMethodKey
  paidOn: DateParts
}

/**
 * Moyen de paiement, aux valeurs du SERVEUR.
 *
 * Le client en tenait deux vocabulaires : `'mobileMoney' | 'transfer' | 'cash'`
 * pour la démonstration, et `'mobile' | 'cash' | 'transfer' | 'check'` dans le
 * formulaire d'encaissement, qui les envoie tels quels. Deux tables pour un
 * seul fait, dont l'une ignorait le chèque : un règlement par chèque remonté du
 * serveur n'avait aucun libellé à afficher. Ce sont les valeurs du serveur qui
 * restent, et le dictionnaire `app.payments.method*` qui les nomme — il les
 * nommait déjà toutes les quatre.
 */
export type PaymentMethodKey = 'mobile' | 'cash' | 'transfer' | 'check'

/** Ce que la période doit, tous postes confondus. */
export function receiptDue(receipt: Receipt): number {
  return receipt.rentMinor + receipt.waterMinor + receipt.powerMinor
}

/**
 * Ce que le versement a soldé, poste par poste.
 *
 * Une CONVENTION d'affichage, et non un fait enregistré : le loyer d'abord,
 * puis l'eau, puis l'électricité — l'ordre d'imputation usuel, et celui que le
 * serveur applique déjà pour son histogramme d'encaissements. Les deux doivent
 * rester identiques, sans quoi le même versement se lirait de deux façons selon
 * l'écran qui l'affiche.
 *
 * Elle existe parce qu'un règlement partiel doit se voir sur le poste qui
 * appelle un geste. Sans elle, une période à moitié réglée s'affichait soldée.
 */
export function imputation(receipt: Receipt): { rent: number; water: number; power: number } {
  const rent = Math.min(receipt.paidMinor, receipt.rentMinor)
  const reste = receipt.paidMinor - rent
  const water = Math.max(0, Math.min(reste, receipt.waterMinor))
  const power = Math.max(0, Math.min(reste - receipt.waterMinor, receipt.powerMinor))
  return { rent, water, power }
}

/**
 * Le versement qui a CLOS la période, ou le dernier reçu si elle ne l'est pas.
 *
 * Le portail annonce « payé le 03/08 par Mobile Money » : la phrase ne peut
 * porter qu'une date et un moyen, alors qu'une période peut être réglée en
 * plusieurs fois et par plusieurs canaux. C'est le DERNIER versement qui la
 * complète, donc lui qui date le règlement ; les autres restent lisibles dans
 * `payments`, où le détail a sa place.
 *
 * `undefined` quand rien n'a été reçu — auquel cas la ligne disparaît plutôt
 * que d'afficher une date de règlement qui n'a pas eu lieu.
 */
export function dernierVersement(receipt: Receipt): ReceiptPayment | undefined {
  return receipt.payments[receipt.payments.length - 1]
}

/**
 * Où en est la période.
 *
 * `overdue` demande la date du jour : une période non réglée dont l'échéance
 * n'est pas passée n'est pas en retard, elle est à venir. Confondre les deux
 * afficherait le mois courant en rouge dès le premier du mois.
 */
export function receiptStatus(receipt: Receipt, aujourdhui: Date): PaymentStatus {
  if (receipt.paidMinor >= receiptDue(receipt)) return 'paid'
  if (receipt.paidMinor > 0) return 'partial'
  const echeance = new Date(receipt.dueOn.year, receipt.dueOn.month, receipt.dueOn.day)
  return echeance < aujourdhui ? 'overdue' : 'pending'
}

/**
 * Quittances du locataire connecté.
 *
 * Les quantités d'août — 16 m³ et 178 kWh — reprennent CELLES DU RELEVÉ de
 * l'unité A1 : 358−342 et 4298−4120. L'écran des relevés et le portail parlent
 * du même mois ; en inventer d'autres ici aurait donné au locataire une
 * consommation que son gestionnaire ne lit nulle part. Les montants ci-dessous
 * sont ces quantités au tarif de `UTILITY_RATES`, calculées UNE FOIS et
 * inscrites — c'est ainsi qu'une facture se fige, et le serveur ne fait pas
 * autrement.
 *
 * Mai — `month: 4` — n'est soldé qu'en partie : 9 000 sur les 14 058 dus
 * d'électricité, une fois le loyer et l'eau couverts. C'est le cas que le
 * tableau affiche « reste … », et la seule raison pour laquelle l'imputation
 * poste par poste existe.
 */
export const TENANT_RECEIPTS: Receipt[] = [
  { year: 2026, month: 7, rentMinor: 145000, waterMinor: 8320, powerMinor: 17622, dueOn: { year: 2026, month: 7, day: 5 }, paidMinor: 170942, payments: [{ amountMinor: 170942, method: 'mobile', paidOn: { year: 2026, month: 7, day: 3 } }] },
  { year: 2026, month: 6, rentMinor: 145000, waterMinor: 7800, powerMinor: 16137, dueOn: { year: 2026, month: 6, day: 5 }, paidMinor: 168937, payments: [{ amountMinor: 168937, method: 'mobile', paidOn: { year: 2026, month: 6, day: 2 } }] },
  { year: 2026, month: 5, rentMinor: 145000, waterMinor: 7280, powerMinor: 16929, dueOn: { year: 2026, month: 5, day: 5 }, paidMinor: 169209, payments: [{ amountMinor: 169209, method: 'transfer', paidOn: { year: 2026, month: 5, day: 5 } }] },
  { year: 2026, month: 4, rentMinor: 145000, waterMinor: 6760, powerMinor: 14058, dueOn: { year: 2026, month: 4, day: 5 }, paidMinor: 160760, payments: [{ amountMinor: 160760, method: 'mobile', paidOn: { year: 2026, month: 4, day: 4 } }] },
  { year: 2026, month: 3, rentMinor: 145000, waterMinor: 6240, powerMinor: 15345, dueOn: { year: 2026, month: 3, day: 5 }, paidMinor: 166585, payments: [{ amountMinor: 166585, method: 'cash', paidOn: { year: 2026, month: 3, day: 2 } }] },
  { year: 2026, month: 2, rentMinor: 145000, waterMinor: 8840, powerMinor: 16632, dueOn: { year: 2026, month: 2, day: 5 }, paidMinor: 170472, payments: [{ amountMinor: 170472, method: 'mobile', paidOn: { year: 2026, month: 2, day: 6 } }] },
]

/**
 * Une pièce administrative demandée par le locataire.
 *
 * Elle partait par `addWork`, le canal des signalements, faute d'objet pour la
 * porter : le suivi du locataire comme la liste du gestionnaire la rangeaient
 * parmi les interventions, avec un métier, une urgence et une référence de
 * chantier. « Attestation de résidence » s'affichait à côté d'une fuite
 * d'évier.
 *
 * `tenant` est le nom de qui demande — `null` hors démonstration quand le bail
 * n'en porte pas. Le gestionnaire répond à une personne, pas à un identifiant
 * de logement.
 */
export interface DocumentRequest {
  id: string
  unitId: string
  tenant: string | null
  kind: DocumentKind
  status: DocumentRequestStatus
  requestedAt: DateParts
  /** `null` tant que personne n'a répondu. */
  resolvedAt: DateParts | null
}

/** Les trois pièces que l'écran sait demander. Liste fermée, comme au serveur. */
export type DocumentKind = 'residence' | 'goodStanding' | 'leaseCopy'

/**
 * `declined` est une RÉPONSE.
 *
 * Une pièce qu'on ne peut pas produire — bail non signé, document inexistant —
 * laisserait sinon la demande en attente indéfiniment : le locataire
 * guetterait, le gestionnaire garderait une ligne qu'il ne peut pas retirer.
 */
export type DocumentRequestStatus = 'pending' | 'fulfilled' | 'declined'

/** L'intitulé de chaque pièce, dans la langue de qui lit. */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  residence: 'app.documents.reqResidence',
  goodStanding: 'app.documents.reqGoodStanding',
  leaseCopy: 'app.documents.reqLeaseCopy',
}

/**
 * Deux demandes de démonstration, dans deux états.
 *
 * Une seule ne montrerait qu'une moitié de l'objet : c'est la RÉPONSE — la
 * date à laquelle le gestionnaire a fourni la pièce — qui distingue cette
 * entité d'un formulaire d'envoi. Elles portent l'unité du locataire de
 * démonstration, la seule dont l'espace locataire montre le dossier.
 */
export const TENANT_DOCUMENT_REQUESTS: DocumentRequest[] = [
  {
    id: 'dem-1',
    unitId: DEMO_TENANT_UNIT,
    tenant: 'Charles Ngassa',
    kind: 'goodStanding',
    status: 'pending',
    requestedAt: { year: 2026, month: 7, day: 12 },
    resolvedAt: null,
  },
  {
    id: 'dem-2',
    unitId: DEMO_TENANT_UNIT,
    tenant: 'Charles Ngassa',
    kind: 'residence',
    status: 'fulfilled',
    requestedAt: { year: 2026, month: 6, day: 3 },
    resolvedAt: { year: 2026, month: 6, day: 5 },
  },
]

/**
 * Une occupation : qui a habité ce logement, quand, et à quel loyer.
 *
 * Le produit ne savait dire que le présent — `Unit.tenant` porte le locataire
 * en cours. L'histoire d'un logement n'existait nulle part, alors que le modèle
 * la porte depuis l'origine : un `Lease` est daté, et `endsOn` distingue le bail
 * qui court de celui qui s'est terminé.
 */
export interface Occupation {
  id: string
  unitId: string
  /** `null` quand la fiche du locataire a été retirée après coup. */
  tenant: string | null
  startsOn: DateParts
  /** `null` tant que le bail court — et non « bail sans fin ». */
  endsOn: DateParts | null
  rentMinor: number
  status: 'pending' | 'active' | 'ended'
}

/**
 * Les périodes de démonstration d'une unité, dérivées de son état courant.
 *
 * La grille des paiements montre six mois par bail. Seule l'unité du locataire
 * de démonstration — A1 — avait un historique écrit à la main : la grille
 * n'aurait affiché qu'une ligne pleine sur dix, et neuf rangées de tirets sur
 * la vitrine publique du produit.
 *
 * Ces périodes sont DÉRIVÉES, pas inventées : les cinq mois passés sont soldés,
 * et le mois courant reprend exactement ce que l'unité annonce déjà —
 * `unit.paid` sur `unit.rent`. Un chiffre tiré au hasard aurait contredit la
 * carte d'à côté ; c'est le défaut que les constantes `COLLECTIONS` avaient
 * coûté, et il n'est pas question de le refaire ici.
 *
 * Les charges suivent le loyer — 4,5 % pour l'eau, 3,6 % pour l'électricité,
 * les mêmes proportions que le jeu de données du serveur, avec la même variation
 * d'un mois sur l'autre : un parc dont l'eau coûte douze fois le même montant
 * ne ressemble à rien.
 */
export function receiptsDemoPourUnite(
  unit: Pick<Unit, 'rent' | 'paid' | 'status'>,
  aujourdhui: DateParts,
  periodes = 6,
): Receipt[] {
  const sortie: Receipt[] = []
  for (let recul = 0; recul < periodes; recul++) {
    const mois = aujourdhui.month - recul
    const year = aujourdhui.year + Math.floor(mois / 12)
    const month = ((mois % 12) + 12) % 12
    const courant = recul === 0

    const waterMinor = Math.round(unit.rent * 0.045 * (1 + ((recul % 5) - 2) * 0.06))
    const powerMinor = Math.round(unit.rent * 0.036 * (1 + ((recul % 4) - 1.5) * 0.08))
    const du = unit.rent + waterMinor + powerMinor

    /**
     * Le mois courant dit ce que l'unité dit ; les précédents sont soldés.
     *
     * Une unité « à jour » solde le TOTAL, charges comprises. Première
     * rédaction : `unit.paid` tel quel — or ce champ porte l'encaissé du loyer,
     * et la grille affichait alors une dette de quelques milliers de francs sur
     * les dix baux, y compris ceux que la pastille annonce à jour. Deux
     * chiffres pour un seul fait, sur la même ligne.
     */
    const paidMinor = courant ? (unit.status === 'paid' ? du : unit.paid) : du
    sortie.push({
      year,
      month,
      rentMinor: unit.rent,
      waterMinor,
      powerMinor,
      dueOn: { year, month, day: 5 },
      paidMinor,
      payments: paidMinor
        ? [{ amountMinor: paidMinor, method: 'mobile', paidOn: { year, month, day: 3 } }]
        : [],
    })
  }
  return sortie
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((building) => building.id === id)
}
