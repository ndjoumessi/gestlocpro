#!/usr/bin/env node
/**
 * L'ESPACE CONNECTÉ ENTRE SOUS LA MESURE — la moitié du produit que personne
 * ne regardait.
 *
 * ═══ L'ANGLE MORT, ÉCRIT NOIR SUR BLANC DEPUIS DES LOTS ═══
 *
 * `inventaire-ui.mjs` le dit dans son en-tête, et le dit bien : « `/app` est
 * servi par `vite preview`, qui sert `dist/` et RIEN d'autre — aucun mandataire
 * vers l'API. L'appel de session reçoit donc `index.html` en guise de JSON,
 * échoue, et l'écran reste sur “Chargement…” : quatre éléments, indéfiniment. »
 * Il conclut : « Ce n'est PAS une exemption de confort. C'est un refus de
 * compter comme “mesuré” un écran dont on n'a mesuré que le squelette. »
 *
 * Le refus était juste. Il laissait quand même quinze écrans sans aucune porte,
 * et la démonstration en tenait lieu — même code, autres données, aucun garde
 * de rôle, aucun serveur. Ce que `/demo` ne peut pas montrer :
 *
 *  · les GARDES DE RÔLE, qui n'existent que sous `/app` — `Locataire` et
 *    `Restricted` laissent passer la démonstration par construction ;
 *  · les données que le SERVEUR compose — un parc vide, un locataire sans bail,
 *    une fiche sans compte, une liste à un seul élément. La démonstration est
 *    un parc riche et complet, c'est-à-dire le cas le plus facile ;
 *  · les états qu'une vraie session traverse — le premier écran d'un compte
 *    neuf, celui d'un gestionnaire qui n'a pas encore de parc.
 *
 * Trois des quatre défauts capturés en production ce jour-là vivaient
 * exactement là, et aucune porte au navigateur ne pouvait les voir.
 *
 * ═══ CE QUE CETTE PORTE MONTE, ET POURQUOI SI LOURD ═══
 *
 * Le VRAI serveur — celui d'`app.ts`, en production, servant `dist/` — devant
 * une VRAIE base PostgreSQL, dédiée, recréée à chaque passage. C'est le seul
 * montage où `/app` rend autre chose qu'un squelette, et `politique-de-securite`
 * a déjà démontré que le prix se paie : elle monte le même serveur pour la même
 * raison — la chose mesurée n'existe pas ailleurs.
 *
 * LE PARC EST ÉCRIT PAR LES ROUTES DU PRODUIT, jamais dans la base.
 * Une insertion directe irait plus vite et dériverait du schéma au premier
 * champ ajouté ; surtout, elle fabriquerait un état que le produit ne sait pas
 * produire, et l'on mesurerait alors un écran qu'aucun utilisateur ne verra.
 * `/api/auth/signup`, `/buildings`, `/units`, `/tenants`, `/invitations`,
 * `/works` — le parcours qu'un vrai propriétaire suit, dans l'ordre.
 *
 * ═══ QUATRE RÈGLES ═══
 *
 *  1. L'ÉCRAN REND. Un titre, un élément interactif, une racine non vide. C'est
 *     la règle qui rend les trois autres dignes de foi : sous `/app`, un écran
 *     qui ne rend pas est le défaut ORDINAIRE, pas l'accident.
 *  2. AUCUN GABARIT NE SURVIT. La même sonde que `mesure-ui`, partagée par
 *     `sondes-de-rendu.mjs` — mais sur les données du serveur, où vivaient deux
 *     des trois `{jetons}` capturés en production.
 *  3. AUCUN DÉFILEMENT LATÉRAL, à trois largeurs et dans les deux langues.
 *  4. LE REFUS EST À SA PLACE, et nulle part ailleurs. Deux directions, et
 *     c'est la seconde qui compte : un écran FERMÉ ne rend pas son contenu, et
 *     un écran OUVERT ne rend pas un refus. Le défaut le plus visible du
 *     produit ce jour-là était de la seconde espèce — un propriétaire à qui son
 *     propre écran répondait « Écran introuvable ».
 *
 * AUCUNE DE CES RÈGLES NE PORTE DE CHAÎNE ÉCRITE À LA MAIN. Le titre d'un
 * refus n'est pas recopié ici : il est APPRIS, en ouvrant les adresses que le
 * rôle n'a pas, et comparé au titre que la même adresse rend pour le rôle qui y
 * a droit. Une traduction qui change ne fait donc pas rougir cette porte, et
 * une liste de titres à entretenir ne s'y périme pas.
 *
 * ═══ CE QU'ELLE NE DIT PAS ═══
 *
 * Que les écrans sont BEAUX, ni que les cibles se touchent, ni que le contraste
 * passe : `mesure-ui` tient ces règles-là sur `/demo`, où les mêmes composants
 * rendent. Les rejouer ici doublerait la porte pour redire la même chose.
 *
 * Ni ce que produisent les MODALES, qu'aucune de ces quatre règles n'ouvre.
 *
 * Ni le SOMBRE : les deux thèmes ont été relevés sur 69 points par `mesure-ui`,
 * qui n'y a trouvé aucune différence de géométrie. Le mesurer ici doublerait le
 * coût pour un écart mesuré à zéro.
 *
 * ═══ CE QUE LA RÈGLE 4 NE PEUT PAS VOIR, ET IL FAUT LE DIRE ═══
 *
 * `ROLES_PAR_ADRESSE` est LA table que le produit consulte pour ouvrir un
 * écran, et c'est la même que cette porte lit pour savoir ce qui devrait être
 * ouvert. Une entrée FAUSSE dans cette table — `decisions` ouvert au
 * gestionnaire par erreur — ne fera donc rougir personne ici : le produit et la
 * porte se tromperaient ensemble. Cette porte juge que le RENDU SUIT la table,
 * jamais que la table dit vrai.
 *
 * Et le CONTENU de la table n'est jugé qu'à moitié : `espaceReserveAuLocataire`
 * couvre les trois écrans du locataire — les seuls que ce dépôt ait vus casser —
 * et rien ne juge que `decisions` doive rester au propriétaire seul. C'est un
 * trou NOMMÉ, pas un trou comblé.
 *
 * Et quand les deux directions rougissent d'un coup — un garde de rôle cassé
 * dans un sens comme dans l'autre — les messages se doublent : le titre de
 * référence est lui-même devenu un refus. Deux plaintes pour un défaut, jamais
 * l'inverse.
 *
 * ═══ LA BASE RESTE, APRÈS ═══
 *
 * `gestlocpro_porte` n'est pas supprimée en sortant, et c'est délibéré : quand
 * la porte rougit, le parc qui l'a fait rougir est encore là, interrogeable.
 * Le passage suivant la détruit de toute façon avant de rien mesurer.
 *
 * PRÉREQUIS : `npm run db:up` à la racine (le conteneur `gestlocpro-db`), et
 * `dist/` construit — `mesure-ui`, qui tourne avant dans `check:navigateur`,
 * s'en charge. Les deux absences sont DITES, jamais contournées.
 */
