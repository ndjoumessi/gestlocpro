#!/usr/bin/env node
/**
 * LE POIDS DE L'ANGLAIS, ET CE QU'AUCUNE AUTRE PORTE NE MESURE.
 *
 * ═══ LE TROU QUE CE FICHIER FERME ═══
 *
 * Deux lots du 2026-10-10 ont scindé le dictionnaire anglais en trois moitiés :
 * `en.ts` part avec la vitrine, `en-app.ts` avec les écrans de gestion,
 * `en-legal.ts` avec les trois pages juridiques. Le visiteur anglais de la
 * vitrine est passé de 36 609 à 7 992 octets compressés.
 *
 * AUCUNE PORTE NE TENAIT CE GAIN. `poids-ecrans` sonde `/` et `/demo` au
 * navigateur, en FRANÇAIS — l'anglais n'y apparaît jamais. Le budget de premier
 * chargement pèse le paquet d'entrée, dont l'anglais est absent par
 * construction. Il ne restait que des gardes de SOURCE — « la barrique
 * n'importe pas `en-legal` » — qui disent la forme du code, pas le poids livré.
 * Les deux chiffres ci-dessus venaient d'un `gzip -c` lancé à la main, et rien
 * ne les aurait redits le jour où ils auraient cessé d'être vrais.
 *
 * ═══ DEUX FAUTES DISTINCTES, DEUX TRAITEMENTS ═══
 *
 * LA FUSION est exacte et ne se négocie pas. Un import statique qui ramènerait
 * `en-app` dans le morceau de la vitrine anglaise défait la scission d'un coup ;
 * le seuil de taille minimale de morceau de `vite.config.ts` pourrait en
 * absorber une en silence. Deux moitiés dans un même morceau sont un REFUS, et
 * aucun motif ne le relâche — il n'y a pas de `--relever` pour ça.
 *
 * LA CROISSANCE se négocie. Un lot qui ajoute vingt libellés anglais fait
 * grossir `en.ts` légitimement. C'est un cliquet : `--inscrire` ne descend
 * jamais, `--relever "motif"` écrit le prix dans le fichier, donc dans le diff,
 * donc sous les yeux du relecteur. La même discipline que `poids-ecrans`.
 *
 * ═══ LES MOITIÉS SE LISENT SUR LE DISQUE ═══
 *
 * Et non dans une liste écrite ici. Ce dépôt a déjà payé une liste au singulier
 * — `moduleReserveALaLangueParesseuse` rendait le premier `import()` et lui
 * seul, donc une moitié ajoutée serait passée inaperçue. Une quatrième moitié,
 * le jour où elle existera, sera pesée d'office.
 *
 * ═══ UN CLIQUET À MAIN, ET IL SE RÉINSCRIT AVANT LA CHAÎNE ═══
 *
 * Comme `poids-ecrans`, dont il partage la discipline : il REFUSE une hausse
 * plutôt que de la rapporter, et c'est à l'auteur du lot de l'inscrire. Il est
 * la VINGTIÈME porte sur vingt-quatre de `check:navigateur` — l'apprendre là
 * coûte la chaîne entière à refaire. `poids-ecrans` porte le même
 * avertissement, et ce dépôt a payé l'oubli le 2026-10-05.
 *
 *     npm run build                                    (il mesure le PAQUET)
 *     node scripts/poids-anglais.mjs --inscrire        (si rien ne monte)
 *     node scripts/poids-anglais.mjs --relever "…"     (si quelque chose monte)
 *
 * ═══ CE QU'IL NE MESURE PAS ═══
 *
 * Le TEMPS. Il pèse des octets compressés, pas des millisecondes, et il ignore
 * le nombre de requêtes — `poids-ecrans` tient ce registre-là, en français.
 * Il ne dit rien non plus de ce qu'un visiteur anglais télécharge RÉELLEMENT :
 * il mesure les morceaux, pas une visite. Un morceau qui cesserait d'être
 * demandé passerait pour un gain, à tort.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'

const RACINE = new URL('..', import.meta.url).pathname
const RELEVE = join(RACINE, 'scripts/poids-anglais.json')
const CARTE = join(RACINE, '.carte-des-paquets.json')

exigerUnPaquetAJour()

/** Les moitiés anglaises, lues sur le disque — jamais recopiées. */
function moitiesAnglaises() {
  return readdirSync(join(RACINE, 'src/i18n'))
    .filter((f) => /^en.*\.ts$/.test(f) && !f.includes('.test.'))
    .map((f) => 'i18n/' + f)
    .sort()
}

