/**
 * CE QUE `mesure-ui` EXÉCUTE DANS LA PAGE — module PUR.
 *
 * Tout ce fichier part dans le navigateur par `page.evaluate`. Il ne voit ni
 * `node:fs`, ni les tolérances, ni les plafonds : ce qu'il rend est une MESURE
 * BRUTE, et c'est `mesure-ui.mjs` qui la juge. Cette frontière n'est pas un
 * rangement, c'est la raison pour laquelle ces fonctions ne peuvent pas lire une
 * constante de Node par accident — l'erreur ne se verrait qu'à l'exécution, dans
 * une page, sous la forme d'un `null` silencieux.
 *
 * Sorties de `mesure-ui.mjs` le 2026-10-02, SANS QU'UNE LIGNE CHANGE — les
 * lignes ont été DÉPLACÉES, prose comprise. Vérifié par la mesure et non par la
 * relecture : la porte rend la même sortie, aux 241 lignes près, avant et après.
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
 * LE PANNEAU NE REJOUE PAS LA BARRE — mesuré à 1440 px, panneau ouvert.
 *
 * POURQUOI UNE RÈGLE, et pas seulement un cas sous jsdom. Le doublon n'existe
 * QUE parce qu'une requête média fait apparaître les liens dans la barre, et
 * jsdom n'en applique aucune : il ne peut pas distinguer « la barre les montre »
 * de « la barre les cache ». Un cas y passerait au vert sur les deux états —
 * exactement la panne que le commentaire de `menuMobile.test.tsx` décrit déjà
 * pour `xl:hidden`. Ce qui se voit à 1440 px se mesure à 1440 px.
 *
 * CE QU'ELLE ATTRAPE, textuellement : les quatre liens de section étaient rendus
 * deux fois à 1440, 1920 et 2000 px — dans la barre et dans le panneau — et
 * « Se connecter » / « Essayer gratuitement » l'étaient dès 768. Aucune des
 * autres règles ne pouvait le voir : rien ne débordait, rien ne se repliait, le
 * jeu de la barre était intact. Deux navigations identiques côte à côte sont un
 * défaut de PRODUIT, et il se mesure comme les autres.
 *
 * LE NOM ACCESSIBLE, et non le seul texte : un lien dont le libellé vit en
 * `aria-label` compte comme rejoué au même titre. On compare des noms, parce
 * que c'est par leur nom que deux commandes se confondent.
 */