import { chromium } from 'playwright'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import {
  MESURER_DEFILEMENT_LATERAL,
  MESURER_GABARITS,
  MESURER_RENDU_MINIMAL,
} from './sondes-de-rendu.mjs'
import { ecransDeLEspaceConnecte } from './inventaire/routes.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4197
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LA BASE DE LA PORTE, et le garde qui l'empêche de toucher les deux autres.
 *
 * Elle est DÉTRUITE et recréée à chaque passage : le parc de sonde doit être
 * exactement le même d'une exécution à l'autre, sans quoi une porte rougirait
 * un jour sur deux pour des données accumulées. Le même conteneur porte celle
 * du développement et celle des tests ; se tromper de nom, c'est effacer un
 * travail réel.
 *
 * Le suffixe est donc contrôlé — le même geste que `setup-test-db.mjs`, qui
 * exige `_test` avant de laisser passer une migration.
 */
const NOM_BASE = 'gestlocpro_porte'
const URL_BASE = `postgresql://gestlocpro:gestlocpro@127.0.0.1:5433/${NOM_BASE}?schema=public`

if (!NOM_BASE.endsWith('_porte')) {
  console.error('\n✗ espace-connecte : la base de la porte doit finir par `_porte`.\n')
  exit(1)
}

const MDP = 'un-mot-de-passe-de-sonde-assez-long'
const ROLES = ['owner', 'manager', 'tenant']

