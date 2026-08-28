import type { PaymentStatus } from '@/components/primitives/StatusPill'
/**
 * LA SEULE PREUVE QUE LA DÉMONSTRATION PORTE, et elle est INLINÉE.
 *
 * `?inline` n'est pas une préférence : `poids-ecrans` refuse toute REQUÊTE de
 * plus sur un écran mesuré — « les octets se rapportent, les requêtes se
 * refusent ». Servie en fichier à part, cette image serait un aller-retour
 * supplémentaire, donc un veto ; dans le paquet, elle n'est qu'une ligne à
 * arbitrer. Le suffixe est ÉCRIT plutôt que laissé au seuil d'inlining de Vite
 * (4 096 o par défaut, et le fichier en fait 4 997) : un seuil ferait basculer
 * l'image en requête le jour où quelqu'un la retaille, sans que rien ne le
 * dise avant la porte.
 *
 * Sa provenance, son recadrage et ce qu'il a retiré vivent dans
 * `fixtures/PROVENANCE.md`, versionné avec elle.
 */
import peintureEcaillee1 from './fixtures/peinture-ecaillee-1.jpg?inline'
import peintureEcaillee2 from './fixtures/peinture-ecaillee-2.jpg?inline'
import peintureEcaillee3 from './fixtures/peinture-ecaillee-3.jpg?inline'

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
  /**
   * Le prix unitaire APPLICABLE à ce relevé, ou `null` quand il n'y en a aucun.
   *
   * Il vient du serveur, qui choisit le tarif en vigueur à la période relevée —
   * les prix sont datés, et refacturer janvier au tarif de novembre serait
   * faux. Le client ne fait plus qu'une multiplication.
   *
   * `null` n'est pas un cas dégradé à combler : c'est un parc dont le
   * propriétaire n'a pas encore posé ses prix, et l'écran doit alors montrer la
   * QUANTITÉ SEULE. Deux constantes vivaient ici — 520 le mètre cube, 99 le
   * kilowattheure — affichées à tous les parcs, dans toutes les devises, et le
   * locataire lisait ce qu'il doit à partir d'un chiffre que rien ne fondait.
   */
  waterPrice: number | null
  powerPrice: number | null
}

/**
 * Tarifs de la DÉMONSTRATION, et d'elle seule.
 *
 * Ces deux nombres étaient `UTILITY_RATES`, servis à tous les parcs et à toutes
 * les devises depuis le client : l'écran des relevés et l'espace du locataire
 * les affichaient comme des faits, avec les totaux qui en découlent. Un parc
 * réel lit désormais ses propres prix, datés, que son propriétaire a posés — et
 * n'en affiche aucun tant qu'il n'en a posé aucun.
 *
 * Ils survivent ici au même titre que les loyers et les noms de ce fichier :
 * un jeu fictif assumé, qui ne quitte jamais la démonstration. Le nom le dit
 * maintenant, ce que « UTILITY_RATES » laissait croire l'inverse.
 */
export const TARIFS_DEMO = { water: 520, power: 99 }

/**
 * LE REGISTRE DES ACCÈS DE LA DÉMONSTRATION.
 *
 * POURQUOI IL N'EXISTAIT PAS, ET CE QUE ÇA COÛTAIT. L'écran des accès lit son
 * registre par `api.access(parkId)`. Sans parc — c'est-à-dire en démonstration
 * — il n'appelle rien et rend « vous n'avez pas encore de parc ». Un visiteur
 * qui clique « Accès au parc » dans une démonstration qui affiche trois
 * immeubles, douze logements et DIX locataires tombe donc sur un écran qui lui
 * dit qu'il n'a pas de parc. C'est la seule impasse du parcours de
 * démonstration.
 *
 * Conséquence jumelle, et c'est la troisième fois sur cette branche : les deux
 * tableaux de cet écran n'étaient rendus NULLE PART. Ni la mesure de
 * géométrie, ni celle du contraste, ni un œil. Après `ParkSettingsModal` et
 * `TariffsModal`, c'est le même motif — un écran gardé par un compte réel, donc
 * hors de portée de toutes les portes.
 *
 * CE QU'IL CONTIENT N'EST PAS INVENTÉ : ce sont les trois personnages que la
 * coquille nomme déjà dans son sélecteur de profil — « Propriétaire · Arsène
 * N. », « Gestionnaire · Diane F. », « Locataire · Charles N. ». Le registre
 * des accès est très exactement la liste de ces trois-là ; la démonstration la
 * montrait dans sa barre latérale et la cachait sur l'écran qui existe pour ça.
 *
 * Les adresses sont en `example.com`, réservé par la RFC 2606 à cet usage : une
 * démonstration ne doit pas afficher un domaine que quelqu'un possède.
 *
 * LE CODE EN ATTENTE est le second sujet de l'écran, et il faut qu'il y en ait
 * un : sans lui la moitié basse resterait en état vide, et l'on n'aurait rendu
 * mesurable que la moitié du problème. Il porte une unité VACANTE du jeu —
 * inviter un locataire sur un logement déjà occupé n'aurait aucun sens.
 */
