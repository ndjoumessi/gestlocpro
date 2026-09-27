/**
 * QUELLE MACHINE MESURE ? — parce qu'un plafond appartient à une machine.
 *
 * ═══ LE DÉFAUT, ET IL A PRODUIT UN FAUX RAPPORT LE 2026-09-27 ═══
 *
 * `plafond-vitrine` et `plafond-hauteurs` portent DEUX colonnes de plafonds :
 * `plafond`, mesuré sur la machine de développement où `system-ui` vaut SF Pro,
 * et `plafondLarge`, mesuré sur la porte publique. Leurs en-têtes le disent
 * depuis des semaines — « aucun nombre ne vaut sur les deux ».
 *
 * Ils décidaient pourtant à qui appartient la colonne par une SUPPOSITION :
 *
 *     const COLONNE_A_NOUS = !POLICE_LARGE || Boolean(process.env.CI)
 *
 * Sans commutateur, donc, toute machine était réputée être la machine de
 * développement. Un conteneur d'exécution, la machine d'un nouveau contributeur,
 * n'importe quel Linux : la porte y rendait un verdict ROUGE sur des plafonds
 * qu'aucune de ses mesures ne concerne.
 *
 * MESURÉ, ET C'EST CE QUI ÉTABLIT LE DÉFAUT. Sur le conteneur de ce lot, sans
 * commutateur, la vitrine mesure 11 766 px pour un plafond inscrit à 11 400 —
 * 366 px de « dépassement ». La page n'a pourtant rien gagné : en remontant
 * `src/` au commit `8e6e1ae`, CELUI QUI A INSCRIT 11 400, la même sonde mesure
 * 11 781 px. Le nombre inscrit n'a jamais été atteignable ici, et sept commits
 * consécutifs rendent exactement les mêmes 11 766 — aucune croissance.
 *
 * Avec le commutateur, aux mêmes quatre points : 11 384 / 10 953 / 8 177 / 8 131
 * contre 11 400 / 10 969 / 8 177 / 8 131 inscrits. DEUX EXACTS AU PIXEL. C'est
 * la colonne que cette machine reproduit, et elle est verte.
 *
 * ═══ CE QUE MESURE CE TÉMOIN, ET POURQUOI IL NE PORTE AUCUNE CONSTANTE ═══
 *
 * La question utile n'est pas « quelle police ? » mais « `system-ui` est-il la
 * face de REPLI des machines sans police système propre ? ». On mesure donc la
 * même chaîne dans `system-ui` et dans `DejaVu Sans` NOMMÉE, au même corps, et
 * l'on compare les deux largeurs. Égales : `system-ui` EST DejaVu, donc cette
 * machine n'est pas celle de la colonne normale. Différentes : elle peut l'être,
 * et le comportement d'avant est conservé.
 *
 * AUCUN NOMBRE N'EST INSCRIT ICI, et c'est délibéré : un empan gravé dans une
 * source vieillit à la première version de police, et c'est précisément le genre
 * de nombre que ce dépôt a déjà vu pourrir. Deux mesures prises dans la MÊME
 * exécution se comparent sans référence extérieure.
 *
 * RELEVÉ SUR LE CONTENEUR DE CE LOT, pour mémoire et non comme seuil :
 *
 *   system-ui            146,13 px
 *   « DejaVu Sans »      146,13 px   → égales : repli, colonne étrangère
 *   Verdana, sans-serif  131,62 px   → Verdana est ABSENTE ici
 *
 * La troisième ligne est un avertissement de plus : le commutateur impose
 * Verdana, qui n'existe pas sur ce conteneur et y retombe sur une face plus
 * ÉTROITE que `system-ui`. Il n'impose donc pas partout la police large que son
 * nom promet — ce qui n'empêche pas sa colonne d'être la reproductible ici,
 * comme les deux plafonds exacts ci-dessus le montrent, mais interdit de le
 * déduire de son nom.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Il ne dit pas QUELLE machine tourne, ni si deux Linux rendent la même page :
 * les mesures de ce lot montrent 16 px d'écart sur deux points entre ce
 * conteneur et la porte publique. Il répond à une seule question, celle qui
 * décide d'un verdict : la colonne normale peut-elle appartenir à cette machine ?
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom d'utilitaire
 * n'est écrit ici.
 */

/**
 * La chaîne témoin — celle des relevés de `police-large.mjs`, pour que les
 * nombres de ce dépôt restent comparables entre eux.
 */
export const TEMOIN = 'Créer mon espace'

/**
 * Mesure la chaîne témoin dans deux familles et dit si elles coïncident.
 *
 * `canvas.measureText` ET NON UNE BOÎTE DU DOM : on veut l'empan d'une police,
 * pas la largeur que la mise en page concède. Rien n'est inséré dans le
 * document, donc rien de ce que la porte mesure ensuite n'est déplacé d'un pixel.
 */
export async function releverLeTemoin(page) {
  return await page.evaluate((temoin) => {
    const contexte = document.createElement('canvas').getContext('2d')
    const mesurer = (famille) => {
      contexte.font = `16px ${famille}`
      return Math.round(contexte.measureText(temoin).width * 100) / 100
    }
    const systeme = mesurer('system-ui')
    const repli = mesurer('"DejaVu Sans"')
    return { systeme, repli, estLeRepli: Math.abs(systeme - repli) < 0.5 }
  }, TEMOIN)
}

/**
 * La colonne normale peut-elle appartenir à cette machine ?
 *
 * `0,5 px` DE TOLÉRANCE : deux mesures de la MÊME police dans la même exécution
 * sont identiques au centième ; la tolérance ne couvre que l'arrondi, et non un
 * écart de dessin — le plus petit relevé de ce dépôt entre deux faces est de
 * 0,28 px, et celui qui décide ici de 13,5 px.
 */
export function laColonneNormalePeutEtreANous(temoin) {
  return !temoin.estLeRepli
}
