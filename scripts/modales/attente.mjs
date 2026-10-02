/**
 * L'ATTENTE DE STABILISATION DES MODALES — module PUR.
 *
 * Il ne contient que des fonctions : l'importer n'exécute rien. C'est la règle
 * tirée du sceau de la colonne normale, où un vérificateur important son
 * scelleur reposait le sceau qu'il vérifiait. Même raison que `plafonds.mjs` et
 * `registre.mjs` : `modales.mjs` démarre un serveur et un navigateur.
 */

/**
 * ATTENDRE QUE LA BOÎTE SE POSE, et non qu'un délai s'écoule.
 *
 * ═══ CE QU'ON A VU, ET CE QU'ON N'A PAS VU ═══
 *
 * Deux rouges NON REPRODUCTIBLES le 2026-10-01, tous deux à 360 px :
 *
 *     EditUnit@360/en          défil 122 px, puis 686 px propre à la relance
 *     ConfierImmeubles@360/fr  boîte 423 px, puis 718 px propre à la relance
 *
 * L'écart de 295 px du second n'est PAS une signature de police — six pixels le
 * seraient. C'est une boîte LUE AVANT D'ÊTRE POSÉE : un contenu conditionnel qui
 * arrive après le délai fixe de 400 ms, et la mesure part avec la boîte d'avant.
 *
 * LE TAUX A ÉTÉ MESURÉ AVANT DE CORRIGER, et il dit le contraire de ce que je
 * croyais : trois passes du script INCHANGÉ, 140 états chacune, ZÉRO état
 * différent d'une passe à l'autre. Les 420 observations ne contredisent pas le
 * défaut — à ~0,2 % par état, l'espérance était d'un peu moins d'un rouge, donc
 * en voir zéro est normal. Mais elles tranchent l'autre hypothèse, celle qui
 * aurait coûté cher : cette porte NE mesure PAS du bruit depuis le début, et ses
 * cent quarante plafonds sont reproductibles au pixel.
 *
 * CONSÉQUENCE DIRECTE : AUCUN PLAFOND N'A ÉTÉ RELEVÉ. Le lot était annoncé à
 * « cent quarante plafonds à remesurer » ; la comparaison des 140 états avant et
 * après l'attente rend 0 état modifié, deux fois de suite. Sur cette machine,
 * aucune boîte ne bougeait — « la plus lente en 519 ms » est la fenêtre
 * elle-même, pas un mouvement. L'attente ne corrige donc rien d'OBSERVABLE ici :
 * elle retire une CAUSE, et elle rend visible le jour où elle se produira.
 *
 * ═══ POURQUOI UNE EMPREINTE ET NON UN DÉLAI PLUS LONG ═══
 *
 * Un délai fixe plus long coûte à TOUS les états pour le bénéfice d'un seul, et
 * ne garantit rien : il déplace le seuil sans le supprimer. On lit donc la
 * géométrie trame après trame, et l'on ne part que lorsqu'elle n'a pas bougé
 * PENDANT UNE FENÊTRE — pas simplement « n trames de suite ».
 *
 * LA FENÊTRE N'EST PAS UN DÉTAIL DE RÉGLAGE, ET J'AI FAILLI LA RATER. Première
 * rédaction : cinq trames identiques suffisaient à partir, soit ~80 ms. Éprouvée
 * sur une boîte qui s'allonge de 400 px à 300 ms — le défaut reproduit à la
 * demande —, elle rendait exactement la même mesure QUE SANS ATTENTE : 300 px de
 * boîte au lieu de 700. Une attente née verte, et inerte. Elle ne valait rien.
 *
 * `STABILITE_MS` est donc le vrai paramètre : la géométrie doit être immobile
 * sur une demi-seconde continue. Une boîte qui bouge encore est attendue jusqu'à
 * `AU_PLUS_MS`. Ce n'est pas un délai fixe déguisé : un délai fixe part quoi
 * qu'il arrive, celui-ci ne part pas tant que ça bouge, et il le DIT quand il
 * renonce.
 *
 * CE QUE ÇA COÛTE, CHRONOMÉTRÉ et non dérivé — même machine, même paquet :
 *
 *     sans attente   279,07 s
 *     avec attente   353,69 s      +74,6 s, soit +27 %
 *
 * Et ce que ça achète : un rouge qui ne se reproduit pas coûte une relance de
 * chaîne (~6 min) quand il tombe en local, et le GEL DE LA PRODUCTION quand il
 * tombe sur `main` — `checkSuites` rend alors le déploiement `SKIPPED`, mot qui
 * se lit « rien à faire ». Quarante-cinq minutes mesurées le 2026-09-30.
 *
 * `STABILITE_MS` À 500 EST UNE MARGE CHOISIE, PAS UN OPTIMUM MESURÉ. La seule
 * latence que je connaisse est celle de la mutation d'épreuve, 300 ms ; celle du
 * contenu conditionnel qui a produit les deux vrais rouges n'a jamais été
 * observée. 400 suffirait pour l'épreuve, 500 laisse du jeu pour ce que je n'ai
 * pas vu. À revoir si la durée de cette porte devient un problème — et à revoir
 * AVEC UNE MESURE, pas avec une intuition.
 *
 * `document.fonts.ready` d'abord : c'est l'attente que `mesure-ui`,
 * `plafond-coquille` et `plafond-hauteurs` posent déjà, et que ce script était
 * seul à ne pas poser parmi les gardes qui mesurent de la hauteur.
 *
 * ═══ UNE ATTENTE QUI EXPIRE EN SILENCE EST UNE ATTENTE QUI MENT ═══
 *
 * Si la boîte ne se pose jamais — animation sans fin, contenu qui rafraîchit —,
 * on sort au bout du délai et l'on MESURE QUAND MÊME, parce qu'un état non
 * mesuré s'écrirait comme un état sans défaut. Mais on le COMPTE et on le DIT
 * dans le rapport : sans quoi la même mesure fausse revient, et plus personne ne
 * sait qu'elle est fausse.
 */