export const MESURER_DOUBLONS = () => {
  const visible = (el) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (el.classList.contains('sr-only')) return false
    const boite = el.getBoundingClientRect()
    return boite.width > 0 && boite.height > 0
  }
  const nom = (el) =>
    (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()

  const barre = document.querySelector('[data-mesure="rangee-entete-vitrine"]')
  const panneau = document.querySelector('[data-testid="menu-mobile"]')
  if (!barre || !panneau) return null

  // Le panneau est un descendant de la couche, pas de la barre — mais rien ne
  // l'interdirait demain, et un lien compté des deux côtés serait son propre
  // doublon. On écarte explicitement ce que le panneau contient.
  const dansLaBarre = [...barre.querySelectorAll('a[href], button')]
    .filter((el) => !panneau.contains(el))
    .filter(visible)
    .map(nom)
    .filter(Boolean)

  const connus = new Set(dansLaBarre)
  const rejoues = [...panneau.querySelectorAll('a[href], button')]
    .filter(visible)
    .map(nom)
    .filter((n) => n && connus.has(n))

  return { rejoues: [...new Set(rejoues)], barre: [...new Set(dansLaBarre)] }
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

export const MESURER_DEBORD_LOCAL = () => {
  // Chronométré DANS la page, pour séparer ce que coûte le PARCOURS de ce que
  // coûte l'aller-retour avec le navigateur. Les deux se paient, mais on ne les
  // réduit pas de la même façon.
  const depart = performance.now()
  const brut = []
  const tous = document.querySelectorAll('*')
  for (const el of tous) {
    if (el === document.documentElement || el === document.body) continue
    if (getComputedStyle(el).overflowX !== 'visible') continue
    // Élément en ligne : pas de boîte à déborder.
    if (el.clientWidth === 0) continue

    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const o = getComputedStyle(ancetre).overflowX
      if (o === 'auto' || o === 'scroll' || o === 'hidden') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    const boite = el.getBoundingClientRect()
    const bordInterieur = boite.left + el.clientLeft + el.clientWidth
    let droite = -Infinity
    for (const noeud of el.childNodes) {
      if (noeud.nodeType === 1) {
        const p = getComputedStyle(noeud).position
        // `absolute`, `fixed` et `sticky` sortent de leur conteneur par
        // construction : ce n'est pas un débordement, c'est leur définition.
        if (p !== 'static' && p !== 'relative') continue
        const b = noeud.getBoundingClientRect()
        if (b.width) droite = Math.max(droite, b.right)
      } else if (noeud.nodeType === 3 && noeud.textContent.trim()) {
        // Le texte n'a pas de boîte : ses rectangles se lisent par un `Range`.
        const plage = document.createRange()
        plage.selectNodeContents(noeud)
        for (const b of plage.getClientRects()) if (b.width) droite = Math.max(droite, b.right)
      }
    }

    const debord = Math.round(droite - bordInterieur)
    if (!isFinite(debord) || debord <= 1) continue
    brut.push({ el, debord })
  }

  return {
    // Compté pour que le rapport puisse dire ce qu'il a REGARDÉ. Un balayage
    // dont la sonde cesserait de trouver des éléments rendrait « aucun défaut »
    // avec la même sérénité qu'un écran sain.
    sondes: tous.length,
    ms: performance.now() - depart,
    coupables: brut
      .filter(({ el }) => !brut.some((a) => a.el !== el && el.contains(a.el)))
      .map(({ el, debord }) => ({
        signature: `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className : ''}`.slice(0, 120),
        debord,
        texte: (el.textContent || '').trim().slice(0, 40),
      })),
  }
}

/**
 * ─── LE BLANC IMPOSÉ ─────────────────────────────────────────────────────────
 *
 * CE QU'AUCUNE AUTRE RÈGLE NE VOIT. Toutes les règles de géométrie de ce
 * fichier répondent à « le contenu SORT-il de sa boîte ». Celle-ci répond à
 * l'inverse : « la boîte est-elle VIDE en bas, et par la faute de qui ». Une
 * cellule de grille qu'une voisine plus haute étire ne déborde de rien, ne coûte
 * aucune requête, ne rate aucun seuil de contraste et n'a pas un caractère de
 * trop. Elle est simplement creuse, et la porte la déclare saine.
 *
 * MESURÉ, DEUX FOIS, PORTE AU VERT. Sur le tableau de bord : 246 px de vide en
 * bas de la carte « Recouvrement du mois », soit 39 % de sa hauteur — la porte
 * était verte. Après un premier correctif, 73 px subsistaient — la porte était
 * encore verte. Le défaut a traversé sept lots de refonte sans qu'une seule
 * règle puisse seulement le nommer.
 *
 * LE PIÈGE, ET IL A FAILLI COÛTER LA RÈGLE. `align-items: stretch` est le
 * défaut d'une grille, et l'étirement n'est PAS un défaut en soi. Sur une rangée
 * de PAIRS — les quatre indicateurs d'un tableau de bord — le blanc est le prix
 * de l'alignement : les quatre cartes se valent, elles doivent finir ensemble,
 * et la plus courte paie. Une règle qui refuserait tout blanc imposé casserait
 * cette rangée-là et serait désactivée dans la semaine. Deux exclusions la
 * rendent utilisable, et TOUTES DEUX sont mesurées, pas supposées :
 *
 * 1. LES PAIRS SONT ÉPARGNÉS. Une rangée dont toutes les cellules portent le
 *    MÊME jeu de classes est une rangée d'objets de même nature. Le critère est
 *    grossier — deux cartes différentes peuvent partager leurs classes — mais il
 *    se trompe du bon côté : il épargne, il n'accuse pas.
 *
 * 2. UNE BOÎTE QUI DISTRIBUE SON ESPACE NE LE SUBIT PAS. Sans cette exclusion,
 *    la première rédaction accusait les deux boutons d'appel de la vitrine
 *    (15 px chacun) et les quatre onglets de la barre basse (8 px) : du contenu
 *    CENTRÉ, dont la moitié du vide se trouve sous le texte par construction.
 *    Elle rendait 45 relevés dont 42 étaient l'artefact de sa propre mesure.
 *    Sont donc écartées les boîtes en `center`, `end`, `space-*`, et celles dont
 *    un enfant porte `margin-top: auto` — l'idiome par lequel on CONSOMME
 *    délibérément le blanc en poussant un pied de carte vers le bas.
 *
 *    Après exclusion : 19 relevés au lieu de 61, dont TROIS non pairs — le même
 *    défaut vu à trois largeurs.
 *
 * CE QU'ELLE NE DIT PAS. Rien sur le blanc du HAUT ni des CÔTÉS, rien sur une
 * cellule creuse qui serait seule dans sa rangée, rien sur l'esthétique. Elle
 * mesure une chose : combien de pixels séparent le bas du dernier descendant en
 * flux du bas de la boîte de contenu, dans une cellule étirée par une voisine
 * d'une autre nature.
 */
/**
 * UNE VALEUR COUPÉE DANS SON CHAMP — le rognage que rien ne voyait.
 *
 * ═══ LE CAS QUI L'A FAIT ÉCRIRE ═══
 *
 * Le champ d'indicatif téléphonique portait « Congo-Brazzaville · +242 » dans
 * 176 px : l'indicatif — la seule partie qui sert — était coupé hors du champ.
 * Personne ne le voyait, et pour une raison structurelle : un texte coupé DANS
 * sa boîte ne déborde de rien. La page ne défile pas, le conteneur ne grandit
 * pas, et le DOM porte la chaîne entière. Toutes les règles voisines mesurent
 * ce qui SORT ; celle-ci mesure ce qui n'entre pas.
 *
 * ═══ CE QU'ON MESURE, ET POURQUOI PAS `scrollWidth` ═══
 *
 * Première rédaction : `scrollWidth > clientWidth`. Elle ne mordait PAS, et le
 * témoin l'a dit — un champ de recherche ramené à 96 px pour un gabarit de
 * trente-six caractères laissait la porte verte. `scrollWidth` ne grandit que
 * pour une VALEUR ; un champ vide qui affiche un gabarit mesure toujours zéro
 * écart, quelle que soit la longueur du gabarit. Et le balayage ne tape rien,
 * donc la plupart des champs y sont vides.
 *
 * On MESURE DONC LE TEXTE : un `<span>` détaché prend la police calculée du
 * champ et rend la largeur réelle des glyphes, comparée à la boîte de contenu —
 * `clientWidth` moins les rembourrages, moins la place du chevron pour un
 * `<select>`.
 *
 * ON MESURE LA VALEUR OU LE GABARIT, jamais une saisie en cours : le balayage
 * ne tape rien, donc ce qu'on trouve est ce qu'un visiteur voit EN ARRIVANT —
 * une valeur par défaut trop longue, un `placeholder` qui ne tient pas.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Les valeurs que l'utilisateur tape ensuite. Un champ de saisie fait défiler
 * son texte sous le curseur et c'est le comportement attendu — la règle ne peut
 * pas distinguer « trop long par nature » de « trop long parce qu'on écrit ».
 * Elle attrape ce que le produit AFFICHE de lui-même.
 */
export const MESURER_VALEUR_ROGNEE = () => {
  const defauts = []
  let mesures = 0
  const regle = document.createElement('span')
  regle.style.cssText =
    'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;pointer-events:none'
  document.body.appendChild(regle)

  for (const champ of document.querySelectorAll('input, select')) {
    if (champ.type === 'hidden' || champ.type === 'checkbox' || champ.type === 'radio') continue
    if (!champ.getClientRects().length) continue
    /* Ce que le champ MONTRE : sa valeur, ou son gabarit quand il est vide. Un
       `<select>` montre le libellé de son option retenue. */
    const montre =
      champ.tagName === 'SELECT'
        ? (champ.options[champ.selectedIndex]?.textContent ?? '')
        : champ.value || champ.placeholder || ''
    if (!montre.trim()) continue
    mesures += 1

    const style = getComputedStyle(champ)
    regle.style.font = style.font
    regle.style.letterSpacing = style.letterSpacing
    regle.textContent = montre
    const largeurDuTexte = regle.getBoundingClientRect().width

    /* LA BOÎTE DE CONTENU : `clientWidth` porte encore les rembourrages. Un
       `<select>` réserve en plus la place de son chevron, que le navigateur
       n'expose pas — seize pixels, la valeur de tous ceux du produit. */
    const offert =
      champ.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0') -
      (champ.tagName === 'SELECT' ? 16 : 0)

    const manque = Math.round(largeurDuTexte - offert)
    /* DEUX PIXELS DE MARGE : les largeurs sont fractionnaires dès qu'un zoom ou
       une densité d'écran s'en mêle, et un demi-pixel n'a coupé aucune lettre. */
    if (manque <= 2) continue
    defauts.push({
      texte: montre.trim().slice(0, 48),
      manque,
      offert: Math.round(offert),
    })
  }
  regle.remove()
  return { mesures, defauts }
}

export const MESURER_BLANC_IMPOSE = () => {
  // Inlinée : cette fonction est SÉRIALISÉE vers le navigateur, elle n'emporte
  // aucune fermeture. Une constante du module y vaudrait `undefined`.
  const SEUIL_DE_PARITE = 0.8
  const depart = performance.now()
  const releves = []
  let cellulesSondees = 0

  const distribueSonEspace = (el, style) => {
    if (style.display !== 'flex' && style.display !== 'grid') return false
    const enColonne = style.flexDirection.startsWith('column')
    const reparti = enColonne ? style.justifyContent : style.alignItems
    if (reparti !== 'normal' && reparti !== 'stretch' && !/^(flex-)?start$/.test(reparti)) return true
    // `mt-auto` : le pied de carte poussé en bas. Le blanc est alors AU-DESSUS
    // de lui, donc consommé volontairement, et le mesurer sous lui n'a plus de
    // sens — il vaut zéro par construction.
    return [...el.children].some((k) => getComputedStyle(k).marginTop === 'auto')
  }

  for (const grille of document.querySelectorAll('*')) {
    const style = getComputedStyle(grille)
    if (style.display !== 'grid' && style.display !== 'flex') continue
    if (style.display === 'flex' && style.flexDirection.startsWith('column')) continue
    // Seul l'étirement impose : `center`, `end`, `baseline` laissent la cellule
    // à sa hauteur naturelle, donc sans vide à l'intérieur.
    if (style.alignItems !== 'normal' && style.alignItems !== 'stretch') continue

    const cellules = [...grille.children].filter((c) => {
      const p = getComputedStyle(c).position
      return p === 'static' || p === 'relative'
    })
    if (cellules.length < 2) continue

    /*
      PAIRS À 80 % DE LEURS CLASSES, et non à l'identique.

      Le critère strict — même chaîne de classes — a rendu un faux positif
      immédiatement : les trois cartes de rôle de la prise en main portent des
      classes d'ÉTAT différentes selon celle qui est choisie, et 22 px de blanc
      leur étaient reprochés. Ce sont pourtant des pairs au sens le plus fort du
      terme : le même composant, rendu trois fois, dans une rangée de choix.

      Le recouvrement des JETONS les réunit sans réunir n'importe quoi : une
      carte sélectionnée et sa voisine partagent tout sauf deux ou trois classes
      de bordure et de fond.

      LE SEUIL EST UN JUGEMENT, ET LES CHIFFRES SONT MESURÉS. Les parités
      relevées sur le produit : 0 % pour la colonne de marque de la vitrine
      contre ses colonnes de liens, 10 % pour le panneau de marque de
      l'inscription, 42 % pour la carte de confidentialité des pièces, 67 % pour
      les trois cartes de rôle de la prise en main. Aucun seuil ne sépare
      proprement ces quatre-là : 67 % doit passer et 42 % doit rougir, mais les
      deux sont des rangées de deux à trois cellules et rien dans leurs classes
      ne les distingue mieux que ça.

      D'OÙ `data-rangee-de-pairs`. Le seuil reste à 80 % — assez haut pour
      n'épargner que des cellules quasi identiques — et une rangée dont la
      parité est vraie mais indémontrable la DÉCLARE. C'est un attribut qui dit
      quelque chose de vrai sur le produit, pas une tolérance qui blanchit un
      défaut : la différence est qu'on peut le lire et le contredire.
    */
    const jetons = cellules.map((c) =>
      new Set((typeof c.className === 'string' ? c.className : '').split(/\s+/).filter(Boolean)),
    )
    let pireRecouvrement = 1
    for (const a of jetons)
      for (const b of jetons) {
        if (a === b) continue
        const communs = [...a].filter((x) => b.has(x)).length
        const total = new Set([...a, ...b]).size
        if (total) pireRecouvrement = Math.min(pireRecouvrement, communs / total)
      }
    // Une rangée peut DÉCLARER sa parité quand les classes ne suffisent pas à
    // l'établir — voir l'en-tête.
    if (grille.hasAttribute('data-rangee-de-pairs')) continue

    /*
      UN MARQUEUR COMMUN VAUT DÉCLARATION, et le produit en pose déjà.

      Les quatre cartes d'une rangée d'indicateurs portent chacune
      `data-indicateur` — un attribut que `StatCard` émet depuis le lot des
      tuiles, pour d'autres mesures. Elles n'en restent pas moins des étrangères
      pour le recouvrement de classes : celle qui porte un ÉTAT prend une
      bordure de sa famille, et la parité tombe à 75 %. Mesuré : 52 px reprochés
      à la carte « Encaissé ce mois-ci » d'une rangée de quatre pairs.

      Quand toutes les cellules d'une rangée partagent un même nom d'attribut
      `data-`, elles sont le même objet rendu N fois — c'est ce qu'un marqueur
      de mesure signifie. Aucun attribut à inventer, aucune tolérance à écrire.
    */
    const marqueurs = cellules.map(
      (c) => new Set([...c.attributes].map((a) => a.name).filter((n) => n.startsWith('data-'))),
    )
    const communs = marqueurs.reduce(
      (acc, m) => (acc === null ? new Set(m) : new Set([...acc].filter((n) => m.has(n)))),
      /** @type {Set<string> | null} */ (null),
    )
    if (communs && communs.size > 0) continue

    if (pireRecouvrement >= SEUIL_DE_PARITE) continue // rangée de pairs — voir l'en-tête

    /*
      REGROUPÉES PAR RANGÉE, et non par grille. Une grille de huit cartes sur
      deux rangées n'étire pas la première sur la seconde : chaque rangée a sa
      propre hauteur, et comparer une cellule à une voisine d'une autre rangée
      inventerait un blanc que personne ne subit. Le haut arrondi suffit à les
      séparer — deux cellules d'une même rangée le partagent exactement.
    */
    const rangees = new Map()
    for (const c of cellules) {
      const haut = Math.round(c.getBoundingClientRect().top)
      rangees.set(haut, [...(rangees.get(haut) ?? []), c])
    }

    for (const [, rangee] of rangees) {
      if (rangee.length < 2) continue
      for (const cellule of rangee) {
        const boite = cellule.getBoundingClientRect()
        // Une cellule minuscule n'a pas de vide qui se lise : le seuil est la
        // hauteur d'une carte la plus basse du produit, pas un chiffre rond.
        if (boite.height < 64) continue
        const cs = getComputedStyle(cellule)
        if (distribueSonEspace(cellule, cs)) continue
        /*
          UN CREUX QU'ON NE VOIT PAS N'EST PAS UN CREUX.

          La cellule doit PEINDRE quelque chose pour que son vide se lise. Une
          colonne sans fond ni bordure n'est qu'un repère de mise en page : son
          bas s'étire dans la couleur de la section, et personne ne peut dire où
          elle finit. Deux relevés sur six l'étaient — la colonne de marque du
          pied de page et une colonne d'empilement de l'espace locataire, 202 et
          143 px de vide invisible sur du fond déjà sombre ou déjà clair.

          Le critère est le fond OPAQUE ou la bordure visible : c'est ce qui
          dessine le bord bas de la boîte, donc ce qui rend le vide mesurable à
          l'œil autant qu'à la sonde.
        */
        const fond = cs.backgroundColor
        const peint =
          fond !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(fond) && fond !== 'rgba(0, 0, 0, 0)'
        const borde = parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none'
        if (!peint && !borde) continue
        cellulesSondees++

        const basDuContenu =
          boite.top + cellule.clientTop + cellule.clientHeight - parseFloat(cs.paddingBottom)
        let bas = -Infinity
        for (const noeud of cellule.childNodes) {
          if (noeud.nodeType === 1) {
            const p = getComputedStyle(noeud).position
            if (p !== 'static' && p !== 'relative') continue
            const b = noeud.getBoundingClientRect()
            if (b.height) bas = Math.max(bas, b.bottom)
          } else if (noeud.nodeType === 3 && noeud.textContent.trim()) {
            const plage = document.createRange()
            plage.selectNodeContents(noeud)
            for (const b of plage.getClientRects()) if (b.height) bas = Math.max(bas, b.bottom)
          }
        }
        if (!isFinite(bas)) continue

        const blanc = Math.round(basDuContenu - bas)
        // Quatre pixels : le bruit d'arrondi d'une grille en fractions. Mesuré
        // sur cinq écrans à quatre largeurs, aucun relevé non pair ne tombe
        // entre 3 et 200 — la distribution est franchement bimodale.
        if (blanc <= 4) continue

        releves.push({
          signature:
            `${cellule.tagName.toLowerCase()}.${typeof cellule.className === 'string' ? cellule.className : ''}`.slice(
              0,
              120,
            ),
          blanc,
          hauteur: Math.round(boite.height),
          part: Math.round((blanc / boite.height) * 100),
          texte: (cellule.textContent || '').trim().slice(0, 40),
          parite: Math.round(pireRecouvrement * 100),
        })
      }
    }
  }

  // Compté pour que le rapport dise ce qu'il a REGARDÉ : une sonde qui ne
  // trouverait plus une seule cellule étirée rendrait « aucun blanc imposé »
  // avec la même sérénité qu'un produit sain.
  return { cellules: cellulesSondees, ms: performance.now() - depart, releves }
}

/**
 * ─── L'ORPHELIN D'UNE COUPURE ────────────────────────────────────────────────
 *
 * CE QUE LES DEUX AUTRES RÈGLES DE TEXTE NE VOIENT PAS. Le débordement de page
 * et le débordement local répondent à « le contenu sort-il de sa boîte ». Un
 * libellé qui se coupe MAL ne sort de rien : il tient, et il est illisible.
 * « Payment / s » occupe exactement la même boîte que « Pay- / ments ».
 *
 * D'OÙ ELLE VIENT. La barre basse porte cinq cellules de 51 px à 320 px, et
 * aucun libellé de ce métier n'y tient sur une ligne. Le repli coupe entre les
 * MOTS ; un libellé d'un seul mot n'offre rien à couper, et le mot sortait de sa
 * cellule pour se peindre sur la voisine. `hyphens-auto` + `break-words` a
 * corrigé le CHEVAUCHEMENT — mais mesuré ensuite : ce Chromium a un dictionnaire
 * de césure FRANÇAIS et pas d'ANGLAIS. « Signalements » se coupe proprement en
 * « Signa- / lements » ; « Payments » retombe sur `break-words` et donne
 * « Payment / s », « Dashboard » donne « Dashboa / rd ».
 *
 * TROIS CARACTÈRES, ET LE SEUIL EST UN JUGEMENT. En dessous, le fragment ne se
 * lit plus comme la fin d'un mot mais comme une coquille — un « s » seul sous
 * « Payment » ressemble à une faute de frappe, pas à une césure. Au-dessus, on
 * interdirait des coupures que le français produit légitimement : « Parc im- /
 * mobilier » laisse deux caractères en FIN de première ligne, ce que cette règle
 * ne regarde pas — elle ne juge que la DERNIÈRE ligne, celle qui reste seule.
 * Je n'ai pas de mesure qui fonde le trois ; j'ai deux cas à deux caractères qui
 * se lisent mal et un à cinq qui se lit bien.
 *
 * ELLE NE COUVRE QUE LES LIBELLÉS MARQUÉS. `[data-mesure="libelle-barre-basse"]`
 * et rien d'autre : généraliser à tout le texte de l'application demanderait un
 * registre de tolérances entier, et le défaut connu vit dans cinq cellules.
 */
export const MESURER_COUPURES = () => {
  const defauts = []
  let mesures = 0
  for (const el of document.querySelectorAll('[data-mesure="libelle-barre-basse"]')) {
    const noeud = el.firstChild
    if (!noeud || noeud.nodeType !== 3) continue
    const texte = noeud.textContent
    if (!texte.trim()) continue
    mesures += 1

    /*
      LE DÉCOUPAGE SE LIT DANS LES RECTANGLES, caractère par caractère.

      `getClientRects` d'un `Range` d'UN caractère rend la ligne où il tombe ;
      on regroupe par ordonnée. C'est la seule façon de savoir où le navigateur
      a coupé — le DOM, lui, ne porte qu'une chaîne d'un seul tenant.
    */
    const plage = document.createRange()
    const lignes = []
    for (let i = 0; i < texte.length; i++) {
      plage.setStart(noeud, i)
      plage.setEnd(noeud, i + 1)
      /*
        LE DERNIER RECTANGLE, PAS LE PREMIER, et c'est une correction mesurée.

        À un point de coupure, la plage d'UN caractère rend DEUX rectangles :
        un de largeur nulle en fin de ligne précédente, puis celui du glyphe sur
        la ligne suivante. Prendre `[0]` attribuait donc le premier caractère de
        chaque nouvelle ligne à la ligne d'AVANT — la découpe imprimée valait
        « Dash­b / oard » là où l'écran montre « Dash- / board », et l'orphelin
        était compté un caractère trop court. Le verdict tenait par chance ; il
        aurait basculé sur un orphelin de trois.
      */
      const rectangles = plage.getClientRects()
      const boite = rectangles[rectangles.length - 1]
      if (!boite) continue
      const haut = Math.round(boite.top)
      const derniere = lignes[lignes.length - 1]
      if (derniere && derniere.haut === haut) derniere.texte += texte[i]
      else lignes.push({ haut, texte: texte[i] })
    }
    if (lignes.length < 2) continue

    // Seule la DERNIÈRE ligne compte : c'est le fragment qui reste seul sous le
    // reste du mot. Les espaces ne comptent pas — « s » et « s » se lisent pareil.
    const orphelin = lignes[lignes.length - 1].texte.trim()
    if (orphelin.length >= 3) continue
    defauts.push({
      texte,
      orphelin,
      decoupe: lignes.map((l) => l.texte.trim()).join(' / '),
    })
  }
  return { mesures, defauts }
}

/**
 * UN TEXTE QUE LE PRODUIT ÉCRIT NE SE ROGNE PAS.
 *
 * CE QU'ELLE COUVRE, ET POURQUOI RIEN D'AUTRE NE LE VOIT. Un texte rogné —
 * `truncate` en largeur, `line-clamp` en hauteur — ne DÉBORDE de rien : il est
 * coupé À L'INTÉRIEUR de sa boîte, par un `overflow: hidden` posé exprès. Les
 * deux règles de débordement, la globale et la locale, le laissent donc passer
 * par construction. Le contraste le lit très bien. Les cibles ne le regardent
 * pas. Et le DOM porte la chaîne ENTIÈRE : un cas de rendu qui interroge le
 * texte la trouve, et passe au vert sur un écran qui n'en montre que la moitié.
 *
 * ═══ ELLE NE REGARDAIT QUE LES INTITULÉS D'INDICATEUR, ET SA PROPRE
 *     JUSTIFICATION EST CE QUI L'A FAIT ÉLARGIR ═══
 *
 * Sa rédaction d'origine bornait le balayage à `[data-indicateur]
 * [data-intitule]` et motivait ce bornage ainsi, mot pour mot :
 *
 *   « Tant qu'un intitulé porte du VOCABULAIRE FIXE — reste à percevoir, taux
 *     d'occupation — la coupe reste théorique : ces mots tiennent partout, et
 *     personne ne les allonge. »
 *
 * « Reste à percevoir » a été trouvé ROGNÉ, à l'écran, dans la réconciliation
 * de l'anneau de recouvrement — c'est-à-dire à l'endroit exact où ce libellé est
 * REPRIS À L'IDENTIQUE de l'indicateur, délibérément, pour que le lecteur
 * referme la boucle entre les deux. Le contre-exemple choisi pour prouver que la
 * règle pouvait rester étroite était le défaut.
 *
 * Ce qui n'était pas faux dans le raisonnement : un vocabulaire fixe ne
 * s'allonge pas. Ce qui l'était : sa boîte, elle, RÉTRÉCIT — une colonne de
 * grille, une police de base agrandie, une traduction plus longue. La longueur
 * du texte n'est qu'un des deux termes de la comparaison.
 *
 * ═══ LA POLICE DE BASE AGRANDIE — LA DIMENSION QUI MANQUAIT ═══
 *
 * Le balayage mesurait onze largeurs à UNE seule taille de police racine. Or ce
 * dépôt écrit ses requêtes de média en `rem` EXPRÈS — `useAuDela` le dit :
 * « pour suivre la feuille de style quand la police de base grossit ». Une
 * configuration qu'on déclare supporter et qu'on ne mesure jamais n'est pas
 * supportée, elle est espérée.
 *
 * Mesuré : à 22 px de racine, « Reste à percevoir » manque 14 px à 1280, et le
 * bandeau de démonstration manque 109 px. À 16 px, les deux tiennent. C'est le
 * seul réglage sous lequel le défaut rapporté se reproduit.
 *
 * AUCUN CHARGEMENT DE PLUS : la sonde change `font-size` sur la racine, relit la
 * géométrie, et REPOSE la valeur d'origine dans un `finally`. Ce qui coûte, ce
 * sont les navigations, jamais les reflows.
 *
 * ═══ CE QUI A LE DROIT D'ÊTRE ROGNÉ, ET COMMENT IL LE DIT ═══
 *
 * Une DONNÉE — un nom de locataire, un nom d'immeuble — n'a pas de longueur
 * bornée : la rogner est le seul comportement tenable, et lui rendre la place
 * n'a pas de sens puisqu'il n'y a pas de « assez ». Ces textes se déclarent par
 * `data-donnee` sur leur boîte ou sur un ancêtre.
 *
 * UN ATTRIBUT PLUTÔT QU'UNE LISTE DE TEXTES TOLÉRÉS, et c'est un choix contre le
 * précédent de `MOTS_DEBORDANTS_TOLERES` : les textes en question sont ceux du
 * jeu de démonstration — « Charles Ngassa », « Résidence Bonamoussadi ». Une
 * liste les recopierait ici, et le jour où la démonstration change de locataire,
 * la garde rougirait sur un défaut qui n'existe pas pendant que le vrai passerait.
 * L'attribut, lui, vit là où la décision se prend, et se relit avec le composant.
 *
 * DEUX AXES, PAS UN. `scrollWidth` attrape le rognage en LARGEUR (`truncate`),
 * `scrollHeight` celui en HAUTEUR (`line-clamp`).
 *
 * LA TOLÉRANCE D'UN PIXEL est du bruit d'arrondi : `scrollWidth` et
 * `clientWidth` sont entiers, la largeur de boîte ne l'est pas.
 */
export const MESURER_TRONCATURES = ({ racine }) => {
  const html = document.documentElement
  const avant = html.style.fontSize
  if (racine) html.style.fontSize = `${racine}px`
  try {
    const defauts = []
    let mesures = 0
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      /* Les DEUX façons de rogner un texte. `webkitLineClamp` rend la chaîne
         `'none'` quand il n'est pas posé — c'est la seule propriété calculée qui
         dise si un `line-clamp` est en vigueur. */
      const clamp = cs.webkitLineClamp !== 'none'
      if (cs.textOverflow !== 'ellipsis' && !clamp) continue
      const texte = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!texte) continue
      // La déclaration vaut pour le sous-arbre : une cellule de tableau porte
      // souvent le marqueur pour le `<span>` qui rogne à l'intérieur.
      if (el.closest('[data-donnee]')) continue
      mesures += 1
      /*
        `text-ellipsis` NE COUPE RIEN TANT QUE LA BOÎTE LAISSE SORTIR, et la
        première rédaction de cette sonde l'ignorait — elle a rendu douze faux
        positifs sur les étiquettes de mois du graphe.

        Celles-ci portent `text-ellipsis` en permanence mais `overflow-visible`
        sous `sm` : le mot dépasse alors sur la colonne voisine, qui est
        `invisible` et lui laisse la place — c'est un réglage DÉLIBÉRÉ, écrit et
        mesuré dans `Charts.tsx`. Le texte y est entier à l'écran. Une sonde qui
        lit la seule déclaration `text-overflow` accuse un composant d'un défaut
        qu'il a précisément pris soin d'éviter.

        On exige donc que la boîte ROGNE VRAIMENT sur l'axe considéré. Un
        `line-clamp` implique son propre `overflow: hidden`, et se juge seul.
      */
      const enLargeur = cs.overflowX === 'visible' ? 0 : el.scrollWidth - el.clientWidth
      const enHauteur =
        !clamp && cs.overflowY === 'visible' ? 0 : el.scrollHeight - el.clientHeight
      if (enLargeur <= 1 && enHauteur <= 1) continue
      defauts.push({
        texte,
        axe: enLargeur > 1 ? 'largeur' : 'hauteur',
        manque: Math.round(Math.max(enLargeur, enHauteur)),
        offert: Math.round(enLargeur > 1 ? el.clientWidth : el.clientHeight),
        racine: racine || 16,
      })
    }
    return { mesures, defauts }
  } finally {
    html.style.fontSize = avant
  }
}

