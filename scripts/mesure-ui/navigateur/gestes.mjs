/**
 * CE QUI DÉCIDE ET CE QUI AGIT.
 *
 * Deux mesures sur les commandes : un geste ne se cache pas derrière un
 * défilement, et un panneau ne rejoue pas la barre. L'une cherche ce qui est
 * hors d'atteinte, l'autre ce qui est dit deux fois ; toutes deux portent sur
 * les mêmes éléments — ceux par lesquels on agit.
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
