import type { MessageKey } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LES GESTES COURANTS DU PRODUIT — la seule liste, et elle ne recopie aucun nom.
 *
 * ═══ POURQUOI LES LIBELLÉS SONT DES CLÉS ET NON DU TEXTE ═══
 *
 * Un manuel qui écrit « cliquez sur “Bail et sûretés” » porte une COPIE du
 * libellé. Le jour où ce bouton est renommé — ce qui est arrivé deux fois dans
 * ce dépôt, « Corriger » et « Retirer » s'étant repliés derrière trois points —
 * le manuel décrit un bouton qui n'existe plus, et rien ne le dit. Un manuel
 * faux est pire qu'un manuel absent : il envoie chercher là où il n'y a rien.
 *
 * Chaque geste nomme donc la CLÉ du libellé que l'écran peint déjà. Le manuel
 * affiche `t(gesteKey)`, c'est-à-dire exactement ce que l'utilisateur va lire
 * sur le bouton, dans sa langue. Renommer le bouton renomme le manuel.
 *
 * `MessageKey` est dérivé du dictionnaire français par `LeafPaths`, donc une clé
 * SUPPRIMÉE ou DÉPLACÉE fait échouer `tsc` — pas une relecture, le compilateur.
 * Ce qu'il ne voit pas, c'est une clé qui change de TEXTE sans changer de
 * chemin ; mais dans ce cas le manuel suit le nouveau texte, qui est le bon.
 *
 * ═══ CE QUE `adresse` PORTE, ET CE QU'ELLE NE PORTE PAS ═══
 *
 * Le PREMIER SEGMENT sous la base — « paiements », « parc » —, celui qui porte
 * le garde de rôle et que `ROLES_PAR_ADRESSE` connaît. Les gestes qui vivent
 * dans le dossier d'un logement portent donc `parc` : c'est de là qu'on y entre,
 * et leur phrase dit le reste du chemin. Mettre `parc/:unitId` ici donnerait une
 * adresse qu'aucun lien ne peut composer sans identifiant.
 *
 * ═══ CE QUI N'EST PAS DANS CETTE LISTE, ET POURQUOI ═══
 *
 * L'ÉMISSION DES APPELS DE LOYER n'y est pas : elle n'a pas de bouton. Le
 * serveur l'effectue, et la décrire comme un geste enverrait chercher une
 * commande qui n'existe pas. Un manuel décrit ce que le produit FAIT, pas ce
 * qu'on aurait aimé qu'il offre.
 *
 * LES GESTES DESTRUCTEURS non plus — retirer un logement, révoquer un accès,
 * supprimer un immeuble. Ils existent et ils sont gardés par une confirmation ;
 * les mettre dans la liste des « gestes courants » les présenterait comme de
 * la routine mensuelle, ce qu'ils ne sont pas.
 */
export type Geste = {
  /**
   * La clé de la PHRASE qui explique ce geste — et l'identité du geste.
   *
   * UN SEUL CHAMP, ET C'EST VOULU. La première rédaction portait `cle: string`
   * et composait `app.manual.gestes.${cle}` au rendu. Ce transtypage annulait
   * la seule garantie qui vaille ici : la phrase existait ou non, et on ne le
   * savait qu'à l'exécution, en lisant une clé brute à l'écran. Typée
   * `MessageKey`, elle est vérifiée par `tsc` comme les autres.
   *
   * L'identifiant court — pour dédoublonner et pour confronter l'anglais — est
   * le dernier segment, rendu par `cleDe`.
   */
  readonly phraseKey: MessageKey
  /** Qui fait ce geste. Jamais vide — un geste sans rôle n'est atteint par personne. */
  readonly roles: readonly Role[]
  /** Premier segment sous la base : celui qui porte le garde de rôle. */
  readonly adresse: string
  /** La clé du libellé de l'écran, prise dans `nav.*` — la même que la navigation. */
  readonly ecranKey: MessageKey
  /**
   * La clé du libellé du BOUTON, quand le geste en a un.
   *
   * Absente pour ce qui se CONSULTE sans rien déclencher — le registre des
   * décisions, l'espace du locataire. Inventer un bouton pour uniformiser la
   * forme de cette table ferait décrire un geste qui n'existe pas.
   */
  readonly gesteKey?: MessageKey
}

const GESTION: readonly Role[] = ['owner', 'manager']
const PROPRIETAIRE: readonly Role[] = ['owner']
const LOCATAIRE: readonly Role[] = ['tenant']

/**
 * L'ordre est celui du MOIS, pas celui de la navigation.
 *
 * On monte son parc, on y met des gens, on encaisse, on relance, on dépense, on
 * reloue. Ranger ces gestes par écran les présenterait dans l'ordre d'une barre
 * latérale, qui est l'ordre du produit et non celui du travail.
 */
