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
  /**
   * `true` quand le bailleur l'a décidée lui-même.
   *
   * La réfection complète de B4 l'était depuis toujours SANS pouvoir le dire :
   * c'est un chantier de relocation, décidé entre deux locataires, et son corps
   * de métier — « multi » — est justement celui que `TRADES_REPORTABLE` exclut
   * de ce qu'un locataire peut déclarer, avec ce commentaire : « multi-corps
   * qualifie un chantier que le bailleur arbitre, jamais un problème que le
   * locataire constate ». La donnée disait donc déjà l'origine, sans champ pour
   * la porter.
   */
  duBailleur?: boolean
}[] = [
  { unite: 'A3', title: 'Fuite sous l’évier de la cuisine', trade: 'plumbing', status: 'quoted', urgency: 'blocking', montant: 45000, jours: 35 },
  { unite: 'B2', title: 'Disjoncteur qui saute au démarrage du chauffe-eau', trade: 'power', status: 'approved', urgency: 'blocking', montant: 78000, jours: 38 },
  { unite: 'C1', title: 'Peinture du séjour à reprendre', trade: 'painting', status: 'reported', urgency: 'low', jours: 42 },
  { unite: 'A1', title: 'Remplacement du groupe de sécurité', trade: 'plumbing', status: 'done', urgency: 'normal', montant: 32000, jours: 50 },
  { unite: 'B4', title: 'Réfection complète avant relocation', trade: 'multi', status: 'approved', urgency: 'normal', montant: 340000, jours: 56, duBailleur: true },
  /* Une seconde initiative, sur une unité OCCUPÉE : sans elle, « à l'initiative
     du bailleur » se confondrait avec « logement vide », et le filtre paraîtrait
     ne trier que les relocations. */
  { unite: 'A4', title: 'Ravalement de la façade côté cour', trade: 'painting', status: 'quoted', urgency: 'low', montant: 210000, jours: 20, duBailleur: true },
]

/** Index de compteurs du mois, par unité. `null` = relevé non fait. */
/**
 * Profondeur de l'historique de relevés, en périodes.
 *
 * Douze, parce que c'est la question du locataire : « est-ce moi, une fuite, ou
 * le mois d'août ? » ne se répond qu'en voyant le même mois l'année d'avant.
 */
const PROFONDEUR_HISTORIQUE = 12

/**
 * Le profil saisonnier, par index de mois — 0 = janvier.
 *
 * Des facteurs FIXES, jamais tirés au hasard : un jeu de démonstration qui
 * change à chaque semis rend toute capture d'écran et tout cas de test
 * ininterprétables — on ne saurait plus si un chiffre a bougé parce que le code
 * a changé ou parce que le dé est retombé ailleurs.
 *
 * Ils suivent le climat de Yaoundé : grande saison sèche de décembre à février,
 * petite en juillet-août. L'eau y monte — arrosage, lessive, douches — et
 * l'électricité suit la ventilation.
 */
const SAISON = {
  water: [1.18, 1.2, 1.05, 0.92, 0.88, 0.9, 1.1, 1.15, 0.9, 0.85, 0.95, 1.15],
  power: [1.1, 1.14, 1.08, 1.0, 0.95, 0.92, 1.05, 1.12, 1.0, 0.96, 0.98, 1.08],
} as const

/**
 * `eauBase` et `elecBase` : la consommation de référence, EN DERNIER RECOURS.
 *
 * Elles ne servent qu'à A5 et C2, les deux unités sans relevé courant : sans
 * second index, aucune consommation ne se dérive, et la rétro-génération n'a
 * rien pour partir. Partout ailleurs les deux index la donnent — l'écrire à
 * côté en ferait une seconde source, libre de les contredire.
 */
