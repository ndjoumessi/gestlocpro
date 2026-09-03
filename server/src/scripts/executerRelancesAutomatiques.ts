import { prisma } from '../db.js'
import { calculerRetard, tenterRelanceEmailMilestone } from '../parks/routes.js'
import { envoyerLesResumesDuFil } from '../parks/resumeDuFil.js'

/**
 * LE POINT D'ENTRÉE DU CRON — branché depuis le 2026-09-02.
 *
 * Un service Railway distinct l'exécute TOUTES LES HEURES. Il passait
 * auparavant une fois par jour à 6 h UTC ; l'heure vit désormais dans le parc,
 * et la planification ne sait plus QUAND envoyer, seulement quand REGARDER.
 *
 * C'est ce qui rend l'heure réglable depuis le produit. Le prix est explicite :
 * vingt-trois passages sur vingt-quatre ne font qu'une lecture pour un parc
 * donné, et s'arrêtent. Une lecture par heure vaut mieux qu'un propriétaire
 * obligé d'ouvrir un tableau de bord d'hébergeur pour décaler un envoi d'une
 * heure.
 *
 * `executerRelancesAutomatiques()` boucle sur TOUS les parcs et appelle, pour
 * chaque bail à J+7, EXACTEMENT les fonctions que la route manuelle
 * `POST /:parkId/reminders?only=milestones` appelle déjà — `calculerRetard`
 * pour le dû et le retard, `tenterRelanceEmailMilestone` pour la garde de
 * course et l'envoi. Un déclenchement manuel et le cron ne peuvent donc pas
 * diverger sur CE QUI compte comme un envoi valide ; ils ne diffèrent que sur
 * QUI déclenche et QUAND — exactement la portion que ce lot ne construit pas.
 */
/**
 * L'HEURE QU'IL EST DANS LE FUSEAU D'UN PARC, de 0 à 23.
 *
 * `hourCycle: 'h23'` et non `hour12: false` : ce dernier rend « 24 » à minuit
 * dans certaines versions d'ICU, et un parc réglé sur 0 ne serait jamais
 * relancé — un défaut qui ne se verrait qu'une heure par jour.
 */
export function heureDansLeFuseau(quand: Date, fuseau: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: fuseau,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(quand),
  )
}

/**
 * L'HEURE DU RÉSUMÉ DU FIL, en UTC, et pourquoi elle N'EST PAS réglable.
 *
 * Le résumé appartient au COMPTE qui le reçoit, pas au parc : un gestionnaire
 * de trois parcs n'en reçoit qu'un seul, et trois réglages ne sauraient pas
 * lequel choisir. Il garde donc l'heure historique du cron quotidien.
 *
 * SANS CETTE BORNE, le passage horaire enverrait vingt-quatre résumés par jour
 * à chacun. C'est le piège exact que le passage à l'heure introduit, et il ne
 * se serait vu qu'en production, sur de vraies boîtes aux lettres.
 */
export const HEURE_DU_RESUME_UTC = 6

/**
 * EST-CE L'HEURE DU RÉSUMÉ ? Extraite pour être ÉPROUVÉE.
 *
 * Cette décision vivait en ligne dans le bloc d'exécution directe, qu'on ne
 * peut pas importer sans déclencher le parcours complet. Sa garde LISAIT donc
 * la source à la recherche d'un motif — `heureDuResume ? await envoyer…`. Une
 * garde de forme casse au premier remaniement et ne dit rien du comportement :
 * elle serait restée verte sur une borne inversée.
 */
export function estLHeureDuResume(quand: Date): boolean {
  return quand.getUTCHours() === HEURE_DU_RESUME_UTC
}

