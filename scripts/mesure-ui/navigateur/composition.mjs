/**
 * OÙ LES BLOCS SE POSENT LES UNS PAR RAPPORT AUX AUTRES.
 *
 * Six mesures qui ne demandent pas « ce contenu sort-il de sa boîte » mais
 * « cette boîte est-elle au bon endroit » : le jeu d'une rangée d'en-tête, son
 * repli, l'axe des deux colonnes d'authentification, le rythme des sections de
 * la vitrine, l'axe du bloc d'accroche, le bas du trio de tarifs. Aucune ne
 * peut rougir pour un texte trop long ; toutes rougissent pour une composition
 * qui a glissé.
 *
 * Module PUR, et parti dans le navigateur par `page.evaluate`. Il ne voit ni
 * `node:fs`, ni les tolérances, ni les plafonds : ce qu'il rend est une MESURE
 * BRUTE, et c'est `mesure-ui.mjs` qui la juge. La doctrine de cette frontière
 * vit dans `../mesures-navigateur.mjs`, qui réexporte ce fichier.
 *
 * Sorti de `mesures-navigateur.mjs` le 2026-10-05, SANS QU'UNE LIGNE CHANGE —
 * les lignes ont été DÉPLACÉES, prose comprise.
 */

/**
 * Exécuté DANS la page : rend le jeu restant sur la rangée de l'en-tête public.
 *
 * LA RANGÉE SE DÉSIGNE, elle ne se devine pas. Un plancher en pixels n'a de
 * sens que sur une rangée BORNÉE PAR UNE BANDE — ici `max-w-7xl`, qui fige la
 * largeur utile à 1216 px dès 1280, donc le jeu y est une constante par langue.
 * Les rangées d'en-tête des écrans d'authentification, elles, sont en
 * `ml-auto … justify-end` : elles épousent leur contenu, et leur jeu vaut zéro
 * par construction — vérifié sur les 21 écrans qui les portent. Balayer « toute
 * rangée d'en-tête » ferait donc rougir vingt-et-un écrans qui n'ont jamais eu
 * de place à perdre. D'où le marqueur, posé dans `PublicHeader.tsx`.
 *
 * Rend `null` sur les écrans sans en-tête public : ce n'est pas un manque, la
 * plupart des adresses balayées sont des écrans de l'application. C'est le
 * compteur plus bas qui distingue « absent ici » de « disparu partout ».
 */
export const MESURER_JEU = () => {
  const rangee = document.querySelector('[data-mesure="rangee-entete-vitrine"]')
  if (!rangee) return null

  const style = getComputedStyle(rangee)
  const boite = rangee.getBoundingClientRect()
  const dispo = boite.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
  const gouttiere = parseFloat(style.columnGap) || 0

  const enfants = [...rangee.children]
    .filter((e) => getComputedStyle(e).display !== 'none')
    .map((e) => ({
      largeur: Math.round(e.getBoundingClientRect().width),
      nom: e.tagName.toLowerCase(),
    }))
    .filter((e) => e.largeur > 0)
  if (enfants.length === 0) return null

  const occupe = enfants.reduce((a, e) => a + e.largeur, 0) + gouttiere * (enfants.length - 1)
  return {
    jeu: Math.round(dispo - occupe),
    dispo: Math.round(dispo),
    gouttieres: Math.round(gouttiere * (enfants.length - 1)),
    enfants,
  }
}

/**
 * LA GRILLE DE TARIFS — un seul signe pour l'exclusion, un seul bas pour le trio.
 *
 * DEUX DÉFAUTS MESURÉS, tous deux invisibles aux autres règles de ce fichier :
 * rien ne débordait, rien ne se repliait, aucun contraste n'était en cause.
 *
 * LA RATURE. Les lignes non incluses portaient une croix ET une barre de texte.
 * Deux signes pour un message, dont un qui en dit un autre : une croix dit
 * « non inclus dans ce palier », une rature dit « supprimé », « obsolète »,
 * « annulé ». Sur une grille qui vend la montée en gamme, la seconde lecture
 * travaille contre la première.
 *
 * LE BAS DU TRIO. La carte sans prix — « Sur devis » tient sur une ligne là où
 * les autres empilent montant, mention mensuelle, formule et essai — finissait
 * une centaine de pixels au-dessus de ses voisines, et son bouton flottait
 * seul. Un tableau comparatif se compare par ses lignes ; celle des boutons est
 * la dernière et la plus décisive.
 *
 * LA TOLÉRANCE EST DE UN PIXEL, et c'en est vraiment une : les hauteurs sont
 * arrondies, pas approchées. On ne demande pas que les cartes se ressemblent,
 * on demande qu'elles finissent ensemble — ce qui est soit vrai, soit faux.
 */
