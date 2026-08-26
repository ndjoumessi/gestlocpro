import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { creerCode, expirationInvitation, normaliserCode } from './invitations.js'
import { empreinteJeton } from '../auth/token.js'
import { laMessagerie } from '../messagerie/messagerie.js'
import { exigerAppartenance, exigerCompte, exigerRole, unitesVisibles } from '../auth/guards.js'
import { leStockage } from '../stockage/stockage.js'
import { PLAFOND_PAR_OBJET_OCTETS } from '../stockage/contrat.js'
import { stockageLocalRouter } from '../stockage/routes.js'

export const parksRouter = Router()

/**
 * Le transport du dépôt LOCAL, monté sous un littéral.
 *
 * Sous `/api/parks` faute de mieux : monter un routeur à la racine de l'API est
 * l'affaire d'`app.ts`, que ce lot ne touche pas. `stockage-local` est un
 * littéral et les identifiants de parc sont des uuid : aucune collision n'est
 * possible avec `/:parkId/…`.
 *
 * Ces routes ne portent PAS `exigerAppartenance` — voir le commentaire de tête
 * de `stockage/routes.ts` : elles doublent R2, qui ne connaît pas nos comptes.
 */
parksRouter.use('/stockage-local', stockageLocalRouter)

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
  /**
   * L'annotation du bailleur, INTERNE.
   *
   * `Payment.note` est au schéma depuis l'origine et n'a jamais eu ni saisie ni
   * lecture. Elle porte ce que la référence ne dit pas : « solde promis le 15 »,
   * « versé par le frère ». C'est le même manque que `withheldReason` sur la
   * caution — le seul texte qui expliquerait la ligne six mois plus tard était
   * le seul qu'on ne gardait pas.
   *
   * Plus longue que la référence, et pour cause : l'une est un identifiant
   * d'opérateur, l'autre une phrase.
   */
  note: z.string().trim().max(280).optional(),
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
  /**
   * Les baux visés. ABSENT signifie « tous ceux du parc qui doivent quelque
   * chose » — c'est la forme qu'emprunte la relance automatique, qui ne connaît
   * pas d'avance la liste des retardataires.
   */
  leaseIds: z.array(z.string().uuid()).min(1).max(200).optional(),
  /**
   * `milestones` restreint aux ÉCHÉANCES VENDUES : J+1, J+7, J+15.
   *
   * La grille tarifaire ne promet pas une relance quotidienne, elle promet ces
   * trois-là. Relancer tous les jours ferait du produit un harceleur ; ne
   * relancer qu'une fois ne tiendrait pas la promesse. Le jalon est donc une
   * donnée du contrat commercial, pas un réglage d'implémentation.
   */
  only: z.enum(['milestones']).optional(),
})

/** Les jours de retard auxquels la grille tarifaire promet une relance. */
export const JALONS_RELANCE = [1, 7, 15] as const

/**
 * LE SEUL jalon dont ce lot rend la promesse par e-mail VRAIE.
 *
 * J+1 et J+15 restent des jalons de RELANCE (SMS, toujours simulée) — ils
 * rejoindront le courriel quand un lot séparé les construira. Choisi pour son
 * absence d'ambiguïté : ni le délai serré de J+1, ni la sévérité de J+15, qui
 * chevauche le registre de la mise en demeure.
 */
export const JALON_EMAIL_AUTOMATIQUE = 7

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

/**
 * La pièce demandée. Une valeur d'une liste fermée, jamais un texte libre.
 *
 * Le gestionnaire doit pouvoir répondre sans déchiffrer, et une demande nommée
 * se traduit : le locataire demande en français, le gestionnaire peut lire en
 * anglais. Un intitulé figé à l'envoi les enfermerait tous deux dans la langue
 * du premier.
 */
const schemaDemandeDocument = z.object({
  kind: z.enum(['residence', 'goodStanding', 'leaseCopy']),
})

/**
 * La réponse du gestionnaire.
 *
 * `pending` n'y figure pas : on ne remet pas une demande traitée en attente.
 * Ce serait effacer une réponse déjà donnée au locataire, et le laisser
 * attendre une seconde fois ce qu'il a déjà reçu.
 */
