/**
 * Audit des NOMS ACCESSIBLES, exécuté dans la page.
 *
 * WCAG 4.1.2 : toute commande doit porter un nom. Un bouton sans nom s'annonce
 * « bouton » et rien d'autre — le lecteur d'écran dit qu'il y a quelque chose à
 * faire sans dire quoi.
 *
 * CE FICHIER EXISTE PARCE QUE LE DÉPÔT NE MESURAIT PAS CETTE RÈGLE.
 *
 * « Zéro commande sans nom » avait été relevé à la main, une fois, sur les
 * PREMIERS RENDUS. Rien ne le rejouait : ni `vitest`, ni `mesure-ui`, ni aucun
 * des scripts de `npm run check`. `scripts/inventaire/lecture-sources.mjs` sait
 * lire des libellés, mais il lit les SOURCES et n'est lancé par aucune porte —
 * `npm run inventaire` est un relevé qu'on demande, pas une garde qui refuse.
 * La règle vivait donc sur la mémoire d'un balayage, ce qui est la manière la
 * plus courante de perdre une propriété sans jamais s'en apercevoir.
 *
 * MÊME DOUBLE USAGE QUE `contrast-audit.js`, et pour la même raison.
 *
 *  1. À la main : coller le contenu dans la console, sur la page à vérifier.
 *  2. À chaque `npm run check` : `scripts/mesure-ui.mjs` LIT ce fichier et
 *     l'évalue dans la page, sur le paquet construit — deux langues, onze
 *     largeurs, plus les surfaces qui ne s'ouvrent qu'au clic.
 *
 * Il le LIT plutôt que d'en recopier la logique. Une copie dériverait en
 * silence, et ce dépôt a déjà payé ce silence-là.
 *
 * LA FORME DU RETOUR EST UN CONTRAT : `{ anonymes, items, examinees }`.
 * L'expression doit rester une IIFE qui S'ÉVALUE en cet objet — c'est ce que
 * `page.evaluate` reçoit. Un `return` de haut niveau, et la porte reçoit
 * `undefined` sans rien dire.
 *
 * ═══ CE QUE CE CALCUL N'EST PAS ═══
 *
 * Ce n'est PAS `accname`. La spécification est longue, et ce fichier en tient
 * la part qui décide dans ce produit. Ses écarts connus, écrits pour qu'un vert
 * ne se lise pas plus large qu'il n'est :
 *
 *  - CONTENU CSS GÉNÉRÉ (`::before { content: "×" }`) : accname le compte, pas
 *    nous. Un bouton nommé uniquement ainsi serait rapporté à tort. Aucun n'existe
 *    aujourd'hui — le dépôt passe par `Icon` et `sr-only`.
 *  - SHADOW DOM : non traversé. Le produit n'en a pas.
 *  - `role="presentation"` / `role="none"` posé sur une commande : ignoré. Le cas
 *    est incohérent en soi et n'apparaît pas ici.
 *  - `<fieldset><legend>` : ne nomme pas un contrôle, et nous ne le lisons pas —
 *    accord avec la spécification, mais par omission plutôt que par décision.
 *  - RÔLES IMPLICITES : déduits d'une table courte (voir `roleDe`), pas de la
 *    table complète de HTML-AAM.
 *  - VISIBILITÉ : `display`, `visibility` et l'existence d'un rectangle. Une
 *    commande à `opacity: 0` ou repoussée hors cadre est comptée comme visible,
 *    donc exigée nommée — plus sévère que nécessaire, jamais plus permissif.
 *  - UN NOM N'EST PAS UN BON NOM : « Bouton », « Cliquez ici » ou le nom d'un
 *    locataire passent. 4.1.2 exige un nom ; 2.4.6 exige qu'il décrive, et cela
 *    ne se mesure pas ici.
 *
 * L'ACCORD AVEC UN VRAI CALCUL EST VÉRIFIÉ, pas seulement affirmé :
 * `mesure-ui.mjs` compare, en un point par langue, ce compte à celui que rend
 * `ariaSnapshot()` de Playwright — qui, lui, implémente accname. Un écart fait
 * rougir la porte. C'est la seule façon de savoir que cette liste d'écarts est
 * encore la bonne.
 */