/**
 * CE QUI DÉCIDE ET CE QUI AGIT NE SE CACHENT PAS DERRIÈRE UN DÉFILEMENT.
 *
 * ═══ CE QUI L'A FAIT ÉCRIRE ═══
 *
 * La grille des paiements porte une dernière colonne SANS EN-TÊTE : elle tient
 * « Quittance » et, pour le propriétaire d'un bail en retard, « Mise en
 * demeure ». Mesuré : la table fait 1063 px dans un conteneur de 958 à 1280 px
 * de fenêtre, et de 702 à 1024. Cent cinq pixels de gestes hors champ à la
 * largeur d'écran la plus courante, trois cent soixante et un à la précédente.
 *
 * Rien ne le dit. `overflow-x-auto` ne peint aucune barre tant qu'on ne défile
 * pas, la colonne n'a pas d'intitulé qui dépasserait pour trahir sa présence, et
 * les six colonnes de période qui la poussent dehors, elles, se voient très
 * bien. L'écran a donc l'air complet. On ne cherche pas ce dont on ignore
 * l'existence.
 *
 * ═══ POURQUOI AUCUNE AUTRE RÈGLE NE LE VOIT ═══
 *
 * Ce n'est PAS un débordement : la table défile dans sa propre boîte, ce que le
 * dépôt exige partout — le document ne bouge pas d'un pixel, et c'est la règle
 * de page comme celle des débords locaux qui le certifient. Ce n'est pas un
 * ROGNAGE non plus : rien n'est coupé, tout est peint, simplement en dehors de
 * la fenêtre de défilement. Et ce n'est pas une CIBLE trop petite : le bouton
 * fait ses 44 px, là où personne ne le voit.
 *
 * Trois règles passent au vert sur une action introuvable. La différence tient
 * en un mot : les autres mesurent ce qui SORT, celle-ci mesure ce qui n'entre
 * jamais.
 *
 * ═══ CE QU'ELLE MESURE, ET CE QU'ELLE ADMET ═══
 *
 * Le bord droit de chaque cellule de geste contre le bord droit VISIBLE de sa
 * boîte de défilement, à la position de repos — c'est-à-dire ce que l'écran
 * montre avant qu'on ait touché à quoi que ce soit.
 *
 * Une colonne COLLANTE satisfait la règle par construction : son rectangle reste
 * dans la fenêtre quel que soit le défilement, ce qui est exactement la
 * propriété demandée. La règle ne prescrit donc pas le remède — elle décrit ce
 * qu'un geste doit être, et laisse la mise en page s'en arranger.
 *
 * ═══ LE VERDICT SUBIT LE MÊME SORT, ET IL N'EST PAS GARDÉ ICI ═══
 *
 * Rendre la colonne d'action collante a ramené les gestes sous les yeux — et
 * elle recouvrait alors la pastille d'état : « À j… », « En… ». Le correctif
 * avait déplacé le défaut d'une colonne. Les paiements l'ont réglé en passant le
 * verdict et le solde DEVANT l'histoire ; les autres écrans, non.
 *
 * Élargie aux cellules d'état, cette règle a mesuré, à 1024 px exactement — la
 * fenêtre fait 1024, la barre latérale en prend 256, le contenu tombe à 704 :
 *
 *     /demo/locataires   table 841 px (fr) / 812 (en)  →  137 / 108 hors champ
 *     /demo/cautions     table 832 px (fr) / 791 (en)  →  129 /  88 hors champ
 *
 * ELLE N'EST PAS GARDÉE, ET C'EST UN CHOIX ASSUMÉ. Deux tentatives ont été
 * écartées :
 *
 *   · une table de dispenses plafonnées, comme les mots débordants. Elle a
 *     CLIGNOTÉ : trois passages successifs du balayage ont rendu trois
 *     ensembles différents, les libellés anglais des cautions apparaissant et
 *     disparaissant. Une garde qui n'est pas reproductible ne garde rien, et
 *     une dispense qu'on rechargerait à chaque flottement est pire que pas de
 *     dispense du tout. La cause du flottement n'est pas établie.
 *   · remonter la bascule fiche/tableau à `xl`. Elle réglerait ces deux-là et
 *     en casserait d'autres : à 1279 px le contenu vaut 959, et les tableaux du
 *     Parc comme des Relevés y tiennent très bien.
 *
 * La vraie réponse est de mesurer le CONTENANT et non la fenêtre : une largeur
 * de fenêtre ne peut pas décider pour un tableau dont la place dépend de la
 * barre latérale ET de son propre nombre de colonnes. Le dépôt sait le faire —
 * il l'a fait pour le tableau de bord du locataire, avec cet argument exact —
 * mais ici la forme se choisit AU RENDU et non dans la feuille de style, donc
 * il faut observer la boîte plutôt que déclarer une requête. C'est un lot.
 *
 * Ce qui est gardé ici est donc ce qui est TENU : le geste. Le verdict est
 * mesuré, écrit, et attend.
 *
 * `data-colonne-tenue` plutôt qu'un sélecteur de classe : `scripts/` est balayé
 * par le générateur d'utilitaires Tailwind, et y écrire un nom de classe en
 * fabriquerait un. Même raison que `data-intitule`.
 */