export const ACCES_DEMO = {
  members: [
    {
      id: 'demo-membre-1',
      role: 'owner' as const,
      fullName: 'Arsène Nkolo',
      email: 'arsene@example.com',
      since: '2024-03-04',
    },
    {
      id: 'demo-membre-2',
      role: 'manager' as const,
      fullName: 'Diane Fotso',
      email: 'diane@example.com',
      since: '2025-01-15',
    },
    {
      id: 'demo-membre-3',
      role: 'tenant' as const,
      fullName: 'Charles Ngassa',
      email: 'charles@example.com',
      since: '2024-06-15',
    },
  ],
  invitations: [
    {
      id: 'demo-invitation-1',
      role: 'tenant' as const,
      /* Les quatre derniers caractères seulement : c'est ce que le serveur rend
         d'un code, et l'écran ne doit jamais pouvoir en réafficher un entier. */
      codeHint: '7Q4M',
      issuedAt: '2026-08-19',
      expiresAt: '2026-09-02',
      unitId: 'A5',
      unitLabel: 'A5',
    },
  ],
}

/**
 * Les relevés de la démonstration portent les prix de la démonstration.
 *
 * Posés à la construction plutôt que multipliés à l'écran : c'est la même forme
 * que ce que le serveur rend, si bien que les deux chemins — démonstration et
 * parc réel — nourrissent le même composant sans qu'il sache lequel le sert.
 */
