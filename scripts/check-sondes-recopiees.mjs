#!/usr/bin/env node
/**
 * UN BLOC RECOPIÉ DANS PLUSIEURS SONDES DOIT RESTER IDENTIQUE.
 *
 * ═══ POURQUOI IL Y A DES COPIES, ET POURQUOI ON NE PEUT PAS LES SUPPRIMER ═══
 *
 * `page.evaluate(fn)` SÉRIALISE LA FONCTION et rien d'autre : la source part
 * dans le navigateur, où aucune variable de Node n'existe. Une aide partagée en
 * portée de module lèverait un `ReferenceError` dans la page — l'en-tête de
 * `sondes-de-rendu.mjs` le dit depuis sa naissance, et c'est pour cela que
 * `blocConteneurDe` est écrit trois fois, une par sonde qui en a besoin.
 *
 * La duplication est donc une contrainte, pas un choix. Ce qui reste un choix,
 * c'est de la laisser DIVERGER en silence.
 *
 * ═══ CE QUE CETTE GARDE EXISTE POUR EMPÊCHER, ET CE N'EST PAS THÉORIQUE ═══
 *
 * Le 2026-09-10, une mutation destinée à éprouver trois témoins n'a touché
 * qu'UNE des trois copies — l'outil remplace la première occurrence. Résultat :
 * un seul témoin sur trois a rougi, et les deux autres passaient par une copie
 * intacte en donnant l'apparence d'un vert.
 *
 * C'était une mutation, donc sans conséquence. Le même geste sur un CORRECTIF
 * laisserait deux sondes sur trois avec l'ancienne règle, et rien ne le dirait :
 * les portes resteraient vertes, chacune mesurant avec sa propre version.
 *
 * ═══ CE QU'ELLE VÉRIFIE ═══
 *
 * Les copies sont bornées dans la source par deux marques. Cette garde les
 * extrait, exige qu'il y en ait exactement autant que déclaré ici, et que leur
 * texte soit identique AU CARACTÈRE PRÈS — indentation et commentaires
 * compris, puisque c'est exactement ce qui part dans la page.
 *
 * ═══ CE QU'ELLE NE VÉRIFIE PAS ═══
 *
 * Que le bloc soit JUSTE. Trois copies identiques d'une règle fausse passent
 * ici sans un mot ; ce sont les témoins de `temoins-de-sonde.mjs` qui tiennent
 * ce bout-là, et le banc traverse les trois sondes.
 *
 * Elle ne voit pas non plus une aide recopiée SANS marques : elle garde ce
 * qu'on lui a déclaré. Une quatrième sonde qui recopierait le bloc sans le
 * borner ferait tomber le compte, ce qui est le seul signal qu'elle sait rendre.
 *
 *   node scripts/check-sondes-recopiees.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const FICHIER = 'scripts/sondes-de-rendu.mjs'

const DEBUT = '/* ═══ COPIE SURVEILLÉE : blocConteneurDe ═══'
const FIN = '/* ═══ FIN DE LA COPIE SURVEILLÉE ═══ */'

/*
  LE COMPTE EST ÉCRIT, JAMAIS DÉDUIT DU FICHIER.

  Le déduire rendrait la garde d'accord avec elle-même : retirer deux copies, et
  elle comparerait une copie à elle-même puis se déclarerait verte. Ce dépôt a
  trouvé ce piège cinq fois — voir `plafond-coquille`, `espace-connecte`.

  3 = `RELEVER_LES_CLOTURES_PERMEABLES`, `RELEVER_LES_EVADES` et
  `MESURER_DEFILEMENT_LATERAL`, les trois sondes qui remontent un bloc conteneur.
*/
const COPIES_ATTENDUES = 3

const source = readFileSync(join(RACINE, FICHIER), 'utf8')

const copies = []
let curseur = 0
for (;;) {
  const debut = source.indexOf(DEBUT, curseur)
  if (debut === -1) break
  const fin = source.indexOf(FIN, debut)
  if (fin === -1) {
    console.error(
      `\n✗ check-sondes-recopiees : une copie ouverte à l'indice ${debut} n'est jamais fermée.\n` +
        `  La marque de fin est « ${FIN} ».\n`,
    )
    exit(1)
  }
  copies.push(source.slice(debut + DEBUT.length, fin))
  curseur = fin + FIN.length
}

const plaintes = []

if (copies.length !== COPIES_ATTENDUES) {
  plaintes.push(
    `${copies.length} copie(s) surveillée(s) pour ${COPIES_ATTENDUES} déclarée(s) dans ${FICHIER}.\n` +
      "   Si le compte a MONTÉ, une sonde recopie le bloc : inscrivez-la ici. S'il a\n" +
      '   DESCENDU, une sonde a perdu sa copie — ou ses marques, et elle n’est alors plus\n' +
      '   gardée du tout, ce qui se lit exactement comme « aucune divergence ».',
  )
}

/* La première copie est la référence : on ne cherche pas laquelle a raison —
   cette garde ne sait pas juger le contenu —, seulement qu'elles s'accordent. */
for (let i = 1; i < copies.length; i++) {
  if (copies[i] === copies[0]) continue
  const lignesA = copies[0].split('\n')
  const lignesB = copies[i].split('\n')
  const premiere = lignesA.findIndex((l, n) => l !== lignesB[n])
  plaintes.push(
    `la copie nº${i + 1} de \`blocConteneurDe\` DIVERGE de la première.\n` +
      `   première différence, ligne ${premiere + 1} du bloc :\n` +
      `      nº1 : ${JSON.stringify(lignesA[premiere] ?? '(absente)')}\n` +
      `      nº${i + 1} : ${JSON.stringify(lignesB[premiere] ?? '(absente)')}\n` +
      '   Deux sondes mesurent alors avec deux règles, et les portes restent vertes :\n' +
      '   chacune a raison selon sa propre version.',
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ check-sondes-recopiees : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `✓ check-sondes-recopiees : ${copies.length} copies de \`blocConteneurDe\` identiques ` +
    'au caractère près.\n' +
    "  Elle ne dit RIEN de leur justesse — c'est le banc des témoins qui la tient.",
)
