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
 * Que les écrans sont BEAUX. Et rien de ce que produisent les MODALES, qu'aucune
 * de ces règles n'ouvre : `modales` les tient en géométrie, pas en contraste, ni
 * en cibles, ni en interpolation.
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
  MESURER_CIBLES,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
  MESURER_DEFILEMENT_LATERAL,
  MESURER_GABARITS,
  MESURER_RENDU_MINIMAL,
} from './sondes-de-rendu.mjs'
import { ecransDeLEspaceConnecte } from './inventaire/routes.mjs'
/* Le MÊME aplatissement que `check-i18n` et ' + B + 'notes-conditionnelles' + B + '. Une note
   se cherche par sa CLÉ, jamais par une phrase recopiée : une phrase recopiée
   se périme au premier remaniement du dictionnaire, en silence. */
import { dictionnaireAPlat } from './check-i18n.mjs'

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
const FR = dictionnaireAPlat(readFileSync(join(RACINE, 'src/i18n/fr.ts'), 'utf8'))
/* L'ANGLAIS AUSSI : la passe des notes ne cherchait qu'en français, et une note
   dont la traduction cesse de paraître serait passée — le défaut fondateur de
   `mesure-ui` n'existait qu'en anglais, et la leçon vaut pour les notes. */
const EN = dictionnaireAPlat(readFileSync(join(RACINE, 'src/i18n/en.ts'), 'utf8'))

/**
 * LES NOTES CONDITIONNELLES QUE SEUL L'ESPACE CONNECTÉ PEUT PEINDRE.
 *
 * ' + B + 'notes-conditionnelles' + B + ' tient le registre de toutes les `<Notice>` du produit
 * et refuse celles qu'on ne sait pas atteindre. Huit y sont AVOUÉES — une phrase
 * dit pourquoi la démonstration ne peut pas les rendre — et trois de ces aveux
 * disaient la même chose : « il faudrait une adhésion, un serveur, un parc dans
 * un certain état ».
 *
 * Cette porte a exactement cela. Elle monte un vrai serveur, trois parcs, six
 * profils : les états que ces notes réclament, elle les FABRIQUE déjà pour
 * d'autres raisons. Il ne restait qu'à regarder.
 *
 * CE N'EST PAS UN DOUBLON DE L'AUTRE PORTE. Celle-là balaie `/demo` et tient
 * quinze notes ; celle-ci en tient trois, sur `/app`, que l'autre ne peut pas
 * ouvrir. Les aveux correspondants cessent de dire « personne ne la voit » pour
 * dire « ce script-ci ne peut pas l'atteindre » — ce qui n'est pas la même
 * chose, et c'est la seule des deux qui soit vraie.
 *
 * LA CLÉ, JAMAIS LA PHRASE. Le texte est résolu depuis ' + B + 'fr.ts' + B + ' : une phrase
 * recopiée ici se périmerait au premier remaniement du dictionnaire, sans que
 * rien ne le dise — la forme de silence que ce dépôt traque partout.
 */
const NOTES_SOUS_APP = [
  {
    cle: 'app.dashboard.scopedNotice',
    profil: 'manager',
    adresse: '/app',
    pourquoi: 'le gestionnaire de sonde est borné à un immeuble sur deux',
  },
  {
    cle: 'app.tenant.accessEnds',
    profil: 'tenant·parti',
    adresse: '/app/mon-espace',
    pourquoi: 'son bail s’est terminé il y a trente jours, dans la fenêtre du parc',
  },
  {
    cle: 'app.tenants.noVacantNotice',
    profil: 'owner·vide',
    adresse: '/app/locataires',
    pourquoi: 'un parc sans logement n’en a aucun de vacant',
  },
]

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

/**
 * UNE REQUÊTE DANS LA BASE DE SONDE — et non dans celle du développeur.
 *
 * `psql` ci-dessus vise `gestlocpro`, la base de travail : c'est ce qu'il faut
 * pour CRÉER et DÉTRUIRE `gestlocpro_porte`, puisqu'on ne peut pas supprimer la
 * base où l'on est connecté. Écrire des données de sonde par cette voie-là ne
 * fait rien du tout — l'identifiant visé n'existe pas dans la base de travail —
 * et c'est exactement ce qui est arrivé au premier essai : zéro ligne touchée,
 * et une plainte incompréhensible sur une note non peinte.
 *
 * Le garde-fou du nom vaut ici aussi : on n'écrit QUE dans une base dont le nom
 * finit par `_porte`.
 */
