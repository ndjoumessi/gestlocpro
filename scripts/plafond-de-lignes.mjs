#!/usr/bin/env node
/**
 * LE PLAFOND DE 800 LIGNES PAR FICHIER DE SOURCE, ET SON CLIQUET.
 *
 * POURQUOI CETTE PORTE EXISTE, ET CE QUI L'A FAIT ÉCRIRE. Le 2026-10-02, un lot
 * a sorti 6 774 lignes de `mesure-ui.mjs` vers neuf fichiers — dont un de
 * 1 191 lignes. Trois chaînes vertes, CI verte, déploiement vert : rien, nulle
 * part, n'a dit qu'un module livré dépassait de 49 % le plafond que la règle du
 * dépôt écrit noir sur blanc. Il a fallu que je recompte les fichiers à la main
 * trois jours plus tard pour le voir. Une règle que seule une relecture humaine
 * applique n'est pas une règle, c'est une intention.
 *
 * CE QU'ELLE REFUSE. Cinq choses, et aucune n'est un jugement sur la qualité :
 *
 *   1. UN NOUVEAU FAUTIF. Un fichier passe 800 lignes sans être au relevé. C'est
 *      le refus principal : il rend impossible de livrer un `mesures-navigateur`
 *      de 1 191 lignes sans qu'une porte le dise.
 *   2. UN FAUTIF QUI GROSSIT SANS QUE LE RELEVÉ SUIVE. Noter : la croissance
 *      n'est pas interdite, elle doit être ÉCRITE. `--inscrire` la grave sans
 *      exiger de phrase, et c'est le nombre dans le diff qui porte le signal.
 *
 *      LA PREMIÈRE RÉDACTION EXIGEAIT UN MOTIF ÉCRIT ICI, et un jour d'usage
 *      l'a réfutée. Mesuré le 2026-10-05 sur trois fichiers de natures
 *      différentes : `src/i18n/fr.ts` a grossi dans 14 des 15 derniers lots qui
 *      le touchent (3 470 → 4 036), `routes.test.ts` dans 6 des 8 derniers
 *      (6 884 → 7 102), `AppShell.tsx` dans 6 des 8 (2 705 → 2 865). Un motif
 *      réclamé à chaque lot devient une formule en une semaine, et une formule
 *      est PIRE que rien : elle apprend au relecteur à sauter la ligne, ce qui
 *      détruit le mécanisme là où il compte. Le motif est donc réservé au seul
 *      geste qui mérite une phrase — franchir 800 pour la première fois.
 *   3. UN FAUTIF QUI MAIGRIT SANS QUE LE RELEVÉ SUIVE. C'est le refus qui
 *      distingue cette porte de `poids-ecrans`, et il est écrit contre une
 *      faute mesurée : `poids-ecrans` RAPPORTE une hausse sans l'arrêter, et
 *      136 341 octets sont restés non inscrits pendant trois semaines, si bien
 *      que le cumul de huit lots s'est lu comme l'effet du lot en cours. Un
 *      cliquet qui ne se resserre pas glisse. Un gain non inscrit est donc
 *      REFUSÉ, et la porte imprime le nombre exact à écrire.
 *   4. UN FAUTIF QUI REPASSE SOUS LE PLAFOND. Il quitte le relevé. Sinon la
 *      dette se lirait éternellement comme plus lourde qu'elle n'est.
 *   5. UNE ENTRÉE ORPHELINE. Le relevé nomme un fichier qui n'existe plus —
 *      renommé ou supprimé. Une dette qui désigne le vide ne garde rien.
 *
 * CE QU'ELLE NE PROUVE PAS, ET IL FAUT LE DIRE. Rien sur la COHÉSION. Un
 * fichier de 799 lignes qui mélange quatre sujets la passe ; cinq fichiers de
 * 160 lignes découpés au hasard la passent aussi. Le nombre de lignes est un
 * indice grossier, et le choix de ce dépôt est explicite : le 2026-10-02, un
 * découpage « par cohésion » a été préféré à un découpage « sous 800 coûte que
 * coûte ». Cette porte sert ce choix — elle empêche d'EMPIRER, elle ne commande
 * pas de découper. `mesure-ui.mjs` reste au relevé à 3 883 lignes, et c'est
 * assumé : ce qui y reste est une boucle de mesure sans frontière naturelle.
 *
 * LE RELEVÉ N'APPROUVE RIEN. `plafonds-de-lignes.json` est une photographie de
 * la dette du 2026-10-05, pas une liste de dispenses méritées. Les deux
 * dictionnaires d'i18n et les deux suites de tests y sont au même titre que le
 * reste : la règle du dépôt admet qu'un fichier de test ou de données dépasse
 * quand son rôle le justifie, mais « justifié » ne veut pas dire « libre de
 * grossir ». Ici personne n'est dispensé du cliquet.
 *
 * AUCUN `export`, ET C'EST DÉLIBÉRÉ. `confronter` est pure et serait tentante à
 * importer depuis un test — mais importer un script de `scripts/` L'EXÉCUTE,
 * règle payée dans ce dépôt par un vérificateur de sceau qui reposait le sceau
 * qu'il vérifiait. Je viens de l'éprouver une fois de plus en écrivant cette
 * porte : un `import` de `confronter` a imprimé le verdict complet deux fois.
 * Le témoin vit donc DEDANS et s'exécute à chaque lancement — on ne peut ni
 * l'oublier ni le contourner, ce qu'une suite séparée ne garantit pas.
 *
 *   node scripts/plafond-de-lignes.mjs                    · vérifie
 *   node scripts/plafond-de-lignes.mjs --inscrire         · resserre au réel
 *   node scripts/plafond-de-lignes.mjs --relever "motif"  · desserre, motif écrit
 *
 * LE CLIQUET, ET POURQUOI DEUX GESTES. `--inscrire` ne fait que DESCENDRE un
 * plafond ou retirer une entrée retombée sous 800. Il ne peut jamais graver le
 * gonflement du jour : sinon un `--inscrire` distrait rendrait la porte verte
 * pour toujours, ce qui est exactement la faute de `poids-ecrans`. Desserrer
 * exige `--relever "motif"`, et le motif est GRAVÉ À CÔTÉ de la valeur avec
 * l'ancienne — un relecteur lit une phrase, pas un nombre qui a changé seul.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit, argv } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const RELEVE = join(RACINE, 'scripts', 'plafonds-de-lignes.json')
const PLAFOND = 800
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.cjs']

/** Compte les lignes comme `wc -l` : le nombre de sauts de ligne. */
const compterLesLignes = (contenu) => {
  let n = 0
  for (let i = 0; i < contenu.length; i += 1) if (contenu[i] === '\n') n += 1
  return n
}