const schemaReponseDocument = z.object({
  status: z.enum(['fulfilled', 'declined']),
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

/**
 * Un état des lieux, avec ses réserves.
 *
 * `costMinor` porte l'imputation sur la caution — « réserves relevées et
 * horodatées, imputation chiffrée sur la caution », dit la page de tarifs. Il
 * est facultatif : toutes les réserves ne se chiffrent pas, et une rayure
 * relevée sans montant reste une rayure relevée.
 */
const schemaEtatDesLieux = z.object({
  kind: z.enum(['entry', 'exit']),
  performedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
    .optional(),
  rooms: z.number().int().positive().max(50),
  /** Nom du signataire. Un état des lieux non signé n'engage personne. */
  signedByName: z.string().trim().min(2).max(120).optional(),
  findings: z
    .array(
      z.object({
        room: z.string().trim().min(1).max(80),
        description: z.string().trim().min(3).max(500),
        severity: z.enum(['minor', 'major']).default('minor'),
        costMinor: z.number().int().positive().optional(),
      }),
    )
    .max(200)
    .default([]),
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
  /**
   * Caution encaissée à l'entrée.
   *
   * `deposit.create` n'existait QUE dans le semis de démonstration : un parc
   * réel ne pouvait porter aucune caution, donc l'écran « Cautions » restait
   * vide quoi qu'on fasse et les deux routes d'arbitrage n'avaient rien sur quoi
   * opérer. Toute une surface du produit était inatteignable hors démonstration.
   *
   * Facultative : un bail sans caution existe, et l'imposer bloquerait la saisie
   * d'un locataire déjà en place dont on ne retrouve pas le montant.
   */
  depositMinor: z.number().int().positive().optional(),
})

parksRouter.use(exigerCompte)

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
                startsOn: true,
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
          // Le bail portait sa date de début depuis toujours ; la réponse ne la
          // transmettait pas. Le client l'affiche — « bail en cours depuis
          // le … » —, et sans elle la phrase restait amputée pour tout compte
          // réel, quand la démonstration la montrait.
          leaseStartsOn: bail?.startsOn.toISOString() ?? null,
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

    const [
      travaux,
      cautions,
      releves,
      etatsDesLieux,
      notifications,
      echeances,
      demandes,
      baux,
      tarifs,
    ] = await Promise.all([
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
          origin: true,
          /**
           * Le NOM du déclarant, par l'une ou l'autre des deux relations.
           *
           * `reportedByTenantId` était écrit depuis l'origine et lu nulle part,
           * faute de relation : le bailleur recevait un problème sans savoir
           * qui l'avait vu, donc sans pouvoir rappeler ni faire ouvrir la
           * porte. C'est la moitié locataire. L'autre — le compte qui ouvre un
           * chantier — n'existait pas du tout.
           */
          reportedByTenant: { select: { fullName: true } },
          reportedBy: { select: { fullName: true } },
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
            select: {
              unitId: true,
              tenant: { select: { fullName: true } },
              endsOn: true,
              /**
               * Les réserves de SORTIE, et leur coût.
               *
               * C'est la moitié manquante de la promesse « imputation chiffrée
               * sur la caution » : le montant était relevé à l'état des lieux,
               * journalisé, et il fallait ensuite le ressaisir à la main dans
               * l'arbitrage. Deux saisies pour un seul fait, dont la seconde
               * pouvait diverger de la première sans que rien ne le dise.
               *
               * L'entrée est exclue par le `kind` : elle constate ce qui est
               * déjà abîmé, et le serveur refuse d'ailleurs d'y chiffrer quoi
               * que ce soit.
               */
              inspections: {
                where: { kind: 'exit' as const },
                select: { findings: { select: { costMinor: true } } },
              },
            },
          },
        },
      }),
      prisma.meterReading.findMany({
        where: { unit: { building: { parkId } }, ...(filtreUnite ? { unitId: filtreUnite } : {}) },
        orderBy: [{ unitId: 'asc' }, { utility: 'asc' }, { periodStart: 'desc' }],
        select: { id: true, unitId: true, utility: true, periodStart: true, indexValue: true, readAt: true },
      }),
      prisma.inspection.findMany({
        where: {
          unit: { building: { parkId } },
          ...(filtreUnite ? { unitId: filtreUnite } : {}),
          /**
           * Le locataire ne lit QUE les états des lieux de son bail — ou ceux
           * qui n'en portent aucun.
           *
           * `unitesVisibles` retient son logement même après son départ, et le
           * détail que cette route se met à rendre n'est pas anodin : les
           * réserves de SORTIE du prédécesseur portent une description et un
           * coût imputé, celles d'ENTRÉE du successeur décrivent l'état d'un
           * logement qu'il n'occupe plus. Ni les unes ni les autres ne le
           * regardent.
           *
           * `leaseId: null` reste visible : une entrée précède souvent la
           * signature — « on constate avant de remettre les clés », dit la
           * route de création — et sur SON logement c'est la sienne.
           */
          ...(role === 'tenant'
            ? { OR: [{ lease: { tenant: { userId: req.compteId! } } }, { leaseId: null }] }
            : {}),
        },
        orderBy: { performedOn: 'asc' },
        select: {
          id: true,
          unitId: true,
          leaseId: true,
          kind: true,
          performedOn: true,
          rooms: true,
          signedAt: true,
          /**
           * Le DÉTAIL des réserves, et non leur seul compte.
           *
           * `InspectionModal` saisit `room`, `description` et `costMinor` ;
           * la gravité, elle, ne s'est saisie que bien plus tard — le champ
           * partait toujours à « léger », et la première rédaction de ce
           * commentaire l'a affirmé rendu par la modale alors que rien ne le
           * posait. Une note qui certifie une saisie inexistante coûte plus
           * cher qu'une note absente. La route de création les enregistre ;
           * `billableMinor` en dérive déjà la retenue proposée sur la caution.
           * Seul l'écran n'en voyait qu'un nombre — « 3 réserves » —, et le
           * commentaire de cette projection l'assumait : « le détail n'a pas
           * encore d'écran pour le montrer ». Il en a un.
           *
           * C'est la pièce qu'on oppose au locataire quand il conteste une
           * retenue : sans le détail, la somme proposée ne se justifie par rien
           * qu'il puisse lire.
           */
          findings: {
            orderBy: { room: 'asc' },
            select: {
              id: true,
              room: true,
              description: true,
              severity: true,
              costMinor: true,
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: {
          parkId,
          /**
           * Le locataire voit ce qui concerne SES unités, ou ce dont il est
           * DESTINATAIRE NOMMÉ.
           *
           * La première moitié suffisait tant que toute notification portait une
           * unité : un relevé manquant sur le parc s'adresse à qui gère, pas à
           * lui. Le message groupé du bailleur — « coupure d'eau jeudi » — n'a
           * volontairement aucune unité, puisqu'il porte sur un immeuble
           * entier ; le filtre le lui cachait, alors qu'il en était le
           * destinataire explicite.
           *
           * L'unité est le cloisonnement PAR DÉFAUT, à défaut de destinataire.
           * Quand quelqu'un est nommé, c'est ce nom qui fait foi — et il n'est
           * jamais posé par accident : `NotificationRecipient` n'existe que
           * pour dire à qui l'on parle.
           */
          ...(idsVisibles
            ? {
                OR: [
                  { unitId: { in: idsVisibles } },
                  { recipients: { some: { userId: req.compteId! } } },
                ],
              }
            : {}),
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
          /**
           * Le CANAL et la date d'envoi, que la réponse jetait.
           *
           * Le schéma porte les deux depuis l'origine, avec sa justification :
           * « sans trace d'envoi, le produit relancerait deux fois le même
           * locataire le même jour ». La route de relance les écrit
           * scrupuleusement — `sentAt` n'est posé QUE si le fournisseur a
           * confirmé —, et le `select` de la lecture les omettait.
           *
           * Le bailleur ne pouvait donc pas distinguer une relance réellement
           * partie par SMS d'une relance restée dans le produit. Sur un écran
           * qui annonce « Relance envoyée à Serge Mbarga », c'est la seule
           * chose qui compte : la vitrine vend « SMS et e-mail déclenchés à
           * J+1, J+7, J+15 », et rien ne disait s'ils partaient.
           */
          channel: true,
          sentAt: true,
          recipients: { where: { userId: req.compteId! }, select: { readAt: true } },
        },
      }),
      /**
       * Toutes les échéances lisibles : l'histogramme des encaissements ET
       * l'historique du locataire se servent de cette seule lecture.
       *
       * `COLLECTIONS` était une constante de douze mois côté client, cohérente
       * en elle-même et reliée à rien : la ligne d'objectif du graphique
       * annonçait « 1,4 M » quand la somme des loyers vaut 1 397 000.
       *
       * Le portefeuille ne rendait qu'UNE échéance par bail — la courante, par
       * le `take: 1` du bloc au-dessus. L'historique de quittances du locataire
       * était donc vide, et les deux écrans qui l'affichent l'annonçaient comme
       * une case vide du produit. Il n'y avait pourtant rien à aller chercher :
       * ces lignes-ci étaient déjà lues pour l'histogramme, et jetées après
       * l'agrégation par mois.
       */
      prisma.rentCharge.findMany({
        where: {
          lease: {
            unit: { building: { parkId } },
            ...(filtreUnite ? { unitId: filtreUnite } : {}),
            /**
             * Le cloisonnement du locataire porte sur le BAIL, et non sur
             * l'unité — c'est la seule ligne de ce fichier où les deux
             * diffèrent.
             *
             * `unitesVisibles` retient les unités où le compte a UN bail, sans
             * regarder s'il court encore : un locataire parti reste donc
             * appelé « visible » sur son ancien logement. Tant que la réponse
             * ne portait qu'un montant du mois, l'écart passait ; un
             * historique complet lui aurait servi les échéances du locataire
             * SUIVANT, période par période et montant par montant.
             */
            ...(role === 'tenant' ? { tenant: { userId: req.compteId! } } : {}),
          },
        },
        orderBy: { periodStart: 'desc' },
        select: {
          leaseId: true,
          periodStart: true,
          dueOn: true,
          rentMinor: true,
          waterMinor: true,
          powerMinor: true,
          /**
           * Le moyen et la date de chaque versement, et non leur seule somme.
           *
           * Le portail annonce « payé le 03/08 par Mobile Money » : sans eux,
           * la phrase s'arrêtait avant son complément — et le client la
           * complétait avec une constante de démonstration.
           */
          payments: {
            orderBy: { paidOn: 'asc' },
            select: {
              amountMinor: true,
              method: true,
              paidOn: true,
              /* Écrits depuis l'origine, rendus à personne : la référence était
                 saisie par le bailleur et disparaissait, la note n'avait même
                 pas de champ. */
              reference: true,
              note: true,
            },
          },
        },
      }),
      /**
       * Les demandes de pièces, dans la même réponse que le reste.
       *
       * Le cloisonnement porte sur le BAIL, comme pour les échéances et pour la
       * même raison : `unitesVisibles` retient les unités où le compte a un
       * bail sans regarder s'il court encore, et un locataire parti lirait
       * sinon les demandes de celui qui l'a remplacé.
       *
       * Toutes, et non les seules en attente : le locataire doit pouvoir
       * constater qu'on lui a répondu — et quand — plutôt que de voir sa
       * demande disparaître sans mot dire.
       */
      prisma.documentRequest.findMany({
        where: {
          lease: {
            unit: { building: { parkId } },
            ...(filtreUnite ? { unitId: filtreUnite } : {}),
            ...(role === 'tenant' ? { tenant: { userId: req.compteId! } } : {}),
          },
        },
        orderBy: { requestedAt: 'desc' },
        select: {
          id: true,
          kind: true,
          status: true,
          requestedAt: true,
          resolvedAt: true,
          lease: {
            select: {
              unitId: true,
              // Le NOM de qui demande : le gestionnaire répond à une personne,
              // pas à un identifiant de logement.
              tenant: { select: { fullName: true } },
            },
          },
        },
      }),
      /**
       * TOUS les baux, terminés compris — l'occupation d'un logement dans le
       * temps.
       *
       * La réponse ne portait que le bail en cours : `units[].tenant` dit qui
       * habite, jamais qui a habité. Un logement a pourtant autant de dossiers
       * que de locataires successifs, et la question « que s'est-il passé
       * ici ? » n'avait aucune réponse dans le produit — ni la durée des
       * occupations passées, ni le loyer d'alors, ni la date de sortie.
       *
       * Cloisonné par le BAIL pour le locataire, comme les échéances et les
       * demandes : `unitesVisibles` retient son ancien logement, et lui rendre
       * l'occupation suivante lui donnerait le nom de son successeur.
       */
      prisma.lease.findMany({
        where: {
          unit: { building: { parkId } },
          ...(filtreUnite ? { unitId: filtreUnite } : {}),
          ...(role === 'tenant' ? { tenant: { userId: req.compteId! } } : {}),
        },
        orderBy: { startsOn: 'desc' },
        select: {
          id: true,
          unitId: true,
          startsOn: true,
          endsOn: true,
          rentMinor: true,
          status: true,
          tenant: { select: { fullName: true } },
        },
      }),
      prisma.utilityTariff.findMany({
        where: { parkId },
        // Du plus RÉCENT au plus ancien : le tarif applicable à une période est
        // le premier dont la prise d'effet la précède, et cet ordre en fait une
        // simple recherche linéaire plutôt qu'un tri par appel.
        orderBy: { effectiveFrom: 'desc' },
        select: { utility: true, unitPriceMinor: true, effectiveFrom: true },
      }),
    ])

    /**
     * LE RANG D'UNE RELANCE — « rappel n° 4 » plutôt qu'une relance de plus.
     *
     * Il se DÉRIVE, il ne se stocke pas. Une colonne figée à l'écriture serait
     * opposable quoi qu'il arrive aux voisines, mais elle coûterait une
     * migration, un remplissage rétroactif, et un index unique pour que deux
     * relances simultanées sur le même bail ne prennent pas le même numéro. Le
     * rang dérivé, lui, vaut immédiatement pour les relances déjà en base.
     *
     * Ce que la dérivation coûte, il faut le dire : si une purge de rétention
     * supprimait une relance, « rappel n° 4 » deviendrait « n° 3 ». Deux
     * raisons de l'accepter aujourd'hui — aucune purge n'existe, et la pièce
     * qu'on oppose vraiment à un locataire n'est pas la relance mais la MISE EN
     * DEMEURE, qui a son propre chemin et son propre journal d'audit. Le jour
     * où une rétention arrivera, ou le jour où ce numéro figurera sur un
     * document imprimé, il faudra le figer.
     *
     * Le rang se compte par BAIL et non par unité : deux locataires successifs
     * dans le même logement ne partagent pas un compteur de relances. C'est la
     * même règle que la garde quotidienne, qui a déjà été corrigée dans ce
     * sens — `Notification` ne porte pas de `leaseId`, il vit dans `params`.
     */
    const rangDeRelance = (() => {
      const rangs = new Map<string, number>()
      const compteurs = new Map<string, number>()
      /* Du plus ANCIEN au plus récent : la première relance porte le n° 1. La
         requête, elle, rend l'ordre inverse — c'est celui de l'écran. */
      for (const n of [...notifications].reverse()) {
        if (n.messageKey !== CLE_RELANCE) continue
        const bail = (n.params as { leaseId?: unknown } | null)?.leaseId
        if (typeof bail !== 'string') continue
        const suivant = (compteurs.get(bail) ?? 0) + 1
        compteurs.set(bail, suivant)
        rangs.set(n.id, suivant)
      }
      return rangs
    })()

    /**
     * Les relevés que le locataire a le DROIT de lire — bornés à ses baux.
     *
     * Le filtre de la requête porte sur l'UNITÉ (`filtreUnite`), et
     * `unitesVisibles` retient le logement d'un locataire même après son
     * départ : c'est voulu, il doit garder l'accès à ses quittances. Mais un
     * index de compteur postérieur à sa sortie est la consommation de son
     * SUCCESSEUR. Tant que la réponse ne portait que deux points, la fuite se
     * limitait au dernier index ; douze périodes en feraient un profil de vie —
     * les absences, les retours, le rythme d'un foyer qu'il ne connaît pas.
     *
     * `baux` est DÉJÀ cloisonné sur `tenant.userId` : les fenêtres construites
     * ici sont donc les siennes et rien d'autre. Pour un bailleur la liste est
     * vide, et la garde rend `releves` inchangé — il voit tout son parc.
     */
    const relevesVisibles = (() => {
      if (role !== 'tenant') return releves
      const fenetres = baux.map((b) => ({
        unitId: b.unitId,
        debut: +b.startsOn,
        fin: b.endsOn ? +b.endsOn : Number.POSITIVE_INFINITY,
      }))
      return releves.filter((r) =>
        fenetres.some(
          (f) => f.unitId === r.unitId && +r.periodStart >= f.debut && +r.periodStart <= f.fin,
        ),
      )
    })()

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
      /**
       * L'historique des échéances, période par période et bail par bail.
       *
       * Les montants sont ceux de la BASE, figés à l'émission, jamais
       * recalculés : refacturer juillet au tarif d'août est faux, et rien ne le
       * signalerait. C'est la même règle que celle de l'émission des quittances
       * — un document réémis en octobre doit rendre exactement celui de juillet.
       *
       * La part réglée est un TOTAL, pas une ventilation par fluide : un
       * versement solde une échéance, il ne se rattache pas à l'eau plutôt
       * qu'à l'électricité. L'imputation — loyer d'abord, puis les charges —
       * est une convention d'affichage ; elle appartient à qui affiche, et la
       * poser ici la ferait passer pour un fait enregistré.
       *
       * Plate et non groupée par bail : le client tient déjà ses unités par
       * `leaseId`, et un objet indexé rendrait la réponse illisible au débogage
       * pour la seule économie d'une boucle.
       */
      leaseCharges: echeances.map((e) => ({
        leaseId: e.leaseId,
        periodStart: e.periodStart,
        dueOn: e.dueOn,
        rentMinor: e.rentMinor,
        waterMinor: e.waterMinor,
        powerMinor: e.powerMinor,
        paidMinor: e.payments.reduce((somme, p) => somme + p.amountMinor, 0),
        payments: e.payments.map((p) => ({
          amountMinor: p.amountMinor,
          method: p.method,
          paidOn: p.paidOn,
          /**
           * LA RÉFÉRENCE EST OPPOSABLE, LA NOTE NE L'EST PAS.
           *
           * La référence est l'identifiant de l'opérateur — « MM-4471 ». Elle
           * appartient aux deux parties : c'est avec elle qu'un locataire
           * conteste, et la lui cacher reviendrait à lui demander de croire sur
           * parole un encaissement qu'il ne peut pas retrouver.
           *
           * La note est l'annotation du bailleur sur son propre dossier —
           * « solde promis le 15 », « à rappeler ». La servir au locataire
           * exposerait ce qu'on écrit SUR lui, du même ordre que le coût des
           * travaux que son espace n'affiche pas.
           *
           * Le retrait se fait ICI, au serveur : un masquage à l'écran laisse
           * la donnée dans la réponse, où elle se lit dans l'onglet réseau.
           */
          reference: p.reference,
          ...(role === 'tenant' ? {} : { note: p.note }),
        })),
      })),
      /**
       * L'occupation du logement, la plus récente d'abord.
       *
       * `endsOn` à `null` ne veut pas dire « bail sans fin » mais « bail qui
       * court » : c'est l'écran qui choisit de l'écrire « depuis le … », et il
       * lui faut la nuance — un bail terminé sans date de sortie serait une
       * donnée manquante, pas un bail en cours.
       */
      leases: baux.map((b) => ({
        id: b.id,
        unitId: b.unitId,
        tenant: b.tenant?.fullName ?? null,
        startsOn: b.startsOn,
        endsOn: b.endsOn,
        rentMinor: b.rentMinor,
        status: b.status,
      })),
      documentRequests: demandes.map((d) => ({
        id: d.id,
        unitId: d.lease.unitId,
        tenant: d.lease.tenant?.fullName ?? null,
        kind: d.kind,
        status: d.status,
        requestedAt: d.requestedAt,
        resolvedAt: d.resolvedAt,
      })),
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
        const periodeCourante = relevesVisibles.reduce<Date | null>(
          (max, r) => (!max || r.periodStart > max ? r.periodStart : max),
          null,
        )
        const paires = new Map<string, { unitId: string; utility: string }>()
        for (const r of relevesVisibles) paires.set(`${r.unitId}|${r.utility}`, { unitId: r.unitId, utility: r.utility })

        return [...paires.values()].map(({ unitId, utility }) => {
          const pour = relevesVisibles.filter((r) => r.unitId === unitId && r.utility === utility)
          const courant = pour.find((r) => periodeCourante && +r.periodStart === +periodeCourante)
          const anterieur = pour.find((r) => !periodeCourante || +r.periodStart !== +periodeCourante)
          return {
            unitId,
            utility,
            periodStart: periodeCourante,
            indexValue: courant?.indexValue ?? null,
            previousIndex: anterieur?.indexValue ?? null,
            readAt: courant?.readAt ?? null,
            /**
             * Le prix applicable à CETTE période, et `null` quand il n'y en a
             * aucun.
             *
             * Le client portait deux constantes — 520 le mètre cube, 99 le
             * kilowattheure — écrites en dur et servies à tous les parcs, dans
             * toutes les devises, sans qu'aucun propriétaire puisse les
             * changer. Un locataire lisait donc un total à payer que rien ne
             * fondait. La table des tarifs existait depuis l'origine du schéma,
             * datée et par parc ; personne ne l'écrivait ni ne la lisait.
             *
             * Le calcul vit ICI et non à l'écran : « quel tarif s'applique à
             * cette période » est une règle, et deux écrans la recopieraient
             * différemment. Le client ne fait plus qu'une multiplication — ou
             * n'affiche aucun montant, ce que `null` lui dit sans ambiguïté.
             */
            unitPriceMinor: prixApplicable(tarifs, utility, periodeCourante),
          }
        })
      })(),
      /**
       * Toutes les périodes relevées, pour la série des douze mois.
       *
       * **Des INDEX, jamais des consommations.** C'est ce que le compteur
       * porte, et la différence entre deux périodes s'en dérive ; l'inverse ne
       * se dérive pas. Rendre des consommations toutes faites perdrait aussi le
       * seul indice qui distingue un mois à zéro d'un mois non relevé : avec
       * les index, une période absente reste absente.
       *
       * `readings` n'est PAS une seconde source. Les deux vues projettent le
       * MÊME tableau — l'une n'en garde que la période courante et son
       * antérieur, l'autre le rend en entier — dans la même réponse, au même
       * instant. C'est pourquoi le cloisonnement s'applique en amont des deux :
       * borner la série et laisser `readings` rendre l'index du successeur
       * ferait fuir par la porte à côté.
       */
      readingHistory: relevesVisibles.map((r) => ({
        unitId: r.unitId,
        utility: r.utility,
        periodStart: r.periodStart,
        indexValue: r.indexValue,
      })),
      inspections: etatsDesLieux.map((i) => ({
        id: i.id,
        unitId: i.unitId,
        // Le BAIL : c'est lui qui apparie l'entrée et la sortie d'une même
        // occupation. Deux locataires successifs ont chacun les leurs, et
        // comparer l'entrée de l'un à la sortie de l'autre n'aurait aucun sens.
        leaseId: i.leaseId,
        kind: i.kind,
        performedOn: i.performedOn,
        rooms: i.rooms,
        // Le compte SURVIT au détail : les écrans de liste le montrent, et le
        // recalculer partout depuis le tableau serait une seconde source.
        issues: i.findings.length,
        findings: i.findings.map((r) => ({
          id: r.id,
          room: r.room,
          description: r.description,
          severity: r.severity,
          costMinor: r.costMinor,
        })),
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
        channel: n.channel,
        /**
         * `null` quand le message n'est pas parti — et c'est une information,
         * pas une absence. Une relance sans date d'envoi vit dans le produit et
         * nulle part ailleurs : le locataire ne l'a pas reçue.
         */
        sentAt: n.sentAt,
        rank: rangDeRelance.get(n.id) ?? null,
        // L'état « lu » appartient au couple destinataire × notification : le
        // client le tenait dans un `Set` de session, invisible de la barre
        // latérale — la pastille annonçait « 2 » même après tout avoir lu.
        read: n.recipients[0]?.readAt !== null && n.recipients[0]?.readAt !== undefined,
      })),
      /**
       * Le déclarant est APLATI en un nom, quelle que soit sa nature.
       *
       * Deux relations le portent — un locataire, ou un compte du bailleur —
       * mais l'écran n'a qu'une phrase à composer : « signalé par Charles
       * Ngassa », « ouvert par Arsène Nkolo ». C'est `origin` qui dit laquelle
       * des deux, et rendre les deux objets obligerait chaque appelant à
       * refaire ce choix.
       *
       * `null` reste possible : les interventions antérieures à ce champ n'ont
       * pas d'auteur, et un locataire supprimé s'efface de la sienne — le
       * travail lui survit, sa jointure retombe à `null`.
       */
      works: travaux.map(({ reportedByTenant, reportedBy, ...reste }) => ({
        ...reste,
        reportedBy: reportedByTenant?.fullName ?? reportedBy?.fullName ?? null,
      })),
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
        /**
         * Ce que les réserves de sortie justifieraient de retenir.
         *
         * PROPOSÉ, jamais appliqué : la retenue reste une décision du
         * propriétaire, et l'état des lieux en est la pièce, pas l'auteur. Zéro
         * quand aucune sortie n'a été établie — auquel cas il n'y a rien à
         * opposer au locataire.
         */
        billableMinor: d.lease.inspections
          .flatMap((i) => i.findings)
          .reduce((somme, r) => somme + (r.costMinor ?? 0), 0),
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

    /**
     * Un versement ne se reçoit pas DEMAIN.
     *
     * `paidOn` n'était vérifié que sur sa forme. Une quittance a été émise pour
     * un règlement daté du 17 septembre alors qu'on était le 18 août : le
     * registre portait de l'argent qui n'était pas arrivé, et « encaissé ce
     * mois » le comptait.
     *
     * La borne est le jour COURANT en entier — un versement reçu ce matin et
     * saisi ce soir doit passer, quel que soit le fuseau de qui saisit.
     */
    if (corps.paidOn) {
      const recuLe = new Date(`${corps.paidOn}T00:00:00Z`)
      const maintenant = new Date()
      const finDuJour = new Date(
        Date.UTC(
          maintenant.getUTCFullYear(),
          maintenant.getUTCMonth(),
          maintenant.getUTCDate(),
          23,
          59,
          59,
        ),
      )
      if (recuLe > finDuJour) {
        res.status(422).json({ error: 'paid_in_future' })
        return
      }
    }

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
          ...(corps.note ? { note: corps.note } : {}),
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
          // `id` : sans lui, l'écran qui LISTE les versements ne peut pas
          // désigner celui qu'on veut retirer.
          select: { id: true, amountMinor: true, method: true, paidOn: true, reference: true },
          orderBy: { paidOn: 'asc' },
        },
        lease: {
          select: {
            rentMinor: true,
            tenant: { select: { fullName: true } },
            unit: {
              select: {
                label: true,
                building: {
                  // La DEVISE du parc voyage avec le document.
                  select: { name: true, district: true, park: { select: { currency: true } } },
                },
              },
            },
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
      /**
       * La DEVISE du document, et non celle de qui l'imprime.
       *
       * Ce document ne portait aucune unité : le client le mettait en forme avec
       * la devise d'affichage de sa machine. Le même versement imprimé sur deux
       * postes réglés différemment portait donc deux monnaies — et une quittance
       * est le seul papier que le locataire gardera pour prouver qu'il a payé.
       *
       * Elle est prise sur le PARC, à l'émission, et figée dans la réponse : une
       * quittance atteste d'un fait passé, et le parc pourrait changer de devise
       * demain sans que ce fait change.
       */
      currency: echeance.lease.unit.building.park.currency,
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
        id: p.id,
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
 * Le tarif en vigueur pour une période donnée.
 *
 * Les tarifs sont DATÉS parce qu'un prix du kilowattheure change en cours
 * d'année : refacturer janvier au tarif de novembre serait faux, et le seul
 * moyen de ne pas se tromper est de choisir celui qui était en vigueur au
 * moment du relevé. `UtilityTariff` porte `effectiveFrom` depuis l'origine du
 * schéma, sans que rien ne l'écrive ni ne le lise.
 *
 * `null` quand aucun tarif ne précède la période — un parc qui vient d'ouvrir,
 * ou un relevé antérieur au premier prix saisi. Ce `null` voyage jusqu'à
 * l'écran, qui montre alors la QUANTITÉ sans montant. Poser un prix par défaut
 * ici ramènerait exactement le défaut qu'on retire : un chiffre affirmé à la
 * place de quelqu'un.
 *
 * La liste est supposée triée du plus récent au plus ancien — c'est l'ordre
 * demandé à la requête, et le premier candidat trouvé est donc le bon.
 */
function prixApplicable(
  tarifs: { utility: string; unitPriceMinor: number; effectiveFrom: Date }[],
  utility: string,
  periode: Date | null,
): number | null {
  if (!periode) return null
  const trouve = tarifs.find((t) => t.utility === utility && t.effectiveFrom <= periode)
  return trouve ? trouve.unitPriceMinor : null
}

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
    const { parkId, role } = req.adhesion!
    const corps = schemaInvitation.parse(req.body)

    /**
     * RECRUTER UN GESTIONNAIRE est un droit du propriétaire, et de lui seul.
     *
     * La route acceptait les deux rôles pour les deux natures de code : un
     * gestionnaire pouvait donc émettre un `GES` et faire entrer un pair qui
     * accède aussitôt à TOUT le parc — sans que le propriétaire ait rien à dire,
     * et sans qu'il puisse l'en retirer, puisque aucune route ne révoque une
     * adhésion et que `Invitation.revokedAt` est lu sans jamais être écrit.
     *
     * L'escalade était donc silencieuse et irréversible. Elle n'exigeait aucune
     * faille : la route faisait exactement ce qu'on lui demandait.
     *
     * Le partage suit la doctrine que le reste du serveur applique déjà — « le
     * gestionnaire opère, le propriétaire arbitre ». Recruter n'est pas opérer :
     * c'est décider qui entre. Le code LOCATAIRE, lui, reste au gestionnaire,
     * dont c'est le métier quotidien.
     *
     * Le contrôle vit ici et non dans `exigerRole`, parce qu'il dépend du CORPS
     * de la requête : le middleware ne le lit pas, et un rôle autorisé pour une
     * nature de code ne l'est pas pour l'autre.
     */
    if (corps.role === 'manager' && role !== 'owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    /**
     * ET PERSONNE NE RECRUTE DANS UN PARC QUI SE GÈRE SEUL.
     *
     * `Park.delegation` existait depuis l'origine du schéma, avec un commentaire
     * affirmant que « le serveur s'en sert pour autoriser ». Il ne s'en servait
     * nulle part : la colonne était lue une fois, pour être recopiée dans la
     * liste des parcs, et aucune décision n'en dépendait. Un propriétaire ayant
     * répondu « je gère seul » pouvait émettre un code de gestionnaire dans la
     * minute — le réglage n'était qu'un décor.
     *
     * 409 et non 403 : ce n'est pas un défaut de droit, c'est un état du parc,
     * et il se défait. Le code d'erreur nomme le réglage à changer plutôt que de
     * renvoyer le propriétaire à un « interdit » qui le viserait, lui.
     *
     * Le code LOCATAIRE reste émis dans les deux modes : gérer seul, c'est se
     * passer d'un tiers, pas de ses locataires.
     */
    if (corps.role === 'manager') {
      const parc = await prisma.park.findUniqueOrThrow({
        where: { id: parkId },
        select: { delegation: true },
      })
      if (parc.delegation === 'solo') {
        res.status(409).json({ error: 'delegation_off' })
        return
      }
    }

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
    let invitation
    try {
      invitation = await prisma.invitation.create({
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
    } catch (err) {
      /**
       * UN SEUL code vivant par logement, et le dire au lieu de rompre.
       *
       * `bail_unique_par_unite` pose un index unique partiel sur `unitId` là où
       * `acceptedAt` et `revokedAt` sont nuls — c'est lui qui empêche « deux
       * codes valides pour un seul accès, dont on ne saurait pas lequel
       * révoquer ». La contrainte est juste ; ce qui manquait, c'est sa
       * traduction : Prisma levait P2002, rien ne le rattrapait, et le
       * propriétaire recevait un 500 nu sur un geste parfaitement ordinaire —
       * réémettre un code pour un logement dont le premier n'a pas servi.
       *
       * Le 409 nomme l'état plutôt que l'accident, et la route de révocation
       * livrée avec lui donne enfin la sortie : reprendre le code en attente,
       * puis en émettre un autre.
       */
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'invitation_pending' })
        return
      }
      throw err
    }

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

/**
 * Ce qu'on peut corriger d'un parc, et rien d'autre.
 *
 * Chaque champ est FACULTATIF : l'appelant envoie ce qu'il change. Exiger le
 * triplet complet obligerait l'écran à renvoyer des valeurs qu'il n'a pas
 * modifiées, et une lecture périmée écraserait alors la correction d'un autre.
 *
 * `.refine` sur le corps vide : une requête qui ne change rien réussirait
 * silencieusement, et l'écran annoncerait « enregistré » sans qu'aucune
 * écriture ait eu lieu — le mensonge le plus discret de la famille.
 */
const schemaCorrectionDuParc = z
  .object({
    name: z.string().trim().min(2, 'Au moins 2 caractères').max(120).optional(),
    countryCode: z.string().length(2).toUpperCase().optional(),
    currency: z.enum(['XAF', 'XOF', 'EUR', 'CAD', 'USD']).optional(),
    /**
     * La politique de délégation, qui n'était modifiable par aucune route.
     *
     * Elle vaut `delegate` par défaut depuis la création du schéma, et le seul
     * écran qui la présente la tient dans un `useState` : le propriétaire
     * choisissait entre deux modes qui n'existaient que le temps du rendu.
     */
    delegation: z.enum(['solo', 'delegate']).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.countryCode !== undefined ||
      v.currency !== undefined ||
      v.delegation !== undefined,
    { message: 'Rien à corriger' },
  )

const schemaMessageGroupe = z.object({
  /** Absent : tout le parc. Présent : le seul immeuble nommé. */
  buildingId: z.string().uuid().optional(),
  /**
   * Le texte, borné.
   *
   * Trois caractères au moins — « ok » n'est pas une annonce —, mille au plus :
   * au-delà, ce n'est plus une notification mais une lettre, et le canal qui la
   * porterait n'existe pas encore.
   */
  message: z.string().trim().min(3, 'Au moins 3 caractères').max(1000),
})

const schemaReponse = z.object({
  message: z.string().trim().min(3, 'Au moins 3 caractères').max(1000),
})

/**
 * RÉPONDRE AU LOCATAIRE QUI A SIGNALÉ.
 *
 * Le canal existait dans un seul sens. Un locataire déclarait une fuite, puis
 * regardait un statut avancer — « déclaré », « devisé », « validé » — sans
 * jamais savoir quand quelqu'un passerait, ni pourquoi rien ne bougeait. Le
 * gestionnaire, lui, n'avait que le téléphone : les échanges qui décident d'une
 * dépense se perdaient hors du dossier.
 *
 * PAS de nouvelle table, et c'est un choix. La notification est déjà un fil :
 * elle porte un destinataire nommé, une date, un état de lecture, et plusieurs
 * réponses s'y empilent d'elles-mêmes. Ajouter un `lastReply` sur le chantier
 * n'en garderait qu'une — un dossier d'où les échanges disparaissent ne défend
 * plus personne, c'est le raisonnement que `unsettle` porte déjà.
 *
 * Ouverte aux deux rôles de gestion : répondre à un locataire est le geste le
 * plus ordinaire de l'exploitation.
 */
parksRouter.post(
  '/:parkId/works/:workId/reply',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const brut = req.params.workId
    const workId = typeof brut === 'string' ? brut : ''
    const corps = schemaReponse.parse(req.body)

    const travail = await prisma.workOrder.findFirst({
      where: { id: workId, unit: { building: { parkId } } },
      select: {
        id: true,
        reference: true,
        unitId: true,
        reportedByTenant: { select: { id: true, fullName: true, userId: true } },
      },
    })
    if (!travail) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Une intervention SANS déclarant n'a personne à qui répondre.
     *
     * C'est le cas de celles que le bailleur ouvre lui-même — un entretien
     * planifié, une remise en location. Rendre 409 plutôt que d'écrire une
     * notification sans destinataire : elle n'aurait été lue par personne, et
     * l'écran aurait annoncé « réponse envoyée ».
     */
    if (!travail.reportedByTenant) {
      res.status(409).json({ error: 'no_reporter' })
      return
    }

    /**
     * Le destinataire nommé est REDONDANT ici, et il est posé quand même.
     *
     * La notification porte l'unité du chantier, qui est celle du déclarant :
     * le filtre du portefeuille la lui montrerait déjà par ce chemin. Aucune
     * mutation ne peut donc distinguer les deux, et il faut le dire plutôt que
     * de laisser croire à une garde — c'est un cas de test qui l'a révélé, en
     * survivant au retrait du destinataire.
     *
     * On le pose parce qu'il porte `readAt`, le seul endroit où l'état de
     * lecture peut vivre. Aucune route ne le marque encore ; le jour où l'une
     * le fera, elle n'aura rien à rattraper. L'omettre aujourd'hui coûterait
     * une migration de données ce jour-là.
     */
    const destinataire = travail.reportedByTenant.userId

    await prisma.notification.create({
      data: {
        parkId,
        kind: 'work',
        messageKey: 'workReply',
        /**
         * `workId` voyage avec le texte : c'est lui qui rattache la réponse au
         * signalement dans l'espace du locataire. Sans lui, les réponses
         * s'empileraient dans une liste sans dire de quoi elles parlent.
         */
        params: { text: corps.message, workId: travail.id, reference: travail.reference },
        severity: 'medium',
        unitId: travail.unitId,
        channel: 'in_app',
        ...(destinataire ? { recipients: { create: [{ userId: destinataire }] } } : {}),
      },
    })

    /**
     * On dit si elle sera LUE, pas seulement si elle est écrite.
     *
     * Un locataire dont la fiche n'est reliée à aucun compte n'a pas d'espace
     * où la trouver. La réponse est quand même consignée — elle appartient au
     * dossier de l'intervention — mais le gestionnaire doit savoir qu'il lui
     * reste un appel à passer.
     */
    res.status(201).json({
      delivered: Boolean(destinataire),
      reporter: { fullName: travail.reportedByTenant.fullName },
    })
  },
)

/**
 * LE MESSAGE GROUPÉ AUX LOCATAIRES.
 *
 * « Une intervention sur le réseau d'eau est prévue jeudi entre 8 h et 12 h » —
 * le seul envoi à plusieurs destinataires qui existait était la relance
 * d'impayés, sans texte libre. Un bailleur qui devait prévenir les quatre
 * locataires d'un immeuble n'avait que son téléphone.
 *
 * UNE notification, N destinataires, et non l'inverse. Le message est le même
 * pour tous : en fabriquer un par personne créerait quatre faits là où il y en
 * a un, et le bailleur relisant son journal croirait avoir écrit quatre fois.
 *
 * Le texte voyage dans `params`, pas dans une clé. C'est l'exception à la règle
 * « aucune phrase dans la donnée », et elle se justifie précisément par ce que
 * la règle protège : les phrases du PRODUIT doivent être traduites, donc
 * portées par des clés. Celle-ci est écrite par un humain pour un autre, et
 * personne ne traduit ce que le bailleur a écrit.
 */
parksRouter.post(
  '/:parkId/announcements',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaMessageGroupe.parse(req.body)

    /**
     * Les locataires EN PLACE, et eux seuls.
     *
     * La fenêtre du bail borne l'envoi : prévenir d'une coupure d'eau celui qui
     * est parti l'an dernier est au mieux inutile, au pire une fuite — il
     * apprendrait qu'un logement qu'il a quitté est occupé.
     */
    const baux = await prisma.lease.findMany({
      where: {
        status: 'active',
        unit: {
          building: { parkId, ...(corps.buildingId ? { id: corps.buildingId } : {}) },
        },
      },
      select: { tenant: { select: { id: true, fullName: true, userId: true } } },
    })

    if (baux.length === 0) {
      // Un immeuble inconnu du parc et un immeuble sans locataire rendent le
      // MÊME refus : distinguer les deux dirait à qui devine des identifiants
      // lesquels existent.
      res.status(404).json({ error: 'not_found' })
      return
    }

    const avecCompte = baux.filter((b) => b.tenant.userId)
    const sansCompte = baux.filter((b) => !b.tenant.userId)

    if (avecCompte.length > 0) {
      await prisma.notification.create({
        data: {
          parkId,
          kind: 'announcement',
          messageKey: 'announcement',
          params: { text: corps.message },
          severity: 'medium',
          // Aucune `unitId` : le message porte sur un immeuble ou sur le parc,
          // et l'attacher à une unité le ferait apparaître comme un événement
          // de ce logement-là chez les autres destinataires.
          channel: 'in_app',
          recipients: {
            create: avecCompte.map((b) => ({ userId: b.tenant.userId! })),
          },
        },
      })
    }

    /**
     * CE QUI N'EST PAS PARTI SE DIT.
     *
     * Un locataire sans compte ne recevra rien — il n'a pas d'espace où lire.
     * Rendre le seul nombre d'envois laisserait croire que tout le monde est
     * prévenu, et c'est le mensonge que ce produit retire partout ailleurs. Le
     * bailleur a besoin de savoir qui appeler.
     */
    res.status(201).json({
      delivered: avecCompte.length,
      unreachable: sansCompte.map((b) => ({ tenantId: b.tenant.id, fullName: b.tenant.fullName })),
    })
  },
)

/**
 * Les identifiants à marquer. Bornés : « tout marquer comme lu » n'est pas une
 * invitation à envoyer le parc entier dans un corps de requête.
 */
const schemaLecture = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
})