function psqlSonde(sql) {
  if (!NOM_BASE.endsWith('_porte')) {
    throw new Error(`refus d'écrire hors d'une base de sonde : ${NOM_BASE}`)
  }
  return execFileSync(
    'docker',
    ['exec', 'gestlocpro-db', 'psql', '-U', 'gestlocpro', '-d', NOM_BASE, '-tAc', sql],
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
  /* A3 porte le locataire PARTI — son bail est daté au passé plus bas. Il n'est
     donc ni vacant ni occupé au sens du produit, ce qui est justement un
     troisième état que les écrans de comptage doivent savoir rendre. La vacance
     reste tenue par le parc VIDE, qui n'a que cela. */
  const a3 = await creerLogement('A3', 120000)

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

  /**
   * UN LOCATAIRE PARTI, dans la fenêtre des trois mois.
   *
   * L'état qu'aucune mesure n'avait jamais ouvert, et que
   * `notes-conditionnelles` avouait ne pas pouvoir produire : « ses locataires
   * de sonde sont en place ou sans bail, jamais partis ». Or son espace a une
   * FORME PROPRE — il garde ses quittances, il porte une échéance de fermeture,
   * et rien d'autre du logement ne le regarde plus.
   *
   * LA DATE SE POSE EN BASE, faute de route. Aucune API ne termine un bail à une
   * date passée — c'est un fait qu'on constate, pas un geste qu'on offre — et
   * l'inventer par une route serait ajouter du produit pour mesurer. Trente
   * jours : dedans la fenêtre par défaut de trois mois, donc l'accès tient et
   * l'échéance s'annonce.
   */
  const invitationPartie = await appeler(`/api/parks/${parkId}/invitations`, {
    cookie,
    corps: { role: 'tenant' },
  })
  const partie = await appeler('/api/auth/signup', {
    corps: {
      email: 'partie@porte.test',
      password: MDP,
      fullName: 'Nkolo Arsene',
      acceptTerms: true,
      invitationCode: invitationPartie.corps.code,
    },
  })
  await appeler(`/api/parks/${parkId}/tenants`, {
    cookie,
    corps: {
      unitId: a3.id,
      fullName: 'Nkolo Arsene',
      phoneE164: '+237677000003',
      userId: partie.corps.user.id,
    },
  })
  psqlSonde(
    `UPDATE "Lease" SET "endsOn" = NOW() - INTERVAL '30 days', status = 'ended' ` +
      `WHERE "unitId" = '${a3.id}'`,
  )

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
      tenantParti: 'partie@porte.test',
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
  const parkId = moi.corps.memberships[0].parkId

  /**
   * IL SE GÈRE SEUL, et ce n'est pas un détail de montage.
   *
   * `delegation: solo` est l'autre moitié du réglage de délégation — celle qui
   * refuse tout gestionnaire. Elle commande une note d'avertissement sur l'écran
   * de prise en main, que `notes-conditionnelles` AVOUAIT ne pas savoir
   * atteindre : « il faudrait une adhésion fictive dans la session de
   * démonstration ».
   *
   * Ici il n'y a rien de fictif : un vrai parc, une vraie adhésion, un vrai
   * réglage. Le parc VIDE est celui qui peut le porter — il n'a aucun
   * gestionnaire, et la route refuse `solo` tant qu'il en reste un.
   */
  await appeler(`/api/parks/${parkId}`, {
    methode: 'PATCH',
    cookie: proprio.cookie,
    corps: { delegation: 'solo' },
  })

  return { parkId, compte: 'parc-vide@porte.test' }
}

/**
 * UN PARC VIDE QUI A UN GESTIONNAIRE — le profil que les deux autres parcs ne
 * peuvent pas produire.
 *
 * Le parc vide du dessus est en `delegation: solo` — il l'est pour la note du
 * recrutement, et la route refuse d'y émettre un code de gestionnaire. Le parc
 * riche a un gestionnaire, mais rien n'y est vide. Or le PREMIER écran d'un
 * cabinet qui vient d'accepter un mandat est exactement celui-ci : un parc
 * qu'on lui confie AVANT d'y saisir quoi que ce soit. Personne ne l'avait
 * jamais ouvert.
 */
async function monterUnParcVideGere() {
  const proprio = await appeler('/api/auth/signup', {
    corps: {
      email: 'parc-vide-gere@porte.test',
      password: MDP,
      fullName: 'Essomba Rose',
      acceptTerms: true,
      parkName: 'Parc confié sans rien',
      countryCode: 'CM',
    },
  })
  const moi = await appeler('/api/auth/me', { methode: 'GET', cookie: proprio.cookie })
  const parkId = moi.corps.memberships[0].parkId

  const invitation = await appeler(`/api/parks/${parkId}/invitations`, {
    cookie: proprio.cookie,
    corps: { role: 'manager' },
  })
  await appeler('/api/auth/signup', {
    corps: {
      email: 'gestion-vide@porte.test',
      password: MDP,
      fullName: 'Cabinet Essono',
      acceptTerms: true,
      invitationCode: invitation.corps.code,
    },
  })

  return { parkId, compte: 'gestion-vide@porte.test' }
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
 * ET LES CHIFFRES ÉCRITS DANS UN TITRE ? Vérifié avant de les marquer : les
 * seuls titres comptés du produit sont ceux de la file du jour — « {count}
 * loyers ne sont pas soldés » — et chacun est gardé par `.length > 0` à sa
 * ligne : « une ligne n'entre que si elle nomme un TRAVAIL qu'une personne peut
 * finir ». Un titre compté ne peut donc jamais porter zéro, par construction.
 * Rien à marquer — et si un titre compté sans garde apparaît un jour, c'est SA
 * garde qui manquera, pas un attribut ici.
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
  /*
    TOUT CE QUI PORTE UN CHIFFRE, et non les seules CARTES.

    La règle ne regardait que les `[data-indicateur]`. Sur l'écran des paiements
    d'un parc vide, elle a bien pris les trois cartes à zéro — et laissé passer
    les quatre onglets de filtre qui portaient chacun un 0 sur quatre-vingt-seize
    pixels, juste au-dessus du même message. Ils sont partis parce que je les ai
    VUS dans la mesure, pas parce qu'une règle les refusait : c'est écrit tel quel
    dans le lot qui les a retirés.

    `data-valeur` est le marqueur du CHIFFRE, qu'il vive dans une carte ou dans
    une pastille de filtre. C'est la même question posée au même endroit — « ce
    nombre dit-il quelque chose ? » — et un seul attribut y répond.

    On remonte de la valeur à sa BOÎTE quand elle en a une : le refus doit nommer
    « En retard · 0 FCFA », pas « 0 ». `closest('[data-indicateur]')` rend la carte
    quand il y en a une, l'élément lui-même sinon.
  */
  const porteurs = [...principal.querySelectorAll('[data-valeur]')].map(
    (v) => v.closest('[data-indicateur]') ?? v,
  )
  const dessus = [...new Set(porteurs)].filter(
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
  const muet = (porteur) => {
    /* La valeur est le porteur lui-même quand il n'y a pas de carte autour. */
    const valeur = porteur.matches('[data-valeur]') ? porteur : porteur.querySelector('[data-valeur]')
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
 * ═══ POURQUOI LE PREMIER CHIFFRE, ET PAS LE DERNIER ═══
 *
 * Le lot qui a écrit cette règle notait en dette : « elle ne juge que le
 * PREMIER chiffre ; une rangée dont la quatrième carte passe sous le pli reste
 * invisible ». C'est un choix désormais, pas un trou. À 360 px les cartes
 * s'empilent, et la quatrième SOUS le pli est le fonctionnement normal d'un
 * téléphone — on défile. Ce qui était un défaut sur la capture d'origine, c'est
 * qu'AUCUN chiffre n'était visible : le premier à 786 px dans 640. Juger le
 * premier attrape exactement cela ; juger le dernier interdirait le défilement.
 * La carte seule sur sa ligne aux largeurs à colonnes, elle, est prise par la
 * règle de l'ORPHELINE, qui compte les lignes.
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

/**
 * AUCUNE RANGÉE DE CARTES NE LAISSE UNE ORPHELINE.
 *
 * ═══ LE DÉFAUT, RELEVÉ SUR UNE CAPTURE DE PRODUCTION ═══
 *
 * 2026-08-30 : « rangée de QUATRE indicateurs en `xl:grid-cols-3` : la quatrième
 * seule sur sa ligne de 1280 à 1535 px. Quatre cartes ne se rangent jamais en
 * trois colonnes. »
 *
 * Rien ne déborde, rien ne défile, le premier chiffre est au-dessus du pli.
 * Aucune des règles de cette porte ne pouvait le voir — et la règle du pli, née
 * au lot précédent, le dit elle-même : « elle ne juge que le PREMIER chiffre ;
 * une rangée dont la quatrième carte passe sous le pli reste invisible ».
 *
 * ═══ CE QU'ELLE MESURE ═══
 *
 * Les cartes se groupent par LIGNE — même bord supérieur, à deux pixels près,
 * ce qui absorbe l'arrondi d'une grille sans confondre deux rangées. Une ligne
 * qui n'en porte qu'UNE, alors que la rangée en compte trois ou plus, est une
 * orpheline.
 *
 * DEUX AU MINIMUM SUR LA DERNIÈRE LIGNE, donc — et jamais « toutes les lignes
 * pleines », qui interdirait cinq cartes en trois colonnes. Ce qui se voit, ce
 * qui déséquilibre, c'est UNE carte seule ; deux forment encore un groupe.
 *
 * ═══ CE QU'ELLE NE JUGE PAS ═══
 *
 * Les rangées de DEUX cartes, qui se replient à une par ligne en mobile et ont
 * raison de le faire : à 320 px, une colonne est la seule mise en page possible,
 * et toute rangée y serait « orpheline » à chaque ligne. Le seuil de trois écarte
 * ce faux positif sans avoir à connaître la largeur.
 */
const MESURER_ORPHELINE = () => {
  const principal = document.querySelector('main')
  if (!principal) return { vu: false, plainte: null }
  const cartes = [...principal.querySelectorAll('[data-indicateur]')].filter(
    (e) => e.getBoundingClientRect().height > 0,
  )
  if (cartes.length < 3) return { vu: false, plainte: null }

  const lignes = new Map()
  for (const carte of cartes) {
    const haut = Math.round(carte.getBoundingClientRect().top / 2) * 2
    lignes.set(haut, [...(lignes.get(haut) ?? []), carte])
  }
  if (lignes.size < 2) return { vu: true, plainte: null }

  /*
    LE NOMBRE DE COLONNES SE DÉDUIT, il ne se suppose pas : c'est la ligne la
    plus fournie. Deux exclusions en découlent, et les deux ont été mesurées
    avant d'être écrites — la première rédaction de cette règle a rendu CENT SIX
    plaintes, dont aucune n'était un défaut.

    UNE SEULE COLONNE : à 320 px tout s'empile, et c'est la seule mise en page
    possible. Chaque rangée y serait « orpheline » à chaque ligne.

    DEUX COLONNES : trois cartes y donnent 2 + 1, et c'est le repli NORMAL d'une
    grille de trois sur une tablette. L'interdire reviendrait à interdire les
    rangées de trois, que ce produit emploie partout.

    Ce qui reste est le défaut capturé : QUATRE cartes en TROIS colonnes, la
    quatrième seule de 1280 à 1535 px.
  */
  const colonnes = Math.max(...[...lignes.values()].map((c) => c.length))
  if (colonnes < 3) return { vu: true, plainte: null }

  const derniere = [...lignes.entries()].sort((a, b) => a[0] - b[0]).at(-1)
  if (!derniere || derniere[1].length !== 1) return { vu: true, plainte: null }
  const seules = [derniere]

  return {
    vu: true,
    plainte: {
      total: cartes.length,
      lignes: [...lignes.values()].map((c) => c.length),
      texte: (seules[0][1][0].textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 44),
    },
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
/* Combien de points portaient un état vide de PAGE — voir la sonde. */
let etatsVidesInspectes = 0
/* Combien d'écrans portaient un chiffre dont le pli a pu être jugé. */
let plisInspectes = 0
/* Combien d'écrans portaient une rangée de trois cartes ou plus. */
let rangeesInspectees = 0
/* Combien de notes conditionnelles ont été cherchées — voir leur garde. */
let notesCherchees = 0
/* Ce que les deux audits ont réellement examiné — voir leur garde du garde. */
let textesAudites = 0
let nomsExamines = 0
/* Combien de cibles ont été réellement sondées — voir leur garde du garde. */
let ciblesSondees = 0

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
let parcVideGere
try {
  parcDeSonde = await monterLeParc()
  parcVide = await monterUnParcVide()
  parcVideGere = await monterUnParcVideGere()
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
  /* LE LOCATAIRE PARTI — son bail s'est terminé il y a trente jours, dans la
     fenêtre des trois mois. Son espace garde ses quittances ET porte l'échéance
     de fermeture, une note qu'aucune porte au navigateur n'avait jamais
     peinte. */
  {
    cle: 'tenant·parti',
    role: 'tenant',
    compte: () => parcDeSonde.comptes.tenantParti,
    dossier: false,
  },
  /* LE GESTIONNAIRE D'UN PARC VIDE — le premier écran d'un cabinet qui vient
     d'accepter un mandat, avant toute saisie. Il cumule les deux états durs :
     aucune donnée, ET les gardes du rôle de gestion. */
  {
    cle: 'manager·vide',
    role: 'manager',
    compte: () => parcVideGere.compte,
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
          /*
            LA LARGEUR EST POSÉE À CHAQUE TOUR, ET ELLE NE L'ÉTAIT PAS.

            Cette boucle sautait le redimensionnement sur la DERNIÈRE largeur,
            au motif que le contexte naissait déjà à 1280 : une navigation ne
            change pas la fenêtre, et l'économie était juste — tant que rien ne
            la redimensionnait avant.

            Les passes ajoutées depuis le font toutes : le PLI mesure à 360×640,
            l'audit de contraste à 320 puis 1280. La page arrivait donc dans
            cette boucle à 360 de large, et le tour « 1280 » mesurait 360 sans
            que rien ne le dise. Toutes les mesures annoncées à 1280 depuis le
            lot du pli étaient prises à 360 — trois règles sur cinq, deux
            langues, cinq profils.

            TROUVÉ PAR UN TÉMOIN QUI REFUSAIT DE ROUGIR : une quatrième carte
            posée dans une grille de trois colonnes ne produisait aucune
            orpheline, parce qu'à 360 il n'y a qu'une colonne. Le témoin ne
            prouvait pas la règle, il a prouvé la boucle.

            Le redimensionnement inconditionnel coûte 7 ms — chiffré par
            `mesure-ui` — contre 1 072 pour un chargement. L'économie ne valait
            pas ce qu'elle a caché.
          */
          await page.setViewportSize({ width: largeur, height: 900 })
          await page
            .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
              timeout: 5000,
            })
            .catch(() => {})
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

          /*
            LES CIBLES DE 44 px — le dernier morceau du trou de cette porte.

            `mesure-ui` tient cette règle sur `/demo` depuis des lots, et son
            en-tête dit ce qu'elle a trouvé en naissant : « un lien de 18 × 17 px
            qui était la seule entrée vers l'écran d'un logement ». Ce qu'elle ne
            peut pas atteindre, c'est ce que `/demo` ne rend pas — la coquille du
            locataire sous une adhésion, le parc vide, le gestionnaire borné.

            AUCUNE TOLÉRANCE ICI, et pour la même raison que le défilement
            latéral : `mesure-ui` en tient une liste, mesurée sur SA surface. Une
            dispense se mérite sur les pixels qu'elle couvre. Les exemptions
            déclarées AU SITE, elles, voyagent avec le produit — c'est leur
            intérêt, et la sonde les rend dans `raisonsVues`.

            Elle ne coûte aucun chargement : la page est là, à la bonne largeur.
          */
          const cibles = await page.evaluate(MESURER_CIBLES, {
            plancher: PLANCHER_CIBLE,
            rayon: RAYON_SONDAGE,
          })
          ciblesSondees += cibles.sondees
          for (const d of cibles.defauts) {
            plaintes.push(
              `${ou} : cible touchable ${d.cible} px (boîte ${d.boite}), sous le plancher de ` +
                `${PLANCHER_CIBLE} — <${d.balise}> ${d.texte || d.classes}` +
                "\n   Ce n'est pas une boîte qu'on mesure, c'est ce que le doigt touche : " +
                'rembourrages et recouvrements compris.',
            )
          }

          /* LES NOTES SE CHERCHENT UNE FOIS, en français et à la largeur de
             bureau : une note est un TEXTE, et sa présence ne dépend ni de la
             largeur ni de la langue — seulement de l'état du parc. */
          /* DANS CHAQUE LANGUE, à la largeur de bureau : la page de ce tour est
             déjà dans la bonne langue, et le texte attendu vient du dictionnaire
             correspondant. */
          if (largeur === LARGEURS.at(-1)) {
            for (const note of NOTES_SOUS_APP) {
              if (note.profil !== cle || note.adresse !== ecran.adresse) continue
              /* `dictionnaireAPlat` rend une `Map`, jamais un objet nu — et c'est
                 la première chose que ce lot a apprise en la lisant à l'indice. */
              const attendu = (langue === 'fr-FR' ? FR : EN).get(note.cle)
              if (!attendu) {
                plaintes.push(
                  `${note.cle} : introuvable dans \`fr.ts\`. La note a été renommée ou ` +
                    'retirée, et cette table la cherche encore.',
                )
                continue
              }
              notesCherchees += 1
              /*
                ON COMPARE CE QUI EST RENDU, DONC PAS LES JETONS.

                Cette règle prenait les SOIXANTE PREMIERS CARACTÈRES BRUTS du
                libellé. Aucune note n'avait de `{jeton}` si tôt, et la règle
                marchait par chance : la première qui en a porté un — « … reste
                ouvert jusqu'au {date} », au cinquante-huitième — a fait rougir
                une note pourtant PEINTE, avec un message qui accusait le parc de
                sonde. J'ai cherché le défaut dans les données, puis dans le
                serveur, avant de le trouver ici.

                On coupe donc AU PREMIER jeton. Et l'on refuse quand ce qui reste
                est trop court pour identifier la note : un préfixe de six
                caractères se retrouverait dans n'importe quelle phrase, et cette
                règle rendrait un vert qui ne veut rien dire.
              */
              const avantLeJeton = attendu.split('{')[0].trim()
              if (avantLeJeton.length < 20) {
                plaintes.push(
                  `${note.cle} : son libellé porte un \`{jeton}\` trop tôt — ` +
                    `« ${avantLeJeton} » ne suffit pas à l'identifier dans une page. ` +
                    'Cette table ne peut pas la vérifier par son texte ; il lui faut ' +
                    'un marqueur, ou un libellé qui commence par des mots.',
                )
                continue
              }
              const vue = await page.evaluate(
                (texte) => (document.body.innerText ?? '').includes(texte),
                avantLeJeton.slice(0, 60),
              )
              if (!vue) {
                plaintes.push(
                  `${note.cle} · ${cle} · ${ecran.adresse} : la note n'est PAS peinte.\n` +
                    `   Elle devrait l'être — ${note.pourquoi}. Soit l'état du parc de sonde a ` +
                    "changé, soit la note a cessé de paraître : dans les deux cas, l'aveu de " +
                    'notes-conditionnelles qui renvoie ici est devenu faux.',
                )
              }
            }
          }

          const orpheline = await page.evaluate(MESURER_ORPHELINE)
          if (orpheline.vu) rangeesInspectees += 1
          if (orpheline.plainte) {
            const o = orpheline.plainte
            plaintes.push(
              `${ou} : rangée de ${o.total} cartes rangée en ${o.lignes.join(' + ')} — une ORPHELINE.\n      ` +
                `seule sur sa ligne : ${o.texte}\n` +
                "   Rien ne déborde et rien ne défile : c'est un déséquilibre, et il se voit. " +
                'Quatre cartes ne se rangent jamais en trois colonnes.',
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
  /* ══════════════════ LE PREMIER GESTE D'UN CABINET ══════════════════ */

  /**
   * UN PARC VIDE NE SE LIT PAS, IL SE REMPLIT — et rien ne mesurait ce geste-là.
   *
   * Le sixième profil ouvre les quinze écrans d'un gestionnaire dont le parc est
   * vide, et c'est déjà ce que personne n'avait vu. Mais il ne fait que LIRE : le
   * premier geste réel d'un cabinet qui vient d'accepter un mandat — déclarer
   * l'immeuble qu'on lui décrit au téléphone — n'était rejoué par rien. Or c'est
   * le geste dont dépend tout le reste : un parc qui ne se remplit pas ne sert à
   * personne.
   *
   * APRÈS LE BALAYAGE, ET C'EST OBLIGATOIRE : ce geste rend le parc NON vide, et
   * les deux profils qui vivent de sa vacuité — `owner·vide` et `manager·vide` —
   * mesureraient alors autre chose que ce qu'ils déclarent. L'ordre n'est pas un
   * détail de mise en page, c'est une condition de validité.
   *
   * PAR L'INTERFACE, et non par la route : la route a ses propres gardes au
   * serveur, et 538 cas les tiennent. Ce qui n'était tenu par personne, c'est
   * qu'un gestionnaire PUISSE atteindre le geste — que le bouton existe sur un
   * parc vide, que la modale s'ouvre, que le champ accepte, et que la page rende
   * ensuite ce qu'on vient d'y mettre.
   */
  {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS.at(-1), height: 900 },
      locale: 'fr-FR',
    })
    const connexion = await contexte.request.post(`${BASE}/api/auth/login`, {
      data: { email: parcVideGere.compte, password: MDP },
    })
    if (!connexion.ok()) {
      plaintes.push(
        `premier geste : la connexion du gestionnaire a rendu ${connexion.status()}.`,
      )
    } else {
      const page = await contexte.newPage()
      await page.goto(`${BASE}/app/parc`, { waitUntil: 'networkidle' })

      const declarer = page.getByRole('button', { name: /Ajouter un immeuble/ }).first()
      if ((await declarer.count()) === 0) {
        plaintes.push(
          "premier geste : aucun bouton pour déclarer un immeuble sur un parc VIDE. " +
            "C'est le seul geste qui puisse en sortir, et il doit être atteignable " +
            "sans en connaître le chemin.",
        )
      } else {
        await declarer.click()
        const boite = page.getByRole('dialog').first()
        await boite.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        await boite.getByLabel(/Nom de l’immeuble/).fill('Résidence du Mandat')
        await boite.getByLabel(/Quartier/).fill('Bonapriso')
        await boite.getByRole('button', { name: /^Enregistrer$/ }).first().click()

        /* On attend que la PAGE le rende, et non que la requête parte : « le
           serveur a dit oui » et « l'utilisateur le voit » sont deux faits, et
           c'est le second que cette porte mesure. */
        const parue = await page
          .getByText('Résidence du Mandat')
          .first()
          .waitFor({ state: 'visible', timeout: 8000 })
          .then(() => true)
          .catch(() => false)
        if (!parue) {
          plaintes.push(
            "premier geste : l'immeuble déclaré n'apparaît pas sur `/app/parc`. " +
              'Le serveur a peut-être accepté ; le cabinet, lui, ne voit rien.',
          )
        }

        /*
          ET LE PREMIER LOGEMENT, car le geste ne s'arrête pas à l'immeuble.

          Le premier essai déclarait l'immeuble puis exigeait que l'état vide
          disparaisse — et il a rougi à juste titre : cet état dit « aucun
          LOGEMENT », et un immeuble sans logement n'en met aucun. Ce n'était pas
          la règle qui était fausse, c'était le geste qui était incomplet. Un
          cabinet qui prend un mandat déclare l'immeuble ET ce qu'il contient ;
          la séquence entière est ce qui fait sortir un parc de sa vacuité.
        */
        await page.getByRole('button', { name: /Ajouter un logement/ }).first().click()
        const boiteLogement = page.getByRole('dialog').first()
        await boiteLogement.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        await boiteLogement.getByLabel(/Numéro du logement/).fill('R1')
        await boiteLogement.getByLabel(/Surface/).fill('64')
        await boiteLogement.getByLabel(/Loyer mensuel/).fill('120000')
        await boiteLogement.getByRole('button', { name: /^Enregistrer$/ }).first().click()
        const logementParu = await page
          .getByText('R1', { exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 8000 })
          .then(() => true)
          .catch(() => false)
        if (!logementParu) {
          plaintes.push(
            "premier geste : le logement déclaré n'apparaît pas sur `/app/parc`.",
          )
        }

        /*
          ET LE LOCATAIRE, car un logement vide n'est pas un mandat commencé.

          Le geste s'arrêtait au logement, et c'était nommé en dette : « rattacher
          un locataire — la suite immédiate, et le geste qui a produit une impasse
          en production — reste hors du balayage ». Un cabinet qui prend un mandat
          déclare l'immeuble, son logement, ET qui l'habite ; c'est la séquence
          entière qui sort un parc de sa vacuité.

          On lit les libellés de la fiche plutôt que de les supposer : le
          formulaire est celui du produit, et s'il change, la plainte le dira.
        */
        await page.goto(`${BASE}/app/locataires`, { waitUntil: 'networkidle' })
        const creerFiche = page
          .getByRole('button', { name: /Créer une fiche locataire/ })
          .first()
        if ((await creerFiche.count()) === 0) {
          plaintes.push(
            "premier geste : aucun bouton pour créer une fiche locataire sur un parc " +
              "qui vient d'avoir son premier logement.",
          )
        } else {
          await creerFiche.click()
          await page.waitForTimeout(500)
          await page.getByLabel(/Nom complet/).fill('Ekani Solange')
          await page.getByLabel(/Téléphone/).fill('677001122')
          /* L'option porte le logement ET son immeuble — « Résidence du Mandat ·
             R1 » —, pas le seul libellé. On la choisit sur son CONTENU plutôt que
             sur une égalité, qui supposerait la forme du composé. */
          const optionDuLogement = await page.evaluate(() => {
            const select = document.querySelector('select[name="unitId"]')
            const o = [...(select?.options ?? [])].find((x) => x.textContent?.includes('R1'))
            return o?.value ?? null
          })
          if (!optionDuLogement) {
            plaintes.push(
              "premier geste : le logement qu'on vient de créer n'est pas proposé " +
                'à la fiche locataire. Il existe et on ne peut le rattacher à personne.',
            )
          } else {
            await page.getByLabel(/Unité/).selectOption(optionDuLogement)
          }
          await page
            .getByRole('button', { name: /Créer la fiche|^Enregistrer$/ })
            .first()
            .click()

          /* LA FICHE PARAÎT, ET LE LOGEMENT CESSE D'ÊTRE VACANT. Deux faits, et
             le second est celui qui compte : une fiche créée qui laisserait le
             logement libre serait une fiche rattachée à rien. */
          const ficheParue = await page
            .getByText('Ekani Solange')
            .first()
            .waitFor({ state: 'visible', timeout: 8000 })
            .then(() => true)
            .catch(() => false)
          if (!ficheParue) {
            plaintes.push(
              "premier geste : la fiche locataire créée n'apparaît pas sur " +
                '`/app/locataires`. Le serveur a peut-être accepté ; le cabinet ne ' +
                'voit rien.',
            )
          }

          await page.goto(`${BASE}/app/parc`, { waitUntil: 'networkidle' })
          const texteParc = await page.evaluate(
            () => document.querySelector('main')?.innerText ?? '',
          )
          if (!texteParc.includes('Ekani Solange')) {
            plaintes.push(
              "premier geste : le parc ne nomme pas le locataire qu'on vient d'y " +
                "rattacher. La fiche existe et le logement se lit encore comme vide — " +
                "c'est l'impasse capturée en production.",
            )
          }
        }

        /*
          ET L'ÉTAT VIDE DE LA PAGE DOIT AVOIR DISPARU. Un écran qui garderait
          « aucun immeuble » à côté de l'immeuble qu'on vient d'y mettre dirait
          deux choses contraires en même temps.

          DE LA PAGE, et non n'importe lequel : le premier essai comptait TOUS
          les `[data-etat-vide]` et a rougi sur un état parfaitement juste —
          celui de l'immeuble NEUF, qui n'a encore aucun logement. « Le parc est
          vide » et « cet immeuble est vide » sont deux phrases différentes, et
          seule la première devait disparaître. Le niveau 2 est celui qui vide
          une page entière, comme la règle des zéros plus haut le lit déjà.
        */
        const videEncore = await page.evaluate(() => {
          const principal = document.querySelector('main') ?? document.body
          return principal.querySelectorAll('[data-etat-vide="2"]').length
        })
        if (videEncore > 0) {
          plaintes.push(
            "premier geste : l'état vide de la PAGE subsiste alors que le parc ne l'est plus.",
          )
        }
      }
      await page.close()
    }
    await contexte.close()
  }

  /* ══════════════ LE REGISTRE QUI NE SE LIT PAS ══════════════ */

  /**
   * `app.decisions.failed` — UN ÉTAT D'ÉCHEC, QUI DEMANDE UN ÉCHEC.
   *
   * L'aveu disait : « il demande que le serveur refuse le registre des
   * décisions ; la démonstration sert le sien depuis le client et n'appelle
   * personne ». Vrai — et ce script-ci parle à un VRAI serveur, donc il peut
   * lui faire dire non.
   *
   * ON INTERCEPTE LA ROUTE, on ne casse pas le serveur. Provoquer une vraie
   * panne — couper la base, tuer le processus — rendrait tous les autres
   * écrans faux en même temps, et l'on ne saurait plus ce qu'on mesure.
   * L'interception ne touche qu'UNE adresse, dans UN contexte, et le serveur
   * continue de servir tout le reste normalement : c'est la panne telle que le
   * navigateur la voit, ce qui est exactement ce que l'écran doit rendre.
   *
   * 500 ET NON 404 : un registre absent et un registre illisible ne sont pas la
   * même chose, et c'est le second que cette note nomme.
   */
  {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS.at(-1), height: 900 },
      locale: 'fr-FR',
    })
    const connexion = await contexte.request.post(`${BASE}/api/auth/login`, {
      data: { email: parcDeSonde.comptes.owner, password: MDP },
    })
    if (!connexion.ok()) {
      plaintes.push(`registre illisible : la connexion a rendu ${connexion.status()}.`)
    } else {
      const page = await contexte.newPage()
      await page.route('**/api/parks/*/decisions*', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
      )
      await page.goto(`${BASE}/app/decisions`, { waitUntil: 'networkidle' })
      const vue = await page
        .getByText(/Le registre n’a pas pu être lu/)
        .first()
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false)
      if (!vue) {
        plaintes.push(
          "app.decisions.failed : le registre refuse de se lire et l'écran ne le DIT " +
            'pas. Une page vide sur un refus se lit « aucune décision » — le contraire ' +
            'de ce qui se passe.',
        )
      }
      await page.close()
    }
    await contexte.close()
  }

  /* ══════════════ LA NOTE DE LA GESTION SEULE ══════════════ */

  /**
   * `app.onboarding.delegationOffNotice` — DEUX CONDITIONS, ET UNE SEULE PORTE
   * PEUT LES TENIR.
   *
   * L'aveu était juste et complet : il faut un parc en `delegation: solo` — que
   * la démonstration ne peut pas porter, faute d'adhésion — ET l'ouverture de la
   * modale d'invitation, car malgré son nom la note vit dans `InviteModal`.
   * `modales` balaie `/demo` ; ce script-ci n'ouvrait aucune modale.
   *
   * Il en ouvre depuis le premier geste d'un cabinet. Le parc vide est déjà en
   * `solo` — il l'est pour la note du recrutement, pas pour celle-ci — et son
   * propriétaire est le seul compte qui réunisse les deux conditions.
   */
  {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS.at(-1), height: 900 },
      locale: 'fr-FR',
    })
    const connexion = await contexte.request.post(`${BASE}/api/auth/login`, {
      data: { email: parcVide.compte, password: MDP },
    })
    if (!connexion.ok()) {
      plaintes.push(`gestion seule : la connexion a rendu ${connexion.status()}.`)
    } else {
      const page = await contexte.newPage()
      await page.goto(`${BASE}/app/locataires`, { waitUntil: 'networkidle' })
      const inviter = page.getByRole('button', { name: /Inviter par code/ }).first()
      if ((await inviter.count()) === 0) {
        plaintes.push(
          "gestion seule : aucun bouton « Inviter par code » sur le parc en `solo`. " +
            "Un parc qui ne délègue pas invite quand même ses LOCATAIRES ; sans ce " +
            'bouton, la note qui explique le refus des codes de gestion est ' +
            'inatteignable.',
        )
      } else {
        await inviter.click()
        const boite = page.getByRole('dialog').first()
        await boite.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        const vue = await boite
          .getByText(/Ce parc est en gestion seule/)
          .first()
          .waitFor({ state: 'visible', timeout: 5000 })
          .then(() => true)
          .catch(() => false)
        if (!vue) {
          plaintes.push(
            "app.onboarding.delegationOffNotice : la note n'est PAS peinte dans la " +
              "modale d'invitation d'un parc en `solo`. C'est la seule chose qui " +
              'explique pourquoi aucun code de gestionnaire ne sort.',
          )
        }
      }
      await page.close()
    }
    await contexte.close()
  }

  /* ══════════════ LES DEUX NOTES D'AUTHENTIFICATION ══════════════ */

  /**
   * DEUX AVEUX QUI DÉSIGNAIENT LE MAUVAIS HÔTE.
   *
   * `notes-conditionnelles` les avouait ainsi : « elle tombera du même geste le
   * jour où ces gardes ouvriront un serveur — `politique-de-securite` le fait
   * déjà pour douze écrans ». Vérifié : ce serveur-là part sur un
   * `DATABASE_URL` volontairement injoignable — il mesure des en-têtes, pas des
   * parcours. Un mot de passe oublié s'écrit en base, et une réinitialisation
   * exige un JETON que seul un vrai serveur émet.
   *
   * C'est donc ici qu'elles vivent : ce script est le seul à tenir les deux.
   *
   * SUR UN COMPTE DONT PLUS PERSONNE NE SE SERT — celui du parc vide, dont le
   * balayage est terminé. Réinitialiser un mot de passe FERME toutes les
   * sessions du compte, la note le dit elle-même ; le faire sur un compte
   * qu'un profil ouvrirait ensuite casserait un balayage sans rapport.
   */
  {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS.at(-1), height: 900 },
      locale: 'fr-FR',
    })
    const page = await contexte.newPage()
    const compte = parcVide.compte

    await page.goto(`${BASE}/mot-de-passe-oublie`, { waitUntil: 'networkidle' })
    await page.getByLabel(/Adresse e-mail/).fill(compte)
    await page.getByRole('button', { name: /^Envoyer le lien$/ }).click()

    const envoye = await page
      .getByText(/un lien de réinitialisation vient d’y être envoyé/)
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (!envoye) {
      plaintes.push(
        "auth.forgot.sentBody : la note de confirmation n'est PAS peinte après une " +
          'demande de lien. Le serveur répond toujours 200 — pour ne pas révéler ' +
          "quels comptes existent — donc l'écran ne dépend que de lui-même.",
      )
    }

    /*
      ET LA RÉINITIALISATION RÉUSSIE RESTE HORS D'ATTEINTE — mesuré, pas supposé.

      J'ai essayé de lire le jeton pour ouvrir l'écran suivant. Il n'est nulle
      part :

        · `PasswordReset` ne stocke que `tokenHash`, jamais le jeton — la même
          règle que les sessions, et pour la même raison ;
        · `MessagerieJournal` n'imprime ni le corps ni le lien : elle masque le
          destinataire et ne garde que le sujet, parce que « les journaux sont
          plus nombreux que ceux qui lisent la base ».

      Le jeton ne vit donc que dans un courriel qui n'est pas envoyé. L'atteindre
      demanderait d'injecter une messagerie de sonde DANS le serveur lancé — ce
      script le lance dans un autre processus —, ou d'affaiblir le journal. Ni
      l'un ni l'autre ne vaut cette note ; l'aveu de `notes-conditionnelles` le
      dit maintenant avec cette raison-là, qui est la vraie.
    */
    await page.close()
    await contexte.close()
  }

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
/**
 * GARDE DU GARDE — la sonde des cibles a-t-elle touché quelque chose ?
 *
 * Née VERTE : aucune cible sous 44 px sur les 336 points. `mesure-ui` a payé
 * exactement ce piège sur sa propre passe — « le `if (!resultat) continue`
 * sautait la fin de l'itération, donc aurait sauté les cibles sur 484 points sur
 * 506 », et c'est le compte qui l'a dit, pas le vert.
 *
 * Relevé à l'écriture : 3 504 cibles sondées. Plancher à 2 000.
 *
 * LE PREMIER PLANCHER ÉTAIT À 5 000, ÉCRIT SANS AVOIR MESURÉ — et la garde l'a
 * refusé au premier passage. C'est exactement ce à quoi elle sert : un chiffre
 * qu'on croit connaître n'est pas un chiffre relevé, et celui-ci était plus de
 * cinq fois trop haut.
 */
