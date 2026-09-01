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
 * Que les écrans sont BEAUX, ni que les CIBLES se touchent : `mesure-ui` tient
 * cette règle-là sur `/demo`, et sa sonde ne vit pas encore dans un module
 * partagé — c'est le dernier morceau de ce trou, et il est nommé plutôt que
 * comblé.
 *
 * Ni ce que produisent les MODALES, qu'aucune de ces règles n'ouvre.
 *
 * LE CONTRASTE ET LES NOMS, EUX, Y SONT — et le SOMBRE avec eux. C'était le
 * trou principal de cette porte : sous `/demo` il n'existe ni garde de rôle, ni
 * parc vide, ni locataire sans logement, ni gestionnaire borné, et la coquille
 * du locataire s'y atteint par un sélecteur de profil plutôt que par une
 * adhésion. Les deux audits sont LUS depuis les fichiers que la console emploie
 * déjà, jamais recopiés.
 *
 * MESURÉ : 101 s avant, 106 après. La bascule de thème se fait à chaud, sur une
 * page déjà chargée — le levier que `mesure-ui` a tiré pour passer sa propre
 * passe de contraste de 78,4 s à 38,8.
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
import { readFileSync } from 'node:fs'
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

/**
 * LES DEUX AUDITS SONT LUS, JAMAIS RECOPIÉS.
 *
 * `mesure-ui` les évalue déjà sur la démonstration, et son commentaire dit
 * pourquoi il les lit plutôt que de les réécrire : « une copie dériverait en
 * silence de l'outil que la console emploie encore, et les deux se
 * contrediraient sans que personne l'apprenne ». Le même fichier, le même
 * contrat de retour, deux surfaces.
 *
 * CE QUE CETTE SURFACE-CI AJOUTE — et c'est tout le sujet de ce lot. Sous
 * `/demo`, il n'existe ni garde de rôle, ni parc vide, ni locataire sans
 * logement, ni gestionnaire borné. La coquille du LOCATAIRE y est atteinte par
 * un sélecteur de profil, jamais par une adhésion. Quatre règles de
 * `mesure-ui` — contraste, cibles, noms, thème sombre — n'avaient donc jamais
 * été passées sur ces états-là.
 */
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')
const AUDIT_NOMS = readFileSync(join(RACINE, 'scripts/noms-accessibles.js'), 'utf8')

/**
 * LE GEL DES ANIMATIONS EST LA CONDITION DU CHANGEMENT DE THÈME À CHAUD.
 *
 * `mesure-ui` l'a payé : sans lui, « 13 points sur 24 rendaient un relevé
 * différent — les couleurs se transitionnent en 150 ms, et juste après la
 * bascule la page est dans un état MIXTE, fond déjà changé, texte pas encore.
 * L'audit inventait des dizaines de fautes ». Une passe deux fois plus rapide
 * qui ment est le pire échange possible.
 */