/**
 * MARQUER UNE NOTIFICATION COMME LUE.
 *
 * `NotificationRecipient.readAt` existe au modèle depuis sa création, et son
 * commentaire disait déjà pourquoi : « le client le tenait dans un `Set` de
 * session, invisible de la barre latérale — la pastille annonçait 2 même après
 * avoir tout marqué comme lu ». La lecture du portefeuille le RELIT depuis
 * autant de temps. Aucune route ne l'écrivait : le bouton « tout marquer comme
 * lu » vidait un compteur qui repoussait au rechargement suivant.
 *
 * Le lot précédent a consigné la dette en toutes lettres — « aucune route ne le
 * marque encore ; le jour où l'une le fera, elle n'aura rien à rattraper ».
 * C'est ce jour-là.
 *
 * TROIS ÉTATS et non deux, et c'est ce que l'`upsert` ne sait pas dire :
 *   — aucune ligne : le bailleur, à qui l'on n'adresse rien nommément. Ses
 *     notifications lui parviennent par l'unité, pas par un destinataire. Sans
 *     création de ligne, il ne pourrait RIEN marquer, jamais ;
 *   — une ligne à `readAt` nul : le locataire à qui l'on a répondu. La ligne
 *     existe depuis l'envoi, elle attend sa date ;
 *   — une ligne datée : déjà lue. On n'y touche plus — « il l'a vue le 12 » est
 *     un fait, et le réécrire à chaque ouverture de l'écran l'effacerait.
 *
 * Ouverte à TOUS LES RÔLES : lire ses propres notifications n'est pas un acte
 * de gestion.
 */
