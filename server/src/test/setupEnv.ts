/**
 * Environnement des tests serveur — chargé AVANT tout module applicatif.
 *
 * Il existe pour une raison précise et coûteuse : la suite efface ce qu'elle
 * trouve. `park.deleteMany()` et `userAccount.deleteMany()` tournent avant
 * chaque cas, et rien ne regardait QUELLE base était visée. `server/.env` n'en
 * déclare qu'une, celle du développement — lancer `npm run check` la vidait
 * donc entièrement : parc, immeubles, baux et comptes compris, sans un mot.
 *
 * Deux protections, et non une :
 *
 * 1. `.env.test` est chargé ici, avant que `env.ts` ne lise `.env` — ce dernier
 *    ne pose que les variables ABSENTES de l'environnement, celles posées ici
 *    l'emportent donc.
 * 2. Le nom de la base est VÉRIFIÉ. La première protection tombe dès qu'un
 *    `DATABASE_URL` traîne dans le shell, ou le jour où ce fichier cesse d'être
 *    chargé ; la seconde tient dans les deux cas. Elle échoue bruyamment
 *    plutôt que de détruire en silence.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FICHIER = fileURLToPath(new URL('../../.env.test', import.meta.url))

if (existsSync(FICHIER)) {
  process.loadEnvFile(FICHIER)
}

/**
 * Le garde-fou porte sur le NOM DE LA BASE et non sur l'URL entière : un
 * `?schema=` ou un hôte différent ne change rien au risque — seule la base
 * qu'on s'apprête à vider compte.
 */
const base = (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? ''

if (!base.endsWith('_test')) {
  throw new Error(
    [
      'Les tests serveur EFFACENT la base qu’ils visent, et celle-ci ne porte',
      `pas un nom de test : « ${base || '(aucune)'} ».`,
      '',
      'Attendu : une base dont le nom se termine par « _test ».',
      'Préparez-la une fois :  npm run db:test:setup',
    ].join('\n'),
  )
}
