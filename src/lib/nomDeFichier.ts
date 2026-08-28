/**
 * Le nom d'un fichier téléchargé, quel que soit son format.
 *
 * Il vivait dans `csv.ts`, où il était né avec le seul format que le produit
 * savait alors produire. Les documents PDF ont exactement le même besoin — des
 * segments traduits, un horodatage triable, aucune barre oblique — et la seule
 * chose qui changeait était l'extension. Le laisser là aurait donné deux
 * réductions de libellé à tenir d'accord, c'est-à-dire deux façons de nommer le
 * même dossier de téléchargements.
 */

/** Prénom du fichier. Nom de marque, il ne se traduit pas. */
const PREFIXE = 'gestlocpro'

/**
 * Réduit un libellé traduit à un segment de nom de fichier.
 *
 * Les segments viennent du dictionnaire — donc de la traduction — et rien ne
 * garantit qu'ils soient sûrs pour un système de fichiers : « Relevés
 * compteurs » porte un accent et une espace, et Windows refuse une bonne partie
 * de la ponctuation. On enlève les diacritiques plutôt que de les interdire au
 * traducteur.
 */
function segment(valeur: string | number): string {
  return String(valeur)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Nom parlant et daté : `gestlocpro-quittance-b7-2026-08.pdf`.
 *
 * L'horodatage est en ISO et non au format du pays : c'est un nom de fichier,
 * il doit se trier dans un dossier de téléchargements et ne jamais contenir de
 * barre oblique — ce que « 16/08/2026 » ferait.
 */
export function nomDeFichier(
  parties: readonly (string | number)[],
  horodatage: string,
  extension: string,
): string {
  const segments = [PREFIXE, ...parties, horodatage].map(segment).filter((part) => part.length > 0)
  return `${segments.join('-')}.${extension}`
}
