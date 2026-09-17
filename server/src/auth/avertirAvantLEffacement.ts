import { prisma } from '../db.js'
import { laMessagerie } from '../messagerie/messagerie.js'
import { parcsEmportesParLEffacement } from './fermeture.js'

/**
 * PRÉVENIR CEUX QUI PERDRONT LEUR ESPACE — locataires et gestionnaires.
 *
 * ═══ POURQUOI À LA FERMETURE, ET NON À L'EFFACEMENT ═══
 *
 * Prévenus le jour de la demande, ils ont les trente jours pour exporter leurs
 * pièces. Prévenus à l'effacement, ils apprendraient une disparition déjà faite
 * — ce qui n'est pas un avertissement, mais un constat.
 *
 * ═══ CE QU'ON LEUR DIT, ET CE QU'ON NE LEUR DIT PAS ═══
 *
 * Le nom du parc, la date, et quoi faire. PAS le nom du propriétaire ni son
 * adresse : la fermeture est SA décision, et un locataire n'a pas à recevoir de
 * courriel sur le compte de son bailleur. « Le parc X sera supprimé » dit
 * exactement ce qui le concerne.
 *
 * ═══ UN ENVOI RATÉ N'ARRÊTE RIEN ═══
 *
 * `envoyerEmail` rend `false` et ne lève jamais — la couture de la messagerie le
 * garantit. Le droit d'une personne à fermer son compte ne dépend pas de la
 * santé d'un fournisseur de courriels ; ce qui se perd alors est un
 * avertissement, et le bilan le compte.
 */
export interface BilanDAvertissement {
  parcs: number
  prevenus: number
  partis: number
}

function corps(parc: string, jour: string): { texte: string; html: string } {
  const texte =
    `Le parc « ${parc} » sera supprimé de GestLocPro le ${jour}.\n\n` +
    'Tout ce qu’il contient disparaîtra alors : baux, quittances, états des lieux et photos. ' +
    'Si vous avez un compte, vous pouvez emporter vos données depuis « Mes données », ' +
    'dans le menu de votre compte. Sinon, demandez vos pièces à votre bailleur avant cette date.\n'
  const html =
    `<p>Le parc « ${parc} » sera supprimé de GestLocPro le <strong>${jour}</strong>.</p>` +
    '<p>Tout ce qu’il contient disparaîtra alors : baux, quittances, états des lieux et photos.</p>' +
    '<p>Si vous avez un compte, vous pouvez emporter vos données depuis « Mes données », dans le ' +
    'menu de votre compte. Sinon, demandez vos pièces à votre bailleur avant cette date.</p>'
  return { texte, html }
}

export async function avertirAvantLEffacement(
  userId: string,
  effaceLe: Date,
): Promise<BilanDAvertissement> {
  const parcs = await parcsEmportesParLEffacement(userId)
  const bilan: BilanDAvertissement = { parcs: parcs.length, prevenus: 0, partis: 0 }
  if (parcs.length === 0) return bilan

  const jour = effaceLe.toISOString().slice(0, 10)

  for (const parkId of parcs) {
    const parc = await prisma.park.findUniqueOrThrow({
      where: { id: parkId },
      select: { name: true },
    })

    /*
      DEUX SOURCES, ET IL EN FAUT DEUX.

      LES MEMBRES ACTIFS, quel que soit leur rôle : gestionnaires ET locataires
      entrés par un code. Première rédaction : « les gestionnaires par leur
      compte, les locataires par leur fiche » — mesuré, un locataire entré par
      un code n'a PAS de fiche tant que le bailleur n'en a pas créé une, et il
      n'était prévenu par personne alors qu'il perd son portail.

      LES FICHES qui portent une adresse, ensuite : elles existent sans compte
      dans tout parc réel, et leur occupant perd les mêmes pièces.

      LE PROPRIÉTAIRE QUI FERME EST ÉCARTÉ : il vient de le demander, l'écran lui
      a dit la date, et un courriel de plus le ferait douter.
    */
    const membres = await prisma.membership.findMany({
      where: { parkId, status: 'active', userId: { not: userId } },
      select: { user: { select: { email: true } } },
    })
    const fiches = await prisma.tenant.findMany({
      where: { parkId },
      select: { email: true, user: { select: { email: true } } },
    })

    const adresses = new Set<string>()
    for (const membre of membres) if (membre.user?.email) adresses.add(membre.user.email)
    for (const fiche of fiches) {
      const adresse = fiche.user?.email ?? fiche.email
      if (adresse) adresses.add(adresse)
    }

    for (const adresse of adresses) {
      bilan.prevenus++
      const parti = await laMessagerie().envoyerEmail(
        adresse,
        `GestLocPro — le parc « ${parc.name} » sera supprimé le ${jour}`,
        corps(parc.name, jour),
      )
      if (parti) bilan.partis++
    }
  }

  return bilan
}