const CIBLES_ATTENDUES = 2000
if (ciblesSondees < CIBLES_ATTENDUES) {
  plaintes.push(
    `la sonde des cibles n'en a touché que ${ciblesSondees} pour ${CIBLES_ATTENDUES} attendues ` +
      "au moins. Une cible trop petite ne se voit que si on la sonde.",
  )
}

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

/**
 * GARDE DU GARDE — la règle de l'orpheline a-t-elle vu une rangée ?
 *
 * Elle sort sans plainte par cinq chemins : pas de `<main>`, moins de trois
 * cartes, une seule ligne, moins de trois colonnes, dernière ligne pleine. Née
 * VERTE, elle n'a aucun rouge pour prouver qu'elle regarde — et sa PREMIÈRE
 * rédaction a rendu cent six plaintes dont aucune n'était un défaut, ce qui dit
 * assez qu'une règle de mise en page se trompe dans les deux sens.
 *
 * Relevé à l'écriture : 114 rangées de trois cartes ou plus. Plancher à 100 —
 * serré, parce que ces rangées sont le motif principal des écrans de gestion et
 * qu'en perdre un quart voudrait dire qu'un balayage s'est arrêté.
 */
/**
 * GARDE DU GARDE — les trois notes ont-elles été cherchées ?
 *
 * Le compte est ÉGAL, pas un plancher : la table en déclare trois, et trois
 * exactement doivent avoir été confrontées à l'écran. Un profil renommé, une
 * adresse déplacée, et la boucle ne trouverait plus la paire — sans qu'aucune
 * plainte ne sorte, puisque la condition ne serait jamais vraie.
 */
