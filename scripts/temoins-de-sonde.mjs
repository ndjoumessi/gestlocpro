#!/usr/bin/env node
/**
 * LES SONDES ONT LEURS TÉMOINS — sur des pages où la vérité est CONSTRUITE.
 *
 * ═══ LA DETTE QUE CE FICHIER PAIE ═══
 *
 * `236d75c` a corrigé une ligne de `MESURER_DEFILEMENT_LATERAL` : elle
 * innocentait tout élément large situé dans un conteneur qui défile — juste
 * pour du contenu EN FLUX, faux pour un absolu qui échappe à ce conteneur,
 * c'est-à-dire pour le seul vrai coupable. Ce correctif est parti SANS TÉMOIN,
 * et son commit le disait : « son code ne s'exécute que sur une page qui défile
 * latéralement, et aucune des 44 ne le fait. J'ai vérifié le raisonnement, pas
 * le comportement. »
 *
 * Un raisonnement vérifié est une hypothèse. Ce fichier le mesure.
 *
 * ═══ POURQUOI DES PAGES SYNTHÉTIQUES, ET NON LE PRODUIT ═══
 *
 * Parce que le produit ne PEUT PAS servir de témoin ici : ses 44 écrans sont
 * verts, et une sonde qui ne rougit nulle part ne prouve rien de ce qu'elle
 * ferait devant un défaut. Fabriquer le défaut dans le produit demanderait de
 * casser une mise en page, donc de choisir entre un témoin et un dépôt sain.
 *
 * Sur une page écrite ici, la réponse attendue est connue par CONSTRUCTION : on
 * sait qu'il y a un évadé parce qu'on l'a posé. C'est la seule condition dans
 * laquelle « la sonde répond juste » est une mesure et non une croyance.
 *
 * ═══ CE QUE CHAQUE TÉMOIN ÉTABLIT ═══
 *
 * Les deux directions, toujours — une sonde qui ne sait que dénoncer se trompe
 * autant qu'une sonde qui ne sait que se taire :
 *
 *   1. une page qui ne déborde pas          → aucun verdict
 *   2. un bloc plus large que la vue        → dénoncé
 *   3. le même, DANS un conteneur défilant  → innocenté (le motif des tableaux)
 *   4. un ABSOLU qui échappe au conteneur   → dénoncé  ← le correctif de 236d75c
 *   5. une clôture qui laisse sortir un absolu → dénoncée
 *   6. la même, positionnée                 → innocentée (elle borne)
 *   7. la même, sans rien qui s'échappe     → innocentée
 *   8. un élément FIXE dans une clôture      → innocenté (il ne défile de rien)
 *
 * LES SEPT PREMIERS NAISSENT ROUGES : chaque témoin a été confronté à une
 * mutation de la sonde qu'il éprouve, et chacun a désigné SA cible. Le sixième
 * en a demandé DEUX — le raccourci sur les clôtures positionnées est redondant
 * avec le test du bloc conteneur, et c'est le témoin qui l'a établi.
 *
 * ═══ CE QU'IL NE PROUVE PAS ═══
 *
 * Que les sondes disent vrai DU PRODUIT. Une page de vingt lignes n'a ni
 * grille, ni police chargée, ni React : elle éprouve la LOGIQUE de la sonde,
 * pas sa rencontre avec un écran réel. Ce sont les quinze portes qui font ça, et
 * ce fichier passe avant elles pour qu'un instrument faux ne les traverse pas
 * toutes en silence.
 *
 *   node scripts/temoins-de-sonde.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Les styles écrits ici
 * sont des attributs `style` en clair, jamais des noms d'utilitaires — rien de
 * ce fichier ne doit pouvoir entrer dans la feuille livrée.
 */
import { chromium } from 'playwright'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import {
  MESURER_DEFILEMENT_LATERAL,
  RELEVER_LES_CLOTURES_PERMEABLES,
} from './sondes-de-rendu.mjs'