/** Trois largeurs : la poche, la tablette, le bureau. */
const LARGEURS = [320, 768, 1280]

/** Les deux langues — le défaut fondateur de `mesure-ui` n'existait qu'en anglais. */
const LANGUES = ['fr-FR', 'en-US']

const plaintes = []

/* ══════════════════════════ LA BASE ══════════════════════════ */

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'gestlocpro-db', 'psql', '-U', 'gestlocpro', '-d', 'gestlocpro', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim()
}

function preparerLaBase() {
  try {
    /* `WITH (FORCE)` : une connexion oubliée par un passage interrompu
       empêcherait la suppression, et la porte échouerait sur un état qu'elle
       est précisément là pour remettre à zéro. */
    psql(`DROP DATABASE IF EXISTS "${NOM_BASE}" WITH (FORCE)`)
    psql(`CREATE DATABASE "${NOM_BASE}"`)
  } catch (erreur) {
    console.error(
      "\n✗ espace-connecte : le conteneur « gestlocpro-db » ne répond pas.\n" +
        '  Démarrez-le depuis la racine :  npm run db:up\n\n' +
        String(erreur.message ?? erreur) +
        '\n',
    )
    exit(1)
  }

  const migration = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(RACINE, 'server'),
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: URL_BASE },
  })
  if (migration.status !== 0) {
    console.error(
      '\n✗ espace-connecte : les migrations ne passent pas sur la base de la porte.\n\n' +
        `${(migration.stdout || '') + (migration.stderr || '')}\n`,
    )
    exit(1)
  }
}

/* ══════════════════════════ LE SERVEUR ══════════════════════════ */