const RELEVES: {
  unite: string
  eauPrec: number
  eau: number | null
  elecPrec: number
  elec: number | null
  jours: number | null
  eauBase?: number
  elecBase?: number
}[] = [
  { unite: 'A1', eauPrec: 342, eau: 358, elecPrec: 4120, elec: 4298, jours: 4 },
  { unite: 'A2', eauPrec: 289, eau: 301, elecPrec: 3540, elec: 3671, jours: 4 },
  { unite: 'A3', eauPrec: 415, eau: 436, elecPrec: 5210, elec: 5402, jours: 4 },
  { unite: 'A4', eauPrec: 502, eau: 529, elecPrec: 6180, elec: 6455, jours: 4 },
  { unite: 'A5', eauPrec: 176, eau: null, elecPrec: 2140, elec: null, jours: null, eauBase: 10, elecBase: 120 },
  { unite: 'B1', eauPrec: 388, eau: 402, elecPrec: 4870, elec: 5033, jours: 5 },
  { unite: 'B2', eauPrec: 356, eau: 371, elecPrec: 4405, elec: 4560, jours: 5 },
  { unite: 'B3', eauPrec: 271, eau: 284, elecPrec: 3290, elec: 3418, jours: 5 },
  { unite: 'C1', eauPrec: 611, eau: 644, elecPrec: 7320, elec: 7640, jours: 6 },
  { unite: 'C2', eauPrec: 334, eau: null, elecPrec: 4010, elec: null, jours: null, eauBase: 14, elecBase: 150 },
]

/**
 * Les états des lieux, avec leurs réserves NOMMÉES.
 *
 * Elles étaient fabriquées à la volée — « Pièce 1 », « Réserve constatée à
 * l'état des lieux », répétées autant de fois que le compte l'exigeait. Tant
 * que la réponse ne rendait qu'un nombre, personne ne les lisait ; la
 * comparaison entrée/sortie les met à l'écran, et une colonne de « Pièce 1 » ne
 * montre pas ce que ce tableau sert à montrer.
 *
 * B4 porte l'entrée ET la sortie du même bail, sur les mêmes pièces : c'est le
 * seul logement où la comparaison a quelque chose à comparer, et c'est
 * exactement ce qu'un visiteur doit pouvoir regarder. Le séjour s'est dégradé,
 * la cuisine est restée intacte, et la vitre cassée n'existait pas à l'entrée.
 */
const ETATS_DES_LIEUX: {
  unite: string
  kind: 'entry' | 'exit'
  jours: number
  rooms: number
  signe: boolean
  reserves: { room: string; description: string; severity: 'minor' | 'major'; cout?: number }[]
}[] = [
  {
    unite: 'A1', kind: 'entry', jours: 800, rooms: 4, signe: true,
    reserves: [
      { room: 'Salle de bain', description: 'Joint de douche noirci', severity: 'minor' },
      { room: 'Séjour', description: 'Peinture écaillée derrière la porte', severity: 'minor' },
    ],
  },
  {
    unite: 'B4', kind: 'entry', jours: 720, rooms: 4, signe: true,
    reserves: [
      { room: 'Séjour', description: 'Légère trace d’usure au sol', severity: 'minor' },
    ],
  },
  {
    unite: 'B4', kind: 'exit', jours: 55, rooms: 4, signe: true,
    reserves: [
      { room: 'Séjour', description: 'Parquet rayé sur deux lames', severity: 'major', cout: 35000 },
      { room: 'Chambre 2', description: 'Vitre fêlée', severity: 'major', cout: 20000 },
      { room: 'Salle de bain', description: 'Mitigeur fuyant', severity: 'major', cout: 18000 },
      { room: 'Salle de bain', description: 'Miroir descellé', severity: 'minor', cout: 6000 },
      { room: 'Cuisine', description: 'Plaque de cuisson rayée', severity: 'minor' },
      { room: 'Entrée', description: 'Serrure dure à fermer', severity: 'minor', cout: 12000 },
    ],
  },
  {
    unite: 'C3', kind: 'exit', jours: 78, rooms: 3, signe: true,
    reserves: [
      { room: 'Chambre', description: 'Volet roulant bloqué', severity: 'major', cout: 25000 },
      { room: 'Séjour', description: 'Interrupteur cassé', severity: 'minor', cout: 4000 },
    ],
  },
  { unite: 'A4', kind: 'entry', jours: 180, rooms: 5, signe: true, reserves: [] },
  {
    unite: 'A5', kind: 'entry', jours: 225, rooms: 2, signe: false,
    reserves: [
      { room: 'Cuisine', description: 'Plan de travail entaillé', severity: 'minor' },
    ],
  },
]