/**
 * LE PÉRIMÈTRE EST CELUI DE GIT, ET C'EST UN CHOIX MESURÉ. Une marche sur le
 * disque avec sa propre liste d'exclusions a rendu 82 fautifs là où le dépôt en
 * compte 38 : les 44 autres étaient le client Prisma de
 * `server/src/generated`, que `.gitignore:34` écarte déjà et que `prisma
 * generate` réécrit. Une porte dont le verdict dépend de qui a lancé la
 * génération de code ne garde rien. On demande donc à git ce que CE DÉPÔT
 * considère comme ses fichiers, plutôt que d'entretenir une seconde liste
 * d'exclusions qui divergera de `.gitignore`.
 *
 * `--others --exclude-standard` ajoute les fichiers NON ENCORE SUIVIS mais non
 * ignorés : sans eux, un fichier de 1 200 lignes écrit et pas encore `git add`
 * passerait la chaîne au vert, et ne rougirait qu'après l'avoir indexé — soit
 * précisément au moment où l'on ne relance plus les portes.
 */
const sourcesDuDepot = () =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((f) => f && EXTENSIONS.some((e) => f.endsWith(e)))
    .sort()

/**
 * LE CŒUR, PUR ET DONC TÉMOIGNABLE. Il ne lit aucun fichier : on lui donne les
 * longueurs mesurées et le relevé, il rend les refus. C'est ce qui permet au
 * témoin plus bas de prouver les cinq refus sans fabriquer de faux dépôt — la
 * leçon de `check-montants`, qui classe sa propre fixture avant de juger `src`.
 */
