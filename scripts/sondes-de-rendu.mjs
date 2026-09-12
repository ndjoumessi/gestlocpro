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
/**
 * ON NE DÉROULE PAS PLUS QU'ON NE PEINT.
 *
 * Deux nombres pris au même instant : ce que le document déroule, et ce que le
 * corps peint. Sur un écran sain ils sont ÉGAUX au pixel — le corps s'étire
 * avec son contenu et la racine se déroule d'autant. Un écart ne peut donc
 * venir que d'un contenu qui échappe à ce qui devait le borner.
 *
 * ═══ CE QU'ELLE A TROUVÉ EN NAISSANT ═══
 *
 * `/demo/portail`, le 2026-09-09 : 1 163 px peints, 3 361 px déroulés. Deux
 * mille cent quatre-vingt-dix-huit pixels de fond vide sous la dernière ligne,
 * à 360 px de large. La description accessible de `MiniBarChart` est un
 * `sr-only`, donc un élément absolu, et aucun ancêtre positionné ne se trouvait
 * entre lui et `<main>` : le panneau du portail, borné à 70 % de la fenêtre, ne
 * pouvait pas le découper, et il tirait la racine jusqu'à sa position statique.
 *
 * ═══ POURQUOI ELLE VIT ICI ═══
 *
 * Parce qu'elle ne dépend de RIEN. Ni de la machine, ni de la police, ni des
 * données : elle compare deux nombres de la même page au même instant. C'est ce
 * qui la rend transportable d'une porte à l'autre — la démonstration pour
 * `plafond-hauteurs`, une vraie session pour `espace-connecte` —, là où un
 * plafond en pixels demande une colonne par machine.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Le débordement LATÉRAL, que `MESURER_DEFILEMENT_LATERAL` tient déjà ; et ce
 * qui s'échappe SANS allonger le document — un élément absolu remonté au-dessus
 * du pli, par exemple, ne fait grandir aucun des deux nombres.
 */
export const MESURER_DEROULEMENT = () => ({
  hDoc: document.documentElement.scrollHeight,
  corps: Math.round(document.body.getBoundingClientRect().height),
})

/**
 * LE DOSSIER D'UN DÉFILEMENT FANTÔME — appelé SEULEMENT sur refus.
 *
 * Ce que la sonde ci-dessus dit est « il y a un écart ». Ce qu'on veut lire
 * dans un journal, sur une machine qui n'existera plus, c'est QUI le crée.
 *
 * La recherche a une forme précise, et c'est elle qui a rendu le coupable en
 * une ligne le 2026-09-09 après que trois mutations du CONTENEUR n'eurent rien
 * déplacé : énumérer les éléments POSITIONNÉS dont le bas passe sous le corps,
 * et lire leur `offsetParent` — c'est-à-dire l'ancêtre qui les borne vraiment.
 * Un `offsetParent` situé bien au-dessus du conteneur défilant est la signature
 * de l'évasion.
 *
 * Elle ne coûte rien tant que la porte est verte : elle n'est jamais exécutée.
 */
