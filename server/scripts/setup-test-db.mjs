/**
 * Crée et migre la base des TESTS.
 *
 * Elle vit dans le même conteneur que celle de développement : `npm run db:up`
 * à la racine suffit à la servir, il n'y a pas un second service à démarrer.
 *
 * `migrate deploy` et non `migrate dev` : on applique les migrations
 * existantes, on n'en génère pas. Une base de test qui inventerait sa propre
 * migration divergerait du schéma que la production applique, et la suite
 * validerait alors un schéma que personne ne déploie.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ENV_TEST = fileURLToPath(new URL('../.env.test', import.meta.url))

if (!existsSync(ENV_TEST)) {
  console.error('server/.env.test est introuvable — il est versionné, restaurez-le.')
  process.exit(1)
}

process.loadEnvFile(ENV_TEST)

const url = process.env.DATABASE_URL ?? ''
const base = url.split('/').pop()?.split('?')[0] ?? ''

// Le même garde qu'à l'exécution des tests : ce script CRÉE une base, mais
// `migrate deploy` sur la mauvaise la ferait avancer sans qu'on l'ait voulu.
if (!base.endsWith('_test')) {
  console.error(`DATABASE_URL ne désigne pas une base de test : « ${base || '(aucune)'} ».`)
  process.exit(1)
}

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'gestlocpro-db', 'psql', '-U', 'gestlocpro', '-d', 'gestlocpro', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim()
}

try {
  const existe = psql(`SELECT 1 FROM pg_database WHERE datname = '${base}'`)
  if (existe !== '1') {
    psql(`CREATE DATABASE "${base}"`)
    console.log(`Base « ${base} » créée.`)
  } else {
    console.log(`Base « ${base} » déjà présente.`)
  }
} catch (erreur) {
  console.error(
    'Impossible de joindre le conteneur « gestlocpro-db ».\n' +
      'Démarrez-le depuis la racine :  npm run db:up\n' +
      String(erreur.message ?? erreur),
  )
  process.exit(1)
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
})
console.log(`Base « ${base} » migrée. \`npm run check\` peut tourner sans toucher au développement.`)

