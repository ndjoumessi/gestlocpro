/**
 * LES SONDES QUE PLUSIEURS PORTES EXÉCUTENT DANS LA PAGE.
 *
 * Un instrument, un fichier, une explication — le geste que `police-large.mjs`
 * et `mesure-sans-agent.mjs` ont posé avant celui-ci. Ce qui vit ici est
 * exécuté par `page.evaluate`, donc dans le navigateur : aucune de ces
 * fonctions ne peut fermer sur une variable de Node.
 *
 * POURQUOI CE FICHIER NAÎT. `MESURER_GABARITS` a vécu un lot entier dans
 * `mesure-ui.mjs`, où elle balaie la démonstration. `espace-connecte.mjs` a
 * besoin de la MÊME sonde derrière une session — et la recopier, c'est deux
 * expressions régulières à faire vieillir ensemble. Le dépôt a déjà payé cette
 * facture : `appariements.test.ts` a surveillé pendant des lots trois jetons de
 * couleur que le graphe n'employait plus.
 */

/**
 * AUCUN GABARIT NE SURVIT AU RENDU.
 *
 * ═══ TROIS FOIS EN UNE JOURNÉE, ET AUCUNE PORTE POUR LE VOIR ═══
 *
 * 2026-08-31, sur la production, coup sur coup :
 *
 *  · « {count, plural, one {# locataire…} } » affiché TEL QUEL sur l'écran des
 *    locataires — un message écrit en ICU imbriqué, que `t()` ne sait pas lire.
 *    Le cas jsdom cherchait une sous-chaîne, laquelle existe aussi dans le
 *    message cassé : il était vert.
 *  · « Signalement SIG-2026-002 · {unit} » sur la carte d'un signalement — le
 *    paramètre posé dans la colonne de la notification, que la carte ne lit pas.
 *  · le même défaut guettait `{reference}` et `{text}`, jamais rencontré.
 *
 * `notes-conditionnelles` refuse déjà les jetons survivants, mais seulement
 * dans les `<Notice>` DÉCLARÉES : une carte d'alerte, un titre de page, une
 * cellule de tableau y échappaient tous. Le défaut n'est pas propre aux notes,
 * il est propre à l'INTERPOLATION.
 *
 * ═══ CE QU'ELLE CHERCHE, ET CE QU'ELLE NE PEUT PAS CONFONDRE ═══
 *
 * `{` suivi d'une lettre, puis d'identifiant, puis `}` — la forme exacte d'un
 * `{count}`, `{unit}`, `{reference}` non résolu. Pas `{` seul, pas `{ }`, pas
 * une accolade dans du code : le produit n'affiche aucune expression, et un
 * texte français ne pose pas d'accolade collée à un mot.
 *
 * ELLE LIT LE TEXTE VISIBLE, jamais la source : `innerText` ignore ce que le
 * CSS masque, et une chaîne cachée n'est un défaut pour personne.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Les modales, qui ne sont pas ouvertes par les balayages qui l'emploient —
 * `modales` les tient en géométrie, pas en interpolation.
 *
 * Et, tant qu'elle ne tournait que dans `mesure-ui`, tout ce que la
 * DÉMONSTRATION ne produit pas. C'est cette moitié-là que `espace-connecte`
 * ferme : les mêmes écrans, derrière une vraie session, sur un parc écrit par
 * les routes du serveur.
 */
export const MESURER_GABARITS = (racine) => {
  /* `racine` BORNE LA LECTURE, et n'existe que pour les modales.

     Sans elle, la sonde lit `body` — donc la page DERRIÈRE la boîte de dialogue,
     que `mesure-ui` et `espace-connecte` balaient déjà. Un jeton du fond
     rougirait alors deux fois, sous deux portes, et le refus de `modales`
     nommerait une modale innocente. Bornée au dialogue, elle ne voit que ce qui
     s'est ouvert. */
  const dans = racine ? document.querySelector(racine) : document.body
  if (!dans) return { jetons: [], vu: false }
  const texte = dans.innerText ?? ''
  const jetons = [...texte.matchAll(/\{[A-Za-z][\w.]*\}/g)].map((m) => m[0])
  return { jetons: [...new Set(jetons)], vu: true }
}