function construireLeServeur() {
  const construction = spawnSync('npx', ['tsc', '-b'], {
    cwd: join(RACINE, 'server'),
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (construction.status !== 0) {
    console.error(
      '\n✗ espace-connecte : le serveur ne se construit pas, la porte ne peut pas tourner.\n\n' +
        `${(construction.stdout || '') + (construction.stderr || '')}\n` +
        '  Il manque probablement les dépendances du serveur ou le client Prisma :\n' +
        '    npm --prefix server ci && (cd server && npx prisma generate)\n',
    )
    exit(1)
  }
}

function servir() {
  return new Promise((resoudre, rejeter) => {
    const fils = spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `process.env.NODE_ENV='production';` +
          `process.env.CLIENT_DIST=${JSON.stringify(join(RACINE, 'dist'))};` +
          `process.env.SESSION_SECRET='un-secret-de-porte-assez-long-pour-passer';` +
          `process.env.STOCKAGE_RACINE='/tmp/gestlocpro-porte-espace';` +
          `process.env.DATABASE_URL=${JSON.stringify(URL_BASE)};` +
          `const {createApp}=await import(${JSON.stringify(join(RACINE, 'server/dist/src/app.js'))});` +
          `createApp().listen(${PORT});`,
      ],
      { cwd: RACINE, stdio: 'ignore' },
    )
    ;(async () => {
      for (let i = 0; i < 160; i++) {
        try {
          if ((await fetch(BASE + '/')).ok) return resoudre(fils)
        } catch {
          /* pas encore en écoute */
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      fils.kill()
      rejeter(new Error('le serveur de production n’a pas démarré'))
    })()
  })
}

/* ══════════════════════════ LE PARC DE SONDE ══════════════════════════ */

/** Un appel au produit, avec le cookie de qui le fait. Un échec est une PANNE. */
async function appeler(chemin, { methode = 'POST', corps, cookie } = {}) {
  const reponse = await fetch(BASE + chemin, {
    method: methode,
    headers: {
      ...(corps ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  })
  if (!reponse.ok) {
    throw new Error(
      `espace-connecte : ${methode} ${chemin} a rendu ${reponse.status} — ` +
        `${(await reponse.text()).slice(0, 200)}\n` +
        "  Le parc de sonde ne s'est pas monté : la porte ne peut RIEN mesurer.",
    )
  }
  const entetes = reponse.headers.getSetCookie?.() ?? []
  const session = entetes.find((c) => c.startsWith('gestlocpro_session='))
  return { corps: await reponse.json(), cookie: session ? session.split(';')[0] : null }
}

/**
 * LE PARC, monté par les gestes que le produit recommande, dans leur ordre.
 *
 * Il porte délibérément les DEUX moitiés de chaque cas où le produit a déjà
 * cassé : un logement occupé et un vacant, une fiche reliée à un compte et une
 * fiche orpheline, un signalement remonté par le locataire et pas encore chiffré,
 * une invitation en attente. Un parc uniforme rendrait des écrans uniformes,
 * et les écrans uniformes ne trouvent rien.
 */
async function monterLeParc() {
  const proprio = await appeler('/api/auth/signup', {
    corps: {
      email: 'proprietaire@porte.test',
      password: MDP,
      fullName: 'Djoumessi Nelson',
      acceptTerms: true,
      parkName: 'Parc de la porte',
      countryCode: 'CM',
    },
  })
  const cookie = proprio.cookie
  const moi = await appeler('/api/auth/me', { methode: 'GET', cookie })
  const parkId = moi.corps.memberships[0].parkId

  const immeuble = await appeler(`/api/parks/${parkId}/buildings`, {
    cookie,
    corps: { name: 'Résidence Bastos', district: 'Bastos' },
  })
  const immeubleId = immeuble.corps.building.id

  /* UN SECOND IMMEUBLE, et il n'est pas décoratif : le geste « confier des
     immeubles » ne s'affiche qu'à partir de deux — un parc d'un seul n'a rien à
     répartir. Sans lui, l'écran des accès ne rendrait jamais la moitié de ce
     que ce lot y a posé. */
  const second = await appeler(`/api/parks/${parkId}/buildings`, {
    cookie,
    corps: { name: 'Immeuble Akwa Nord', district: 'Akwa' },
  })
  await appeler(`/api/parks/${parkId}/buildings/${second.corps.building.id}/units`, {
    cookie,
    corps: { label: 'N1', type: 'T1', surfaceSqm: 34, baseRentMinor: 90000 },
  })

  const creerLogement = async (label, loyer) =>
    (
      await appeler(`/api/parks/${parkId}/buildings/${immeubleId}/units`, {
        cookie,
        corps: { label, type: 'T2', surfaceSqm: 62, baseRentMinor: loyer },
      })
    ).corps.unit

  const a1 = await creerLogement('A1', 180000)
  const a2 = await creerLogement('A2', 150000)
  /* A3 reste VACANT : les écrans qui comptent l'occupation ont besoin des deux
     côtés, et un parc plein rend le taux d'occupation ininteressant à mesurer. */
  await creerLogement('A3', 120000)

  /* Le locataire entre par un code SANS logement — le chemin que l'aide du
     champ d'invitation recommande, et celui qui a produit l'impasse réparée
     dans `leCodeRattacheUnMembre`. Sa fiche naît ensuite, RELIÉE. */
  const invitationLocataire = await appeler(`/api/parks/${parkId}/invitations`, {
    cookie,
    corps: { role: 'tenant' },
  })
  const locataire = await appeler('/api/auth/signup', {
    corps: {
      email: 'locataire@porte.test',
      password: MDP,
      fullName: 'Bekono Landry',
      acceptTerms: true,
      invitationCode: invitationLocataire.corps.code,
    },
  })
  await appeler(`/api/parks/${parkId}/tenants`, {
    cookie,
    corps: {
      unitId: a1.id,
      fullName: 'Bekono Landry',
      phoneE164: '+237677000001',
      userId: locataire.corps.user.id,
      depositMinor: 360000,
    },
  })

  /* La seconde fiche n'a PAS de compte : c'est l'état le plus courant d'un parc
     réel, et l'écran des accès a une colonne entière pour le dire. */
  await appeler(`/api/parks/${parkId}/tenants`, {
    cookie,
    corps: { unitId: a2.id, fullName: 'Ondoa Pierre', phoneE164: '+237677000002' },
  })

  const invitationGestion = await appeler(`/api/parks/${parkId}/invitations`, {
    cookie,
    corps: { role: 'manager' },
  })
  const gestionnaire = await appeler('/api/auth/signup', {
    corps: {
      email: 'gestionnaire@porte.test',
      password: MDP,
      fullName: 'Atangana Pauline',
      acceptTerms: true,
      invitationCode: invitationGestion.corps.code,
    },
  })

  /* Une invitation qui reste EN ATTENTE : le registre des accès a une section
     pour elles, et elle serait vide sans celle-ci. */
  await appeler(`/api/parks/${parkId}/invitations`, {
    cookie,
    corps: { role: 'tenant', unitId: a2.id },
  })

  /* Un versement, pour que les écrans d'encaissement et de quittance aient une
     ligne à montrer plutôt qu'un état vide. */
  const mois = new Date().toISOString().slice(0, 8) + '01'
  await appeler(`/api/parks/${parkId}/payments`, {
    cookie,
    corps: { unitId: a1.id, periodStart: mois, amountMinor: 180000, method: 'mobile' },
  })

  /* LE SIGNALEMENT VIENT DU LOCATAIRE, et c'est le sens normal : « une
     intervention naît d'un signalement de locataire, jamais d'une saisie du
     bailleur ». Il produit du même coup l'avis qui remonte au bailleur — celui
     dont la carte affichait « {unit} » en production. */
  await appeler(`/api/parks/${parkId}/units/${a1.id}/works`, {
    cookie: locataire.cookie,
    corps: {
      title: 'Fuite sous l’évier de la cuisine',
      trade: 'plumbing',
      urgency: 'normal',
      description: 'L’eau coule dès qu’on ouvre le robinet, une bassine par jour.',
    },
  })

  /**
   * LE GESTIONNAIRE EST BORNÉ, et c'est l'état que ce balayage doit voir.
   *
   * Un gestionnaire à qui l'on a confié un immeuble sur deux lit des listes
   * PARTIELLES sur chacun de ses écrans — et c'est exactement là qu'un écran
   * casse : une liste vide, un indicateur qui divise par zéro, une carte dont
   * la donnée n'est plus là. Le laisser sans périmètre mesurerait le cas le
   * plus facile, celui que la démonstration montre déjà.
   */
  const adhesionDeGestion = await appeler(`/api/parks/${parkId}/access`, {
    methode: 'GET',
    cookie,
  })
  const sienne = adhesionDeGestion.corps.members.find((m) => m.role === 'manager')
  await appeler(`/api/parks/${parkId}/memberships/${sienne.id}/immeubles`, {
    methode: 'PATCH',
    cookie,
    corps: { buildingIds: [immeubleId] },
  })

  return {
    parkId,
    unitId: a1.id,
    comptes: {
      owner: 'proprietaire@porte.test',
      manager: 'gestionnaire@porte.test',
      tenant: 'locataire@porte.test',
    },
    gestionnaireId: gestionnaire.corps.user.id,
  }
}

/* ══════════════════════════ LE BALAYAGE ══════════════════════════ */

const ECRANS = ecransDeLEspaceConnecte()

/**
 * GARDE DU GARDE — le plancher d'écrans, asymétrique par construction.
 *
 * Ajouter une route fait monter le compte et ne dérange personne ; en retirer
 * une le fait tomber et arrête tout. C'est la seule direction où l'on veuille
 * une alarme, parce qu'un écran sorti du champ se lit « aucun défaut » alors
 * qu'il veut dire « pas regardé ».
 */
const ECRANS_ATTENDUS = 15

if (ECRANS.length < ECRANS_ATTENDUS) {
  console.error(
    `\n✗ espace-connecte : ${ECRANS.length} écrans lus dans le routeur, moins que les ` +
      `${ECRANS_ATTENDUS} attendus. Un écran est sorti du champ de la mesure.\n`,
  )
  exit(1)
}

const ouvertesA = (role) => ECRANS.filter((e) => e.roles.includes(role))
const fermeesA = (role) => ECRANS.filter((e) => !e.roles.includes(role))

/**
 * LE DOSSIER D'UN LOGEMENT, ajouté à la main comme `mesure-ui` ajoute `/demo/parc/A1`.
 *
 * Son chemin porte un paramètre, donc l'inventaire l'écarte — mais l'ÉCRAN se
 * visite : c'est ce qu'on ouvre depuis chaque ligne du parc. `mesure-ui` a
 * relevé 217 px de blanc imposé sous sa carte « Occupation » le jour où il est
 * entré dans son balayage ; il n'était mesuré par RIEN avant.
 */
const DOSSIER = (unitId) => ({ adresse: `/app/parc/${unitId}`, roles: ['owner', 'manager'] })

async function ouvrir(page, adresse) {
  await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 8000,
    })
    .catch(() => {})
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => {})
}

let pointsMesures = 0
let pointsFermesMesures = 0

const parc = await (async () => {
  console.log('  préparation de la base…')
  preparerLaBase()
  console.log('  construction du serveur…')
  construireLeServeur()
  if (!existsSync(join(RACINE, 'dist/index.html'))) {
    console.error(
      '\n✗ espace-connecte : `dist/` est absent — cette porte MESURE le paquet construit.\n' +
        '  `mesure-ui` le construit et tourne avant elle dans `check:navigateur` ;\n' +
        '  seule, lancez d’abord :  npx vite build\n',
    )
    exit(1)
  }
  return null
})()

const serveur = await servir()
let parcDeSonde
try {
  parcDeSonde = await monterLeParc()
} catch (erreur) {
  console.error('\n✗ ' + String(erreur.message ?? erreur) + '\n')
  serveur.kill()
  exit(1)
}

/* GARDE DU GARDE : un parc VIDE rendrait des écrans vides, qui ne violeraient
   rien. On exige donc que le montage ait vraiment écrit quelque chose avant de
   croire un seul vert. */
const portefeuille = await (
  await fetch(`${BASE}/api/parks/${parcDeSonde.parkId}/portfolio`, {
    headers: { cookie: '' },
  })
).status
if (portefeuille !== 401) {
  plaintes.push(
    `le portefeuille répond ${portefeuille} SANS session — la mesure qui suit ne dirait rien ` +
      "des gardes de rôle, puisqu'il n'y en aurait aucun.",
  )
}

const navigateur = await chromium.launch()
const rapport = []

/** titre de chaque adresse pour le rôle qui Y A DROIT, en français — la référence. */
const titreAutorise = new Map()

try {
  for (const langue of LANGUES) {
    for (const role of ROLES) {
      const contexte = await navigateur.newContext({
        ...SANS_AGENT_DE_SERVICE,
        viewport: { width: LARGEURS.at(-1), height: 900 },
        locale: langue,
      })
      const connexion = await contexte.request.post(`${BASE}/api/auth/login`, {
        data: { email: parcDeSonde.comptes[role], password: MDP },
      })
      if (!connexion.ok()) {
        plaintes.push(`${role} : la connexion a rendu ${connexion.status()} — rien n'a pu être mesuré.`)
        await contexte.close()
        continue
      }
      const page = await contexte.newPage()

      const ouvertes = [
        ...ouvertesA(role),
        ...(role === 'tenant' ? [] : [DOSSIER(parcDeSonde.unitId)]),
      ]

      for (const ecran of ouvertes) {
        await ouvrir(page, ecran.adresse)
        for (const largeur of LARGEURS) {
          if (largeur !== LARGEURS.at(-1)) {
            await page.setViewportSize({ width: largeur, height: 900 })
            await page
              .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
                timeout: 5000,
              })
              .catch(() => {})
          }
          const ou = `${ecran.adresse} · ${role} · ${largeur}px · ${langue}`

          const rendu = await page.evaluate(MESURER_RENDU_MINIMAL)
          if (rendu.racineVide || rendu.titres === 0 || rendu.interactifs === 0) {
            plaintes.push(
              `${ou} : l'écran n'a PAS rendu — ` +
                (rendu.racineVide
                  ? 'racine sans enfant, rien n’a été monté'
                  : rendu.titres === 0
                    ? 'aucun titre (h1–h3)'
                    : 'aucun élément interactif') +
                "\n   Sous `/app`, c'est le défaut ordinaire : la session n'aboutit pas, et l'écran " +
                'reste sur son état de chargement.',
            )
          }

          const gabarits = await page.evaluate(MESURER_GABARITS)
          if (gabarits.jetons.length > 0) {
            plaintes.push(
              `${ou} : gabarit NON RÉSOLU à l'écran — ${gabarits.jetons.join(', ')}\n` +
                "   Le paramètre n'atteint pas `t()`, ou le message est écrit en ICU imbriqué, " +
                'que le fournisseur ne lit pas.',
            )
          }

          const defilement = await page.evaluate(MESURER_DEFILEMENT_LATERAL)
          if (defilement) {
            const coupables = defilement.coupables
              .map((c) => `${c.balise}.${c.classe} (droite ${c.droite} > ${defilement.largeurVue})`)
              .join('\n      ')
            plaintes.push(
              `${ou} : la page DÉFILE latéralement de ${defilement.decalage} px.\n      ` +
                (coupables || '(aucun élément isolé — la cause est un parent qui impose sa largeur)'),
            )
          }

          if (langue === LANGUES[0] && largeur === LARGEURS.at(-1)) {
            titreAutorise.set(ecran.adresse, rendu.titre)
          }
          pointsMesures++
        }
        rapport.push(`   ${role.padEnd(8)} ${ecran.adresse.padEnd(26)} ✓`)
      }

      /* ─── LE REFUS, APPRIS PLUTÔT QUE RECOPIÉ ─── */
      const titresDeRefus = new Set()
      for (const ecran of fermeesA(role)) {
        await ouvrir(page, ecran.adresse)
        const rendu = await page.evaluate(MESURER_RENDU_MINIMAL)
        titresDeRefus.add(rendu.titre)
        pointsFermesMesures++

        const reference = titreAutorise.get(ecran.adresse)
        if (langue === LANGUES[0] && reference !== undefined && rendu.titre === reference) {
          plaintes.push(
            `${ecran.adresse} · ${role} : l'écran est OUVERT à qui n'y a pas droit — il rend ` +
              `« ${rendu.titre} », exactement ce que voit le rôle autorisé.`,
          )
        }
        if (rendu.racineVide) {
          plaintes.push(`${ecran.adresse} · ${role} · ${langue} : le refus lui-même ne rend rien.`)
        }
      }

      /* Et la direction qui portait le défaut de production : un écran OUVERT
         qui rend un refus. Le propriétaire lisait « Écran introuvable » sur une
         adresse qui lui appartenait. */
      for (const ecran of ouvertes) {
        const titre = titreAutorise.get(ecran.adresse)
        if (titre !== undefined && titresDeRefus.has(titre)) {
          plaintes.push(
            `${ecran.adresse} · ${role} : l'écran est OUVERT à ce rôle et rend pourtant un REFUS ` +
              `— « ${titre} », le même titre que les adresses qu'il n'a pas.`,
          )
        }
      }

      await contexte.close()
    }
  }
} finally {
  await navigateur.close()
  serveur.kill()
}

