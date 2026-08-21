/**
 * Audit de contraste exécuté dans la page.
 *
 * Deux pièges que ce script évite :
 *  - Tailwind v4 rend les couleurs à alpha en `oklab(... / .9)`. On normalise
 *    toute chaîne CSS via un contexte canvas, qui la ramène en rgb/rgba.
 *  - Un fond semi-transparent doit être composité sur ce qu'il recouvre, sinon
 *    le ratio calculé est faux. On remonte la chaîne des ancêtres en composant.
 *
 * DEUX USAGES, UNE SEULE SOURCE.
 *
 *  1. À la main : coller le contenu dans la console du navigateur, sur la page
 *     à vérifier. Rend la liste des textes sous le seuil WCAG AA.
 *  2. À chaque `npm run check` : `scripts/mesure-ui.mjs` LIT ce fichier et
 *     l'évalue dans la page, sur le paquet construit, en deux thèmes et deux
 *     langues.
 *
 * Il le lit plutôt que d'en recopier la logique, et c'est le point : une copie
 * dériverait de l'original en silence, et ce fichier a déjà payé exactement ce
 * genre de silence — il savait trouver un contraste sous le seuil et ne l'a
 * jamais trouvé, faute d'être lancé par quoi que ce soit.
 *
 * LA FORME DU RETOUR EST UN CONTRAT depuis lors : `{ failures, items, examines }`.
 * L'expression doit rester une IIFE qui S'ÉVALUE en cet objet — c'est ce que
 * `page.evaluate` reçoit. Un `return` de plus haut niveau, ou un point-virgule
 * de trop, et la porte reçoit `undefined` sans rien dire.
 *
 * Pour l'automatiser sur plusieurs routes, copier ce fichier dans `public/dev/`
 * le temps de la session, puis :
 *
 *   const src = await (await fetch('/dev/contrast-audit.js')).text()
 *   eval(src)
 *
 * L'`eval` est ici volontaire et sans risque : il s'agit d'un outil de console
 * exécuté à la main, qui évalue ce fichier-ci servi par le serveur de
 * développement local. Rien de tout cela n'est embarqué dans l'application, et
 * aucune entrée extérieure n'est évaluée.
 *
 * Ne pas laisser la copie dans `public/` : elle serait embarquée dans le build.
 *
 * ATTENTION à l'onglet masqué. Si `document.visibilityState === 'hidden'` — cas
 * d'un panneau de prévisualisation replié — les transitions CSS se figent en
 * vol : la liste de classes est à jour mais le fond calculé reste à sa valeur
 * d'avant. Un basculement de langue ou de thème produit alors de faux échecs,
 * du texte clair paraissant posé sur un fond clair. Vérifier `visibilityState`
 * avant de conclure, ou mesurer après un rechargement plutôt qu'après une
 * bascule en page.
 *
 * ATTENTION aussi à la mesure des CIBLES TACTILES dans un onglet masqué. Les
 * modales s'ouvrent sur une animation `scale(0.96) -> scale(1)` qui reste figée
 * à son état initial, et `getBoundingClientRect` renvoie les dimensions APRÈS
 * transformation : un bouton de 44px se mesure alors à 42. Neutraliser
 * l'animation avant de mesurer, ou mesurer hors modale.
 *
 * ATTENTION à la mesure du débordement horizontal : `documentElement.scrollWidth`
 * compte la largeur de mise en page des descendants d'un conteneur à défilement,
 * et signale donc un faux positif sur un tableau large logé dans un
 * `overflow-x-auto`. Le seul critère fiable est de tenter `window.scrollTo(400, 0)`
 * et de vérifier que `window.scrollX` reste à 0.
 */
