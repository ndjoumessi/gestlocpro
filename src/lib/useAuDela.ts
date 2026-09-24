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
 * `typeof matchMedia !== 'function'` : DEUX AFFIRMATIONS FAUSSES CORRIGÉES ICI
 * le 2026-09-24, après mesure.
 *
 * Ce commentaire disait « jsdom fournit bien la fonction, mais n'évalue aucune
 * largeur — toute requête y est fausse ». Mesuré : jsdom ne la fournit PAS DU
 * TOUT (`typeof matchMedia === 'undefined'`), et sous le harnais ce n'est pas
 * jsdom qui répond mais `src/test/render.tsx:273`, qui POSE une fausse
 * `matchMedia` répondant à la largeur — 1280 px par défaut, réglable par
 * l'option `largeur`. Une requête `min-width` y est donc VRAIE par défaut,
 * l'inverse de ce qui était écrit.
 *
 * La conséquence n'est pas cosmétique : un cas qui veut la branche étroite doit
 * passer `largeur`, et un cas qui n'en passe pas mesure le bureau sans le
 * savoir. Le garde-fou, lui, garde son sens — il vise les environnements sans
 * `matchMedia`, ce que jsdom nu s'est révélé être.
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
