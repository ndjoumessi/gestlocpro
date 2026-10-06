#!/usr/bin/env node
/**
 * L'HEURE QU'IL EST NE DOIT CHANGER AUCUN VERDICT.
 *
 * ═══ LE DÉFAUT, ET IL A FAIT ROUGIR `main` ═══
 *
 * Le 2026-09-29 à 21 h 00 UTC, `lecturePersistee` a refusé sur l'intégration
 * continue une charge utile qu'il acceptait dix minutes plus tôt sur la machine
 * de développement, sans qu'une ligne de source ait bougé entre les deux :
 *
 *   attendu  { ids: ['n-neuve', 'n-autre'] }
 *   obtenu   { ids: ['n-autre', 'n-neuve'] }
 *
 * L'écran range les avis sur un horodatage RELATIF que `relatif()` arrondit —
 * `Math.round(heures / 24)`. Les deux fixtures du cas sont espacées d'UNE
 * HEURE. Tant qu'elles s'arrondissent au même nombre de jours, leurs clés sont
 * égales, le tri est stable, l'ordre d'entrée survit. Pendant l'heure où l'une
 * a basculé et l'autre pas, elles échangent leur place.
 *
 * ON NE TROUVE PAS CELA EN RELISANT : l'assertion a l'air d'une assertion. On ne
 * le trouve pas non plus en relançant à la même heure. Il faut DÉPLACER
 * L'HORLOGE, et la déplacer AUX BONS MOMENTS.
 *
 * ═══ POURQUOI DES FRONTIÈRES, ET NON UNE GRILLE ═══
 *
 * Un premier balayage a cherché par grille : toutes les deux ou trois heures sur
 * quarante-sept heures, huit fichiers, aucune rougeur. Le témoin l'a démenti —
 * en rétablissant l'assertion d'ordre corrigée, la MÊME grille restait verte.
 *
 * LA FENÊTRE FAIT UNE HEURE PAR JOUR, et la grille en faisait deux à trois. Une
 * grille de pas S ne voit que les fenêtres plus larges que S, et la largeur
 * d'une fenêtre vaut l'écart entre deux fixtures — que rien ne borne.
 *
 * ON VISE DONC LES FRONTIÈRES. Pour `Math.round(heures / 24)`, la bascule d'une
 * fixture datée à T tombe quand son âge vaut (N + ½) jours, c'est-à-dire chaque
 * jour à `T + 12 h` d'horloge. Toute fenêtre COMMENCE à l'une de ces bascules :
 * s'échantillonner juste après chacune d'elles les couvre TOUTES, quelle que
 * soit leur largeur. Dix moments suffisent là où quarante-huit échouaient.
 *
 * ═══ CE QUE CE SCRIPT NE COUVRE PAS ═══
 *
 * IL NE CONNAÎT QU'UN ARRONDI, celui de `relatif()`. Une autre règle de
 * troncature — un « ce mois-ci » calendaire, un basculement d'année — a ses
 * propres frontières, que ce script ne calcule pas.
 *
 * IL NE VOIT QUE LES FIXTURES ÉCRITES EN CLAIR, sous la forme
 * `AAAA-MM-JJTHH:MM`. Une date construite par calcul — `Date.now() - 3600_000`
 * — n'a pas de frontière repérable ici, et son cas passera sans être rejoué.
 *
 * IL NE JUGE PAS LE PRODUIT. Deux avis espacés d'une heure échangent bel et bien
 * leur place à l'écran quand le plus ancien franchit un demi-jour : c'est assumé
 * dans `ordreDesAvis`, et l'écran rend de toute façon le même « il y a 41 jours »
 * aux deux. Ce script garde les CAS, pas la mise en ordre.
 *
 *   node scripts/horloge-sans-influence.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Une fixture datée écrite en clair — c'est tout ce qu'on sait repérer. */
const HORODATAGE = /[0-9]{4}-[0-9]{2}-[0-9]{2}T([0-9]{2}):([0-9]{2})/g

/**
 * LE DEMI-JOUR QUI FAIT BASCULER `Math.round(heures / 24)`.
 *
 * Écrit ici plutôt que déduit : c'est la règle de `relatif()` dans
 * `apiPortfolio.ts`, et si elle change, ce nombre doit changer avec elle. Un
 * script qui la re-déduirait des sources prétendrait suivre une définition
 * qu'il ne comprend pas.
 */
const DEMI_JOUR_EN_MINUTES = 12 * 60

/** Une minute après la bascule : dedans, jamais dessus. */
const APRES_LA_BASCULE_EN_MINUTES = 1