const moities = moitiesAnglaises()
const carte = JSON.parse(readFileSync(CARTE, 'utf8'))

/*
  ZÉRO MOITIÉ EST UN REFUS. La même absence signe deux choses opposées : la
  scission défaite, ou une marche qui ne lit plus le dossier. Une porte qui ne
  mesure rien rend « aucun défaut ».
*/
if (moities.length === 0) {
  console.error(
    '✗ poids anglais — aucune moitié trouvée dans src/i18n/.\n' +
      "   Soit le dictionnaire anglais a changé de nom, soit la lecture est cassée.",
  )
  process.exit(1)
}

const refus = []
const pesees = []
const morceauDe = new Map()

for (const moitie of moities) {
  const entree = Object.entries(carte).find(([, info]) => info.modules.includes(moitie))
  if (!entree) {
    refus.push(`${moitie} n'apparaît dans AUCUN morceau du paquet construit.`)
    continue
  }
  const [nomDuMorceau, info] = entree

  if (!info.isDynamicEntry) {
    refus.push(
      `${moitie} vit dans \`${nomDuMorceau}\`, qui n'est PAS une entrée dynamique — ` +
        `ces mots partent donc avec le paquet d'entrée, chez des visiteurs français.`,
    )
    continue
  }

  const deja = morceauDe.get(nomDuMorceau)
  if (deja) {
    refus.push(
      `${moitie} et ${deja} partagent le morceau \`${nomDuMorceau}\`. La scission est ` +
        `défaite : qui télécharge l'une télécharge l'autre. Aucun motif ne relâche ce ` +
        `refus — chercher un import statique, ou le seuil de taille minimale de morceau ` +
        `de vite.config.ts, qui a pu l'absorber.`,
    )
    continue
  }
  morceauDe.set(nomDuMorceau, moitie)

  const octets = gzipSync(readFileSync(join(RACINE, 'dist', nomDuMorceau)), { level: 9 }).length
  pesees.push({ moitie, morceau: nomDuMorceau, octets })
}

/*
  ═══ ET AUCUNE MOITIÉ N'EN RÉCLAME UNE AUTRE ═══

  CE CONTRÔLE MANQUAIT, et c'est une mutation qui l'a dit. Le premier jet
  vérifiait qu'une moitié vit dans son propre morceau — ce qui est nécessaire et
  PAS suffisant. Un `import './en-legal'` posé dans `en.ts` ne fusionne rien :
  Rollup garde deux morceaux, et fait IMPORTER l'un par l'autre. La structure
  restait conforme, la porte verte, et le visiteur anglais de la vitrine
  téléchargeait les deux.

  On suit donc la fermeture des imports STATIQUES. Un `import()` dynamique n'est
  pas suivi : c'est exactement la frontière qu'on veut, et il ne tire rien tant
  que personne ne l'appelle.
*/
const morceauxDesMoities = new Map([...morceauDe].map(([m, moitie]) => [m, moitie]))

for (const { moitie, morceau } of pesees) {
  const vus = new Set()
  const file = [...(carte[morceau]?.imports ?? [])]
  while (file.length > 0) {
    const suivant = file.shift()
    if (!suivant || vus.has(suivant)) continue
    vus.add(suivant)
    const autre = morceauxDesMoities.get(suivant)
    if (autre && autre !== moitie) {
      refus.push(
        `${moitie} tire ${autre} par un import STATIQUE (\`${morceau}\` → \`${suivant}\`). ` +
          `Les deux morceaux sont distincts, mais qui télécharge le premier télécharge ` +
          `le second : la scission ne gagne plus rien. Remplacer l'import par un ` +
          `\`import()\`, ou sortir la clé partagée dans une section impatiente.`,
      )
    }
    file.push(...(carte[suivant]?.imports ?? []))
  }
}

if (refus.length > 0) {
  console.error(`✗ poids anglais — ${refus.length} refus de structure :\n`)
  for (const r of refus) console.error(`  ${r}`)
  process.exit(1)
}