/** La fenêtre des témoins : étroite, pour qu'un débordement tienne en peu de px. */
const VUE = { width: 400, height: 300 }

const plaintes = []
let temoinsJoues = 0

/*
  LE COMPTE EST ÉCRIT, JAMAIS DÉRIVÉ. Une boucle vide se déclarerait verte, et
  c'est le piège que ce dépôt a trouvé quatre fois — voir `plafond-coquille`.
*/
const TEMOINS_ATTENDUS = 8

/** Un cas : une page, une sonde, une attente écrite en toutes lettres. */
async function temoin(page, { nom, page: html, sonde, attendu }) {
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`)
  /* Deux trames : le style vient d'être posé, la disposition pas encore faite. */
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  const vu = await page.evaluate(sonde)
  temoinsJoues += 1
  const verdict = attendu(vu)
  if (verdict !== true) {
    plaintes.push(`${nom}\n   ${verdict}\n   la sonde a rendu : ${JSON.stringify(vu)}`)
  }
}

/** Le bloc qui fait déborder la page, présent dans les témoins 2 à 4. */
const BLOC_LARGE = '<div id="large" style="width:900px;height:40px;background:#eee"></div>'

const navigateur = await chromium.launch()
try {
  /*
    L'AGENT DE SERVICE ÉCARTÉ, MÊME ICI où aucune requête n'est faite : ces
    pages viennent de `setContent`, pas du réseau. La garde qui l'exige est
    MÉCANIQUE — elle lit les `newContext` de `scripts/` sans savoir ce qu'ils
    chargent —, et c'est ce qui fait sa valeur : une exception « celle-ci ne
    charge rien » se périmerait au premier témoin qui chargerait quelque chose.
  */
  const contexte = await navigateur.newContext({ ...SANS_AGENT_DE_SERVICE, viewport: VUE })
  const page = await contexte.newPage()

  await temoin(page, {
    nom: '1. une page qui tient dans la vue ne rend AUCUN verdict',
    page: '<p>rien de large ici</p>',
    sonde: MESURER_DEFILEMENT_LATERAL,
    attendu: (vu) => (vu === null ? true : 'attendu `null`, la page ne déborde pas.'),
  })

  await temoin(page, {
    nom: '2. un bloc plus large que la vue est DÉNONCÉ',
    page: BLOC_LARGE,
    sonde: MESURER_DEFILEMENT_LATERAL,
    attendu: (vu) =>
      vu === null
        ? 'attendu un verdict : 900 px de bloc dans une vue de 400.'
        : vu.coupables.some((c) => c.droite >= 900)
          ? true
          : 'le débordement est vu, mais le bloc de 900 px n’est pas nommé.',
  })

  await temoin(page, {
    nom: '3. le même bloc DANS un conteneur qui défile est INNOCENTÉ',
    page:
      BLOC_LARGE +
      '<div style="overflow-x:auto;width:200px">' +
      '<div id="dedans" style="width:900px;height:20px"></div></div>',
    sonde: MESURER_DEFILEMENT_LATERAL,
    attendu: (vu) =>
      vu === null
        ? 'attendu un verdict : le bloc large fait déborder la page.'
        : vu.coupables.length === 1
          ? true
          : `attendu UN seul coupable — le bloc nu. Le contenu en flux d'un conteneur ` +
            `défilant ne doit pas être dénoncé ; ${vu.coupables.length} nommé(s).`,
  })

  /*
    LE TÉMOIN DU CORRECTIF DE `236d75c`.

    L'absolu n'a AUCUN ancêtre positionné : son bloc conteneur est celui de la
    page, donc le découpage du conteneur défilant ne l'atteint pas. Il pousse le
    document, et c'est lui le coupable. La rédaction d'avant l'innocentait au
    seul motif qu'un ancêtre défilait — vérifié : ce témoin rougit sur elle.
  */
  await temoin(page, {
    nom: '4. un ABSOLU qui ÉCHAPPE au conteneur défilant est DÉNONCÉ',
    page:
      '<div style="overflow-x:auto;width:200px;height:60px">' +
      '<div style="width:300px;height:20px"></div>' +
      '<span id="evade" style="position:absolute;left:600px;top:0;width:100px;height:20px">x</span>' +
      '</div>',
    sonde: MESURER_DEFILEMENT_LATERAL,
    attendu: (vu) =>
      vu === null
        ? "attendu un verdict : l'absolu porte le document à 700 px pour une vue de 400."
        : vu.coupables.some((c) => c.droite >= 700)
          ? true
          : "le débordement est vu, mais l'évadé est innocenté — c'est le défaut que " +
            '`236d75c` corrige : un absolu hors du bloc conteneur du conteneur défilant ' +
            "n'est PAS contenu par lui.",
  })

  await temoin(page, {
    nom: '5. une clôture qui laisse sortir un absolu est DÉNONCÉE',
    page:
      '<div id="clot" style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:absolute;top:300px;left:0">évadé</span></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 1 ? true : `attendu UNE clôture perméable, ${vu.length} rendue(s).`,
  })

  await temoin(page, {
    nom: '6. la même clôture, POSITIONNÉE, est innocentée : elle borne ses absolus',
    page:
      '<div style="position:relative;overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:absolute;top:300px;left:0">retenu</span></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : `attendu AUCUNE : un bloc conteneur retient ses absolus. ${vu.length} rendue(s).`,
  })

  await temoin(page, {
    nom: '7. une clôture sans rien qui s’échappe est innocentée',
    page:
      '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px">contenu en flux seulement</div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : `attendu AUCUNE : rien ne sort d'un contenu en flux. ${vu.length} rendue(s).`,
  })

  /*
    LE HUITIÈME EST NÉ DE L'ÉCRITURE DU SIXIÈME.

    En cherchant quelle mutation ferait rougir « une clôture positionnée est
    innocentée », j'ai dû regarder ce que la sonde comptait comme évadé — et
    elle comptait les `fixed`. Un élément fixe ne participe à AUCUN débordement
    défilant : il ne peut pas causer le défaut poursuivi, et `position: relative`
    ne le retiendrait pas davantage. La sonde aurait donc pu dénoncer une clôture
    pour une raison fausse, en prescrivant un correctif sans effet.

    Ce témoin naît rouge sur la sonde d'avant cette correction : elle rendait UNE
    clôture perméable ici, pour un élément qui ne défile de rien.
  */
  await temoin(page, {
    nom: '8. un élément FIXE dans une clôture ne la rend PAS perméable',
    page:
      '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:fixed;top:0;left:0">fixe</span></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : "attendu AUCUNE : un `fixed` ne participe à aucun débordement défilant, " +
          "donc il ne peut pas causer le défaut — et `relative` ne le retiendrait pas.",
  })

  await contexte.close()
} finally {
  await navigateur.close()
}

if (temoinsJoues !== TEMOINS_ATTENDUS) {
  plaintes.push(
    `${temoinsJoues} témoin(s) joué(s) pour ${TEMOINS_ATTENDUS} attendu(s).\n` +
      "   Un témoin sauté se lit exactement comme un témoin vert, et c'est pire que rien.",
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ temoins-de-sonde : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  console.error(
    "  UNE SONDE FAUSSE TRAVERSE TOUTES LES PORTES EN SILENCE : elles la croient sur\n" +
      '  parole. Réparez la sonde avant de lire le moindre verdict des quinze suivantes.\n',
  )
  exit(1)
}

console.log(
  `\n✓ temoins-de-sonde : ${temoinsJoues}/${TEMOINS_ATTENDUS} témoins, sur des pages où la\n` +
    '  réponse est connue par construction — les deux directions à chaque fois.\n' +
    '  Il ne dit RIEN de ce que les sondes rendent du PRODUIT : c’est le travail des\n' +
    '  quinze portes qui suivent.',
)
