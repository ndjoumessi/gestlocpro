import { prisma } from '../db.js'
import { calculerRetard, JALON_EMAIL_AUTOMATIQUE, tenterRelanceEmailMilestone } from '../parks/routes.js'

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
export async function executerRelancesAutomatiques(): Promise<{
  parcsTraites: number
  envoyes: number
  ignores: number
}> {
  const maintenant = new Date()
  const parcs = await prisma.park.findMany({ select: { id: true, currency: true } })

  let envoyes = 0
  let ignores = 0

  for (const parc of parcs) {
    const baux = await prisma.lease.findMany({
      where: { unit: { building: { parkId: parc.id } }, status: { in: ['active', 'pending'] } },
      select: {
        id: true,
        tenant: { select: { fullName: true, email: true } },
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

      const issue = await tenterRelanceEmailMilestone(bail, jours, dûMinor, parc.currency)
      if (issue === 'sent') envoyes += 1
      else ignores += 1
    }
  }

  return { parcsTraites: parcs.length, envoyes, ignores }
}

/**
 * Exécution directe : `tsx src/scripts/executerRelancesAutomatiques.ts` (ou
 * son équivalent compilé). Sans cette garde, IMPORTER ce module pour éprouver
 * `executerRelancesAutomatiques` déclencherait le parcours complet — le même
 * principe que la garde de `check-i18n.mjs`.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const resultat = await executerRelancesAutomatiques()
  console.log(
    `Relance automatique — ${resultat.parcsTraites} parc(s), ${resultat.envoyes} courriel(s) parti(s), ${resultat.ignores} ignoré(s).`,
  )
}
