import { prisma } from '../db.js'
import { env } from '../env.js'
import { laMessagerie } from '../messagerie/messagerie.js'

/**
 * LE RÉSUMÉ DU FIL — ce qu'un compte a reçu depuis le dernier envoi.
 *
 * ═══ CE QU'IL NE DÉFAIT PAS ═══
 *
 * L'écran du locataire promet, mot pour mot : « Votre gestionnaire et votre
 * bailleur le reçoivent IMMÉDIATEMENT. » Grouper par défaut rendrait cette
 * phrase fausse pour tout le monde, sans que personne l'ait demandé. Le résumé
 * est donc un CHOIX de celui qui reçoit — `threadEmailDigest`, faux par défaut —
 * et il ne touche que la COPIE : l'avis dans le produit reste immédiat, la
 * pastille s'allume à la seconde.
 *
 * C'est la même distinction que le désabonnement : on renonce à la promptitude
 * d'un doublon, jamais à l'information.
 *
 * ═══ DÉRIVÉ, JAMAIS MIS EN FILE ═══
 *
 * Le contenu vient des AVIS déjà écrits, datés et rattachés à leur
 * destinataire. Une file de messages en partance serait un second endroit où la
 * vérité vit, et elle divergerait du premier au premier incident — c'est le
 * genre de duplication que ce dépôt paie cher ailleurs.
 *
 * `lastThreadDigestAt` borne la fenêtre. Nul, le premier résumé prend tout ce
 * que le compte a reçu : borne assumée, et sans surprise puisqu'il faut avoir
 * coché le réglage pour en recevoir un.
 *
 * ═══ CE QU'IL N'ENVOIE PAS ═══
 *
 * Rien à qui n'a rien reçu — un résumé vide est un message de trop. Rien non
 * plus au désabonné : les deux réglages sont distincts et le premier l'emporte.
 * Se désabonner veut dire « rien », pas « plus tard ».
 */

/** Les familles d'avis qui appartiennent au fil d'un signalement. */
const DU_FIL = ['tenantReport', 'tenantReply', 'workReply'] as const

function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Le gabarit du résumé.
 *
 * Il NOMME chaque échange plutôt que de compter : « 3 messages » n'apprend rien
 * et oblige à ouvrir. Une ligne par avis, avec son logement, dit ce qui s'est
 * passé sans que le destinataire ait à cliquer — ce qui est le seul intérêt
 * d'un résumé sur une copie.
 */
function gabaritDuResume(
  langue: string,
  lignes: { titre: string; unite: string | null }[],
): { sujet: string; texte: string; html: string } {
  const anglais = langue === 'en'
  const sujet = anglais
    ? `GestLocPro — ${lignes.length} new messages on your reports`
    : `GestLocPro — ${lignes.length} messages sur vos signalements`
  const entete = anglais
    ? 'Since your last summary, here is what was said on your reports.'
    : 'Depuis votre dernier résumé, voici ce qui s’est dit sur vos signalements.'
  const pied = anglais
    ? 'You receive one summary instead of one message each because you chose it. ' +
      'Open « Email copies » in your account menu to change that: '
    : 'Vous recevez un résumé plutôt qu’un message par échange parce que vous ' +
      'l’avez choisi. Ouvrez « Copies par e-mail » dans le menu de votre compte ' +
      'pour en changer : '
  const item = (l: { titre: string; unite: string | null }) =>
    l.unite ? `${l.titre} · ${l.unite}` : l.titre

  return {
    sujet,
    texte:
      `${entete}\n\n` +
      lignes.map((l) => `— ${item(l)}`).join('\n') +
      `\n\n${pied}${env.CLIENT_ORIGIN}/app`,
    html:
      `<p>${echapper(entete)}</p><ul>` +
      lignes.map((l) => `<li>${echapper(item(l))}</li>`).join('') +
      `</ul><p style="color:#6b6b6b;font-size:12px">${echapper(pied)}` +
      `<a href="${env.CLIENT_ORIGIN}/app">${env.CLIENT_ORIGIN}/app</a></p>`,
  }
}

/**
 * Envoie un résumé à chaque compte qui en a choisi un et qui a reçu quelque
 * chose. Rend le nombre de résumés PARTIS.
 */
export async function envoyerLesResumesDuFil(): Promise<number> {
  const comptes = await prisma.userAccount.findMany({
    where: { threadEmailDigest: true, threadEmailOptIn: true, disabledAt: null },
    select: { id: true, email: true, locale: true, lastThreadDigestAt: true },
  })

  let partis = 0
  for (const compte of comptes) {
    /* Les AVIS du fil reçus par ce compte. On interroge la notification et non
       le destinataire : `Notification` porte `unitId` mais aucune relation
       `unit`, et passer par le destinataire obligerait à deux niveaux
       d'imbrication pour la même chose. */
    const avis = await prisma.notification.findMany({
      where: {
        messageKey: { in: [...DU_FIL] },
        recipients: { some: { userId: compte.id } },
        ...(compte.lastThreadDigestAt ? { createdAt: { gt: compte.lastThreadDigestAt } } : {}),
      },
      select: { params: true, unitId: true },
      orderBy: { createdAt: 'asc' },
    })
    if (avis.length === 0) continue

    /* LE LIBELLÉ DU LOGEMENT, EN UNE PASSE. Un identifiant ne dit rien à qui
       relit ses signalements ; et une requête par ligne coûterait autant que
       les copies qu'on économise. */
    const libelles = new Map(
      (
        await prisma.unit.findMany({
          where: {
            id: { in: [...new Set(avis.map((a) => a.unitId).filter((u): u is string => !!u))] },
          },
          select: { id: true, label: true },
        })
      ).map((u) => [u.id, u.label]),
    )

    const lignes = avis.map((a) => {
      const params = (a.params ?? {}) as { text?: string; reference?: string }
      return {
        titre: params.text ?? params.reference ?? '—',
        unite: a.unitId ? (libelles.get(a.unitId) ?? null) : null,
      }
    })

    const gabarit = gabaritDuResume(compte.locale, lignes)

    /*
      LA BORNE AVANCE D'ABORD, et c'est délibéré. Si l'envoi échoue après, le
      compte perd UN résumé ; si la borne n'avançait qu'après un succès, une
      messagerie durablement en panne ferait renvoyer l'historique entier à
      chaque passage, et grossissant. Perdre un résumé est réparable en le
      lisant dans le produit ; inonder ne l'est pas.
    */
    await prisma.userAccount.update({
      where: { id: compte.id },
      data: { lastThreadDigestAt: new Date() },
    })

    if (await laMessagerie().envoyerEmail(compte.email, gabarit.sujet, gabarit)) partis++
  }
  return partis
}
