import { Router, type Request, type Response } from 'express'
import { prisma } from '../db.js'
import { exigerAppartenance, exigerCompte, unitesVisibles } from '../auth/guards.js'

export const parksRouter = Router()

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

    res.json({ buildings })
  },
)
