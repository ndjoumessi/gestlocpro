/**
 * CE QU'ON ATTEND AVANT DE MESURER, et ce qu'on COMPTE quand l'attente échoue.
 *
 * `attendre` ne rend pas la main sur un délai : elle attend le réseau, le
 * chargement, les polices. Chacune peut EXPIRER, et c'est là que vit
 * `lenteurs` — une attente dépassée ne fait pas échouer le balayage, elle est
 * comptée et remontée à la fin. Un écran lent est un fait du produit, pas une
 * panne de la porte ; mais une attente qui expire SANS LE DIRE rendrait une
 * mesure prise trop tôt, que personne ne saurait fausse.
 *
 * Les deux collecteurs sont un état partagé ASSUMÉ : ils vivent ici parce que
 * c'est ici qu'on les remplit, et `mesure-ui.mjs` ne fait que les LIRE.
 *
 * Module PUR : l'importer n'exécute rien.
 */

import { POSER_L_ARBRE } from '../sondes-de-rendu.mjs'

/**
 * Les attentes, et ce qu'elles coûtent quand elles échouent.
 *
 * Chaque `.catch(() => {})` avale un dépassement de délai : c'est voulu — un
 * écran qui ne se stabilise pas doit être MESURÉ tel quel, pas faire échouer le
 * balayage. Mais avalé en silence, un dépassement de quinze secondes se paie
 * douze fois par langue sur le même écran, et le balayage entier passe de
 * quelques minutes à une demi-heure sans qu'on sache pourquoi.
 *
 * On compte donc les dépassements et on les rend à la fin. Un écran dont
 * l'`aria-busy` ne s'éteint jamais est d'ailleurs un DÉFAUT en soi, que ce
 * compteur nomme au lieu de le laisser peser sur l'horloge.
 */
export const lenteurs = new Map()

export const attendre = async (page, ou) => {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => marquer(ou, 'réseau'))
  // `waitForFunction(fonction, ARGUMENT, options)` : le deuxième paramètre est
  // l'argument passé à la fonction, PAS les options. Écrit en deuxième position,
  // `{ timeout }` partait donc à une fonction qui n'attend rien, et le délai par
  // défaut de trente secondes s'appliquait — douze attentes par écran, six
  // minutes sur toute page qui ne se stabilise pas. Trois pages s'y sont
  // arrêtées au dixième de seconde près, ce qui a trahi le plafond ; sans le
  // `null`, ces délais ne sont pas des délais, ce sont des commentaires.
  /*
    UNE NÉGATION SUR UN CONTENEUR VIDE EST VRAIE SANS RIEN GARANTIR.

    Les trois attentes de cette fonction étaient satisfaites par une page qui
    n'avait encore RIEN monté. `networkidle` se rend immédiatement — le parc de
    démonstration ne fait aucune requête. `document.fonts.status === 'loaded'`
    parle des polices, pas du contenu. Et « zéro nœud `aria-busy="true"` » était
    VRAI À VIDE : rien n'était monté, donc rien ne pouvait être occupé. Un arbre
    parfaitement immobile et parfaitement vide passait les trois.

    MESURÉ, sonde Playwright, dix tentatives sur `barre-du-locataire` : au retour
    d'`attendre()`, le `<main>` était VIDE neuf fois sur dix, zéro squelette et
    zéro nœud occupé. Ce qui sauvait l'audit d'ordinaire est un ACCIDENT : le
    balayage attend ensuite que le témoin soit visible, et cette attente-là
    dépasse normalement le montage de l'écran. Quand elle ne le dépasse pas, on
    mesure 22 mots au lieu de 320 — `barre-du-locataire` auditée à 8 textes au
    lieu de 151, `prix-de-refacturation` à 149 au lieu de 156, variable d'une
    exécution à l'autre et même du clair au sombre dans la MÊME exécution.

    La règle générale : une négation ne se garde que par une VÉRIFICATION
    D'EXISTENCE placée AVANT elle. On exige donc d'abord qu'un `<main>` existe et
    porte du texte rendu ; alors seulement l'absence de nœud occupé veut dire
    quelque chose.

    LE DÉLAI ET SON `.catch` NE CHANGENT PAS, et c'est délibéré : une page qui ne
    remplit véritablement jamais son `<main>` doit voir l'attente EXPIRER, être
    COMPTÉE et remontée par `lenteurs`, pas faire échouer le balayage. Un écran
    nouvellement lent devient ainsi visible au lieu d'être silencieux.
  */
  await page
    .waitForFunction(
      () => {
        const principal = document.querySelector('main')
        if (!principal || principal.innerText.trim() === '') return false
        return document.querySelectorAll('[aria-busy="true"]').length === 0
      },
      null,
      { timeout: 5000 },
    )
    .catch(() => marquer(ou, 'chargement'))
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => marquer(ou, 'polices'))
}

/** Les points sondés alors que l'arbre bougeait encore — voir leur garde. */
export const arbresEnMouvement = []

export async function poserLArbre(page, ou) {
  if (!(await page.evaluate(POSER_L_ARBRE))) arbresEnMouvement.push(ou)
}

export function marquer(ou, quoi) {
  const cle = `${ou} — ${quoi}`
  lenteurs.set(cle, (lenteurs.get(cle) ?? 0) + 1)
}
