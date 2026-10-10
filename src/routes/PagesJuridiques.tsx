/**
 * LES TROIS PAGES JURIDIQUES, RÉUNIES DERRIÈRE UNE SEULE FRONTIÈRE.
 *
 * ═══ CE QUE CE FICHIER EXISTE POUR FAIRE ═══
 *
 * Mentions légales, confidentialité et conditions générales étaient importées
 * STATIQUEMENT par `App.tsx` : tout visiteur de la vitrine téléchargeait les
 * trois écrans et leurs 5 955 o de mots compressés, pour des pages qu'il
 * n'ouvrira probablement jamais.
 *
 * ═══ UNE BARRIQUE, ET C'EST LA FORME QUI COMPTE ═══
 *
 * Trois `lazy()` visant trois fichiers DIFFÉRENTS auraient donné trois morceaux
 * et trois allers-retours — un par page, alors qu'elles se citent l'une l'autre
 * en pied de page. En les réexportant toutes depuis ICI, les trois `lazy()`
 * d'`App.tsx` nomment le MÊME spécificateur : Rollup n'émet qu'un morceau, et
 * le second `import()` est servi par le premier.
 *
 * Des réexports NOMMÉS, et non `export *` : ce dépôt a déjà payé quatre fois la
 * faute du découpage sans recâblage, et un réexport nommé la fait tomber au
 * LIEN, avant toute exécution. `scripts/check-orphelins.mjs` ne suit que
 * `export function Nom` — les trois fonctions restent déclarées dans leurs
 * fichiers, donc il continue de les voir.
 *
 * ═══ LES MOTS VOYAGENT AVEC LES PAGES ═══
 *
 * `poserSectionFrancaise(frLegal)` à l'évaluation du module, exactement comme
 * `EspaceApplicatif.tsx` pose `frApp` : l'import est STATIQUE, donc Rollup range
 * les mots dans ce morceau-ci, que la page télécharge de toute façon. Ni octet
 * ni requête de plus, et rien à attendre — un import est évalué avant le
 * premier rendu.
 *
 * L'ANGLAIS NE PEUT PAS PRENDRE CE CHEMIN : un import statique de `en-legal`
 * mettrait ses mots dans le morceau que les francophones téléchargent. Il
 * arrive par `signalerPagesJuridiques`, joint à la promesse de ce morceau dans
 * `App.tsx` — le raisonnement complet est dans `en-app.ts`.
 */
import { frLegal } from '@/i18n/fr-legal'
import { poserSectionFrancaise } from '@/i18n/I18nProvider'

poserSectionFrancaise(frLegal)

export { MentionsLegales } from './MentionsLegales'
export { Confidentialite } from './Confidentialite'
export { ConditionsGenerales } from './ConditionsGenerales'
