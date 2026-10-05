/**
 * CE QUI SORT DE SA BOÎTE, ET D'ABORD : LA PAGE A-T-ELLE RENDU.
 *
 * Le débordement de page, le débordement local, et la question posée AVANT les
 * deux autres. L'ordre de ce fichier n'est pas un rangement : `MESURER_RENDU`
 * précède `MESURER` parce que sa prose renvoie à « `MESURER`, juste en dessous »
 * — les déplacer l'un sans l'autre rendrait cette phrase fausse.
 *
 * Module PUR, et parti dans le navigateur par `page.evaluate`. Il ne voit ni
 * `node:fs`, ni les tolérances, ni les plafonds : ce qu'il rend est une MESURE
 * BRUTE, et c'est `mesure-ui.mjs` qui la juge. La doctrine de cette frontière
 * vit dans `../mesures-navigateur.mjs`, qui réexporte ce fichier.
 *
 * Sorti de `mesures-navigateur.mjs` le 2026-10-05, SANS QU'UNE LIGNE CHANGE —
 * les lignes ont été DÉPLACÉES, prose comprise.
 */

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
