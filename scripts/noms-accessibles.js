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
 * LA FORME DU RETOUR EST UN CONTRAT :
 * `{ anonymes, items, examinees, homonymes, groupes }`.
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

    ET C'EST LE DÉFAUT DE CETTE FORME, PAYÉ LE 2026-10-05. Une liste écrite ne
    connaît que ce qu'on y a écrit. Le lecteur vidéo du manuel — posé le
    2026-10-04, `<video controls>` — est une commande native à part entière :
    lecture, pause, barre de progression, volume, plein écran, tout au clavier.
    Il n'était dans AUCUNE entrée. La porte rendait donc « 20 186 commandes,
    aucune anonyme » en disant vrai, et un lecteur sans nom accessible est passé
    en production derrière ce vert. Le compte ne mentait pas, son périmètre
    était incomplet — exactement comme le plafond de lignes qui n'existait pas.

    Un `media[controls]` sans `controls` ne porte aucun geste et reste donc
    dehors : ce n'est pas une commande, c'est une image qui bouge.
  */
  const COMMANDES = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    'video[controls]',
    'audio[controls]',
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
    /*
      UN LECTEUR MÉDIA NE PREND PAS SON NOM DE SON CONTENU, et l'omettre a
      produit un FAUX VERT mesuré le 2026-10-05. Le contenu d'un `<video>` est
      son REPLI : « Votre navigateur ne sait pas lire cette vidéo. » Un
      navigateur qui sait la lire ne l'expose jamais — vérifié dans l'arbre
      d'accessibilité de Chrome, qui rend `rôle=Video, nom="", ignoré=false` et
      ne liste que trois sources possibles (`aria-labelledby`, `aria-label`,
      `title`), toutes nulles. La sonde, elle, lisait le texte du DOM et
      déclarait le lecteur nommé.

      C'est la même faute que le rognage invisible : le DOM porte la chaîne
      entière, l'utilisateur ne la reçoit pas. Ajouter `video[controls]` aux
      commandes SANS cette entrée aurait donc posé une garde née verte sur le
      défaut qu'elle devait attraper.
    */
    'video',
    'audio',
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
    if (balise === 'video' || balise === 'audio') return balise
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
  /*
    ═══ `textContent` COLLE LES FRÈRES, ET LA RÈGLE 2.5.3 EN MOURAIT ═══

    Il était lu à plat : `clone.textContent`. Or `textContent` concatène les nœuds
    SANS le moindre séparateur. Une légende écrite
    `<span>Payé</span><span>950 000 FCFA</span>` rendait donc « Payé950 000 FCFA »,
    une chaîne qu'AUCUN nom bien formé ne peut contenir — huit plaintes du
    2026-09-27 accusaient des composants sains, et la faute était ici.

    LA SÉPARATION SUIT LE `display`, ET NON LA STRUCTURE. Premier jet : joindre
    TOUS les enfants par une espace. C'était faux, et une garde l'a dit tout de
    suite — `GestLoc<span>Pro</span>` devenait « GestLoc Pro », donc le nom de
    marque se fendait en deux. Un navigateur ne fait pas cela : il n'introduit de
    frontière de mot que là où la mise en forme en produit une. Un `span` INLINE
    posé pour colorer trois lettres n'en produit aucune, et un lecteur d'écran dit
    bien « GestLocPro ».

    Ce qui produit une frontière, c'est un enfant qui n'est pas `inline`. Les deux
    `span` de la légende sont des éléments d'un conteneur `flex` : le navigateur les
    BLOQUIFIE — leur `display` calculé vaut `block` — et c'est très exactement là
    que la voix marque un temps. On lit donc le `display` calculé, seule source qui
    distingue les deux cas.

    LA FRONTIÈRE COMPTE DES DEUX CÔTÉS. Un bloc sépare de ce qui le PRÉCÈDE comme
    de ce qui le SUIT : n'insérer l'espace qu'avant recollerait
    `<span bloc>Payé</span>reste` en « Payéreste ». On insère donc entre deux
    morceaux dès que l'un des deux porte une boîte de bloc.

    `display: contents` est tenu pour inline — il n'a pas de boîte, donc il ne
    produit aucune frontière. Aucun cas dans le dépôt aujourd'hui.
  */
  const enBloc = (n) => {
    if (n.nodeType !== 1) return false
    const d = getComputedStyle(n).display
    return d !== 'contents' && !d.startsWith('inline')
  }

  const texteDesEnfants = (noeud) => {
    if (noeud.nodeType === 3) return noeud.textContent || ''
    if (noeud.nodeType !== 1) return ''
    if (noeud.getAttribute('aria-hidden') === 'true') return ''
    const parts = []
    for (const enfant of noeud.childNodes) {
      const texte = texteDesEnfants(enfant)
      if (!texte) continue
      parts.push({ texte, bloc: enBloc(enfant) })
    }
    return parts.reduce(
      (acc, p, i) => acc + (i > 0 && (p.bloc || parts[i - 1].bloc) ? ' ' : '') + p.texte,
      '',
    )
  }

  const texteVisibleAuxOutils = (el) => {
    const t = netto(texteDesEnfants(el))
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
    ═══ DEUXIÈME RÈGLE : DEUX COMMANDES D'UNE MÊME LISTE NE PORTENT PAS LE MÊME NOM ═══

    WCAG 4.1.2 exige qu'une commande ait un nom ; il ne dit pas qu'il la
    distingue. Ce produit, lui, l'exige — et il l'avait écrit DEUX FOIS avant de
    le mesurer :

      « douze boutons "Corriger" à la suite ne disent pas lequel on active »
        (`Meters.tsx`, colonne de geste)
      « "A1" seul, dans une liste de dix liens, ne dit pas où l'on va »
        (`Portfolio.tsx`, lien de logement)

    Deux règles écrites, appliquées à deux endroits, gardées nulle part. Relevé
    au navigateur le 2026-09-27, sur la démonstration en français à 1440 px :
    dix boutons « Quittance » et trois « Mettre en demeure » dans le tableau des
    paiements, dix liens « Dossier » chez les locataires, quatre « Retirer
    l'accès » dans les accès, six « Télécharger » dans les documents du
    locataire. Le geste le plus lourd du produit — la mise en demeure — et celui
    qui retire son accès à quelqu'un en faisaient partie.

    LE GROUPE EST LA LISTE, PAS LA PAGE. Deux boutons « Exporter » aux deux bouts
    d'un écran se distinguent par leur contexte ; dix boutons dans dix rangées
    d'un même tableau ne se distinguent par rien — on les atteint à la
    tabulation, l'un après l'autre, et rien n'est prononcé entre eux. On groupe
    donc par `table`, `ul` et `ol`, et l'on compte par nom.

    LE SEUIL EST À TROIS, ET IL EST ARBITRÉ. Deux commandes de même nom dans une
    liste, c'est le cas ordinaire d'une paire de gestes symétriques — « Oui » et
    « Non », deux « Voir » sur deux moitiés — et refuser une PAIRE ferait rougir
    des écrans sains. À partir de trois, c'est une COLONNE de gestes : la forme
    même du défaut relevé ci-dessus, et aucun des quatre cas trouvés n'en avait
    moins de trois.

    CE QUE CETTE RÈGLE NE VOIT PAS, et l'écrire vaut mieux que de le laisser
    croire : deux listes VOISINES portant chacune deux boutons homonymes. Le
    groupe est la liste, donc le compte y reste à deux. Aucun cas de ce genre
    n'existe aujourd'hui ; le jour où il existera, ce commentaire sera le seul
    endroit où la limite était écrite.
  */
  const SEUIL_D_HOMONYMIE = 3
  const homonymes = []
  /* COMBIEN DE LISTES ONT ÉTÉ REGARDÉES — même raison qu'`examinees` : « zéro
     homonyme » et « zéro liste » s'écrivent pareil dans un journal. */
  let groupes = 0

  for (const groupe of document.querySelectorAll('table, ul, ol')) {
    /* Les listes IMBRIQUÉES sont sautées : leurs commandes appartiennent déjà au
       groupe du dessus, et les compter deux fois rapporterait deux fois le même
       défaut. On garde la plus PROCHE — celle qui contient les rangées. */
    if (groupe.parentElement?.closest('table, ul, ol')) continue
    if (groupe.closest('[aria-hidden="true"]')) continue
    groupes++

    const parNom = new Map()
    for (const el of groupe.querySelectorAll(COMMANDES)) {
      if (el.closest('[aria-hidden="true"]')) continue
      if (!visible(el)) continue
      /* Un menu de débordement OUVERT porte ses propres entrées, qui se
         ressemblent d'une rangée à l'autre par construction — elles ne sont
         atteignables que depuis LEUR déclencheur, donc jamais l'une après
         l'autre. Le déclencheur, lui, reste compté. */
      if (el.closest('[role="menu"]')) continue
      const { nom } = nomDe(el, roleDe(el))
      if (!nom) continue
      const vus = parNom.get(nom)
      if (vus) vus.push(el)
      else parNom.set(nom, [el])
    }

    for (const [nom, els] of parNom) {
      if (els.length < SEUIL_D_HOMONYMIE) continue
      homonymes.push({
        nom,
        fois: els.length,
        groupe: groupe.tagName.toLowerCase(),
        html: netto(els[0].outerHTML).slice(0, 160),
      })
    }
  }

  /*
    ═══ TROISIÈME RÈGLE : LE NOM ACCESSIBLE CONTIENT LE LIBELLÉ VISIBLE ═══

    WCAG 2.5.3, « Label in Name ». Qui commande son appareil à la voix dit ce
    qu'il LIT : « cliquer sur Retirer l'accès ». La commande vocale cherche cette
    chaîne dans le nom accessible — si le nom ne la contient pas, le bouton est
    à l'écran, lisible, et inatteignable.

    ═══ CE QUI L'A FAIT ÉCRIRE, ET C'EST LE LOT D'AVANT ═══

    La deuxième règle ci-dessus a fait renommer vingt-neuf gestes homonymes, en
    posant un `aria-label` qui ajoute la donnée distinctive AU libellé visible.
    Deux de ces noms ont été écrits de travers :

      « Relier un locataire — {name} »   pour un bouton qui affiche « Relier à une fiche »
      « Remove {name}'s access »          pour un bouton qui affiche « Remove access »

    LE PREMIER A ÉTÉ PRIS LE JOUR MÊME, par un cas qui rend l'écran en français.
    LE SECOND A ÉTÉ LIVRÉ : aucun cas ne rend l'écran en anglais, et le
    possessif anglais coupe le libellé en deux — « Remove Diane's access » ne
    contient pas « Remove access ». C'est une faute d'accessibilité dans la
    moitié des langues du produit, introduite par le lot qui en corrigeait une
    autre, et découverte par hasard : `modales` ne pouvait plus ouvrir la modale
    — « RevokeAccess@1280/en : le bouton qui l'ouvre est introuvable ».

    UN NOM QUE LA VOIX N'ATTEINT PAS EST UN NOM QUE L'AUTOMATISATION N'ATTEINT
    PAS. C'est la même chaîne, cherchée de la même façon. La porte des modales
    l'a donc signalé sans savoir ce qu'elle signalait ; cette règle-ci le nomme,
    et elle le fait DANS LES DEUX LANGUES, puisque `mesure-ui` parcourt les deux.

    ═══ CE QU'ELLE REGARDE, ET CE QU'ELLE NE PEUT PAS REGARDER ═══

    Seules les commandes dont le nom vient d'un `aria-label` ET qui portent un
    texte visible : c'est le seul cas où les deux chaînes existent et peuvent
    diverger. Un bouton nommé par son contenu les a identiques par construction.

    LA COMPARAISON IGNORE LA CASSE ET LES ESPACES, et rien d'autre. Elle ne
    normalise ni les apostrophes ni les tirets : « l'accès » et « l’accès » sont
    deux chaînes, et si le libellé visible en porte une et le nom l'autre, la
    voix échoue pour de vrai. Une comparaison indulgente rendrait le vert que
    l'utilisateur n'a pas.

    ELLE NE DIT RIEN DE L'ORDRE : WCAG demande que le libellé soit CONTENU, pas
    qu'il commence le nom. « Quittance de mars — A1 » et « A1 — Quittance de
    mars » passent tous deux, et c'est conforme.
  */
  const labelsDeTravers = []
  let nommeesParLabel = 0

  for (const el of document.querySelectorAll(COMMANDES)) {
    if (el.closest('[aria-hidden="true"]')) continue
    if (!visible(el)) continue
    const label = netto(el.getAttribute('aria-label'))
    if (!label) continue
    /*
      UN RÔLE QUI NE SE NOMME PAS PAR SON CONTENU N'A PAS DE LIBELLÉ VISIBLE,
      et 2.5.3 ne lui applique donc rien. Le critère parle d'un composant « dont
      le libellé contient du texte » — un libellé VU. Le contenu d'un `<video>`
      est son repli, qu'un navigateur capable de lire la vidéo n'expose jamais ;
      la valeur d'un `textarea` est une saisie, pas un libellé.

      Sans cette ligne, nommer correctement le lecteur du manuel faisait rougir
      2.5.3 : la plainte exigeait que « Visite filmée du produit » contienne
      « Votre navigateur ne sait pas lire cette vidéo. » Mesuré le 2026-10-05,
      dans les deux langues — c'est-à-dire que la sonde refusait le correctif
      de la faute qu'elle venait elle-même de signaler.
    */
    if (SANS_NOM_PAR_CONTENU.has(roleDe(el))) continue
    const visibleTexte = texteVisibleAuxOutils(el)
    /* Pas de texte visible : rien à contenir. Un bouton d'icône nommé par son
       seul `aria-label` est le cas normal, et c'est la première règle qui le
       garde. */
    if (!visibleTexte) continue
    nommeesParLabel++
    const sansCasse = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    if (sansCasse(label).includes(sansCasse(visibleTexte))) continue
    labelsDeTravers.push({
      label,
      visible: visibleTexte,
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
  return {
    anonymes: items.length,
    items,
    examinees,
    homonymes,
    groupes,
    labelsDeTravers,
    nommeesParLabel,
  }
})()