/*
  LE COMPTE DES FICHIERS DATÉS EST ÉCRIT À LA MAIN.

  La liste est DÉDUITE — tout fichier de cas qui porte un horodatage en clair —,
  mais son compte ne l'est pas. Le dériver rendrait la garde d'accord avec
  elle-même : une expression régulière cassée ne trouverait plus rien, et la
  porte se déclarerait verte en ayant cessé de regarder. Ajouter un cas daté
  oblige donc à toucher ce nombre, et le diff le montre.
*/
/* 62 → 63 (2026-10-06) : `compteRenduEmis.test.tsx`, né avec le figeage du
   compte-rendu de gestion. Il porte un `issuedAt` en clair — la date du
   document émis —, et c'est précisément le genre d'horodatage que cette porte
   existe pour rejouer : « Émis le … » se rend par `d.fullDate`, une date
   ABSOLUE, mais rien dans l'assertion ne le dit, et la prochaine rédaction
   pourrait la passer en relatif sans que personne ne le voie. */
const FICHIERS_DATES_ATTENDUS = 63

function fichiersDeCas(dossier) {
  const trouves = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) trouves.push(...fichiersDeCas(chemin))
    else if (/\.test\.tsx?$/.test(entree.name)) trouves.push(chemin)
  }
  return trouves
}

/** Les minutes-dans-la-journée des fixtures datées d'un fichier. */
function momentsDatesDe(chemin) {
  const source = readFileSync(chemin, 'utf8')
  const moments = new Set()
  for (const trouve of source.matchAll(HORODATAGE)) {
    moments.add(Number(trouve[1]) * 60 + Number(trouve[2]))
  }
  return moments
}

/** Le décalage, en millisecondes, d'ici à la prochaine occurrence de `minute`. */
function decalageVers(minuteDuJour, maintenant) {
  const minuteActuelle =
    maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes() + maintenant.getUTCSeconds() / 60
  let ecart = minuteDuJour - minuteActuelle
  if (ecart <= 0) ecart += 24 * 60
  return Math.round(ecart * 60 * 1000)
}

function rejouer(fichiers, decalageMs) {
  const resultat = spawnSync('npx', ['vitest', 'run', ...fichiers], {
    cwd: RACINE,
    env: { ...process.env, DECALAGE_MS: String(decalageMs) },
    encoding: 'utf8',
  })
  const sortie = (resultat.stdout ?? '') + (resultat.stderr ?? '')
  /* « aucun fichier trouvé » est un VERT PAR VACUITÉ, et il s'est produit : un
     filtre qui ne désigne rien rend zéro échec. On le traite comme une panne. */
  if (/No test files found/.test(sortie)) return { etat: 'vide', sortie }
  return { etat: resultat.status === 0 ? 'vert' : 'rouge', sortie }
}

/* ────────────────────────────── le témoin ────────────────────────────────── */

/**
 * UN CAS FABRIQUÉ, DONT ON SAIT QU'IL DÉPEND DE L'HEURE.
 *
 * Sans lui, « aucune rougeur » et « je ne sais pas rougir » s'écrivent pareil —
 * et la première rédaction de cette recherche a rendu le second en croyant dire
 * le premier. Le témoin porte deux fixtures espacées d'une heure et compare leur
 * ordre : il DOIT rougir au moins une fois sur les frontières qu'il déclare, et
 * rester vert à midi de son propre écart.
 *
 * Il est écrit puis effacé — il ne rejoint pas la suite, dont il ferait un cas
 * rouge une heure par jour.
 */
const TEMOIN = join(RACINE, 'src/test/temoinDHorlogeGeneres.test.ts')
const SOURCE_DU_TEMOIN = `import { it, expect } from 'vitest'
/* Fichier ÉCRIT PUIS EFFACÉ par scripts/horloge-sans-influence.mjs. */
const A = new Date('2026-08-19T09:00:00.000Z')
const B = new Date('2026-08-19T10:00:00.000Z')
const jours = (d: Date) => Math.round((Date.now() - d.getTime()) / 3600000 / 24)
it('les deux fixtures s’arrondissent au même jour', () => {
  expect(jours(A)).toBe(jours(B))
})
`

function poserLeTemoin() {
  writeFileSync(TEMOIN, SOURCE_DU_TEMOIN, 'utf8')
}
function retirerLeTemoin() {
  if (existsSync(TEMOIN)) unlinkSync(TEMOIN)
}

/* ─────────────────────────────── la porte ────────────────────────────────── */

const maintenant = new Date()
const tous = fichiersDeCas(join(RACINE, 'src'))
const dates = tous
  .map((chemin) => ({ chemin, moments: momentsDatesDe(chemin) }))
  .filter(({ moments }) => moments.size > 0)

const plaintes = []