parksRouter.patch(
  '/:parkId/notifications/read',
  exigerAppartenance,
  async (req: Request, res: Response) => {
    const { parkId, role } = req.adhesion!
    const corps = schemaLecture.parse(req.body)

    /**
     * Le MÊME filtre que la lecture du portefeuille, et pour la même raison.
     *
     * Sans lui, un locataire marquerait comme lue une notification d'un autre
     * logement — donc en créerait la ligne de destinataire, donc se la ferait
     * servir au chargement suivant par la seconde branche du filtre. Le geste
     * le plus anodin du produit ouvrirait un accès aux impayés du voisin.
     */
    const visibles = await unitesVisibles(parkId, req.compteId!, role)
    const idsVisibles = visibles?.map((u) => u.id)

    const lisibles = await prisma.notification.findMany({
      where: {
        id: { in: corps.ids },
        parkId,
        ...(idsVisibles
          ? {
              OR: [
                { unitId: { in: idsVisibles } },
                { recipients: { some: { userId: req.compteId! } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        recipients: { where: { userId: req.compteId! }, select: { readAt: true } },
      },
    })

    const maintenant = new Date()
    const sansLigne = lisibles.filter((n) => n.recipients.length === 0)
    /**
     * On sépare selon qu'une LIGNE existe, et non selon qu'elle est lue.
     *
     * Filtrer ici sur `readAt === null` aurait porté la condition une seconde
     * fois, le `where` ci-dessous la portant déjà. Deux gardes pour une même
     * règle ne valent pas mieux qu'une : elles se couvrent l'une l'autre, et
     * AUCUNE des deux ne peut alors être mise en défaut — retirer l'une laissait
     * l'autre satisfaire les cas, et la ligne survivait à toute mutation sans
     * qu'on sache si elle servait encore.
     *
     * Une seule garde, portée par la base où elle est atomique. Marquer deux
     * fois ne compte plus zéro parce qu'on l'a calculé d'avance, mais parce que
     * la seconde écriture ne trouve aucune ligne à changer.
     */
    const dejaDestinataire = lisibles.filter((n) => n.recipients.length > 0)

    const [crees, relues] = await prisma.$transaction([
      /**
       * `skipDuplicates` tranche une COURSE, et une seule : deux onglets ouverts
       * sur les notifications, tous deux « tout marquer comme lu ». Les deux ont
       * lu la même absence de ligne, les deux en créent une. Sans lui, le second
       * casse sur la clé primaire du couple et le geste échoue à l'écran alors
       * qu'il a abouti.
       */
      prisma.notificationRecipient.createMany({
        data: sansLigne.map((n) => ({
          notificationId: n.id,
          userId: req.compteId!,
          readAt: maintenant,
        })),
        skipDuplicates: true,
      }),
      /**
       * `readAt: null` dans le FILTRE, et non seulement dans la sélection au
       * dessus : la même course y remettrait une date par-dessus la première.
       * La condition est portée par la base, où elle est atomique.
       */
      prisma.notificationRecipient.updateMany({
        where: {
          notificationId: { in: dejaDestinataire.map((n) => n.id) },
          userId: req.compteId!,
          readAt: null,
        },
        data: { readAt: maintenant },
      }),
    ])

    /**
     * CE QUI A CHANGÉ, et non « c'est fait ».
     *
     * Rendre le nombre de nouvelles lectures — et non le nombre d'identifiants
     * reçus — est ce qui rend l'idempotence observable : marquer deux fois rend
     * `2` puis `0`. C'est la forme que la relance porte déjà avec
     * `sent` / `skipped`, et sans elle une branche morte survivrait sans bruit.
     */
    /*
     * Le compte vient des ÉCRITURES, non de l'état lu avant elles. Entre la
     * lecture et la transaction, un second onglet a pu marquer les mêmes
     * notifications : `sansLigne.length + enAttente.length` aurait alors
     * annoncé des lectures que cette requête n'a pas faites.
     */
    res.json({ marked: crees.count + relues.count })
  },
)

/**
 * CORRIGER LE PARC : son nom, son pays, sa devise.
 *
 * Aucune route ne modifiait un parc — pas un `park.update` dans tout le
 * serveur. Un propriétaire dont le parc était né avec la mauvaise devise
 * l'était pour toujours, et chaque loyer qu'il saisissait était relu dans une
 * unité qui n'est pas la sienne. Le cas n'est pas théorique : le pays du compte
 * était déduit de la devise affichée sur la vitrine au moment de l'inscription,
 * si bien qu'un visiteur qui avait regardé la grille tarifaire en euros
 * naissait français.
 *
 * Réservée au PROPRIÉTAIRE. La devise et le pays d'un parc ne sont pas des
 * réglages d'affichage : ils déterminent l'unité de tout ce qui s'y compte, et
 * le gestionnaire opère dans cette unité sans la fixer.
 */
parksRouter.patch(
  '/:parkId',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaCorrectionDuParc.parse(req.body)

    /**
     * CHANGER LA DEVISE NE CONVERTIT RIEN, et c'est assumé.
     *
     * Les montants sont stockés en unités mineures, sans devise attachée : un
     * loyer de 180 000 relu en euros reste 180 000, soit six cent cinquante-six
     * fois sa valeur. Convertir demanderait une source de taux et une date de
     * référence sur chaque montant — un vrai sujet, pas un effet de bord de
     * cette route.
     *
     * On ne l'interdit pas pour autant : le cas qui appelle ce geste est
     * précisément le parc jeune, né dans la mauvaise unité, dont les quelques
     * montants seront resaisis. C'est à l'écran de le dire AVANT le clic, et il
     * le dit — mais la route n'a pas à faire semblant de l'ignorer, d'où ce
     * commentaire plutôt qu'une garde silencieuse.
     */
    /**
     * ON NE PASSE PAS EN « JE GÈRE SEUL » AVEC UN GESTIONNAIRE EN PLACE.
     *
     * Le mode `solo` dit qu'aucun tiers n'opère ce parc. L'écrire pendant qu'une
     * adhésion de gestionnaire est active produirait un parc qui affirme une
     * chose et en pratique une autre : Diane garderait sa clé, ses écrans et ses
     * gestes, sous un réglage qui annonce qu'elle n'existe pas. Le refus nomme
     * le geste à faire d'abord — retirer l'accès, au registre des accès — plutôt
     * que de révoquer dans le dos du propriétaire une adhésion qu'il n'a pas
     * demandé de retirer.
     *
     * Compté sur `status: 'active'`, comme `exigerAppartenance` : une adhésion
     * révoquée ne retient plus rien.
     */
    if (corps.delegation === 'solo') {
      const gestionnaires = await prisma.membership.count({
        where: { parkId, role: 'manager', status: 'active' },
      })
      if (gestionnaires > 0) {
        res.status(409).json({ error: 'has_managers' })
        return
      }
    }

    const parc = await prisma.park.update({
      where: { id: parkId },
      data: {
        ...(corps.name !== undefined ? { name: corps.name } : {}),
        ...(corps.countryCode !== undefined ? { countryCode: corps.countryCode } : {}),
        ...(corps.currency !== undefined ? { currency: corps.currency } : {}),
        ...(corps.delegation !== undefined ? { delegation: corps.delegation } : {}),
      },
      select: { id: true, name: true, countryCode: true, currency: true, delegation: true },
    })

    res.json({ park: parc })
  },
)

/**
 * LES TARIFS DE REFACTURATION.
 *
 * Deux constantes vivaient dans le client — 520 le mètre cube, 99 le
 * kilowattheure — et l'écran des relevés les affichait comme des faits, avec le
 * total qui en découle. Pour tous les parcs, dans toutes les devises, sans
 * qu'aucun propriétaire puisse les corriger : un locataire lisait donc ce qu'il
 * doit à partir d'un prix que rien ne fondait. C'est la faute la plus chère de
 * ce produit, parce que quelqu'un paie dessus.
 *
 * La table existait depuis l'origine du schéma, avec `parkId`, `effectiveFrom`
 * et une contrainte d'unicité sur le triplet — donc des prix PAR PARC et DATÉS,
 * ce qui est la seule forme juste. Rien ne l'écrivait ni ne la lisait.
 *
 * Lecture ouverte aux deux rôles de gestion : le gestionnaire refacture au
 * quotidien et doit voir à quel prix. L'écriture est au propriétaire seul —
 * fixer un prix engage l'argent du locataire, et c'est le même partage que la
 * validation d'un devis ou l'arbitrage d'une caution.
 */
parksRouter.get(
  '/:parkId/tariffs',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const tarifs = await prisma.utilityTariff.findMany({
      where: { parkId },
      orderBy: [{ utility: 'asc' }, { effectiveFrom: 'desc' }],
      select: { id: true, utility: true, unitPriceMinor: true, effectiveFrom: true },
    })

    res.json({
      /**
       * L'HISTORIQUE ENTIER, pas seulement le prix courant.
       *
       * Un tarif passé n'est pas un déchet : c'est ce qui explique une
       * quittance de l'an dernier. Ne rendre que le dernier obligerait à
       * deviner pourquoi un mois ancien a été facturé autrement, et c'est
       * exactement la question qu'un locataire pose quand il conteste.
       */
      tariffs: tarifs.map((t) => ({
        id: t.id,
        utility: t.utility,
        unitPriceMinor: t.unitPriceMinor,
        effectiveFrom: t.effectiveFrom.toISOString().slice(0, 10),
      })),
    })
  },
)

const schemaTarif = z.object({
  utility: z.enum(['water', 'power']),
  /**
   * Le prix en unités MINEURES, entier, et strictement positif.
   *
   * Zéro serait accepté par une contrainte « positif ou nul » et signifierait
   * « je refacture gratuitement » — ce qui se dit en ne posant pas de tarif du
   * tout, l'écran montrant alors la quantité sans montant. Deux façons
   * d'exprimer la même chose, dont une qui affiche « 0 FCFA » sous les yeux du
   * locataire, valent mieux qu'une seule bien choisie.
   */
  unitPriceMinor: z.number().int().positive(),
  /**
   * La date de prise d'effet, en jour calendaire.
   *
   * `YYYY-MM-DD` et non un instant : un tarif entre en vigueur un jour, pas à
   * une heure, et lire ce jour à travers un fuseau le décalerait d'un cran pour
   * la moitié de la planète — le défaut que le dépôt a déjà payé sur les dates
   * de bail.
   */
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ'),
})

parksRouter.post(
  '/:parkId/tariffs',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaTarif.parse(req.body)

    try {
      const tarif = await prisma.utilityTariff.create({
        data: {
          parkId,
          utility: corps.utility,
          unitPriceMinor: corps.unitPriceMinor,
          // `T00:00:00Z` explicite : la colonne est de type `date`, et une
          // chaîne sans fuseau serait lue dans celui du serveur.
          effectiveFrom: new Date(`${corps.effectiveFrom}T00:00:00.000Z`),
        },
        select: { id: true, utility: true, unitPriceMinor: true, effectiveFrom: true },
      })

      res.status(201).json({
        tariff: {
          id: tarif.id,
          utility: tarif.utility,
          unitPriceMinor: tarif.unitPriceMinor,
          effectiveFrom: tarif.effectiveFrom.toISOString().slice(0, 10),
        },
      })
    } catch (err) {
      /**
       * UN SEUL prix par énergie et par jour de prise d'effet.
       *
       * La contrainte est au schéma depuis l'origine, et elle est juste : deux
       * prix valables le même jour rendraient indéterminable ce qu'on facture.
       * Ce qui manquait, c'est sa traduction — sans ce rattrapage, un
       * propriétaire qui corrige une faute de frappe en réémettant le même jour
       * reçoit un 500 nu sur un geste ordinaire.
       */
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'tariff_exists' })
        return
      }
      throw err
    }
  },
)