const confronter = (longueurs, releve) => {
  const refus = []
  for (const [fichier, lignes] of Object.entries(longueurs).sort()) {
    const inscrit = releve[fichier]
    if (lignes > PLAFOND && inscrit === undefined) {
      refus.push({
        genre: 'nouveau', fichier, lignes,
        dire: `${fichier} : ${lignes} lignes, plafond ${PLAFOND}, et pas au relevé.`,
      })
      continue
    }
    if (inscrit === undefined) continue
    if (lignes > inscrit) {
      refus.push({
        genre: 'grossit', fichier, lignes,
        dire: `${fichier} : ${inscrit} → ${lignes} lignes (+${lignes - inscrit}), croissance non inscrite.`,
      })
    } else if (lignes <= PLAFOND) {
      refus.push({
        genre: 'retombe', fichier, lignes,
        dire: `${fichier} : ${lignes} lignes, repassé sous ${PLAFOND} — à RETIRER du relevé.`,
      })
    } else if (lignes < inscrit) {
      refus.push({
        genre: 'maigrit', fichier, lignes,
        dire: `${fichier} : ${inscrit} → ${lignes} lignes (${lignes - inscrit}), gain non inscrit.`,
      })
    }
  }
  for (const fichier of Object.keys(releve).sort()) {
    if (longueurs[fichier] === undefined) {
      refus.push({
        genre: 'orpheline', fichier, lignes: 0,
        dire: `${fichier} : au relevé mais introuvable — renommé ou supprimé.`,
      })
    }
  }
  return { refus }
}

/* ═══ LE TÉMOIN ═══
   Une porte qui ne refuse rien le jour où elle naît ne prouve rien. Les cinq
   refus sont donc exercés ICI, sur des longueurs fabriquées, à chaque
   exécution : si `confronter` cesse de voir l'un des cinq, la porte s'arrête
   avant d'avoir regardé le dépôt. */
const TEMOIN_LONGUEURS = {
  'a/neuf.ts': 900,      // > plafond, absent du relevé        → nouveau
  'a/grossit.ts': 1200,  // inscrit à 1000                     → grossit
  'a/maigrit.ts': 900,   // inscrit à 1000, toujours > plafond → maigrit
  'a/retombe.ts': 700,   // inscrit à 1000, repassé dessous    → retombe
  'a/sage.ts': 400,      // sous le plafond, absent du relevé  → rien
  'a/tenu.ts': 1000,     // inscrit à 1000, inchangé           → rien
}
const TEMOIN_RELEVE = {
  'a/grossit.ts': 1000, 'a/maigrit.ts': 1000, 'a/retombe.ts': 1000,
  'a/tenu.ts': 1000, 'a/partie.ts': 1000,
}
const TEMOIN_ATTENDU = [
  'grossit:a/grossit.ts', 'maigrit:a/maigrit.ts', 'nouveau:a/neuf.ts',
  'retombe:a/retombe.ts', 'orpheline:a/partie.ts',
]
const temoin = confronter(TEMOIN_LONGUEURS, TEMOIN_RELEVE)
const obtenu = temoin.refus.map((r) => `${r.genre}:${r.fichier}`)
if (JSON.stringify(obtenu) !== JSON.stringify(TEMOIN_ATTENDU)) {
  console.error('✗ TÉMOIN du plafond de lignes : les refus ne sont plus ceux attendus.')
  console.error('  obtenu : ' + JSON.stringify(obtenu))
  console.error('  attendu: ' + JSON.stringify(TEMOIN_ATTENDU))
  exit(1)
}

