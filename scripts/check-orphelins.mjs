#!/usr/bin/env node
/**
 * Garde-fou contre le travail livré sans son bout manquant.
 *
 * Trois fois dans l'histoire de ce dépôt, une route serveur a vécu des lots
 * entiers sans écran : le registre des accès, les tarifs de refacturation, puis
 * le message groupé et la réponse au locataire. Deux fois, une colonne du
 * schéma a été écrite sans jamais être relue — `Payment.reference` — ou n'a
 * jamais été ni écrite ni lue — `displayCurrency`, `emailVerifiedAt`. À chaque
 * fois le défaut a été trouvé par hasard, des semaines plus tard, en cherchant
 * autre chose.
 *
 * Ces trois manques ont la même forme : un maillon qui existe et que rien
 * n'appelle. C'est mécaniquement détectable, donc ça n'a pas à se découvrir par
 * hasard.
 *
 *   node scripts/check-orphelins.mjs     ·     npm run lint:orphelins
 *
 * Sortie 1 dès qu'un maillon est orphelin, pour bloquer en intégration.
 *
 * LES EXEMPTIONS SONT NOMMÉES ET MOTIVÉES, jamais silencieuses. Une liste
 * d'exceptions sans raison écrite devient le tapis sous lequel on glisse le
 * prochain défaut — et c'est exactement ce que ce contrôle existe pour empêcher.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = new URL('..', import.meta.url).pathname
const IGNORES = new Set(['node_modules', 'generated', 'dist', '.git', 'coverage'])

/**
 * Champs de schéma qu'on n'attend PAS de voir nommés dans le code.
 *
 * `updatedAt` est tenu par Prisma lui-même (`@updatedAt`) : le nommer serait
 * l'écrire à la main, ce qui est justement ce qu'on ne veut pas.
 * `InspectionFinding.inspectionId` est une clé étrangère parcourue par sa
 * relation `inspection`, jamais par son identifiant.
 */
const CHAMPS_EXEMPTS = new Set(['updatedAt', 'InspectionFinding.inspectionId'])

/**
 * Méthodes d'API sans écran, et qui n'en veulent pas.
 *
 * `health` est une sonde : elle sert au déploiement et aux tests de contrat, pas
 * à un utilisateur. Lui exiger un bouton serait inventer une fonctionnalité.
 */
const API_EXEMPTES = new Set(['health'])

async function fichiers(depart, extensions) {
  const sortie = []
  async function descendre(dossier) {
    let entrees
    try {
      entrees = await readdir(dossier, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entrees) {
      if (IGNORES.has(e.name)) continue
      const chemin = join(dossier, e.name)
      if (e.isDirectory()) await descendre(chemin)
      else if (extensions.some((x) => e.name.endsWith(x))) sortie.push(chemin)
    }
  }
  await descendre(depart)
  return sortie
}

async function concatener(chemins, garder = () => true) {
  const morceaux = await Promise.all(
    chemins.filter(garder).map((c) => readFile(c, 'utf8')),
  )
  return morceaux.join('\n')
}

const SCALAIRES = new Set([
  'String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float', 'Decimal', 'Bytes', 'BigInt',
])

/** Les champs de DONNÉE du schéma — les relations n'en sont pas. */
function champsDeDonnee(schema) {
  const enums = new Set([...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]))
  const champs = []
  for (const bloc of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, modele, corps] = bloc
    for (const ligne of corps.split('\n')) {
      const l = ligne.trim()
      if (!l || l.startsWith('//') || l.startsWith('@@')) continue
      const m = /^(\w+)\s+([\w[\]?]+)/.exec(l)
      if (!m) continue
      const type = m[2].replace(/[?[\]]/g, '')
      if (SCALAIRES.has(type) || enums.has(type)) champs.push({ modele, nom: m[1] })
    }
  }
  return champs
}

const plaintes = []