export const RELEVER_LES_EVADES = () => {
  /* ═══ COPIE SURVEILLÉE : blocConteneurDe ═══ Les trois copies de ce bloc
     doivent rester IDENTIQUES au caractère près — `check-sondes-recopiees.mjs`
     le refuse sinon. Elles sont recopiées parce que `page.evaluate` ne
     sérialise que la fonction qu'on lui passe : aucune ne peut fermer sur une
     aide de Node, et l'en-tête de ce fichier le dit depuis sa naissance. */
  /* LE BLOC CONTENEUR — voir l'explication au-dessus de
     `RELEVER_LES_CLOTURES_PERMEABLES`. Recopié plutôt que partagé : ces
     fonctions sont sérialisées vers la page et ne peuvent fermer sur RIEN de
     Node, comme l'en-tête de ce fichier le dit. */
  const blocConteneurDe = (element) => {
    /* SUR UN ÉLÉMENT HTML, LE NAVIGATEUR SAIT DÉJÀ. */
    if (element.offsetParent !== undefined) return element.offsetParent
    /* SUR UN `<svg>`, IL N'Y A PAS D'`offsetParent` : on remonte à la main. */
    for (let p = element.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p)
      if (
        st.position !== 'static' ||
        st.transform !== 'none' ||
        st.filter !== 'none' ||
        st.backdropFilter !== 'none' ||
        st.perspective !== 'none' ||
        /transform|filter|perspective/.test(st.willChange) ||
        /layout|paint|strict|content/.test(st.contain) ||
        (st.contentVisibility && st.contentVisibility !== 'visible')
      ) {
        return p
      }
    }
    return null
  }
  /* ═══ FIN DE LA COPIE SURVEILLÉE ═══ */

  const corps = Math.round(document.body.getBoundingClientRect().height)
  const evades = []
  for (const n of document.querySelectorAll('body *')) {
    const style = getComputedStyle(n)
    /* HORS DU FLUX SEULEMENT. Un élément `relative` reste dans le flux : son
       conteneur défilant le découpe comme les autres, et il ne peut pas
       allonger la racine. Les inclure noyait le coupable sous des voisins
       innocents — mesuré le 2026-09-09, six lignes de bruit pour trois vraies. */
    if (style.position !== 'absolute' && style.position !== 'fixed') continue
    const bas = Math.round(n.getBoundingClientRect().bottom + window.scrollY)
    if (bas <= corps + 1) continue
    const parent = blocConteneurDe(n)
    evades.push({
      bas,
      position: style.position,
      balise: n.tagName.toLowerCase(),
      /* `getAttribute` ET NON `className` : sur un `<svg>`, `className` est un
         `SVGAnimatedString`, qui s'imprime « [object SVGAnimatedString] ». Le
         dossier devenait illisible exactement là où il fallait lire — mesuré le
         2026-09-10, sur les icônes qui s'échappent du corps des modales. */
      classes: (n.getAttribute('class') ?? '').slice(0, 50),
      texte: (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      borne: parent
        ? parent.tagName.toLowerCase() + '.' + (parent.className || '').toString().slice(0, 30)
        : 'AUCUN — la page elle-même',
    })
  }
  return evades.sort((a, b) => b.bas - a.bas).slice(0, 5)
}

/**
 * UNE CLÔTURE PERMÉABLE : ELLE DÉCOUPE, ET QUELQUE CHOSE PASSE QUAND MÊME.
 *
 * ═══ LA CAUSE, LÀ OÙ `MESURER_DEROULEMENT` GARDE LE SYMPTÔME ═══
 *
 * Le défilement fantôme demande DEUX conditions : un conteneur qui découpe, et
 * un descendant absolu dont le bloc conteneur est en dehors — donc que le
 * découpage n'atteint pas. La sonde du dessus voit le résultat, un document
 * plus long que son corps. Celle-ci voit la CAUSE, et sur les deux axes.
 *
 * ═══ CE QUE CE PRÉDICAT A REMPLACÉ, ET POURQUOI ═══
 *
 * Sa première rédaction, le 2026-09-09, refusait toute clôture non positionnée
 * qui découpe — sans regarder si quoi que ce soit s'en échappait. Sur l'axe
 * VERTICAL cela suffisait : une seule clôture dans tout le produit, et la
 * prophylaxie ne coûtait rien.
 *
 * Sur l'axe HORIZONTAL, le même prédicat en désignait quatre, dont un texte
 * tronqué. Exiger un bloc conteneur sur un `truncate` n'a aucun sens : rien ne
 * peut sortir d'un texte. La règle demandait donc un geste que personne ne
 * saurait défendre, et une garde indéfendable finit contournée.
 *
 * ELLE EXIGE MAINTENANT UN ÉVADÉ RÉEL, et elle ne perd rien : le panneau du
 * portail, qui a motivé toute cette famille, en laissait sortir QUATRE à SIX
 * selon l'onglet — mesuré avant son correctif. Le prédicat serré l'aurait
 * attrapé aussi, et sans réclamer trois gestes inutiles à côté.
 *
 * ═══ CE QU'ELLE A TROUVÉ SUR L'AXE HORIZONTAL ═══
 *
 * UNE clôture perméable sur les 44 points : le `overflow-x-auto` qui enveloppe
 * le tableau de comparaison des états des lieux, dont la légende `sr-only`
 * s'échappe. Sans dommage aujourd'hui — une légende de 1 × 1 px n'allonge
 * rien —, mais la porte ouverte est la même que celle du portail.
 *
 * ═══ CE QUE LE PRÉDICAT SERRÉ COÛTE, ET IL A ÉTÉ MESURÉ ═══
 *
 * Il dépend de ce que l'écran rend à l'instant. Témoin du 2026-09-09 : en
 * retirant le bloc conteneur du panneau du portail, la règle le retrouve — mais
 * à UNE largeur sur deux, et par un seul évadé, la légende `sr-only` du tableau
 * des paiements. Avant le correctif de `MiniBarChart`, le même panneau en
 * laissait sortir quatre à six.
 *
 * Autrement dit : la version large aurait désigné la clôture quoi qu'elle
 * contienne ; celle-ci ne la désigne que si quelque chose s'en échappe VRAIMENT.
 * C'est le prix de ne pas réclamer un geste inutile sur les textes tronqués, et
 * il est acceptable parce que les `sr-only` sont partout dans ce produit — une
 * vingtaine de sortes : un panneau réel qui n'en contiendrait aucun serait
 * l'exception, pas la règle.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Une clôture qui ne découpe RIEN aujourd'hui. Le prédicat compare le contenu à
 * la boîte, donc il dépend des données du jour : une boîte qui tient tout juste
 * son contenu n'est pas vue, et le sera le jour où une ligne de plus la fera
 * déborder. C'est la même dépendance que toutes les mesures de ce dépôt.
 */