/**
 * CE QUE LE PASSAGE A FAIT, EN UNE LIGNE QUI NE MENT PAS.
 *
 * L'ancienne disait « 2 parc(s), 0 courriel(s) parti(s) ». Ce zéro couvrait
 * DEUX états sans rapport : un parc dont ce n'est pas l'heure — le cas normal
 * vingt-trois fois sur vingt-quatre — et un parc à son heure où aucun bail
 * n'atteint le jalon, qui est une information sur le parc. Rien ne les
 * séparait, et neuf passages de production ont rendu le même « 0 ».
 *
 * `parcsALHeure` et `partiraient` sont ce qui rend le zéro lisible : zéro
 * envoyé sur deux baux au jalon est une PANNE, zéro envoyé sur zéro bail est un
 * mardi ordinaire.
 */
export function compteRenduDesRelances(
  r: { parcsTraites: number; parcsALHeure: number; envoyes: number; ignores: number; partiraient: number },
  aBlanc: boolean,
): string {
  if (aBlanc) {
    return (
      `À BLANC — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsALHeure} avec relances actives, ` +
      `${r.partiraient} relance(s) PARTIRAIENT à l'heure de leur parc. ` +
      "Rien n'a été envoyé, aucune trace posée."
    )
  }
  return (
    `Relance automatique — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsALHeure} à leur heure, ` +
    `${r.partiraient} bail(s) au jalon, ${r.envoyes} courriel(s) parti(s), ${r.ignores} ignoré(s).`
  )
}

/**
 * LE RÉSUMÉ : `null` quand il n'a PAS tourné, un nombre quand il a cherché.
 *
 * L'ancienne ligne affichait « 0 envoyé » dans les deux cas. Un compte rendu
 * muet sur ce qu'il n'a pas fait se lit comme s'il l'avait fait — c'est la
 * faute que ce dépôt a déjà payée sur le mode à blanc, qui « voyait une famille
 * de courriels sur deux ».
 */
export function compteRenduDesResumes(resumes: number | null): string {
  if (resumes === null) {
    return `Résumés du fil — pas leur heure (${HEURE_DU_RESUME_UTC} h UTC), aucun parcours.`
  }
  return `Résumés du fil — ${resumes} envoyé(s).`
}

export async function executerRelancesAutomatiques(
  /**
   * À BLANC : le même parcours, la même décision, et RIEN qui parte.
   *
   * Ce passage n'a jamais tourné en production — aucun cron ne le lançait, la
   * configuration Railway l'a confirmé. Le brancher enverrait de vrais
   * courriels à de vrais locataires au premier tour, sans que personne ait pu
   * voir ce qui partirait. Le lire d'abord, c'est la différence entre décider
   * et espérer.
   *
   * IL NE POSE AUCUNE TRACE non plus. `RentReminderEmail` est la garde
   * d'idempotence quotidienne : en écrire une à blanc ferait manquer le VRAI
   * envoi du même jour, et le blanc aurait consommé le tour qu'il devait
   * seulement décrire.
   */
  options: { aBlanc?: boolean } = {},
): Promise<{
  parcsTraites: number
  /** Ceux qui ont passé LES DEUX portes : interrupteur allumé, et leur heure. */
  parcsALHeure: number
  envoyes: number
  ignores: number
  /** Ce qui SERAIT parti. Égal à `envoyes` hors du mode à blanc. */
  partiraient: number
}> {
  let partiraient = 0
  const maintenant = new Date()
  /* LA POLITIQUE VIENT DU PARC, pas de la planification. Le cron est bête : il
     passe tous les jours. Mettre le jalon dans son expression obligerait un
     propriétaire à ouvrir un tableau de bord d'hébergeur pour changer d'avis sur
     ses propres locataires. */
  const parcs = await prisma.park.findMany({
    select: {
      id: true,
      currency: true,
      autoReminders: true,
      reminderMilestoneDays: true,
      reminderHour: true,
      reminderTimeZone: true,
    },
  })

  let envoyes = 0
  let ignores = 0
  let parcsALHeure = 0

  for (const parc of parcs) {
    /* ÉTEINTE POUR CE PARC : on ne compte rien, pas même à blanc. Annoncer un
       envoi qu'un réglage interdit ferait mentir la seule lecture qui précède la
       décision. */
    if (!parc.autoReminders) continue

    /*
      CE N'EST PAS SON HEURE : on passe, et c'est tout ce que fait le cron pour
      ce parc vingt-trois fois sur vingt-quatre.

      LE BLANC, LUI, L'IGNORE. Il répond à « qu'enverrait ce parc À SON HEURE »,
      et non à « qu'enverrait-il maintenant » — sans quoi la seule lecture qui
      précède la décision rendrait zéro pour la seule raison qu'on l'a lancée à
      21 h. La ligne qu'il imprime le dit mot pour mot.
    */
    if (!options.aBlanc && heureDansLeFuseau(maintenant, parc.reminderTimeZone) !== parc.reminderHour)
      continue

    parcsALHeure += 1

    const baux = await prisma.lease.findMany({
      where: { unit: { building: { parkId: parc.id } }, status: { in: ['active', 'pending'] } },
      select: {
        id: true,
        /* `userId` : la LANGUE du destinataire vit sur son compte, et sans lui
           la relance repartait en français pour tout le monde. */
        tenant: { select: { fullName: true, email: true, userId: true } },
        charges: {
          where: { dueOn: { lt: maintenant } },
          select: { dueOn: true, rentMinor: true, payments: { select: { amountMinor: true } } },
          orderBy: { dueOn: 'asc' },
        },
      },
    })

    for (const bail of baux) {
      const { dûMinor, jours } = calculerRetard(bail, maintenant)
      if (dûMinor <= 0 || jours !== parc.reminderMilestoneDays) continue

      partiraient += 1
      if (options.aBlanc) continue

      const issue = await tenterRelanceEmailMilestone(bail, jours, dûMinor, parc.currency)
      if (issue === 'sent') envoyes += 1
      else ignores += 1
    }
  }

  return { parcsTraites: parcs.length, parcsALHeure, envoyes, ignores, partiraient }
}

