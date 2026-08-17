import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { creerCode, expirationInvitation } from './invitations.js'
import { laMessagerie } from '../messagerie/messagerie.js'
import { exigerAppartenance, exigerCompte, exigerRole, unitesVisibles } from '../auth/guards.js'

export const parksRouter = Router()

const schemaArbitrage = z
  .object({
    withheldMinor: z.number().int().min(0),
    reason: z.string().trim().min(3).max(2000).optional(),
  })
  /**
   * Une retenue exige sa justification, et la règle est ici plutôt que dans le
   * seul formulaire : « un décompte sans motif est indéfendable », dit le
   * commentaire de la modale — ce qui reste vrai quand la requête ne vient pas
   * d'elle.
   */
  .refine((v) => v.withheldMinor === 0 || Boolean(v.reason), {
    message: 'Une retenue doit être justifiée',
    path: ['reason'],
  })

/**
 * Un immeuble : un nom, un quartier.
 *
 * Ni nombre de logements ni taux d'occupation — ce sont des comptages, dérivés
 * des unités, et le schéma de base le dit déjà. Les demander à la saisie
 * créerait deux vérités sur la même chose, et elles divergeraient au premier
 * logement ajouté.
 */
const schemaImmeuble = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères').max(120),
  district: z.string().trim().min(2, 'Au moins 2 caractères').max(120),
})

/**
 * Un logement dans un immeuble.
 *
 * `label` n'est pas une clé — « A1 » existe dans presque tous les immeubles du
 * monde — mais il doit rester unique DANS son immeuble, sans quoi deux lignes
 * indiscernables apparaîtraient à l'écran et le gestionnaire encaisserait sur
 * la mauvaise.
 *
 * Le loyer est en unités mineures, entier. Un flottant introduirait des demi-
 * francs qui ne se somment pas juste sur douze mois.
 */
const schemaLogement = z.object({
  label: z.string().trim().min(1, 'Requis').max(20),
  type: z.enum(['T1', 'T2', 'T3', 'T4']),
  surfaceSqm: z.number().int().positive().max(10_000),
  baseRentMinor: z.number().int().nonnegative(),
})

/**
 * Un encaissement, imputé sur une PÉRIODE et non sur un logement.
 *
 * Le montant peut être partiel — c'est le cas courant et non l'exception : on
 * paie ce qu'on peut, quand on peut. Interdire le partiel forcerait le
 * gestionnaire à ne rien enregistrer, donc à perdre la trace du versement.
 *
 * Le paiement ne se déduit PAS du mois en cours : un versement enregistré le 2
 * août peut couvrir juillet. Deviner la période produirait des mois soldés à
 * tort et des impayés fantômes.
 */
const schemaEncaissement = z.object({
  unitId: z.string().uuid(),
  /** Premier jour de la période couverte, `AAAA-MM-01`. */
  periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, 'Période attendue au format AAAA-MM-01'),
  amountMinor: z.number().int().positive('Un encaissement est strictement positif'),
  method: z.enum(['mobile', 'cash', 'transfer', 'check']),
  /** Date du versement. Par défaut aujourd'hui. */
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
    .optional(),
  reference: z.string().trim().max(80).optional(),
})

/** Émission d'un document pour une période donnée. */
const schemaQuittance = z.object({
  unitId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, 'Période attendue au format AAAA-MM-01'),
})

/**
 * Émission d'une invitation.
 *
 * L'unité n'a de sens que pour un locataire : on invite quelqu'un DANS un
 * logement. Un gestionnaire opère tout le parc, et lui attacher une unité
 * laisserait croire à un périmètre qui n'existe pas.
 */
const schemaInvitation = z.object({
  role: z.enum(['tenant', 'manager']),
  unitId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Numéro attendu au format international')
    .optional(),
})

/**
 * Les BAUX à relancer, et non les échéances.
 *
 * Première rédaction : `chargeIds`. C'était calquer le contrat sur le modèle de
 * données plutôt que sur le geste. On ne relance pas un mois, on relance un
 * locataire — et celui qui doit juin ET juillet ne reçoit pas deux courriers.
 * Désigner une échéance aurait obligé le client à en choisir une, arbitrairement.
 *
 * Le client calcule qui est en retard — c'est lui qui l'affiche — mais il n'en
 * est pas l'AUTORITÉ : chaque bail est revérifié ici. Sans cela, un client
 * fautif, ancien ou malveillant relancerait un locataire à jour, et une relance
 * indue coûte plus cher qu'une relance manquée.
 */
const schemaRelance = z.object({
  leaseIds: z.array(z.string().uuid()).min(1).max(200),
})

/**
 * Mise en demeure : le motif est OBLIGATOIRE.
 *
 * C'est l'acte le plus engageant du produit — il précède la résiliation et se
 * produit devant un juge. Une trace sans motif est indéfendable, exactement
 * comme la retenue sur caution dont la justification était jetée.
 */
const schemaMiseEnDemeure = z.object({
  reason: z.string().trim().min(10).max(2000),
})

/** Une intervention déclarée : ce qu'on sait au moment où le problème remonte. */
const schemaIntervention = z.object({
  title: z.string().trim().min(3).max(160),
  trade: z.enum(['plumbing', 'power', 'painting', 'multi', 'lock', 'other']),
  urgency: z.enum(['blocking', 'normal', 'low']).default('normal'),
  description: z.string().trim().max(2000).optional(),
})

/** Le devis proposé par le gestionnaire. Le propriétaire arbitrera. */
const schemaDevis = z.object({
  quotedAmountMinor: z.number().int().positive('Un devis est strictement positif'),
})

/** Achèvement. La date est facultative : par défaut, aujourd'hui. */
const schemaAchevement = z.object({
  completedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
    .optional(),
})

const schemaLocataire = z.object({
  unitId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Numéro attendu au format international')
    .optional(),
  /**
   * Début du bail, et non « aujourd'hui ».
   *
   * La route posait systématiquement la date du jour. Un propriétaire qui
   * déclare ses locataires DÉJÀ EN PLACE — le cas de tout nouveau compte —
   * enregistrait donc de fausses dates, et l'ancienneté comme les impayés
   * cumulés en découlaient faux. Le champ reste facultatif : un vrai
   * emménagement du jour n'a rien à saisir.
   *
   * `YYYY-MM-DD` interprété en UTC : la colonne est de type `date`, et une
   * date construite à minuit local recule d'un jour au passage.
   */
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
    .optional(),
  /**
   * Loyer du bail, qui peut différer du loyer de référence du logement.
   *
   * Un loyer négocié, un ancien bail non revalorisé, un meublé : le montant
   * réellement dû est celui du contrat. Le loyer de référence sert à proposer,
   * pas à décider.
   */
  rentMinor: z.number().int().nonnegative().optional(),
})

parksRouter.use(exigerCompte)