/**
 * L'ÉCRAN A-T-IL RENDU ? — la question que toute autre mesure suppose résolue.
 *
 * Elle vient de `mesure-ui`, où elle porte son propre commentaire, et elle est
 * ici parce qu'`espace-connecte` en a le MÊME besoin pour une raison plus
 * pressante : sous `/app`, un écran qui ne rend pas est le défaut ORDINAIRE.
 * `inventaire-ui.mjs` le dit depuis des lots — servi en statique, `/app` reste
 * sur « Chargement… », quatre éléments, indéfiniment. Une porte qui balaierait
 * l'espace connecté sans exiger un rendu mesurerait ce squelette et rendrait
 * « aucun défaut ».
 */
export const MESURER_RENDU_MINIMAL = () => ({
  titres: document.querySelectorAll('h1, h2, h3').length,
  interactifs: document.querySelectorAll(
    'a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="link"]',
  ).length,
  racineVide: !document.querySelector('#root')?.firstElementChild,
  // Le premier titre, en clair : c'est lui qui distingue un écran de son écran
  // de refus, et c'est la seule chaîne que le rapport d'`espace-connecte`
  // compare d'une adresse à l'autre.
  titre: (document.querySelector('h1')?.textContent ?? '').trim(),
})

/**
 * LE DÉFILEMENT LATÉRAL, mesuré comme `mesure-ui` a appris à le mesurer.
 *
 * Le piège est écrit là-bas et il se paie une fois : `documentElement.-
 * scrollWidth` compte la largeur de mise en page des descendants d'un
 * conteneur à défilement, et signale donc un faux positif sur tout tableau
 * large logé dans un `overflow-x-auto` — ce que le dépôt fait partout. Le seul
 * critère fiable est de TENTER `window.scrollTo(400, 0)` et de vérifier que
 * `window.scrollX` est resté à 0.
 *
 * ELLE NE PORTE AUCUNE TOLÉRANCE, et c'est délibéré. `mesure-ui` en tient une
 * liste, chacune mesurée sur la démonstration, chacune motivée à sa ligne. Les
 * importer ici les appliquerait à des écrans où personne n'a relevé le pixel
 * qui les justifie : une dispense se mérite sur la surface qu'elle couvre.
 */
export const MESURER_DEFILEMENT_LATERAL = () => {
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
      const style = getComputedStyle(ancetre)
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    coupables.push({
      balise: el.tagName.toLowerCase(),
      classe: (el.getAttribute('class') ?? '').slice(0, 70),
      droite: Math.round(boite.right),
    })
  }
  return { decalage, largeurVue, coupables: coupables.slice(0, 4) }
}

/**
 * LE PLANCHER DES CIBLES TACTILES, et le rayon qui le sonde.
 *
 * 44 px est le seuil WCAG ; 22 de part et d'autre du centre rendent 45 px
 * atteignables, un de plus que le plancher. On ne cherche pas la taille exacte
 * d'une grande cible — seulement à savoir si elle atteint 44 — donc s'arrêter
 * juste au-dessus évite des milliers de sondages inutiles.
 *
 * Ils vivent ici avec la sonde qui les consomme : deux copies du nombre 44 dans
 * deux portes finiraient par diverger, et c'est le genre d'écart qu'aucune des
 * deux ne pourrait signaler.
 */
export const PLANCHER_CIBLE = 44
export const RAYON_SONDAGE = 22

/**
 * Exécuté DANS la page : rend les cibles dont la surface touchable reste
 * sous le plancher, avec la raison d'exemption qu'elles déclarent.
 *
 * Le sélecteur ratisse ce qu'un doigt peut viser : les commandes natives, les
 * rôles ARIA qui en tiennent lieu, et tout ce qui est tabulable. Il exclut ce
 * qui n'est pas visé — masqué, hors flux, neutralisé par `inert`, ou réservé
 * aux lecteurs d'écran.
 */
