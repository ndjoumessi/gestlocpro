/**
 * LA HACHURE D'UNE PÉRIODE OUVERTE — deux graphiques la dessinent, une seule
 * la définit.
 *
 * Elle vivait dans `Charts.tsx`, d'où `StackedBarChart` et `MiniBarChart`
 * l'appelaient tous deux. Le second est parti dans son propre fichier ; recopier
 * ces deux lignes aurait fait deux hachures à faire vieillir ensemble, et le
 * jour où l'une passe de 5 px à 6 la vitrine et le tableau de bord ne se
 * ressembleraient plus sans que rien ne le dise.
 */
/**
 * La HACHURE d'une période encore OUVERTE.
 *
 * Cette distinction se portait par l'ALPHA : la dernière colonne était peinte à
 * 0,55 AU REPOS, sans qu'aucune interaction ne soit en cours. Une opacité n'est
 * pas un signe, c'est un affaiblissement — elle rapproche la marque de son fond
 * au lieu de lui ajouter du sens. Mesuré sur la carte claire, les trois séries y
 * tombaient à 1,78:1, 2,09:1 et 2,35:1, sous le seuil de 3:1 qu'un élément non
 * textuel porteur de sens doit tenir ; en sombre l'électricité restait à 2,91:1.
 * Le mois le plus récent — celui qu'on vient regarder — était donc le moins
 * lisible des douze.
 *
 * La hachure dit la même chose sans rien retirer : chaque bande garde la teinte
 * à PLEINE FORCE, donc son ratio, et c'est l'alternance qui porte le sens. Elle
 * survit au niveau de gris et à l'impression, ce qu'une opacité ne fait pas.
 *
 * Les creux prennent la couleur de la carte plutôt que d'être transparents : la
 * colonne croise la ligne d'objectif, et un vrai trou y laisserait passer le
 * trait de l'objectif au milieu de la donnée.
 */
export function hachureOuverte(couleur: string): string {
  return `repeating-linear-gradient(-45deg, ${couleur} 0 5px, var(--color-surface) 5px 7px)`
}