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
 *
 * Version 6 : l'unité porte la date de début du BAIL EN COURS. Le portail
 * annonce « bail en cours depuis le … » et date les travaux « depuis mon entrée
 * le … » ; rien dans le modèle ne portait cette date. Un enregistrement
 * antérieur la rendrait `undefined`, et ces deux phrases s'afficheraient
 * amputées de ce qu'elles annoncent.
 *
 * Version 7 : l'intervention porte son ORIGINE et son déclarant, et son montant
 * unique se scinde en deux — `amount` devient `quotedAmount` + `approvedAmount`.
 * Le scindement est ce qui rend l'incrément obligatoire plutôt que prudent : un
 * enregistrement antérieur porte un `amount` que plus personne ne lit, donc
 * toutes ses interventions s'afficheraient « pas encore chiffré », y compris
 * celles dont le devis est validé. L'origine, elle, se serait simplement tue —
 * ce que l'écran sait faire.
 *
 * Version 8 : l'unité occupée porte l'IDENTIFIANT de son locataire. « Retirer
 * la fiche » n'est offert que si elle en porte un — le serveur supprime par
 * identifiant de locataire, pas par logement — donc un enregistrement antérieur
 * cache ce geste, DÉFINITIVEMENT et sans un mot : rien ne repose l'identifiant
 * sur une unité déjà en mémoire.
 *
 * C'est le cas limite que la version 7 avait laissé passer dans l'autre sens :
 * l'origine d'une intervention « se serait simplement tue, ce que l'écran sait
 * faire ». Une donnée absente qu'on n'affiche pas se tait ; une donnée absente
 * qui retire une COMMANDE ne se tait pas, elle ampute — et personne ne peut
 * deviner qu'un bouton manque.
 *
 * Version 9 : l'unité occupée dit si la fiche de son locataire est reliée à un
 * COMPTE. Un enregistrement antérieur ne porte pas le champ, et l'écran lit
 * alors « absent vaut reliée » — le repli est délibéré, il évite de peindre
 * tout un parc d'un avertissement sur la foi d'un silence.
 *
 * L'INCRÉMENT RESTE OBLIGATOIRE, et c'est la version 7 qui donne la règle : une
 * donnée absente qu'on n'affiche pas se tait, une donnée absente qui change ce
 * qu'on montre ne se tait pas. Ici, un état d'avant ce lot ferait disparaître
 * la pastille « Sans compte » et la note qui dit ce qu'elle coûte — le bailleur
 * conclurait que tous ses locataires ont un espace, alors que le serveur dit le
 * contraire. C'est un écran FAUX, pas un écran incomplet, et c'est exactement
 * le seuil que cet historique retient depuis la version 7.
 *
 * Version 10 : l'intervention porte les DÉTAILS écrits par son déclarant. Un
 * enregistrement antérieur ne les a pas, et la liste du locataire n'affiche
 * alors rien sous le titre.
 *
 * LE CAS EST PLUS PROCHE DE « SE TAIRE » QUE LES DEUX PRÉCÉDENTS, et il faut le
 * dire : aucune commande ne disparaît, aucun chiffre ne se contredit. Ce qui
 * penche quand même vers l'incrément est le point de vue du DÉCLARANT — pour
 * lui, une ligne vide sous son titre se lit « je n'ai rien écrit », ce qui est
 * faux s'il a écrit. C'est un jugement sur la lecture, pas une mesure.
 *
 * Version 11 : LA FORME N'A PAS CHANGÉ, et c'est le seul incrément de cet
 * historique dont ce soit vrai. Il purge.
 *
 * `PortfolioProvider` écrivait ici le parc RÉEL — sa boucle d'enregistrement ne
 * regardait que le changement de référence, et la réponse du serveur en change
 * une. Ces trois collections portent des noms et un téléphone ; `/demo` sème
 * son état initial en relisant cette clé, et rien ne l'écrase ensuite. La
 * démonstration montrait donc les locataires, les propriétaires et les
 * gestionnaires du parc de qui l'ouvrait.
 *
 * L'écriture est fermée là-bas, ce qui suffit pour demain. Cet incrément est
 * pour HIER : tout navigateur ayant déjà ouvert un espace réel porte cet
 * enregistrement à cette heure, et rien d'autre ne l'en délogerait — la clé est
 * réécrite, jamais relue comme suspecte. Un numéro qui ne correspond plus la
 * fait supprimer à la première lecture, sur chaque appareil, sans que personne
 * ait à vider quoi que ce soit à la main.
 *
 * LE PRIX EST CONNU ET ACCEPTÉ : un parcours de démonstration en cours est
 * effacé au prochain chargement. C'est un jeu fictif qu'un clic reconstitue,
 * contre des données personnelles qui restent sinon sur l'appareil.
 */
