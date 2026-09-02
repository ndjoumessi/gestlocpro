import { prisma } from '../db.js'
import { calculerRetard, JALON_EMAIL_AUTOMATIQUE, tenterRelanceEmailMilestone } from '../parks/routes.js'
import { envoyerLesResumesDuFil } from '../parks/resumeDuFil.js'

/**
 * LE POINT D'ENTRÉE DU FUTUR CRON — pas encore branché à rien.
 *
 * Ce fichier ne modifie ni `railway.json`, ni le `Dockerfile`, ni aucun
 * réglage de déploiement : le choix du déclencheur (un service cron Railway
 * distinct) reste une décision d'infrastructure, arbitrée séparément. Ce qui
 * est livré ici est le CODE que ce service exécutera — `node
 * dist/scripts/executerRelancesAutomatiques.js` une fois construit — pour
 * qu'un futur branchement n'ait à écrire aucune logique nouvelle.
 *
 * `executerRelancesAutomatiques()` boucle sur TOUS les parcs et appelle, pour
 * chaque bail à J+7, EXACTEMENT les fonctions que la route manuelle
 * `POST /:parkId/reminders?only=milestones` appelle déjà — `calculerRetard`
 * pour le dû et le retard, `tenterRelanceEmailMilestone` pour la garde de
 * course et l'envoi. Un déclenchement manuel et le cron ne peuvent donc pas
 * diverger sur CE QUI compte comme un envoi valide ; ils ne diffèrent que sur
 * QUI déclenche et QUAND — exactement la portion que ce lot ne construit pas.
 */
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
  envoyes: number
  ignores: number
  /** Ce qui SERAIT parti. Égal à `envoyes` hors du mode à blanc. */
  partiraient: number
}> {
  let partiraient = 0
  const maintenant = new Date()
  const parcs = await prisma.park.findMany({ select: { id: true, currency: true } })

  let envoyes = 0
  let ignores = 0

  for (const parc of parcs) {
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
      if (dûMinor <= 0 || jours !== JALON_EMAIL_AUTOMATIQUE) continue

      partiraient += 1
      if (options.aBlanc) continue

      const issue = await tenterRelanceEmailMilestone(bail, jours, dûMinor, parc.currency)
      if (issue === 'sent') envoyes += 1
      else ignores += 1
    }
  }

  return { parcsTraites: parcs.length, envoyes, ignores, partiraient }
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
  console.log(
    aBlanc
      ? `À BLANC — ${resultat.parcsTraites} parc(s) parcouru(s), ${resultat.partiraient} relance(s) PARTIRAIENT. Rien n'a été envoyé, aucune trace posée.`
      : `Relance automatique — ${resultat.parcsTraites} parc(s), ${resultat.envoyes} courriel(s) parti(s), ${resultat.ignores} ignoré(s).`,
  )

  /*
    LES RÉSUMÉS DU FIL PARTENT AU MÊME PASSAGE, et non dans un second lanceur.

    Un expéditeur que rien n'appelle est une fonctionnalité qui n'existe pas —
    ce dépôt a déjà payé exactement cela avec une table de traces écrite et
    jamais relue. Ce passage-ci est déjà périodique et déjà branché à la
    messagerie ; y accrocher les résumés ne demande rien de neuf à personne.

    APRÈS LES RELANCES, et l'ordre a une raison : une relance de loyer est une
    échéance qui court, un résumé est une commodité. Si le passage est
    interrompu, c'est la commodité qu'on perd.
  */
  if (!aBlanc) {
    const resumes = await envoyerLesResumesDuFil()
    console.log(`Résumés du fil — ${resumes} envoyé(s).`)
  }
}
