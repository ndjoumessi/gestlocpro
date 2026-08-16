/**
 * Déclenchement d'un téléchargement depuis le navigateur.
 *
 * Séparé de `lib/csv` à dessein : la sérialisation est pure et se teste en une
 * ligne, alors que ceci touche au DOM et n'existe pas dans un environnement
 * Node — jsdom n'implémente pas `URL.createObjectURL`, il faut le simuler. Un
 * seul module à simuler dans les tests, et un seul endroit à revoir le jour où
 * l'on voudra un vrai `File System Access API`.
 */

/** Type MIME d'un CSV encodé en UTF-8. */
export const CSV_MIME = 'text/csv;charset=utf-8'

/**
 * Remet un contenu texte au navigateur sous forme de fichier téléchargé.
 *
 * L'ancre est ajoutée au document avant le clic : Firefox ignore un `<a>`
 * détaché. Elle est retirée juste après — l'utilisateur ne doit jamais la voir.
 */
export function downloadTextFile(content: string, filename: string, mime = CSV_MIME): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.hidden = true

  document.body.append(link)
  link.click()
  link.remove()

  // Révocation différée : Safari abandonne le téléchargement si l'URL objet
  // disparaît dans le même tour de boucle que le clic.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