export const MESURER_GESTES_ATTEIGNABLES = () => {
  const defauts = []
  const nus = []
  let mesures = 0
  let commandes = 0
  for (const cellule of document.querySelectorAll('[data-colonne-tenue="geste"]')) {
    /* L'en-tête d'une colonne de gestes est souvent VIDE — il n'y a rien à
       intituler, « une colonne d'action n'a pas de nom parce que son bouton
       porte le sien ». Une cellule sans contenu ne montre rien et ne prouve
       rien : on ne juge que ce qui a quelque chose à cacher. */
    if (!(cellule.textContent || '').trim() && !cellule.querySelector('a, button')) continue
    /*
      ET LA COMMANDE PORTE UN GLYPHE.

      Mesuré sur le registre des accès : « Retirer l'accès » et « Reprendre »
      étaient des boutons fantômes NUS — encre pleine, sans bord, sans fond,
      sans signe. Dans une colonne de tableau, entre un nom et une date, cela se
      lit comme une donnée de plus, et le SURVOL est le premier moment où l'on
      apprend que c'en est une commande. Trois fois de suite sur la colonne.

      Les autres colonnes de geste du produit portaient déjà une icône ; ces
      deux-là étaient les seules sans, et ce sont celles qui retirent un accès.
      La règle existait donc en fait et pas en garde : je l'ai vérifiée à la
      main sur trois colonnes, ce qui ne dit rien de la quatrième qu'on écrira.

      CE N'EST PAS UNE RÈGLE DE DÉCORATION. Une colonne de geste n'a pas
      d'intitulé — « son bouton porte le sien », dit `DataTable` — donc rien
      au-dessus ne prévient qu'on entre dans des commandes. Le glyphe est le
      seul signe qui reste, et il est là AU REPOS, ce qu'aucun état de survol
      ne peut offrir à un doigt.

      On ne juge que ce qui est peint : un bouton `sr-only` ou masqué n'est pas
      une commande qu'on lit.
    */
    for (const commande of cellule.querySelectorAll('a, button')) {
      if (!commande.getClientRects().length) continue
      commandes += 1
      if (commande.querySelector('svg')) continue
      nus.push(
        (commande.textContent || commande.getAttribute('aria-label') || '?').trim().slice(0, 40),
      )
    }

    const boite = cellule.closest('[data-defilant]')
    if (!boite) continue
    mesures += 1
    const c = cellule.getBoundingClientRect()
    const b = boite.getBoundingClientRect()
    const cache = Math.round(c.right - b.right)
    if (cache <= 1) continue
    const commande = cellule.querySelector('a, button')
    defauts.push({
      geste: `${cellule.dataset.colonneTenue} · ${(
        commande?.textContent ||
        commande?.getAttribute('aria-label') ||
        cellule.textContent ||
        '?'
      )
        .trim()
        .slice(0, 40)}`,
      cache,
      largeurVue: Math.round(b.width),
      largeurTable: Math.round(boite.scrollWidth),
    })
  }
  return { mesures, defauts, nus, commandes }
}