export const MESURER_TARIFS = () => {
  const grille = document.querySelector('[data-mesure="tarifs-grille"]')
  if (!grille) return null

  const cartes = [...grille.children].map((c) => ({
    nom: c.querySelector('h3')?.textContent?.trim() ?? '(sans nom)',
    bas: Math.round(c.getBoundingClientRect().bottom),
  }))
  if (cartes.length === 0) return null

  // Les lignes exclues, et ce qu'elles portent comme décoration. On interroge
  // le STYLE CALCULÉ et non la classe : la rature peut revenir par n'importe
  // quel chemin, et c'est le rendu qui trompe le lecteur, pas le nom de la
  // classe qui l'a produit.
  const exclues = [...grille.querySelectorAll('[data-inclus="non"]')]
  const raturees = exclues.filter((li) =>
    [li, ...li.querySelectorAll('*')].some((el) =>
      getComputedStyle(el).textDecorationLine.includes('line-through'),
    ),
  ).length

  return { cartes, exclues: exclues.length, raturees }
}

export const MESURER_COLONNES = () => {
  const centre = (marqueur) => {
    const el = document.querySelector(`[data-mesure="${marqueur}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.height === 0) return null
    return { haut: Math.round(r.top), bas: Math.round(r.bottom), mi: Math.round(r.top + r.height / 2) }
  }

  const cadre = centre('auth-cadre')
  const formulaire = centre('auth-formulaire')
  if (!cadre || !formulaire) return null
  const argument = centre('marque-argument')

  return {
    // La page tient-elle dans la fenêtre ? L'axe ne veut dire quelque chose que
    // là où il reste de la place à répartir ; à l'étroit, les marges
    // s'effondrent et les deux colonnes repartent de leur haut, ce qui est le
    // comportement voulu et non un décrochage.
    auLarge: document.documentElement.scrollHeight <= innerHeight + 1,
    axe: argument ? formulaire.mi - argument.mi : null,
    formulaire,
    argument,
  }
}

/**
 * LE RYTHME DE LA VITRINE — exécuté DANS la page, au-delà du point de rupture.
 *
 * CE QU'ELLE ATTRAPE. Mesuré avant le lot, à 1440 et 1920 px : les SEPT
 * sections de la page portaient exactement 128 px de rembourrage en haut comme
 * en bas, et 64 px sous leur en-tête. Sept fois la même valeur. Rien
 * n'indiquait au regard où il en était ni ce qui comptait le plus, parce que
 * tout était présenté avec la même insistance.
 *
 * CE DÉFAUT NE SE VOIT PAS SECTION PAR SECTION, et c'est ce qui le rend
 * difficile à garder : chaque section, prise seule, est parfaitement bien
 * réglée. Il ne se voit qu'en les COMPARANT — d'où une règle qui mesure la page
 * entière et regarde la variété, là où toutes les autres de ce fichier
 * regardent un élément et son défaut.
 *
 * TROIS FAITS, du plus faible au plus fort :
 *
 *   1. La page emploie au moins trois rembourrages distincts. Une page à une
 *      seule valeur est un métronome ; trois est le minimum pour qu'on puisse
 *      parler de temps forts et de temps faibles.
 *   2. Deux temps NOMMÉS DIFFÉREMMENT ne rendent jamais le même rembourrage.
 *      C'est le fait qui porte : un vocabulaire dont deux mots veulent dire la
 *      même chose n'est pas un vocabulaire, c'est une décoration au-dessus
 *      d'une valeur unique. Sans lui, on pourrait satisfaire (1) en écrivant
 *      quatre noms sur trois valeurs et croire la page rythmée.
 *   3. Un seul temps `ample`. C'est un point culminant, et une page qui en a
 *      deux n'en a aucun.
 *
 * ON NE FIXE AUCUNE VALEUR EN PIXELS. Le rythme est un rapport entre les
 * sections, pas un nombre : figer « la section des tarifs vaut 160 px » ferait
 * rougir la porte au premier réglage délibéré de l'échelle, et la relever
 * serait l'occasion de la vider. Ce qu'on garde, c'est la DIFFÉRENCE.
 */
export const MESURER_RYTHME = () => {
  const sections = [...document.querySelectorAll('main [data-rythme]')]
  if (sections.length === 0) return null

  return sections.map((s) => {
    const style = getComputedStyle(s)
    return {
      temps: s.getAttribute('data-rythme'),
      id: s.id || '(sans id)',
      pad: `${Math.round(parseFloat(style.paddingTop))}/${Math.round(parseFloat(style.paddingBottom))}`,
    }
  })
}

/**
 * L'AXE DU BLOC D'ACCROCHE — exécuté DANS la page, à chaque largeur.
 *
 * CE QU'ELLE ATTRAPE. La colonne de lecture du hero était alignée sur le CENTRE
 * de la carte qui l'illustre. Mesuré avant le lot : la rangée fait 427 px, la
 * colonne 204, donc `items-center` la décalait de 111 px vers le bas — et le
 * vide entre le bas du titre et la première ligne de texte valait 159 px à
 * 1440, 1920 et 2000, contre 48 px à 375 et 768 où la grille tient sur une
 * colonne. Le même bloc se lisait autrement selon la largeur, et rien ne
 * l'avait décidé : c'était le reste d'un alignement, pas une respiration.
 *
 * DEUX FAITS, ET C'EST LE PREMIER QUI PORTE. Le second — les deux colonnes
 * partent du même haut — ne vaut qu'au-delà du point de rupture et se
 * satisferait d'un vide, pourvu qu'il soit partagé. Le premier tient à toutes
 * les largeurs : l'écart entre le titre et sa première ligne utile est le MÊME
 * partout. Une valeur qui change avec la fenêtre sans que personne l'ait voulu
 * est exactement le défaut, et une constante est ce qui le nie.
 *
 * ON NE FIXE AUCUN NOMBRE. Le seuil serait à refaire au premier changement de
 * marge, et le refaire est l'occasion de le relever. L'invariant est
 * l'ÉGALITÉ — il survit à tout changement délibéré de l'espacement, et ne
 * survit à aucun décalage accidentel.
 */
export const MESURER_ACCROCHE = () => {
  const boite = (marqueur) => {
    const el = document.querySelector(`[data-mesure="${marqueur}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0) return null
    return { haut: Math.round(r.top), bas: Math.round(r.bottom) }
  }

  const titre = boite('accroche-titre')
  const lecture = boite('accroche-lecture')
  const illustration = boite('accroche-illustration')
  if (!titre || !lecture || !illustration) return null

  return {
    // Le vide entre le titre et la première ligne qu'on lit après lui.
    ecart: lecture.haut - titre.bas,
    // Les deux colonnes sont-elles côte à côte ? Empilées, « même haut » n'a
    // pas de sens, et l'exiger ferait rougir la version mobile, qui est juste.
    cote_a_cote: illustration.haut < lecture.bas - 1,
    // De combien l'illustration décroche de la lecture, quand elles le sont.
    decalage: illustration.haut - lecture.haut,
  }
}

/**
 * Exécuté DANS la page : rend la rangée d'en-tête repliée, ou `null`.
 *
 * POURQUOI UNE SECONDE MESURE. Celle du débordement ne pouvait pas voir ce
 * défaut-là, et l'a même masqué : `flex-wrap` a été posé sur la barre de la
 * vitrine pour supprimer un débordement à 1280, ce qu'il a fait — en empilant
 * la barre sur deux rangées. La porte est passée au vert pendant que l'en-tête
 * doublait de hauteur sur un portable ordinaire, mesuré à 131 px.
 *
 * Le repli reste le bon filet : il vaut mieux deux rangées qu'une page qui
 * défile de côté. Ce qu'on interdit, c'est qu'il se déclenche là où la place
 * existe, c'est-à-dire qu'on s'en serve pour ne pas faire entrer le contenu.
 *
 * Le nombre de rangées se lit par les BOÎTES, jamais par `flexWrap` : la classe
 * dit ce qui est permis, pas ce qui arrive. Un enfant dont le haut atteint le
 * bas d'un autre commence une rangée nouvelle — la tolérance d'un pixel écarte
 * les arrondis, et `items-center` suffit à décaler des enfants de hauteurs
 * différentes sans qu'ils changent de rangée pour autant.
 */
export const MESURER_REPLI = () => {
  const replies = []
  for (const entete of document.querySelectorAll('header')) {
    for (const rangee of entete.querySelectorAll('*')) {
      const style = getComputedStyle(rangee)
      if (style.display !== 'flex' || style.flexWrap !== 'wrap') continue

      const boites = [...rangee.children]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0)
      if (boites.length < 2) continue

      const empile = boites.some((a) => boites.some((b) => a.top >= b.bottom - 1))
      if (!empile) continue

      replies.push({
        classes: typeof rangee.className === 'string' ? rangee.className.slice(0, 110) : '',
        hauteur: Math.round(entete.getBoundingClientRect().height),
        enfants: boites.map((b) => Math.round(b.width)),
      })
    }
  }
  return replies.length > 0 ? replies : null
}