/**
 * LE BLOC CONTENEUR D'UN ÉLÉMENT ABSOLU — `offsetParent` d'abord, la marche
 * ensuite.
 *
 * ═══ CE QUE LA PREMIÈRE RÉDACTION AFFIRMAIT, ET QUI EST FAUX ═══
 *
 * Elle disait : « `offsetParent` rend le premier ancêtre POSITIONNÉ ; une
 * transformation en établit un aussi, et il ne la voit pas. » MESURÉ le
 * 2026-09-10, quinze cas dans Chromium : `offsetParent` rend bien le conteneur
 * sur `transform`, `filter`, `backdrop-filter`, `perspective`,
 * `will-change: transform`, `contain: layout|paint|strict|content` et
 * `content-visibility: auto|hidden`. Il ne rate RIEN de ce que la marche
 * cherchait — et la marche, elle, ratait `contain` et `content-visibility`.
 *
 * Une aide écrite pour corriger l'API était donc moins juste qu'elle. On lit
 * l'API quand elle existe, et l'on ne remonte à la main que là où elle n'existe
 * pas.
 *
 * ═══ LA SEULE RAISON QUI TIENT : `<svg>` ═══
 *
 * `offsetParent` est défini sur `HTMLElement`, pas sur `SVGElement` : la lecture
 * rend `undefined`, et une sonde qui prend `undefined` pour « rien ne le borne »
 * dénonce TOUTE icône absolue. Mesuré le 2026-09-10 : la coche de `Choice` et le
 * chevron des champs remontaient « borné par AUCUN — la page elle-même » alors
 * que leurs conteneurs sont `relative`. Trois primitives ont été soupçonnées à
 * tort avant que le dossier ne nomme ce qui borne.
 *
 * La marche couvre donc, pour ce seul cas, tout ce que la mesure a relevé.
 *
 * ═══ CE QUI NE BORNE PAS, ET C'EST MESURÉ AUSSI ═══
 *
 * `container-type: inline-size` et `container-type: size` n'établissent AUCUN
 * bloc conteneur dans Chromium : l'enfant absolu se cale sur la page. Ce dépôt
 * en emploie — `@container` dans le tableau de bord du locataire —, donc les
 * ajouter par symétrie aurait fabriqué de vraies fausses plaintes. Le témoin 36
 * tient cette ligne dans l'autre sens.
 */