export const MESURER_DEBORDEMENT_DE_MOT = () => {
  const defauts = []
  let mesures = 0
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    /*
      LES ESPACES SONT NORMALISÉES, et une garde du garde l'a exigé.

      `Intl` compose les montants avec une espace insécable ÉTROITE (U+202F) :
      « 950 000 FCFA » vu à l'écran s'écrit avec un caractère qu'aucun clavier ne
      pose et qu'une relecture de diff ne distingue pas d'une espace ordinaire.
      La première rédaction du registre de tolérances a été écrite avec l'espace
      ordinaire ; les clés ne correspondaient à rien, la garde du garde a signalé
      trois dispenses « qui ne couvrent plus rien », et c'est ainsi que le piège
      a été trouvé plutôt que subi.

      On normalise donc ICI, une fois, pour que la clé du registre soit un texte
      qu'un humain peut écrire et relire. C'est le seul endroit où la comparaison
      a lieu, donc le seul endroit où la normalisation doit vivre.
    */
    const texte = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!texte) continue
    const cs = getComputedStyle(el)
    if (cs.overflowX !== 'visible') continue
    if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') continue
    if (cs.display === 'inline') continue
    mesures += 1
    /* La tolérance d'un pixel est du bruit d'arrondi : `scrollWidth` et
       `clientWidth` sont entiers, la largeur de boîte ne l'est pas. Même
       raisonnement que `MESURER_TRONCATURES`. */
    const trop = el.scrollWidth - el.clientWidth
    if (trop <= 1) continue
    defauts.push({ texte, manque: Math.round(trop), offert: Math.round(el.clientWidth) })
  }
  return { mesures, defauts }
}