const releve = existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, 'utf8')) : null
const argument = process.argv[2]
const motif = process.argv[3]

function ecrire(plafonds, motifEcrit) {
  writeFileSync(
    RELEVE,
    JSON.stringify(
      {
        _lisezMoi: [
          "Poids compressé de chaque moitié du dictionnaire anglais, morceau par morceau.",
          "`--inscrire` ne fait que DESCENDRE. Une hausse se grave par",
          "`--relever \"ce que le poids achète\"`, et le motif entre dans le diff.",
          "La structure — une moitié par morceau, tous en entrée dynamique — est un refus",
          "exact, que ce fichier ne peut pas relâcher.",
        ],
        plafonds,
        motif: motifEcrit,
      },
      null,
      1,
    ) + '\n',
  )
}

if (argument === '--relever') {
  if (!motif || motif.trim().length < 20) {
    console.error(
      "✗ poids anglais — `--relever` exige un motif d'au moins vingt signes.\n" +
        "   Il entre dans le fichier, donc dans le diff, donc sous les yeux du relecteur.",
    )
    process.exit(1)
  }
  ecrire(Object.fromEntries(pesees.map((p) => [p.moitie, p.octets])), motif)
  console.log(`✓ poids anglais — ${pesees.length} plafond(s) relevé(s) — « ${motif} »`)
  process.exit(0)
}

if (argument === '--inscrire') {
  const montent = releve
    ? pesees.filter((p) => (releve.plafonds[p.moitie] ?? Infinity) < p.octets)
    : []
  if (montent.length > 0) {
    console.error('✗ poids anglais — `--inscrire` ne fait que descendre :\n')
    for (const p of montent)
      console.error(`  ▸ ${p.moitie} : ${releve.plafonds[p.moitie]} → ${p.octets} o`)
    console.error("\n  Si ce poids est le prix de quelque chose, dites-le :\n" +
      '    node scripts/poids-anglais.mjs --relever "ce que le poids achète"')
    process.exit(1)
  }
  const plafonds = Object.fromEntries(
    pesees.map((p) => [p.moitie, Math.min(p.octets, releve?.plafonds[p.moitie] ?? Infinity)]),
  )
  ecrire(plafonds, releve?.motif ?? null)
  console.log(`✓ poids anglais — ${pesees.length} plafond(s) inscrit(s).`)
  process.exit(0)
}

if (!releve) {
  console.error(
    '✗ poids anglais — aucun relevé. Personne n’a encore pesé les moitiés anglaises.\n' +
      '   node scripts/poids-anglais.mjs --inscrire',
  )
  process.exit(1)
}

const depassements = pesees.filter((p) => p.octets > (releve.plafonds[p.moitie] ?? -1))
const nouvelles = pesees.filter((p) => releve.plafonds[p.moitie] === undefined)

if (nouvelles.length > 0) {
  console.error(`✗ poids anglais — ${nouvelles.length} moitié(s) jamais pesée(s) :\n`)
  for (const p of nouvelles) console.error(`  ▸ ${p.moitie} : ${p.octets} o`)
  console.error('\n  node scripts/poids-anglais.mjs --relever "ce que cette moitié achète"')
  process.exit(1)
}

if (depassements.length > 0) {
  console.error(`✗ poids anglais — ${depassements.length} moitié(s) au-dessus du plafond :\n`)
  for (const p of depassements)
    console.error(
      `  ▸ ${p.moitie} : ${releve.plafonds[p.moitie]} → ${p.octets} o (+${p.octets - releve.plafonds[p.moitie]})`,
    )
  console.error(
    "\n  Un visiteur anglais télécharge ces octets. S'ils achètent quelque chose, dites-le :\n" +
      '    node scripts/poids-anglais.mjs --relever "ce que le poids achète"',
  )
  process.exit(1)
}

const total = pesees.reduce((n, p) => n + p.octets, 0)
console.log(
  `✓ poids anglais — ${pesees.length} moitié(s), chacune dans son morceau, ${total} o compressés en tout :`,
)
for (const p of pesees) console.log(`    ${p.moitie.padEnd(18)} ${String(p.octets).padStart(6)} o`)
