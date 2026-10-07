import {
  BUILDINGS,
  DEPOSITS,
  READINGS,
  UNITS,
  WORKS,
  type Deposit,
  type Unit,
  type WorkOrder,
} from './portfolio'

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
 *
 * Version 12 : LA FORME N'A PAS CHANGÉ NON PLUS. Elle purge ce que la version
 * 11 croyait avoir fermé.
 *
 * « L'écriture est fermée là-bas, ce qui suffit pour demain », disait l'entrée
 * ci-dessus. Elle ne l'était pas : la boucle d'enregistrement se gardait par
 * `if (parkId) return`, et `parkId` tombe à `null` AVANT que les trois
 * collections cessent de porter le parc réel — se déconnecter suffit. Le parc
 * réel repartait donc ici, sous la version 11 cette fois, et `loadState()` la
 * relit comme bonne. La garde est désormais posée sur la PROVENANCE (`fromApi`),
 * ce qui ferme demain pour de bon ; cet incrément est pour les trois dernières
 * semaines, où chaque déconnexion a réécrit la clé.
 *
 * CE QUE CELA DONNAIT À L'ÉCRAN, mesuré en production le 2026-10-07 : dix
 * relevés de démonstration — eux, aucun chemin ne les repose jamais — au-dessus
 * d'unités réelles qu'ils ne connaissent pas. Dix fois « Logement inconnu ».
 */
const VERSION = 12
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
 * L'ENREGISTREMENT DOIT S'ANCRER DANS LE PARC DE DÉMONSTRATION.
 *
 * `CHAMPS_REQUIS` ci-dessus nomme `buildingId` parce qu'une unité sans lien
 * produisait un écran faux. Son remède vérifie que le champ est PRÉSENT — et
 * c'est tout ce qu'il vérifie. Un parc RÉEL le porte : ce sont de vrais UUID, et
 * un tel enregistrement passait `formeValide` sans réserve. La forme était
 * contrôlée, l'APPARTENANCE jamais.
 *
 * CE QUE CELA RENDAIT EN PRODUCTION, mesuré au volet navigateur le 2026-10-07
 * sur `/demo/parc` à 1440 px, sans aucune session : trois immeubles de
 * démonstration annonçant chacun « aucun logement », et à leur suite DEUX
 * groupes SANS NOM portant trois logements d'un parc réel, avec les noms de
 * leurs locataires. Les unités reviennent de cette clé ; `buildings`, lui, n'y
 * est pas enregistré et retombe sur la fixture. Aucun `buildingId` ne résolvait,
 * et `buildingById(id)?.name ?? ''` rendait la chaîne vide.
 *
 * DEUX REMÈDES FERMAIENT L'ÉCRAN CONTRADICTOIRE, UN SEUL FERME LA FUITE.
 * Enregistrer `buildings` en plus rendrait l'écran cohérent — et afficherait
 * alors le parc réel PROPREMENT, noms d'immeubles compris, sur une adresse
 * publique dont la raison d'être est de ne montrer personne. C'est le contraire
 * de ce qu'il faut. Ce qui ne doit pas servir la démonstration, c'est
 * l'enregistrement lui-même.
 *
 * ET POURQUOI PAS LA SEULE PURGE PAR VERSION, qui efface aussi ces dossiers :
 * la version 11 a été incrémentée pour cela, en écrivant « l'écriture est fermée
 * là-bas, ce qui suffit pour demain ». L'enregistrement mesuré en production
 * PORTAIT la version 11 — il a donc été écrit après cette purge, par le code en
 * cours. Une purge suppose qu'on a trouvé toutes les voies d'écriture ; ce refus
 * est vrai quelle qu'en soit la voie, y compris celle qu'on n'a pas trouvée. Les
 * deux se complètent plutôt qu'ils ne se remplacent : la purge vide hier, ce
 * garde refuse ce qui reviendrait demain.
 *
 * LE PRIX, ET IL EST RÉEL : `addBuilding` crée en démonstration un immeuble
 * `local-N` que cette clé n'enregistre pas. Un parcours qui déclare un immeuble
 * puis y ajoute un logement perd donc les deux au rechargement, au lieu de
 * rendre ce logement dans un groupe anonyme. C'est le même arbitrage que la
 * version 11 a déjà posé — « un jeu fictif qu'un clic reconstitue, contre des
 * données personnelles qui restent sinon sur l'appareil » — et il penche du même
 * côté : l'état hybride n'était pas un parcours sauvé, c'était un écran faux.
 */
const IMMEUBLES_DE_DEMONSTRATION = new Set(BUILDINGS.map((immeuble) => immeuble.id))

function ancreDansLaDemonstration(etat: EtatPersiste): boolean {
  return etat.units.every((unite) => IMMEUBLES_DE_DEMONSTRATION.has(unite.buildingId))
}

