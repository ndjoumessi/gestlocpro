import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
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

const schemaLocataire = z.object({
  unitId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Numéro attendu au format international')
    .optional(),
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
            startsOn: new Date(),
            rentMinor: unite.baseRentMinor,
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
