/**
 * CE QUE `mesure-ui` EXÉCUTE DANS LA PAGE — LA FRONTIÈRE, ET SES CINQ PARTS.
 *
 * Ce fichier ne porte plus de mesure : il NOMME celles qui partent dans le
 * navigateur, et il existe pour que la frontière soit écrite à UN endroit.
 *
 * LA FRONTIÈRE. Tout ce qui est réexporté ici part dans la page par
 * `page.evaluate`. Ces fonctions ne voient ni `node:fs`, ni les tolérances, ni
 * les plafonds : ce qu'elles rendent est une MESURE BRUTE, et c'est
 * `mesure-ui.mjs` qui la juge. Ce n'est pas un rangement, c'est la raison pour
 * laquelle elles ne peuvent pas lire une constante de Node par accident —
 * l'erreur ne se verrait qu'à l'exécution, dans une page, sous la forme d'un
 * `null` silencieux.
 *
 * POURQUOI UNE BARRIQUE ET NON CINQ IMPORTS CHEZ L'APPELANT. Les deux
 * importateurs — `mesure-ui.mjs` et `mesure-ui/inscription.mjs` — n'ont pas
 * changé d'une ligne le 2026-10-05, et c'est le but : le découpage précédent a
 * rougi quatre fois sur cinq pour un symbole non importé. Un réexport ne peut
 * pas produire cette faute, et la liste NOMMÉE ci-dessous — jamais `export *` —
 * garde l'inventaire greppable ici.
 *
 * CE QUI LE GARDE. Un nom mal orthographié dans un `export … from` est une
 * erreur de LIEN ESM : node refuse le module avant d'en exécuter une ligne.
 * Vérifié par deux mutations le 2026-10-05 — un nom tronqué dans cette liste,
 * un `export` retiré d'une part — toutes deux rouges, chacune nommant le
 * fichier et le symbole absents.
 *
 * Sorti en cinq parts le 2026-10-05, SANS QU'UNE LIGNE DE MESURE CHANGE : les
 * 1 113 lignes non vides ont été DÉPLACÉES, prose comprise, et recomptées une à
 * une de part et d'autre. La porte rend la même sortie, avant et après.
 */

export {
  MESURER_ACCROCHE,
  MESURER_COLONNES,
  MESURER_JEU,
  MESURER_REPLI,
  MESURER_RYTHME,
  MESURER_TARIFS,
} from './navigateur/composition.mjs'
export {
  MESURER_BLANC_IMPOSE,
  MESURER_VALEUR_ROGNEE,
} from './navigateur/champs.mjs'
export {
  MESURER_COUPURES,
  MESURER_DEBORDEMENT_DE_MOT,
  MESURER_TRONCATURES,
} from './navigateur/texte-coupe.mjs'
export {
  MESURER,
  MESURER_DEBORD_LOCAL,
  MESURER_RENDU,
} from './navigateur/debordement.mjs'
export {
  MESURER_DOUBLONS,
  MESURER_GESTES_ATTEIGNABLES,
} from './navigateur/gestes.mjs'
