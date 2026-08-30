/**
 * LES DEUX GRILLES DE RANGÉE D'INDICATEURS, écrites une fois.
 *
 * CE QU'ELLES REMPLACENT : douze littéraux de classes dans six écrans — la
 * rangée CHARGÉE et son SQUELETTE, deux fois par écran — et TROIS copies de la
 * même justification mesurée, recopiée mot pour mot dans les relevés, les
 * encaissements et les cautions.
 *
 * LE COÛT N'ÉTAIT PAS L'ESPACE, C'ÉTAIT LA DÉRIVE SILENCIEUSE. Un écran dont le
 * squelette et la rangée chargée portent deux littéraux distincts peut les voir
 * s'éloigner sans que rien le dise : le squelette n'apparaît jamais dans les
 * tests, jamais dans la vitrine, jamais sous une porte. C'EST ARRIVÉ. L'espace
 * locataire attendait sous quatre cartes égales et chargeait trois cartes
 * inégales — voir `SkeletonStatRow`.
 *
 * On ne partage QUE ce qui est réellement identique. L'espace locataire garde
 * sa grille propre, `lg:grid-cols-[1.4fr_1fr_1fr]`, parce que sa première carte
 * porte le loyer et les deux autres des consommations : la ranger de force ici
 * ferait une constante à trois cas, c'est-à-dire trois littéraux sous un seul
 * nom.
 */

/**
 * TROIS COLONNES SEULEMENT QUAND LA CARTE PEUT PORTER UN MONTANT.
 *
 * `sm:grid-cols-3` les posait dès 640 px. Mesuré à 700 px : la carte offre
 * 159 px de contenu, « 1 397 000 FCFA » en demande 189, et le montant FRANCHIT
 * la bordure de 9 px — les cautions le font deux fois sur le même écran. Rien
 * ne pouvait le couper : `Intl.NumberFormat` pose une espace INSÉCABLE avant la
 * devise, donc un montant est insécable de bout en bout et `whitespace-nowrap`
 * n'y est pour rien. Le seul levier est la largeur de colonne.
 *
 * Deux colonnes jusqu'à `lg`, trois ensuite : `md` (768 px) ne suffit pas — il
 * en faudrait environ 790 pour que trois cartes portent ce montant. C'est
 * l'arbitrage de `GRILLE_QUATRE_INDICATEURS`, qui attend `xl`.
 *
 * Employée par les relevés, les encaissements et les cautions.
 */
export const GRILLE_TROIS_INDICATEURS = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/**
 * QUATRE COLONNES SEULEMENT À `xl`, pour la raison ci-dessus portée d'un cran :
 * quatre cartes qui doivent chacune loger un montant réclament ~1050 px, et
 * `lg` (1024 px) n'y suffit pas tout à fait.
 *
 * Employée par le tableau de bord et le parc.
 */
export const GRILLE_QUATRE_INDICATEURS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'