export const GESTES: readonly Geste[] = [
  /* ── MONTER ET TENIR LE PARC ── */
  {
    phraseKey: 'app.manual.gestes.ajouterImmeuble',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.portfolio.addBuildingTitle',
  },
  {
    phraseKey: 'app.manual.gestes.ajouterLogement',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.portfolio.addUnitTitle',
  },
  {
    phraseKey: 'app.manual.gestes.corrigerLeParc',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.parkSettings.open',
  },
  {
    phraseKey: 'app.manual.gestes.attribuerUnLocataire',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.portfolio.assignTenant',
  },

  /* ── QUI A ACCÈS, ET À QUOI ── */
  {
    phraseKey: 'app.manual.gestes.inviterParCode',
    roles: GESTION,
    adresse: 'acces',
    ecranKey: 'nav.access',
    gesteKey: 'app.invite.button',
  },
  {
    phraseKey: 'app.manual.gestes.confierDesImmeubles',
    roles: PROPRIETAIRE,
    adresse: 'acces',
    ecranKey: 'nav.access',
    gesteKey: 'app.access.scopeAction',
  },
  {
    phraseKey: 'app.manual.gestes.poserLesHonoraires',
    roles: PROPRIETAIRE,
    adresse: 'acces',
    ecranKey: 'nav.access',
    gesteKey: 'app.fees.open',
  },

  /* ── CE QUI RENTRE ── */
  {
    phraseKey: 'app.manual.gestes.enregistrerUnPaiement',
    roles: GESTION,
    adresse: 'paiements',
    ecranKey: 'nav.payments',
    gesteKey: 'app.payments.modalTitle',
  },
  {
    phraseKey: 'app.manual.gestes.encaisser',
    roles: GESTION,
    adresse: 'paiements',
    ecranKey: 'nav.payments',
    gesteKey: 'app.payments.collect',
  },
  {
    phraseKey: 'app.manual.gestes.joindreUnePreuve',
    roles: GESTION,
    adresse: 'paiements',
    ecranKey: 'nav.payments',
    gesteKey: 'app.receipts.attachProof',
  },
  {
    phraseKey: 'app.manual.gestes.relancerLesRetards',
    roles: GESTION,
    adresse: 'paiements',
    ecranKey: 'nav.payments',
    gesteKey: 'app.payments.remind',
  },
  {
    phraseKey: 'app.manual.gestes.mettreEnDemeure',
    roles: GESTION,
    adresse: 'paiements',
    ecranKey: 'nav.payments',
    gesteKey: 'app.payments.notice',
  },

  /* ── QUAND ÇA NE RENTRE PAS ── */
  {
    phraseKey: 'app.manual.gestes.convenirUnPlan',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.lease.planCreate',
  },

  /* ── LE BAIL AU LONG DE SA VIE ── */
  {
    phraseKey: 'app.manual.gestes.bailEtSuretes',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.lease.open',
  },
  {
    phraseKey: 'app.manual.gestes.reviserLeLoyer',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.lease.revise',
  },
  {
    phraseKey: 'app.manual.gestes.enregistrerUnConge',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.lease.giveNotice',
  },
  {
    phraseKey: 'app.manual.gestes.chargesEtRegularisation',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.leaseCharges.open',
  },

  /* ── CE QUI SE MESURE ET CE QUI SORT ── */
  {
    phraseKey: 'app.manual.gestes.saisirUnReleve',
    roles: GESTION,
    adresse: 'releves',
    ecranKey: 'nav.meters',
    gesteKey: 'app.readings.record',
  },
  {
    phraseKey: 'app.manual.gestes.saisirUneDepense',
    roles: GESTION,
    adresse: 'depenses',
    ecranKey: 'nav.expenses',
    gesteKey: 'app.expenses.add',
  },

  /* ── L'ÉTAT DU LOGEMENT ── */
  {
    phraseKey: 'app.manual.gestes.etablirUnEtatDesLieux',
    roles: GESTION,
    adresse: 'etats-des-lieux',
    ecranKey: 'nav.inspections',
    gesteKey: 'app.inspections.record',
  },
  {
    phraseKey: 'app.manual.gestes.ouvrirUnChantier',
    roles: GESTION,
    adresse: 'travaux',
    ecranKey: 'nav.works',
    gesteKey: 'app.works.openCta',
  },
  {
    phraseKey: 'app.manual.gestes.repondreAuLocataire',
    roles: GESTION,
    adresse: 'signalements',
    ecranKey: 'nav.alerts',
    gesteKey: 'app.works.reply',
  },

  /* ── LA FIN DU BAIL ── */
  {
    phraseKey: 'app.manual.gestes.arbitrerUneCaution',
    roles: GESTION,
    adresse: 'cautions',
    ecranKey: 'nav.deposits',
    gesteKey: 'app.deposits.settle',
  },
  {
    phraseKey: 'app.manual.gestes.ouvrirUneAnnonce',
    roles: GESTION,
    adresse: 'vacance',
    ecranKey: 'nav.vacancy',
    gesteKey: 'app.vacancy.open',
  },

  /* ── CE QUE LE PROPRIÉTAIRE CONTRÔLE ── */
  {
    phraseKey: 'app.manual.gestes.registreDesDecisions',
    roles: PROPRIETAIRE,
    adresse: 'decisions',
    ecranKey: 'nav.decisions',
  },
  {
    phraseKey: 'app.manual.gestes.exporterLeParc',
    roles: GESTION,
    adresse: 'parc',
    ecranKey: 'nav.portfolio',
    gesteKey: 'app.portfolio.exportPark',
  },

  /* ── CE QUE FAIT UN LOCATAIRE ── */
  {
    phraseKey: 'app.manual.gestes.voirCeQueJeDois',
    roles: LOCATAIRE,
    adresse: 'mon-espace',
    ecranKey: 'nav.mySpace',
  },
  {
    phraseKey: 'app.manual.gestes.telechargerMesQuittances',
    roles: LOCATAIRE,
    adresse: 'documents',
    ecranKey: 'nav.documents',
    gesteKey: 'app.tenant.downloadReceipts',
  },
  {
    phraseKey: 'app.manual.gestes.signalerUnProbleme',
    roles: LOCATAIRE,
    adresse: 'signaler',
    ecranKey: 'nav.report',
    gesteKey: 'app.report.cta',
  },
]