const longueurs = {}
for (const fichier of sourcesDuDepot()) {
  if (!existsSync(join(RACINE, fichier))) continue
  longueurs[fichier] = compterLesLignes(readFileSync(join(RACINE, fichier), 'utf8'))
}
const brut = existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, 'utf8')) : {}
const releve = Object.fromEntries(
  Object.entries(brut.plafonds ?? {}).map(([f, v]) => [f, typeof v === 'number' ? v : v.lignes]),
)
const { refus } = confronter(longueurs, releve)

const iRelever = argv.indexOf('--relever')
if (argv.includes('--inscrire') || iRelever !== -1) {
  const motif = iRelever === -1 ? null : argv[iRelever + 1]
  if (iRelever !== -1 && !motif) {
    console.error('✗ --relever exige un motif écrit, entre guillemets.')
    exit(1)
  }
  const plafonds = { ...brut.plafonds }
  const faits = []
  for (const r of refus) {
    if (r.genre === 'maigrit' || r.genre === 'grossit') {
      const avant = releve[r.fichier]
      plafonds[r.fichier] = r.lignes
      const sens = r.genre === 'maigrit' ? 'resserré' : 'inscrit'
      faits.push(`${sens} ${r.fichier} : ${avant} → ${r.lignes}`)
    } else if (r.genre === 'retombe' || r.genre === 'orpheline') {
      delete plafonds[r.fichier]
      faits.push(`retiré ${r.fichier}`)
    } else if (motif) {
      const avant = releve[r.fichier]
      plafonds[r.fichier] = {
        lignes: r.lignes, motif,
        ...(avant === undefined ? {} : { avant }),
        le: new Date().toISOString().slice(0, 10),
      }
      faits.push(`desserré ${r.fichier} à ${r.lignes} — « ${motif} »`)
    }
  }
  if (!faits.length) {
    console.log('✓ plafond de lignes : rien à écrire, le relevé est déjà au réel.')
    exit(0)
  }
  writeFileSync(RELEVE, JSON.stringify({ ...brut, plafonds }, null, 1) + '\n')
  console.log(`✓ plafond de lignes : relevé réécrit.\n` + faits.map((f) => '  ' + f).join('\n'))
  console.log('  scripts/plafonds-de-lignes.json — à committer avec le lot.')
  exit(0)
}

if (refus.length) {
  const parGenre = refus.reduce((a, r) => ({ ...a, [r.genre]: (a[r.genre] ?? 0) + 1 }), {})
  console.error(`✗ plafond de lignes : ${refus.length} refus — ` +
    Object.entries(parGenre).map(([g, n]) => `${n} ${g}`).join(', ') + '\n')
  for (const r of refus) console.error('  ▸ ' + r.dire)
  if (refus.some((r) => r.genre === 'grossit')) {
    console.error('\n  Une croissance se grave par `node scripts/plafond-de-lignes.mjs --inscrire` :\n' +
      "  elle n'est pas interdite, elle doit être ÉCRITE, et le nombre du diff suffit.")
  }
  if (refus.some((r) => r.genre === 'nouveau')) {
    console.error('\n  FRANCHIR 800 POUR LA PREMIÈRE FOIS est le seul geste qui exige une phrase :\n' +
      '  `--relever "motif"`, et le motif reste dans le diff.')
  }
  exit(1)
}
const dettes = Object.keys(releve).length
console.log(`✓ plafond de lignes : ${Object.keys(longueurs).length} fichiers de source sous ` +
  `${PLAFOND} lignes, hors ${dettes} dette(s) inscrite(s) dont aucune n'a grossi.`)
console.log('  Il ne dit RIEN de la COHÉSION : 799 lignes mêlant quatre sujets passent — voir son en-tête.')