/**
 * LA PAGE A-T-ELLE RENDU ? — la question qu'aucune règle de ce fichier ne posait.
 *
 * POURQUOI ELLE MANQUAIT, ET POURQUOI CE N'EST PAS `if (!resultat) continue`.
 * `MESURER`, juste en dessous, rend `null` quand la page NE DÉBORDE PAS : c'est
 * le résultat SAIN, et de très loin le plus fréquent. Mesuré sur ce dépôt :
 * 506 points de mesure sur 506 passent par ce `continue`, dont 484 sont des
 * écrans parfaitement rendus qui ne débordent simplement pas. Transformer ce
 * `continue` en refus refuserait le balayage entier. Le trou n'était pas là :
 * il était dans l'ABSENCE d'une question posée AVANT la règle du débordement.
 *
 * LE CRITÈRE EST CATÉGORIQUE, PAS NUMÉRIQUE, et c'est délibéré. Un seuil en
 * nombre d'éléments aurait été facile — `/app` en rend 3, le plus dégarni des
 * écrans sains en rend 54, n'importe quel seuil entre les deux marche
 * aujourd'hui. Mais un tel seuil est un nombre que le premier écran
 * légitimement sobre fera relever par réflexe, et qui aura alors cessé de
 * garder quoi que ce soit. On demande donc deux choses qu'un écran de produit
 * a toujours et qu'un squelette de chargement n'a jamais :
 *
 *   UN TITRE  (h1–h3)            : mesuré, minimum 1 sur les 22 écrans sains ;
 *   UN ÉLÉMENT INTERACTIF        : mesuré, minimum 9 sur les 22 écrans sains.
 *
 * `/app` en rend 0 et 0. La marge n'est pas « 3 contre 54 », elle est « rien
 * contre quelque chose » — la seule marge qu'aucune dérive ne grignote.
 *
 * LES ERREURS JS NE SONT PAS UN CRITÈRE, et c'est une mesure qui l'a décidé :
 * les 484 points sains en portent tous, parce que `vite preview` ne mandate
 * pas `/api` et que les deux appels de session échouent partout. En faire une
 * cause de refus aurait fait rougir les vingt-deux écrans. Elles sont donc
 * RELEVÉES et jointes au refus comme contexte, jamais comme motif.
 *
 * LE THÈME EST LU DANS LA PAGE plutôt que supposé : la boucle de géométrie
 * n'en fixe aucun, et écrire « clair » dans un refus sans l'avoir demandé
 * serait une affirmation gratuite dans le seul message que quelqu'un lira.
 */
