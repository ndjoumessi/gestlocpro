/**
 * LA DURÉE DE VIE D'UN LIEN DE RÉINITIALISATION, EN MINUTES.
 *
 * ═══ POURQUOI UNE CONSTANTE, ET PAS QUATRE PHRASES ═══
 *
 * « une heure » était écrit en toutes lettres à QUATRE endroits — le
 * sous-titre de la demande et le corps du lien expiré, dans les deux langues —
 * et nulle part ailleurs. Le serveur, lui, tient la valeur dans
 * `DUREE_REINITIALISATION_MS`. Le jour où elle passe à trente minutes, les
 * quatre chaînes mentent, et rien ne le dit : aucune garde ne lit une phrase.
 *
 * Le dépôt a déjà tranché ce cas exact, dix lignes plus loin, pour le délai
 * d'effacement des comptes : « Un cas le garde en lisant la source du serveur,
 * pour qu'une divergence rougisse plutôt que de laisser une page juridique
 * promettre un délai que le code ne tient pas. » Une promesse faite à
 * l'utilisateur sur l'écran d'un mot de passe oublié n'est pas moins engageante
 * qu'une ligne de conditions générales.
 *
 * ═══ EN MINUTES, ET C'EST UN CHOIX ═══
 *
 * Le serveur compte en millisecondes, ce qui ne s'affiche pas. Les minutes
 * portent la valeur sans perte jusqu'à des durées bien plus courtes qu'une
 * heure — si elle tombe à trente, la phrase suit sans qu'on touche au format.
 *
 * Recopié du serveur — `server/src/auth/routes.ts`, `DUREE_REINITIALISATION_MS` —
 * parce que le client ne peut pas l'importer : deux paquets, deux compilations.
 */
export const DUREE_DU_LIEN_MINUTES = 60