/** Parcs auxquels le compte appartient. */
parksRouter.get('/', async (req: Request, res: Response) => {
  const adhesions = await prisma.membership.findMany({
    where: { userId: req.compteId!, status: 'active' },
    select: {
      role: true,
      park: { select: { id: true, name: true, currency: true, countryCode: true, delegation: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({
    parks: adhesions.map((a) => ({
      id: a.park.id,
      name: a.park.name,
      currency: a.park.currency,
      countryCode: a.park.countryCode,
      delegation: a.park.delegation,
      role: a.role,
    })),
  })
})

/**
 * Statut d'une échéance, **calculé**.
 *
 * Le client portait `Unit.status`, une colonne qui répondait à deux questions à
 * la fois. Ici l'occupation est l'existence d'un bail, et l'état du règlement
 * se déduit des versements réellement enregistrés. Rien n'est stocké : un
 * statut figé se désynchronise du premier encaissement.
 */
function statut(
  echeance: { rentMinor: number; dueOn: Date; payments: { amountMinor: number }[] } | undefined,
  aujourdhui: Date,
): { status: string; paidMinor: number; overdueDays: number | null } {
  if (!echeance) return { status: 'pending', paidMinor: 0, overdueDays: null }

  const paidMinor = echeance.payments.reduce((somme, p) => somme + p.amountMinor, 0)
  if (paidMinor >= echeance.rentMinor) return { status: 'paid', paidMinor, overdueDays: null }

  // Le retard se compte, il ne se stocke pas : `overdueDays: 24` était écrit à
  // la main dans le client et ne grandissait jamais.
  const jours = Math.floor((aujourdhui.getTime() - echeance.dueOn.getTime()) / 86_400_000)
  const enRetard = jours > 0

  if (paidMinor > 0) return { status: 'partial', paidMinor, overdueDays: enRetard ? jours : null }
  return { status: enRetard ? 'overdue' : 'pending', paidMinor, overdueDays: enRetard ? jours : null }
}

/**
 * Le parc tel que l'interface l'affiche : immeubles, unités, bail courant.
 *
 * Le cloisonnement du locataire est posé **dans la requête** — voir
 * `unitesVisibles`. Filtrer après lecture supposerait d'avoir d'abord tout
 * chargé, et il suffirait d'un oubli sur un chemin pour que les baux des
 * voisins sortent.
 */
parksRouter.get(
  '/:parkId/portfolio',
  exigerAppartenance,
  async (req: Request, res: Response) => {
    const { parkId, role } = req.adhesion!
    const visibles = await unitesVisibles(parkId, req.compteId!, role)
    const aujourdhui = new Date()

    const immeubles = await prisma.building.findMany({
      where: { parkId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        district: true,
        units: {
          where: visibles ? { id: { in: visibles.map((u) => u.id) } } : {},
          orderBy: { label: 'asc' },
          select: {
            id: true,
            label: true,
            type: true,
            surfaceSqm: true,
            baseRentMinor: true,
            leases: {
              where: { status: { in: ['active', 'pending'] } },
              take: 1,
              select: {
                id: true,
                rentMinor: true,
                tenant: { select: { id: true, fullName: true, phoneE164: true } },
                deposit: {
                  select: { heldMinor: true, withheldMinor: true, status: true },
                },
                charges: {
                  orderBy: { periodStart: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    periodStart: true,
                    dueOn: true,
                    rentMinor: true,
                    payments: { select: { amountMinor: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    const buildings = immeubles.map((b) => ({
      id: b.id,
      name: b.name,
      district: b.district,
      units: b.units.map((u) => {
        const bail = u.leases[0]
        const echeance = bail?.charges[0]
        const { status, paidMinor, overdueDays } = bail
          ? statut(echeance, aujourdhui)
          : { status: 'vacant', paidMinor: 0, overdueDays: null }

        return {
          id: u.id,
          label: u.label,
          type: u.type,
          surfaceSqm: u.surfaceSqm,
          rentMinor: bail?.rentMinor ?? u.baseRentMinor,
          // `null` et non une chaîne : l'unité n'a pas de locataire, elle n'en
          // a pas un qui s'appellerait « vacant ».
          tenant: bail?.tenant ? { id: bail.tenant.id, fullName: bail.tenant.fullName, phoneE164: bail.tenant.phoneE164 } : null,
          leaseId: bail?.id ?? null,
          status,
          paidMinor,
          overdueDays,
          deposit: bail?.deposit ?? null,
        }
      }),
    }))

    /**
     * Travaux et cautions voyagent dans la MÊME réponse.
     *
     * Trois requêtes séparées arriveraient dans un ordre indéterminé, et
     * l'interface afficherait un parc à jour à côté de cautions périmées le
     * temps que la dernière revienne. C'est aussi ce que faisait `loadState()`
     * — un seul état, cohérent d'un bloc.
     */
    const idsVisibles = visibles?.map((u) => u.id)
    const filtreUnite = idsVisibles ? { in: idsVisibles } : undefined

    const [travaux, cautions, releves, etatsDesLieux, notifications, echeances] = await Promise.all([
      prisma.workOrder.findMany({
        where: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        orderBy: { reportedAt: 'desc' },
        select: {
          id: true,
          reference: true,
          unitId: true,
          title: true,
          description: true,
          trade: true,
          status: true,
          urgency: true,
          quotedAmountMinor: true,
          approvedAmountMinor: true,
          reportedAt: true,
        },
      }),
      prisma.deposit.findMany({
        where: {
          lease: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        },
        select: {
          id: true,
          heldMinor: true,
          withheldMinor: true,
          withheldReason: true,
          status: true,
          lease: {
            select: { unitId: true, tenant: { select: { fullName: true } }, endsOn: true },
          },
        },
      }),
      prisma.meterReading.findMany({
        where: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        orderBy: [{ unitId: 'asc' }, { utility: 'asc' }, { periodStart: 'desc' }],
        select: { id: true, unitId: true, utility: true, periodStart: true, indexValue: true, readAt: true },
      }),
      prisma.inspection.findMany({
        where: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        orderBy: { performedOn: 'asc' },
        select: {
          id: true,
          unitId: true,
          kind: true,
          performedOn: true,
          rooms: true,
          signedAt: true,
          _count: { select: { findings: true } },
        },
      }),
      prisma.notification.findMany({
        where: {
          parkId,
          // Le locataire ne reçoit que ce qui concerne SES unités. Une
          // notification sans unité — un relevé manquant sur le parc — ne le
          // regarde pas : elle s'adresse à qui gère.
          ...(idsVisibles ? { unitId: { in: idsVisibles } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          messageKey: true,
          params: true,
          severity: true,
          unitId: true,
          createdAt: true,
          recipients: { where: { userId: req.compteId! }, select: { readAt: true } },
        },
      }),
      /**
       * Encaissements par période, calculés sur les échéances du parc.
       *
       * `COLLECTIONS` était une constante de douze mois côté client, cohérente
       * en elle-même et reliée à rien : la ligne d'objectif du graphique
       * annonçait « 1,4 M » quand la somme des loyers vaut 1 397 000.
       */
      prisma.rentCharge.findMany({
        where: {
          lease: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        },
        select: {
          periodStart: true,
          rentMinor: true,
          waterMinor: true,
          powerMinor: true,
          payments: { select: { amountMinor: true } },
        },
      }),
    ])

    /**
     * Le mois porte ce qui a été ENCAISSÉ, non ce qui était dû.
     *
     * Un graphique d'encaissements qui afficherait les loyers appelés serait
     * plat : c'est l'écart entre l'appelé et le reçu qui a un sens, et c'est
     * lui que la dernière barre montre.
     */
    const parPeriode = new Map<string, { year: number; month: number; rent: number; water: number; power: number }>()
    for (const e of echeances) {
      const cle = `${e.periodStart.getFullYear()}-${e.periodStart.getMonth()}`
      const ligne = parPeriode.get(cle) ?? {
        year: e.periodStart.getFullYear(),
        month: e.periodStart.getMonth(),
        rent: 0,
        water: 0,
        power: 0,
      }
      const verse = e.payments.reduce((s, p) => s + p.amountMinor, 0)
      // Le versement solde d'abord le loyer, puis les charges : c'est l'ordre
      // d'imputation usuel, et un règlement partiel doit se voir sur le loyer.
      const surLoyer = Math.min(verse, e.rentMinor)
      const reste = verse - surLoyer
      ligne.rent += surLoyer
      ligne.water += Math.min(reste, e.waterMinor)
      ligne.power += Math.max(0, Math.min(reste - e.waterMinor, e.powerMinor))
      parPeriode.set(cle, ligne)
    }

    res.json({
      collections: [...parPeriode.values()].sort(
        (a, b) => a.year - b.year || a.month - b.month,
      ),
      buildings,
      /**
       * L'index précédent est DÉRIVÉ de la période antérieure.
       *
       * Le client le stockait dans la ligne du mois courant — la copie d'un
       * relevé qui existait ailleurs, libre de diverger. Ici les deux relevés
       * sont deux lignes, et le précédent se lit ; c'est tout l'intérêt de
       * stocker un index plutôt qu'un couple.
       */
      /**
       * Un relevé par (unité, fluide) pour la PÉRIODE COURANTE, avec l'index
       * antérieur dérivé.
       *
       * La distinction compte : une unité peut avoir un index le mois dernier
       * et aucun ce mois-ci — c'est précisément « relevé manquant ». Rendre le
       * dernier index connu, quelle que soit sa période, effacerait le manque
       * et laisserait croire la facturation complète.
       *
       * Le client, lui, stockait `waterPrevious` dans la ligne du mois : la
       * copie d'un relevé existant ailleurs, libre de diverger.
       */
      readings: (() => {
        const periodeCourante = releves.reduce<Date | null>(
          (max, r) => (!max || r.periodStart > max ? r.periodStart : max),
          null,
        )
        const paires = new Map<string, { unitId: string; utility: string }>()
        for (const r of releves) paires.set(`${r.unitId}|${r.utility}`, { unitId: r.unitId, utility: r.utility })

        return [...paires.values()].map(({ unitId, utility }) => {
          const pour = releves.filter((r) => r.unitId === unitId && r.utility === utility)
          const courant = pour.find((r) => periodeCourante && +r.periodStart === +periodeCourante)
          const anterieur = pour.find((r) => !periodeCourante || +r.periodStart !== +periodeCourante)
          return {
            unitId,
            utility,
            periodStart: periodeCourante,
            indexValue: courant?.indexValue ?? null,
            previousIndex: anterieur?.indexValue ?? null,
            readAt: courant?.readAt ?? null,
          }
        })
      })(),
      inspections: etatsDesLieux.map((i) => ({
        id: i.id,
        unitId: i.unitId,
        kind: i.kind,
        performedOn: i.performedOn,
        rooms: i.rooms,
        // Le compte des réserves plutôt que leur détail : c'est ce que l'écran
        // affiche, et le détail n'a pas encore d'écran pour le montrer.
        issues: i._count.findings,
        signedAt: i.signedAt,
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        messageKey: n.messageKey,
        params: n.params,
        severity: n.severity,
        unitId: n.unitId,
        createdAt: n.createdAt,
        // L'état « lu » appartient au couple destinataire × notification : le
        // client le tenait dans un `Set` de session, invisible de la barre
        // latérale — la pastille annonçait « 2 » même après tout avoir lu.
        read: n.recipients[0]?.readAt !== null && n.recipients[0]?.readAt !== undefined,
      })),
      works: travaux,
      deposits: cautions.map((d) => ({
        id: d.id,
        unitId: d.lease.unitId,
        // `null` quand le bail est terminé : l'interface nomme alors « ancien
        // locataire » dans sa langue, plutôt que de recevoir ce libellé figé.
        tenant: d.lease.endsOn ? null : (d.lease.tenant?.fullName ?? null),
        heldMinor: d.heldMinor,
        withheldMinor: d.withheldMinor,
        withheldReason: d.withheldReason,
        status: d.status,
      })),
    })
  },
)

/**
 * Validation d'un devis — le droit qui distingue le propriétaire du gestionnaire.
 *
 * Le client l'appliquait par un `canApprove = role === 'owner'` qui masquait un
 * bouton. Un devis validé engage une dépense : la règle doit tenir quand la
 * requête ne vient pas de l'interface, et c'est `exigerRole` qui l'impose ici.
 */
parksRouter.patch(
  '/:parkId/works/:workId/approve',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const workId = typeof req.params.workId === 'string' ? req.params.workId : ''

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: { id: true, quotedAmountMinor: true, status: true },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (travail.status !== 'quoted') {
      // Valider deux fois n'est pas anodin : le second appel écraserait la date
      // et l'auteur du premier.
      res.status(409).json({ error: 'not_quoted' })
      return
    }

    const maj = await prisma.workOrder.update({
      where: { id: travail.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedById: req.compteId!,
        // Le montant est figé au moment de la validation : un devis révisé
        // ensuite ne doit pas réécrire ce qui a été engagé.
        approvedAmountMinor: travail.quotedAmountMinor,
      },
      select: { id: true, status: true, approvedAmountMinor: true, approvedAt: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'work.approve',
        entity: 'WorkOrder',
        entityId: travail.id,
        payload: { approvedAmountMinor: travail.quotedAmountMinor },
      },
    })

    res.json({ work: maj })
  },
)

/** Arbitrage d'une caution — second droit réservé au propriétaire. */
parksRouter.patch(
  '/:parkId/deposits/:depositId/settle',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const depositId = typeof req.params.depositId === 'string' ? req.params.depositId : ''
    const corps = schemaArbitrage.parse(req.body)

    const caution = await prisma.deposit.findFirst({
      where: { id: depositId, lease: { unit: { building: { parkId } } } },
      select: { id: true, heldMinor: true },
    })
    if (!caution) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (corps.withheldMinor > caution.heldMinor) {
      res.status(422).json({ error: 'withheld_exceeds_held' })
      return
    }

    const maj = await prisma.deposit.update({
      where: { id: caution.id },
      data: {
        withheldMinor: corps.withheldMinor,
        // La justification que la modale rend obligatoire, et que
        // `settleDeposit` jetait : le seul texte qui défendrait la décision
        // devant un locataire était le seul qu'on ne conservait pas.
        withheldReason: corps.reason ?? null,
        status: 'returned',
        settledAt: new Date(),
        settledById: req.compteId!,
      },
      select: { id: true, withheldMinor: true, withheldReason: true, status: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'deposit.settle',
        entity: 'Deposit',
        entityId: caution.id,
        payload: { withheldMinor: corps.withheldMinor, reason: corps.reason ?? null },
      },
    })

    res.json({ deposit: maj })
  },
)

/**
 * Crée un immeuble dans le parc.
 *
 * Première pierre de la saisie : jusqu'ici, un propriétaire pouvait créer son
 * compte et rien en faire — tous les écrans opéraient sur un parc qu'aucune
 * route ne permettait de constituer.
 *
 * Le nom n'est pas contraint à l'unicité. Deux immeubles peuvent légitimement
 * porter le même nom dans deux quartiers, et refuser la saisie sur cette base
 * ferait perdre du temps à celui qui a raison.
 */
parksRouter.post(
  '/:parkId/buildings',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaImmeuble.parse(req.body)

    const immeuble = await prisma.building.create({
      data: { parkId, name: corps.name, district: corps.district },
      select: { id: true, name: true, district: true },
    })

    res.status(201).json({ building: immeuble })
  },
)

/**
 * Supprime un immeuble, à la condition qu'il soit VIDE.
 *
 * Il n'existait aucun moyen de défaire une création. Le nom n'étant
 * délibérément pas contraint à l'unicité — deux immeubles peuvent légitimement
 * porter le même dans deux quartiers —, une saisie en double produisait deux
 * entrées rigoureusement indiscernables : mêmes puces de filtre, mêmes cartes,
 * deux lignes identiques dans le choix d'immeuble à la création d'un logement.
 * L'utilisateur ne pouvait ni les distinguer ni en retirer une. Toute faute de
 * frappe était définitive.
 *
 * La garde porte sur le VIDE et non sur un drapeau de confirmation : un
 * immeuble qui porte des logements porte aussi des baux, des cautions et des
 * encaissements, et rien ici ne doit pouvoir emporter tout cela en cascade. On
 * refuse, et l'écran dira quoi vider d'abord.
 *
 * 409 et non 400 : la requête est bien formée, c'est l'état du parc qui s'y
 * oppose — même distinction que pour un numéro de logement déjà pris.
 *
 * Les deux rôles qui créent peuvent défaire : annuler sa propre saisie n'est
 * pas un pouvoir nouveau, et la garde du vide borne déjà ce qu'on risque.
 */
parksRouter.delete(
  '/:parkId/buildings/:buildingId',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const buildingId = z.string().uuid().parse(req.params.buildingId)

    // Cherché AVEC le `parkId` : sans cela un identifiant deviné permettrait de
    // supprimer l'immeuble d'un autre. Absent, on rend 404 et non 403 — un 403
    // confirmerait son existence.
    const immeuble = await prisma.building.findFirst({
      where: { id: buildingId, parkId },
      select: { id: true, _count: { select: { units: true } } },
    })
    if (!immeuble) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    if (immeuble._count.units > 0) {
      res.status(409).json({ error: 'building_not_empty' })
      return
    }

    await prisma.building.delete({ where: { id: immeuble.id } })
    res.status(204).end()
  },
)

/**
 * Crée un logement dans un immeuble du parc.
 *
 * L'immeuble est cherché AVEC le `parkId` : sans cela, un identifiant deviné
 * permettrait d'ajouter un logement dans l'immeuble d'un autre. Absent, on rend
 * 404 et non 403 — un 403 confirmerait son existence.
 */
parksRouter.post(
  '/:parkId/buildings/:buildingId/units',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaLogement.parse(req.body)
    // Le paramètre d'adresse est typé « string | string[] » : on le contraint
    // avant de l'utiliser en filtre, plutôt que de le forcer par une assertion.
    const buildingId = z.string().uuid().parse(req.params.buildingId)

    const immeuble = await prisma.building.findFirst({
      where: { id: buildingId, parkId },
      select: { id: true },
    })
    if (!immeuble) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const existant = await prisma.unit.findFirst({
      where: { buildingId: immeuble.id, label: corps.label },
      select: { id: true },
    })
    if (existant) {
      // 409 et non 400 : la saisie est bien formée, c'est l'état du parc qui
      // s'y oppose. L'écran doit pouvoir distinguer « corrigez votre saisie »
      // de « ce numéro est déjà pris ».
      res.status(409).json({ error: 'label_taken' })
      return
    }

    const logement = await prisma.unit.create({
      data: {
        buildingId: immeuble.id,
        label: corps.label,
        type: corps.type,
        surfaceSqm: corps.surfaceSqm,
        baseRentMinor: corps.baseRentMinor,
      },
      select: { id: true, buildingId: true, label: true, type: true, surfaceSqm: true, baseRentMinor: true },
    })

    res.status(201).json({ unit: logement })
  },
)

/**
 * Enregistre un encaissement sur la période d'un logement.
 *
 * L'écran affichait « Paiement enregistré · quittance envoyée » sans rien
 * écrire nulle part. C'est le mensonge le plus coûteux d'un logiciel de
 * gestion : le gestionnaire repart en croyant l'argent tracé, et l'impayé
 * réapparaît le mois suivant sans qu'on sache si le locataire a payé.
 *
 * L'échéance est créée si elle n'existe pas, au loyer FIGÉ du bail — pas au
 * loyer courant du logement : refacturer juillet au tarif d'août est faux, et
 * rien ne le signalerait.
 */
parksRouter.post(
  '/:parkId/payments',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaEncaissement.parse(req.body)

    const bail = await prisma.lease.findFirst({
      where: { unitId: corps.unitId, unit: { building: { parkId } }, status: { not: 'ended' } },
      select: { id: true, rentMinor: true },
      orderBy: { startsOn: 'desc' },
    })
    if (!bail) {
      // Ni bail ni logement dans ce parc : on ne distingue pas les deux cas,
      // pour ne rien confirmer à qui aurait deviné un identifiant.
      res.status(404).json({ error: 'not_found' })
      return
    }

    const debut = new Date(`${corps.periodStart}T00:00:00Z`)

    const paiement = await prisma.$transaction(async (tx) => {
      const echeance = await tx.rentCharge.upsert({
        where: { leaseId_periodStart: { leaseId: bail.id, periodStart: debut } },
        // L'échéance existante n'est jamais réécrite : son loyer a été figé à
        // l'émission, et l'encaissement ne doit pas le corriger après coup.
        update: {},
        create: {
          leaseId: bail.id,
          periodStart: debut,
          // Échéance au premier du mois couvert, faute de règle contractuelle
          // saisie — c'est l'usage, et c'est révisable sans réécrire l'histoire.
          dueOn: debut,
          rentMinor: bail.rentMinor,
        },
        select: { id: true },
      })

      return tx.payment.create({
        data: {
          chargeId: echeance.id,
          amountMinor: corps.amountMinor,
          method: corps.method,
          paidOn: corps.paidOn ? new Date(`${corps.paidOn}T00:00:00Z`) : new Date(),
          ...(corps.reference ? { reference: corps.reference } : {}),
          // Un versement en espèces sans auteur est incontestable, donc
          // indéfendable. Le schéma l'exige déjà ; la route le fournit.
          recordedById: req.compteId!,
        },
        select: { id: true, amountMinor: true, method: true, paidOn: true },
      })
    })

    res.status(201).json({ payment: paiement })
  },
)

/**
 * Émet une quittance — ou un reçu — pour une période.
 *
 * Un document qui ATTESTE, et c'est ce qui le distingue de tous les écrans du
 * produit. Une quittance vaut preuve pour le locataire : un bailleur ne peut
 * pas la reprendre, et l'émettre pour un mois non soldé est une faute.
 *
 * D'où la règle qui gouverne tout le reste : **quittance seulement si la
 * période est intégralement soldée**. En deçà, on émet un REÇU, qui n'atteste
 * que le montant reçu. Confondre les deux ferait signer au bailleur une preuve
 * de paiement qu'il n'a pas reçu.
 *
 * Les montants sont ceux de la base, jamais recalculés à partir d'un état
 * d'écran : c'est la seule façon qu'un document réémis en octobre rende
 * exactement celui de juillet.
 */
parksRouter.post(
  '/:parkId/receipts',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaQuittance.parse(req.body)
    const debut = new Date(`${corps.periodStart}T00:00:00Z`)

    const echeance = await prisma.rentCharge.findFirst({
      where: {
        periodStart: debut,
        lease: { unitId: corps.unitId, unit: { building: { parkId } } },
      },
      include: {
        payments: {
          select: { amountMinor: true, method: true, paidOn: true, reference: true },
          orderBy: { paidOn: 'asc' },
        },
        lease: {
          select: {
            rentMinor: true,
            tenant: { select: { fullName: true } },
            unit: { select: { label: true, building: { select: { name: true, district: true } } } },
          },
        },
      },
    })
    if (!echeance) {
      // Aucune échéance pour cette période : il n'y a rien à attester. On ne
      // fabrique pas un document vide, qui laisserait croire à un mois traité.
      res.status(404).json({ error: 'not_found' })
      return
    }

    const du = echeance.rentMinor + echeance.waterMinor + echeance.powerMinor
    const encaisse = echeance.payments.reduce((total, p) => total + p.amountMinor, 0)
    // Le solde peut être négatif — un trop-perçu. On le rend tel quel : le
    // ramener à zéro effacerait une avance que le locataire pourra réclamer.
    const solde = du - encaisse

    const document = {
      kind: solde <= 0 ? ('quittance' as const) : ('recu' as const),
      periodStart: corps.periodStart,
      tenant: echeance.lease.tenant.fullName,
      unit: echeance.lease.unit.label,
      building: echeance.lease.unit.building.name,
      district: echeance.lease.unit.building.district,
      rentMinor: echeance.rentMinor,
      waterMinor: echeance.waterMinor,
      powerMinor: echeance.powerMinor,
      dueMinor: du,
      paidMinor: encaisse,
      balanceMinor: solde,
      payments: echeance.payments.map((p) => ({
        amountMinor: p.amountMinor,
        method: p.method,
        paidOn: p.paidOn.toISOString().slice(0, 10),
        reference: p.reference,
      })),
    }

    /**
     * L'émission est tracée.
     *
     * Elle sert le jour où un locataire dit « je n'ai jamais reçu ma quittance
     * de mars » : la trace dit qui l'a émise et quand. Elle n'empêche pas la
     * réémission — un document perdu doit pouvoir être refait — elle la
     * consigne.
     */
    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'receipt.issued',
        entity: 'RentCharge',
        entityId: echeance.id,
        payload: { kind: document.kind, periodStart: corps.periodStart, paidMinor: encaisse },
      },
    })

    res.status(201).json({ document })
  },
)

/**
 * Émet un code d'invitation pour rejoindre le parc.
 *
 * Le modèle décrivait ces codes depuis l'origine et rien ne les écrivait :
 * l'assistant d'inscription en réclamait un, le validait, et il n'existait
 * aucun code valide à saisir. La promesse était complète, la mécanique absente.
 *
 * Le code CLAIR n'est rendu qu'ici, une seule fois. Il n'est jamais relu depuis
 * la base — seule son empreinte y est stockée — de sorte qu'une sauvegarde, un
 * journal ou une copie de développement ne donnent accès à aucun parc. Le
 * propriétaire qui le perd en émet un autre ; c'est le bon coût.
 */
parksRouter.post(
  '/:parkId/invitations',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaInvitation.parse(req.body)

    if (corps.unitId) {
      // L'unité doit appartenir au parc : sans cette vérification, un
      // identifiant deviné rattacherait un locataire au logement d'un autre.
      const unite = await prisma.unit.findFirst({
        where: { id: corps.unitId, building: { parkId } },
        select: { id: true },
      })
      if (!unite) {
        res.status(404).json({ error: 'not_found' })
        return
      }
    }

    const code = creerCode(corps.role)
    const invitation = await prisma.invitation.create({
      data: {
        parkId,
        role: corps.role,
        codeHash: code.hash,
        codeHint: code.indice,
        ...(corps.email ? { email: corps.email } : {}),
        ...(corps.phoneE164 ? { phoneE164: corps.phoneE164 } : {}),
        ...(corps.unitId ? { unitId: corps.unitId } : {}),
        issuedById: req.compteId!,
        expiresAt: expirationInvitation(new Date()),
      },
      select: { id: true, role: true, codeHint: true, expiresAt: true },
    })

    /**
     * Tentative d'envoi, dont l'échec ne fait PAS échouer l'émission.
     *
     * Le code reste valable même si le SMS ne part pas : le propriétaire peut
     * le dicter. Refuser l'invitation parce que l'envoi a échoué perdrait le
     * code au lieu de sauver le message.
     *
     * `envoye` est rendu au client pour qu'il dise la vérité : « envoyé par
     * SMS » quand c'est vrai, « transmettez-le vous-même » sinon. Tant
     * qu'aucun fournisseur n'est configuré, c'est toujours le second.
     */
    let envoye = false
    if (corps.phoneE164) {
      try {
        envoye = await laMessagerie().envoyerSms(
          corps.phoneE164,
          `GestLocPro — votre code d'invitation : ${code.clair}`,
        )
      } catch (err) {
        /**
         * Un fournisseur qui LÈVE ne doit pas emporter l'invitation.
         *
         * Le contrat de la couture dit « jamais d'exception », mais un contrat
         * ne contraint que ceux qui le lisent : un adaptateur tiers, une panne
         * réseau, un jeton expiré lèveront un jour. Sans cette garde,
         * l'émission rendait 500 et le code — déjà écrit en base — était perdu
         * pour tout le monde.
         */
        console.error('envoi du code impossible', err)
      }
    }

    // Le code clair voyage UNE fois, dans cette réponse. Il ne sera plus jamais
    // lisible : c'est au propriétaire de le transmettre.
    res.status(201).json({ invitation, code: code.clair, envoye })
  },
)

/** Rattache un locataire à une unité vacante. */
parksRouter.post(
  '/:parkId/tenants',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaLocataire.parse(req.body)

    const unite = await prisma.unit.findFirst({
      where: { id: corps.unitId, building: { parkId } },
      select: { id: true, baseRentMinor: true },
    })
    if (!unite) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    try {
      const bail = await prisma.$transaction(async (tx) => {
        const locataire = await tx.tenant.create({
          data: { parkId, fullName: corps.fullName, phoneE164: corps.phoneE164 ?? null },
        })
        return tx.lease.create({
          data: {
            unitId: unite.id,
            tenantId: locataire.id,
            // La date saisie est lue en UTC, sinon la colonne `date` la
            // ramène à la veille pour tout fuseau à l'est de Greenwich.
            startsOn: corps.startsOn ? new Date(`${corps.startsOn}T00:00:00Z`) : new Date(),
            rentMinor: corps.rentMinor ?? unite.baseRentMinor,
            // « En attente » et non « à jour » : le bail commence, la première
            // quittance n'est pas due. Marquer le locataire à jour d'un loyer
            // qu'il n'a pas payé fausserait les indicateurs d'encaissement.
            status: 'pending',
          },
          select: { id: true, unitId: true, status: true },
        })
      })
      res.status(201).json({ lease: bail })
    } catch {
      /**
       * L'index unique partiel a parlé : l'unité a déjà un bail en cours.
       *
       * Deux requêtes simultanées liraient toutes deux « unité libre » avant
       * que l'une n'écrive — c'est pourquoi la règle vit dans la base et non
       * ici. Il ne reste qu'à traduire son refus.
       */
      res.status(409).json({ error: 'unit_already_leased' })
    }
  },
)

/** Minuit du jour courant, en UTC — la borne du « déjà relancé aujourd'hui ». */
function debutDuJour(maintenant: Date): Date {
  return new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  )
}

/** Clé de message d'une relance, et marqueur de sa trace. */
const CLE_RELANCE = 'notifications.rentReminder'
/** Clé de message d'une mise en demeure. */
const CLE_MISE_EN_DEMEURE = 'notifications.formalNotice'

/**
 * Relance des loyers en retard.
 *
 * La page de tarifs VEND cette fonction — « SMS et e-mail déclenchés à J+1,
 * J+7, J+15 » — et rien ne la produisait. Pire : la démonstration affichait des
 * relances (« relance partie le … ») qu'aucun code n'avait envoyées. Le modèle,
 * lui, l'attendait : le champ `Notification.channel` porte en commentaire la
 * raison même de cette route — « sans trace d'envoi, le produit relancerait
 * deux fois le même locataire le même jour ».
 *
 * Ce qui est livré ici est la trace, pas l'envoi. Le canal est enregistré,
 * `sentAt` reste NUL tant que rien n'est parti : une date d'envoi posée par
 * avance ferait mentir le dossier le jour où un locataire contestera. La
 * planification J+1/J+7/J+15 viendra au-dessus de cette trace, pas à sa place.
 *
 * Ouverte au gestionnaire : relancer relève de la gestion quotidienne, et c'est
 * précisément ce qu'un propriétaire délègue. La mise en demeure, elle, ne l'est
 * pas — voir la route suivante.
 */
parksRouter.post(
  '/:parkId/reminders',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaRelance.parse(req.body)

    const maintenant = new Date()
    const minuit = debutDuJour(maintenant)

    const baux = await prisma.lease.findMany({
      // Le `parkId` est dans le WHERE, pas vérifié après lecture : le bail
      // d'un autre parc ne doit pas même être chargé.
      where: { id: { in: corps.leaseIds }, unit: { building: { parkId } } },
      select: {
        id: true,
        unitId: true,
        tenant: { select: { fullName: true, userId: true } },
        // Toutes les échéances EXIGIBLES, pas la dernière : un locataire qui
        // doit juin et juillet est relancé une fois, pour le total.
        charges: {
          where: { dueOn: { lt: maintenant } },
          select: { dueOn: true, rentMinor: true, payments: { select: { amountMinor: true } } },
          orderBy: { dueOn: 'asc' },
        },
      },
    })

    /**
     * Les baux déjà relancés AUJOURD'HUI, en une requête.
     *
     * Une lecture par bail ferait N requêtes pour une action qui en vise une
     * quinzaine sur un parc moyen — et la grille tarifaire chiffre le cas à
     * cinquante unités.
     */
    const dejaRelances = await prisma.notification.findMany({
      where: {
        parkId,
        messageKey: CLE_RELANCE,
        createdAt: { gte: minuit },
        // L'unité sert de PRÉ-FILTRE indexé ; la clé réelle est le bail, lu
        // dans `params` juste après.
        unitId: { in: baux.map((b) => b.unitId) },
      },
      select: { params: true },
    })
    /**
     * La garde porte sur le BAIL, pas sur le logement.
     *
     * Première rédaction : sur `unitId`, seul champ de portée que `Notification`
     * offre. Elle confondait deux baux successifs du même logement — un ancien
     * locataire parti en laissant des arriérés, et celui qui l'a remplacé. Ce
     * sont deux personnes : relancer l'une n'a jamais relancé l'autre, et la
     * garde aurait silencieusement avalé la seconde relance.
     *
     * Le bail voyage donc dans `params`, qui est du JSON libre — aucune
     * migration, et la lecture reste indexée par le pré-filtre ci-dessus.
     */
    const bauxDejaVus = new Set(
      dejaRelances
        .map((n) => (n.params as { leaseId?: string } | null)?.leaseId)
        .filter((id): id is string => typeof id === 'string'),
    )

    const envoyees: string[] = []
    const ignorees: { leaseId: string; reason: string }[] = []

    for (const bail of baux) {
      // Le même calcul que `statut()`, délibérément : relancer un locataire que
      // l'écran affiche à jour serait le pire des défauts possibles ici.
      const dûMinor = bail.charges.reduce((somme, c) => {
        const regle = c.payments.reduce((s, p) => s + p.amountMinor, 0)
        return somme + Math.max(0, c.rentMinor - regle)
      }, 0)
      if (dûMinor <= 0) {
        ignorees.push({ leaseId: bail.id, reason: 'nothing_due' })
        continue
      }
      if (bauxDejaVus.has(bail.id)) {
        ignorees.push({ leaseId: bail.id, reason: 'already_reminded_today' })
        continue
      }

      // Le retard se compte depuis la PLUS ANCIENNE échéance impayée : c'est
      // celle qui fait la gravité, et le chiffre que lit le bailleur.
      const plusAncienne = bail.charges.find(
        (c) => c.payments.reduce((s, p) => s + p.amountMinor, 0) < c.rentMinor,
      )
      const jours = plusAncienne
        ? Math.floor((maintenant.getTime() - plusAncienne.dueOn.getTime()) / 86_400_000)
        : 0

      await prisma.notification.create({
        data: {
          parkId,
          kind: 'payment',
          messageKey: CLE_RELANCE,
          // `leaseId` dans les paramètres : c'est la clé de la garde du jour,
          // et `Notification` n'a pas de colonne pour le porter.
          params: {
            leaseId: bail.id,
            tenant: bail.tenant.fullName,
            overdueDays: jours,
            dueMinor: dûMinor,
          },
          severity: jours >= 15 ? 'high' : 'medium',
          unitId: bail.unitId,
          channel: 'in_app',
          // `sentAt` reste nul : rien n'est encore parti.
          //
          // La clé est posée ou ABSENTE, jamais à `undefined` : un locataire
          // sans compte n'a pas de destinataire, et `exactOptionalPropertyTypes`
          // distingue « pas de destinataire » de « destinataire indéfini ».
          ...(bail.tenant.userId
            ? { recipients: { create: [{ userId: bail.tenant.userId }] } }
            : {}),
        },
      })

      envoyees.push(bail.id)
    }

    // Les identifiants inconnus du parc n'ont même pas été lus : ils sortent
    // ici, sans dire s'ils existent ailleurs.
    const lus = new Set(baux.map((b) => b.id))
    for (const id of corps.leaseIds) {
      if (!lus.has(id)) ignorees.push({ leaseId: id, reason: 'not_found' })
    }

    if (envoyees.length > 0) {
      await prisma.auditEvent.create({
        data: {
          parkId,
          actorId: req.compteId!,
          action: 'rent.remind',
          entity: 'Lease',
          entityId: envoyees[0]!,
          payload: { leaseIds: envoyees, count: envoyees.length },
        },
      })
    }

    // 200 et non 201 : l'appel peut n'avoir rien créé — tout était déjà relancé
    // ce matin — et ce n'est pas une erreur. Le corps dit ce qui a eu lieu.
    res.json({ sent: envoyees, skipped: ignorees })
  },
)

/**
 * Mise en demeure d'un locataire.
 *
 * Réservée au PROPRIÉTAIRE, comme la validation d'un devis et l'arbitrage d'une
 * caution. Le gestionnaire « propose, ne décide pas » : une mise en demeure
 * ouvre la voie à la résiliation et engage le bailleur, pas son mandataire.
 *
 * Elle est tracée deux fois, et ce n'est pas une redondance : `AuditEvent` la
 * garde du côté de qui a décidé — c'est la pièce qu'on produit — et
 * `Notification` la porte du côté du locataire, qui doit la voir.
 */
parksRouter.post(
  '/:parkId/leases/:leaseId/formal-notice',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const leaseId = z.string().uuid().parse(req.params.leaseId)
    const corps = schemaMiseEnDemeure.parse(req.body)

    const maintenant = new Date()
    const bail = await prisma.lease.findFirst({
      where: { id: leaseId, unit: { building: { parkId } } },
      select: {
        id: true,
        unitId: true,
        tenant: { select: { fullName: true, userId: true } },
        charges: {
          where: { dueOn: { lt: maintenant } },
          select: { rentMinor: true, payments: { select: { amountMinor: true } } },
        },
      },
    })
    if (!bail) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Le reste dû, recalculé sur TOUTES les échéances exigibles.
     *
     * Mettre en demeure un locataire à jour n'est pas une maladresse
     * d'interface : c'est une faute, et elle est écrite. Le montant est figé
     * dans la trace parce qu'il sera contesté.
     */
    const dûMinor = bail.charges.reduce((somme, c) => {
      const regle = c.payments.reduce((s, p) => s + p.amountMinor, 0)
      return somme + Math.max(0, c.rentMinor - regle)
    }, 0)
    if (dûMinor <= 0) {
      res.status(409).json({ error: 'nothing_due' })
      return
    }

    await prisma.$transaction([
      prisma.auditEvent.create({
        data: {
          parkId,
          actorId: req.compteId!,
          action: 'lease.formal_notice',
          entity: 'Lease',
          entityId: bail.id,
          payload: { reason: corps.reason, dueMinor: dûMinor },
        },
      }),
      prisma.notification.create({
        data: {
          parkId,
          kind: 'lease',
          messageKey: CLE_MISE_EN_DEMEURE,
          params: { tenant: bail.tenant.fullName, dueMinor: dûMinor },
          severity: 'high',
          unitId: bail.unitId,
          channel: 'in_app',
          ...(bail.tenant.userId ? { recipients: { create: [{ userId: bail.tenant.userId }] } } : {}),
        },
      }),
    ])

    res.status(201).json({ formalNotice: { leaseId: bail.id, dueMinor: dûMinor } })
  },
)

/**
 * Le cycle d'une intervention : déclarée → chiffrée → validée → terminée.
 *
 * Le modèle porte les quatre états depuis le premier jour, et une seule
 * transition était exposée : la validation du devis. Un parc réel ne pouvait
 * donc ni déclarer une intervention, ni la chiffrer, ni la clore — l'écran
 * « Travaux » d'un vrai compte restait vide quoi qu'il arrive, et le jeu de
 * démonstration était le seul endroit où ces états existaient.
 *
 * Plus gênant : `approved` était en pratique TERMINAL. Un devis validé engageait
 * la dépense et restait indéfiniment « à faire », donc la liste des travaux ne
 * pouvait que grandir.
 */

/** Numéro d'ordre du parc pour l'année, alloué sous verrou de transaction. */
async function prochaineReference(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  parkId: string,
  annee: number,
): Promise<string> {
  /**
   * `upsert` et non `update` : le compteur n'est créé qu'au semis de la
   * démonstration. Un parc réel — celui d'un compte neuf — n'en a aucun, et sa
   * première intervention aurait échoué sur une ligne absente. Le changement
   * d'année pose le même problème, chaque 1er janvier.
   */
  const compteur = await tx.workReferenceCounter.upsert({
    where: { parkId_year: { parkId, year: annee } },
    create: { parkId, year: annee, next: 2 },
    update: { next: { increment: 1 } },
    select: { next: true },
  })
  return `SIG-${annee}-${String(compteur.next - 1).padStart(3, '0')}`
}

/** Déclare une intervention sur un logement. */
parksRouter.post(
  '/:parkId/units/:unitId/works',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const unitId = z.string().uuid().parse(req.params.unitId)
    const corps = schemaIntervention.parse(req.body)

    const unite = await prisma.unit.findFirst({
      where: { id: unitId, building: { parkId } },
      select: { id: true },
    })
    if (!unite) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const travail = await prisma.$transaction(async (tx) => {
      const reference = await prochaineReference(tx, parkId, new Date().getFullYear())
      return tx.workOrder.create({
        data: {
          unitId: unite.id,
          reference,
          title: corps.title,
          trade: corps.trade,
          urgency: corps.urgency,
          // `reported` et non `quoted` : déclarer n'est pas chiffrer. Poser un
          // montant nul ferait apparaître un devis à zéro dans la carte des
          // arbitrages du propriétaire.
          status: 'reported',
          ...(corps.description ? { description: corps.description } : {}),
        },
        select: { id: true, reference: true, status: true, title: true },
      })
    })

    res.status(201).json({ work: travail })
  },
)

/**
 * Chiffre une intervention déclarée.
 *
 * Ouvert au gestionnaire : proposer un devis EST son métier — « propose, ne
 * décide pas ». C'est la validation qui reste au propriétaire.
 */
parksRouter.patch(
  '/:parkId/works/:workId/quote',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const workId = z.string().uuid().parse(req.params.workId)
    const corps = schemaDevis.parse(req.body)

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: { id: true, status: true },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (travail.status !== 'reported') {
      // Rechiffrer un devis DÉJÀ VALIDÉ changerait le montant sous la décision
      // du propriétaire, après coup et sans qu'il en soit informé.
      res.status(409).json({ error: 'not_reported' })
      return
    }

    const maj = await prisma.workOrder.update({
      where: { id: travail.id },
      data: { status: 'quoted', quotedAmountMinor: corps.quotedAmountMinor },
      select: { id: true, status: true, quotedAmountMinor: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'work.quote',
        entity: 'WorkOrder',
        entityId: travail.id,
        payload: { quotedAmountMinor: corps.quotedAmountMinor },
      },
    })

    res.json({ work: maj })
  },
)

/**
 * Clôt une intervention.
 *
 * Deux états seulement y mènent, et le troisième est refusé À DESSEIN :
 *
 * — `approved` : la dépense a été engagée, les travaux sont faits ;
 * — `reported` : tout n'a pas de coût, et une intervention sans devis n'a rien
 *   à faire arbitrer ;
 * — `quoted` est REFUSÉ. Un devis en attente d'arbitrage doit être tranché, pas
 *   contourné. Le clore ferait disparaître de la carte du propriétaire une
 *   décision qu'il n'a jamais prise, et le montant serait engagé sans lui.
 *
 * Ouvert au gestionnaire : constater l'achèvement relève du quotidien.
 */
parksRouter.patch(
  '/:parkId/works/:workId/complete',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const workId = z.string().uuid().parse(req.params.workId)
    const corps = schemaAchevement.parse(req.body)

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: { id: true, status: true },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (travail.status === 'done') {
      // Clore deux fois écraserait la date du premier constat.
      res.status(409).json({ error: 'already_done' })
      return
    }
    if (travail.status === 'quoted') {
      res.status(409).json({ error: 'awaiting_approval' })
      return
    }

    const maj = await prisma.workOrder.update({
      where: { id: travail.id },
      data: {
        status: 'done',
        // La date saisie est lue en UTC : la colonne est de type `date`, et une
        // date construite à minuit local recule d'un jour à l'est de Greenwich.
        completedOn: corps.completedOn ? new Date(`${corps.completedOn}T00:00:00Z`) : new Date(),
      },
      select: { id: true, status: true, completedOn: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'work.complete',
        entity: 'WorkOrder',
        entityId: travail.id,
        payload: { completedOn: maj.completedOn },
      },
    })

    res.json({ work: maj })
  },
)