/**
 * QUI A ACCÈS À CE PARC.
 *
 * Le produit savait faire entrer et ne savait pas regarder. Aucune route ne
 * listait les membres ni les codes en attente : le propriétaire ignorait qui
 * détenait un accès au parc, et `codeHint` — les quatre derniers caractères,
 * écrits à chaque émission « pour qu'il reconnaisse le code qu'il a envoyé » —
 * n'était relu nulle part, faute d'écran pour l'afficher.
 *
 * Ouverte au gestionnaire, et pas seulement au propriétaire : c'est lui qui
 * émet les codes de locataire au quotidien, et un code qu'on ne peut pas
 * retrouver est un code qu'on réémet en double.
 *
 * Les invitations rendues sont exactement celles que `/api/join` accepterait —
 * ni acceptée, ni révoquée, ni expirée. Deux définitions du mot « en attente »
 * finiraient par diverger, et l'écran promettrait alors des codes que la porte
 * refuse.
 */
parksRouter.get(
  '/:parkId/access',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const maintenant = new Date()

    const [membres, invitations] = await Promise.all([
      prisma.membership.findMany({
        where: { parkId, status: 'active' },
        // `ParkRole` est déclaré `owner, manager, tenant` : PostgreSQL trie ses
        // énumérations dans l'ordre de DÉCLARATION, pas dans l'ordre
        // alphabétique. Le propriétaire vient donc en tête, ce qui est aussi
        // l'ordre de lecture attendu.
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { fullName: true, email: true } },
        },
      }),
      prisma.invitation.findMany({
        where: { parkId, acceptedAt: null, revokedAt: null, expiresAt: { gt: maintenant } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          codeHint: true,
          expiresAt: true,
          createdAt: true,
          unit: { select: { id: true, label: true } },
        },
      }),
    ])

    res.json({
      members: membres.map((m) => ({
        id: m.id,
        role: m.role,
        fullName: m.user.fullName,
        email: m.user.email,
        since: m.createdAt.toISOString(),
      })),
      /**
       * `codeHint` et JAMAIS le code : seule son empreinte est en base, et
       * c'est le seul état du produit qui garantit qu'une sauvegarde volée
       * n'ouvre aucun parc. L'indice suffit à reconnaître un code qu'on a
       * transmis, il ne suffit pas à en fabriquer un.
       */
      invitations: invitations.map((i) => ({
        id: i.id,
        role: i.role,
        codeHint: i.codeHint,
        expiresAt: i.expiresAt.toISOString(),
        issuedAt: i.createdAt.toISOString(),
        unitId: i.unit?.id ?? null,
        unitLabel: i.unit?.label ?? null,
      })),
    })
  },
)

/**
 * Révoque une invitation qui n'a pas encore servi.
 *
 * Trois raisons, dont la deuxième est un blocage que personne n'avait vu :
 *
 *  1. Un code transmis au mauvais numéro reste valable quatorze jours, et rien
 *     ne permettait de le reprendre. `Invitation.revokedAt` existait depuis
 *     l'origine, était LU à chaque consommation — dans `/api/join` comme à
 *     l'inscription — et n'était écrit nulle part. La colonne était
 *     structurellement toujours nulle : une garde qui ne gardait rien.
 *
 *  2. La migration `bail_unique_par_unite` pose un index unique partiel sur
 *     `unitId` là où `acceptedAt` et `revokedAt` sont nuls. Sans écriture de
 *     `revokedAt`, un logement dont le code n'a jamais été utilisé n'en accepte
 *     aucun second avant l'expiration : le propriétaire qui s'était trompé de
 *     destinataire était bloqué deux semaines sur ce logement. Le commentaire
 *     de la migration décrivait le piège sans savoir qu'il le créait — « deux
 *     codes valides pour un seul accès, dont on ne saurait pas lequel révoquer ».
 *
 *  3. Le lot précédent a fermé le recrutement d'un gestionnaire au seul
 *     propriétaire. Fermer la porte d'entrée sans donner de moyen de reprendre
 *     un code déjà émis laissait la moitié du geste en l'air.
 *
 * PATCH et non DELETE : la ligne reste, avec la date et son émetteur. Un
 * registre d'accès dont les décisions disparaissent ne défend plus personne —
 * c'est le raisonnement que `unsettle` porte déjà mot pour mot.
 */
parksRouter.patch(
  '/:parkId/invitations/:invitationId/revoke',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId, role } = req.adhesion!
    const brut = req.params.invitationId
    const invitationId = typeof brut === 'string' ? brut : ''

    // `parkId` DANS le filtre : un identifiant deviné révoquerait sinon le code
    // d'un parc voisin, et le 404 dit la même chose qu'une invitation absente.
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, parkId },
      select: { id: true, role: true, revokedAt: true },
    })
    if (!invitation) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Le partage du lot précédent, dans l'autre sens.
     *
     * Reprendre un code de gestionnaire, c'est décider qui n'entre pas — le
     * pendant exact de décider qui entre. Laisser ce geste au gestionnaire lui
     * rendrait par la bande la main sur le recrutement : il pourrait annuler
     * celui que le propriétaire vient d'inviter. Les codes de LOCATAIRE
     * restent les siens, émission comme retrait.
     */
    if (invitation.role === 'manager' && role !== 'owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    if (invitation.revokedAt) {
      /**
       * Reprendre un code DÉJÀ repris réussit, et ne réécrit pas la date.
       *
       * L'état demandé est celui qu'on trouve : refuser serait punir un second
       * clic, ou deux écrans ouverts sur la même liste. Mais la date du premier
       * retrait est conservée — c'est elle qui dit quand l'accès a cessé
       * d'exister, et l'écraser réécrirait l'histoire du registre.
       */
      res.status(204).end()
      return
    }

    const { count } = await prisma.invitation.updateMany({
      // `acceptedAt: null` porté par l'ÉCRITURE, et non par la lecture qui
      // précède. Un premier jet contrôlait les deux : la lecture rendait le
      // refus, l'écriture le rendait aussi, et aucune mutation ne pouvait plus
      // distinguer laquelle tenait la règle. Un contrôle que rien ne distingue
      // est un contrôle que rien ne tient — celui-ci reste seul, parce qu'il
      // est le seul à trancher aussi la course : entre les deux requêtes,
      // quelqu'un peut avoir consommé le code.
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (count === 0) {
      /**
       * Une invitation consommée ne se reprend pas : la personne est ENTRÉE, et
       * son accès ne tient plus au code mais à son adhésion. Reprendre le code
       * ici ne fermerait rien tout en ayant l'air de le faire — c'est
       * exactement le genre de geste qui rassure à tort. Le refus se distingue
       * du 404 pour que l'écran puisse dire quoi faire à la place : retirer
       * l'accès, pas le code.
       */
      res.status(409).json({ error: 'already_accepted' })
      return
    }

    res.status(204).end()
  },
)

/**
 * Retire à quelqu'un son accès au parc.
 *
 * La dernière moitié d'une ligne tracée en trois lots. On savait empêcher
 * d'entrer — le recrutement d'un gestionnaire est réservé au propriétaire — et
 * reprendre un code non consommé. Celui qui était DÉJÀ entré, lui, ne pouvait
 * plus sortir : il n'existait pas un seul `membership.update` dans tout le
 * serveur, et `MembershipStatus.revoked` était une valeur que rien n'avait
 * jamais posée.
 *
 * Ce qui rend le geste immédiat était en place depuis toujours sans que
 * personne s'en serve : `exigerAppartenance` cherche une adhésion `active`. La
 * requête suivante ne trouve donc plus rien, et rend le 404 qu'elle rend à un
 * inconnu — pas un 403, qui confirmerait l'existence du parc.
 *
 * Ce qui n'est PAS retiré : le compte, ses autres parcs, et — pour un
 * locataire — sa fiche, son bail et son historique de paiements. On retire un
 * ACCÈS, pas une personne ni ce qu'elle a vécu dans le parc. Effacer le second
 * en retirant le premier ferait disparaître des dettes et des cautions.
 */