export const READINGS: MeterReading[] = [
  { unitId: 'A1', waterPrevious: 342, waterCurrent: 358, powerPrevious: 4120, powerCurrent: 4298, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A2', waterPrevious: 289, waterCurrent: 301, powerPrevious: 3540, powerCurrent: 3671, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A3', waterPrevious: 415, waterCurrent: 436, powerPrevious: 5210, powerCurrent: 5402, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A4', waterPrevious: 502, waterCurrent: 529, powerPrevious: 6180, powerCurrent: 6455, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A5', waterPrevious: 176, waterCurrent: null, powerPrevious: 2140, powerCurrent: null, readAt: null, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B1', waterPrevious: 388, waterCurrent: 402, powerPrevious: 4870, powerCurrent: 5033, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B2', waterPrevious: 356, waterCurrent: 371, powerPrevious: 4405, powerCurrent: 4560, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B3', waterPrevious: 271, waterCurrent: 284, powerPrevious: 3290, powerCurrent: 3418, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'C1', waterPrevious: 611, waterCurrent: 644, powerPrevious: 7320, powerCurrent: 7640, readAt: { year: 2026, month: 7, day: 18 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'C2', waterPrevious: 334, waterCurrent: null, powerPrevious: 4010, powerCurrent: null, readAt: null, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
]

/**
 * LES MÊMES PRIX, DANS LA FORME QUE LE SERVEUR REND.
 *
 * POURQUOI CETTE SECONDE ÉCRITURE EXISTE. `TariffsModal` lit l'historique des
 * prix par `api.tariffs(parkId)` : sans parc, elle n'appelle rien et sa liste
 * reste vide, ce qui lui fait afficher « aucun prix posé ». Or l'écran des
 * relevés, deux clics plus haut, AFFICHE ces deux prix en indicateurs, lus sur
 * les relevés de la démonstration. La modale qui existe pour montrer et poser
 * les prix aurait donc démenti l'écran qui les montre — le pire genre de
 * contradiction, puisque c'est l'éditeur qui nie ce que la page affiche.
 *
 * ELLE NE PEUT PAS DÉRIVER de son côté : les deux listes se dérivent de
 * `TARIFS_DEMO`, la même constante que portent les relevés ci-dessous. Changer
 * un prix les change ensemble.
 *
 * LA DATE D'EFFET EST DÉRIVÉE, PAS ÉCRITE. Un prix de ce produit est daté par
 * construction — c'est ce que le schéma impose et ce qui empêche de réécrire
 * des quittances déjà remises. La démonstration n'en portait pas ; la prendre au
 * premier du mois du relevé le plus ANCIEN est la seule valeur cohérente avec ce
 * qu'elle affiche par ailleurs, et elle suit si les relevés changent de période.
 *
 * C'est une invention, et elle est assumée au même titre que les loyers et les
 * noms de ce fichier : rien de tout cela ne quitte la démonstration, dont chaque
 * écran porte un bandeau qui le dit.
 */
export const TARIFS_DEMO_DATES = () => {
  const mois = READINGS.map((r) => r.readAt).filter((d) => d !== null) as {
    year: number
    month: number
    day: number
  }[]
  const plusAncien = mois.reduce((a, b) =>
    a.year !== b.year ? (a.year < b.year ? a : b) : a.month <= b.month ? a : b,
  )
  /* `month` est indexé à zéro dans tout le produit — `readAt` vient de
     `getMonth()` — et une date ISO l'écrit à partir de un. */
  const effectiveFrom = `${plusAncien.year}-${String(plusAncien.month + 1).padStart(2, '0')}-01`
  return [
    { id: 'demo-water', utility: 'water' as const, unitPriceMinor: TARIFS_DEMO.water, effectiveFrom },
    { id: 'demo-power', utility: 'power' as const, unitPriceMinor: TARIFS_DEMO.power, effectiveFrom },
  ]
}

/**
 * La consommation d'une période, fluide par fluide.
 *
 * **`null` ne veut pas dire zéro.** Il dit qu'aucune consommation n'est
 * DÉRIVABLE : le relevé du mois manque, ou celui du mois d'avant, ou l'index a
 * reculé. Zéro serait un mensonge parfaitement lisible — une barre au sol se
 * lit comme un logement vide, une absence à domicile, et c'est la seule chose
 * qu'on ne sait justement pas.
 */
export interface ConsumptionPoint {
  year: number
  /** 0 = janvier. */
  month: number
  water: number | null
  power: number | null
}

/**
 * Le profil saisonnier de la démonstration, par index de mois.
 *
 * Les mêmes facteurs que `server/src/parks/demo.ts` — climat de Yaoundé, grande
 * saison sèche de décembre à février, petite en juillet-août. Deux copies d'une
 * table de douze nombres valent mieux qu'un import du serveur dans le client :
 * le jeu de démonstration client existe précisément pour tourner SANS serveur.
 */
const SAISON_DEMO = {
  water: [1.18, 1.2, 1.05, 0.92, 0.88, 0.9, 1.1, 1.15, 0.9, 0.85, 0.95, 1.15],
  power: [1.1, 1.14, 1.08, 1.0, 0.95, 0.92, 1.05, 1.12, 1.0, 0.96, 0.98, 1.08],
} as const

/** La période de tête du jeu de démonstration. 7 = août. */
const PERIODE_DEMO = { year: 2026, month: 7 }
const PROFONDEUR_DEMO = 12

/**
 * Consommation de référence des deux unités SANS relevé courant.
 *
 * A5 et C2 n'ont qu'un index : aucune consommation ne s'en dérive, et la
 * rétro-génération n'aurait rien pour partir. Mêmes valeurs qu'au semis du
 * serveur.
 */
const BASE_SANS_RELEVE: Record<string, { water: number; power: number }> = {
  A5: { water: 10, power: 120 },
  C2: { water: 14, power: 150 },
}

/**
 * Un premier de mois en ISO, construit en UTC.
 *
 * `new Date(annee, mois, 1).toISOString()` construirait dans le fuseau de la
 * machine : à Douala — UTC+1 — le 1er août devient le 31 juillet à 23 h, et
 * toute la période glisse d'un mois. Le serveur sérialise ces colonnes `date` à
 * minuit UTC ; on écrit donc la même chose.
 */
function isoDeLaPeriode({ year, month }: { year: number; month: number }): string {
  return new Date(Date.UTC(year, month, 1)).toISOString()
}

/**
 * L'historique de relevés de la démonstration — des INDEX, comme le serveur.
 *
 * Il porte des index et non des consommations toutes faites, pour que le jeu de
 * démonstration passe par la MÊME dérivation que la réponse réelle. Sans cela,
 * le seul endroit où ce calcul vit — `consommations`, dans `apiPortfolio` — ne
 * serait jamais exercé en développement : on ne verrait ni le trou de période,
 * ni l'index qui recule, ni le décalage de fuseau.
 *
 * Rétro-généré depuis l'index le plus ancien de `READINGS`, exactement comme le
 * semis : les deux index de tête ne bougent donc pas, et les écrans du
 * gestionnaire restent identiques.
 */
export const READING_HISTORY_DEMO: {
  unitId: string
  utility: 'water' | 'power'
  periodStart: string
  indexValue: number
}[] = (() => {
  const precedente = { year: PERIODE_DEMO.year, month: PERIODE_DEMO.month - 1 }
  const lignes: { unitId: string; utility: 'water' | 'power'; periodStart: string; indexValue: number }[] = []

  for (const r of READINGS) {
    for (const utility of ['water', 'power'] as const) {
      const precedent = utility === 'water' ? r.waterPrevious : r.powerPrevious
      const valeur = utility === 'water' ? r.waterCurrent : r.powerCurrent

      lignes.push({ unitId: r.unitId, utility, periodStart: isoDeLaPeriode(precedente), indexValue: precedent })
      if (valeur !== null) {
        lignes.push({ unitId: r.unitId, utility, periodStart: isoDeLaPeriode(PERIODE_DEMO), indexValue: valeur })
      }

      const base = BASE_SANS_RELEVE[r.unitId]?.[utility]
      const consoDeReference = valeur !== null ? valeur - precedent : (base ?? 0)
      let index = precedent
      let quand = { ...precedente }
      for (let recul = 1; recul <= PROFONDEUR_DEMO - 1; recul += 1) {
        // Le facteur du mois QUITTÉ : dans l'autre sens la saisonnalité glisse
        // d'un cran. Le mois peut être négatif après plusieurs reculs, d'où le
        // modulo positif.
        const moisQuitte = ((quand.month % 12) + 12) % 12
        index -= Math.round(consoDeReference * SAISON_DEMO[utility][moisQuitte]!)
        if (index <= 0) break
        quand = quand.month === 0 ? { year: quand.year - 1, month: 11 } : { year: quand.year, month: quand.month - 1 }
        lignes.push({ unitId: r.unitId, utility, periodStart: isoDeLaPeriode(quand), indexValue: index })
      }
    }
  }
  return lignes
})()


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
 * TOUS les corps de métier, dans l'ordre où on les propose au bailleur.
 *
 * `TRADES_REPORTABLE` en est le sous-ensemble ordonné qu'un LOCATAIRE peut
 * déclarer — il en exclut `multi`, et son commentaire dit pourquoi :
 * « multi-corps qualifie un chantier que le bailleur arbitre, jamais un
 * problème que le locataire constate ». C'est donc précisément la valeur qui
 * manque ici, et elle vient en tête : un bailleur qui ouvre un chantier de sa
 * propre initiative ouvre le plus souvent celui-là.
 *
 * Deux listes et non une avec un filtre, parce que l'ORDRE diffère autant que
 * le contenu — et une liste dérivée par `filter` figerait celui du locataire
 * pour les deux.
 */
export const TRADES: readonly TradeKey[] = ['multi', 'plumbing', 'power', 'painting', 'lock', 'other']

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
  /**
   * DEUX montants, et non un seul.
   *
   * Le client les aplatissait — `amount: approvedAmountMinor ?? quotedAmountMinor`
   * — alors que le serveur les distingue depuis toujours, et pour une raison
   * qu'il écrit lui-même : « un devis révisé après coup ne doit pas réécrire ce
   * qui a été engagé ». L'écran affichait donc un nombre nu que rien ne
   * qualifiait, et le lecteur devait deviner au statut s'il regardait une
   * proposition ou une dépense.
   *
   * La différence porte : un devis à 78 000 validé à 78 000 se lit comme une
   * dépense tenue ; le même devis validé après révision à 95 000 est une
   * dérive, et c'est exactement ce qu'un bailleur veut voir.
   */
  quotedAmount: number | null
  /** Figé à la validation. `null` tant que rien n'est engagé. */
  approvedAmount: number | null
  reportedAt: DateParts
  urgent: boolean
  /**
   * D'où vient l'intervention.
   *
   * `undefined` sur un enregistrement antérieur à ce champ, ou sur un serveur
   * qui ne le rend pas encore : l'écran n'affiche alors aucune origine plutôt
   * que d'en supposer une. Étiqueter « signalement » par défaut inventerait un
   * locataire déclarant là où personne n'a rien dit.
   */
  origin?: 'tenantReport' | 'ownerInitiative'
  /**
   * Le NOM de qui l'a ouverte — locataire ou bailleur, selon `origin`.
   *
   * Le serveur écrivait `reportedByTenantId` depuis l'origine et ne le rendait
   * pas, faute de relation : le bailleur recevait un problème sans savoir qui
   * l'avait vu, donc sans pouvoir rappeler ni faire ouvrir la porte.
   */
  reportedBy?: string | null
}

