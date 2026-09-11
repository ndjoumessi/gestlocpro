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
 *   20-27. et ses branches restées muettes — le périmètre d'une modale, le masqué,
 *          l'`inert`, la boîte nulle, `data-cible`, le rayon, le pli, le retour
 *          du défilement à zéro
 *   28-29. son SÉLECTEUR — les treize sortes qu'elle tient pour des commandes,
 *          et ce qui n'en est pas une
 *   30.    et l'étiquette qui NE sauve PAS : celle qui cite son champ sans le
 *          contenir occupe une autre région de l'écran
 *   38-45. l'alignement des sections de fiches voisines — une grille qui partage
 *          ses rangées, une qui se décale au naturel, une qui ne se décale que
 *          sous contrainte (le cas que la démonstration cache), une contrainte
 *          sans effet, une fiche seule, pas de grille, une contrainte rendue,
 *          une section manquante
 *
 * LES VINGT-HUIT TÉMOINS DE BRANCHE NAISSENT ROUGES : chacun a été confronté à
 * une mutation de la sonde qu'il éprouve, et chacun a désigné SA cible — huit le
 * 2026-09-09, vingt-deux le 2026-09-10. Un témoin vert sur une sonde juste ne
 * prouve rien ; il faut l'avoir vu refuser.
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
  DECALAGE_DE_CONTRAINTE,
  MESURER_CIBLES,
  MESURER_DEFILEMENT_LATERAL,
  MESURER_DEROULEMENT,
  MESURER_GABARITS,
  MESURER_RENDU_MINIMAL,
  MESURER_SECTIONS_ALIGNEES,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
  RELEVER_LES_CLOTURES_PERMEABLES,
  SELECTEUR_DE_COMMANDE,
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
const TEMOINS_ATTENDUS = 45
/*
  DEUX CONTRÔLES SUR DIX-NEUF, et ce nombre est écrit plutôt qu'imprimé. Un
  témoin qu'on rangerait en contrôle « parce qu'il ne rougit pas » deviendrait
  une dispense : le compte oblige à venir le déclarer ici, et le diff le montre.
*/
const CONTROLES_ATTENDUS = 2