if (notesCherchees !== NOTES_SOUS_APP.length * LANGUES.length) {
  plaintes.push(
    `${notesCherchees} note(s) conditionnelle(s) cherchée(s) pour ${NOTES_SOUS_APP.length * LANGUES.length} ` +
      "déclarée(s). Une paire profil/adresse ne se rencontre plus : la table pointe à côté.",
  )
}

const RANGEES_ATTENDUES = 100
if (rangeesInspectees < RANGEES_ATTENDUES) {
  plaintes.push(
    `la règle de l'orpheline n'a vu que ${rangeesInspectees} rangée(s) pour ${RANGEES_ATTENDUES} ` +
      "attendues au moins. Une carte seule ne se voit que si on compte les lignes.",
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
    `${ECRANS.length} écrans, ${PROFILS.length} profils — parc vide, locataire sans logement, gestionnaire sans parc à gérer —, ` +
    `${LARGEURS.length} largeurs, ` +
    `${LANGUES.length} langues.\n` +
    `  ${FERMES_ATTENDUS} refus vérifiés dans les deux directions.\n` +
    `  ${etatsVidesInspectes} état(s) vide(s) de page passé(s) sous la règle des zéros.\n` +
    `  ${plisInspectes} écran(s) portant un chiffre jugé(s) au pli de 360×640.\n` +
    `  ${rangeesInspectees} rangée(s) de trois cartes ou plus, comptées ligne à ligne.\n` +
    `  ${notesCherchees} note(s) conditionnelle(s) que seul l'espace connecté peut peindre.\n` +
    `  ${textesAudites} textes confrontés au seuil WCAG AA, dans les DEUX thèmes ; ` +
    `${nomsExamines} commandes cherchées sans nom.\n` +
    `  ${ciblesSondees} cibles sondées au doigt, sous le plancher de ${PLANCHER_CIBLE} px.\n` +
    '  Le PREMIER GESTE d’un cabinet est rejoué en entier : un immeuble et son logement\n' +
    '  et son premier LOCATAIRE, déclarés À L’ÉCRAN sur un parc qui n’avait rien.\n' +
    "  Elle ne dit RIEN des MODALES, qu'aucune de ses règles n'ouvre — voir son en-tête.",
)