export const MESURER_RENDU = () => ({
  titres: document.querySelectorAll('h1, h2, h3').length,
  interactifs: document.querySelectorAll(
    'a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="link"]',
  ).length,
  elements: document.querySelectorAll('#root *').length,
  racineVide: !document.querySelector('#root')?.firstElementChild,
  // Lu dans la page, et non recopié depuis la constante : si un jour le
  // contexte demandait un thème que la page ne suit pas, c'est ce que la PAGE
  // rend qui doit apparaître dans le refus, pas ce qu'on croyait demander.
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair',
})

/** Exécuté DANS la page : rend les coupables, ou `null` si rien ne déborde. */
export const MESURER = () => {
  const avant = window.scrollX
  window.scrollTo(400, 0)
  const decalage = window.scrollX
  window.scrollTo(avant, 0)
  if (!decalage) return null

  const largeurVue = document.documentElement.clientWidth
  const coupables = []
  for (const el of document.querySelectorAll('*')) {
    const boite = el.getBoundingClientRect()
    if (boite.width === 0) continue
    if (boite.right <= largeurVue + 1) continue

    // Un élément large À L'INTÉRIEUR d'un conteneur qui défile n'est pas un
    // coupable : c'est le motif normal des tableaux du dépôt.
    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const debordement = getComputedStyle(ancetre).overflowX
      if (debordement === 'auto' || debordement === 'scroll' || debordement === 'hidden') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    coupables.push({
      balise: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className.slice(0, 110) : '',
      largeur: Math.round(boite.width),
      bordDroit: Math.round(boite.right),
      texte: (el.textContent || '').trim().slice(0, 44),
    })
  }
  return { decalage, largeurVue, coupables: coupables.slice(0, 6) }
}