export const RELEVER_LES_CLOTURES_PERMEABLES = (racine) => {
  /* ═══ COPIE SURVEILLÉE : blocConteneurDe ═══ Les trois copies de ce bloc
     doivent rester IDENTIQUES au caractère près — `check-sondes-recopiees.mjs`
     le refuse sinon. Elles sont recopiées parce que `page.evaluate` ne
     sérialise que la fonction qu'on lui passe : aucune ne peut fermer sur une
     aide de Node, et l'en-tête de ce fichier le dit depuis sa naissance. */
  /* LE BLOC CONTENEUR — voir l'explication au-dessus de
     `RELEVER_LES_CLOTURES_PERMEABLES`. Recopié plutôt que partagé : ces
     fonctions sont sérialisées vers la page et ne peuvent fermer sur RIEN de
     Node, comme l'en-tête de ce fichier le dit. */
  const blocConteneurDe = (element) => {
    /* SUR UN ÉLÉMENT HTML, LE NAVIGATEUR SAIT DÉJÀ. */
    if (element.offsetParent !== undefined) return element.offsetParent
    /* SUR UN `<svg>`, IL N'Y A PAS D'`offsetParent` : on remonte à la main. */
    for (let p = element.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p)
      if (
        st.position !== 'static' ||
        st.transform !== 'none' ||
        st.filter !== 'none' ||
        st.backdropFilter !== 'none' ||
        st.perspective !== 'none' ||
        /transform|filter|perspective/.test(st.willChange) ||
        /layout|paint|strict|content/.test(st.contain) ||
        (st.contentVisibility && st.contentVisibility !== 'visible')
      ) {
        return p
      }
    }
    return null
  }
  /* ═══ FIN DE LA COPIE SURVEILLÉE ═══ */

  /* `racine` BORNE LA LECTURE, et n'existe que pour les modales — même geste et
     même motif que `MESURER_GABARITS`. Lue sur `body` avec une boîte ouverte,
     elle rendrait les clôtures de la PAGE derrière, que `plafond-hauteurs` tient
     déjà : la même clôture rougirait sous deux portes, et le refus de `modales`
     nommerait une modale innocente. */
  const dans = racine ? document.querySelector(racine) : document.body
  if (!dans) return []
  const permeables = []
  for (const n of dans.querySelectorAll('*')) {
    const style = getComputedStyle(n)
    /*
      POSITIONNÉE = ELLE BORNE DÉJÀ SES ABSOLUS : rien ne peut lui échapper par
      le bloc conteneur, et c'est exactement le correctif qu'on demande.

      CE RACCOURCI EST REDONDANT, et le témoin 6 l'a montré : il a fallu DEUX
      mutations pour le faire rougir — retirer cette ligne ne suffit pas, car le
      test du bloc conteneur, plus bas, innocente déjà tout absolu d'une clôture
      positionnée. La ligne reste parce qu'elle évite de parcourir les
      descendants pour rien, pas parce qu'elle décide quoi que ce soit.
    */
    if (style.position !== 'static') continue
    const boite = n.getBoundingClientRect()
    const coupeEnHauteur =
      style.overflowY !== 'visible' && n.scrollHeight > Math.ceil(boite.height) + 1
    const coupeEnLargeur =
      style.overflowX !== 'visible' && n.scrollWidth > Math.ceil(boite.width) + 1
    if (!coupeEnHauteur && !coupeEnLargeur) continue

    const evades = []
    for (const d of n.querySelectorAll('*')) {
      const sd = getComputedStyle(d)
      /*
        `absolute` SEUL, ET `fixed` EN EST SORTI — corrigé le 2026-09-09 en
        écrivant le témoin 6, qui a demandé pourquoi un `fixed` compterait.

        La réponse est qu'il ne le peut pas : un élément fixe ne participe à
        AUCUN débordement défilant, ni celui d'une clôture, ni celui de la
        racine. Il ne peut donc pas causer le défaut que cette sonde poursuit.
        Le compter aurait dénoncé une clôture pour une raison fausse — et
        prescrit un correctif qui n'aurait rien fait, `position: relative` ne
        retenant pas davantage un `fixed`. Une plainte fausse dont le remède est
        faux est le pire état d'une garde.
      */
      if (sd.position !== 'absolute') continue
      /* SI SON BLOC CONTENEUR EST DANS LA CLÔTURE, le découpage s'applique et
         l'élément ne sort pas. */
      const borne = blocConteneurDe(d)
      if (borne && n.contains(borne)) continue
      const r = d.getBoundingClientRect()
      evades.push({
        balise: d.tagName.toLowerCase(),
        classes: (d.getAttribute('class') ?? '').slice(0, 46),
        texte: (d.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        taille: `${Math.round(r.width)}×${Math.round(r.height)}`,
        /* CE QUI LE BORNE VRAIMENT, et c'est l'information qui manquait pour
           réparer : sans elle, on cherche l'évadé dans les composants au lieu de
           le suivre jusqu'à l'ancêtre positionné qui l'a capté. Mesuré le
           2026-09-10 : trois primitives soupçonnées à tort avant de l'ajouter. */
        borne: borne
          ? borne.tagName.toLowerCase() + '.' + (borne.getAttribute('class') ?? '').slice(0, 40)
          : 'AUCUN — la page elle-même',
      })
    }
    if (evades.length === 0) continue

    permeables.push({
      balise: n.tagName.toLowerCase(),
      classes: (n.getAttribute('class') ?? '').slice(0, 56),
      axe: coupeEnHauteur && coupeEnLargeur ? 'les deux axes' : coupeEnHauteur ? 'la hauteur' : 'la largeur',
      decoupe: coupeEnHauteur
        ? n.scrollHeight - Math.ceil(boite.height)
        : n.scrollWidth - Math.ceil(boite.width),
      evades: evades.slice(0, 3),
      combien: evades.length,
    })
  }
  return permeables
}

