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
 *   9-10.  l'écran a-t-il rendu — un écran monté, une racine vide
 *   11-13. les gabarits — un jeton, une accolade qui n'en est pas un, la racine
 *   14-15. le déroulement — un absolu qui dépasse, une page ordinaire
 *   16-19. les cibles au doigt — 20 px, 60 px, une étiquette qui sauve, un sr-only
 *
 * LES DIX-NEUF NAISSENT ROUGES : chacun a été confronté à une mutation de la
 * sonde qu'il éprouve, et chacun a désigné SA cible — huit le 2026-09-09, onze
 * le 2026-09-10. Un témoin vert sur une sonde juste ne prouve rien ; il faut
 * l'avoir vu refuser.
 *
 * DEUX D'ENTRE EUX N'ONT PAS PU NAÎTRE ROUGES SOUS UNE MUTATION D'UNE LIGNE, et
 * les deux fois c'était un résultat, pas un échec. Ils sont DÉCLARÉS
 * `nature: 'controle'` — le champ est exigé de chaque cas, et leur nombre est
 * gardé, pour qu'un témoin ne soit jamais rangé là par commodité. Le motif de
 * chacun est écrit À CÔTÉ DU CAS, avec la mutation qui l'a établi.
 *
 * Un contrôle garde contre une sonde devenue TROP ZÉLÉE — qui dénoncerait là où
 * il n'y a rien. Il ne garde pas contre une sonde muette, et c'est pourquoi le
 * rapport dit les deux nombres séparément : dix-sept branches, deux contrôles.
 *
 * CERTAINES MUTATIONS EN FONT ROUGIR PLUSIEURS, et c'est attendu : la même
 * expression régulière sert aux témoins 11 et 13, et vider la boucle des cibles
 * éteint 16, 17 et 19 d'un coup. Ce qu'on exige n'est pas qu'un témoin soit
 * seul à rougir, c'est qu'aucun ne reste vert quand SA branche est cassée.
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
  MESURER_CIBLES,
  MESURER_DEFILEMENT_LATERAL,
  MESURER_DEROULEMENT,
  MESURER_GABARITS,
  MESURER_RENDU_MINIMAL,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
  RELEVER_LES_CLOTURES_PERMEABLES,
} from './sondes-de-rendu.mjs'

/** La fenêtre des témoins : étroite, pour qu'un débordement tienne en peu de px. */
const VUE = { width: 400, height: 300 }

const plaintes = []
let temoinsJoues = 0
/** Combien de témoins ne sont que des contrôles — voir `temoin`. */
let controles = 0

/*
  LE COMPTE EST ÉCRIT, JAMAIS DÉRIVÉ. Une boucle vide se déclarerait verte, et
  c'est le piège que ce dépôt a trouvé quatre fois — voir `plafond-coquille`.
*/
const TEMOINS_ATTENDUS = 19
/*
  DEUX CONTRÔLES SUR DIX-NEUF, et ce nombre est écrit plutôt qu'imprimé. Un
  témoin qu'on rangerait en contrôle « parce qu'il ne rougit pas » deviendrait
  une dispense : le compte oblige à venir le déclarer ici, et le diff le montre.
*/
const CONTROLES_ATTENDUS = 2