/** La géométrie doit être immobile sur cette durée CONTINUE avant qu'on mesure. */
const STABILITE_MS = 500
/** Au-delà, on mesure quand même — et on le dit. Un état non mesuré s'écrirait
    comme un état sans défaut. */
const AU_PLUS_MS = 4000

export async function attendreQueLaBoiteSePose(page) {
  return page.evaluate(
    async ([stabiliteMs, auPlusMs]) => {
      const trame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)))
      try {
        await document.fonts.ready
      } catch {
        /* pas de `fonts` : on se rabat sur la seule stabilité géométrique */
      }

      /* L'EMPREINTE PORTE LA BOÎTE *ET* SON CONTENU DÉFILABLE : une boîte de
         hauteur fixe dont le corps s'allonge ne bouge pas d'un pixel au-dehors,
         et c'est pourtant `defil` que la garde juge. */
      const empreinte = () => {
        const d = document.querySelector('[role="dialog"],[role="alertdialog"]')
        if (!d) return null
        const r = d.getBoundingClientRect()
        const enfants = [...d.children].map((e) => `${e.scrollHeight}/${e.clientHeight}`).join(',')
        return `${Math.round(r.height)}|${Math.round(r.top)}|${enfants}`
      }

      const depart = performance.now()
      let precedente = empreinte()
      /* L'INSTANT OÙ LA GÉOMÉTRIE A CESSÉ DE BOUGER, remis à zéro au moindre
         mouvement. C'est lui qui porte la fenêtre — un compteur de trames ne
         dirait rien de la DURÉE, et c'est la durée qui compte face à un contenu
         qui arrive trois cents millisecondes plus tard. */
      let immobileDepuis = null
      let trames = 0

      for (;;) {
        const maintenant = performance.now()
        if (immobileDepuis !== null && maintenant - immobileDepuis >= stabiliteMs) break
        if (maintenant - depart >= auPlusMs) break
        await trame()
        trames++
        const actuelle = empreinte()
        if (actuelle !== null && actuelle === precedente) {
          if (immobileDepuis === null) immobileDepuis = maintenant
        } else {
          immobileDepuis = null
        }
        precedente = actuelle
      }

      const fin = performance.now()
      return {
        posee: immobileDepuis !== null && fin - immobileDepuis >= stabiliteMs,
        trames,
        ms: Math.round(fin - depart),
        polices: document.fonts?.status ?? '?',
      }
    },
    [STABILITE_MS, AU_PLUS_MS],
  )
}