/**
 * L'ARBRE S'EST-IL POSÉ ?
 *
 * Deux empreintes IDENTIQUES à deux trames d'écart. On n'attend AUCUNE valeur —
 * seulement qu'elle cesse de bouger —, donc l'attente n'est pas circulaire et ne
 * peut pas fabriquer le nombre qu'elle mesure. Vingt tours au plus ; le
 * dépassement doit faire ROUGIR la porte qui l'emploie, parce qu'un point lu sur
 * un arbre en mouvement rend un verdict qui ne vaut pas ce qu'il annonce.
 *
 * ═══ POURQUOI DES TRAMES, ET NON UN DÉLAI ═══
 *
 * La première rédaction attendait 150 ms de calme sur la population de
 * `[data-indicateur]`. Deux défauts, mesurés :
 *
 *   — SON EMPREINTE ÉTAIT AVEUGLE sur la plupart des écrans : un écran sans
 *     indicateur se pose à zéro instantanément, donc l'attente ne faisait RIEN
 *     là où l'audit de contraste en avait besoin.
 *   — SON SEUIL VENAIT D'UNE MESURE À 100 ms DE PAS. Sur `mesure-ui`, mesuré à
 *     la TRAME sur 916 points : 905 posés immédiatement, 11 après deux trames,
 *     ZÉRO à 50, 100 ou 300 ms. Une trame suit la vitesse de la machine ; un
 *     minuteur calibré sur celle-ci ne dit rien de la suivante.
 *
 * ═══ CE QU'ELLE NE FAIT PAS, ET C'EST MESURÉ ═══
 *
 * ELLE N'ATTEND PAS UNE DONNÉE QUI N'EST PAS ENCORE DEMANDÉE. Pendant les 900 ms
 * de retenue de la démonstration — `ATTENTE_DEMO_MS` —, l'arbre ne bouge pas du
 * tout : elle est parfaitement satisfaite d'un SQUELETTE. Témoin du 2026-09-09,
 * l'attente de la région occupée retirée : 26 plaintes de mou sur
 * `plafond-hauteurs`. « Posé » et « fini » sont deux choses.
 *
 * ═══ POURQUOI ELLE VIT ICI DEPUIS LE 2026-09-10 ═══
 *
 * Elle était écrite QUATRE FOIS, à l'identique — `espace-connecte`, `mesure-ui`,
 * `mesure-navigateur`, `plafond-hauteurs` —, et rien n'obligeait les quatre à
 * s'accorder. Contrairement à `blocConteneurDe`, rien n'imposait cette
 * duplication : cette fonction est passée ENTIÈRE à `page.evaluate`, donc elle
 * s'importe comme les autres sondes de ce fichier.
 */
