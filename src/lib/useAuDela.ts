import { useEffect, useState } from 'react'

/**
 * Une requête média LUE PAR LE RENDU, et non seulement par la feuille de style.
 *
 * POURQUOI PAS `lg:hidden`. Les utilitaires responsifs cachent, ils ne
 * retirent pas : le nœud reste dans le DOM, dans l'ordre de tabulation d'un
 * `inert` mal posé, et surtout dans la LARGEUR NATURELLE de son parent. Un
 * panneau dimensionné à son contenu qui contient encore deux boutons pleine
 * largeur invisibles n'est pas dimensionné à son contenu — il est dimensionné à
 * ce qu'on prétend avoir retiré.
 *
 * L'idiome existe déjà dans ce dépôt : `AppShell` referme son tiroir sur
 * `matchMedia('(min-width: 64rem)')` pour la raison jumelle — un état ouvert
 * que plus rien ne montre. On l'extrait ici parce qu'un second appelant le
 * réclame, pas par principe.
 *
 * LES VALEURS SONT CELLES DE TAILWIND, en `rem` et non en pixels : les points
 * de rupture du cadre sont écrits ainsi, et une fenêtre dont la police de base
 * est agrandie doit basculer au même moment que la feuille de style. En pixels,
 * le rendu et le CSS se désaccorderaient précisément chez qui grossit son texte.
 *
 * `typeof matchMedia !== 'function'` : jsdom fournit bien la fonction, mais
 * n'évalue aucune largeur — toute requête y est fausse. C'est le comportement
 * qu'on veut sous le harnais, où le panneau doit se monter en entier ; le
 * garde-fou vise les environnements qui ne la fournissent pas du tout.
 */
export function useAuDela(requete: string): boolean {
  const [oui, setOui] = useState(
    () => typeof matchMedia === 'function' && matchMedia(requete).matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const media = matchMedia(requete)
    const onChange = () => setOui(media.matches)
    // Rappelé tout de suite : entre le premier rendu et cet effet, la fenêtre a
    // pu franchir le seuil, et personne n'aurait émis d'événement pour le dire.
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [requete])

  return oui
}

/** Les deux seuils de Tailwind que la vitrine consulte. Voir `PublicHeader`. */
export const AU_DELA_SM = '(min-width: 40rem)'
export const AU_DELA_LG = '(min-width: 64rem)'