/**
 * Notifications, en clé de message et paramètres bruts.
 *
 * Rien n'est pré-formaté : les montants sont des nombres et les dates des
 * dates. Le client portait des phrases françaises complètes, chacune figeant en
 * plus une date au format numérique et un pluriel concaténé — le défaut se
 * répéterait ici si la base stockait du texte.
 */
const NOTIFICATIONS: { kind: 'payment' | 'work' | 'meter' | 'lease'; messageKey: string; unite?: string; severity: 'high' | 'medium' | 'low'; lu: boolean; heures: number; params: Record<string, unknown> }[] = [
  { kind: 'payment', messageKey: 'rentOverdue', unite: 'A3', severity: 'high', lu: false, heures: 2,
    params: { unitId: 'A3', tenant: 'Serge Mbarga', count: 24, on: { year: 2026, month: 7, day: 4 } } },
  { kind: 'work', messageKey: 'quotePending', unite: 'A3', severity: 'high', lu: false, heures: 5,
    params: { workId: 'SIG-2026-001', unitId: 'A3', amount: 45000 } },
  { kind: 'meter', messageKey: 'metersMissing', severity: 'medium', lu: true, heures: 24,
    params: { count: 2, period: { year: 2026, month: 7 }, units: ['A5', 'C2'] } },
  { kind: 'lease', messageKey: 'leaseRenewal', unite: 'B1', severity: 'low', lu: true, heures: 48,
    params: { unitId: 'B1', tenant: 'Jean-Paul Eboa', count: 45, dueOn: { year: 2026, month: 8, day: 30 } } },
  { kind: 'payment', messageKey: 'partialPayment', unite: 'A5', severity: 'medium', lu: true, heures: 72,
    params: { unitId: 'A5', tenant: 'Aline Tchoumi', amount: 40000, total: 75000 } },
  { kind: 'work', messageKey: 'workDone', unite: 'A1', severity: 'low', lu: true, heures: 120,
    params: { workId: 'SIG-2026-004', unitId: 'A1', on: { year: 2026, month: 6, day: 28 } } },
  { kind: 'payment', messageKey: 'receiptAvailable', unite: 'A1', severity: 'low', lu: true, heures: 144,
    params: { unitId: 'A1', amount: 145000, period: { year: 2026, month: 7 } } },
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
  const periodePrecedente = new Date(periode.getFullYear(), periode.getMonth() - 1, 1)
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

    /**
     * UNE demande de pièce en attente, et pas sur A1.
     *
     * Elle est là pour que la démonstration montre ce qu'elle prétend montrer :
     * la carte du gestionnaire ne s'affiche que s'il y a quelque chose à
     * traiter, et un parc sans demande la laisserait invisible. Une seule, et
     * en attente : c'est l'état qui appelle un geste, le seul qui apprenne
     * quelque chose à qui visite.
     *
     * B1 plutôt que A1 parce que A1 — Charles Ngassa — est le logement que la
     * suite de tests rattache au compte locataire : y poser une demande d'avance
     * ferait échouer sur un 409 le premier cas qui en demande une, pour une
     * raison qui n'aurait rien à voir avec ce qu'il vérifie.
     */
    if (u.cle === 'B1') {
      await tx.documentRequest.create({
        data: { leaseId: bail.id, kind: 'residence' },
      })
    }

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
     * Douze mois d'historique, et non la seule échéance courante.
     *
     * `COLLECTIONS` était une constante de douze mois côté client : trois
     * séries cohérentes entre elles et reliées à aucun encaissement. La ligne
     * d'objectif du graphique annonçait « 1,4 M » quand la somme des loyers
     * vaut 1 397 000 — deux chiffres voisins, jamais rapprochés.
     *
     * Les mois passés sont soldés ; seul le mois courant porte les impayés et
     * le règlement partiel. C'est ce qui rend l'histogramme lisible : une
     * dernière barre plus basse que les autres, pour une raison qu'on peut
     * ouvrir et vérifier ligne à ligne.
     */
    for (let recul = 11; recul >= 0; recul--) {
      /**
       * Premier du mois en UTC, et non en heure locale.
       *
       * Une colonne `date` est tronquée en UTC : `new Date(2025, 8, 1)` sur un
       * fuseau à l'est de Greenwich vaut le 31 août 22 h UTC, donc s'enregistre
       * « 2025-08-31 ». Tout l'axe du graphique reculait d'un mois — septembre
       * s'affichait « août » — sans qu'aucune valeur soit fausse.
       */
      const debut = new Date(Date.UTC(periode.getUTCFullYear(), periode.getUTCMonth() - recul, 1))
      const courant = recul === 0

      // Les charges varient d'un mois sur l'autre — un parc dont l'eau coûte
      // exactement la même chose douze fois de suite ne ressemble à rien.
      const eau = Math.round(u.loyer * 0.045 * (1 + ((recul % 5) - 2) * 0.06))
      const elec = Math.round(u.loyer * 0.036 * (1 + ((recul % 4) - 1.5) * 0.08))

      const dueOn = courant && u.retard ? moins(u.retard, aujourdhui) : new Date(debut)
      if (!(courant && u.retard)) dueOn.setUTCDate(5)

      const echeance = await tx.rentCharge.create({
        data: {
          leaseId: bail.id,
          periodStart: debut,
          dueOn,
          rentMinor: u.loyer,
          waterMinor: eau,
          powerMinor: elec,
        },
      })

      // Un mois passé est réglé ; le mois courant suit le cas de l'unité.
      const verse = courant ? u.regle : u.loyer + eau + elec
      if (verse) {
        await tx.payment.create({
          data: {
            chargeId: echeance.id,
            amountMinor: verse,
            method: 'mobile',
            paidOn: courant ? moins(3, aujourdhui) : new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 7)),
            recordedById: proprietaireId,
          },
        })
      }
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
        origin: w.duBailleur ? 'ownerInitiative' : 'tenantReport',
        /**
         * Le DÉCLARANT, dans les deux cas.
         *
         * Aucune intervention du jeu n'en portait : `reportedByTenantId` était
         * écrit par la vraie route et jamais par la démonstration, si bien que
         * l'écran ne pouvait pas montrer « signalé par » sur un parc de
         * démonstration — c'est-à-dire jamais pendant qu'on développe.
         */
        ...(w.duBailleur
          ? { reportedById: proprietaireId }
          : await (async () => {
              const locataire = await tx.tenant.findFirst({
                where: { parkId, leases: { some: { unitId } } },
                select: { id: true },
              })
              return locataire ? { reportedByTenantId: locataire.id } : {}
            })()),
      },
    })
  }

  /**
   * Les relevés, accumulés puis écrits EN UNE FOIS.
   *
   * Le semis n'en créait que deux par (unité, fluide) — le mois courant et son
   * antérieur — et l'espace du locataire n'avait donc qu'un chiffre à montrer.
   * Douze périodes répondent à sa seule vraie question quand sa facture
   * double : « est-ce moi, une fuite, ou le mois d'août ? »
   *
   * Un `createMany` et non 260 `create` : ce semis tourne dans CHAQUE cas
   * serveur qui demande `seedDemo`, et un aller-retour par ligne s'y paierait à
   * chaque fois.
   */
  const lignesDeReleve: {
    unitId: string
    utility: 'water' | 'power'
    periodStart: Date
    indexValue: number
    readAt: Date
    capturedById: string
  }[] = []

  for (const r of RELEVES) {
    const unitId = unites.get(r.unite)
    if (!unitId) continue
    // Une ligne par (unité, fluide, période) portant l'INDEX : la consommation
    // et l'index précédent s'en dérivent. Le client stockait un couple
    // `previous`/`current`, donc la copie d'une ligne qui devrait exister.
    for (const [utility, precedent, valeur, base] of [
      ['water', r.eauPrec, r.eau, r.eauBase],
      ['power', r.elecPrec, r.elec, r.elecBase],
    ] as const) {
      /**
       * La période PRÉCÉDENTE est semée elle aussi.
       *
       * `eauPrec` du client n'était pas une donnée : c'était la copie, dans la
       * ligne du mois, d'un relevé du mois d'avant qui aurait dû exister. Le
       * semer rend la dérivation possible — et c'est tout l'intérêt d'un index
       * plutôt que d'un couple figé.
       */
      lignesDeReleve.push({
        unitId,
        utility,
        periodStart: periodePrecedente,
        indexValue: precedent,
        readAt: moins(30, aujourdhui),
        capturedById: proprietaireId,
      })
      if (valeur !== null) {
        lignesDeReleve.push({
          unitId,
          utility,
          periodStart: periode,
          indexValue: valeur,
          readAt: moins(r.jours ?? 0, aujourdhui),
          capturedById: proprietaireId,
        })
      }

      /**
       * L'historique est RÉTRO-GÉNÉRÉ depuis l'index le plus ancien connu.
       *
       * En descendant plutôt qu'en montant, les deux index de tête — ceux que
       * les écrans du gestionnaire affichent et que ses cas de test lisent — ne
       * bougent pas d'un chiffre. Ajouter douze périodes ne réécrit donc aucune
       * attente existante.
       */
      const consoDeReference = valeur !== null ? valeur - precedent : (base ?? 0)
      let index = precedent
      let quand = periodePrecedente
      for (let recul = 1; recul <= PROFONDEUR_HISTORIQUE - 1; recul += 1) {
        // Le facteur du mois qu'on QUITTE, et non de celui où l'on arrive :
        // dans l'autre sens toute la saisonnalité glisse d'un cran, et la
        // pointe de saison sèche tomberait en mars.
        const facteur = SAISON[utility][quand.getMonth()]!
        index -= Math.round(consoDeReference * facteur)
        // Un index négatif serait un compteur qui tourne à l'envers. On
        // s'arrête : une série courte est honnête, une série absurde ne l'est
        // pas.
        if (index <= 0) break
        quand = new Date(quand.getFullYear(), quand.getMonth() - 1, 1)
        lignesDeReleve.push({
          unitId,
          utility,
          periodStart: quand,
          indexValue: index,
          readAt: moins(30 * (recul + 1), aujourdhui),
          capturedById: proprietaireId,
        })
      }
    }
  }

  await tx.meterReading.createMany({ data: lignesDeReleve })

  for (const e of ETATS_DES_LIEUX) {
    const unitId = unites.get(e.unite)
    if (!unitId) continue
    /**
     * Rattaché au BAIL, comme la vraie route le fait.
     *
     * Il ne l'était pas : toutes les inspections du jeu portaient `leaseId`
     * nul, alors que le modèle porte ce champ pour une raison écrite dans son
     * propre commentaire — « une sortie doit être attribuable au locataire qui
     * part, précisément la personne dont on arbitre la caution ». Une
     * démonstration qui s'écarte du produit sur ce point rendrait la
     * comparaison entrée/sortie impossible à apparier.
     */
    const bailDeLUnite = await tx.lease.findFirst({
      where: { unitId },
      select: { id: true },
    })
    await tx.inspection.create({
      data: {
        unitId,
        ...(bailDeLUnite ? { leaseId: bailDeLUnite.id } : {}),
        kind: e.kind,
        performedOn: moins(e.jours, aujourdhui),
        rooms: e.rooms,
        // `signed: boolean` ne disait ni qui ni quand, alors que c'est le champ
        // qu'on oppose au locataire en cas de litige.
        signedAt: e.signe ? moins(e.jours, aujourdhui) : null,
        findings: {
          create: e.reserves.map((r) => ({
            room: r.room,
            description: r.description,
            severity: r.severity,
            // Le coût n'existe que sur une SORTIE — le serveur refuse en 422
            // qu'une entrée en porte un, et la démonstration ne fait pas
            // exception à ce qu'elle est censée montrer.
            ...(e.kind === 'exit' && r.cout !== undefined ? { costMinor: r.cout } : {}),
          })),
        },
      },
    })
  }

  for (const n of NOTIFICATIONS) {
    const unitId = n.unite ? unites.get(n.unite) : undefined
    await tx.notification.create({
      data: {
        parkId,
        kind: n.kind,
        messageKey: n.messageKey,
        params: n.params as object,
        severity: n.severity,
        unitId: unitId ?? null,
        recipients: {
          create: { userId: proprietaireId, readAt: n.lu ? moins(0, aujourdhui) : null },
        },
        createdAt: new Date(aujourdhui.getTime() - n.heures * 3600_000),
      },
    })
  }
}
