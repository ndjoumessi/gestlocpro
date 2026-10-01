#!/usr/bin/env node
/**
 * LA COLONNE NORMALE A-T-ELLE ÉTÉ REVÉRIFIÉE SUR CE CODE ?
 *
 * Le pendant de `sceau-colonne-normale.mjs`, et son en-tête porte le pourquoi :
 * cinq portes gardent une colonne de plafonds que SEULE la machine de
 * développement peut mesurer, et rien ne la regardait entre deux passages à la
 * main. Vingt-neuf pixels de mou avaient traversé un nombre inconnu de lots.
 *
 * ═══ POURQUOI CE SCRIPT VIT DANS `check:rapide` ═══
 *
 * Parce que `rapide` tourne PARTOUT — sur le poste comme sur l'exécuteur — et
 * qu'il ne rend rien : il lit des fichiers et compare un condensat. Le mettre
 * dans `check:navigateur` l'aurait rendu aussi rare que ce qu'il surveille.
 *
 * C'est la seule porte de ce dépôt qui vérifie le TRAVAIL plutôt que le produit.
 * Elle ne dit pas « cet écran est trop haut » : elle dit « personne n'a regardé ».
 *
 * ═══ CE QU'ELLE COÛTE, ET À QUI ═══
 *
 * RIEN à un lot qui ne touche pas au rendu : l'empreinte ne bouge pas.
 * RIEN à un lot qui le touche et suit la doctrine : la chaîne au navigateur
 * était déjà due, et elle pose le sceau en finissant.
 * TOUT à un lot qui prétend avoir mesuré sans l'avoir fait, et c'est le but.
 *
 * SUR UNE MACHINE ÉTRANGÈRE, elle refuse sans recours — le sceau ne peut pas y
 * être posé. Le message le dit en toutes lettres plutôt que de laisser chercher.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'
/* LE MODULE PUR, JAMAIS LE SCELLEUR : son en-tête raconte ce que l'import du
   scelleur a coûté — la vérification reposait le sceau et ne pouvait plus rougir. */
import { CHEMIN_DU_SCEAU, RACINE, empreinteDesSources } from './colonne-normale.mjs'

const RELANCER =
  '   Lancez `npm run build && npm run check:navigateur` sur la machine qui possède\n' +
  '   la colonne normale : sa dernière étape repose le sceau, à committer avec le lot.'

let sceau
try {
  sceau = JSON.parse(readFileSync(join(RACINE, CHEMIN_DU_SCEAU), 'utf8'))
} catch {
  console.error(
    `\n✗ sceau : ${CHEMIN_DU_SCEAU} est absent ou illisible.\n` +
      '   La colonne normale des cinq portes à deux colonnes n’est donc attestée\n' +
      '   par rien, et son mou peut croître sans que personne ne le voie.\n' +
      RELANCER +
      '\n',
  )
  exit(1)
}

const { empreinte, fichiers } = empreinteDesSources()

if (sceau.empreinte !== empreinte) {
  console.error(
    '\n✗ sceau : les sources de rendu ont changé depuis la dernière vérification\n' +
      '   de la COLONNE NORMALE.\n\n' +
      `   scellé le  : ${sceau.mesureLe ?? '(inconnu)'} sur ${sceau.fichiers ?? '?'} fichier(s)\n` +
      `   aujourd’hui : ${fichiers} fichier(s)\n\n` +
      '   Ce n’est pas un défaut du produit : c’est une mesure qui manque. La colonne\n' +
      '   imposée est vérifiée à chaque poussée par l’intégration continue ; la colonne\n' +
      '   normale, elle, n’existe que sur une machine, et rien d’autre ne la regarde.\n' +
      RELANCER +
      '\n',
  )
  exit(1)
}

console.log(
  `✓ sceau : la colonne normale a été vérifiée sur ces ${fichiers} fichier(s) de rendu,\n` +
    `  le ${sceau.mesureLe ?? '(date absente)'}.`,
)