/**
 * Le montant qui FAIT FOI, et ce qu'il est.
 *
 * L'engagé quand il existe, le devisé sinon. Les écrans affichaient déjà cette
 * règle — c'était le `??` de la conversion — mais sans jamais dire lequel des
 * deux ils montraient : un nombre nu à côté d'une pastille de statut, à charge
 * pour le lecteur de deviner s'il regardait une proposition ou une dépense.
 *
 * La fonction rend les deux ensemble précisément pour que l'appelant ne puisse
 * pas afficher l'un sans l'autre.
 */
export function montantEngage(work: WorkOrder): {
  montant: number | null
  nature: 'approved' | 'quoted' | null
} {
  if (work.approvedAmount !== null) return { montant: work.approvedAmount, nature: 'approved' }
  if (work.quotedAmount !== null) return { montant: work.quotedAmount, nature: 'quoted' }
  return { montant: null, nature: null }
}

/**
 * Les interventions de démonstration, avec leur ORIGINE et leur déclarant.
 *
 * B4 était une initiative du bailleur depuis toujours SANS pouvoir le dire :
 * « réfection complète avant relocation » est un chantier décidé entre deux
 * locataires, et son corps de métier — `multi` — est justement celui que
 * `TRADES_REPORTABLE` exclut de ce qu'un locataire peut déclarer. La donnée
 * disait déjà l'origine, il lui manquait un champ pour la porter.
 *
 * A3 porte le seul écart entre devisé et engagé : 45 000 proposés, rien de
 * validé. Sans lui, les deux montants coïncideraient partout et la distinction
 * ne se verrait sur aucune ligne — c'est le cas qu'une mutation doit pouvoir
 * viser.
 */
export const WORKS: WorkOrder[] = [
  { id: 'SIG-2026-042', unitId: 'A3', titleKey: 'sinkLeak', trade: 'plumbing', status: 'quoted', quotedAmount: 45000, approvedAmount: null, reportedAt: { year: 2026, month: 7, day: 12 }, urgent: true, origin: 'tenantReport', reportedBy: 'Serge Mbarga' },
  { id: 'SIG-2026-041', unitId: 'B2', titleKey: 'waterHeaterBreaker', trade: 'power', status: 'approved', quotedAmount: 78000, approvedAmount: 78000, reportedAt: { year: 2026, month: 7, day: 9 }, urgent: true, origin: 'tenantReport', reportedBy: 'Nadia Belinga' },
  { id: 'SIG-2026-039', unitId: 'C1', titleKey: 'livingRoomPaint', trade: 'painting', status: 'reported', quotedAmount: null, approvedAmount: null, reportedAt: { year: 2026, month: 7, day: 5 }, urgent: false, origin: 'tenantReport', reportedBy: 'Cabinet Njoya' },
  { id: 'SIG-2026-036', unitId: 'A1', titleKey: 'safetyValve', trade: 'plumbing', status: 'done', quotedAmount: 32000, approvedAmount: 32000, reportedAt: { year: 2026, month: 6, day: 28 }, urgent: false, origin: 'tenantReport', reportedBy: 'Charles Ngassa' },
  { id: 'SIG-2026-034', unitId: 'B4', titleKey: 'fullRefurbishment', trade: 'multi', status: 'approved', quotedAmount: 340000, approvedAmount: 340000, reportedAt: { year: 2026, month: 6, day: 22 }, urgent: false, origin: 'ownerInitiative', reportedBy: 'Arsène Nkolo' },
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
  /**
   * Le BAIL, quand l'état des lieux en porte un.
   *
   * C'est lui qui apparie une entrée et une sortie : deux locataires successifs
   * ont chacun les leurs, et comparer l'entrée de l'un à la sortie de l'autre
   * n'aurait aucun sens — c'est pourtant tout ce qu'une comparaison par unité
   * saurait faire.
   */
  leaseId?: string | null
  kind: 'entry' | 'exit'
  date: DateParts
  rooms: number
  issues: number
  /**
   * Le détail des réserves. Vide tant que le serveur ne le rend pas — l'écran
   * retombe alors sur le compte, qui est ce qu'il montrait jusqu'ici.
   */
  findings?: Finding[]
  signed: boolean
}