/**
 * Rouvre une intervention close.
 *
 * L'annulation de la maquette est une fenêtre de six secondes après le clic.
 * Ce n'est pas ce qui est livré ici, et l'écart est délibéré : une clôture prise
 * pour une autre se découvre en relisant sa liste, pas dans les six secondes.
 * Une fenêtre qui expire en silence enseigne un filet qui n'existe pas — elle
 * rassure au moment où l'on ne se trompe pas encore.
 *
 * La réouverture est donc PERMANENTE. Le toast d'annulation n'en est que le
 * chemin le plus court.
 *
 * L'état de retour est DÉDUIT, faute d'être conservé : `approved` si la dépense
 * avait été engagée — `approvedAt` en fait foi — et `reported` sinon. Rendre à
 * `quoted` un devis qui avait été validé effacerait la décision du propriétaire.
 */
parksRouter.patch(
  '/:parkId/works/:workId/reopen',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const workId = z.string().uuid().parse(req.params.workId)

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: { id: true, status: true, approvedAt: true },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (travail.status !== 'done') {
      // Rouvrir ce qui n'est pas clos n'a pas de sens, et ferait reculer un
      // devis en attente vers l'état déclaré.
      res.status(409).json({ error: 'not_done' })
      return
    }

    const maj = await prisma.workOrder.update({
      where: { id: travail.id },
      data: { status: travail.approvedAt ? 'approved' : 'reported', completedOn: null },
      select: { id: true, status: true, completedOn: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'work.reopen',
        entity: 'WorkOrder',
        entityId: travail.id,
        payload: { status: maj.status },
      },
    })

    res.json({ work: maj })
  },
)

