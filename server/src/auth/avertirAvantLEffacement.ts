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
/**
 * QUI PERD SON ESPACE AVEC CE PARC — deux sources, et il en faut deux.
 *
 * LES MEMBRES ACTIFS, quel que soit leur rôle : gestionnaires ET locataires
 * entrés par un code. Première rédaction : « les gestionnaires par leur compte,
 * les locataires par leur fiche » — mesuré, un locataire entré par un code n'a
 * PAS de fiche tant que le bailleur n'en a pas créé une, et il n'était prévenu
 * par personne alors qu'il perd son portail.
 *
 * LES FICHES qui portent une adresse, ensuite : elles existent sans compte dans
 * tout parc réel, et leur occupant perd les mêmes pièces.
 *
 * LE PROPRIÉTAIRE QUI FERME EST ÉCARTÉ : il vient de le demander, l'écran lui a
 * dit la date, et un courriel de plus le ferait douter.
 *
 * LE MÊME CALCUL SERT À AVERTIR ET À DÉTROMPER : l'annulation doit atteindre
 * exactement ceux que la fermeture a alarmés.
 */
async function destinatairesDuParc(
  parkId: string,
  userId: string,
): Promise<Map<string, Langue>> {
  const membres = await prisma.membership.findMany({
    where: { parkId, status: 'active', userId: { not: userId } },
    select: { user: { select: { email: true, locale: true } } },
  })
  const fiches = await prisma.tenant.findMany({
    where: { parkId },
    select: { email: true, user: { select: { email: true, locale: true } } },
  })

  /* LA LANGUE VIENT DU COMPTE, et une fiche n'en a pas : elle retombe sur le
     français, le défaut du produit — c'est la règle que la relance de loyer a
     déjà posée (`relanceDansSaLangue.test.ts`). */
  const adresses = new Map<string, Langue>()
  for (const membre of membres) {
    if (membre.user?.email) adresses.set(membre.user.email, langueDe(membre.user.locale))
  }
  for (const fiche of fiches) {
    const compte = fiche.user
    if (compte?.email) adresses.set(compte.email, langueDe(compte.locale))
    else if (fiche.email) adresses.set(fiche.email, 'fr')
  }
  return adresses
}

/** La langue d'un gabarit : celle du compte, ou le français. */
type Langue = 'fr' | 'en'

function langueDe(locale: string | null | undefined): Langue {
  return locale === 'en' ? 'en' : 'fr'
}

export interface BilanDAvertissement {
  parcs: number
  prevenus: number
  partis: number
}

/**
 * DEUX LANGUES, DEUX FONCTIONS COURTES qui rendent la même forme — la
 * disposition que `gabaritDuFilEmail` a déjà retenue. Un gabarit paramétré par
 * des fragments traduits produirait des phrases que personne n'a relues en
 * entier ; deux textes écrits se relisent.
 */
function sujetDAvertissement(parc: string, jour: string, langue: Langue): string {
  return langue === 'en'
    ? `GestLocPro — the portfolio “${parc}” will be deleted on ${jour}`
    : `GestLocPro — le parc « ${parc} » sera supprimé le ${jour}`
}

function corps(parc: string, jour: string, langue: Langue): { texte: string; html: string } {
  if (langue === 'en') {
    return {
      texte:
        `The portfolio “${parc}” will be deleted on ${jour}.\n\n` +
        'Everything it holds will go with it: leases, rent receipts, inspections and photos. ' +
        'If you have an account, you can take your data with you from “My data”, in your account ' +
        'menu. Otherwise, ask your landlord for your documents before that date.\n',
      html:
        `<p>The portfolio “${parc}” will be deleted on <strong>${jour}</strong>.</p>` +
        '<p>Everything it holds will go with it: leases, rent receipts, inspections and photos.</p>' +
        '<p>If you have an account, you can take your data with you from “My data”, in your ' +
        'account menu. Otherwise, ask your landlord for your documents before that date.</p>',
    }
  }
  return {
    texte:
      `Le parc « ${parc} » sera supprimé de GestLocPro le ${jour}.\n\n` +
      'Tout ce qu’il contient disparaîtra alors : baux, quittances, états des lieux et photos. ' +
      'Si vous avez un compte, vous pouvez emporter vos données depuis « Mes données », ' +
      'dans le menu de votre compte. Sinon, demandez vos pièces à votre bailleur avant cette date.\n',
    html:
      `<p>Le parc « ${parc} » sera supprimé de GestLocPro le <strong>${jour}</strong>.</p>` +
      '<p>Tout ce qu’il contient disparaîtra alors : baux, quittances, états des lieux et photos.</p>' +
      '<p>Si vous avez un compte, vous pouvez emporter vos données depuis « Mes données », dans le ' +
      'menu de votre compte. Sinon, demandez vos pièces à votre bailleur avant cette date.</p>',
  }
}

