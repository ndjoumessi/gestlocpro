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
export const MESURER_GABARITS = () => {
  const texte = document.body.innerText ?? ''
  const jetons = [...texte.matchAll(/\{[A-Za-z][\w.]*\}/g)].map((m) => m[0])
  return { jetons: [...new Set(jetons)] }
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