/**
 * Défaire une validation de devis.
 *
 * Valider engage une dépense ; se tromper de ligne dans une liste de devis est
 * ordinaire, et rien ne permettait de revenir. La correction se faisait donc
 * hors du produit — au téléphone, ou pas du tout.
 *
 * Réservée au PROPRIÉTAIRE, comme la validation qu'elle défait : rendre à un
 * gestionnaire le pouvoir d'effacer une décision qu'il n'a pas le droit de
 * prendre reviendrait à lui donner ce droit par la bande.
 *
 * Le retour se fait à `quoted` et non à `reported` : le devis existe toujours,
 * c'est l'accord qui est retiré. Le montant proposé est conservé, le montant
 * ENGAGÉ est effacé — c'est toute la différence, et c'est elle qu'on rétablit.
 */
parksRouter.patch(
  '/:parkId/works/:workId/unapprove',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const workId = z.string().uuid().parse(req.params.workId)

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: { id: true, status: true },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (travail.status !== 'approved') {
      /**
       * Un travail TERMINÉ n'est pas concerné, et c'est délibéré : l'artisan est
       * passé, la dépense est réelle. Défaire l'accord laisserait une
       * intervention faite et non engagée. Il faut d'abord la rouvrir — deux
       * gestes pour deux faits distincts.
       */
      res.status(409).json({ error: 'not_approved' })
      return
    }

    const maj = await prisma.workOrder.update({
      where: { id: travail.id },
      data: {
        status: 'quoted',
        approvedAmountMinor: null,
        approvedAt: null,
        approvedById: null,
      },
      select: { id: true, status: true, quotedAmountMinor: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'work.unapprove',
        entity: 'WorkOrder',
        entityId: travail.id,
        payload: {},
      },
    })

    res.json({ work: maj })
  },
)

