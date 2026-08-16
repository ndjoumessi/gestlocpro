import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Parc de démonstration, créé pour un nouveau propriétaire.
 *
 * Le jeu vivait dans `src/data/portfolio.ts`, côté client, en constantes de
 * module partagées par tout le monde : deux comptes sur le même navigateur
 * regardaient le même parc. Il devient ici la donnée d'un compte, écrite en
 * base à l'inscription.
 *
 * **Ce que la transposition corrige.** Le client tenait `Unit.status` — une
 * seule colonne pour deux questions distinctes. Ici, « l'unité est-elle
 * occupée ? » est l'existence d'un bail, et « où en est l'échéance ? » se
 * calcule sur `RentCharge` et `Payment`. Le règlement partiel d'Aline Tchoumi
 * en est la preuve : l'écran Paiements le simulait à 53 % du loyer — 39 750 —
 * pendant qu'une alerte annonçait 40 000 pour le même versement. Deux chiffres
 * pour un seul fait, parce que le fait n'existait nulle part. Il existe
 * maintenant, et il vaut 40 000.
 */

interface Semence {
  parkId: string
  /** Auteur des encaissements semés : le propriétaire qui vient de s'inscrire. */
  proprietaireId: string
  /** Premier jour de la période courante. */
  periode: Date
  /** Aujourd'hui, injecté : une semence qui lit l'horloge n'est pas reproductible. */
  aujourdhui: Date
}

const IMMEUBLES = [
  { cle: 'bon', name: 'Résidence Bonamoussadi', district: 'Bonamoussadi' },
  { cle: 'akw', name: 'Immeuble Akwa Nord', district: 'Akwa' },
  { cle: 'des', name: 'Villa Deïdo', district: 'Deïdo' },
] as const

type TypeUnite = 'T1' | 'T2' | 'T3' | 'T4'

/**
 * `regle` porte le versement RÉELLEMENT encaissé sur la période, en unités
 * mineures. `null` signifie « rien reçu » — un impayé. `undefined` signifie
 * « pas de bail », donc pas d'échéance du tout.
 */
const UNITES: {
  cle: string
  immeuble: string
  label: string
  type: TypeUnite
  surface: number
  loyer: number
  locataire?: string
  telephone?: string
  regle?: number | null
  /** Jours de retard voulus, pour dater l'échéance en conséquence. */
  retard?: number
  caution?: { held: number; withheld?: number; reason?: string }
}[] = [
  { cle: 'A1', immeuble: 'bon', label: 'A1', type: 'T3', surface: 78, loyer: 145000, locataire: 'Charles Ngassa', telephone: '+237677214408', regle: 145000, caution: { held: 290000 } },
  { cle: 'A2', immeuble: 'bon', label: 'A2', type: 'T2', surface: 54, loyer: 110000, locataire: 'Mireille Fotso', telephone: '+237699035172', regle: 110000, caution: { held: 220000 } },
  { cle: 'A3', immeuble: 'bon', label: 'A3', type: 'T2', surface: 56, loyer: 115000, locataire: 'Serge Mbarga', telephone: '+237655842031', regle: null, retard: 24, caution: { held: 230000, withheld: 45000, reason: 'Reprise de la peinture du séjour' } },
  { cle: 'A4', immeuble: 'bon', label: 'A4', type: 'T4', surface: 96, loyer: 180000, locataire: 'Famille Owona', telephone: '+237670129645', regle: 180000 },
  // Le versement partiel : 40 000 sur 75 000, la valeur que l'alerte annonçait
  // déjà pendant que l'écran en calculait une autre.
  { cle: 'A5', immeuble: 'bon', label: 'A5', type: 'T1', surface: 38, loyer: 75000, locataire: 'Aline Tchoumi', telephone: '+237694370812', regle: 40000 },

  { cle: 'B1', immeuble: 'akw', label: 'B1', type: 'T3', surface: 82, loyer: 160000, locataire: 'Jean-Paul Eboa', telephone: '+237678451190', regle: 160000 },
  { cle: 'B2', immeuble: 'akw', label: 'B2', type: 'T3', surface: 80, loyer: 155000, locataire: 'Nadia Belinga', telephone: '+237651607324', regle: null, retard: 9 },
  { cle: 'B3', immeuble: 'akw', label: 'B3', type: 'T2', surface: 58, loyer: 120000, locataire: 'Éric Ndongo', telephone: '+237696823057', regle: 120000 },
  { cle: 'B4', immeuble: 'akw', label: 'B4', type: 'T2', surface: 57, loyer: 118000 },

  { cle: 'C1', immeuble: 'des', label: 'C1', type: 'T4', surface: 104, loyer: 195000, locataire: 'Cabinet Njoya', telephone: '+237673554186', regle: 195000 },
  { cle: 'C2', immeuble: 'des', label: 'C2', type: 'T3', surface: 76, loyer: 142000, locataire: 'Sylvie Manga', telephone: '+237682196403', regle: null, retard: 3 },
  { cle: 'C3', immeuble: 'des', label: 'C3', type: 'T2', surface: 60, loyer: 125000 },
]

/**
 * Signalements du jeu de démonstration.
 *
 * `title` est ici une chaîne libre, comme dans le produit réel où le locataire
 * l'écrit. Le client en avait fait cinq clés de traduction — c'était juste
 * **tant que la donnée était un jeu de démonstration servi aux deux langues** ;
 * dès qu'elle vient d'une base rattachée à un compte, elle redevient de la
 * saisie, et une saisie ne se traduit pas.
 */