parksRouter.patch(
  '/:parkId/memberships/:membershipId/revoke',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const brut = req.params.membershipId
    const membershipId = typeof brut === 'string' ? brut : ''

    // `parkId` DANS le filtre : sans lui, un identifiant deviné retirerait
    // quelqu'un d'un parc dont on n'est pas membre.
    const adhesion = await prisma.membership.findFirst({
      where: { id: membershipId, parkId },
      select: { id: true, userId: true },
    })
    if (!adhesion) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * ON NE SE RETIRE PAS SOI-MÊME.
     *
     * Un propriétaire qui se révoque laisse un parc que plus personne ne peut
     * arbitrer : ses immeubles, ses baux et ses cautions restent en base, hors
     * d'atteinte, et aucune route ne permet de s'y rattacher sans un code que
     * seul un membre peut émettre. Le parc serait orphelin pour toujours.
     *
     * Cette garde suffit, et c'est pourquoi il n'y en a pas de seconde sur « le
     * dernier propriétaire » : la route étant fermée à tout autre rôle, le seul
     * chemin vers un parc sans propriétaire passe par l'auto-retrait. Un
     * propriétaire peut en retirer un autre — il en reste alors au moins un,
     * lui-même. Ajouter un comptage ici serait du code qu'aucune mutation ne
     * pourrait faire rougir.
     */
    if (adhesion.userId === req.compteId!) {
      res.status(409).json({ error: 'cannot_revoke_self' })
      return
    }

    /**
     * L'écriture est INCONDITIONNELLE, et c'est ce qui rend la route idempotente.
     *
     * Un premier jet ajoutait ici une sortie anticipée « déjà révoquée, 204 » :
     * elle ne changeait rien — l'écriture repose la même valeur et rend le même
     * code — et aucune mutation ne pouvait la distinguer. Elle est partie. Ce
     * qu'il ne faut PAS faire, en revanche, c'est restreindre ce `where` aux
     * adhésions actives : le second appel ne trouverait plus sa ligne, Prisma
     * lèverait, et deux écrans ouverts sur le même registre suffiraient à
     * produire une erreur là où il n'y a qu'un état déjà atteint.
     */
    await prisma.membership.update({
      where: { id: adhesion.id },
      data: { status: 'revoked' },
    })

    res.status(204).end()
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
        const bail = await tx.lease.create({
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

        if (corps.depositMinor !== undefined) {
          // `held` : encaissée et détenue. Elle ne devient arbitrable qu'à la
          // sortie, quand un état des lieux dit ce qu'il y a à retenir.
          await tx.deposit.create({
            data: { leaseId: bail.id, heldMinor: corps.depositMinor, status: 'held' },
          })
        }

        return bail
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

/**
 * Le dû et le retard d'UN bail — PARTAGÉ entre la route manuelle et
 * `executerRelancesAutomatiques` (le futur cron), pour que les deux ne
 * puissent jamais diverger sur ce qui compte le plus : combien, et depuis
 * quand.
 */
export function calculerRetard(
  bail: {
    charges: { dueOn: Date; rentMinor: number; payments: { amountMinor: number }[] }[]
  },
  maintenant: Date,
): { dûMinor: number; jours: number } {
  // Le même calcul que `statut()`, délibérément : relancer un locataire que
  // l'écran affiche à jour serait le pire des défauts possibles ici.
  const dûMinor = bail.charges.reduce((somme, c) => {
    const regle = c.payments.reduce((s, p) => s + p.amountMinor, 0)
    return somme + Math.max(0, c.rentMinor - regle)
  }, 0)

  // Le retard se compte depuis la PLUS ANCIENNE échéance impayée : c'est celle
  // qui fait la gravité, et le chiffre que lit le bailleur.
  const plusAncienne = bail.charges.find(
    (c) => c.payments.reduce((s, p) => s + p.amountMinor, 0) < c.rentMinor,
  )
  const jours = plusAncienne
    ? Math.floor((maintenant.getTime() - plusAncienne.dueOn.getTime()) / 86_400_000)
    : 0

  return { dûMinor, jours }
}

/**
 * Clé de message d'une relance, et marqueur de sa trace.
 *
 * SANS préfixe, comme toutes les autres — `rentOverdue`, `quotePending`,
 * `metersMissing`. Elle s'écrivait `notifications.rentReminder` : l'écran
 * compose `app.alerts.msg.${messageKey}.title`, ce qui donnait
 * `app.alerts.msg.notifications.rentReminder.title`, absent des deux
 * dictionnaires. Le fournisseur d'i18n rend alors la CLÉ BRUTE : un
 * gestionnaire qui relançait un impayé sur son parc voyait du texte technique
 * s'inscrire dans sa liste de signalements.
 *
 * Le défaut n'était visible que sur un vrai parc : le jeu de démonstration
 * écrit les bonnes clés, et toute la suite du gestionnaire tourne dessus.
 */
const CLE_RELANCE = 'rentReminder'
/** Clé de message d'une mise en demeure. Même règle. */
const CLE_MISE_EN_DEMEURE = 'formalNotice'

/** Échappe ce qui viendrait d'un locataire avant de l'insérer dans du HTML. */
function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Un montant en unités mineures, mis en forme pour un lecteur — pas pour une
 * machine.
 *
 * `XAF`/`XOF` n'ont pas de sous-unité : l'unité mineure EST l'unité affichée.
 * Les autres devises du produit en ont deux : l'unité mineure est le centime.
 * Même distinction que `CURRENCY_DEFS.decimals` côté client, réécrite ici en
 * quelques lignes plutôt qu'importée : les deux projets ne partagent pas de
 * module, et la règle ne bouge pas assez souvent pour justifier d'en créer un.
 */
function formaterMontant(minor: number, devise: string): string {
  const sansSousUnite = devise === 'XAF' || devise === 'XOF'
  const majeur = sansSousUnite ? minor : minor / 100
  const nombre = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: sansSousUnite ? 0 : 2,
    maximumFractionDigits: sansSousUnite ? 0 : 2,
  }).format(majeur)
  return `${nombre} ${devise}`
}

/** Gabarit du courriel de relance automatique — sujet, texte, HTML. */
function gabaritRelanceEmail(
  nomLocataire: string,
  jours: number,
  dûMinor: number,
  devise: string,
): { sujet: string; texte: string; html: string } {
  const montant = formaterMontant(dûMinor, devise)
  const sujet = `GestLocPro — loyer en retard de ${jours} jours`
  const texte =
    `Bonjour ${nomLocataire},\n\n` +
    `Votre loyer est en retard de ${jours} jours. Montant dû : ${montant}.\n\n` +
    `Merci de régulariser dans les meilleurs délais.`
  const html =
    `<p>Bonjour ${echapperHtml(nomLocataire)},</p>` +
    `<p>Votre loyer est en retard de ${jours} jours. Montant dû : ${echapperHtml(montant)}.</p>` +
    `<p>Merci de régulariser dans les meilleurs délais.</p>`
  return { sujet, texte, html }
}

/**
 * Tente la relance automatique par e-mail d'UN bail, au jalon J+7 — CLAIM PUIS
 * ENVOI, et dans cet ordre précis.
 *
 * La ligne `RentReminderEmail` est insérée AVANT que le courriel ne parte, sous
 * la contrainte UNIQUE `(leaseId, sentOn)` posée par la migration. Deux
 * exécutions simultanées — le cron et un déclenchement manuel, ou deux passages
 * du cron qui se chevauchent — tentent toutes deux cet INSERT ; Postgres n'en
 * laisse passer qu'une, l'autre lève une violation de contrainte (P2002) que
 * cette fonction interprète comme « déjà pris en charge aujourd'hui » plutôt
 * que comme une panne. SEULE la gagnante appelle `envoyerEmail`.
 *
 * Vérifier d'abord par une lecture, puis écrire — la forme qu'emploie encore le
 * volet SMS de cette même route — ne protège PAS contre une vraie course : les
 * deux exécutions liraient « rien encore » avant que l'une n'écrive. C'est le
 * défaut que ce lot doit ne pas reproduire, pas seulement ne pas aggraver.
 */
export async function tenterRelanceEmailMilestone(
  bail: { id: string; tenant: { fullName: string; email: string | null } },
  jours: number,
  dûMinor: number,
  devise: string,
): Promise<'no_email' | 'already_claimed' | 'sent' | 'not_delivered'> {
  if (!bail.tenant.email) return 'no_email'

  const aujourdHui = debutDuJour(new Date())
  try {
    await prisma.rentReminderEmail.create({
      data: { leaseId: bail.id, milestone: jours, sentOn: aujourdHui },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'already_claimed'
    }
    throw err
  }

  const gabarit = gabaritRelanceEmail(bail.tenant.fullName, jours, dûMinor, devise)
  const parti = await laMessagerie().envoyerEmail(bail.tenant.email, gabarit.sujet, gabarit)
  if (!parti) return 'not_delivered'

  // `deliveredAt` posé APRÈS coup, sur la ligne que l'INSERT ci-dessus a créée
  // — jamais par avance, même règle que `Notification.sentAt`.
  await prisma.rentReminderEmail.updateMany({
    where: { leaseId: bail.id, sentOn: aujourdHui },
    data: { deliveredAt: new Date() },
  })
  return 'sent'
}

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
      where: {
        unit: { building: { parkId } },
        // Liste absente : tout le parc. Le filtrage sur ce qui est réellement
        // dû se fait plus bas, comme pour une liste explicite.
        ...(corps.leaseIds ? { id: { in: corps.leaseIds } } : { status: { in: ['active', 'pending'] } }),
      },
      select: {
        id: true,
        unitId: true,
        tenant: { select: { fullName: true, userId: true, phoneE164: true, email: true } },
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

    /**
     * La devise du parc, lue UNE fois : le montant du courriel de relance en a
     * besoin, et `RentCharge` ne la porte pas — elle appartient au parc, comme
     * partout ailleurs dans le produit.
     */
    const { currency: devise } = await prisma.park.findUniqueOrThrow({
      where: { id: parkId },
      select: { currency: true },
    })

    const envoyees: string[] = []
    const ignorees: { leaseId: string; reason: string }[] = []
    /**
     * Les baux à J+7 dont le courriel n'est PAS parti, et pourquoi.
     *
     * Distinct de `ignorees` : un bail qui y figure a par ailleurs très bien pu
     * être traité côté SMS/journal — les deux volets sont indépendants, voir
     * `tenterRelanceEmailMilestone`. Le rendu doit dire QUI est injoignable,
     * comme `AnnounceModal` le fait déjà pour les signalements.
     */
    const courrielsIgnores: { leaseId: string; reason: string }[] = []

    for (const bail of baux) {
      const { dûMinor, jours } = calculerRetard(bail, maintenant)
      if (dûMinor <= 0) {
        ignorees.push({ leaseId: bail.id, reason: 'nothing_due' })
        continue
      }

      /**
       * LE VOLET E-MAIL, avant toute garde du volet SMS ci-dessous.
       *
       * Un bail déjà « relancé aujourd'hui » au sens du journal SMS (ligne
       * suivante) n'a pas forcément reçu de courriel — ce sont deux traces
       * distinctes, `Notification` et `RentReminderEmail`. Placer ce volet
       * APRÈS la garde `bauxDejaVus` l'aurait fait sauter silencieusement dans
       * ce cas précis ; c'est exactement le genre de couplage qu'un plan
       * d'exécution ne révèle pas et qu'une relecture ligne à ligne, si.
       */
      if (corps.only === 'milestones' && jours === JALON_EMAIL_AUTOMATIQUE) {
        const issue = await tenterRelanceEmailMilestone(bail, jours, dûMinor, devise)
        if (issue === 'no_email') {
          courrielsIgnores.push({ leaseId: bail.id, reason: 'no_email' })
        }
      }

      if (corps.only === 'milestones' && !JALONS_RELANCE.includes(jours as 1 | 7 | 15)) {
        ignorees.push({ leaseId: bail.id, reason: 'not_a_milestone' })
        continue
      }
      if (bauxDejaVus.has(bail.id)) {
        ignorees.push({ leaseId: bail.id, reason: 'already_reminded_today' })
        continue
      }

      /**
       * L'ENVOI passe par la couture, et `sentAt` dit la vérité.
       *
       * `MessagerieDeJournal` rend `false` tant qu'aucun fournisseur n'est
       * configuré — c'est le cœur de cette couture, et la raison pour laquelle
       * elle ne ment pas. La date d'envoi n'est donc posée que si le message est
       * réellement PARTI, et le canal suit : `sms` quand il est parti par SMS,
       * `in_app` quand il n'est resté que dans le produit.
       *
       * Le jour où un fournisseur est branché, une seule ligne change ailleurs
       * et ces relances partent pour de bon. Rien ici n'aura à bouger.
       *
       * Pas de numéro, pas de SMS : un locataire sans téléphone reçoit la
       * notification dans le produit, et le bailleur voit qu'elle n'est pas
       * partie.
       */
      const texte = `${bail.tenant.fullName} — loyer en retard de ${jours} j. Merci de régulariser.`
      const parti = bail.tenant.phoneE164
        ? await laMessagerie().envoyerSms(bail.tenant.phoneE164, texte)
        : false

      await prisma.notification.create({
        data: {
          parkId,
          kind: 'payment',
          messageKey: CLE_RELANCE,
          // `leaseId` dans les paramètres : c'est la clé de la garde du jour,
          // et `Notification` n'a pas de colonne pour le porter.
          /**
           * Les noms du CONTRAT, et non ceux du domaine.
           *
           * `overdueDays` et `dueMinor` disaient juste, mais le client ne sait
           * interpoler que `count`, `amount`, `tenant`, `date`… — la table de
           * `useAlertMessage`. Un gabarit « en retard de {count} jours »
           * n'aurait donc rien trouvé à mettre dans ses accolades, et l'écran
           * aurait affiché l'accolade elle-même : exactement le défaut pour
           * lequel `contract.test.ts` a été écrit.
           *
           * `leaseId` reste : il n'est pas interpolé, il porte la garde du
           * « déjà relancé aujourd'hui », que `Notification` n'a pas de colonne
           * pour exprimer.
           */
          params: {
            leaseId: bail.id,
            tenant: bail.tenant.fullName,
            count: jours,
            amount: dûMinor,
          },
          severity: jours >= 15 ? 'high' : 'medium',
          unitId: bail.unitId,
          channel: parti ? 'sms' : 'in_app',
          ...(parti ? { sentAt: new Date() } : {}),
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
    if (corps.leaseIds) {
      const lus = new Set(baux.map((b) => b.id))
      for (const id of corps.leaseIds) {
        if (!lus.has(id)) ignorees.push({ leaseId: id, reason: 'not_found' })
      }
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
    res.json({ sent: envoyees, skipped: ignorees, emailSkipped: courrielsIgnores })
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
          // `amount` et non `dueMinor` : voir la relance ci-dessus, même raison.
          params: { tenant: bail.tenant.fullName, amount: dûMinor },
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
  /**
   * Le LOCATAIRE y a droit, et c'est le point de ce correctif.
   *
   * Le modèle porte `reportedByTenantId` depuis le premier jour, et rien ne
   * l'écrivait : personne ne pouvait signaler quoi que ce soit. Or c'est
   * l'origine NORMALE d'une intervention — l'écran des travaux le dit lui-même,
   * « une intervention naît d'un signalement de locataire, jamais d'une saisie
   * du bailleur ». La chaîne partait donc de son deuxième maillon.
   *
   * Le périmètre est posé plus bas, sur SON logement, et le statut est forcé :
   * un locataire déclare un problème, il n'ouvre pas un chantier.
   */
  exigerRole('owner', 'manager', 'tenant'),
  async (req: Request, res: Response) => {
    const { parkId, role } = req.adhesion!
    const unitId = z.string().uuid().parse(req.params.unitId)
    const corps = schemaIntervention.parse(req.body)

    /**
     * Le cloisonnement est DANS la requête, comme partout ailleurs.
     *
     * Filtrer après lecture supposerait d'avoir d'abord chargé l'unité, et il
     * suffirait d'un oubli pour qu'un locataire déclare une fuite chez son
     * voisin — un signalement notifié au bailleur, sur un logement qui n'est pas
     * le sien.
     */
    const unite = await prisma.unit.findFirst({
      where: {
        id: unitId,
        building: { parkId },
        /**
         * La contrainte porte sur le BAIL, et non sur une liste d'identifiants.
         *
         * Première rédaction : `...(visibles ? { id: { in: […] } } : {})`, à la
         * suite de `id: unitId`. Le spread ÉCRASAIT la clé `id` — la requête
         * cherchait donc « n'importe lequel de mes logements » au lieu du
         * logement demandé. Un locataire visant celui du voisin recevait 201, et
         * le signalement était créé sur le sien : ni refus, ni erreur, ni trace.
         *
         * Deux clés du même nom dans un littéral d'objet ne cohabitent pas ;
         * exprimer la règle par la relation retire le piège au lieu de le
         * contourner.
         */
        ...(role === 'tenant'
          ? { leases: { some: { tenant: { userId: req.compteId! } } } }
          : {}),
      },
      select: { id: true },
    })
    if (!unite) {
      // 404 et non 403 : un 403 confirmerait l'existence du logement voisin.
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Le signalement porte le NOM de qui l'a fait, quand c'est un locataire.
     *
     * Sans cela, le bailleur reçoit un problème sans savoir qui l'a vu — et ne
     * peut donc ni rappeler ni faire ouvrir la porte.
     */
    const declarant =
      role === 'tenant'
        ? await prisma.tenant.findFirst({
            where: { parkId, userId: req.compteId!, leases: { some: { unitId: unite.id } } },
            select: { id: true },
          })
        : null

    /**
     * L'origine se DÉRIVE du rôle, elle ne se saisit pas.
     *
     * Le corps de la requête ne la porte pas, et c'est délibéré : un client qui
     * pourrait l'annoncer pourrait mentir. Une intervention étiquetée
     * « initiative du bailleur » alors qu'un locataire l'a ouverte inverserait
     * la charge d'une dépense — et l'origine sert précisément à distinguer ce
     * qu'on subit de ce qu'on décide.
     *
     * Le serveur sait qui parle ; il n'a besoin de rien d'autre.
     */
    const origine = role === 'tenant' ? 'tenantReport' : 'ownerInitiative'

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
          origin: origine,
          ...(corps.description ? { description: corps.description } : {}),
          ...(declarant ? { reportedByTenantId: declarant.id } : {}),
          /* L'AUTEUR, quand ce n'est pas un locataire. L'intervention naissait
             sans aucun auteur dans ce cas : rien à opposer six mois plus tard à
             « qui a décidé cette dépense ». */
          ...(role === 'tenant' ? {} : { reportedById: req.compteId! }),
        },
        select: { id: true, reference: true, status: true, title: true, origin: true },
      })
    })

    res.status(201).json({ work: travail })
  },
)

/**
 * Le locataire demande une pièce administrative.
 *
 * Cette demande partait par la route des interventions, faute d'objet pour la
 * porter : le gestionnaire recevait « Attestation de résidence » avec un
 * métier, une urgence, une référence de chantier et un cycle devis →
 * validation → clôture dont rien ne s'applique. Elle s'affichait, chez le
 * locataire comme chez lui, dans « Travaux dans mon logement », à côté d'une
 * fuite d'évier.
 *
 * **Réservée au locataire**, quand la déclaration d'incident est ouverte aux
 * trois rôles. Un propriétaire n'a pas à se demander à lui-même une attestation
 * de résidence : la route existerait pour un geste que personne ne fait, et
 * `requestedBy` porterait alors un nom qui n'a rien demandé.
 */
parksRouter.post(
  '/:parkId/units/:unitId/document-requests',
  exigerAppartenance,
  exigerRole('tenant'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const unitId = z.string().uuid().parse(req.params.unitId)
    const corps = schemaDemandeDocument.parse(req.body)

    /**
     * Le cloisonnement est DANS la requête, et il vise le BAIL.
     *
     * On ne cherche pas « une unité que ce compte peut voir » mais « le bail en
     * cours de ce compte sur cette unité » : c'est lui qui portera la demande,
     * et c'est la seule lecture qui interdise à un ancien locataire d'en
     * déposer une sur le dossier de celui qui l'a remplacé.
     */
    const bail = await prisma.lease.findFirst({
      where: {
        unitId,
        unit: { building: { parkId } },
        status: { in: ['active', 'pending'] },
        tenant: { userId: req.compteId! },
      },
      select: { id: true },
    })
    if (!bail) {
      // 404 et non 403 : un 403 confirmerait l'existence du logement voisin.
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Le doublon est refusé par la BASE, pas par une lecture préalable.
     *
     * `DocumentRequest_bail_piece_en_attente_unique` est un index unique
     * partiel sur (bail, pièce) tant que la demande est en attente. Deux
     * requêtes simultanées — le double clic sur un réseau lent, exactement le
     * geste du marché visé — liraient toutes deux « aucune demande en cours »
     * avant que l'une n'écrive ; on attrape donc le refus de l'index plutôt que
     * d'ouvrir cette fenêtre.
     *
     * 409 et non 400 : la demande est bien formée, c'est son état qui
     * s'y oppose. L'écran s'en sert pour dire « déjà demandée », pas
     * « demande invalide ».
     */
    try {
      const demande = await prisma.documentRequest.create({
        data: { leaseId: bail.id, kind: corps.kind, requestedById: req.compteId! },
        select: { id: true, kind: true, status: true, requestedAt: true },
      })
      res.status(201).json({ request: demande })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        res.status(409).json({ error: 'already_pending' })
        return
      }
      throw err
    }
  },
)

/**
 * Le gestionnaire répond à une demande de pièce.
 *
 * `declined` est une réponse à part entière, et c'est pour cela qu'il existe :
 * une pièce qu'on ne peut pas produire — bail non signé, document inexistant —
 * laisserait sinon la demande « en attente » indéfiniment. Le locataire
 * guetterait, le gestionnaire garderait une ligne qu'il ne peut pas retirer.
 *
 * Ouvert au propriétaire ET au gestionnaire : fournir une attestation n'engage
 * aucune dépense, contrairement à la validation d'un devis. C'est
 * l'administratif courant, le cœur de ce qu'on délègue.
 */
parksRouter.patch(
  '/:parkId/document-requests/:requestId',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const requestId = z.string().uuid().parse(req.params.requestId)
    const corps = schemaReponseDocument.parse(req.body)

    const demande = await prisma.documentRequest.findFirst({
      where: { id: requestId, lease: { unit: { building: { parkId } } } },
      select: { id: true, status: true },
    })
    if (!demande) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (demande.status !== 'pending') {
      // Répondre deux fois écraserait la première réponse — et sa date, que le
      // locataire a peut-être déjà lue.
      res.status(409).json({ error: 'not_pending' })
      return
    }

    const maj = await prisma.documentRequest.update({
      where: { id: demande.id },
      data: { status: corps.status, resolvedAt: new Date(), resolvedById: req.compteId! },
      select: { id: true, kind: true, status: true, requestedAt: true, resolvedAt: true },
    })

    /**
     * Tracé, comme les autres décisions.
     *
     * « Je n'ai jamais reçu mon attestation » se règle en relisant qui a
     * répondu quoi, et quand. Sans cette ligne, la réponse ne vit que dans un
     * statut que la prochaine demande recouvrira.
     */
    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: `document.${corps.status}`,
        entity: 'DocumentRequest',
        entityId: demande.id,
        payload: { kind: maj.kind },
      },
    })

    res.json({ request: maj })
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

/**
 * Établit un état des lieux sur un logement.
 *
 * La fonction manquait ENTIÈREMENT : les modèles `Inspection` et
 * `InspectionFinding` existaient, la démonstration en servait six, et aucune
 * route ne permettait d'en créer un. L'écran correspondant n'avait donc aucune
 * commande — et son test d'état vide le gardait explicitement : « ne fabrique
 * aucune action : le produit ne sait pas en établir un ».
 *
 * C'est la seconde promesse vendue et non tenue trouvée dans cette grille
 * tarifaire, après les relances automatiques.
 *
 * Le locataire n'établit pas : il SIGNE. Le champ `signedByName` porte ce nom,
 * et son absence est un fait — un état des lieux non signé n'engage personne, et
 * le taire vaudrait mieux que de le faire passer pour signé.
 */
parksRouter.post(
  '/:parkId/units/:unitId/inspections',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const unitId = z.string().uuid().parse(req.params.unitId)
    const corps = schemaEtatDesLieux.parse(req.body)

    const unite = await prisma.unit.findFirst({
      where: { id: unitId, building: { parkId } },
      select: {
        id: true,
        leases: {
          where: { status: { in: ['active', 'pending'] } },
          select: { id: true },
          take: 1,
        },
      },
    })
    if (!unite) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const bail = unite.leases[0]

    /**
     * Une SORTIE suppose un bail : on ne quitte pas un logement qu'on n'occupe
     * pas. Une entrée peut en revanche précéder l'arrivée du locataire — c'est
     * même l'ordre normal, on constate avant de remettre les clés.
     */
    if (corps.kind === 'exit' && !bail) {
      res.status(409).json({ error: 'no_lease' })
      return
    }

    /**
     * IMPUTER UN COÛT DEPUIS UNE ENTRÉE EST REFUSÉ.
     *
     * C'est la règle qui donne son sens à l'état des lieux d'entrée : il relève
     * ce qui est DÉJÀ abîmé, précisément pour que le locataire n'en réponde
     * pas. Chiffrer une réserve d'entrée reviendrait à lui facturer les dégâts
     * du précédent — l'exact inverse de la protection que ce document offre.
     */
    if (corps.kind === 'entry' && corps.findings.some((r) => r.costMinor !== undefined)) {
      res.status(422).json({ error: 'entry_findings_not_billable' })
      return
    }

    /**
     * Un seul état des lieux de chaque nature par bail.
     *
     * « Entrée et sortie comparées pièce par pièce » : la comparaison suppose
     * deux documents, pas une pile. Un second écraserait en pratique le premier
     * dans la lecture, sans que rien ne dise lequel fait foi.
     */
    if (bail) {
      const existant = await prisma.inspection.findFirst({
        where: { leaseId: bail.id, kind: corps.kind },
        select: { id: true },
      })
      if (existant) {
        res.status(409).json({ error: 'already_recorded' })
        return
      }
    }

    const etat = await prisma.inspection.create({
      data: {
        unitId: unite.id,
        ...(bail ? { leaseId: bail.id } : {}),
        kind: corps.kind,
        // La date saisie est lue en UTC : la colonne est de type `date`, et une
        // date construite à minuit local recule d'un jour à l'est de Greenwich.
        performedOn: corps.performedOn
          ? new Date(`${corps.performedOn}T00:00:00Z`)
          : new Date(),
        rooms: corps.rooms,
        ...(corps.signedByName
          ? { signedByName: corps.signedByName, signedAt: new Date() }
          : {}),
        findings: {
          create: corps.findings.map((r) => ({
            room: r.room,
            description: r.description,
            severity: r.severity,
            ...(r.costMinor !== undefined ? { costMinor: r.costMinor } : {}),
          })),
        },
      },
      select: {
        id: true,
        kind: true,
        performedOn: true,
        rooms: true,
        signedAt: true,
        findings: { select: { id: true, room: true, severity: true, costMinor: true } },
      },
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'inspection.record',
        entity: 'Inspection',
        entityId: etat.id,
        payload: {
          kind: corps.kind,
          findings: corps.findings.length,
          // Le total imputable est figé ici : c'est le chiffre qui sera opposé
          // au locataire lors de la restitution.
          billableMinor: corps.findings.reduce((somme, r) => somme + (r.costMinor ?? 0), 0),
        },
      },
    })

    res.status(201).json({ inspection: etat })
  },
)