export const POSER_L_ARBRE = () =>
  new Promise((resolve) => {
    const empreinte = () => {
      const m = document.querySelector('main') ?? document.body
      return `${m.querySelectorAll('*').length}/${Math.round(m.scrollHeight)}`
    }
    let restant = 20
    let precedent = null
    const tour = () => {
      const vue = empreinte()
      if (vue === precedent) return resolve(true)
      if (restant-- <= 0) return resolve(false)
      precedent = vue
      requestAnimationFrame(() => requestAnimationFrame(tour))
    }
    requestAnimationFrame(() => requestAnimationFrame(tour))
  })

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
  /* ═══ COPIE SURVEILLÉE : blocConteneurDe ═══ Les trois copies de ce bloc
     doivent rester IDENTIQUES au caractère près — `check-sondes-recopiees.mjs`
     le refuse sinon. Elles sont recopiées parce que `page.evaluate` ne
     sérialise que la fonction qu'on lui passe : aucune ne peut fermer sur une
     aide de Node, et l'en-tête de ce fichier le dit depuis sa naissance. */
  /* LE BLOC CONTENEUR — voir l'explication au-dessus de
     `RELEVER_LES_CLOTURES_PERMEABLES`. Recopié plutôt que partagé : ces
     fonctions sont sérialisées vers la page et ne peuvent fermer sur RIEN de
     Node, comme l'en-tête de ce fichier le dit. */
  const blocConteneurDe = (element) => {
    /* SUR UN ÉLÉMENT HTML, LE NAVIGATEUR SAIT DÉJÀ. */
    if (element.offsetParent !== undefined) return element.offsetParent
    /* SUR UN `<svg>`, IL N'Y A PAS D'`offsetParent` : on remonte à la main. */
    for (let p = element.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p)
      if (
        st.position !== 'static' ||
        st.transform !== 'none' ||
        st.filter !== 'none' ||
        st.backdropFilter !== 'none' ||
        st.perspective !== 'none' ||
        /transform|filter|perspective/.test(st.willChange) ||
        /layout|paint|strict|content/.test(st.contain) ||
        (st.contentVisibility && st.contentVisibility !== 'visible')
      ) {
        return p
      }
    }
    return null
  }
  /* ═══ FIN DE LA COPIE SURVEILLÉE ═══ */

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
    //
    // SAUF S'IL LUI ÉCHAPPE, et cette exception manquait. Un descendant absolu
    // dont le bloc conteneur est HORS du conteneur défilant n'est pas contenu
    // par lui : le découpage ne l'atteint pas, il pousse le document, et cette
    // boucle l'innocentait pourtant — le vrai coupable disparaissait du
    // rapport, laissant un décalage sans cause nommée. Trouvé le 2026-09-09 en
    // écrivant la garde de cause de l'axe horizontal.
    const style = getComputedStyle(el)
    const horsDuFlux = style.position === 'absolute' || style.position === 'fixed'
    const borne = horsDuFlux ? blocConteneurDe(el) : null
    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const styleAncetre = getComputedStyle(ancetre)
      if (styleAncetre.overflowX === 'auto' || styleAncetre.overflowX === 'scroll') {
        /* Il n'est contenu que si son bloc conteneur est DEDANS. */
        contenu = !horsDuFlux || Boolean(borne && ancetre.contains(borne))
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
/**
 * CE QUI COMPTE POUR UNE COMMANDE — la liste, écrite UNE fois.
 *
 * Treize sortes d'éléments qu'un doigt peut atteindre. Elle sert à `MESURER_CIBLES`
 * ici et à la sonde de géométrie de `mesure-navigateur` là-bas, où elle était
 * RECOPIÉE à l'identique — mesuré le 2026-09-10 : quinze lignes, au caractère
 * près, dans deux fichiers.
 *
 * ELLE VOYAGE MAINTENANT COMME UNE DONNÉE, dans la configuration que ces sondes
 * reçoivent déjà. C'est la seule façon de la partager : elles s'exécutent dans la
 * page, où aucune variable de Node n'existe — la même contrainte que
 * `blocConteneurDe`, mais celle-ci se contourne, parce qu'une liste est une
 * VALEUR et qu'une valeur se passe en argument.
 *
 * Le témoin 28 de `temoins-de-sonde.mjs` la garde sorte par sorte, et le refus
 * nomme celle qui tombe.
 */
export const SELECTEUR_DE_COMMANDE = [
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

export const MESURER_CIBLES = (config) => {
  const { plancher, rayon } = config
  /*
    LA LISTE ARRIVE PAR LA CONFIGURATION, ET SON ABSENCE ARRÊTE TOUT.

    Sans ce refus, un appelant qui l'oublie ferait rendre `querySelectorAll(undefined)`
    — c'est-à-dire la chaîne « undefined », qui ne correspond à aucun élément. La
    sonde rendrait alors zéro cible sondée et zéro défaut : « aucun défaut »,
    exactement, alors qu'elle n'a rien regardé. Une garde du garde compte bien les
    cibles ailleurs, mais elle vit dans la porte, pas ici — et une sonde doit
    refuser ce qu'elle ne sait pas mesurer plutôt que le rendre vert.
  */
  if (typeof config.selecteur !== 'string' || config.selecteur.length === 0) {
    throw new Error(
      'MESURER_CIBLES : aucun sélecteur de commande dans la configuration. ' +
        'Passez `selecteur: SELECTEUR_DE_COMMANDE`, exporté par le même fichier.',
    )
  }
  const SELECTEUR = config.selecteur


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

/**
 * LES SECTIONS DE FICHES VOISINES COMMENCENT À LA MÊME HAUTEUR — Y COMPRIS QUAND
 * L'UNE D'ELLES GRANDIT.
 *
 * ═══ CE QU'ELLE TIENT ═══
 *
 * Une grille de fiches se compare par ses LIGNES : « Loyer » d'une fiche en face
 * du « Loyer » de sa voisine. Les fiches de locataire le promettent depuis le
 * 2026-09-11 par `subgrid`, et rien ne le tenait : une fiche repassée en colonne
 * flexible retrouvait ses 38 px de décalage sans que rien ne rougisse.
 *
 * Une grille se DÉCLARE : `data-mesure="sections-alignees"` sur elle,
 * `data-section="<nom>"` sur chaque section de chaque fiche. Les fiches d'une
 * même rangée — même haut à l'arrondi près — sont comparées section par section,
 * au nom et non au rang : une fiche à qui manquerait une section ne décale pas
 * la comparaison des suivantes, elle est COMPTÉE (`presentes`).
 *
 * ═══ POURQUOI UNE CONTRAINTE ═══
 *
 * Mesurée au naturel, la démonstration ne prouve rien : tous ses noms tiennent
 * sur une ligne, et ses fiches s'alignaient à 0 px AVEC comme SANS `subgrid` —
 * relevé le 2026-09-11 à 1024, 1280, 1440 et 1536 px dans les deux langues. La
 * garde aurait été verte à vide sur la régression même qu'elle existe pour voir.
 *
 * Elle grossit donc une première section de chaque rangée — `decalage` px de
 * rembourrage bas — et remesure. Une grille qui partage ses rangées décale
 * TOUTES les fiches ; une grille qui ne les partage pas n'en décale qu'une.
 *
 * LA PLUS HAUTE DE LA RANGÉE, et le témoin 38 l'a exigé en naissant : grossir
 * une section plus basse que sa voisine est absorbé par la rangée commune, qui
 * ne grandit que de l'excédent — 10 px sur 40 dans le témoin. La contrainte
 * paraissait alors avoir à moitié porté sur une grille parfaitement saine. Le rembourrage et non un bloc ajouté : un bloc posé dans une
 * section en rangée flexible se met à côté, et ne la grandit pas.
 *
 * `deplacement` dit si la contrainte a PORTÉ — de combien la deuxième section de
 * la fiche grossie est descendue. Une section de hauteur imposée l'absorberait,
 * et « aligné sous contrainte » serait alors un constat sur rien : c'est à la
 * porte de le refuser, pas à la sonde de le taire.
 *
 * LA CONTRAINTE EST RENDUE avant la mesure suivante, dans la même tâche : aucune
 * trame n'est peinte entre les deux, et les sondes qui suivent lisent la page
 * telle que le produit l'a laissée.
 *
 * ═══ ET LE BLANC RÉSERVÉ, QUI EST L'AUTRE FACE DE LA MÊME PIÈCE ═══
 *
 * Une rangée partagée qu'une SEULE sorte de fiche occupe, toutes ses voisines la
 * réservent : 56 px de vide sous une fiche occupée pour le bouton d'un logement
 * vide, 33 pour ses pastilles de faits — mesuré sur `/demo/parc` le 2026-09-12.
 * Le vide tombe alors au MILIEU de la fiche, là où il se lit comme une donnée
 * manquante, et non en bas, où il se lit comme une fiche qui a moins à dire.
 *
 * `vides` compte, par section et par rangée, les fiches qui la laissent SANS
 * CONTENU — ni élément, ni texte. Une section vide PARTOUT ne réserve rien, et
 * ce n'est pas à la sonde d'en juger : elle rend le compte, la porte tranche.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Le BAS des sections : deux sections alignées par le haut peuvent finir à des
 * hauteurs différentes, et c'est voulu — le contenu d'une section n'a pas à
 * remplir sa rangée. Et une grille non déclarée, par construction.
 */
export const DECALAGE_DE_CONTRAINTE = 40

export const MESURER_SECTIONS_ALIGNEES = (decalage) => {
  const grilles = [...document.querySelectorAll('[data-mesure="sections-alignees"]')]
  if (grilles.length === 0) return null

  const haut = (el) => Math.round(el.getBoundingClientRect().top)
  /* SANS CONTENU : ni élément, ni texte. Une section étirée à la hauteur de sa
     rangée mesure la piste ENTIÈRE — sa hauteur ne dit donc rien de ce qu'elle
     porte, et c'est le contenu qu'il faut regarder. */
  const sansContenu = (el) => el.childElementCount === 0 && (el.textContent ?? '').trim() === ''
  const ecarts = (rangee, noms) =>
    noms.map((nom) => {
      const presentes = rangee
        .map(({ sections }) => sections.find((s) => s.dataset.section === nom))
        .filter(Boolean)
      const hauts = presentes.map(haut)
      return {
        nom,
        presentes: hauts.length,
        vides: presentes.filter(sansContenu).length,
        ecart: Math.max(...hauts) - Math.min(...hauts),
      }
    })

  const releves = []
  for (const grille of grilles) {
    const rangees = new Map()
    for (const fiche of grille.children) {
      const sections = [...fiche.querySelectorAll('[data-section]')]
      if (sections.length === 0) continue
      const cle = haut(fiche)
      if (!rangees.has(cle)) rangees.set(cle, [])
      rangees.get(cle).push({ fiche, sections })
    }

    for (const rangee of rangees.values()) {
      // Une fiche seule sur sa rangée n'a personne à qui s'aligner.
      if (rangee.length < 2) continue
      const noms = [...new Set(rangee.flatMap(({ sections }) => sections.map((s) => s.dataset.section)))]
      const naturel = ecarts(rangee, noms)

      const hauteur = (el) => el.getBoundingClientRect().height
      const { sections: laPlusHaute } = rangee.reduce((a, b) =>
        hauteur(b.sections[0]) > hauteur(a.sections[0]) ? b : a,
      )
      const [grossie, suivante] = laPlusHaute
      const avant = suivante ? haut(suivante) : null
      const ancien = grossie.style.paddingBottom
      const calcule = parseFloat(getComputedStyle(grossie).paddingBottom) || 0
      grossie.style.paddingBottom = `${calcule + decalage}px`
      const contraint = ecarts(rangee, noms)
      const deplacement = suivante ? haut(suivante) - avant : 0
      grossie.style.paddingBottom = ancien

      releves.push({ fiches: rangee.length, naturel, contraint, deplacement })
    }
  }
  return releves
}

/**
 * UN MENU DE DÉBORDEMENT N'EST JAMAIS SEUL SUR SA LIGNE.
 *
 * ═══ CE QU'ELLE TIENT ═══
 *
 * Les trois points ferment une rangée de gestes : ils disent « et le reste est
 * ici ». Quand la rangée se replie, le menu — dernier de la file — partait seul
 * à la ligne suivante, un rond de 44 px sous des boutons qui ne le touchaient
 * plus, et qu'on ne rattachait plus à rien. Relevé le 2026-09-11 sur huit
 * écrans, de 360 à 1536 px : l'en-tête commun (`PageHeader`), la carte d'un
 * chantier, la fiche d'un locataire.
 *
 * ═══ LA RÈGLE, ET POURQUOI LE PREMIER CONTENEUR FLEXIBLE DÉCIDE ═══
 *
 * On remonte du déclencheur (`aria-haspopup="menu"`) jusqu'au premier ancêtre
 * flexible. S'il se replie (`flex-wrap: wrap`) et range ses enfants en ligne,
 * l'enfant qui porte le menu doit partager sa ligne avec au moins un voisin
 * visible. S'il ne se replie pas, le menu partage sa ligne par construction, et
 * ce qui se replie PLUS HAUT emporte le menu AVEC ses voisins.
 *
 * Le premier balayage remontait jusqu'au premier ancêtre qui se REPLIE : il a
 * dénoncé la rangée des quittances, où « Tout télécharger » et le menu, liés
 * dans une rangée sans repli, passaient ENSEMBLE sous leur titre. Le menu n'y
 * était pas seul ; la règle l'était.
 *
 * Un menu SANS voisin visible n'est pas isolé : il est seul par construction.
 * Un menu posé HORS DU FLUX (`absolute`, `fixed`) non plus : il n'est sur aucune
 * ligne de la rangée qui le contient. C'est ainsi qu'il gagne le coin haut-droit
 * d'un en-tête ou d'une carte sur téléphone, en face du titre ou de l'icône.
 */
export const MESURER_MENUS_ISOLES = () => {
  const visible = (el) => {
    const b = el.getBoundingClientRect()
    return b.width > 0 && b.height > 0
  }
  let examines = 0
  const isoles = []
  for (const declencheur of document.querySelectorAll('[aria-haspopup="menu"]')) {
    if (!visible(declencheur)) continue
    examines++
    let porteur = declencheur
    let rangee = declencheur.parentElement
    while (rangee && !/flex/.test(getComputedStyle(rangee).display)) {
      porteur = rangee
      rangee = rangee.parentElement
    }
    if (!rangee) continue
    if (/absolute|fixed/.test(getComputedStyle(porteur).position)) continue
    const style = getComputedStyle(rangee)
    if (style.flexWrap !== 'wrap' || !style.flexDirection.startsWith('row')) continue

    const voisins = [...rangee.children].filter((c) => c !== porteur && visible(c))
    if (voisins.length === 0) continue
    const lui = porteur.getBoundingClientRect()
    const partage = voisins.some((v) => {
      const b = v.getBoundingClientRect()
      return b.top < lui.bottom - 1 && b.bottom > lui.top + 1
    })
    if (!partage) {
      isoles.push({
        nom: (declencheur.getAttribute('aria-label') || '').slice(0, 50),
        voisins: voisins.length,
      })
    }
  }
  return { examines, isoles }
}