const FIGER_LES_ANIMATIONS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
`

/**
 * LES DEUX THÈMES, et la moitié des jetons ne vit que dans le second.
 *
 * `mesure-ui` le dit à sa ligne : « `warn` y vaut #e0b877 sur #54421f, aucun de
 * ces deux-là n'existant en clair. Ne mesurer qu'un thème, c'est ne mesurer
 * qu'une palette sur deux. » Le thème du produit étant du CSS pur —
 * `ThemeProvider` laisse `prefers-color-scheme` décider en mode auto —, il
 * s'emule à chaud, sans recharger.
 */
const THEMES = ['light', 'dark']

/**
 * DEUX LARGEURS POUR LE CONTRASTE, ET PAS TROIS.
 *
 * Le contraste ne dépend pas de la géométrie ; ce qui en dépend, c'est QUELLES
 * commandes sont rendues. À 320 la barre basse existe et le tiroir est replié ;
 * à 1280 c'est la barre latérale. Entre les deux, rien de neuf — et une
 * troisième largeur paierait un tiers de passe pour redire la même chose.
 */
const LARGEURS_D_AUDIT = [320, 1280]
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
/* Les trois rôles du produit. Les PROFILS balayés, plus bas, en comptent un de
   plus : le quatrième est un propriétaire, comme le premier, mais son parc est
   vide — le rôle ne suffit donc plus à désigner ce qu'on mesure. */
const ROLES = ['owner', 'manager', 'tenant']

/** Trois largeurs : la poche, la tablette, le bureau. */
const LARGEURS = [320, 768, 1280]

/**
 * L'APPAREIL DE RÉFÉRENCE, ET SON PLI.
 *
 * 360 × 640 n'est pas un choix de confort : c'est le téléphone sur lequel les
 * défauts de mise en page de ce produit ont été relevés, et `plafond-coquille`
 * le nomme déjà « l'appareil de référence ». Le PLI est sa hauteur — la ligne
 * sous laquelle il faut défiler pour voir.
 *
 * Le balayage ordinaire mesure à 900 px de haut, ce qui ne dit rien du pli : à
 * cette hauteur, tout tient. La règle du pli demande donc SA propre taille.
 */
const APPAREIL_DE_REFERENCE = { width: 360, height: 640 }

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

  /**
   * UN LOCATAIRE MEMBRE, ET SANS AUCUN LOGEMENT — l'état capturé en production.
   *
   * C'est le chemin que l'aide du champ d'invitation RECOMMANDE elle-même :
   * « sans logement, il rejoint le parc sans bail, vous l'y rattacherez
   * ensuite ». Entre les deux gestes — et cela peut durer des jours — son
   * espace n'a rien à lui montrer. Aucune mesure n'avait jamais ouvert cet
   * état-là : le locataire de sonde du dessus est relié dès sa création, comme
   * celui de la démonstration.
   *
   * Ce n'est pas une hypothèse. BEKONO LANDRY a vécu exactement ceci sur la
   * production, et deux lots ont été consacrés à en sortir : la fiche tenue par
   * le mauvais compte, puis le code qui ne rattachait plus un membre déjà entré.
   * L'ÉCRAN qu'il voyait pendant ce temps, lui, n'a jamais été mesuré.
   */
  const invitationOrpheline = await appeler(`/api/parks/${parkId}/invitations`, {
    cookie,
    corps: { role: 'tenant' },
  })
  await appeler('/api/auth/signup', {
    corps: {
      email: 'sans-logement@porte.test',
      password: MDP,
      fullName: 'Ondoa Pierre',
      acceptTerms: true,
      invitationCode: invitationOrpheline.corps.code,
    },
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
      tenantSansLogement: 'sans-logement@porte.test',
    },
    gestionnaireId: gestionnaire.corps.user.id,
  }
}

/**
 * UN PARC VIDE — et c'est l'écran que TOUT client voit en premier.
 *
 * ═══ L'ANGLE MORT QUE CE PARC FERME ═══
 *
 * La démonstration remplit TOUJOURS tout : cinq immeubles, quinze logements,
 * douze mois d'encaissements, des travaux, des cautions, des relances. Aucun des
 * six cents points de `mesure-ui` n'a jamais ouvert un écran VIDE, et le parc de
 * sonde du dessus reproduit fidèlement ce biais — il est riche, donc facile.
 *
 * CINQ CAPTURES DE LA PRODUCTION ONT TROUVÉ CINQ DÉFAUTS que l'instrumentation
 * ne pouvait pas voir, tous sur des écrans sans données : une file du jour vide
 * de 273 px qui poussait les quatre indicateurs sous le pli à 360×640, une
 * rangée de quatre cartes en trois colonnes laissant une orpheline, un bouton
 * rendu DEUX FOIS sur un écran de travaux vide, « toutes les notifications sont
 * lues » posé au-dessus de « rien à signaler », et trois montants à zéro
 * au-dessus d'une boîte disant « aucune caution ».
 *
 * ═══ POURQUOI UN SECOND PARC, ET NON UN DRAPEAU ═══
 *
 * Vider le parc du dessus rendrait invisibles les écrans qui ont besoin de
 * données — c'est l'échange perdant que `notes-conditionnelles` refuse déjà
 * pour `noVacantNotice`. Deux parcs coûtent une inscription et douze
 * chargements ; ils gardent les deux états.
 *
 * ET IL EST MONTÉ PAR LE GESTE RÉEL : `/api/auth/signup` avec un nom de parc,
 * point final. C'est exactement ce qu'un client fait, et l'état qu'il obtient —
 * pas une base tronquée à la main, qui pourrait produire un vide que le produit
 * ne sait pas fabriquer.
 */
async function monterUnParcVide() {
  const proprio = await appeler('/api/auth/signup', {
    corps: {
      email: 'parc-vide@porte.test',
      password: MDP,
      fullName: 'Ondoa Pierre',
      acceptTerms: true,
      parkName: 'Parc sans rien',
      countryCode: 'CM',
    },
  })
  const moi = await appeler('/api/auth/me', { methode: 'GET', cookie: proprio.cookie })
  return { parkId: moi.corps.memberships[0].parkId, compte: 'parc-vide@porte.test' }
}

/**
 * UN ÉTAT VIDE REMPLACE LES INDICATEURS, IL NE S'Y AJOUTE PAS.
 *
 * ═══ LE PRINCIPE EXISTAIT, RIEN NE LE GARDAIT ═══
 *
 * `Dashboard.tsx` l'énonce à sa ligne depuis des lots — « l'état vide REMPLACE
 * les indicateurs, il ne s'y ajoute pas ; quatre cartes à zéro, un graphique
 * plat et un échéancier vide donnent l'impression d'un produit cassé plutôt que
 * d'un parc neuf » — et il l'applique chez lui. Aucune porte ne le tenait
 * ailleurs, et l'écran des paiements le violait.
 *
 * MESURÉ sur le parc vide de cette porte, à 320 px : « En retard 0 FCFA · Payé
 * 0 FCFA · Loyers attendus 0 FCFA » sur 332 px, puis quatre onglets de filtre
 * portant chacun un 0 sur 96 px, puis 358 px d'une boîte annonçant « Aucun
 * paiement sur cette période ». Quatre cent vingt-huit pixels de zéros au-dessus
 * d'un message disant qu'il n'y a rien.
 *
 * C'est le défaut que cinq captures de production avaient trouvé sur les
 * cautions — « trois montants à zéro au-dessus d'une boîte disant aucune
 * caution ». Il a été réparé là-bas et il vivait ici, sur un écran que personne
 * n'avait ouvert vide.
 *
 * ═══ CE QU'ELLE MESURE, ET CE QU'ELLE NE JUGE PAS ═══
 *
 * La POSITION, pas l'esthétique : un `[data-indicateur]` dont le haut précède
 * celui d'un `[data-etat-vide]` de la même page. Elle ne dit pas qu'un écran est
 * beau, ni qu'un chiffre à zéro est faux — un zéro peut être une information
 * quand quelque chose existe à côté. Elle dit qu'on ne chiffre pas le néant
 * au-dessus de la phrase qui l'annonce.
 *
 * DEUX MARQUEURS, JAMAIS UNE CLASSE. `data-indicateur` existait déjà, et son
 * commentaire dit pourquoi : « un état doit être INTERROGEABLE autrement que par
 * sa peinture ». `data-etat-vide` est né avec cette règle, pour la même raison.
 */
const MESURER_ZEROS_AU_DESSUS_DU_VIDE = () => {
  /*
    ELLE REND TOUJOURS UN ÉTAT, jamais `null` sur les cas sains.

    Quatre chemins la font sortir sans plainte — pas de `<main>`, pas d'état
    vide de page, aucun indicateur au-dessus, au moins un chiffre parlant. Rendue
    en `null`, ces quatre-là étaient indistinguables d'une sonde CASSÉE : une
    faute de sélecteur aurait rendu la porte verte sur tout le balayage, et
    « aucune plainte » se serait lu « aucun défaut ».

    `vu` compte donc les écrans où un état vide de PAGE a réellement été trouvé,
    et le total est confronté plus bas à un plancher écrit à la main.
  */
  const principal = document.querySelector('main')
  if (!principal) return { vu: false, plainte: null }
  /* NIVEAU 2 SEULEMENT : l'état vide qui parle pour la PAGE. Un état vide de
     section — « aucun code en attente » sous les invitations — cohabite
     légitimement avec des indicateurs qui, eux, portent sur tout l'écran. */
  const vide = principal.querySelector('[data-etat-vide="2"]')
  if (!vide) return { vu: false, plainte: null }
  const hautDuVide = vide.getBoundingClientRect().top
  const dessus = [...principal.querySelectorAll('[data-indicateur]')].filter(
    (e) => e.getBoundingClientRect().top < hautDuVide,
  )
  if (dessus.length === 0) return { vu: true, plainte: null }

  /*
    « NE DIT RIEN » SE JUGE SUR LA VALEUR, pas sur la présence de la carte.

    Un indicateur est MUET quand son chiffre ne porte que des zéros : « 0 FCFA »,
    « 0 % », « 0 ». Il ne l'est pas dès qu'un chiffre non nul y figure — et c'est
    la distinction qui a sauvé l'écran des états des lieux, où « Sans état des
    lieux : 4 » est précisément l'information qui manque au bailleur, posée à
    côté de deux zéros et au-dessus de « aucun état des lieux enregistré ».

    LA PLAINTE N'ARRIVE QUE SI TOUS SONT MUETS. Un seul chiffre parlant suffit à
    justifier la rangée : on ne refuse pas des indicateurs, on refuse une rangée
    qui ne dit rien.

    Les chiffres sont ASCII dans les deux langues du produit — `Intl.NumberFormat`
    ne rend d'autres systèmes que pour des locales que ce produit n'a pas.
  */
  const muet = (carte) => {
    const valeur = carte.querySelector('[data-valeur]')
    const texte = (valeur?.textContent ?? '').trim()
    return /[0-9]/.test(texte) && !/[1-9]/.test(texte)
  }
  if (!dessus.every(muet)) return { vu: true, plainte: null }
  return {
    vu: true,
    plainte: {
    combien: dessus.length,
    hauteur: Math.round(
      dessus.reduce((total, e) => total + e.getBoundingClientRect().height, 0),
    ),
    // Le texte des coupables : c'est lui qui rend le refus lisible sans ouvrir
    // le code — « En retard 0 FCFA » se comprend tout seul.
    textes: dessus.map((e) => (e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)),
    annonce: (vide.querySelector('h2, h3, h4')?.textContent ?? '').trim().slice(0, 60),
    },
  }
}

/**
 * LE PREMIER CHIFFRE RESTE AU-DESSUS DU PLI.
 *
 * ═══ CE QUE CE DÉPÔT NE SAIT PAS MESURER ═══
 *
 * Il mesure admirablement ce qui DÉBORDE — deux règles, page et local, une
 * quinzaine de signatures tolérées, chacune avec son plafond au pixel. Il ne
 * mesure rien de ce qui OCCUPE TROP. Aucune garde ne refuse qu'un bloc prenne
 * tout l'écran, qu'une rangée laisse une orpheline, ou qu'un titre pousse
 * l'information sous le pli.
 *
 * ═══ LE DÉFAUT QUI L'A FAIT ÉCRIRE, ET IL EST DATÉ ═══
 *
 * 2026-08-30, relevé sur une capture de production : la file du jour VIDE
 * occupait 273 px pour dire qu'il n'y avait rien à faire, et poussait les quatre
 * indicateurs du tableau de bord ENTIÈREMENT sous le pli — le premier à 786 px
 * dans une fenêtre de 640. Un bailleur ouvrant son produit sur son téléphone ne
 * voyait pas un seul chiffre. Réparé le jour même : 604 px.
 *
 * Rien ne déborde dans ce défaut. Rien ne défile de travers. Aucune des huit
 * règles de `mesure-ui` ne peut le voir, et c'est pourquoi il a fallu une
 * capture d'écran pour le trouver.
 *
 * ═══ ELLE NAÎT VERTE, ET JE LE DIS ═══
 *
 * Relevé à l'écriture, sur les cinq profils : le plus bas premier chiffre est à
 * 521 px (`/app` du propriétaire), puis 495 (`/app/locataires`). Cent dix-neuf
 * pixels de marge sur le pire. Le défaut de 786 est réparé depuis un lot.
 *
 * C'est donc une garde PRÉVENTIVE, ce que ce dépôt n'aime pas — et elle
 * l'assume pour une raison : son mode de défaillance est SILENCIEUX. Un bloc
 * grandit, les chiffres glissent sous le pli, et rien ne se casse. Il a fallu
 * une capture la première fois ; il en faudrait une la seconde.
 *
 * ═══ LE PLAFOND N'EST PAS UN RÉGLAGE ═══
 *
 * C'est la hauteur de la fenêtre. « Au-dessus du pli » n'a qu'une définition, et
 * elle ne se négocie pas — il n'y a donc aucun nombre à faire monter le jour où
 * la garde gêne, ce qui est la façon habituelle dont un plafond meurt.
 */
const MESURER_LE_PLI = (pli) => {
  const principal = document.querySelector('main')
  if (!principal) return { vu: false, plainte: null }
  const premier = principal.querySelector('[data-indicateur]')
  if (!premier) return { vu: false, plainte: null }

  const boite = premier.getBoundingClientRect()
  const haut = Math.round(boite.top + window.scrollY)
  if (haut < pli) return { vu: true, plainte: null }

  /* CE QUI OCCUPE LA PLACE, nommé — un nombre nu ne se corrige pas. On rend les
     blocs de premier niveau qui précèdent le chiffre, avec leur hauteur : c'est
     la liste de ce qu'il faudrait raccourcir, dans l'ordre. */
  const avant = [...principal.children]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((x) => x.r.top + window.scrollY < haut && x.r.height > 24)
    .map((x) => ({
      hauteur: Math.round(x.r.height),
      texte: (x.e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 44),
    }))
  return { vu: true, plainte: { haut, avant } }
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
/* Combien de points portaient un état vide de PAGE — voir la sonde. */
let etatsVidesInspectes = 0
/* Combien d'écrans portaient un chiffre dont le pli a pu être jugé. */
let plisInspectes = 0
/* Ce que les deux audits ont réellement examiné — voir leur garde du garde. */
let textesAudites = 0
let nomsExamines = 0

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
let parcVide
try {
  parcDeSonde = await monterLeParc()
  parcVide = await monterUnParcVide()
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

/**
 * LES PROFILS BALAYÉS — un rôle, un compte, et le parc où il atterrit.
 *
 * La boucle parcourait `ROLES`, ce qui supposait un compte par rôle et un seul
 * parc. Le quatrième profil casse cette équivalence : c'est un PROPRIÉTAIRE,
 * comme le premier, mais son parc est vide. Le rôle ne suffit donc plus à
 * désigner ce qu'on mesure, et le nom du profil s'écrit à côté.
 *
 * `dossier` : le dossier d'un logement ne se visite que là où un logement
 * existe. Sur le parc vide il n'y en a aucun, et sur celui du locataire le
 * dossier appartient à la gestion.
 */
const PROFILS = [
  { cle: 'owner', role: 'owner', compte: () => parcDeSonde.comptes.owner, dossier: true },
  { cle: 'manager', role: 'manager', compte: () => parcDeSonde.comptes.manager, dossier: true },
  { cle: 'tenant', role: 'tenant', compte: () => parcDeSonde.comptes.tenant, dossier: false },
  /* LE PARC VIDE, sous les yeux d'un propriétaire — le premier écran de tout
     client, et celui qu'aucune mesure n'avait jamais ouvert. */
  { cle: 'owner·vide', role: 'owner', compte: () => parcVide.compte, dossier: false },
  /* LE LOCATAIRE SANS LOGEMENT — membre du parc, aucun bail. L'état que le
     produit RECOMMANDE de traverser, et celui qu'un incident de production a
     fait durer. Ses dix écrans n'ont rien à lui montrer. */
  {
    cle: 'tenant·sans',
    role: 'tenant',
    compte: () => parcDeSonde.comptes.tenantSansLogement,
    dossier: false,
  },
]

const navigateur = await chromium.launch()
const rapport = []

/** titre de chaque adresse pour le rôle qui Y A DROIT, en français — la référence. */
const titreAutorise = new Map()

try {
  for (const langue of LANGUES) {
    for (const profil of PROFILS) {
      const { cle, role } = profil
      const contexte = await navigateur.newContext({
        ...SANS_AGENT_DE_SERVICE,
        viewport: { width: LARGEURS.at(-1), height: 900 },
        locale: langue,
      })
      const connexion = await contexte.request.post(`${BASE}/api/auth/login`, {
        data: { email: profil.compte(), password: MDP },
      })
      if (!connexion.ok()) {
        plaintes.push(`${cle} : la connexion a rendu ${connexion.status()} — rien n'a pu être mesuré.`)
        await contexte.close()
        continue
      }
      const page = await contexte.newPage()

      const ouvertes = [
        ...ouvertesA(role),
        ...(profil.dossier ? [DOSSIER(parcDeSonde.unitId)] : []),
      ]

      for (const ecran of ouvertes) {
        await ouvrir(page, ecran.adresse)

        /*
          CONTRASTE, NOMS ET THÈME SOMBRE — la passe que `/demo` ne peut pas faire.

          Elle ne coûte AUCUN chargement : la page est là, dans la bonne langue,
          sous la bonne session. Deux largeurs, deux thèmes, et `emulateMedia`
          bascule la palette à chaud — c'est le levier que `mesure-ui` a tiré
          pour passer sa propre passe de 78,4 s à 38,8.
        */
        await page.addStyleTag({ content: FIGER_LES_ANIMATIONS }).catch(() => {})
        for (const largeur of LARGEURS_D_AUDIT) {
          await page.setViewportSize({ width: largeur, height: 900 })
          for (const theme of THEMES) {
            await page.emulateMedia({ colorScheme: theme })
            await page
              .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
                timeout: 5000,
              })
              .catch(() => {})
            const ou = `${ecran.adresse} · ${cle} · ${largeur}px · ${langue} · ${theme}`

            const contraste = await page.evaluate(AUDIT_CONTRASTE)
            if (!contraste || typeof contraste.examines !== 'number') {
              plaintes.push(
                `${ou} : \`contrast-audit.js\` n'a pas rendu \`{ failures, items, examines }\`. ` +
                  "Son expression doit rester une IIFE qui s'évalue en cet objet.",
              )
            } else {
              textesAudites += contraste.examines
              for (const item of contraste.items) {
                plaintes.push(
                  `${ou} : contraste ${item.ratio} sous le seuil WCAG AA — ` +
                    `${(item.text ?? '').slice(0, 44)} — ${item.color} sur ${item.bg}, seuil ${item.required}`,
                )
              }
            }

            /* LES NOMS NE DÉPENDENT PAS DU THÈME — repeindre un bouton ne le
               renomme pas —, et on ne les audite donc qu'une fois par largeur.
               Ils dépendent de la LANGUE, qui vient des dictionnaires, et de la
               largeur, qui décide quelles commandes existent. */
            if (theme === THEMES[0]) {
              const noms = await page.evaluate(AUDIT_NOMS)
              if (!noms || typeof noms.examinees !== 'number') {
                plaintes.push(
                  `${ou} : \`noms-accessibles.js\` n'a pas rendu \`{ anonymes, items, examinees }\`.`,
                )
              } else {
                nomsExamines += noms.examinees
                for (const item of noms.items) {
                  plaintes.push(
                    `${ou} : commande SANS NOM ACCESSIBLE — ${item.html ?? item.balise}`,
                  )
                }
              }
            }
          }
        }
        await page.emulateMedia({ colorScheme: 'light' })

        /* LE PLI SE MESURE APRÈS L'AUDIT, et la page est déjà
           chargée : c'est un redimensionnement, pas une navigation — 7 ms
           contre 1 072, chiffré par `mesure-ui`. La boucle qui suit repose sa
           propre largeur au premier tour. */
        await page.setViewportSize(APPAREIL_DE_REFERENCE)
        await page
          .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
            timeout: 5000,
          })
          .catch(() => {})
        const pli = await page.evaluate(MESURER_LE_PLI, APPAREIL_DE_REFERENCE.height)
        if (pli.vu) plisInspectes += 1
        if (pli.plainte) {
          plaintes.push(
            `${ecran.adresse} · ${cle} · ${APPAREIL_DE_REFERENCE.width}×${APPAREIL_DE_REFERENCE.height} · ${langue} : ` +
              `le premier chiffre est à ${pli.plainte.haut} px, SOUS le pli.\n      ` +
              pli.plainte.avant.map((b) => `${String(b.hauteur).padStart(4)} px  ${b.texte}`).join('\n      ') +
              "\n   Rien ne déborde et rien ne défile de travers : c'est de la place PRISE. " +
              'Sur ce téléphone, le lecteur ouvre son parc et ne voit pas un seul chiffre.',
          )
        }
        for (const largeur of LARGEURS) {
          if (largeur !== LARGEURS.at(-1)) {
            await page.setViewportSize({ width: largeur, height: 900 })
            await page
              .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
                timeout: 5000,
              })
              .catch(() => {})
          }
          const ou = `${ecran.adresse} · ${cle} · ${largeur}px · ${langue}`

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

          const zeros = await page.evaluate(MESURER_ZEROS_AU_DESSUS_DU_VIDE)
          if (zeros.vu) etatsVidesInspectes += 1
          if (zeros.plainte) {
            const z = zeros.plainte
            plaintes.push(
              `${ou} : ${z.combien} indicateur(s) chiffré(s) sur ${z.hauteur} px AU-DESSUS ` +
                `de « ${z.annonce} ».\n      ` +
                z.textes.join('\n      ') +
                "\n   Un état vide REMPLACE les indicateurs, il ne s'y ajoute pas : des chiffres à " +
                "zéro au-dessus d'un message disant qu'il n'y a rien donnent l'impression d'un " +
                'produit cassé plutôt que d’un parc neuf.',
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
        rapport.push(`   ${cle.padEnd(11)} ${ecran.adresse.padEnd(26)} ✓`)
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
            `${ecran.adresse} · ${cle} : l'écran est OUVERT à qui n'y a pas droit — il rend ` +
              `« ${rendu.titre} », exactement ce que voit le rôle autorisé.`,
          )
        }
        if (rendu.racineVide) {
          plaintes.push(`${ecran.adresse} · ${cle} · ${langue} : le refus lui-même ne rend rien.`)
        }
      }

      /* Et la direction qui portait le défaut de production : un écran OUVERT
         qui rend un refus. Le propriétaire lisait « Écran introuvable » sur une
         adresse qui lui appartenait. */
      for (const ecran of ouvertes) {
        const titre = titreAutorise.get(ecran.adresse)
        if (titre !== undefined && titresDeRefus.has(titre)) {
          plaintes.push(
            `${ecran.adresse} · ${cle} : l'écran est OUVERT à ce rôle et rend pourtant un REFUS ` +
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
  PROFILS.reduce((total, p) => total + ouvertesA(p.role).length + (p.dossier ? 1 : 0), 0)

if (pointsMesures !== ATTENDUS) {
  plaintes.push(
    `${pointsMesures} points mesurés pour ${ATTENDUS} attendus. Ce n'est pas « aucun défaut », ` +
      "c'est un balayage incomplet.",
  )
}

const FERMES_ATTENDUS = LANGUES.length * PROFILS.reduce((t, p) => t + fermeesA(p.role).length, 0)
if (pointsFermesMesures !== FERMES_ATTENDUS) {
  plaintes.push(
    `${pointsFermesMesures} refus vérifiés pour ${FERMES_ATTENDUS} attendus — la règle du refus ` +
      "n'a pas couvert ce qu'elle annonce.",
  )
}

/**
 * GARDE DU GARDE — la règle des zéros a-t-elle regardé quelque chose ?
 *
 * Elle sort sans plainte par quatre chemins, et une faute de sélecteur les
 * emprunterait tous : la porte rendrait « aucun défaut » en n'ayant rien
 * inspecté. Le plancher est écrit À LA MAIN et bas — il ne mesure pas la santé
 * du produit, il prouve que la sonde TROUVE encore des états vides de page.
 *
 * Relevé : 114 points en portent un — les écrans sans données du parc vide, ceux
 * du locataire sans logement, plus ceux du parc riche qui n'ont rien à montrer.
 * (60 avant l'entrée du cinquième profil, au lot précédent.) Le
 * plancher est fixé à 30, largement dessous : un écran qui se remplit ne doit
 * pas faire rougir cette garde, une sonde qui casse doit.
 */
/**
 * GARDE DU GARDE — la règle du pli a-t-elle jugé quelque chose ?
 *
 * Elle sort sans plainte par trois chemins : pas de `<main>`, aucun indicateur,
 * ou un chiffre au-dessus du pli. Les deux premiers sont indistinguables d'un
 * sélecteur cassé, et la règle NAÎT VERTE — elle n'a donc aucun rouge pour
 * prouver qu'elle regarde. Le compte est la seule chose qui l'atteste.
 *
 * Relevé à l'écriture : 62 écrans portent un chiffre — sur 336 points, la plupart
 * des écrans n'en portent aucun. Plancher à 40.
 */
/**
 * GARDE DU GARDE — les deux audits ont-ils examiné quelque chose ?
 *
 * Ils sont nés VERTS : aucun texte sous le seuil, aucune commande anonyme, sur
 * les deux thèmes. Un vert d'audit est indistinguable d'un audit qui ne trouve
 * plus ses éléments — un sélecteur cassé, une IIFE qui rend `null`, une page qui
 * n'a pas fini de peindre. Seuls ces deux comptes les séparent.
 *
 * Relevé à l'écriture : 13 862 textes et 3 136 commandes, sur les cinq profils,
 * les deux thèmes et les deux langues. Les planchers sont très en dessous : ils
 * ne mesurent pas la richesse du produit, ils prouvent que les deux audits
 * trouvent encore leurs éléments.
 */
const TEXTES_ATTENDUS = 2000
if (textesAudites < TEXTES_ATTENDUS) {
  plaintes.push(
    `l'audit de contraste n'a examiné que ${textesAudites} texte(s) pour ${TEXTES_ATTENDUS} ` +
      "attendus au moins. Ce n'est pas « aucun texte illisible », c'est un audit qui ne voit rien.",
  )
}

const NOMS_ATTENDUS = 1000
if (nomsExamines < NOMS_ATTENDUS) {
  plaintes.push(
    `l'audit des noms n'a examiné que ${nomsExamines} commande(s) pour ${NOMS_ATTENDUS} ` +
      "attendues au moins. Une commande anonyme ne se voit que si on la regarde.",
  )
}

const PLIS_ATTENDUS = 40
if (plisInspectes < PLIS_ATTENDUS) {
  plaintes.push(
    `la règle du pli n'a jugé que ${plisInspectes} écran(s) portant un chiffre pour ` +
      `${PLIS_ATTENDUS} attendus au moins. Une garde née verte qui cesse de regarder rend le ` +
      'même vert : ce compte, et lui seul, les sépare.',
  )
}

const ETATS_VIDES_ATTENDUS = 30
if (etatsVidesInspectes < ETATS_VIDES_ATTENDUS) {
  plaintes.push(
    `la règle des zéros n'a trouvé que ${etatsVidesInspectes} état(s) vide(s) de page pour ` +
      `${ETATS_VIDES_ATTENDUS} attendus au moins. Ce n'est pas « aucun défaut », c'est une sonde ` +
      'qui ne voit plus rien.',
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ espace-connecte : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ espace-connecte : ${ATTENDUS} points mesurés derrière une VRAIE session — ` +
    `${ECRANS.length} écrans, ${PROFILS.length} profils — dont un PARC VIDE et un LOCATAIRE SANS LOGEMENT —, ` +
    `${LARGEURS.length} largeurs, ` +
    `${LANGUES.length} langues.\n` +
    `  ${FERMES_ATTENDUS} refus vérifiés dans les deux directions.\n` +
    `  ${etatsVidesInspectes} état(s) vide(s) de page passé(s) sous la règle des zéros.\n` +
    `  ${plisInspectes} écran(s) portant un chiffre jugé(s) au pli de 360×640.\n` +
    `  ${textesAudites} textes confrontés au seuil WCAG AA, dans les DEUX thèmes ; ` +
    `${nomsExamines} commandes cherchées sans nom.\n` +
    "  Elle ne dit RIEN des cibles de 44 px ni des modales — voir son en-tête.",
)