/**
 * Une réserve : ce qui a été constaté, où, et ce qu'il en coûte.
 *
 * `costMinor` n'existe QUE sur une sortie. C'est la règle qui donne son sens à
 * l'état des lieux d'entrée : il relève ce qui est déjà abîmé précisément pour
 * que le locataire n'en réponde pas, et le serveur refuse d'y chiffrer quoi que
 * ce soit.
 */
export interface Finding {
  id: string
  room: string
  description: string
  severity: 'minor' | 'major'
  costMinor: number | null
  /**
   * Les preuves attachées à cette réserve, et seulement celles que le serveur a
   * CONSTATÉES — une réservation sans octets n'en fait pas partie.
   *
   * Vide tant que le serveur ne les rend pas : le jeu de démonstration n'en
   * porte aucune, faute d'un dépôt d'objets sous la main. L'écran distingue
   * donc « aucune photo » de « pas de photo servie » exactement comme il ne le
   * peut pas — voir la note du lot.
   */
  photos?: Photo[]
}

/**
 * Une photo de réserve, vue du client.
 *
 * NI LA CLÉ DE STOCKAGE, NI L'ADRESSE. La clé ne sort d'aucune réponse ;
 * l'adresse est signée et périssable, et se demande photo par photo au moment
 * d'afficher.
 *
 * `confirmedAt` est la date que le SERVEUR a constatée, et c'est toute la
 * valeur de cette ligne : une date d'appareil se change dans les réglages de
 * l'appareil, celle-ci vient d'une horloge que le déposant ne tient pas.
 */
export interface Photo {
  id: string
  contentType: string
  confirmedAt: DateParts
}

/**
 * LES PREUVES QUE LE LOCATAIRE DE LA DÉMONSTRATION VOIT.
 *
 * A1 est SON logement, et cette réserve d'entrée est celle qui lui a été
 * opposée à la remise des clés. Sans elles, le bloc des preuves n'existait sur
 * aucun écran de la démonstration — donc sur aucun des 506 points que
 * `mesure-ui` balaie, donc ni son contraste, ni ses cibles, ni ses noms
 * accessibles n'étaient audités. MESURÉ AVANT : un bouton de 32 px posé dans ce
 * bloc laissait la porte VERTE. C'est ce trou-là qu'elles referment.
 *
 * ─── POURQUOI TROIS, ET NON UNE ──────────────────────────────────────────
 *
 * Une seule vignette ne fait pas de rangée. La rangée des preuves REPLIE
 * (`flex-wrap`) quand elle déborde, et c'est au téléphone que ce repli compte :
 * trois vignettes de 80 px et leurs écarts font 256 px, plus large que la place
 * qui reste dans la carte à 320 px. Avec une seule photo, ce repli n'était
 * jamais rendu, donc jamais mesuré — le même trou que celui qu'on vient de
 * refermer, d'un cran plus loin.
 *
 * TROIS ZONES DISTINCTES DU MÊME MUR, et les fenêtres NE SE CHEVAUCHENT PAS
 * (vérifié par intersection de rectangles, voir `fixtures/PROVENANCE.md`). Ce
 * sont trois endroits différents du même défaut — ce qu'un constat produit
 * réellement, où l'on photographie la même réserve sous plusieurs cadrages. Ce
 * qui aurait été un mensonge, c'est de les répartir sur des réserves
 * différentes : elles restent toutes trois sur celle qu'elles documentent.
 *
 * `confirmedAt` porte la date du constat lui-même : c'est l'horloge du serveur
 * qui la pose en vrai, et la démonstration ne montre pas autre chose que ce que
 * le produit fait.
 */
const LE_JOUR_DU_CONSTAT = { year: 2024, month: 5, day: 15 }

const PREUVES_PEINTURE: Photo[] = [
  { id: 'demo-photo-peinture-1', contentType: 'image/jpeg', confirmedAt: LE_JOUR_DU_CONSTAT },
  { id: 'demo-photo-peinture-2', contentType: 'image/jpeg', confirmedAt: LE_JOUR_DU_CONSTAT },
  { id: 'demo-photo-peinture-3', contentType: 'image/jpeg', confirmedAt: LE_JOUR_DU_CONSTAT },
]

