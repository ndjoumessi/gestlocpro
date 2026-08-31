import { api } from '@/api/client'
import { partiesDeDateISO } from '@/lib/dates'
import type { PaymentStatus } from '@/components/primitives/StatusPill'
import type {
  Alert,
  AlertData,
  AlertMessage,
  ConsumptionPoint,
  Deposit,
  DocumentRequest,
  Occupation,
  Inspection,
  MeterReading,
  MonthlyCollection,
  Receipt,
  ReceiptPayment,
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
      tenant: {
        id: string
        fullName: string
        phoneE164: string | null
        /** Facultatif : un serveur antérieur à ce champ ne le rend pas. */
        hasAccount?: boolean
      } | null
      status: string
      leaseId: string | null
      /** ISO, ou `null` : bail vacant, ou serveur antérieur à ce champ. */
      leaseStartsOn?: string | null
      paidMinor: number
      overdueDays: number | null
    }[]
  }[]
  works: {
    id: string
    reference: string
    unitId: string
    title: string
    /** Ce que le déclarant a écrit sous son titre. Facultatif : il peut n'avoir rien ajouté. */
    description?: string | null
    trade: TradeKey
    status: WorkOrder['status']
    urgency: 'blocking' | 'normal' | 'low'
    quotedAmountMinor: number | null
    approvedAmountMinor: number | null
    reportedAt: string
    /** Optionnels : un serveur antérieur à ces champs ne les rend pas. */
    origin?: 'tenantReport' | 'ownerInitiative'
    reportedBy?: string | null
  }[]
  collections: { year: number; month: number; rent: number; water: number; power: number }[]
  /**
   * L'historique des échéances, plat, une entrée par période et par bail.
   *
   * Optionnel : un serveur antérieur à ce champ ne le rend pas, et l'espace du
   * locataire doit alors annoncer sa case vide plutôt que de casser.
   */
  leaseCharges?: {
    leaseId: string
    /** ISO. */
    periodStart: string
    dueOn: string
    rentMinor: number
    waterMinor: number
    powerMinor: number
    paidMinor: number
    payments: {
      amountMinor: number
      method: ReceiptPayment['method']
      paidOn: string
      /* Facultatifs : un serveur antérieur à ce lot ne les rend pas, et le
         client doit alors se taire plutôt que d'afficher « réf. undefined ». */
      reference?: string | null
      note?: string | null
    }[]
  }[]
  readings: {
    unitId: string
    utility: 'water' | 'power'
    indexValue: number | null
    previousIndex: number | null
    readAt: string | null
    /**
     * Prix unitaire applicable à la période relevée. Optionnel : un serveur
     * antérieur à ce champ ne le rend pas, et l'écran retombe alors sur
     * « aucun prix » — ce qui est le bon repli, puisqu'inventer une valeur est
     * précisément le défaut que ce champ corrige.
     */
    unitPriceMinor?: number | null
  }[]
  /**
   * Toutes les périodes relevées, en INDEX.
   *
   * Optionnel : un serveur antérieur à ce champ ne le rend pas, et l'espace du
   * locataire n'affiche alors aucune série — plutôt que de casser.
   */
  readingHistory?: {
    unitId: string
    utility: 'water' | 'power'
    /** ISO. */
    periodStart: string
    indexValue: number
  }[]
  inspections: {
    id: string
    unitId: string
    /** Optionnel : un serveur antérieur à ce champ ne le rend pas. */
    leaseId?: string | null
    kind: 'entry' | 'exit'
    performedOn: string
    rooms: number
    issues: number
    findings?: {
      id: string
      room: string
      description: string
      severity: 'minor' | 'major'
      costMinor: number | null
      /** Optionnel : un serveur antérieur à ce champ ne le rend pas. */
      photos?: { id: string; contentType: string; confirmedAt: string }[]
    }[]
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
    /** Optionnels : un serveur antérieur à ces champs ne les rend pas. */
    rank?: number | null
    channel?: 'in_app' | 'email' | 'sms'
    sentAt?: string | null
  }[]
  /** Optionnel, comme le reste de ce qui est arrivé après coup. */
  leases?: {
    id: string
    unitId: string
    tenant: string | null
    /** ISO. */
    startsOn: string
    endsOn: string | null
    rentMinor: number
    status: Occupation['status']
  }[]
  /**
   * Optionnel : un serveur antérieur à cette entité ne le rend pas, et l'écran
   * doit alors annoncer qu'il n'y a aucune demande plutôt que de casser.
   */
  documentRequests?: {
    id: string
    unitId: string
    tenant: string | null
    kind: DocumentRequest['kind']
    status: DocumentRequest['status']
    /** ISO. */
    requestedAt: string
    resolvedAt: string | null
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
  /**
   * Les périodes facturées, par BAIL et non par unité.
   *
   * C'est le bail qui porte l'historique : une unité en a autant que de
   * locataires successifs, et les regrouper par unité ferait lire à l'un les
   * quittances de l'autre. Le serveur cloisonne déjà dans ce sens — il ne rend
   * au locataire que les échéances de ses propres baux.
   */
  receiptsByLease: Record<string, Receipt[]>
  /** Les demandes de pièces, toutes unités visibles confondues. */
  documentRequests: DocumentRequest[]
  /** L'occupation des logements, baux terminés compris. */
  leases: Occupation[]
  /**
   * La consommation par unité, du plus ANCIEN au plus récent.
   *
   * L'ordre fait partie du contrat : c'est celui des barres du graphique, et le
   * trier à l'affichage supposerait que chaque appelant sache le refaire.
   */
  consumptionByUnit: Record<string, ConsumptionPoint[]>
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
        leaseStart: u.leaseStartsOn ? enParties(u.leaseStartsOn) : null,
        ...(u.leaseId !== null ? { leaseId: u.leaseId } : {}),
        ...(u.tenant ? { tenantId: u.tenant.id } : {}),
        /* `!== false` ET NON `=== true` : absent vaut « reliée ». Un serveur
           antérieur au champ peindrait sinon tout le parc d'un avertissement. */
        ...(u.tenant ? { tenantHasAccount: u.tenant.hasAccount !== false } : {}),
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
      /* LES DÉTAILS SAISIS, qui n'arrivaient pas jusqu'ici. Le serveur les
         range et les relit ; cette projection les laissait tomber, et le
         locataire ne pouvait pas relire ce qu'il avait transmis. */
      ...(w.description ? { description: w.description } : {}),
      trade: w.trade,
      status: w.status,
      /* Les DEUX montants, séparés. Le `??` d'avant perdait le devis d'origine
         dès qu'une validation existait, alors que l'écart entre proposé et
         engagé est précisément ce qu'un bailleur veut lire. */
      quotedAmount: w.quotedAmountMinor,
      approvedAmount: w.approvedAmountMinor,
      reportedAt: enParties(w.reportedAt),
      urgent: w.urgency === 'blocking',
      ...(w.origin ? { origin: w.origin } : {}),
      reportedBy: w.reportedBy ?? null,
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
          waterPrice: null,
          powerPrice: null,
        }
        if (r.utility === 'water') {
          ligne.waterPrevious = r.previousIndex ?? 0
          ligne.waterCurrent = r.indexValue
          // `?? null` et non `?? 0` : un prix absent n'est pas un prix nul. Le
          // second afficherait « 0 FCFA » sous les yeux du locataire, ce qui
          // est une affirmation ; le premier n'affiche rien, ce qui est la
          // vérité.
          ligne.waterPrice = r.unitPriceMinor ?? null
        } else {
          ligne.powerPrevious = r.previousIndex ?? 0
          ligne.powerCurrent = r.indexValue
          ligne.powerPrice = r.unitPriceMinor ?? null
        }
        if (r.readAt) ligne.readAt = enParties(r.readAt)
        parUnite.set(r.unitId, ligne)
      }
      return [...parUnite.values()]
    })(),
    inspections: data.inspections.map((i) => ({
      unitId: i.unitId,
      leaseId: i.leaseId ?? null,
      kind: i.kind,
      date: enParties(i.performedOn),
      rooms: i.rooms,
      issues: i.issues,
      // Le détail quand il vient, une liste vide sinon : l'écran distingue
      // « aucune réserve » de « détail non rendu » par le COMPTE, qui lui est
      // là depuis toujours.
      findings: (i.findings ?? []).map((r) => ({
        ...r,
        /* La date de constat passe en valeurs machine, comme toutes les autres :
           la garder en ISO figerait un format dans une interface bilingue. */
        photos: (r.photos ?? []).map((p) => ({
          id: p.id,
          contentType: p.contentType,
          confirmedAt: enParties(p.confirmedAt),
        })),
      })),
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
      ...(n.rank != null ? { rank: n.rank } : {}),
      ...(n.channel ? { channel: n.channel } : {}),
      /* `jourCalendaire` et non `new Date()` : la date d'envoi est ce qu'on
         oppose au locataire — « la relance est partie le 4 août ». En fuseau
         négatif, `new Date()` la ramènerait au 3. */
      sentAt: n.sentAt ? jourCalendaire(n.sentAt) : null,
    })),
    // Le serveur rend déjà la forme attendue : mois indexé à zéro et montants
    // entiers. Rien à convertir, ce qui est le signe que les deux modèles se
    // sont rapprochés.
    collections: data.collections,
    paidByUnit,
    leases: (data.leases ?? []).map((b) => ({
      id: b.id,
      unitId: b.unitId,
      tenant: b.tenant,
      // Des colonnes `date` : lues dans la chaîne, jamais par un fuseau. Voir
      // `jourCalendaire`.
      startsOn: jourCalendaire(b.startsOn),
      endsOn: b.endsOn ? jourCalendaire(b.endsOn) : null,
      rentMinor: b.rentMinor,
      status: b.status,
    })),
    consumptionByUnit: consommations(data.readingHistory ?? []),
    documentRequests: (data.documentRequests ?? []).map((d) => ({
      id: d.id,
      unitId: d.unitId,
      tenant: d.tenant,
      kind: d.kind,
      status: d.status,
      // `requestedAt` est un INSTANT — un horodatage, pas une colonne `date` —
      // et se lit donc dans le fuseau de qui regarde : c'est l'heure à laquelle
      // il a demandé, chez lui.
      requestedAt: enParties(d.requestedAt),
      resolvedAt: d.resolvedAt ? enParties(d.resolvedAt) : null,
    })),
    receiptsByLease: (() => {
      const parBail: Record<string, Receipt[]> = {}
      for (const e of data.leaseCharges ?? []) {
        const debut = jourCalendaire(e.periodStart)
        const ligne: Receipt = {
          year: debut.year,
          month: debut.month,
          rentMinor: e.rentMinor,
          waterMinor: e.waterMinor,
          powerMinor: e.powerMinor,
          dueOn: jourCalendaire(e.dueOn),
          paidMinor: e.paidMinor,
          payments: e.payments.map((p) => ({
            amountMinor: p.amountMinor,
            method: p.method,
            paidOn: jourCalendaire(p.paidOn),
            // `?? null` pour la référence : le champ EXISTE toujours côté
            // client, vide ou non. La note, elle, reste `undefined` quand le
            // serveur ne l'envoie pas — c'est ainsi que l'écran distingue
            // « rien d'écrit » de « pas pour vous ».
            reference: p.reference ?? null,
            ...(p.note !== undefined ? { note: p.note } : {}),
          })),
        }
        parBail[e.leaseId] = [...(parBail[e.leaseId] ?? []), ligne]
      }
      return parBail
    })(),
  }
}