/**
 * L'ENREGISTREMENT DOIT PORTER TOUTES LES UNITÉS QUE LES RELEVÉS RÉFÉRENCENT.
 *
 * TROISIÈME VOIE VERS « LOGEMENT INCONNU », et la seule qui n'a besoin d'aucun
 * parc réel. Les deux précédentes — la PROVENANCE, puis l'ANCRAGE juste
 * au-dessus — parlaient d'un parc étranger qui s'invitait dans la clé. Celle-ci
 * s'ouvre toute seule, avec le TEMPS.
 *
 * `EtatPersiste` enregistre `units`, `works` et `deposits`. Il n'enregistre pas
 * `readings` : le fournisseur sème ses relevés depuis `READINGS` en dur à chaque
 * chargement, et aucun chemin ne les repose depuis la clé. Deux collections qui
 * se référencent par `unitId`, dont une seule est enregistrée — et un
 * enregistrement d'hier relu sous les relevés d'aujourd'hui orpheline tout ce
 * qui a bougé entre les deux.
 *
 * RIEN NE L'ARRÊTAIT EN CHEMIN : la provenance est bonne, l'ancrage tient, la
 * forme est intacte, et `VERSION` n'a aucune raison de bouger puisque c'est le
 * CONTENU du jeu qui a changé, pas sa forme. `persistenceVersion.test.ts` le dit
 * d'ailleurs en propres termes — il garde « que la forme ne change jamais EN
 * SILENCE », ce qui est tout ce qu'on lui demande.
 *
 * ET LE DÉCLENCHEUR EST LE PARCOURS NORMAL D'UN VISITEUR QUI REPASSE : sondé au
 * volet navigateur le 2026-10-07, un clic sur « Valider le devis » depuis
 * `/demo/travaux` fait passer cette clé d'absente à présente. Il suffit d'avoir
 * touché à la démonstration un jour, puis d'y revenir après un remaniement du
 * jeu de démonstration.
 *
 * ═══ POURQUOI REFUSER PLUTÔT QU'ENREGISTRER `readings` AVEC LE RESTE ═══
 *
 * L'autre remède existe, et il est séduisant : enregistrer les relevés eux aussi,
 * pour que les deux collections dérivent ENSEMBLE. Il a le mérite de garder le
 * parcours là où celui-ci l'efface. Trois mesures l'ont écarté.
 *
 * 1. IL PAIE AUJOURD'HUI, POUR TOUT LE MONDE, LE PRIX QU'IL PRÉTEND ÉVITER.
 *    Ajouter une clé à la forme enregistrée fait rougir
 *    `persistenceVersion.test.ts` — mesuré : ses DEUX cas tombent — et le
 *    message d'erreur dicte la suite, incrémenter `VERSION`. Or un incrément
 *    purge TOUS les enregistrements à la relecture suivante. L'option « garder
 *    le parcours » commence donc par effacer le parcours de chaque visiteur,
 *    tout de suite. Ce refus-ci n'efface que les enregistrements réellement
 *    incohérents — à cette heure, aucun : aucun geste de la démonstration ne
 *    RÉDUIT `units`, `removeUnit` étant hors de portée faute de `deletable`.
 *
 * 2. IL GROSSIT LA CLÉ DE 58 %, mesuré : 4 825 o aujourd'hui, 7 614 o avec les
 *    dix relevés. Ce n'est pas un plafond franchi, c'est un coût sans
 *    contrepartie — on n'enregistre pas ce que personne ne modifie. Aucun geste
 *    de la démonstration n'écrit un relevé.
 *
 * 3. IL VA CONTRE L'ARBITRAGE DÉJÀ RENDU UN LOT PLUS TÔT, sur exactement la même
 *    classe de défaut. `buildings` n'est pas enregistré non plus, et l'ancrage
 *    ci-dessus a tranché en REFUSANT l'enregistrement plutôt qu'en persistant la
 *    collection manquante — « ce qui ne doit pas servir la démonstration, c'est
 *    l'enregistrement lui-même ». Deux remèdes opposés pour deux moitiés du même
 *    défaut laisseraient ce fichier sans règle lisible.
 *
 * ET SURTOUT PAS UN FILTRE À L'AFFICHAGE : masquer les relevés orphelins
 * effacerait une donnée au lieu de la rattacher, et l'écran des relevés vient
 * justement d'être corrigé pour NOMMER ce qu'il ne sait pas rattacher — « un
 * vide se voit parmi des noms ; il ne se voit pas parmi des vides ». Le manque
 * doit rester visible le jour où il est réel ; ce qu'on supprime ici est la
 * cause, pas le symptôme.
 *
 * LE PRIX, ET IL EST RÉEL, le même que celui de l'ancrage : le jour où le jeu de
 * démonstration gagne un logement relevé, le parcours en cours de chaque
 * visiteur qui revient est effacé — une fois. C'est le même arbitrage que les
 * versions 11 et 12 ont déjà posé, « un jeu fictif qu'un clic reconstitue »
 * contre un écran faux, et il penche du même côté.
 */
const UNITES_QUE_LES_RELEVES_REFERENCENT = new Set(READINGS.map((releve) => releve.unitId))

function coherentAvecLesReleves(etat: EtatPersiste): boolean {
  const unitesEnregistrees = new Set(etat.units.map((unite) => unite.id))
  return [...UNITES_QUE_LES_RELEVES_REFERENCENT].every((unitId) =>
    unitesEnregistrees.has(unitId),
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
    /* On SUPPRIME plutôt que d'ignorer, comme pour une version périmée : laisser
       la clé en place ferait disparaître les noms de l'écran en laissant les
       données personnelles sur l'appareil, et le chargement suivant les
       relirait. */
    if (!ancreDansLaDemonstration(enveloppe.etat)) {
      window.localStorage.removeItem(CLE)
      return ETAT_INITIAL
    }
    /* Même geste, et pour la même raison : un enregistrement en retard sur le
       jeu de relevés rendrait un écran FAUX — des relevés sans logement — et le
       laisser en place le ferait relire au chargement suivant. */
    if (!coherentAvecLesReleves(enveloppe.etat)) {
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