if (dates.length !== FICHIERS_DATES_ATTENDUS) {
  plaintes.push(
    `${dates.length} fichier(s) de cas daté(s) pour ${FICHIERS_DATES_ATTENDUS} attendu(s).\n` +
      '   Un cas daté de plus doit être rejoué ; un de moins, et la porte a cessé de regarder.',
  )
}

/* On groupe par FRONTIÈRE : chaque bascule ne rejoue que les fichiers qu'elle
   concerne, au lieu de rejouer les trente-cinq dix fois. */
const parFrontiere = new Map()
for (const { chemin, moments } of dates) {
  for (const moment of moments) {
    const frontiere = (moment + DEMI_JOUR_EN_MINUTES + APRES_LA_BASCULE_EN_MINUTES) % (24 * 60)
    if (!parFrontiere.has(frontiere)) parFrontiere.set(frontiere, new Set())
    parFrontiere.get(frontiere).add(relative(RACINE, chemin))
  }
}

const frontieres = [...parFrontiere.keys()].sort((a, b) => a - b)
const releve = []

try {
  /* LE TÉMOIN D'ABORD : une porte qui ne sait pas rougir ne mesure rien. */
  poserLeTemoin()
  /*
    LA FRONTIÈRE DE LA PLUS ANCIENNE DES DEUX, ET C'EST TOUT LE POINT.

    Première rédaction : celle de 10 h, soit 22 h 01. À cette heure-là les DEUX
    fixtures ont basculé, elles s'arrondissent de nouveau au même jour, et le
    témoin restait vert — muet, donc, en croyant mesurer. La fenêtre s'ouvre à la
    bascule de la PLUS ANCIENNE (9 h → 21 h 01) et se referme à celle de l'autre.

    C'est aussi ce qui rend la méthode complète : on échantillonne la frontière
    de CHAQUE fixture, donc celle qui ouvre chaque fenêtre.
  */
  const frontiereDuTemoin = (9 * 60 + DEMI_JOUR_EN_MINUTES + APRES_LA_BASCULE_EN_MINUTES) % (24 * 60)
  const dedans = rejouer(['src/test/temoinDHorlogeGeneres.test.ts'], decalageVers(frontiereDuTemoin, maintenant))
  const dehors = rejouer(
    ['src/test/temoinDHorlogeGeneres.test.ts'],
    decalageVers((frontiereDuTemoin + 6 * 60) % (24 * 60), maintenant),
  )
  if (dedans.etat !== 'rouge' || dehors.etat !== 'vert') {
    plaintes.push(
      `TÉMOIN MUET : dans la fenêtre → ${dedans.etat}, hors de la fenêtre → ${dehors.etat}.\n` +
        '   On attend rouge puis vert. La sonde d’horloge ne mord plus, et tout vert\n' +
        '   rendu ci-dessous ne vaudrait rien — c’est exactement le faux vert qu’une\n' +
        '   grille trop lâche avait rendu le 2026-09-29.',
    )
  }
} finally {
  retirerLeTemoin()
}

if (plaintes.length === 0) {
  for (const frontiere of frontieres) {
    const fichiers = [...parFrontiere.get(frontiere)]
    const decalage = decalageVers(frontiere, maintenant)
    const { etat, sortie } = rejouer(fichiers, decalage)
    const heure = `${String(Math.floor(frontiere / 60)).padStart(2, '0')}:${String(frontiere % 60).padStart(2, '0')}`
    releve.push({ heure, fichiers: fichiers.length, etat })
    if (etat === 'vide') {
      plaintes.push(
        `${heure} UTC : aucun cas trouvé pour ${fichiers.length} fichier(s) désigné(s).\n` +
          '   Absence d’exécution, et non absence de défaut : la garde refuse.',
      )
    } else if (etat === 'rouge') {
      const echecs = sortie
        .split('\n')
        .filter((ligne) => /FAIL |AssertionError/.test(ligne))
        .slice(0, 4)
      plaintes.push(
        `${heure} UTC : ${fichiers.length} fichier(s) rejoué(s), et un cas rougit à cette heure-là.\n` +
          '   Son verdict dépend de l’horloge : il passera ici et refusera en intégration.\n' +
          echecs.map((l) => '     ' + l.trim()).join('\n'),
      )
    }
  }
}

for (const r of releve) {
  console.log(`  ${r.heure} UTC   ${String(r.fichiers).padStart(2)} fichier(s)   ${r.etat}`)
}

if (plaintes.length > 0) {
  console.error(`\n✗ horloge-sans-influence : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ horloge-sans-influence : ${dates.length} fichiers datés rejoués sur ${frontieres.length} frontière(s).\n` +
    '  Témoin passé : la sonde rougit dans la fenêtre et se tait dehors.\n' +
    '  Ce script ne connaît QUE l’arrondi de `relatif()` — voir son en-tête.',
)