console.log(rapport.slice(0, ECRANS.length + 2).join('\n'))

/**
 * GARDE DU GARDE — le compte des points, calculé et non écrit.
 *
 * Une sonde qui n'aurait relu aucun écran rendrait « aucune plainte », qui est
 * exactement ce que rend un produit sain. Le compte les sépare : il vaut ce que
 * l'inventaire et les deux boucles impliquent, et rien d'autre.
 */
const ATTENDUS =
  LANGUES.length *
  LARGEURS.length *
  ROLES.reduce((total, role) => total + ouvertesA(role).length + (role === 'tenant' ? 0 : 1), 0)

if (pointsMesures !== ATTENDUS) {
  plaintes.push(
    `${pointsMesures} points mesurés pour ${ATTENDUS} attendus. Ce n'est pas « aucun défaut », ` +
      "c'est un balayage incomplet.",
  )
}

const FERMES_ATTENDUS = LANGUES.length * ROLES.reduce((t, role) => t + fermeesA(role).length, 0)
if (pointsFermesMesures !== FERMES_ATTENDUS) {
  plaintes.push(
    `${pointsFermesMesures} refus vérifiés pour ${FERMES_ATTENDUS} attendus — la règle du refus ` +
      "n'a pas couvert ce qu'elle annonce.",
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ espace-connecte : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ espace-connecte : ${ATTENDUS} points mesurés derrière une VRAIE session — ` +
    `${ECRANS.length} écrans, ${ROLES.length} rôles, ${LARGEURS.length} largeurs, ` +
    `${LANGUES.length} langues.\n` +
    `  ${FERMES_ATTENDUS} refus vérifiés dans les deux directions.\n` +
    "  Cette porte ne dit RIEN du contraste, des cibles ni des modales — voir son en-tête.",
)