/**
 * OÙ LIRE UNE PHOTO DE DÉMONSTRATION — et pourquoi ce n'est pas un champ.
 *
 * En vrai, une photo n'a PAS d'adresse stable : le seau n'est jamais public, et
 * le serveur délivre à la demande une adresse signée qui périme en quelques
 * minutes. Le client demande donc photo par photo, au moment d'afficher.
 *
 * La démonstration n'a pas de dépôt d'objets ; elle imite ce contrat plutôt que
 * de le contourner — l'écran appelle `lirePhoto` exactement comme sur un vrai
 * parc, et c'est ce registre qui lui répond. Poser l'adresse dans `Photo` aurait
 * marché en démonstration et divergé du produit, ce qui est la façon la plus
 * sûre de laisser un défaut d'affichage invisible jusqu'à la production.
 */
export const PHOTOS_DEMO: Record<string, string> = {
  'demo-photo-peinture-1': peintureEcaillee1,
  'demo-photo-peinture-2': peintureEcaillee2,
  'demo-photo-peinture-3': peintureEcaillee3,
}

/**
 * Les états des lieux, avec le DÉTAIL de leurs réserves.
 *
 * `issues` reste, parce que c'est ce que les listes affichent — et il se déduit
 * désormais de `findings`, plutôt que d'être écrit à côté : deux nombres pour un
 * seul fait finissent toujours par diverger.
 *
 * B4 porte l'entrée et la sortie du même logement, sur les mêmes pièces : c'est
 * là que la comparaison a quelque chose à montrer. Le séjour s'est dégradé, la
 * cuisine est restée intacte, et la vitre fêlée n'existait pas à l'entrée.
 */
export const INSPECTIONS: Inspection[] = [
  // A1 est l'unité du locataire connecté : sans état des lieux la rubrique
  // affichait toujours son état vide en rôle locataire, et la fonctionnalité
  // restait invisible à qui la regardait depuis ce profil.
  etatDesLieux('A1', 'entry', { year: 2024, month: 5, day: 15 }, 4, true, [
    ['Salle de bain', 'Joint de douche noirci', 'minor'],
    /* Le coût est `undefined` EN TOUTES LETTRES parce qu'une entrée ne se
       chiffre pas — le serveur refuse en 422 — et qu'il faut le franchir pour
       atteindre les photos. Une seule des deux réserves porte une preuve, et
       c'est la vérité d'un état des lieux : on ne photographie pas tout.
       L'autre attend une image en domaine public qui la documente
       honnêtement — voir `fixtures/PROVENANCE.md`. */
    ['Séjour', 'Peinture écaillée derrière la porte', 'minor', undefined, PREUVES_PEINTURE],
  ]),
  etatDesLieux('B4', 'exit', { year: 2026, month: 6, day: 22 }, 4, true, [
    ['Séjour', 'Parquet rayé sur deux lames', 'major', 35000],
    ['Chambre 2', 'Vitre fêlée', 'major', 20000],
    ['Salle de bain', 'Mitigeur fuyant', 'major', 18000],
    ['Salle de bain', 'Miroir descellé', 'minor', 6000],
    ['Cuisine', 'Plaque de cuisson rayée', 'minor'],
    ['Entrée', 'Serrure dure à fermer', 'minor', 12000],
  ]),
  etatDesLieux('B4', 'entry', { year: 2024, month: 8, day: 1 }, 4, true, [
    ['Séjour', 'Légère trace d’usure au sol', 'minor'],
  ]),
  etatDesLieux('C3', 'exit', { year: 2026, month: 5, day: 30 }, 3, true, [
    ['Chambre', 'Volet roulant bloqué', 'major', 25000],
    ['Séjour', 'Interrupteur cassé', 'minor', 4000],
  ]),
  etatDesLieux('A4', 'entry', { year: 2026, month: 2, day: 15 }, 5, true, []),
  etatDesLieux('A5', 'entry', { year: 2026, month: 1, day: 2 }, 2, false, [
    ['Cuisine', 'Plan de travail entaillé', 'minor'],
  ]),
]

/**
 * Un état des lieux de démonstration.
 *
 * Le coût n'est retenu que sur une SORTIE : chiffrer une réserve d'entrée
 * reviendrait à facturer au locataire les dégâts du précédent, et le serveur
 * refuse cette saisie en 422. La démonstration ne montre pas ce que le produit
 * interdit.
 */