/**
 * ─── LES PHOTOS D'UNE RÉSERVE ────────────────────────────────────────────────
 *
 * Une réserve n'est aujourd'hui qu'un texte, et un texte s'oppose mal à une
 * caution : « rayure profonde sur le plan de travail » vaut ce que vaut la
 * parole de qui l'a écrit. La photo la rend vérifiable — mais seulement si sa
 * date ne vient pas du même appareil qu'elle.
 *
 * Quatre routes pour les quatre temps du contrat de stockage. Les octets ne
 * passent par aucune d'elles : le serveur signe une autorisation, le navigateur
 * dépose directement, puis revient dire « c'est monté ». C'est pour cela que
 * `réserver` et `confirmer` sont deux appels et non un.
 *
 * TOUTES derrière `exigerAppartenance`, qui rend 404 et non 403 : un 403
 * confirmerait l'existence d'un identifiant qu'on pourrait alors énumérer.
 *
 * Et toutes réservées au propriétaire et au gestionnaire. Le locataire est
 * membre du parc : `exigerAppartenance` seule le laisserait lire les photos
 * des états des lieux de TOUS ses voisins. Lui ouvrir les siennes demande la
 * règle de `unitesVisibles`, donc un écran pour l'employer — c'est le lot du
 * navigateur. Le silence ici est délibéré, et il est fermé, pas ouvert.
 */

const schemaReservationPhoto = z.object({
  /**
   * Le type est CHOISI dans une liste, pas accepté tel quel. Il compose
   * l'en-tête que le dépôt exigera, et une valeur libre y ferait entrer ce que
   * le navigateur voudra bien exécuter en la resservant.
   *
   * HEIC en est absent : Safari l'affiche, Chrome et Firefox non. Le refus
   * tombe au dépôt, où l'utilisateur peut encore reprendre la photo.
   */
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /**
   * La taille ANNONCÉE, qui sera scellée dans l'autorisation d'envoi. Le dépôt
   * refusera tout ce qui n'en fait pas exactement autant — c'est ce qui borne
   * la FACTURE, là où le contrôle à la confirmation ne bornait que la base.
   */
  sizeBytes: z.number().int().positive().max(PLAFOND_PAR_OBJET_OCTETS),
})

/** Ce qu'une photo montre à l'API. La clé de stockage n'en fait pas partie. */
const champsPhoto = {
  id: true,
  findingId: true,
  contentType: true,
  sizeBytes: true,
  confirmedAt: true,
  createdAt: true,
} as const

/**
 * Retrouve une photo DANS le parc, ou rien.
 *
 * Le cloisonnement est une clause de requête et non un filtre appliqué après
 * coup : la jointure `finding → inspection → unit → building → parkId` fait
 * qu'une photo d'un autre parc n'est jamais ramenée. Filtrer en mémoire
 * supposerait de l'avoir d'abord lue, et il suffirait d'un oubli sur un chemin
 * pour la laisser sortir.
 */
async function photoDuParc(photoId: string, parkId: string) {
  return prisma.inspectionPhoto.findFirst({
    where: { id: photoId, finding: { inspection: { unit: { building: { parkId } } } } },
    select: { ...champsPhoto, storageKey: true },
  })
}

/**
 * Réserve une place pour la photo d'une réserve.
 *
 * LA LIGNE EST CRÉÉE AVANT QUE LES OCTETS N'ARRIVENT, et c'est un arbitrage.
 *
 * Une réservation jamais confirmée — l'onglet fermé pendant la montée, le
 * réseau qui lâche — laisse un objet payé au gigaoctet-mois. Trois façons d'y
 * répondre :
 *
 *  - Ne rien faire. Le coût n'est pas nul, il est INCONNU : sans trace, le
 *    serveur ne sait même pas quelles clés il paie, ni combien. C'est le seul
 *    des trois qui empire tout seul.
 *  - Une règle de cycle de vie sur le seau. Presque gratuite, mais elle vit
 *    dans la console du fournisseur : hors du dépôt, non versionnée, non
 *    éprouvable par une porte, et sans équivalent pour l'adaptateur local.
 *  - Une ligne marquée « en attente », c'est-à-dire ceci. Elle coûte une
 *    écriture avant la montée, et elle ouvre une surface : un membre peut
 *    réserver en boucle et poser des lignes sans jamais déposer.
 *
 * Le troisième est retenu parce qu'il est le seul qui rende les autres
 * possibles : une clé sans ligne est introuvable, une clé avec ligne se
 * balaie par une requête d'une ligne — `confirmedAt IS NULL AND createdAt <
 * …`. Ce qu'il ne fait PAS, et qu'il faut dire : il ne balaie rien. Il rend le
 * balayage écrivable ; le balayage lui-même reste à faire.
 */
parksRouter.post(
  '/:parkId/findings/:findingId/photos',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const findingId = z.string().uuid().parse(req.params.findingId)
    const corps = schemaReservationPhoto.parse(req.body)

    // Cherchée AVEC le `parkId` : sans cela, une réserve devinée permettrait
    // d'accrocher une photo à l'état des lieux d'un autre.
    const reserve = await prisma.inspectionFinding.findFirst({
      where: { id: findingId, inspection: { unit: { building: { parkId } } } },
      select: { id: true },
    })
    if (!reserve) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const reservation = await leStockage().reserver(corps.contentType, corps.sizeBytes)

    const photo = await prisma.inspectionPhoto.create({
      data: {
        findingId: reserve.id,
        storageKey: reservation.cle,
        // ANNONCÉS, pas mesurés. `confirmedAt` restant nul le dit, et rien de
        // non confirmé n'est servi.
        contentType: corps.contentType,
        sizeBytes: corps.sizeBytes,
      },
      select: champsPhoto,
    })

    res.status(201).json({
      photo,
      /**
       * De quoi envoyer, rendu au client. La clé de stockage n'apparaît QUE là,
       * dans une adresse signée et périssable — jamais comme un champ de la
       * photo, qu'un écran finirait par afficher ou journaliser.
       */
      envoi: {
        url: reservation.url,
        methode: reservation.methode,
        entetes: reservation.entetes,
        expireLe: reservation.expireLe,
      },
    })
  },
)