// ─── 1. Une colonne que personne ne nomme ────────────────────────────────────
{
  const schema = await readFile(join(RACINE, 'server/prisma/schema.prisma'), 'utf8')
  const code = await concatener([
    ...(await fichiers(join(RACINE, 'src'), ['.ts', '.tsx'])),
    ...(await fichiers(join(RACINE, 'server/src'), ['.ts'])),
  ])
  const mots = new Set(code.match(/\w+/g) ?? [])

  for (const { modele, nom } of champsDeDonnee(schema)) {
    if (CHAMPS_EXEMPTS.has(nom) || CHAMPS_EXEMPTS.has(`${modele}.${nom}`)) continue
    if (!mots.has(nom)) {
      plaintes.push(
        `colonne orpheline · ${modele}.${nom} · aucun chemin du code ne la nomme. ` +
          `Branchez-la, ou retirez-la par migration.`,
      )
    }
  }
}

// ─── 2. Une méthode d'API qu'aucun écran n'appelle ───────────────────────────
{
  const clientPath = join(RACINE, 'src/api/client.ts')
  const client = await readFile(clientPath, 'utf8')
  const methodes = [...client.matchAll(/^ {2}(\w+): (?:<T>)?\(/gm)].map((m) => m[1])

  // Les TESTS sont exclus : un appel qui n'existe que sous test décrit une
  // fonctionnalité que personne ne peut déclencher — c'est le défaut même.
  const ecrans = await concatener(
    await fichiers(join(RACINE, 'src'), ['.ts', '.tsx']),
    (c) => c !== clientPath && !/\.test\.tsx?$/.test(c),
  )

  for (const nom of methodes) {
    if (API_EXEMPTES.has(nom)) continue
    // `.nom(` autant que `.nom<{ … }>(` : le paramètre de type s'intercale.
    if (!new RegExp(`\\.${nom}\\s*[<(]`).test(ecrans)) {
      plaintes.push(
        `méthode d'API orpheline · api.${nom} · aucun écran ni fournisseur ne l'appelle. ` +
          `Livrez son écran, ou retirez-la.`,
      )
    }
  }
}

// ─── 3. Une route serveur qu'aucun chemin du client ne compose ───────────────
//
// LE MOTIF EST EXACT, et il a fallu s'y reprendre. Première rédaction : « chaque
// segment fixe de la route apparaît-il quelque part dans client.ts ? ». Elle
// était MUETTE — retirer `updatePark` en entier ne la faisait pas broncher,
// parce que `PATCH /:parkId` n'a aucun segment fixe, et parce que chercher
// « payments » n'importe où dans le fichier trouve toujours quelque chose.
// C'est le défaut que ce dépôt traque partout ailleurs : un contrôle plus large
// que ce qu'il prétend garder.
//
// On compare donc des CHEMINS COMPLETS, méthode comprise, après avoir remplacé
// les paramètres par une étoile des deux côtés :
//
//   serveur  parksRouter.patch('/:parkId')            → PATCH /api/parks/*
//   client   requete(`/parks/${parkId}`, { method })  → PATCH /api/parks/*
{
  const MONTAGES = [
    // Le préfixe sous lequel `app.ts` monte chaque routeur. Le client, lui,
    // préfixe tout par `/api` dans `requete`.
    ['authRouter', '/api/auth'],
    ['rejoindreRouter', '/api/join'],
    ['parksRouter', '/api/parks'],
  ]

  const etoiler = (chemin) =>
    chemin
      .replace(/\$\{[^}]*\}/g, '*')
      .replace(/:[A-Za-z]\w*/g, '*')
      .replace(/\/+$/, '')

  // Ce que le CLIENT sait composer. `requete` porte le chemin en littéral de
  // gabarit et la méthode dans son initialiseur ; sans `method`, c'est un GET.
  const client = await readFile(join(RACINE, 'src/api/client.ts'), 'utf8')
  const composables = new Set()
  for (const m of client.matchAll(/requete<[^>]*>\(\s*`([^`]+)`([^)]*)/g)) {
    const methode = /method:\s*'(\w+)'/.exec(m[2])?.[1] ?? 'GET'
    composables.add(`${methode.toUpperCase()} ${etoiler('/api' + m[1])}`)
  }
  // `requete<void>('/chemin')` sans gabarit : même forme, guillemets simples.
  for (const m of client.matchAll(/requete<[^>]*>\(\s*'([^']+)'([^)]*)/g)) {
    const methode = /method:\s*'(\w+)'/.exec(m[2])?.[1] ?? 'GET'
    composables.add(`${methode.toUpperCase()} ${etoiler('/api' + m[1])}`)
  }

  const routesServeur = await concatener(
    await fichiers(join(RACINE, 'server/src'), ['routes.ts']),
  )
  for (const m of routesServeur.matchAll(
    /(\w*Router)\.(get|post|patch|delete|put)\(\s*'([^']*)'/g,
  )) {
    const [, routeur, verbe, chemin] = m
    const prefixe = MONTAGES.find(([nom]) => nom === routeur)?.[1]
    // Un routeur qu'`app.ts` ne monte pas n'a pas de chemin public : il est
    // hors de portée de ce contrôle, et le dire vaut mieux que l'ignorer.
    if (!prefixe) continue
    const complet = `${verbe.toUpperCase()} ${etoiler(prefixe + chemin)}`
    if (!composables.has(complet)) {
      plaintes.push(
        `route orpheline · ${complet} · aucun appel de src/api/client.ts ne compose ` +
          `ce chemin. Le serveur a pris de l’avance sur le client.`,
      )
    }
  }
}

// ─── 4. Un écran que rien ne monte ───────────────────────────────────────────
//
// LA FORME SUIVANTE DU MÊME DÉFAUT, et c'est une mutation muette qui l'a
// désignée. Retirer `<ReplyModal … />` de `Works.tsx` ne faisait broncher aucun
// des trois contrôles ci-dessus : le composant existait toujours, il appelait
// toujours `api.replyToWork`, et la méthode avait donc toujours son appelant.
// Le maillon rompu n'était pas la route ni la méthode — c'était la porte
// d'entrée de l'écran.
//
// Les cinq cas historiques étaient tous « une route sans écran ». Celui-ci est
// « un écran sans porte d'entrée » : il se compile, ses tests passent puisqu'ils
// le montent eux-mêmes, et aucun utilisateur ne peut l'atteindre.
{
  const tsx = await fichiers(join(RACINE, 'src'), ['.tsx'])
  const sources = new Map()
  for (const chemin of tsx.filter((c) => !/\.test\.tsx$/.test(c))) {
    sources.set(chemin, await readFile(chemin, 'utf8'))
  }

  const composants = new Map()
  for (const [chemin, texte] of sources) {
    for (const m of texte.matchAll(/^export function ([A-Z]\w+)/gm)) {
      composants.set(m[1], chemin)
    }
  }

  for (const [nom, source] of composants) {
    // Monté PAR UN AUTRE FICHIER. Un composant qui ne s'emploie que chez lui
    // n'a pas d'entrée non plus — et le fichier de test ne compte pas : s'y
    // monter soi-même est exactement ce qui masque le défaut.
    const monte = [...sources].some(
      ([chemin, texte]) => chemin !== source && new RegExp(`<${nom}[\\s/>]`).test(texte),
    )
    if (!monte) {
      plaintes.push(
        `écran orphelin · <${nom}> · aucun autre fichier de src/ ne le monte ` +
          `(${source.replace(RACINE, '')}). Il se compile, ses tests passent, ` +
          `et personne ne peut l’atteindre.`,
      )
    }
  }
}

if (plaintes.length > 0) {
  console.error(`✗ ${plaintes.length} maillon(s) orphelin(s) :\n`)
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    '\nUn maillon que rien n’appelle est une promesse que le produit ne tient pas.\n' +
      'Si l’exception est légitime, inscrivez-la — avec son motif — dans scripts/check-orphelins.mjs.',
  )
  exit(1)
}

console.log('✓ Aucune colonne, méthode, route ni écran orphelin.')