/** Un cas : une page, une sonde, une attente écrite en toutes lettres. */
async function temoin(page, { nom, nature, page: html, sonde, argument, avant, apres, attendu }) {
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
  /* `avant` POSE UNE SONDE DANS LA PAGE avant de l'exercer — le seul moyen
     d'éprouver ce qu'elle fait quand elle LÈVE : `page.evaluate` rend la levée
     sous forme d'erreur Playwright, et l'on veut la lire, pas la subir. */
  if (avant) await page.evaluate((source) => { window.__MESURER_CIBLES__ = eval(`(${source})`) }, avant.toString())
  const vu = await page.evaluate(sonde, argument)
  /* CE QUE LA SONDE LAISSE DERRIÈRE ELLE, et qui n'est pas dans ce qu'elle rend :
     un défilement déplacé, par exemple. Sans cette seconde lecture, un effet de
     bord ne peut être éprouvé par aucun témoin. */
  const trace = apres ? await page.evaluate(apres) : undefined
  temoinsJoues += 1
  const verdict = attendu(vu, trace)
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

  const CONFIG_CIBLES = {
    plancher: PLANCHER_CIBLE,
    rayon: RAYON_SONDAGE,
    selecteur: SELECTEUR_DE_COMMANDE,
  }

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

  /* ══════════ LES CIBLES : LES BRANCHES QUE `a194d27` LAISSAIT MUETTES ══════════ */

  await temoin(page, {
    nom: '20. une MODALE ouverte borne le balayage à elle-même',
    nature: 'branche',
    page:
      '<button style="width:20px;height:20px;padding:0;border:0">fond</button>' +
      '<div role="dialog" aria-modal="true">' +
      '<button style="width:60px;height:60px">dans la modale</button></div>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 1 && vu.defauts.length === 0
        ? true
        : `attendu la SEULE commande de la modale ; ${vu.sondees} sondée(s), ` +
          `${vu.defauts.length} défaut(s). Derrière une modale, « cette cible est-elle ` +
          "atteignable au doigt » n'a pas de sens : la couche la recouvre exprès.",
  })

  await temoin(page, {
    nom: '21. une commande MASQUÉE n’est pas sondée',
    nature: 'branche',
    page:
      '<button style="visibility:hidden;width:20px;height:20px;padding:0;border:0">v</button>' +
      '<button style="display:none">d</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 0 && vu.defauts.length === 0
        ? true
        : `attendu AUCUNE sondée : ce qu'on ne voit pas ne se touche pas. ` +
          `${vu.sondees} sondée(s).`,
  })

  await temoin(page, {
    nom: '22. une commande dans un sous-arbre `inert` n’est pas sondée',
    nature: 'branche',
    page: '<div inert><button style="width:20px;height:20px;padding:0;border:0">i</button></div>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 0
        ? true
        : "attendu AUCUNE sondée : `inert` retire l'élément de toute interaction. " +
          `${vu.sondees} sondée(s).`,
  })

  await temoin(page, {
    nom: '23. une boîte NULLE n’est pas sondée — il n’y a rien à toucher',
    nature: 'branche',
    page: '<a href="#" style="display:block;width:0;height:0;overflow:hidden">rien</a>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 0 && vu.defauts.length === 0
        ? true
        : `attendu AUCUNE sondée ; ${vu.sondees} sondée(s), ${vu.defauts.length} défaut(s). ` +
          "Sonder un point dans une boîte sans surface rend « 0x0 » et accuse un innocent.",
  })

  await temoin(page, {
    nom: '24. une dispense déclarée au site est RELEVÉE, pas avalée',
    nature: 'branche',
    page:
      '<button data-cible="la rangée entière est cliquable" ' +
      'style="width:60px;height:60px">A1</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.raisonsVues.length === 1 && vu.raisonsVues[0] === 'la rangée entière est cliquable'
        ? true
        : `attendu la dispense rendue telle quelle ; ${JSON.stringify(vu.raisonsVues)}. ` +
          'Une dispense qui ne remonte pas est une dispense que personne ne relit.',
  })

  await temoin(page, {
    nom: '25. la cible est mesurée AU-DELÀ de la boîte, jusqu’au rayon',
    nature: 'branche',
    page:
      '<style>#etendu{position:relative}#etendu::after{content:"";position:absolute;inset:-20px}</style>' +
      '<div style="padding:30px">' +
      '<button id="etendu" style="width:20px;height:20px;padding:0;border:0">A1</button></div>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 1 && vu.defauts.length === 0
        ? true
        : "attendu AUCUN défaut : la boîte fait 20 px, mais un `::after` étendu porte la " +
          `cible à 45. Rendu : ${JSON.stringify(vu.defauts[0] ?? null)}. « Une boîte n'est ` +
          'pas une cible » — c’est le premier angle mort que cette sonde ait payé.',
  })

  await temoin(page, {
    nom: '26. une commande SOUS LE PLI est vraiment sondée, pas rendue « 0x0 »',
    nature: 'branche',
    page:
      '<div style="height:2000px"></div>' +
      '<button style="width:20px;height:20px;padding:0;border:0">bas</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.defauts.length === 1 && vu.defauts[0].cible !== '0x0'
        ? true
        : `attendu un défaut MESURÉ, pas « 0x0 » : ${JSON.stringify(vu.defauts[0] ?? null)}. ` +
          "Sans amener l'élément à l'écran, le point sondé tombe hors de la fenêtre et la " +
          'sonde conclut « rien », ce qui accuse à tort et sans chiffre lisible.',
  })

  await temoin(page, {
    nom: '27. le défilement est RENDU À ZÉRO après le balayage',
    nature: 'branche',
    page:
      '<div style="height:2000px"></div>' +
      '<button style="width:20px;height:20px;padding:0;border:0">bas</button>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    apres: () => ({ defilement: Math.round(window.scrollY) }),
    attendu: (vu, trace) =>
      trace.defilement === 0
        ? true
        : `attendu la page rendue en haut ; elle est à ${trace.defilement} px. La mesure ` +
          "suivante hériterait d'une page à mi-hauteur — et l'en-tête collant y a déjà " +
          'changé de fond.',
  })

  /* ══════════ LE SÉLECTEUR : CE QUI EST UNE COMMANDE, ET CE QUI N'EN EST PAS ══════════ */

  /*
    TREIZE SORTES, ET LE REFUS DOIT NOMMER CELLE QUI MANQUE.

    Un témoin qui ne compterait que le total dirait « douze au lieu de treize »
    sans dire laquelle est tombée — et la liste est en dur dans la sonde, donc
    c'est exactement l'accident à craindre : une ligne retirée d'un tableau qu'on
    réordonne.

    On se sert donc de `raisonsVues`, qui remonte le `data-cible` de chaque
    élément SONDÉ : chaque sorte porte son propre marqueur, et le refus rend la
    différence des deux ensembles.

    CHAQUE ÉLÉMENT NE DOIT CORRESPONDRE QU'À UNE SEULE ENTRÉE du sélecteur —
    `querySelectorAll` rend les éléments une fois, donc un `<div role="button"
    tabindex="0">` survivrait au retrait de l'une des deux lignes et masquerait
    la perte. D'où l'absence de `tabindex` sur les éléments à rôle, et de rôle
    sur celui qui porte `tabindex`.
  */
  const SORTES = [
    ['lien', '<a href="#" data-cible="lien" style="display:block;width:60px;height:60px">a</a>'],
    ['bouton', '<button data-cible="bouton" style="width:60px;height:60px">b</button>'],
    ['saisie', '<input type="text" data-cible="saisie" style="width:60px;height:60px">'],
    ['liste', '<select data-cible="liste" style="width:60px;height:60px"><option>x</option></select>'],
    ['zone', '<textarea data-cible="zone" style="width:60px;height:60px"></textarea>'],
    ['role-bouton', '<div role="button" data-cible="role-bouton" style="width:60px;height:60px">c</div>'],
    ['role-lien', '<div role="link" data-cible="role-lien" style="width:60px;height:60px">d</div>'],
    ['role-radio', '<div role="radio" data-cible="role-radio" style="width:60px;height:60px">e</div>'],
    ['role-case', '<div role="checkbox" data-cible="role-case" style="width:60px;height:60px">f</div>'],
    ['role-onglet', '<div role="tab" data-cible="role-onglet" style="width:60px;height:60px">g</div>'],
    ['role-bascule', '<div role="switch" data-cible="role-bascule" style="width:60px;height:60px">h</div>'],
    ['role-menu', '<div role="menuitem" data-cible="role-menu" style="width:60px;height:60px">i</div>'],
    ['tabulable', '<div tabindex="0" data-cible="tabulable" style="width:60px;height:60px">j</div>'],
  ]

  await temoin(page, {
    nom: '28. les TREIZE sortes de commandes du sélecteur sont toutes sondées',
    nature: 'branche',
    page: SORTES.map(([, html]) => html).join(''),
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) => {
      const attendues = SORTES.map(([nom]) => nom)
      const manquantes = attendues.filter((nom) => !vu.raisonsVues.includes(nom))
      if (manquantes.length === 0 && vu.sondees === attendues.length) return true
      return manquantes.length > 0
        ? `sorte(s) NON sondée(s) : ${manquantes.join(', ')} — une entrée du sélecteur ` +
          "est tombée, et ce qu'elle désignait cesse d'être mesuré sans un mot."
        : `${vu.sondees} sondée(s) pour ${attendues.length} sortes : un élément a été ` +
          'compté deux fois, ou un intrus est entré.'
    },
  })

  await temoin(page, {
    nom: '29. ce qui n’est PAS une commande n’est pas sondé',
    /*
      DEUX MUTATIONS ESSAYÉES, UNE SEULE MORD — et l'autre est un résultat.

      `[tabindex]:not([tabindex="-1"])` élargi à `[tabindex]` fait rougir ce
      témoin : un élément retiré de la tabulation redeviendrait une cible.

      `input:not([type=hidden])` élargi à `input` ne fait RIEN rougir. Une
      saisie cachée porte `display: none` de la feuille de l'agent, donc une
      boîte nulle : les deux exemptions suivantes l'écartent déjà. Cette part du
      sélecteur ne décide de rien — elle DIT, ce qui a sa valeur, mais elle ne
      garde pas. C'est le même constat que le raccourci des clôtures
      positionnées, trouvé de la même façon : en cherchant la mutation.
    */
    nature: 'branche',
    page:
      '<div data-cible="div-nu" style="width:60px;height:60px">texte</div>' +
      '<a data-cible="lien-sans-href" style="display:block;width:60px;height:60px">sans href</a>' +
      '<input type="hidden" data-cible="saisie-cachee">' +
      '<div tabindex="-1" data-cible="hors-tabulation" style="width:60px;height:60px">k</div>' +
      '<span data-cible="span" style="display:block;width:60px;height:60px">l</span>',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) =>
      vu.sondees === 0 && vu.raisonsVues.length === 0
        ? true
        : `attendu AUCUNE sondée ; ${vu.sondees} sondée(s) : ${vu.raisonsVues.join(', ')}. ` +
          "Un sélecteur trop large fait mesurer des textes comme s'ils étaient des " +
          'commandes, et le plancher de 44 px devient du bruit.',
  })

  /*
    L'AUTRE SENS DE `etiquetteDe`, ET IL MANQUAIT DEPUIS QUATRE LOTS.

    Le témoin 18 montre qu'une étiquette ENVELOPPANTE sauve son champ : la case
    de 20 px est touchable par les 44 px de son libellé, et c'est vrai. Rien ne
    montrait le REFUS symétrique, que les commentaires de la sonde défendent
    pourtant longuement : « Une étiquette qui cite son champ par `for` sans le
    contenir — la forme de `Field`, au-dessus des champs de saisie — occupe une
    AUTRE région de l'écran. Créditer un champ de la taille d'un libellé posé
    ailleurs déclarerait touchable une surface qui ne l'est pas d'un seul
    geste. »

    Une règle qui ne sait que pardonner ne garde rien. Celle-ci doit donc
    REFUSER ici, et le refus doit porter la taille du champ seul.
  */
  await temoin(page, {
    nom: '30. une étiquette qui cite son champ SANS le contenir ne le sauve pas',
    nature: 'branche',
    page:
      '<label for="courriel" style="display:block;height:44px;width:200px">Adresse</label>' +
      '<input id="courriel" type="text" style="width:20px;height:20px;padding:0;border:0">',
    sonde: MESURER_CIBLES,
    argument: CONFIG_CIBLES,
    attendu: (vu) => {
      if (vu.defauts.length !== 1) {
        return `attendu UN défaut — le champ de 20 px n'est pas sauvé par un libellé posé ` +
          `AILLEURS ; ${vu.defauts.length} rendu(s).`
      }
      const [l, h] = vu.defauts[0].cible.split('x').map(Number)
      return l < CONFIG_CIBLES.plancher && h < CONFIG_CIBLES.plancher
        ? true
        : `attendu la taille du CHAMP SEUL, sous le plancher ; rendu ${vu.defauts[0].cible}. ` +
          "Créditer le champ de la surface du libellé déclarerait touchable d'un seul geste " +
          'une région que le doigt n’atteint pas.'
    },
  })

  await temoin(page, {
    nom: '31. la RACINE borne aussi les clôtures — le fond n’est pas relu',
    nature: 'branche',
    page:
      '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:absolute;top:300px;left:0">fond</span></div>' +
      '<div role="dialog" aria-modal="true">' +
      '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:absolute;top:300px;left:0">modale</span></div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    argument: '[role="dialog"]',
    attendu: (vu) =>
      vu.length === 1 && vu[0].evades[0].texte === 'modale'
        ? true
        : `attendu la SEULE clôture de la modale ; ${vu.length} rendue(s). Relire le fond ` +
          "ferait rougir deux portes pour un même défaut, et nommerait une modale innocente.",
  })

  /*
    UNE ICÔNE SVG N'EST PAS UNE ÉVADÉE, et il a fallu un dossier pour le voir.

    `offsetParent` est défini sur `HTMLElement`, pas sur `SVGElement` : la
    lecture rend `undefined`, et une sonde qui prend `undefined` pour « rien ne
    le borne » dénonce TOUTE icône absolue. Trente-quatre plaintes le
    2026-09-10, dont une bonne moitié pour la coche de `Choice` et le chevron
    des champs, dont les conteneurs sont pourtant `relative`.
  */
  await temoin(page, {
    nom: '32. une icône SVG absolue dans un conteneur POSITIONNÉ ne s’échappe pas',
    nature: 'branche',
    page:
      '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<span style="position:relative;display:inline-block;width:20px;height:20px">' +
      '<svg style="position:absolute" width="13" height="13"><rect width="13" height="13"/></svg>' +
      '</span></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : "attendu AUCUNE clôture perméable : le `<span>` positionné borne l'icône. " +
          `Rendu : ${JSON.stringify(vu[0].evades)}. Lire \`offsetParent\` sur un ` +
          '`<svg>` rend `undefined`, ce qui ressemble trait pour trait à « rien ne le borne ».',
  })

  /*
    LES PROPRIÉTÉS QUI BORNENT SANS ÊTRE `position` — et celle qui n'y arrive pas.

    Quinze cas mesurés dans Chromium le 2026-09-10, un enfant absolu posé à
    `top:0;left:0` : on regarde s'il se cale sur son conteneur ou sur la page.
    `contain` et `content-visibility` BORNENT ; `container-type` non.

    Les trois premiers naissent rouges sur la marche à la main, qui les
    ignorait ; le quatrième naîtrait rouge sur toute rédaction qui ajouterait
    `container-type` par symétrie — et ce dépôt en emploie, dans le tableau de
    bord du locataire.
  */
  await temoin(page, {
    nom: '33. `contain: layout` borne ses absolus — ce n’est pas une évasion',
    nature: 'branche',
    page: '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<div style="contain:layout"><span style=\"position:absolute;top:0;left:0\">a</span></div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : 'attendu AUCUNE : `contain: layout` établit un bloc conteneur — mesuré. ' +
          `Rendu : ${JSON.stringify(vu[0].evades)}.`,
  })

  await temoin(page, {
    nom: '34. `content-visibility: auto` borne aussi',
    nature: 'branche',
    page: '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<div style="content-visibility:auto"><span style=\"position:absolute;top:0;left:0\">a</span></div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : 'attendu AUCUNE : `content-visibility` implique la containment de mise en page.',
  })

  await temoin(page, {
    nom: '35. une icône SVG sous `contain: layout` est bornée elle aussi',
    nature: 'branche',
    page: '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<div style="contain:layout"><svg style=\"position:absolute;top:0;left:0\" width=\"13\" height=\"13\"><rect width=\"13\" height=\"13\"/></svg></div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 0
        ? true
        : "attendu AUCUNE : c'est la marche à la main qui répond ici — un `<svg>` n'a pas " +
          "d'`offsetParent` — et elle doit connaître `contain` comme le navigateur.",
  })

  await temoin(page, {
    nom: '36. `container-type` ne borne PAS — et le produit en emploie',
    nature: 'branche',
    page: '<div style="overflow-y:auto;height:50px;width:200px">' +
      '<div style="height:400px"></div>' +
      '<div style="container-type:inline-size"><span style=\"position:absolute;top:0;left:0\">a</span></div></div>',
    sonde: RELEVER_LES_CLOTURES_PERMEABLES,
    attendu: (vu) =>
      vu.length === 1
        ? true
        : "attendu UNE clôture perméable : mesuré, `container-type` n'établit aucun bloc " +
          "conteneur dans Chromium — l'enfant se cale sur la page. L'ajouter par symétrie " +
          'ferait taire la sonde sur le tableau de bord du locataire, qui porte `@container`.',
  })

  /*
    LA SONDE REFUSE CE QU'ELLE NE SAIT PAS MESURER.

    La liste des commandes voyage désormais dans la configuration, pour n'être
    écrite qu'une fois. Un appelant qui l'oublierait ferait rendre
    `querySelectorAll(undefined)` — la chaîne « undefined », qui ne correspond à
    rien : zéro cible sondée, zéro défaut, et un vert qui ressemble à un examen.
  */
  await temoin(page, {
    nom: '37. sans sélecteur, la sonde des cibles REFUSE au lieu de rendre zéro',
    nature: 'branche',
    page: '<button style="width:20px;height:20px;padding:0;border:0">x</button>',
    sonde: (config) => {
      try {
        /* La sonde est appelée ici sans passer par `page.evaluate` : c'est la
           MÊME fonction, et l'on veut voir sa levée plutôt que la subir. */
        return { leve: false, resultat: window.__MESURER_CIBLES__(config) }
      } catch (e) {
        return { leve: true, message: String(e.message ?? e).slice(0, 90) }
      }
    },
    argument: { plancher: 44, rayon: 22 },
    avant: MESURER_CIBLES,
    attendu: (vu) =>
      vu.leve === true && /sélecteur/.test(vu.message)
        ? true
        : `attendu une levée nommant le sélecteur ; rendu ${JSON.stringify(vu)}. Une sonde ` +
          'qui rend zéro cible pour une configuration incomplète se lit « aucun défaut ».',
  })


  /*
    ═══ 38-45 · L'ALIGNEMENT DES SECTIONS DE FICHES VOISINES ═══

    Trois fiches de 120 px côte à côte, trois sections chacune. Ce qui change
    d'un témoin à l'autre est la façon dont la fiche distribue ses sections :
    rangées PARTAGÉES (`subgrid`) ou colonne flexible PROPRE à chaque fiche.
  */
  const grilleDeFiches = (fiches, colonnes = 3) =>
    `<div data-mesure="sections-alignees" style="display:grid;` +
    `grid-template-columns:repeat(${colonnes},120px);gap:8px">${fiches}</div>`
  const fichePartagee = (a = 20) =>
    '<div style="grid-row:span 3;display:grid;grid-template-rows:subgrid;row-gap:4px">' +
    `<div data-section="identite" style="height:${a}px"></div>` +
    '<div data-section="etats" style="height:10px"></div>' +
    '<div data-section="faits" style="height:30px"></div></div>'
  const ficheColonne = (a = 20, sections = ['identite', 'etats', 'faits']) =>
    '<div style="display:flex;flex-direction:column;gap:4px">' +
    sections
      .map((nom) => `<div data-section="${nom}" style="height:${nom === 'identite' ? a : 10}px"></div>`)
      .join('') +
    '</div>'

  await temoin(page, {
    nom: '38. une grille qui PARTAGE ses rangées est alignée, au naturel comme sous contrainte',
    nature: 'branche',
    page: grilleDeFiches(fichePartagee() + fichePartagee(50) + fichePartagee()),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      Array.isArray(vu) &&
      vu.length === 1 &&
      vu[0].fiches === 3 &&
      [...vu[0].naturel, ...vu[0].contraint].every((e) => e.ecart === 0 && e.presentes === 3) &&
      vu[0].deplacement === DECALAGE_DE_CONTRAINTE
        ? true
        : `attendu une rangée de 3 fiches, aucun écart, un déplacement de ${DECALAGE_DE_CONTRAINTE} px.`,
  })

  await temoin(page, {
    nom: '39. des colonnes PROPRES à chaque fiche se décalent au naturel, et c’est dénoncé',
    nature: 'branche',
    page: grilleDeFiches(ficheColonne() + ficheColonne(60) + ficheColonne()),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      vu?.[0]?.naturel.find((e) => e.nom === 'etats')?.ecart === 40
        ? true
        : 'attendu 40 px d’écart naturel sur « etats » : une identité de 60 px contre 20.',
  })

  /* LE CAS QUE LA DÉMONSTRATION CACHE : des colonnes propres, mais de même
     hauteur — alignées au naturel par coïncidence. Seule la contrainte montre
     que rien ne les tient ensemble. */
  await temoin(page, {
    nom: '40. des colonnes alignées PAR COÏNCIDENCE se décalent sous contrainte, et c’est dénoncé',
    nature: 'branche',
    page: grilleDeFiches(ficheColonne() + ficheColonne() + ficheColonne()),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      vu?.[0]?.naturel.every((e) => e.ecart === 0) &&
      vu[0].contraint.find((e) => e.nom === 'etats')?.ecart === DECALAGE_DE_CONTRAINTE
        ? true
        : `attendu 0 px au naturel et ${DECALAGE_DE_CONTRAINTE} sous contrainte sur « etats ».`,
  })

  await temoin(page, {
    nom: '41. une contrainte SANS EFFET est rendue comme telle, pas comme un alignement',
    nature: 'branche',
    page: grilleDeFiches(
      ['a', 'b'].map(() =>
        '<div style="position:relative;height:80px">' +
        '<div data-section="identite" style="height:20px"></div>' +
        '<div data-section="etats" style="position:absolute;top:30px;height:10px;width:100%"></div></div>',
      ).join(''),
      2,
    ),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      vu?.[0]?.deplacement === 0
        ? true
        : 'attendu un déplacement nul : la section suivante est posée en absolu, la contrainte ne la pousse pas.',
  })

  await temoin(page, {
    nom: '42. une fiche SEULE sur sa rangée n’est comparée à personne',
    nature: 'branche',
    page: grilleDeFiches(ficheColonne() + ficheColonne(60), 1),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      Array.isArray(vu) && vu.length === 0
        ? true
        : 'attendu une liste VIDE : deux fiches, chacune seule sur sa rangée.',
  })

  await temoin(page, {
    nom: '43. sans grille déclarée, la sonde ne rend RIEN plutôt qu’un relevé vide',
    nature: 'branche',
    page: '<div style="display:grid;grid-template-columns:repeat(2,120px)">' + ficheColonne() + ficheColonne(60) + '</div>',
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) =>
      vu === null ? true : 'attendu `null` : aucune grille ne s’est déclarée.',
  })

  await temoin(page, {
    nom: '44. la contrainte est RENDUE : la section grossie retrouve son style d’origine',
    nature: 'branche',
    page: grilleDeFiches(
      ficheColonne().replace('style="height:20px"', 'style="height:20px;padding-bottom:5px"') + ficheColonne(),
      2,
    ),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    apres: () => document.querySelector('[data-section="identite"]').style.paddingBottom,
    attendu: (vu, trace) =>
      trace === '5px'
        ? true
        : `attendu « 5px » après la sonde, lu « ${trace} » : une page laissée contrainte fausse toutes les sondes suivantes.`,
  })

  await temoin(page, {
    nom: '45. une section MANQUANTE est comptée, et ne décale pas la comparaison des autres',
    nature: 'branche',
    page: grilleDeFiches(ficheColonne() + ficheColonne(20, ['identite', 'faits']), 2),
    sonde: MESURER_SECTIONS_ALIGNEES,
    argument: DECALAGE_DE_CONTRAINTE,
    attendu: (vu) => {
      const etats = vu?.[0]?.naturel.find((e) => e.nom === 'etats')
      return etats?.presentes === 1 && vu[0].fiches === 2
        ? true
        : 'attendu « etats » présente sur 1 fiche des 2 : la seconde ne la porte pas.'
    },
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
