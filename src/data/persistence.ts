import { DEPOSITS, UNITS, WORKS, type Deposit, type Unit, type WorkOrder } from './portfolio'

/**
 * Persistance de l'état de démonstration.
 *
 * L'état vivait en mémoire : recharger la page effaçait une fiche locataire
 * créée, un devis validé, une caution arbitrée. Une démonstration qu'on ne peut
 * pas interrompre est fragile — il suffit d'un rafraîchissement accidentel pour
 * repartir de zéro devant son interlocuteur.
 *
 * Ce n'est pas une base de données : c'est un enregistrement local du parcours
 * en cours, que l'utilisateur doit pouvoir effacer. D'où `resetState()`, exposé
 * dans l'interface et non seulement dans la console.
 */

/**
 * Version du format.
 *
 * À incrémenter dès que la forme des données change. Sans ce garde, un
 * enregistrement écrit avant une évolution du modèle ressusciterait des données
 * périmées — par exemple des unités sans le statut « en attente », ou des dates
 * encore stockées en chaînes françaises figées. Le jeu de démonstration a changé
 * plusieurs fois pendant la construction ; il changera encore.
 *
 * Version 2 : le corps de métier d'un travail est passé de la chaîne en clair
 * (« Plomberie ») à une clé de traduction (`plumbing`). Sans incrément, un
 * enregistrement de version 1 rendait `app.trades.Plomberie` à l'écran — la
 * clé introuvable, affichée telle quelle.
 *
 * Version 3 : le locataire d'une caution vaut `null` quand il est parti, là où
 * le champ portait « Ancien locataire » en clair. Un enregistrement antérieur
 * ferait réapparaître ce français dans une interface anglaise.
 *
 * Version 4 : l'unité porte le téléphone du locataire. Le formulaire de
 * création le réclamait déjà — en promettant d'y envoyer le code d'invitation —
 * mais aucun champ ne l'accueillait et il était jeté. Un enregistrement
 * antérieur rendrait une colonne « Contact » vide pour tout le parc.
 *
 * À noter, par contraste : la typologie du logement est passée au même moment
 * de `string` à l'union `UnitTypeKey`, et cela n'aurait justifié aucun
 * incrément. Les valeurs `T1`…`T4` sont inchangées ; seul le type TypeScript
 * s'est resserré, et `formeValide` ne l'inspecte pas. Ce qui compte ici est la
 * forme des données enregistrées, pas celle du code qui les lit.
 *
 * Version 5 : l'intitulé d'un signalement du jeu de démonstration est passé de
 * la phrase en clair (« Fuite sous l'évier de la cuisine ») à une clé
 * (`sinkLeak`), et le champ a changé de nom — `title` devient `titleKey`. Un
 * enregistrement antérieur rendrait un intitulé vide, la clé étant introuvable.
 */
const VERSION = 5
const CLE = 'gestlocpro.portfolio'

export interface EtatPersiste {
  units: Unit[]
  works: WorkOrder[]
  deposits: Deposit[]
}

const ETAT_INITIAL: EtatPersiste = { units: UNITS, works: WORKS, deposits: DEPOSITS }

/** Vérifie grossièrement qu'un objet lu a bien la forme attendue. */
function formeValide(valeur: unknown): valeur is EtatPersiste {
  if (!valeur || typeof valeur !== 'object') return false
  const etat = valeur as Partial<EtatPersiste>
  return (
    Array.isArray(etat.units) &&
    Array.isArray(etat.works) &&
    Array.isArray(etat.deposits) &&
    // Une collection vide signale un enregistrement corrompu plutôt qu'un parc
    // réellement vidé : rien dans l'interface ne permet de supprimer une unité.
    etat.units.length > 0 &&
    etat.works.length > 0 &&
    etat.deposits.length > 0
  )
}

/**
 * Relit l'état enregistré, ou rend l'état initial.
 *
 * Toute anomalie — version différente, JSON illisible, forme inattendue,
 * `localStorage` indisponible en navigation privée — retombe silencieusement
 * sur le jeu de démonstration. Mieux vaut une démonstration qui redémarre à
 * zéro qu'une application qui refuse de s'afficher.
 */
export function loadState(): EtatPersiste {
  if (typeof window === 'undefined') return ETAT_INITIAL

  try {
    const brut = window.localStorage.getItem(CLE)
    if (!brut) return ETAT_INITIAL

    const enveloppe = JSON.parse(brut) as { version?: number; etat?: unknown }
    if (enveloppe.version !== VERSION) {
      window.localStorage.removeItem(CLE)
      return ETAT_INITIAL
    }
    if (!formeValide(enveloppe.etat)) {
      window.localStorage.removeItem(CLE)
      return ETAT_INITIAL
    }
    return enveloppe.etat
  } catch {
    return ETAT_INITIAL
  }
}

/** Enregistre l'état. Un échec d'écriture ne doit jamais casser l'interface. */
export function saveState(etat: EtatPersiste): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLE, JSON.stringify({ version: VERSION, etat }))
  } catch {
    // Quota dépassé ou stockage refusé : la session continue en mémoire.
  }
}

/** Efface l'enregistrement et rend l'état initial. */
export function resetState(): EtatPersiste {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CLE)
    } catch {
      // Rien à faire : l'appelant remet de toute façon l'état initial.
    }
  }
  return ETAT_INITIAL
}

/** `true` si un parcours a été enregistré, c'est-à-dire s'il y a quelque chose à effacer. */
export function hasStoredState(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLE) !== null
  } catch {
    return false
  }
}
