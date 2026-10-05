/**
 * LE TEXTE QUI NE TIENT PAS DANS SA LIGNE.
 *
 * Trois mesures sur du texte courant : l'orphelin d'une coupure, le rognage par
 * `truncate` ou `line-clamp`, et le mot qui déborde de sa feuille. Les trois
 * partagent un raisonnement et une tolérance d'un pixel — `scrollWidth` et
 * `clientWidth` sont entiers, la largeur de boîte ne l'est pas — et deux d'entre
 * elles le disent déjà dans leur prose.
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
