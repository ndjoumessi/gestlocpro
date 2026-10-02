/**
 * CE QU'ON MESURE DANS UNE BOÎTE OUVERTE — module PUR.
 *
 * Tout ce fichier s'exécute DANS LE NAVIGATEUR : il ne voit ni `node:fs`, ni le
 * registre, ni les plafonds. C'est pourquoi il tient à part — l'importer
 * n'exécute rien, à la différence d'un script de `scripts/`, qui démarre un
 * serveur et un navigateur dès qu'on le touche.
 *
 * Il est sorti de `modales.mjs` le 2026-10-02 pour ramener ce dernier sous le
 * plafond de 800 lignes. AUCUNE LIGNE N'A CHANGÉ au passage, et c'est vérifié
 * par la mesure et non par la relecture : les 140 états rendent exactement les
 * mêmes nombres avant et après l'extraction.
 */
export async function mesurerLaBoite(page) {
  return page.evaluate(async () => {
    const d = document.querySelector('[role="dialog"],[role="alertdialog"]')
    if (!d) return null
    const enfants = [...d.children]
    /*
      LES TROIS BANDES SE NOMMENT, ELLES NE SE DEVINENT PLUS.

      On cherchait le corps par son `overflow-y: auto` calculé, l'en-tête
      par « le premier enfant s'il n'est pas le corps », le pied par « le
      dernier, même règle ». Trois heuristiques qui tenaient tant que la
      modale avait exactement trois enfants à plat — et qui se seraient
      trompées SANS RIEN DIRE le jour où l'une des bandes gagne un
      enveloppe : le corps devenait introuvable, `defil` retombait à zéro,
      et le plafond de défilement passait au vert sur une mesure vide.

      `Modal` pose maintenant `data-entete-de-modale`,
      `data-corps-de-modale` et `data-pied-de-modale`. Le repli reste pour
      qu'un composant tiers reste mesurable.
    */
    const corps =
      d.querySelector('[data-corps-de-modale]') ??
      enfants.find((e) => getComputedStyle(e).overflowY === 'auto')
    const pied =
      d.querySelector('[data-pied-de-modale]') ??
      (enfants[enfants.length - 1] !== corps ? enfants[enfants.length - 1] : null)
    const entete =
      d.querySelector('[data-entete-de-modale]') ??
      (enfants[0] !== corps ? enfants[0] : null)
    /* Deux trames : l'état vient d'un écouteur de défilement puis d'un
       rendu React, et le lire tout de suite lirait celui d'avant. */
    const peint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const voiles = () => ({
      haut: corps ? corps.hasAttribute('data-suite-au-dessus') : null,
      bas: corps ? corps.hasAttribute('data-suite-en-dessous') : null,
    })
    const r = d.getBoundingClientRect()
    const dansLaFenetre = (el) => {
      const b = el.getBoundingClientRect()
      return b.top >= -1 && b.bottom <= window.innerHeight + 1
    }
    /* Corps en haut puis en bas : un pied ÉPINGLÉ ne bouge pas, un pied
       qui suit le contenu sort du champ à la première molette. */
    let piedTenu = pied ? dansLaFenetre(pied) : null
    let enteteTenu = entete ? dansLaFenetre(entete) : null
    await peint()
    const voilesEnHaut = voiles()
    let voilesEnBas = voilesEnHaut
    if (corps) {
      corps.scrollTop = corps.scrollHeight
      if (pied) piedTenu = piedTenu && dansLaFenetre(pied)
      if (entete) enteteTenu = enteteTenu && dansLaFenetre(entete)
      await peint()
      voilesEnBas = voiles()
      corps.scrollTop = 0
    }
    /*
      LE PORTAIL, VÉRIFIÉ DIRECTEMENT ET NON PAR COÏNCIDENCE.

      Avant ce contrôle, retirer `createPortal` ne se voyait que TANT QUE
      `<main>` portait `animate-rise` : les deux retirés ensemble, la
      modale se replaçait correctement et la garde passait au vert avec le
      défaut réarmé pour le prochain `transform` posé n'importe où.

      On vérifie donc la STRUCTURE : le conteneur `fixed inset-0` de la
      modale est un enfant direct de `<body>`. C'est la seule position où
      aucun ancêtre ne peut lui voler son bloc conteneur, et c'est
      exactement ce que le portail garantit. La mesure ne dépend plus de
      ce que `<main>` décide.
    */
    const conteneur = d.parentElement
    /*
      UNE VALEUR COUPÉE DANS SON CHAMP, mesurée ICI aussi.

      `mesure-ui` porte la même règle depuis ce lot, sur 88 champs — mais
      il ne pousse aucune porte : les champs qui vivent DANS une modale
      lui échappent, et ce sont les plus contraints du produit, puisqu'ils
      partagent une boîte de 360 px avec un pied et un en-tête.

      `scrollWidth > clientWidth` est la mesure exacte du texte qui
      n'entre pas dans sa boîte de contenu. Un texte coupé DANS sa boîte
      ne déborde de rien : la page ne défile pas, le conteneur ne grandit
      pas, et le DOM porte la chaîne entière.
    */
    const valeursRognees = []
    for (const champ of d.querySelectorAll('input, select')) {
      if (['hidden', 'checkbox', 'radio'].includes(champ.type)) continue
      if (!champ.getClientRects().length) continue
      const montre = champ.value || champ.placeholder || ''
      if (!montre.trim()) continue
      const manque = Math.round(champ.scrollWidth - champ.clientWidth)
      if (manque <= 2) continue
      valeursRognees.push({
        texte: montre.trim().slice(0, 44),
        manque,
        offert: Math.round(champ.clientWidth),
      })
    }

    return {
      valeursRognees,
      enfantDeBody: conteneur?.parentElement === document.body,
      profondeur: (() => {
        let n = 0
        for (let e = conteneur; e && e !== document.body; e = e.parentElement) n++
        return n
      })(),
      boite: Math.round(r.height),
      debordeEnHaut: Math.round(Math.max(0, -r.top)),
      debordeEnBas: Math.round(Math.max(0, r.bottom - window.innerHeight)),
      defil: corps ? Math.max(0, corps.scrollHeight - corps.clientHeight) : 0,
      piedTenu,
      enteteTenu,
      voilesEnHaut,
      voilesEnBas,
    }
  })
}