export const MESURER_CIBLES = (config) => {
  const { plancher, rayon } = config
  const SELECTEUR = [
    'a[href]',
    'button',
    'input:not([type=hidden])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[role="tab"]',
    '[role="switch"]',
    '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const defauts = []
  const raisonsVues = []
  let sondees = 0

  /*
    UNE MODALE OUVERTE BORNE LE BALAYAGE À ELLE-MÊME.

    LE DÉFAUT DE LA SONDE, trouvé au premier passage où une modale est entrée
    dans les surfaces auditées. La taille touchable se mesure par
    `elementFromPoint` : on part du centre de l'élément et l'on s'écarte tant
    que le point rend toujours cet élément. Derrière une modale, le point rend
    la COUCHE — et la mesure conclut `0x0`.

    Elle a donc accusé le lien « A1 » du tableau du parc, dont la zone touchable
    réelle vaut 958 × 68 px, mesurée : sa rangée entière, par un `::after` en
    `inset-0`. Rien n'était cassé. Ce qui était faux, c'est la QUESTION : « ce
    lien est-il atteignable au doigt » n'a pas de sens à l'instant où une modale
    le recouvre exprès.

    ON NE MARQUE PAS LE FOND `inert` POUR AUTANT. Ce serait corriger le produit
    pour arranger l'instrument : `Modal` porte `aria-modal="true"`, que les
    technologies d'assistance honorent, et son piège de focus est tenu par
    `clavierDesModales.test.tsx`. Ajouter `inert` pour faire taire une sonde
    déguiserait un contournement en amélioration.

    Le fond N'EST PAS pour autant exempté de mesure : il est balayé à chaque
    passage de page, modale fermée, sur les mêmes onze largeurs.
  */
  const modale = document.querySelector('[role="dialog"][aria-modal="true"]')
  const perimetre = modale ?? document

  /**
   * L'étiquette qui ENVELOPPE ce champ, s'il en a une.
   *
   * `el.labels` ne rend que les étiquettes qui commandent réellement le champ —
   * l'enveloppante, ou celle qui le cite par `for`. On ne retient que la
   * première : voir l'argument au point de sondage.
   */
  const etiquetteDe = (n) =>
    typeof n.labels === 'object' && n.labels ? [...n.labels].find((e) => e.contains(n)) : undefined

  for (const el of perimetre.querySelectorAll(SELECTEUR)) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (el.classList.contains('sr-only')) continue
    if (el.closest('[inert]')) continue

    let boite = el.getBoundingClientRect()
    if (boite.width === 0 || boite.height === 0) continue
    sondees++

    const raison = el.getAttribute('data-cible')
    if (raison) raisonsVues.push(raison)

    // La boîte suffit à conclure quand elle passe : une cible ne peut que
    // GRANDIR en s'écartant du centre, jamais rétrécir.
    if (boite.width >= plancher && boite.height >= plancher) continue

    el.scrollIntoView({ block: 'center', inline: 'center' })
    boite = el.getBoundingClientRect()
    /* Le centre est celui de la CIBLE — voir juste dessous. `boite` reste celle
       du champ : c'est elle que le rapport affiche, et c'est bien elle qu'on
       veut lire à côté de la cible mesurée. */
    const boiteCible = (etiquetteDe(el) ?? el).getBoundingClientRect()
    const cx = Math.round(boiteCible.left + boiteCible.width / 2)
    const cy = Math.round(boiteCible.top + boiteCible.height / 2)
    /*
      UNE ÉTIQUETTE FAIT PARTIE DE LA CIBLE DE SON CHAMP.

      TROISIÈME ANGLE MORT DE CETTE RÈGLE, et le symétrique exact du second
      écrit plus haut. « Une boîte n'est pas une cible » disait qu'un élément
      peut être touchable BIEN AU-DELÀ de sa boîte, par un `::after` étendu —
      un DESCENDANT, donc attrapé par `el.contains`. Une case à cocher est
      touchable au-delà de sa boîte par son `<label>`, qui est un ANCÊTRE : la
      condition le rejetait, et la sonde s'arrêtait au bord des 20 px peints.

      Mesuré : la case « rester connecté sur cet appareil » rendait 20 × 21 px
      à /connexion, sur 320 et 360, dans les deux thèmes et les deux polices.
      Son étiquette fait 44 px de haut — `Checkbox` la pose ainsi depuis
      toujours — et cliquer n'importe où dessus coche la case. Rien n'était
      cassé ; la question était mal posée, comme elle l'avait déjà été derrière
      une modale.

      ON N'ÉLARGIT QU'À CE QUI ACTIVE. `el.labels` ne rend que les étiquettes
      qui commandent RÉELLEMENT ce champ — l'enveloppante, ou celle qui le cite
      par `for`. Un `<div>` parent n'y entre pas, un `<label>` d'un autre champ
      non plus. C'est la même exigence que partout ici : on mesure ce que le
      doigt obtient, pas ce que le balisage suggère.

      ON SONDE DEPUIS LE CENTRE DE L'ÉTIQUETTE, PAS DE CELUI DU CHAMP. Payé au
      passage suivant : élargir la seule condition d'acceptation a porté la
      hauteur à 45 px et laissé la largeur à 33. La sonde s'écarte de part et
      d'autre d'un centre, et le centre du champ est collé au bord GAUCHE de
      son étiquette — dix pixels à gauche, vingt-deux à droite. Elle mesurait un
      voisinage, pas une cible. WCAG 2.5.8 désigne la cible : c'est l'étiquette.

      SEULEMENT L'ENVELOPPANTE. Une étiquette qui cite son champ par `for` sans
      le contenir — la forme de `Field`, au-dessus des champs de saisie — occupe
      une AUTRE région de l'écran. Créditer un champ de la taille d'un libellé
      posé ailleurs déclarerait touchable une surface qui ne l'est pas d'un seul
      geste. On ne prend donc que l'étiquette CONTIGUË, celle qui enveloppe.

      CE QU'ELLE PEUT ENCORE MANQUER : une étiquette qui contient un SECOND
      élément interactif — un lien dans le libellé d'une case. Le clic y va au
      lien, pas à la case, et la sonde créditerait quand même la surface. Le
      dépôt n'en porte aucune ; le jour où il en portera, c'est ici qu'il
      faudra le dire.
    */
    const cibleReelle = etiquetteDe(el) ?? el
    const touche = (x, y) => {
      const cible = document.elementFromPoint(x, y)
      return !!cible && (cible === cibleReelle || cibleReelle.contains(cible))
    }

    let largeurUtile = 0
    let hauteurUtile = 0
    if (touche(cx, cy)) {
      let gauche = 0
      let droite = 0
      let haut = 0
      let bas = 0
      while (gauche < rayon && touche(cx - gauche - 1, cy)) gauche++
      while (droite < rayon && touche(cx + droite + 1, cy)) droite++
      while (haut < rayon && touche(cx, cy - haut - 1)) haut++
      while (bas < rayon && touche(cx, cy + bas + 1)) bas++
      largeurUtile = gauche + droite + 1
      hauteurUtile = haut + bas + 1
    }
    if (largeurUtile >= plancher && hauteurUtile >= plancher) continue

    defauts.push({
      balise: el.tagName.toLowerCase(),
      boite: `${Math.round(boite.width)}x${Math.round(boite.height)}`,
      cible: `${largeurUtile}x${hauteurUtile}`,
      raison,
      texte:
        (el.textContent || '').trim().slice(0, 34) ||
        (el.getAttribute('aria-label') || '').slice(0, 34),
      classes: typeof el.className === 'string' ? el.className.slice(0, 70) : '',
    })
  }

  // Le défilement a bougé : le rendre, sinon la mesure suivante hérite d'une
  // page à mi-hauteur — et l'en-tête collant y a déjà changé de fond.
  window.scrollTo(0, 0)
  return { defauts, raisonsVues, sondees }
}