/**
 * La consommation par unité et par période, DÉRIVÉE des index.
 *
 * Le serveur rend ce que le compteur porte — un index — et la consommation
 * d'une période est la différence avec l'index de la période précédente. Ce
 * sens-là seulement se dérive : d'une suite de consommations on ne remonte pas
 * aux index, et une période manquante y ferait passer deux mois pour un.
 *
 * Trois pièges habitent cette fonction, et le jeu de démonstration n'en révèle
 * aucun — d'où ces commentaires plutôt qu'une confiance dans les cas de test.
 */
export function consommations(
  historique: { unitId: string; utility: 'water' | 'power'; periodStart: string; indexValue: number }[],
): Record<string, ConsumptionPoint[]> {
  const parUnite = new Map<string, Map<string, ConsumptionPoint>>()
  const index = new Map<string, number>()

  for (const r of historique) {
    /**
     * PIÈGE 1 — `jourCalendaire`, jamais `new Date(iso).getMonth()`.
     *
     * `periodStart` est une colonne `@db.Date` sérialisée à minuit UTC. En
     * fuseau négatif, `getMonth()` recule d'un jour et donc parfois d'un mois :
     * toute la série glisserait d'un cran. Et `vitest.config.ts` force
     * `TZ: 'UTC'` — pour que les formats d'`Intl` soient stables —, fuseau où
     * la version fautive donne exactement le même résultat. Aucun cas ne peut
     * attraper ce défaut ; seule sa disparition le prévient.
     */
    const { year, month } = jourCalendaire(r.periodStart)
    const clePeriode = `${year}-${month}`
    index.set(`${r.unitId}|${r.utility}|${clePeriode}`, r.indexValue)
    const periodes = parUnite.get(r.unitId) ?? new Map<string, ConsumptionPoint>()
    if (!periodes.has(clePeriode)) periodes.set(clePeriode, { year, month, water: null, power: null })
    parUnite.set(r.unitId, periodes)
  }

  const resultat: Record<string, ConsumptionPoint[]> = {}
  for (const [unitId, periodes] of parUnite) {
    const points = [...periodes.values()].sort((a, b) => a.year - b.year || a.month - b.month)
    for (const point of points) {
      /**
       * PIÈGE 2 — le mois précédent DU CALENDRIER, et non le point précédent
       * de la liste.
       *
       * C'est ce qui distingue un trou d'une série courte. Si février manque et
       * qu'on prend « le point d'avant », janvier devient l'antérieur de mars :
       * deux mois de consommation s'inscrivent sur une seule barre, et mars
       * paraît anormal alors qu'il ne l'est pas.
       */
      const avant =
        point.month === 0
          ? { year: point.year - 1, month: 11 }
          : { year: point.year, month: point.month - 1 }

      for (const fluide of ['water', 'power'] as const) {
        const courant = index.get(`${unitId}|${fluide}|${point.year}-${point.month}`)
        const anterieur = index.get(`${unitId}|${fluide}|${avant.year}-${avant.month}`)
        // L'un des deux manque : rien n'est dérivable, et `null` le dit. Un
        // repli sur `courant` afficherait l'index brut — 250 m³ en une barre.
        if (courant === undefined || anterieur === undefined) continue
        /**
         * PIÈGE 3 — un compteur ne tourne pas à l'envers.
         *
         * Un index qui recule est un remplacement de compteur, une reprise de
         * saisie ou une faute de frappe. La différence serait négative, la
         * barre partirait sous l'axe, et le locataire lirait une consommation
         * qui n'existe pas. On ne sait pas : `null`.
         */
        point[fluide] = courant >= anterieur ? courant - anterieur : null
      }
    }
    resultat[unitId] = points
  }
  return resultat
}

/**
 * Un jour du calendrier, LU DANS LA CHAÎNE et non par un fuseau.
 *
 * Ces champs viennent de colonnes `date` : le serveur les sérialise à minuit
 * UTC, et elles ne désignent pas un instant mais un jour. `new Date(iso)` suivi
 * de `getMonth()` les décale d'un jour — donc parfois d'un mois — à l'ouest de
 * Greenwich : « juin 2026 » se lirait « mai 2026 » sur toute la colonne, pour
 * un locataire à Douala comme pour un serveur déployé n'importe où. Le même
 * piège a déjà pris le serveur en écrivant ces dates ; le commentaire de
 * `demo.ts` le raconte.
 *
 * Découper la chaîne retire la question. Et il le faut : la suite de tests
 * s'exécute avec `TZ: 'UTC'` — pour que les formats d'`Intl` soient stables —,
 * fuseau où la version fautive donne exactement le même résultat. Aucun cas
 * n'aurait pu attraper ce défaut ; seule sa disparition le prévient.
 */
const jourCalendaire = partiesDeDateISO

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