/**
 * L'identifiant court d'un geste : le dernier segment de sa clé de phrase.
 *
 * Dérivé plutôt que stocké à côté. Deux champs auraient pu diverger — un `cle`
 * qui ne correspond plus à sa `phraseKey` — et il aurait fallu un cas pour
 * garder leur accord. Un seul champ n'a pas ce problème.
 */
export function cleDe(geste: Geste): string {
  return geste.phraseKey.slice(geste.phraseKey.lastIndexOf('.') + 1)
}

/**
 * LES RÔLES QUE LE MANUEL DOCUMENTE, dans l'ordre du registre.
 *
 * Dérivé de `GESTES` et non écrit à la main : un rôle qui perdrait tous ses
 * gestes disparaîtrait d'ici au lieu d'afficher une section vide. Le cas de
 * garde, lui, refuse qu'un rôle du produit en arrive là — les deux se tiennent.
 */
export const ROLES_DOCUMENTES: readonly Role[] = [...new Set(GESTES.flatMap((g) => g.roles))]

/** Les gestes de ce rôle, dans l'ordre du mois. */
export function gestesDe(role: Role): readonly Geste[] {
  return GESTES.filter((g) => g.roles.includes(role))
}

/**
 * UNE SUITE : les gestes CONSÉCUTIFS d'un même écran.
 *
 * ═══ POURQUOI CE DÉCOUPAGE VIT ICI, ET PLUS DANS L'ÉCRAN ═══
 *
 * Il était calculé dans `GroupeDeGestes`, au moment du rendu. Le sommaire a
 * besoin du MÊME découpage — une entrée par suite, et l'ancre de chacune —, et
 * un second regroupement écrit à côté du premier aurait divergé à la première
 * retouche : le sommaire aurait promis une section que la page ne rend plus.
 * C'est la raison pour laquelle les deux lisent désormais une seule fonction.
 *
 * ═══ CONSÉCUTIFS, ET NON « TOUS LES GESTES DE CET ÉCRAN » ═══
 *
 * Trier par écran rendrait l'ordre de la barre latérale, qui est celui du
 * produit. Le registre est rangé dans l'ordre du MOIS — on monte son parc, on
 * encaisse, on relance, on reloue — et c'est cet ordre qui apprend quelque
 * chose. Le parc revient donc trois fois, ce qui est juste : ce ne sont pas les
 * mêmes moments.
 *
 * ═══ L'ANCRE EST DÉRIVÉE, JAMAIS SAISIE ═══
 *
 * `adresse` seule ne suffirait pas, précisément parce que le parc revient : les
 * trois sections porteraient `manuel-parc`, et le navigateur déposerait le
 * lecteur sur la première des trois quelle que soit celle qu'il a demandée. Le
 * geste de tête la distingue, et il est stable tant que ce geste ouvre la suite.
 */
export type Suite = {
  /** Ce qui suit `manuel-` dans l'`id` de la section et dans l'ancre qui y mène. */
  readonly ancre: string
  /** La clé du libellé de l'écran, commune à toute la suite. */
  readonly ecranKey: MessageKey
  /** Le premier segment sous la base, pour composer le lien « Ouvrir ». */
  readonly adresse: string
  /** Les gestes, dans l'ordre du registre. Jamais vide. */
  readonly gestes: readonly Geste[]
}

/** Les suites d'un rôle, dans l'ordre du mois. */
export function suitesDe(gestes: readonly Geste[]): readonly Suite[] {
  const suites: { ancre: string; ecranKey: MessageKey; adresse: string; gestes: Geste[] }[] = []

  for (const geste of gestes) {
    const derniere = suites[suites.length - 1]
    if (derniere && derniere.adresse === geste.adresse) derniere.gestes.push(geste)
    else
      suites.push({
        ancre: `${geste.adresse}-${cleDe(geste)}`,
        ecranKey: geste.ecranKey,
        adresse: geste.adresse,
        gestes: [geste],
      })
  }

  return suites
}