function sujetDAnnulation(parc: string, langue: Langue): string {
  return langue === 'en'
    ? `GestLocPro — the portfolio “${parc}” will not be deleted`
    : `GestLocPro — le parc « ${parc} » ne sera pas supprimé`
}

function corpsDAnnulation(parc: string, langue: Langue): { texte: string; html: string } {
  if (langue === 'en') {
    return {
      texte:
        `Good news: the portfolio “${parc}” will not be deleted from GestLocPro.\n\n` +
        'The deletion announced in our previous message has been cancelled. Your space and your ' +
        'documents stay where they are; there is nothing for you to do.\n',
      html:
        `<p>Good news: the portfolio “${parc}” <strong>will not be deleted</strong> from GestLocPro.</p>` +
        '<p>The deletion announced in our previous message has been cancelled. Your space and ' +
        'your documents stay where they are; there is nothing for you to do.</p>',
    }
  }
  return {
    texte:
      `Bonne nouvelle : le parc « ${parc} » ne sera pas supprimé de GestLocPro.\n\n` +
      'La demande de suppression annoncée dans notre précédent message a été annulée. ' +
      'Votre espace et vos documents restent en place ; vous n’avez rien à faire.\n',
    html:
      `<p>Bonne nouvelle : le parc « ${parc} » <strong>ne sera pas supprimé</strong> de GestLocPro.</p>` +
      '<p>La demande de suppression annoncée dans notre précédent message a été annulée. ' +
      'Votre espace et vos documents restent en place ; vous n’avez rien à faire.</p>',
  }
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

    const adresses = await destinatairesDuParc(parkId, userId)

    for (const [adresse, langue] of adresses) {
      bilan.prevenus++
      /* LA LISTE EST ÉCRITE AVANT L'ENVOI, et elle l'est même si l'envoi
         échoue : ce qu'elle retient est « cette personne devait être prévenue »,
         et c'est à elle qu'on devra dire que la suppression n'a pas lieu. */
      await prisma.closureWarning.upsert({
        where: { userId_parkId_email: { userId, parkId, email: adresse } },
        create: { userId, parkId, email: adresse, locale: langue },
        update: { locale: langue, sentAt: new Date() },
      })
      const parti = await laMessagerie().envoyerEmail(
        adresse,
        sujetDAvertissement(parc.name, jour, langue),
        corps(parc.name, jour, langue),
      )
      if (parti) bilan.partis++
    }
  }

  return bilan
}

/**
 * L'ANNULATION SE DIT AUSSI — une alerte qu'on ne lève pas est une alerte qui ment.
 *
 * Un locataire prévenu puis laissé sans nouvelle fait l'une de deux choses : il
 * déménage ses pièces pour rien, ou il attend la disparition annoncée et cesse
 * de se servir d'un portail qui existe toujours.
 *
 * LES MÊMES DESTINATAIRES, par le même calcul. Ils sont RECALCULÉS et non
 * relus : le produit ne garde pas la liste de ceux qu'il a prévenus. Un
 * locataire parti entre-temps ne sera donc pas détrompé, et un arrivant recevra
 * une bonne nouvelle qu'il n'attendait pas — le second cas est sans gravité, le
 * premier est nommé dans le message de ce lot.
 */
export async function annoncerLAnnulation(userId: string): Promise<BilanDAvertissement> {
  /* ON RELIT, ON NE RECALCULE PAS. Recalculer s'adresse à ceux qui sont là au
     moment où l'on se ravise ; la liste, elle, porte ceux qu'on a alarmés — dont
     le locataire retiré du parc entre-temps, qui n'a aucun autre moyen
     d'apprendre que ses quittances ne disparaîtront pas. */
  const prevenus = await prisma.closureWarning.findMany({
    where: { userId },
    select: { id: true, parkId: true, email: true, locale: true },
  })
  const parcs = new Set(prevenus.map((p) => p.parkId))
  const bilan: BilanDAvertissement = { parcs: parcs.size, prevenus: 0, partis: 0 }
  if (prevenus.length === 0) return bilan

  const noms = new Map(
    (
      await prisma.park.findMany({
        where: { id: { in: [...parcs] } },
        select: { id: true, name: true },
      })
    ).map((parc) => [parc.id, parc.name]),
  )

  for (const ligne of prevenus) {
    const nom = noms.get(ligne.parkId)
    /* Le parc a disparu depuis — il n'a plus de nom à annoncer, et sa ligne
       serait partie avec lui par cascade. On ne devine pas. */
    if (!nom) continue
    const langue = langueDe(ligne.locale)
    bilan.prevenus++
    const parti = await laMessagerie().envoyerEmail(
      ligne.email,
      sujetDAnnulation(nom, langue),
      corpsDAnnulation(nom, langue),
    )
    if (parti) bilan.partis++
  }

  /* CONSOMMÉE. Une liste qu'on laisse derrière soi ferait détromper deux fois à
     la connexion suivante, pour une fermeture qui n'existe plus. */
  await prisma.closureWarning.deleteMany({ where: { userId } })

  return bilan
}