/**
 * Défaire un arbitrage de caution.
 *
 * C'est le geste le plus lourd du produit après la mise en demeure : il retient
 * l'argent de quelqu'un. Une retenue portée sur la mauvaise caution ne se
 * réparait que dans la base.
 *
 * La trace de l'arbitrage défait N'EST PAS effacée. `AuditEvent` garde les deux
 * événements — l'arbitrage et son retrait — parce que le locataire a pu voir le
 * premier, et qu'un dossier d'où les décisions disparaissent ne défend plus
 * personne.
 */
parksRouter.patch(
  '/:parkId/deposits/:depositId/unsettle',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const depositId = z.string().uuid().parse(req.params.depositId)

    const caution = await prisma.deposit.findFirst({
      where: { id: depositId, lease: { unit: { building: { parkId } } } },
      select: { id: true, status: true, withheldMinor: true, withheldReason: true },
    })
    if (!caution) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (caution.status !== 'returned') {
      res.status(409).json({ error: 'not_settled' })
      return
    }

    const maj = await prisma.deposit.update({
      where: { id: caution.id },
      data: {
        status: 'held',
        withheldMinor: 0,
        withheldReason: null,
        settledAt: null,
        settledById: null,
        returnedAt: null,
      },
      select: { id: true, status: true, withheldMinor: true },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'deposit.unsettle',
        entity: 'Deposit',
        entityId: caution.id,
        // Ce qui est défait est consigné : sans ce montant, le journal dirait
        // qu'un arbitrage a été retiré sans dire lequel.
        payload: { withheldMinor: caution.withheldMinor, reason: caution.withheldReason },
      },
    })

    res.json({ deposit: maj })
  },
)