/**
 * Confirme qu'une photo est montée, et POSE SA DATE.
 *
 * C'est le seul instant où le serveur peut regarder ce qui a été déposé : il
 * n'a pas vu les octets passer. Il en tire trois choses — le poids réel, la
 * nature réelle, et l'heure à laquelle il a lui-même constaté les deux.
 *
 * LA DATE VIENT D'ICI, JAMAIS DU CORPS DE LA REQUÊTE. Une date d'appareil se
 * change dans les réglages de l'appareil ; celle qu'on opposera au locataire
 * doit venir d'une horloge qu'il ne tient pas. Le schéma de cette route n'a
 * donc aucun champ de date, et rien ne lit `req.body` : ce qu'un client y
 * mettrait est ignoré, ce qui est exactement le comportement voulu.
 */
parksRouter.post(
  '/:parkId/photos/:photoId/confirmation',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const photoId = z.string().uuid().parse(req.params.photoId)

    const photo = await photoDuParc(photoId, parkId)
    if (!photo) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Confirmer deux fois est refusé. La seconde confirmation réécrirait la
     * date, c'est-à-dire la seule chose qui donne à cette photo sa valeur en
     * litige — et elle la réécrirait avec une heure que le déposant choisit en
     * décidant du moment où il rejoue l'appel.
     */
    if (photo.confirmedAt) {
      res.status(409).json({ error: 'already_confirmed' })
      return
    }

    const confirmation = await leStockage().confirmer(photo.storageKey, photo.contentType)

    if (!confirmation.accepte) {
      /**
       * Refusée : la ligne et l'objet partent ensemble.
       *
       * Garder l'une sans l'autre serait le pire des deux mondes — une ligne
       * qui promet une photo introuvable, ou des octets que plus rien ne
       * rattache à un parc, donc que plus aucun contrôle d'appartenance ne
       * protège.
       */
      await leStockage().supprimer(photo.storageKey)
      await prisma.inspectionPhoto.delete({ where: { id: photo.id } })
      res.status(422).json({ error: 'photo_rejected', motif: confirmation.motif })
      return
    }

    const maj = await prisma.inspectionPhoto.update({
      where: { id: photo.id },
      data: {
        // MESURÉS, ils remplacent l'annonce.
        contentType: confirmation.typeMime,
        sizeBytes: confirmation.octets,
        // L'horloge du SERVEUR. C'est toute la valeur de cette ligne.
        confirmedAt: new Date(),
      },
      select: champsPhoto,
    })

    await prisma.auditEvent.create({
      data: {
        parkId,
        actorId: req.compteId!,
        action: 'inspection.photo',
        entity: 'InspectionPhoto',
        entityId: maj.id,
        payload: { findingId: maj.findingId, sizeBytes: maj.sizeBytes, contentType: maj.contentType },
      },
    })

    res.json({ photo: maj })
  },
)

/**
 * Délivre une adresse de lecture, courte et signée.
 *
 * Le seau n'est jamais public : il n'existe pas d'adresse stable vers une
 * photo. Celle-ci est calculée à la demande, APRÈS le contrôle d'appartenance,
 * et périme en quelques minutes. Une adresse devinable serait une fuite
 * permanente, et une fuite d'image ne se rattrape pas.
 *
 * Une photo non confirmée n'a pas d'adresse. Ses octets n'ont jamais été
 * regardés par le serveur : les servir reviendrait à publier ce que le client
 * a bien voulu déposer, sous un type qu'il a bien voulu déclarer.
 */
parksRouter.get(
  '/:parkId/photos/:photoId',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const photoId = z.string().uuid().parse(req.params.photoId)

    const photo = await photoDuParc(photoId, parkId)
    if (!photo || !photo.confirmedAt) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const adresse = await leStockage().lire(photo.storageKey)

    res.json({
      photo: {
        id: photo.id,
        findingId: photo.findingId,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        confirmedAt: photo.confirmedAt,
        createdAt: photo.createdAt,
      },
      lecture: adresse,
    })
  },
)

/**
 * Supprime une photo — la ligne ET les octets.
 *
 * Dans cet ordre : l'objet d'abord, la ligne ensuite. Si l'effacement du dépôt
 * échoue, la ligne survit et la photo reste retrouvable ; l'inverse laisserait
 * des octets payés que plus rien ne désigne.
 */
parksRouter.delete(
  '/:parkId/photos/:photoId',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const photoId = z.string().uuid().parse(req.params.photoId)

    const photo = await photoDuParc(photoId, parkId)
    if (!photo) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    await leStockage().supprimer(photo.storageKey)
    await prisma.inspectionPhoto.delete({ where: { id: photo.id } })

    res.status(204).end()
  },
)

/**
 * Appel de loyers : émet les échéances du mois pour tous les baux en cours.
 *
 * Sans cela, une échéance n'existait QUE comme effet de bord d'un encaissement.
 * Le locataire qui ne paie pas n'en avait donc aucune — et n'était jamais en
 * retard : ni reste à percevoir, ni relance, ni mise en demeure. Toute la
 * chaîne de recouvrement, celle que la grille tarifaire vend, ne pouvait pas se
 * déclencher sur un parc réel. Elle ne se voyait qu'en démonstration, dont le
 * semis pose les échéances lui-même.
 *
 * C'est l'inversion qui compte : un loyer est dû parce que le mois est là, pas
 * parce que quelqu'un a payé.
 *
 * Le vocabulaire n'est pas inventé — le tableau de bord nomme déjà « le reste à
 * percevoir de l'appel de loyers courant ».
 */
parksRouter.post(
  '/:parkId/charges',
  exigerAppartenance,
  exigerRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const corps = schemaQuittance.omit({ unitId: true }).parse(req.body)
    const debut = new Date(`${corps.periodStart}T00:00:00Z`)

    const baux = await prisma.lease.findMany({
      where: {
        unit: { building: { parkId } },
        status: { in: ['active', 'pending'] },
        // Un bail qui commence APRÈS la période ne doit rien pour elle.
        startsOn: { lte: debut },
      },
      select: { id: true, rentMinor: true, dueDayOfMonth: true },
    })

    /**
     * `skipDuplicates` plutôt qu'une lecture préalable : l'unicité
     * `(leaseId, periodStart)` vit dans la base, et deux appels simultanés
     * liraient tous deux « rien pour ce mois » avant que l'un n'écrive.
     *
     * Appeler deux fois le même mois est donc SANS EFFET, et c'est voulu : on
     * relance l'appel après avoir ajouté un locataire en cours de mois, sans
     * craindre de doubler la dette des autres.
     */
    const { count } = await prisma.rentCharge.createMany({
      data: baux.map((bail) => ({
        leaseId: bail.id,
        periodStart: debut,
        // Le loyer du BAIL, figé à l'émission : le revaloriser plus tard ne
        // doit pas réécrire un mois déjà appelé.
        rentMinor: bail.rentMinor,
        dueOn: new Date(
          Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), bail.dueDayOfMonth),
        ),
      })),
      skipDuplicates: true,
    })

    if (count > 0) {
      await prisma.auditEvent.create({
        data: {
          parkId,
          actorId: req.compteId!,
          action: 'rent.call',
          entity: 'Park',
          entityId: parkId,
          payload: { periodStart: corps.periodStart, count },
        },
      })
    }

    // `issued` et non `created` : le nombre d'échéances RÉELLEMENT ajoutées.
    // Un second appel rend zéro, ce qui est un fait et non une erreur.
    res.status(200).json({ issued: count, leases: baux.length })
  },
)

/**
 * Supprime un versement.
 *
 * Le pendant manquant de l'annulation posée ailleurs : un encaissement saisi sur
 * la mauvaise période, au mauvais montant ou pour le mauvais locataire ne se
 * réparait que dans la base. Un registre sans gomme force à contourner le
 * produit, et c'est là que les vraies erreurs commencent.
 *
 * Réservée au PROPRIÉTAIRE. Retirer un versement fait réapparaître une dette :
 * c'est de l'argent qu'on déclare ne plus avoir reçu, et le gestionnaire
 * « propose, ne décide pas ».
 *
 * L'échéance, elle, RESTE. Elle a été appelée, elle est due, et la supprimer
 * effacerait la dette au lieu de la rétablir.
 */
parksRouter.delete(
  '/:parkId/payments/:paymentId',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const paymentId = z.string().uuid().parse(req.params.paymentId)

    const versement = await prisma.payment.findFirst({
      where: { id: paymentId, charge: { lease: { unit: { building: { parkId } } } } },
      select: { id: true, amountMinor: true, method: true, paidOn: true, chargeId: true },
    })
    if (!versement) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    await prisma.$transaction([
      prisma.payment.delete({ where: { id: versement.id } }),
      prisma.auditEvent.create({
        data: {
          parkId,
          actorId: req.compteId!,
          action: 'payment.delete',
          entity: 'RentCharge',
          entityId: versement.chargeId,
          /**
           * Le versement disparaît ; sa trace reste, montant compris.
           *
           * C'est ce qui distingue une correction d'un effacement : le jour où
           * un locataire produira un reçu pour une somme absente du registre, ce
           * journal dira quand elle en a été retirée et par qui.
           */
          payload: {
            amountMinor: versement.amountMinor,
            method: versement.method,
            paidOn: versement.paidOn.toISOString().slice(0, 10),
          },
        },
      }),
    ])

    res.status(204).end()
  },
)

/**
 * Retire une fiche locataire.
 *
 * Même manque que les immeubles ce matin : on pouvait créer une fiche et jamais
 * la retirer. Sur un objet plus lourd, puisqu'une fiche porte un bail.
 *
 * LA RÈGLE EST « AUCUNE SOMME N'A CIRCULÉ ». Un versement encaissé ou une
 * caution détenue rattachent de l'argent réel à cette personne : les effacer
 * laisserait des mouvements sans titulaire, ce que la contrainte `NoAction` de
 * `Lease.tenant` interdit déjà au niveau de la base.
 *
 * Les échéances APPELÉES et impayées, elles, partent avec le bail : ce ne sont
 * pas des mouvements mais des attentes, et elles n'ont plus d'objet dès lors que
 * le bail disparaît.
 *
 * Réservée au propriétaire. Retirer une fiche efface une personne du registre.
 */
parksRouter.delete(
  '/:parkId/tenants/:tenantId',
  exigerAppartenance,
  exigerRole('owner'),
  async (req: Request, res: Response) => {
    const { parkId } = req.adhesion!
    const tenantId = z.string().uuid().parse(req.params.tenantId)

    const locataire = await prisma.tenant.findFirst({
      where: { id: tenantId, parkId },
      select: {
        id: true,
        fullName: true,
        leases: {
          select: {
            id: true,
            deposit: { select: { heldMinor: true } },
            charges: { select: { _count: { select: { payments: true } } } },
          },
        },
      },
    })
    if (!locataire) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const versements = locataire.leases.reduce(
      (somme, bail) => somme + bail.charges.reduce((s, c) => s + c._count.payments, 0),
      0,
    )
    if (versements > 0) {
      // Le chemin de sortie existe : retirer d'abord les versements, un par un,
      // depuis la quittance. On défait dans l'ordre inverse de ce qu'on a fait.
      res.status(409).json({ error: 'has_payments' })
      return
    }

    const detenu = locataire.leases.reduce((somme, b) => somme + (b.deposit?.heldMinor ?? 0), 0)
    if (detenu > 0) {
      // Une caution détenue est l'argent de quelqu'un. Elle s'arbitre, elle ne
      // s'efface pas avec la fiche de celui à qui elle appartient.
      res.status(409).json({ error: 'has_deposit' })
      return
    }

    await prisma.$transaction(async (tx) => {
      const baux = locataire.leases.map((b) => b.id)
      // L'ordre suit les dépendances : les échéances tiennent au bail, le bail
      // tient au locataire, et `NoAction` refuse qu'on prenne le raccourci.
      await tx.rentCharge.deleteMany({ where: { leaseId: { in: baux } } })
      await tx.deposit.deleteMany({ where: { leaseId: { in: baux } } })
      await tx.inspection.deleteMany({ where: { leaseId: { in: baux } } })
      await tx.lease.deleteMany({ where: { id: { in: baux } } })
      await tx.tenant.delete({ where: { id: locataire.id } })
      await tx.auditEvent.create({
        data: {
          parkId,
          actorId: req.compteId!,
          action: 'tenant.delete',
          entity: 'Tenant',
          entityId: locataire.id,
          // Le nom reste au journal : la fiche part, la trace de son retrait
          // dit qui a été retiré et par qui.
          payload: { fullName: locataire.fullName, leases: baux.length },
        },
      })
    })

    res.status(204).end()
  },
)

/**
 * Rejoindre un parc avec un compte DÉJÀ créé.
 *
 * Le code d'invitation ne se consommait qu'à l'inscription. Un compte existant —
 * celui d'un invité dont le code n'était jamais parti, ou d'un locataire inscrit
 * avant de recevoir le sien — n'avait aucun moyen de rejoindre quoi que ce soit.
 * L'invitation restait valable et sans porte.
 *
 * Hors de `parksRouter` : on ne peut pas exiger l'appartenance à un parc pour
 * demander à le rejoindre. Seul le compte est requis.
 */
export const rejoindreRouter = Router()
rejoindreRouter.use(exigerCompte)

rejoindreRouter.post('/', async (req: Request, res: Response) => {
  const corps = z.object({ invitationCode: z.string().trim().min(4).max(40) }).parse(req.body)

  const invitation = await prisma.invitation.findUnique({
    where: { codeHash: empreinteJeton(normaliserCode(corps.invitationCode)) },
    select: { id: true, parkId: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true },
  })

  const maintenant = new Date()
  const utilisable =
    invitation && !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > maintenant

  // Un code invalide, expiré, révoqué ou déjà accepté rend le MÊME refus : les
  // distinguer dirait à qui essaie des codes au hasard lesquels ont existé.
  if (!utilisable) {
    res.status(400).json({ error: 'invitation_invalid' })
    return
  }

  const deja = await prisma.membership.findFirst({
    where: { userId: req.compteId!, parkId: invitation.parkId },
    select: { id: true },
  })
  if (deja) {
    // Le code resterait consommable pour quelqu'un d'autre : on ne le brûle pas.
    res.status(409).json({ error: 'already_member' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.create({
      // Le rôle vient de l'INVITATION, jamais de la saisie — la même règle qu'à
      // l'inscription, et pour la même raison.
      data: { userId: req.compteId!, parkId: invitation.parkId, role: invitation.role },
    })
    await tx.invitation.update({
      where: { id: invitation.id, acceptedAt: null },
      data: { acceptedAt: maintenant },
    })
  })

  res.status(201).json({ parkId: invitation.parkId, role: invitation.role })
})