const VERSION = 11
const CLE = 'gestlocpro.portfolio'

export interface EtatPersiste {
  units: Unit[]
  works: WorkOrder[]
  deposits: Deposit[]
}

const ETAT_INITIAL: EtatPersiste = { units: UNITS, works: WORKS, deposits: DEPOSITS }

/**
 * Champs dont les écrans ont RÉELLEMENT besoin, par collection.
 *
 * La vérification ne portait que sur « c'est un tableau non vide ». Elle a
 * laissé passer un enregistrement où les unités n'avaient pas de `buildingId` :
 * l'écran du parc affichait « Trois immeubles, douze unités » en titre et
 * `0/0` dans chacune des trois cartes, puisque aucune unité ne se rattachait à
 * son immeuble. Deux chiffres qui se contredisent sur le même écran, sans que
 * rien ne signale un état corrompu.
 *
 * On nomme donc les champs qui portent les liens et les libellés — ceux dont
 * l'absence produit un écran faux plutôt qu'un écran vide. Le reste n'est pas
 * inspecté : ce garde doit rester bon marché, et un enregistrement dont ces
 * clés sont présentes est réparable, pas trompeur.
 */
const CHAMPS_REQUIS = {
  units: ['id', 'buildingId', 'label', 'status'],
  works: ['id', 'unitId', 'status'],
  deposits: ['unitId', 'status'],
} as const

function collectionValide(valeur: unknown, champs: readonly string[]): boolean {
  if (!Array.isArray(valeur)) return false
  // Une collection vide signale un enregistrement corrompu plutôt qu'un parc
  // réellement vidé : rien dans l'interface ne permet de supprimer une unité.
  if (valeur.length === 0) return false
  return valeur.every(
    (element) =>
      !!element &&
      typeof element === 'object' &&
      champs.every((champ) => champ in (element as Record<string, unknown>)),
  )
}

/** Vérifie qu'un objet lu a bien la forme attendue, champs porteurs compris. */
function formeValide(valeur: unknown): valeur is EtatPersiste {
  if (!valeur || typeof valeur !== 'object') return false
  const etat = valeur as Partial<EtatPersiste>
  return (
    collectionValide(etat.units, CHAMPS_REQUIS.units) &&
    collectionValide(etat.works, CHAMPS_REQUIS.works) &&
    collectionValide(etat.deposits, CHAMPS_REQUIS.deposits)
  )
}

/**
 * Signature de la forme enregistrée : les clés effectivement présentes.
 *
 * Exportée pour un seul usage — le test qui la compare à une valeur figée à
 * côté de `VERSION`. Rien dans le code de production ne l'appelle.
 *
 * C'est le garde qui manquait : la discipline « incrémenter `VERSION` dès que
 * la forme change » n'était écrite que dans un commentaire, et un commentaire
 * n'arrête personne. Le jour où on l'oublie, les utilisateurs relisent un état
 * périmé et l'écran ment.
 */
export function signatureDeLaForme(etat: EtatPersiste = ETAT_INITIAL): Record<string, string[]> {
  const cles = (liste: readonly unknown[]) =>
    [...new Set(liste.flatMap((e) => Object.keys(e as object)))].sort()
  return {
    units: cles(etat.units),
    works: cles(etat.works),
    deposits: cles(etat.deposits),
  }
}

/** Exportée pour le même test, qui doit pouvoir dire de quelle version il parle. */
export const VERSION_STOCKAGE = VERSION

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
