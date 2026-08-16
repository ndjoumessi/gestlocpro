/**
 * Accès au stockage du navigateur, qui peut être INTERDIT.
 *
 * `window.localStorage` et `window.sessionStorage` ne rendent pas `null` quand
 * l'accès est bloqué : ils **lèvent une `SecurityError`**. Cela arrive plus
 * souvent qu'on ne le croit — navigation privée sur certains navigateurs,
 * blocage strict des données de site, extension de confidentialité, page servie
 * dans un cadre tiers.
 *
 * Un accès nu dans un rendu ou un gestionnaire de clic fait donc échouer tout
 * ce qui l'entoure : le composant ne se monte pas, ou le clic ne produit
 * strictement rien — pas de message, pas de requête, rien à lire pour
 * comprendre. C'est la panne la plus opaque qui soit, et elle ne se reproduit
 * jamais sur la machine de celui qui a écrit le code.
 *
 * Ces trois fonctions échouent silencieusement, et c'est le bon comportement :
 * une préférence qu'on ne peut pas conserver est un désagrément, pas une
 * raison d'empêcher quelqu'un de créer son compte.
 */
type Zone = 'local' | 'session'

function zone(nom: Zone): Storage | null {
  try {
    return nom === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function lireStockage(nom: Zone, cle: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return zone(nom)?.getItem(cle) ?? null
  } catch {
    return null
  }
}

export function ecrireStockage(nom: Zone, cle: string, valeur: string): void {
  if (typeof window === 'undefined') return
  try {
    zone(nom)?.setItem(cle, valeur)
  } catch {
    // Quota dépassé ou accès refusé : la préférence ne survivra pas à la page,
    // et c'est tout.
  }
}

export function effacerStockage(nom: Zone, cle: string): void {
  if (typeof window === 'undefined') return
  try {
    zone(nom)?.removeItem(cle)
  } catch {
    // Idem : rien à faire, et surtout rien à interrompre.
  }
}