const TRAVAUX: {
  unite: string
  title: string
  trade: 'plumbing' | 'power' | 'painting' | 'multi' | 'lock' | 'other'
  status: 'reported' | 'quoted' | 'approved' | 'done'
  urgency: 'blocking' | 'normal' | 'low'
  montant?: number
  jours: number
}[] = [
  { unite: 'A3', title: 'Fuite sous l’évier de la cuisine', trade: 'plumbing', status: 'quoted', urgency: 'blocking', montant: 45000, jours: 35 },
  { unite: 'B2', title: 'Disjoncteur qui saute au démarrage du chauffe-eau', trade: 'power', status: 'approved', urgency: 'blocking', montant: 78000, jours: 38 },
  { unite: 'C1', title: 'Peinture du séjour à reprendre', trade: 'painting', status: 'reported', urgency: 'low', jours: 42 },
  { unite: 'A1', title: 'Remplacement du groupe de sécurité', trade: 'plumbing', status: 'done', urgency: 'normal', montant: 32000, jours: 50 },
  { unite: 'B4', title: 'Réfection complète avant relocation', trade: 'multi', status: 'approved', urgency: 'normal', montant: 340000, jours: 56 },
]

/** Décale une date d'un nombre de jours, sans toucher à l'original. */
function moins(jours: number, depuis: Date): Date {
  const d = new Date(depuis)
  d.setDate(d.getDate() - jours)
  return d
}

export async function semerParcDemonstration(
  tx: Prisma.TransactionClient | PrismaClient,
  { parkId, proprietaireId, periode, aujourdhui }: Semence,
): Promise<void> {
  const unites = new Map<string, string>()
  const immeubles = new Map<string, string>()
  for (const im of IMMEUBLES) {
    const cree = await tx.building.create({
      data: { parkId, name: im.name, district: im.district },
    })
    immeubles.set(im.cle, cree.id)
  }

  for (const u of UNITES) {
    const buildingId = immeubles.get(u.immeuble)
    if (!buildingId) continue

    const unite = await tx.unit.create({
      data: {
        buildingId,
        label: u.label,
        type: u.type,
        surfaceSqm: u.surface,
        baseRentMinor: u.loyer,
      },
    })
    unites.set(u.cle, unite.id)

    if (!u.locataire) continue

    const locataire = await tx.tenant.create({
      data: { parkId, fullName: u.locataire, phoneE164: u.telephone ?? null },
    })

    const bail = await tx.lease.create({
      data: {
        unitId: unite.id,
        tenantId: locataire.id,
        startsOn: moins(400, aujourdhui),
        rentMinor: u.loyer,
        status: 'active',
      },
    })

    if (u.caution) {
      await tx.deposit.create({
        data: {
          leaseId: bail.id,
          heldMinor: u.caution.held,
          withheldMinor: u.caution.withheld ?? 0,
          withheldReason: u.caution.reason ?? null,
          status: u.caution.withheld ? 'settling' : 'held',
        },
      })
    }

    /**
     * L'échéance est datée depuis le retard voulu, et non l'inverse.
     *
     * Le client stockait `overdueDays: 24`, un nombre figé qui ne grandissait
     * jamais — et recopié dans le texte d'une alerte, donc à deux endroits sans
     * lien. Ici la seule donnée est la date d'échéance ; le retard s'en déduit,
     * et il vieillit tout seul.
     */
    const dueOn = u.retard ? moins(u.retard, aujourdhui) : new Date(periode)
    if (!u.retard) dueOn.setDate(5)

    const echeance = await tx.rentCharge.create({
      data: { leaseId: bail.id, periodStart: periode, dueOn, rentMinor: u.loyer },
    })

    if (u.regle) {
      await tx.payment.create({
        data: {
          chargeId: echeance.id,
          amountMinor: u.regle,
          method: 'mobile',
          paidOn: moins(3, aujourdhui),
          recordedById: proprietaireId,
        },
      })
    }
  }

  /**
   * Les références sont allouées par le compteur du parc, comme en production.
   *
   * Les tirer d'un `count()` les dupliquerait dès deux créations simultanées ;
   * un compteur ligne à ligne, verrouillé par la transaction, ne le peut pas.
   */
  const annee = aujourdhui.getFullYear()
  await tx.workReferenceCounter.create({ data: { parkId, year: annee, next: 1 } })

  for (const w of TRAVAUX) {
    const unitId = unites.get(w.unite)
    if (!unitId) continue

    const compteur = await tx.workReferenceCounter.update({
      where: { parkId_year: { parkId, year: annee } },
      data: { next: { increment: 1 } },
      select: { next: true },
    })
    const numero = String(compteur.next - 1).padStart(3, '0')

    await tx.workOrder.create({
      data: {
        unitId,
        reference: `SIG-${annee}-${numero}`,
        title: w.title,
        trade: w.trade,
        status: w.status,
        urgency: w.urgency,
        quotedAmountMinor: w.montant ?? null,
        approvedAmountMinor: w.status === 'approved' || w.status === 'done' ? (w.montant ?? null) : null,
        approvedAt: w.status === 'approved' || w.status === 'done' ? moins(w.jours - 2, aujourdhui) : null,
        approvedById: w.status === 'approved' || w.status === 'done' ? proprietaireId : null,
        completedOn: w.status === 'done' ? moins(w.jours - 5, aujourdhui) : null,
        reportedAt: moins(w.jours, aujourdhui),
      },
    })
  }
}