;(() => {
  const ctx = document.createElement('canvas').getContext('2d')

  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))
  const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

  /**
   * oklab() -> sRGB.
   * Nécessaire car Tailwind v4 émet de l'oklab dès qu'une couleur porte un
   * alpha, et ni `canvas.fillStyle` ni un parseur naïf ne le décodent : le
   * canvas retombe silencieusement sur la valeur précédente, ce qui faisait
   * passer un fond crème pour du noir.
   */
  function oklabToRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.291485548 * b
    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_
    return [
      clamp255(gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
      clamp255(gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
      clamp255(gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    ]
  }

  /** Toute couleur CSS -> [r, g, b, a] */
  function toRgba(input) {
    if (!input || input === 'transparent') return [0, 0, 0, 0]

    const oklab = input.match(/^oklab\(([^)]+)\)$/)
    if (oklab) {
      const parts = oklab[1].split('/')
      const [L, a, b] = parts[0].trim().split(/\s+/).map(parseFloat)
      const alphaRaw = parts[1] ? parts[1].trim() : '1'
      const alpha = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw)
      return [...oklabToRgb(L, a, b), alpha]
    }

    // Sentinelle : si le canvas ne sait pas décoder, fillStyle reste inchangé.
    ctx.fillStyle = '#010203'
    ctx.fillStyle = input
    const normalised = ctx.fillStyle
    if (normalised === '#010203' && input !== '#010203') {
      console.warn('[audit] couleur non décodée :', input)
      return [0, 0, 0, 0]
    }

    if (normalised.startsWith('#')) {
      const h = normalised.slice(1)
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        1,
      ]
    }
    const n = normalised.match(/[\d.]+/g).map(Number)
    return [n[0], n[1], n[2], n[3] ?? 1]
  }

  /** Compose src (avec alpha) au-dessus de dst (opaque). */
  function over(src, dst) {
    const a = src[3]
    return [
      src[0] * a + dst[0] * (1 - a),
      src[1] * a + dst[1] * (1 - a),
      src[2] * a + dst[2] * (1 - a),
      1,
    ]
  }

  /** Fond effectif derrière un élément, alpha compositée. */
  function effectiveBackground(el) {
    const stack = []
    let node = el
    while (node && node !== document.documentElement) {
      const rgba = toRgba(getComputedStyle(node).backgroundColor)
      if (rgba[3] > 0) {
        stack.push(rgba)
        if (rgba[3] === 1) break
      }
      node = node.parentElement
    }
    let base = [255, 255, 255, 1]
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
    return base
  }

  const linear = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
  const contrast = (a, b) => {
    const la = luminance(a)
    const lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  const failures = []
  const seen = new Set()

  let examines = 0
  document.querySelectorAll('*').forEach((el) => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return

    // Seuls les éléments portant directement du texte : sinon on compte
    // chaque ancêtre en double.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (ownText.length < 2) return

    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.opacity === '0') return
    // Texte masqué aux voyants (sr-only) : hors périmètre visuel.
    if (el.classList.contains('sr-only')) return

    const fg = over(toRgba(cs.color), effectiveBackground(el))
    const bg = effectiveBackground(el)
    const ratio = contrast(fg, bg)

    examines++
    const size = parseFloat(cs.fontSize)
    const weight = parseInt(cs.fontWeight, 10) || 400
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700)
    const required = isLarge ? 3 : 4.5

    if (ratio < required) {
      const key = `${ownText.slice(0, 30)}|${cs.color}`
      if (seen.has(key)) return
      seen.add(key)
      failures.push({
        text: ownText.slice(0, 45),
        ratio: Math.round(ratio * 100) / 100,
        required,
        fontSize: size,
        weight,
        color: cs.color,
        bg: `rgb(${bg.map((v) => Math.round(v)).slice(0, 3).join(', ')})`,
      })
    }
  })

  failures.sort((a, b) => a.ratio - b.ratio)
  /*
    ON REND AUSSI LE NOMBRE D'ÉLÉMENTS REGARDÉS, et pas seulement les fautifs.

    « Zéro faute » et « zéro élément examiné » s'écrivent pareil dans un
    journal, et ce fichier est le dépôt même qui a payé la confusion : il savait
    trouver un contraste sous le seuil et ne l'a jamais trouvé, faute d'être
    lancé. Maintenant qu'une porte l'exécute, le prochain silence possible n'est
    plus « personne ne le lance » mais « il ne regarde plus rien » — un sélecteur
    qui ne rend rien, une page qui n'a pas fini de peindre. Le compte le dit.
  */
  return { failures: failures.length, items: failures, examines }
})()
