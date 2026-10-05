/**
 * CE QU'UN CHAMP MONTRE DE SA VALEUR.
 *
 * Deux mesures sur la boîte d'un champ : la valeur y est-elle coupée, et la
 * boîte est-elle creuse. Elles vont ensemble parce qu'elles lisent la même
 * chose — le contenu d'un champ contre la boîte qui le porte — et qu'aucune des
 * deux ne regarde du texte courant.
 *
 * LA BANNIÈRE DU BLANC IMPOSÉ A ÉTÉ RAPPROCHÉE DE SON SUJET. Dans l'ancien
 * fichier elle vivait quarante-sept lignes avant `MESURER_BLANC_IMPOSE`, avec
 * `MESURER_VALEUR_ROGNEE` entre les deux : une prose séparée de son code par
 * une autre fonction. C'est le SEUL changement d'ordre de ce découpage.
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
