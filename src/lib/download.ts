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

/** Type MIME d'un document PDF. */
export const PDF_MIME = 'application/pdf'

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

/**
 * Remet des OCTETS au navigateur — un PDF, et non du texte.
 *
 * Le passage par `downloadTextFile` aurait été tentant : un `Blob` accepte les
 * deux. Il aurait été faux. Une chaîne JavaScript est de l'UTF-16, et le `Blob`
 * la transcode en UTF-8 : tout octet au-dessus de 0x7F en devient deux, la
 * table de références croisées du PDF pointe alors à côté de chaque objet, et
 * le lecteur refuse le document. Le défaut ne se verrait sur AUCUN document
 * purement anglais — il apparaîtrait au premier accent.
 *
 * Le reste — l'ancre attachée avant le clic pour Firefox, la révocation
 * différée pour Safari — est celui de `downloadTextFile`, et pour les mêmes
 * raisons.
 */
export function downloadBinaryFile(octets: Uint8Array, filename: string, mime: string): void {
  /* La copie n'est pas superflue : `Blob` réclame un tampon dont il est le seul
     propriétaire, et TypeScript refuse depuis peu un `Uint8Array` dont le
     tampon peut être partagé. */
  const url = URL.createObjectURL(new Blob([new Uint8Array(octets)], { type: mime }))

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.hidden = true

  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * ENVOIE DES OCTETS À L'IMPRIMANTE, sans passer par la page.
 *
 * ═══ CE QUE `window.print()` IMPRIMAIT ═══
 *
 * Le DOM. La modale de quittance l'employait avec une feuille `@media print`
 * qui éteignait la page pour ne rallumer que la zone du document — mais
 * `visibility: hidden` CONSERVE la géométrie des ancêtres. Le corps de la
 * modale restait un conteneur de défilement à hauteur bornée, et il rognait la
 * zone qu'il contenait : sortaient deux pages portant chacune la même quittance
 * coupée après « Détail de la période ».
 *
 * ═══ POURQUOI UN CADRE, ET NON UNE FENÊTRE ═══
 *
 * `window.open` sur une adresse d'objet est bloqué comme fenêtre surgissante
 * dès que le clic n'est plus jugé « direct » — ce qui arrive après un `await`.
 * Un cadre invisible n'est pas une fenêtre : il ne demande rien, et son
 * `print()` porte sur SON document, donc sur le PDF seul.
 *
 * ═══ CE QUI N'EST PAS RÉVOQUÉ TOUT DE SUITE ═══
 *
 * Ni l'adresse ni le cadre. La boîte d'impression est modale et rend la main
 * immédiatement : révoquer aussitôt viderait le document sous les yeux de qui
 * choisit son imprimante. On attend `afterprint`, et un délai de repli couvre
 * les navigateurs qui ne l'émettent pas — Safari, notamment.
 */
export function printBinaryFile(octets: Uint8Array, mime: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(octets)], { type: mime }))

  const cadre = document.createElement('iframe')
  /* Hors champ plutôt que `display: none` : un cadre non rendu ne charge pas
     son document dans certains navigateurs, et son `contentWindow` reste vide. */
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  cadre.src = url

  const nettoyer = () => {
    URL.revokeObjectURL(url)
    cadre.remove()
  }

  cadre.onload = () => {
    const fenetre = cadre.contentWindow
    if (!fenetre) return nettoyer()
    fenetre.addEventListener('afterprint', nettoyer, { once: true })
    fenetre.focus()
    fenetre.print()
    // Repli : trois minutes suffisent à choisir une imprimante, et rien ne
    // justifie de garder un document en mémoire au-delà.
    window.setTimeout(nettoyer, 180_000)
  }

  document.body.append(cadre)
}
