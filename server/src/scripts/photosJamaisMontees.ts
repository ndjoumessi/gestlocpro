/**
 * LES RÉSERVATIONS DE PHOTOS QUE PERSONNE N'A CONFIRMÉES.
 *
 * ═══ LE SEUL DÉFAUT NOMMÉ QUI EMPIRE TOUT SEUL ═══
 *
 * La ligne d'une photo est créée AVANT que les octets n'arrivent. C'est un
 * arbitrage assumé, et la route de réservation porte son raisonnement entier :
 * une clé sans ligne serait introuvable, donc impossible à balayer. Le prix est
 * qu'une réservation jamais confirmée — l'onglet fermé pendant la montée, le
 * réseau qui lâche — laisse un objet facturé au gigaoctet-mois.
 *
 * Cet en-tête l'écrivait déjà : « Ce qu'il ne fait PAS, et qu'il faut dire : il
 * ne balaie rien. Il rend le balayage ÉCRIVABLE ; le balayage lui-même reste à
 * faire. » Des trois défauts qu'il nomme, c'est le seul qui grossit sans qu'on
 * y touche. Voici le balayage.
 *
 * ═══ TROIS REFUS PLUTÔT QU'UNE CONDITION ═══
 *
 * Effacer des octets est irréversible. On ne prend donc PAS ce qui :
 *
 *   · porte un `confirmedAt` — les octets sont là, la photo vit ;
 *   · est plus JEUNE que le délai — une montée en cours n'est pas une
 *     réservation morte, et sur le marché que ce produit sert un réseau lent
 *     est la norme, pas la panne ;
 * Un objet DÉJÀ ABSENT n'est pas un troisième cas : le contrat de `supprimer` le
 * dit — « sans effet si l'objet n'existe pas ; un appelant qui réessaie doit
 * passer ». La ligne part donc quand même, et il n'y a rien à interroger avant.
 *
 * ═══ LES OCTETS D'ABORD, LA LIGNE ENSUITE ═══
 *
 * Si le dépôt refuse, la ligne RESTE et le prochain passage réessaiera. L'ordre
 * inverse laisserait un objet que plus aucune ligne ne nomme : une fuite
 * définitive et invisible — exactement ce que ce balayage existe pour empêcher.
 *
 * ═══ POURQUOI IL NE TOURNE PAS TOUT SEUL, ET C'EST DIT ═══
 *
 * Ce module rend une FONCTION, et le script du bas la lance à la main. Le brancher
 * au cron des relances serait le geste suivant — il supprime des octets sans
 * qu'un humain regarde, et le service qui l'hébergerait envoie déjà de vrais
 * courriels. Ce choix appartient à qui répond des données.
 *
 * ═══ USAGE ═══
 *
 *     DATABASE_URL=… npm --prefix server run photos:balayer
 *     DATABASE_URL=… npm --prefix server run photos:balayer -- --heures=48
 */
import { prisma } from '../db.js'
import { leStockage } from '../stockage/stockage.js'

/** Douze heures : une montée qui n'a pas abouti en une demi-journée n'aboutira pas. */
const DELAI_PAR_DEFAUT = 12 * 3600_000

export interface BilanDuBalayage {
  /** Réservations dont la ligne a été retirée. */
  effacees: number
  /** Réservations laissées en place parce que le dépôt a refusé. */
  echecs: number
}

export async function balayerLesReservationsMortes(
  options: { apresMs?: number } = {},
): Promise<BilanDuBalayage> {
  const apresMs = options.apresMs ?? DELAI_PAR_DEFAUT
  const limite = new Date(Date.now() - apresMs)

  /* LA REQUÊTE D'UNE LIGNE que l'en-tête de la route annonçait : `confirmedAt`
     nul ET `createdAt` ancien. L'index sur `confirmedAt` la sert. */
  const mortes = await prisma.inspectionPhoto.findMany({
    where: { confirmedAt: null, createdAt: { lt: limite } },
    select: { id: true, storageKey: true },
  })

  const depot = leStockage()
  let effacees = 0
  let echecs = 0

  for (const photo of mortes) {
    try {
      /* PAS DE QUESTION AVANT : `supprimer` est sans effet sur un objet absent —
         son contrat l'écrit. Interroger d'abord ajouterait un aller-retour pour
         un cas que l'appel traite déjà. */
      await depot.supprimer(photo.storageKey)
    } catch {
      echecs += 1
      continue
    }
    await prisma.inspectionPhoto.delete({ where: { id: photo.id } })
    effacees += 1
  }

  return { effacees, echecs }
}

/* LANCÉ À LA MAIN, et seulement quand ce fichier EST le point d'entrée : importé
   par ses cas, il ne doit rien balayer. */
const lanceDirectement = process.argv[1]?.endsWith('photosJamaisMontees.ts') === true
if (lanceDirectement) {
  const heures = Number(
    process.argv.find((a) => a.startsWith('--heures='))?.slice('--heures='.length),
  )
  const apresMs = Number.isFinite(heures) && heures > 0 ? heures * 3600_000 : DELAI_PAR_DEFAUT
  balayerLesReservationsMortes({ apresMs })
    .then((bilan) => {
      console.log(
        `\n${bilan.effacees} réservation(s) morte(s) balayée(s), ` +
          `${bilan.echecs} laissée(s) en place (le dépôt a refusé — le prochain passage réessaiera).\n`,
      )
    })
    .catch((erreur) => {
      console.error(erreur)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
