/**
 * LA GÉOMÉTRIE ET LA MÉMOIRE DU RAIL RÉORDONNABLE.
 *
 * Deux fonctions PURES, sorties de `RailDeLogements` pour une raison qui n'est
 * pas l'esthétique : jsdom ne fait aucune mise en page, donc tout calcul de
 * position laissé dans un composant n'est couvert par aucune garde. Ici, elles
 * prennent des nombres et des chaînes, et se mesurent sans navigateur.
 */

/**
 * L'index où déposer la fiche qu'on déplace.
 *
 * `centres` sont les abscisses des CENTRES des fiches, dans l'ordre affiché,
 * celle qu'on déplace comprise. La règle est celle de tous les réordonnancements
 * à la souris : on compte les fiches dont on a dépassé le centre.
 *
 * Le bornage n'est pas une précaution de style — on tire couramment AU-DELÀ du
 * premier ou du dernier centre, en visant le bord du rail. Sans lui, l'index
 * sortirait du tableau et l'ordre se casserait en silence.
 */
export function indexCible(centres: readonly number[], x: number): number {
  if (centres.length === 0) return 0
  const depasses = centres.filter((centre) => centre < x).length
  return Math.min(Math.max(depasses, 0), centres.length - 1)
}

/**
 * L'ordre retenu, remis d'accord avec le parc servi.
 *
 * L'ordre ne survit pas au rechargement — c'est la décision du lot — mais il vit
 * le temps de la visite, et le parc bouge pendant ce temps. Trois règles :
 * ce qui a disparu s'en va, ce qui a été rangé garde sa place, ce qui est neuf
 * se montre à la FIN plutôt qu'à sa place naturelle — l'insérer au milieu
 * déplacerait ce que quelqu'un vient de ranger à la main.
 */
export function ordreReconcilie(retenu: readonly string[], actuelles: readonly string[]): string[] {
  const vivantes = new Set(actuelles)
  const garde = retenu.filter((cle) => vivantes.has(cle))
  const dejaLa = new Set(garde)
  return [...garde, ...actuelles.filter((cle) => !dejaLa.has(cle))]
}