/** Un cas : une page, une sonde, une attente écrite en toutes lettres. */
async function temoin(page, { nom, nature, page: html, sonde, argument, attendu }) {
  /*
    LA NATURE EST EXIGÉE, et ce n'est pas une décoration.

    Un témoin de BRANCHE éprouve une décision de la sonde : casser cette
    décision le fait rougir, et c'est ce qui lui donne sa valeur. Un témoin de
    CONTRÔLE éprouve une propriété qui découle du document lui-même — aucune
    mutation d'une seule ligne ne peut le faire rougir, parce qu'il n'y a pas de
    ligne à casser. Il garde tout de même quelque chose : qu'une sonde devenue
    trop zélée ne se mette pas à dénoncer là où il n'y a rien.

    Les confondre serait surestimer ce que ce banc prouve. Le compte des deux
    est donc rendu à la fin, et gardé.
  */
  if (nature !== 'branche' && nature !== 'controle') {
    throw new Error(`temoins-de-sonde : « ${nom} » n'a pas déclaré sa nature.`)
  }
  if (nature === 'controle') controles += 1
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`)
  /* Deux trames : le style vient d'être posé, la disposition pas encore faite. */
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  const vu = await page.evaluate(sonde, argument)
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
    nature: 'branche',
    page: '<p>rien de large ici</p>',
    sonde: MESURER_DEFILEMENT_LATERAL,
    attendu: (vu) => (vu === null ? true : 'attendu `null`, la page ne déborde pas.'),
  })

  await temoin(page, {
    nom: '2. un bloc plus large que la vue est DÉNONCÉ',
    nature: 'branche',
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
    nature: 'branche',
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
    nature: 'branche',
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
    nature: 'branche',
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
    /*
      CONTRÔLE, ET NON TEST DE BRANCHE — établi par la mutation, le 2026-09-09.

      Le faire rougir a demandé DEUX mutations : retirer le raccourci qui épargne
      les clôtures positionnées ne suffit pas, car le test du bloc conteneur
      innocente déjà tout absolu d'une clôture positionnée. La propriété qu'il
      éprouve découle du document — un absolu d'une boîte positionnée A pour bloc
      conteneur cette boîte —, pas d'une décision de la sonde.

      Il reste parce qu'une sonde devenue trop zélée dénoncerait ici, et qu'on
      veut le savoir. Il ne prouve simplement pas ce qu'un témoin de branche
      prouve.
    */
    nature: 'controle',
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
    nature: 'branche',
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
    nature: 'branche',
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

  /* ══════════ L'ÉCRAN A-T-IL RENDU ══════════ */

  await temoin(page, {
    nom: '9. un écran monté est compté : titres, interactifs, racine pleine',
    nature: 'branche',
    page: '<div id="root"><h1>Parc</h1><h2>Immeubles</h2><button>Ajouter</button></div>',
    sonde: MESURER_RENDU_MINIMAL,
    attendu: (vu) =>
      vu.titres === 2 && vu.interactifs === 1 && vu.racineVide === false && vu.titre === 'Parc'
        ? true
        : 'attendu 2 titres, 1 interactif, racine pleine, titre « Parc ».',
  })

  await temoin(page, {
    nom: '10. une racine VIDE est vue comme telle — le défaut ordinaire sous /app',
    nature: 'branche',
    page: '<div id="root"></div>',
    sonde: MESURER_RENDU_MINIMAL,
    attendu: (vu) =>
      vu.racineVide === true && vu.titres === 0 && vu.interactifs === 0
        ? true
        : "attendu une racine vide et rien de compté : c'est l'écran qui n'a pas monté.",
  })

  /* ══════════ LES GABARITS NON RÉSOLUS ══════════ */

  await temoin(page, {
    nom: '11. un jeton non résolu est TROUVÉ dans le texte rendu',
    nature: 'branche',
    page: '<p>Bonjour, {count} locataires vous attendent.</p>',
    sonde: MESURER_GABARITS,
    attendu: (vu) =>
      vu.vu === true && vu.jetons.length === 1 && vu.jetons[0] === '{count}'
        ? true
        : "attendu le seul jeton « {count} ».",
  })

  await temoin(page, {
    nom: '12. une accolade qui n’est PAS un jeton ne réveille rien',
    nature: 'branche',
    page: '<p>un { seul, une { } vide, et { 3 } avec un chiffre.</p>',
    sonde: MESURER_GABARITS,
    attendu: (vu) =>
      vu.jetons.length === 0
        ? true
        : `attendu AUCUN jeton : un « { » n'en est un que suivi d'une lettre. ` +
          `Rendus : ${vu.jetons.join(', ')}.`,
  })

  await temoin(page, {
    nom: '13. la RACINE borne la lecture : le fond derrière une modale n’est pas lu',
    nature: 'branche',
    page:
      '<p>fond avec {fond} dedans</p>' +
      '<div role="dialog" aria-modal="true"><p>modale avec {dedans}</p></div>',
    sonde: MESURER_GABARITS,
    argument: '[role="dialog"]',
    attendu: (vu) =>
      vu.jetons.length === 1 && vu.jetons[0] === '{dedans}'
        ? true
        : `attendu le seul jeton de la modale. Rendus : ${vu.jetons.join(', ') || 'aucun'}. ` +
          "Lire le fond ferait accuser une modale innocente d'un défaut de la page.",
  })

  /* ══════════ CE QUI SE DÉROULE CONTRE CE QUI EST PEINT ══════════ */

  await temoin(page, {
    nom: '15. une page ordinaire déroule exactement ce qu’elle peint',
    nature: 'branche',
    page: '<div style="height:100vh;background:#f5f5f5">contenu</div>',
    sonde: MESURER_DEROULEMENT,
    attendu: (vu) =>
      vu.hDoc === vu.corps
        ? true
        : `attendu deux nombres ÉGAUX ; rendus ${vu.hDoc} et ${vu.corps}.`,
  })

  await temoin(page, {
    nom: '14. un absolu qui dépasse le corps allonge le document, et cela se voit',
    nature: 'branche',
    page:
      '<div style="height:100vh;background:#f5f5f5">contenu</div>' +
      '<span style="position:absolute;top:600px;left:0">évadé</span>',
    sonde: MESURER_DEROULEMENT,
    attendu: (vu) =>
      vu.hDoc > vu.corps
        ? true
        : `attendu un document PLUS LONG que son corps ; rendus ${vu.hDoc} et ${vu.corps}.`,
  })

  /* ══════════ LES CIBLES AU DOIGT ══════════ */

  const CONFIG_CIBLES = { plancher: PLANCHER_CIBLE, rayon: RAYON_SONDAGE }

  await temoin(page, {
    nom: '16. une commande de 20 px est DÉNONCÉE sous le plancher de 44',
    nature: 'branche',
    page: '<button style="width:20px;height:20px;padding:0;border:0">x</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 1 && vu.defauts.length === 1
        ? true
        : `attendu UNE cible sondée et UN défaut ; ${vu.sondees} sondée(s), ` +
          `${vu.defauts.length} défaut(s).`,
  })

  await temoin(page, {
    nom: '17. une commande de 60 px passe sans même être sondée au point',
    /*
      CONTRÔLE, ET NON TEST DE BRANCHE — établi par la mutation, le 2026-09-10.

      Il n'a rougi que sous une mutation qui VIDE la boucle des cibles, laquelle
      éteint aussi les témoins 16 et 19. C'est qu'une boîte de 60 px passe par sa
      SEULE taille, avant tout sondage au point : « une cible ne peut que
      GRANDIR en s'écartant du centre, jamais rétrécir. » Il n'y a donc pas de
      décision propre à casser.

      Il garde tout de même qu'une commande large ne soit pas dénoncée, et que
      la sonde la COMPTE — un balayage qui n'aurait rien sondé se lirait comme un
      écran sans défaut.
    */
    nature: 'controle',
    page: '<button style="width:60px;height:60px">ok</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 1 && vu.defauts.length === 0
        ? true
        : `attendu UNE sondée et AUCUN défaut ; ${vu.defauts.length} défaut(s).`,
  })

  await temoin(page, {
    nom: '18. une case de 20 px dans une ÉTIQUETTE de 44 est innocentée',
    nature: 'branche',
    page:
      '<label style="display:flex;align-items:center;height:44px;width:200px">' +
      '<input type="checkbox" style="width:20px;height:20px;margin:0">' +
      '<span style="margin-left:8px">rester connecté</span></label>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.defauts.length === 0
        ? true
        : "attendu AUCUN défaut : l'étiquette qui enveloppe la case EST sa cible, et " +
          `elle fait 44 px. Rendu : ${JSON.stringify(vu.defauts[0])}.`,
  })

  await temoin(page, {
    nom: '19. un `sr-only` n’est même pas sondé — il n’est pas une cible',
    nature: 'branche',
    page:
      '<button class="sr-only" style="position:absolute;width:1px;height:1px">caché</button>' +
      '<button style="width:60px;height:60px">visible</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 1 && vu.defauts.length === 0
        ? true
        : `attendu UNE seule cible sondée — la visible ; ${vu.sondees} sondée(s), ` +
          `${vu.defauts.length} défaut(s).`,
  })

  await contexte.close()
} finally {
  await navigateur.close()
}

if (controles !== CONTROLES_ATTENDUS) {
  plaintes.push(
    `${controles} témoin(s) de contrôle pour ${CONTROLES_ATTENDUS} déclaré(s).\n` +
      "   Un témoin rangé en contrôle est un témoin dont on n'exige plus qu'il rougisse :\n" +
      '   ce nombre ne monte qu’avec une mutation à l’appui, écrite à côté du cas.',
  )
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
    `  ${temoinsJoues - controles} éprouvent une BRANCHE de la sonde et sont nés rouges sous une mutation ;\n` +
    `  ${controles} sont des CONTRÔLES, qu'aucune mutation d'une ligne ne peut faire rougir —\n` +
    '  ils gardent contre une sonde trop zélée, pas contre une sonde muette.\n' +
    '  Il ne dit RIEN de ce que les sondes rendent du PRODUIT : c’est le travail des\n' +
    '  quinze portes qui suivent.',
)