function etatDesLieux(
  unitId: string,
  kind: 'entry' | 'exit',
  date: DateParts,
  rooms: number,
  signed: boolean,
  reserves: [string, string, 'minor' | 'major', number?, Photo[]?][],
): Inspection {
  return {
    unitId,
    kind,
    date,
    rooms,
    issues: reserves.length,
    signed,
    findings: reserves.map(([room, description, severity, cout, photos], i) => ({
      id: `${unitId}-${kind}-${i}`,
      room,
      description,
      severity,
      costMinor: kind === 'exit' && cout !== undefined ? cout : null,
      // Une liste vide, jamais `undefined` : l'écran n'a alors qu'un cas à
      // traiter, et « aucune preuve » se lit pareil partout.
      photos: photos ?? [],
    })),
  }
}

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
  /**
   * Les deux que le bailleur ÉCRIT lui-même.
   *
   * `announcement` porte un message groupé — « coupure d'eau jeudi » —, et
   * `workReply` la réponse à un signalement. Leur texte n'est pas une phrase du
   * produit : il vient d'un humain, voyage dans `data.text`, et ne se traduit
   * pas. Les libellés ne portent donc que l'habillage, jamais le contenu.
   *
   * Sans eux, l'écran composait une clé qui n'existait dans aucun dictionnaire
   * et affichait `app.alerts.msg.announcement.title` en toutes lettres — le
   * défaut exact que les deux clés du dessous avaient déjà causé.
   */
  | 'announcement'
  | 'workReply'
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
  /**
   * Le texte écrit par le bailleur — annonce groupée ou réponse à un
   * signalement. Rendu TEL QUEL : c'est la seule donnée d'alerte qui ne soit
   * pas une valeur à formater, et personne ne traduit ce qu'un humain a écrit.
   */
  text?: string
  /** La référence du chantier auquel une réponse se rattache — « SIG-2026-042 ». */
  reference?: string
}

export interface Alert {
  id: string
  kind: 'payment' | 'work' | 'meter' | 'lease' | 'announcement'
  message: AlertMessage
  data: AlertData
  at: RelativeStamp
  severity: 'high' | 'medium' | 'low'
  read: boolean
  /**
   * Le RANG de la relance pour ce bail — « rappel n° 4 ».
   *
   * `undefined` sur tout ce qui n'est pas une relance, et sur un serveur qui ne
   * le rend pas encore. Le numéro se dérive à la lecture côté serveur : il vaut
   * immédiatement pour les relances déjà en base, mais il se renumérote si l'une
   * d'elles disparaît. Aucune purge n'existe aujourd'hui ; le jour où il en
   * arrivera une, il faudra le figer à l'écriture.
   */
  rank?: number | null
  /**
   * Par où le message est PARTI, et s'il est parti.
   *
   * Le schéma porte les deux depuis l'origine et la réponse les jetait : le
   * bailleur ne pouvait pas distinguer une relance réellement expédiée d'une
   * relance restée dans le produit. Sur un écran qui annonce « Relance envoyée
   * à Serge Mbarga », c'est la seule chose qui compte — et la vitrine vend des
   * SMS déclenchés à J+1, J+7, J+15.
   *
   * `sentAt` nul avec `channel: 'sms'` n'est pas une contradiction : c'est une
   * tentative que le fournisseur n'a pas confirmée.
   */
  channel?: 'in_app' | 'email' | 'sms'
  sentAt?: DateParts | null
  /** Unité concernée. Sert au filtrage par rôle. */
  unitId?: string
}

/**
 * Les notifications de démonstration, RELANCES COMPRISES.
 *
 * Le jeu n'en portait aucune : ni `rentReminder`, ni `formalNotice`. Le type les
 * connaît, les deux dictionnaires les traduisent, le serveur les écrit sur un
 * vrai parc — et personne ne les voyait jamais sur l'écran qu'on ouvre le plus
 * souvent. C'est ainsi qu'elles ont pu s'afficher en clé brute en production
 * sans qu'aucun regard ne s'y pose, et le semis serveur seul n'y change rien :
 * `/demo` ne le lit pas.
 *
 * TROIS rappels sur le même locataire — Serge Mbarga, A3, le seul retardataire
 * du parc, et déjà le sujet de `rentOverdue` juste au-dessus. C'est le rang qui
 * donne son sens à ce journal : une relance isolée ne montre pas qu'on en est au
 * troisième rappel, et le défaut à prévenir est là — un bailleur qui relance une
 * quatrième fois sans savoir qu'il en a envoyé trois.
 *
 * Un seul est PARTI. Les deux plus récents portent un canal sans date d'envoi :
 * ce n'est pas une contradiction, c'est une tentative que le fournisseur n'a pas
 * confirmée — et `MessagerieDeJournal`, celui qui tourne aujourd'hui, rend
 * toujours faux. Sans cet écart dans le jeu, l'écran ne montrerait jamais la
 * différence entre « parti » et « resté ici », qui est précisément ce que le
 * bailleur doit lire avant de croire son locataire prévenu.
 *
 * Le `rank` est écrit ici plutôt que dérivé : sur un vrai parc il vient du
 * serveur, et le recalculer côté client en ferait une seconde source qui
 * finirait par le contredire.
 */
