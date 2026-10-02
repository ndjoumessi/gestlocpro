import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * OÙ L'ON EST, ET OÙ L'ON MESURE.
 *
 * `RACINE` vivait dans `mesure-ui.mjs` et s'en déduisait par un seul `..`. En
 * descendant d'un dossier ce chemin DEVIENT FAUX : c'est la seule ligne de tout
 * ce découpage qui a dû changer, et elle est ici pour qu'il n'y en ait qu'une.
 * Chaque module l'importe plutôt que de la recalculer — un `..` de trop et la
 * porte lirait un autre dépôt, en silence.
 */
export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Le port de la prévisualisation. 4190 est INTERDIT à `fetch` (liste WHATWG). */
export const PORT = 4183
export const BASE = `http://127.0.0.1:${PORT}`

/**
 * Les largeurs mesurées.
 *
 * 320 est le plancher réel du marché visé. 700-900 est la bande qui a livré
 * les deux défauts fondateurs de cette garde, et c'est justement la bande que
 * personne ne regarde : ni téléphone, ni bureau. 1440 est le poste de travail
 * du gestionnaire.
 */
/* 1536 EST ENTRE PARCE QU'UNE REGLE Y VIT DESORMAIS. `GRILLE_QUATRE_INDICATEURS`
   pose ses quatre colonnes a `2xl`, c'est-a-dire au-dela de 1440 : sans cette
   largeur, la rangee a quatre colonnes du tableau de bord et du parc ne serait
   rendue par AUCUN point de mesure, et un debordement y passerait inapercu.
   C'est la panne que la garde de `LARGEUR_SANS_REPLI` refuse quelques centaines
   de lignes plus bas — « porte au-dela de la plus large, il viderait la regle
   sans que rien ne rougisse ». Une regle qui vit a un point de rupture oblige a
   mesurer ce point de rupture. */
export const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440, 1536]