;(() => {
  /*
    CE QU'ON APPELLE UNE COMMANDE.

    Les balises natives interactives, plus les rôles ARIA qui en déclarent une.
    La liste est ÉCRITE et non déduite : déduire « ce qui répond au clic » du
    DOM rendrait le décompte dépendant des écouteurs posés, donc silencieux dès
    qu'un composant délègue son geste à un parent.
  */
  const COMMANDES = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="slider"]',
    '[role="searchbox"]',
    '[role="textbox"]',
    '[role="spinbutton"]',
  ].join(', ')

  /*
    LES RÔLES QUI NE PRENNENT PAS LEUR NOM DE LEUR CONTENU.

    Un champ de saisie contenant « 12 000 » n'est pas nommé « 12 000 » : c'est
    sa VALEUR. Sans cette liste, tout champ rempli passerait pour nommé — un
    faux négatif qui ne se voit jamais, puisqu'il rend vert.
  */
  const SANS_NOM_PAR_CONTENU = new Set([
    'textbox',
    'searchbox',
    'spinbutton',
    'slider',
    'combobox',
    'listbox',
    'progressbar',
  ])

  /** Table courte des rôles implicites — assez pour ce produit, pas HTML-AAM. */
  const roleDe = (el) => {
    const explicite = (el.getAttribute('role') || '').trim().split(/\s+/)[0]
    if (explicite) return explicite
    const balise = el.tagName.toLowerCase()
    if (balise === 'button' || balise === 'summary') return 'button'
    if (balise === 'a') return 'link'
    if (balise === 'textarea') return 'textbox'
    if (balise === 'select') return el.hasAttribute('multiple') ? 'listbox' : 'combobox'
    if (balise === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image')
        return 'button'
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'range') return 'slider'
      if (type === 'number') return 'spinbutton'
      if (type === 'search') return 'searchbox'
      return 'textbox'
    }
    return ''
  }

  const netto = (s) => (s || '').replace(/\s+/g, ' ').trim()

  const visible = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') return false
    return el.getClientRects().length > 0
  }

  /*
    Le sous-arbre `aria-hidden` est retiré AVANT de lire le texte.

    Le dépôt s'en sert : l'astérisque d'un champ obligatoire est `aria-hidden`,
    et la mention lisible vit dans un `sr-only` à côté. Lire le texte brut
    donnerait « * » pour nom à ce qui n'en a pas.
  */
  const texteVisibleAuxOutils = (el) => {
    const clone = el.cloneNode(true)
    for (const c of clone.querySelectorAll('[aria-hidden="true"]')) c.remove()
    const t = netto(clone.textContent)
    if (t) return t
    // Une commande qui n'est qu'une image tient son nom de l'`alt` de celle-ci.
    for (const enfant of el.querySelectorAll('img[alt], [aria-label]')) {
      const a = netto(enfant.getAttribute('alt') || enfant.getAttribute('aria-label'))
      if (a) return a
    }
    return ''
  }

  /** Rend `{ nom, source }` — `source` sert au rapport, jamais à la décision. */
  const nomDe = (el, role) => {
    const parId = el.getAttribute('aria-labelledby')
    if (parId) {
      const t = netto(
        parId
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((n) => netto(n.textContent))
          .filter(Boolean)
          .join(' '),
      )
      if (t) return { nom: t, source: 'aria-labelledby' }
    }

    const etiquette = netto(el.getAttribute('aria-label'))
    if (etiquette) return { nom: etiquette, source: 'aria-label' }

    // `label[for]` : c'est par là que `Field` nomme les primitives du dépôt,
    // qui reçoivent un `id` et laissent leur `aria-label` vide.
    if (el.id) {
      const pour = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (pour) {
        const t = netto(pour.textContent)
        if (t) return { nom: t, source: 'label[for]' }
      }
    }
    const enveloppe = el.closest('label')
    if (enveloppe) {
      const t = netto(enveloppe.textContent)
      if (t) return { nom: t, source: 'label ancêtre' }
    }

    const balise = el.tagName.toLowerCase()
    if (balise === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'button' || type === 'submit' || type === 'reset') {
        const v = netto(el.getAttribute('value'))
        if (v) return { nom: v, source: 'value' }
      }
      if (type === 'image') {
        const a = netto(el.getAttribute('alt'))
        if (a) return { nom: a, source: 'alt' }
      }
    } else if (!SANS_NOM_PAR_CONTENU.has(role)) {
      const t = texteVisibleAuxOutils(el)
      if (t) return { nom: t, source: 'contenu' }
    }

    const titre = netto(el.getAttribute('title'))
    if (titre) return { nom: titre, source: 'title' }

    return { nom: '', source: 'AUCUNE' }
  }

  const items = []
  let examinees = 0

  for (const el of document.querySelectorAll(COMMANDES)) {
    if (el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'hidden') continue
    // Retiré de l'arbre d'accessibilité : la règle ne s'y applique pas, et
    // l'exiger nommé pousserait à décorer ce que personne n'entend.
    if (el.closest('[aria-hidden="true"]')) continue
    if (!visible(el)) continue

    const role = roleDe(el)
    examinees++
    const { nom } = nomDe(el, role)
    if (nom) continue

    items.push({
      balise: el.tagName.toLowerCase(),
      role,
      haspopup: el.getAttribute('aria-haspopup') || '',
      classes: netto(el.getAttribute('class')).slice(0, 70),
      // De quoi RETROUVER la commande dans les sources sans relancer la porte.
      html: netto(el.outerHTML).slice(0, 160),
    })
  }

  /*
    ON REND LE NOMBRE D'ÉLÉMENTS REGARDÉS, et pas seulement les fautifs.

    Même raison qu'en contraste : « zéro commande anonyme » et « zéro commande
    examinée » s'écrivent pareil dans un journal. Un sélecteur périmé, une page
    qui n'a pas fini de peindre, et cette sonde rendrait le plus rassurant des
    verts. Le compte permet à `mesure-ui.mjs` de refuser ce vert-là.
  */
  return { anonymes: items.length, items, examinees }
})()
