import { useEffect } from 'react'

/**
 * Titre du document, tenu à jour à chaque écran.
 *
 * Une application à page unique ne change pas de document : sans intervention,
 * le `<title>` posé dans `index.html` reste affiché partout. Trois conséquences,
 * qui ne se voient pas dans la page elle-même.
 *
 * D'abord la **langue** : le titre statique est en français, et il subsistait
 * tel quel sur une interface basculée en anglais.
 *
 * Ensuite l'**orientation** : douze écrans applicatifs portaient le même titre.
 * Deux onglets ouverts côte à côte, un signet, une entrée d'historique — rien ne
 * permettait de les distinguer.
 *
 * Enfin l'**annonce** : un lecteur d'écran lit le titre du document au
 * changement de page. Un titre figé ne signale aucun changement, alors que
 * c'est le seul repère disponible quand le contenu se remplace sans
 * rechargement.
 *
 * Le nom du produit est en suffixe et non en préfixe : un onglet réduit ne
 * montre que ses premiers caractères, et « GestLocPro — G… » répété douze fois
 * n'aiderait pas davantage que le titre figé.
 */
export function useDocumentTitle(
  title: string | undefined,
  /**
   * `false` pour la landing, dont le titre porte déjà le nom du produit en
   * tête — « GestLocPro — … · GestLocPro » se lirait deux fois.
   */
  options: { withBrand?: boolean } = {},
): void {
  const { withBrand = true } = options

  useEffect(() => {
    if (!title) return

    const precedent = document.title
    document.title = withBrand ? `${title} · GestLocPro` : title

    // Restauré au démontage : sans cela, quitter un écran vers la landing —
    // qui ne pose pas de titre — y laisserait celui de l'écran précédent.
    return () => {
      document.title = precedent
    }
  }, [title, withBrand])
}
