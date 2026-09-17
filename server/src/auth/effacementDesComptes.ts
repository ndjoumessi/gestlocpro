import { prisma } from '../db.js'
import { leStockage } from '../stockage/stockage.js'
import { DELAI_D_EFFACEMENT_JOURS, parcsEmportesParLEffacement } from './fermeture.js'

/**
 * L'EFFACEMENT DES COMPTES FERMÉS — ce que la fermeture a promis.
 *
 * ═══ CE QU'IL EFFACE ═══
 *
 * Le compte, et les parcs dont il est le SEUL propriétaire. Un parc à deux
 * propriétaires survit : effacer le bien commun parce que l'un s'en va
 * effacerait les données de l'autre à sa place — et celui-là n'a rien demandé.
 *
 * ═══ L'ORDRE DES GESTES, ET IL COMPTE ═══
 *
 *  1. LES OBJETS DU VOLUME D'ABORD, tant que la base sait encore où ils sont.
 *     Après la cascade, `InspectionPhoto` n'existe plus et les fichiers
 *     resteraient là, reliés à rien : personne ne saurait plus qu'ils ont
 *     existé, ni qu'il faut les effacer. Un effacement qui laisse les
 *     photographies d'un logement sur un disque n'est pas un effacement.
 *  2. LES PARCS ENSUITE, par cascade — immeubles, logements, baux, échéances,
 *     versements, cautions, relevés, états des lieux, travaux, avis,
 *     invitations, adhésions et registre suivent le parc.
 *  3. LE COMPTE EN DERNIER. Ses sessions et ses adhésions restantes tombent par
 *     cascade ; les lignes qu'il a signées AILLEURS — un code émis, un
 *     encaissement saisi — perdent leur auteur (`SET NULL`, migration
 *     `effacement_sans_verrou`) et gardent leur contenu.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Il n'avertit personne. Les locataires reliés à un parc effacé perdent leur
 * portail sans un mot, et c'est une dette nommée : Nelson a demandé qu'ils
 * soient prévenus À LA FERMETURE, pour qu'ils aient les trente jours. Rien ne
 * l'envoie encore.
 *
 * Il n'est pas TRANSACTIONNEL de bout en bout. Les objets du volume ne se
 * défont pas : une panne entre la suppression d'un fichier et celle du parc
 * laisserait une ligne sans sa photo. C'est le sens le moins grave des deux —
 * l'inverse laisserait la photo sans sa ligne, donc hors de portée.
 */
export interface BilanDEffacement {
  comptes: number
  parcs: number
  photos: number
}

export async function effacerLesComptesFermes(
  maintenant: Date = new Date(),
): Promise<BilanDEffacement> {
  const echeance = new Date(maintenant.getTime() - DELAI_D_EFFACEMENT_JOURS * 86_400_000)
  const fermes = await prisma.userAccount.findMany({
    where: { closureRequestedAt: { not: null, lte: echeance } },
    select: { id: true },
  })

  const bilan: BilanDEffacement = { comptes: 0, parcs: 0, photos: 0 }
  const stockage = leStockage()

  for (const compte of fermes) {
    /* LE MÊME CALCUL QUE CELUI DE L'AVERTISSEMENT, et c'est tout l'intérêt de
       l'avoir sorti d'ici : on efface exactement ce dont on a prévenu les
       locataires et les gestionnaires trente jours plus tôt. */
    const aEffacer = await parcsEmportesParLEffacement(compte.id)

    for (const parkId of aEffacer) {
      const photos = await prisma.inspectionPhoto.findMany({
        where: { finding: { inspection: { unit: { building: { parkId } } } } },
        select: { storageKey: true },
      })
      for (const photo of photos) {
        /* UNE PHOTO QU'ON NE SAIT PAS EFFACER NE DOIT PAS ARRÊTER L'EFFACEMENT :
           le reste du dossier partirait alors pour un fichier manquant. On
           compte ce qui est parti, et le compte rendu le dit. */
        try {
          await stockage.supprimer(photo.storageKey)
          bilan.photos++
        } catch {
          /* rien : le bilan ne comptera pas cette photo */
        }
      }
      await prisma.park.delete({ where: { id: parkId } })
      bilan.parcs++
    }

    await prisma.userAccount.delete({ where: { id: compte.id } })
    bilan.comptes++
  }

  return bilan
}

/** Ce que le passage quotidien imprime — muet sur ce qu'il n'a pas fait. */
export function compteRenduDEffacement(bilan: BilanDEffacement): string {
  if (bilan.comptes === 0) return 'Effacement des comptes fermés — aucun n’était à échéance.'
  return (
    `Effacement des comptes fermés — ${bilan.comptes} compte(s), ` +
    `${bilan.parcs} parc(s), ${bilan.photos} photo(s) du volume.`
  )
}