/**
 * Exécution directe : `tsx src/scripts/executerRelancesAutomatiques.ts` (ou
 * son équivalent compilé). Sans cette garde, IMPORTER ce module pour éprouver
 * `executerRelancesAutomatiques` déclencherait le parcours complet — le même
 * principe que la garde de `check-i18n.mjs`.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  /* `--a-blanc` : le même parcours, et rien qui parte. `npm run relances:blanc`. */
  const aBlanc = process.argv.includes('--a-blanc')
  const resultat = await executerRelancesAutomatiques({ aBlanc })
  console.log(compteRenduDesRelances(resultat, aBlanc))

  /*
    LES RÉSUMÉS DU FIL PARTENT AU MÊME PASSAGE, et non dans un second lanceur.

    Un expéditeur que rien n'appelle est une fonctionnalité qui n'existe pas —
    ce dépôt a déjà payé exactement cela avec une table de traces écrite et
    jamais relue. Ce passage-ci est déjà périodique et déjà branché à la
    messagerie ; y accrocher les résumés ne demande rien de neuf à personne.

    APRÈS LES RELANCES, et l'ordre a une raison : une relance de loyer est une
    échéance qui court, un résumé est une commodité. Si le passage est
    interrompu, c'est la commodité qu'on perd.

    `null` PLUTÔT QUE ZÉRO quand ce n'est pas l'heure : c'est ce qui permet au
    compte rendu de dire qu'il n'a pas tourné, au lieu de rendre un « 0 envoyé »
    qu'on lit comme un parcours infructueux. À blanc, on compte toujours — une
    lecture muette serait la faute qu'on vient de corriger.
  */
  const resumes = aBlanc || estLHeureDuResume(new Date())
    ? await envoyerLesResumesDuFil({ aBlanc })
    : null
  console.log(
    aBlanc
      ? `À BLANC — ${resumes ?? 0} résumé(s) du fil PARTIRAIENT.`
      : compteRenduDesResumes(resumes),
  )
}
