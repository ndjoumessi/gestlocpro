#!/usr/bin/env node
/**
 * LE SCEAU DE LA COLONNE NORMALE — ce qui PROUVE qu'elle a été revérifiée.
 *
 * ═══ LE TROU QU'IL FERME, ET IL EST MESURÉ ═══
 *
 * Cinq portes de ce dépôt portent DEUX colonnes de plafonds : l'une mesurée
 * sous la police imposée par `police-large.mjs`, l'autre sous la police que la
 * machine met NATIVEMENT derrière `system-ui`.
 *
 * La première est reproductible partout : Verdana est posée par CSS, et toute
 * machine la rend pareil. L'intégration continue la mesure donc à chaque
 * poussée, avec `MESURER_EN_POLICE_LARGE=1`.
 *
 * LA SECONDE NE PEUT ÊTRE VÉRIFIÉE QUE SUR LA MACHINE QUI LA POSSÈDE, et cette
 * machine est un poste de développement, pas un exécuteur. Entre deux passages
 * à la main, rien ne la regarde. Elle ne rougissait pas : elle POURRISSAIT.
 *
 * MESURÉ LE 2026-10-01 : `/demo/mon-espace@360` portait un plafond de 3 249 px
 * pour une mesure de 3 220. Vingt-neuf pixels de MOU, c'est-à-dire vingt-neuf
 * pixels de croissance future qu'aucune porte n'aurait refusés. La dérive était
 * ancienne — vérifiée sur un `main` remisé, sans aucune modification du lot en
 * cours — et personne ne pouvait dire depuis quand.
 *
 * ═══ CE QUE CE SCRIPT FAIT, ET CE QU'IL N'AJOUTE PAS ═══
 *
 * Il N'AJOUTE AUCUN TRAVAIL. La doctrine de ce dépôt veut déjà qu'un lot touchant
 * le client finisse par `npm run check:navigateur`. Ce script est la DERNIÈRE
 * étape de cette chaîne : quand elle est passée au vert, en police normale, sur
 * une machine qui possède la colonne, il écrit l'empreinte des sources qui
 * viennent d'être mesurées.
 *
 * Il ne prouve donc pas que la mesure était bonne — les portes s'en chargent —
 * mais qu'elle a EU LIEU, et sur quoi.
 *
 * `check-sceau-colonne-normale.mjs`, lui, tourne dans `check:rapide`, donc
 * PARTOUT, intégration continue comprise. Il recompose l'empreinte et refuse si
 * elle a changé. La dérive ne peut plus traverser un lot en silence.
 *
 * ═══ POURQUOI UNE EMPREINTE, ET NON UNE DATE ═══
 *
 * Une date dirait « mesuré il y a trois jours », ce qui ne répond pas à la
 * question. La question est « mesuré sur CE code ? ». Une empreinte y répond, et
 * elle répond juste dans les deux sens : un lot qui ne touche pas au rendu ne
 * déclenche rien, et un lot qui y touche ne peut pas passer sans remesure.
 *
 * ═══ CE QU'IL NE COUVRE PAS, ET IL FAUT LE DIRE ═══
 *
 * UNE MACHINE ÉTRANGÈRE NE PEUT PAS SCELLER. Le témoin le lui dit, ce script se
 * tait, et `check-sceau` refusera sa poussée. C'est voulu — elle ne PEUT pas
 * vérifier cette colonne — mais c'est un mur pour un contributeur sur Linux. Le
 * message de refus le nomme plutôt que de le laisser deviner.
 *
 * ET L'EMPREINTE EST PLUS LARGE QUE LE RENDU. Elle couvre tout `src/` hors
 * fichiers de cas : `api/client.ts` n'a jamais changé une hauteur, et le modifier
 * demandera pourtant une remesure. C'est le côté sûr de l'imprécision — une
 * empreinte trop étroite laisse passer une dérive, une empreinte trop large
 * coûte une chaîne qu'on devait lancer de toute façon.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'
import { POLICE_LARGE } from './police-large.mjs'
import { laColonneNormalePeutEtreANous, releverLeTemoin } from './temoin-de-la-machine.mjs'
/* L'EMPREINTE VIENT D'UN MODULE SANS EFFET DE BORD, et son en-tête dit
   pourquoi : la vérification l'importe aussi, et importer CE fichier-ci
   reposerait le sceau qu'elle vérifie. */
import { CHEMIN_DU_SCEAU, RACINE, empreinteDesSources } from './colonne-normale.mjs'

/* ═══ POSE DU SCEAU ═══ */

if (POLICE_LARGE) {
  console.log(
    '\n· sceau : rien à sceller — cette chaîne mesurait la colonne IMPOSÉE,\n' +
      "  que l'intégration continue vérifie à chaque poussée.\n",
  )
  exit(0)
}

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
const temoin = await releverLeTemoin(page)
await navigateur.close()

if (!laColonneNormalePeutEtreANous(temoin)) {
  console.log(
    '\n· sceau : rien à sceller — `system-ui` vaut ici la face de repli\n' +
      `  (${temoin.systeme} px contre ${temoin.repli} px pour DejaVu Sans), donc cette\n` +
      "  machine ne possède pas la colonne normale et ne peut rien attester d'elle.\n",
  )
  exit(0)
}

const { empreinte, fichiers } = empreinteDesSources()
writeFileSync(
  join(RACINE, CHEMIN_DU_SCEAU),
  JSON.stringify(
    {
      _: 'Écrit par scripts/sceau-colonne-normale.mjs — ne pas modifier à la main.',
      empreinte,
      fichiers,
      mesureLe: new Date().toISOString().slice(0, 19) + 'Z',
      temoin: { systeme: temoin.systeme, repli: temoin.repli },
    },
    null,
    2,
  ) + '\n',
)

console.log(
  `\n✓ sceau : la colonne normale est attestée sur ${fichiers} fichier(s) de rendu.\n` +
    `  ${CHEMIN_DU_SCEAU} — à committer avec le lot.\n` +
    '  `check:rapide` refusera toute poussée dont les sources ont bougé depuis.\n',
)