export const ALERTS: Alert[] = [
  { id: 'n1', kind: 'payment', message: 'rentOverdue', data: { unitId: 'A3', tenant: 'Serge Mbarga', count: 24, on: { year: 2026, month: 7, day: 4 } }, at: { value: -2, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3' },
  { id: 'r3', kind: 'payment', message: 'rentReminder', data: { tenant: 'Serge Mbarga', count: 24, amount: 115000 }, at: { value: -6, unit: 'hour' }, severity: 'high', read: false, unitId: 'A3', rank: 3, channel: 'sms', sentAt: null },
  { id: 'r2', kind: 'payment', message: 'rentReminder', data: { tenant: 'Serge Mbarga', count: 17, amount: 115000 }, at: { value: -7, unit: 'day' }, severity: 'high', read: true, unitId: 'A3', rank: 2, channel: 'sms', sentAt: null },
  { id: 'r1', kind: 'payment', message: 'rentReminder', data: { tenant: 'Serge Mbarga', count: 11, amount: 115000 }, at: { value: -13, unit: 'day' }, severity: 'medium', read: true, unitId: 'A3', rank: 1, channel: 'sms', sentAt: { year: 2026, month: 7, day: 4 } },
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
 * les tarifs pour obtenir ce qu'il affichait. Tant que le tarif ne bouge
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
  /**
   * L'identifiant de l'opérateur — « MM-4471 ». OPPOSABLE : c'est avec lui
   * qu'un locataire conteste, et il lui est donc servi comme au bailleur.
   *
   * Il était saisi à l'encaissement, écrit en base, et rendu à personne : le
   * bailleur le tapait et ne le revoyait jamais.
   */
  reference: string | null
  /**
   * L'annotation du bailleur sur son propre dossier — « solde promis le 15 ».
   *
   * `undefined` chez le LOCATAIRE, où le serveur ne l'envoie pas : c'est ce
   * qu'on écrit sur lui, du même ordre que le coût des travaux. `null` quand
   * personne n'en a écrit. Les deux absences ne disent pas la même chose.
   */
  note?: string | null
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

/**
 * L'intitulé de chaque moyen de paiement, à côté des valeurs qu'il nomme.
 *
 * IL EXISTAIT EN DEUX EXEMPLAIRES — un dans l'espace locataire, un dans la
 * modale de quittance — et le troisième allait être écrit pour les documents
 * PDF. Deux tables ne divergent pas sur les valeurs, elles divergent sur ce
 * qu'on ajoute : une cinquième façon de payer serait entrée dans l'une et pas
 * dans l'autre, et un versement aurait été rendu sans son moyen.
 *
 * Une TABLE et non une clé construite : `app.payments.method${methode}`
 * imposerait une majuscule à la volée, et `check-i18n` ne verrait plus quelles
 * clés sont employées.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  mobile: 'app.payments.methodMobile',
  cash: 'app.payments.methodCash',
  transfer: 'app.payments.methodTransfer',
  check: 'app.payments.methodCheck',
}

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
 * sont ces quantités au tarif de `TARIFS_DEMO`, calculées UNE FOIS et
 * inscrites — c'est ainsi qu'une facture se fige, et le serveur ne fait pas
 * autrement.
 *
 * Mai — `month: 4` — n'est soldé qu'en partie : 9 000 sur les 14 058 dus
 * d'électricité, une fois le loyer et l'eau couverts. C'est le cas que le
 * tableau affiche « reste … », et la seule raison pour laquelle l'imputation
 * poste par poste existe.
 */
export const TENANT_RECEIPTS: Receipt[] = [
  { year: 2026, month: 7, rentMinor: 145000, waterMinor: 8320, powerMinor: 17622, dueOn: { year: 2026, month: 7, day: 5 }, paidMinor: 170942, payments: [{ amountMinor: 170942, method: 'mobile', paidOn: { year: 2026, month: 7, day: 3 } , reference: 'MM-4471' }] },
  { year: 2026, month: 6, rentMinor: 145000, waterMinor: 7800, powerMinor: 16137, dueOn: { year: 2026, month: 6, day: 5 }, paidMinor: 168937, payments: [{ amountMinor: 168937, method: 'mobile', paidOn: { year: 2026, month: 6, day: 2 } , reference: 'MM-4318' }] },
  { year: 2026, month: 5, rentMinor: 145000, waterMinor: 7280, powerMinor: 16929, dueOn: { year: 2026, month: 5, day: 5 }, paidMinor: 169209, payments: [{ amountMinor: 169209, method: 'transfer', paidOn: { year: 2026, month: 5, day: 5 } , reference: 'VIR-20260504' }] },
  { year: 2026, month: 4, rentMinor: 145000, waterMinor: 6760, powerMinor: 14058, dueOn: { year: 2026, month: 4, day: 5 }, paidMinor: 160760, payments: [{ amountMinor: 160760, method: 'mobile', paidOn: { year: 2026, month: 4, day: 4 } , reference: 'MM-4102' }] },
  { year: 2026, month: 3, rentMinor: 145000, waterMinor: 6240, powerMinor: 15345, dueOn: { year: 2026, month: 3, day: 5 }, paidMinor: 166585, payments: [{ amountMinor: 166585, method: 'cash', paidOn: { year: 2026, month: 3, day: 2 } , reference: null }] },
  { year: 2026, month: 2, rentMinor: 145000, waterMinor: 8840, powerMinor: 16632, dueOn: { year: 2026, month: 2, day: 5 }, paidMinor: 170472, payments: [{ amountMinor: 170472, method: 'mobile', paidOn: { year: 2026, month: 2, day: 6 } , reference: 'MM-3877' }] },
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
        ? [
            {
              amountMinor: paidMinor,
              method: 'mobile' as const,
              paidOn: { year, month, day: 3 },
              /* Une référence DÉRIVÉE de la période, et non tirée au hasard :
                 deux rendus successifs de la démonstration doivent montrer le
                 même identifiant, sans quoi l'écran raconte une histoire qui
                 change à chaque rechargement. */
              reference: `MM-${String(year).slice(2)}${String(month + 1).padStart(2, '0')}`,
            },
          ]
        : [],
    })
  }
  return sortie
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((building) => building.id === id)
}
