import { useCallback } from 'react'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS, type CurrencyCode } from '@/currency/currencies'
import { useT } from '@/i18n/I18nProvider'
import { isoDay, isoMonth } from '@/lib/csv'
import { PDF_MIME, downloadBinaryFile, printBinaryFile } from '@/lib/download'
import { nouvelleMiseEnPage, type MiseEnPage } from '@/lib/miseEnPage'
import { nomDeFichier } from '@/lib/nomDeFichier'
import { construirePdf } from '@/lib/pdf'
import { partiesDeDate, partiesDeDateISO } from '@/lib/dates'
import { useDates } from '@/lib/useDates'
import { usePortfolio } from '@/data/PortfolioProvider'
import { soldeDeCaution } from '@/data/portfolio'
import {
  PAYMENT_METHOD_LABELS,
  imputationDesPostes,
  receiptDue,
  type Deposit,
  type Inspection,
  type Receipt,
  type Unit,
} from '@/data/portfolio'

/**
 * LES TROIS DOCUMENTS QUE LE PRODUIT SAIT ÉMETTRE EN PDF.
 *
 * ═══ CE QUI A CHANGÉ, ET CE QUI NE CHANGE PAS ═══
 *
 * L'écran des documents disait « Aucun document déposé » sur deux de ses trois
 * lignes, et c'était honnête : le produit ne savait ni recevoir un fichier ni en
 * fabriquer un. Il sait désormais en fabriquer — voir `lib/pdf.ts`. Les deux
 * lignes s'ouvrent donc, parce que LEURS DONNÉES EXISTENT : une caution porte
 * son consigné, son retenu et son solde ; un état des lieux porte sa date, ses
 * pièces et ses réserves.
 *
 * LE CONTRAT DE BAIL RESTE FERMÉ, et c'est le point de doctrine de ce lot. Rien
 * n'enregistre le texte d'un bail : le produire reviendrait à FABRIQUER un
 * document que rien n'atteste, sous une mise en page qui lui donnerait
 * l'apparence d'une pièce. La ligne continue donc de dire la case vide.
 *
 * ═══ CE QUE CES PDF SONT, ET CE QU'ILS NE SONT PAS ═══
 *
 * ILS SONT ÉMIS DANS LA DEVISE DU PARC, jamais dans celle qu'on affiche. Le
 * produit convertit désormais à l'écran — parité légale pour le franc CFA, cours
 * de la BCE pour les deux dollars — et une PIÈCE ne se convertit pas : le
 * locataire a versé 145 000 francs, une quittance qui atteste 221,05 € atteste
 * d'un fait qui n'a pas eu lieu, et le montant changerait au cours du lendemain.
 * Un document dit ce qui s'est passé ; un écran aide à le lire.
 *
 * Ils sont produits par l'application À PARTIR DES DONNÉES ENREGISTRÉES dans le
 * parc, et chacun le dit en pied de page. Ils ne portent AUCUNE signature, et le
 * pied de page le dit aussi — c'est la différence entre un relevé qu'on remet et
 * une pièce qu'on oppose, et la taire serait le genre de promesse inventée que
 * ce produit refuse ailleurs explicitement.
 */

/** L'en-tête commun : qui émet, quel document, sur quel logement. */
function enTete(
  page: MiseEnPage,
  contexte: { parc: string; titre: string; logement: string; ligneDate: string },
) {
  page.titre(contexte.titre, contexte.parc)
  page.filet()
  page.ligne(contexte.logement)
  page.ligne(contexte.ligneDate, { petit: true })
  page.filet()
}

/**
 * Ce que l'appelant doit fournir pour nommer l'émetteur.
 *
 * Le nom du parc vient de l'ADHÉSION et non d'une constante : un document émis
 * pour le parc de quelqu'un d'autre porterait sinon le nom du premier venu.
 */
function useEmetteur() {
  const { adhesionActive } = useSession()
  const t = useT()
  return adhesionActive?.parkName ?? t('common.demoPark')
}

/**
 * LE NOM DE L'IMMEUBLE, PRIS SUR L'ÉTAT PARTAGÉ ET NON SUR LA DÉMONSTRATION.
 *
 * Les documents appelaient le `buildingById` du module de démonstration, qui ne
 * connaît que « bon », « akw », « des ». Sur un vrai parc les identifiants sont
 * des `uuid` : la recherche ne trouvait jamais rien, et la quittance sortait en
 * ne nommant que le numéro du logement — « B7 », sans dire dans quel immeuble.
 *
 * Le dépôt avait déjà payé cette confusion deux fois, sur l'état des lieux du
 * locataire et sur le titre de son espace ; les deux commentaires le racontent.
 * C'est la troisième, et c'est la garde de mise en page qui l'a nommée — son
 * jeu d'essai exigeait un nom d'immeuble LONG, et le document n'en portait
 * aucun.
 */
function useNomDeLImmeuble() {
  const { buildingById } = usePortfolio()
  /* Mémoïsée pour pouvoir entrer dans les dépendances des `useCallback`
     ci-dessous : rendue neuve à chaque passage, elle y aurait figé un
     `buildingById` périmé, ou les aurait tous invalidés à chaque rendu. */
  return useCallback((unit: Unit) => buildingById(unit.buildingId)?.name, [buildingById])
}

/** L'identité du logement sur le document : son numéro, puis son immeuble. */
function logementNomme(unit: Unit, immeuble: string | undefined): string {
  return [unit.label, immeuble].filter(Boolean).join(' · ')
}

/** Remet le document et annonce le fichier — dans cet ordre, jamais l'inverse. */
function useRemise() {
  const t = useT()
  const { notify } = useToast()
  return useCallback(
    (pages: ReturnType<MiseEnPage['pages']>, nom: string, avis: 'app.receiptDownloaded' | 'app.documents.pdfDownloaded') => {
      downloadBinaryFile(construirePdf(pages), nom, PDF_MIME)
      notify(t(avis, { file: nom }), { tone: 'ok' })
      return nom
    },
    [notify, t],
  )
}

/* ─── LA QUITTANCE ────────────────────────────────────────────────────────── */

/**
 * Une quittance, une page.
 *
 * ELLE REMPLACE UN CSV D'UNE SEULE LIGNE. Celui-ci était honnête faute de mieux
 * — son commentaire disait « le vrai document est un PDF que ce produit ne sait
 * pas encore fabriquer » — mais un tableur d'une ligne n'est pas ce qu'un
 * locataire présente à qui lui demande une quittance.
 *
 * LE DÉTAIL DE LA PÉRIODE Y FIGURE, poste par poste, et l'imputation des
 * versements suit la convention du produit : loyer, puis eau, puis électricité.
 * La recalculer ici en aurait fait une seconde convention.
 */

/**
 * LE CONTENU D'UNE QUITTANCE, INDÉPENDANT DE SA SOURCE.
 *
 * ═══ POURQUOI CETTE FORME NEUTRE EXISTE ═══
 *
 * Le produit émet la même pièce par DEUX chemins, et c'était la réserve écrite
 * au lot précédent : le gestionnaire ouvre un document ARRÊTÉ PAR LE SERVEUR —
 * `POST /:parkId/receipts`, avec la devise du parc et aucun montant recalculé —
 * pendant que le locataire télécharge ce que le client compose depuis les
 * données du portefeuille. Deux sources, et jusqu'ici deux mises en page.
 *
 * Les fondre en une seule SOURCE demanderait d'ouvrir la route d'émission au
 * locataire pour son propre bail : un lot serveur, avec sa garde
 * d'autorisation. Les fondre en une seule MISE EN PAGE ne demande que ceci —
 * une forme que les deux sources savent remplir. Le même mois rend désormais la
 * même feuille, quel que soit celui qui la demande.
 *
 * Les montants sont déjà MIS EN FORME par l'appelant, et c'est délibéré : le
 * document du serveur porte SA devise, celle du parc à l'émission, tandis que
 * l'espace locataire emploie la devise d'affichage. Composer ici aurait
 * réintroduit la divergence par la petite porte.
 */
export interface ContenuDeQuittance {
  titre: 'app.receipts.quittance' | 'app.receipts.recu'
  logement: string
  periode: string
  locataire: string
  postes: { rent: string; water: string; power: string }
  du: string
  paye: string
  /** Absent quand la période est soldée — voir plus bas. */
  reste?: string
  statut: string
  versements: { trace: string; montant: string }[]
  /** L'imputation, seulement là où elle apprend quelque chose. */
  imputation?: string
  /**
   * D'OÙ VIENNENT LES MONTANTS, quand ils ont été convertis.
   *
   * Une quittance atteste d'un encaissement. Écrire « 260,60 € » là où
   * 170 942 FCFA ont été reçus n'est vrai que si la pièce dit qu'elle convertit,
   * depuis quoi et à quel taux. Absent quand rien n'a été converti : une mention
   * sur un document exact jetterait un doute sur des montants qui n'en méritent
   * pas.
   */
  conversion?: string
}

/**
 * LES FAITS D'UNE PÉRIODE, avant qu'on en fasse un document.
 *
 * C'est ce que les DEUX sources savent dire — le portefeuille du client et le
 * document arrêté du serveur. Tout le reste — le titre, le statut, le reste dû,
 * l'imputation — s'en DÉDUIT, et se déduit au même endroit.
 */
export interface FaitsDeLaPeriode {
  logement: string
  periode: string
  locataire: string
  rentMinor: number
  waterMinor: number
  powerMinor: number
  dueMinor: number
  paidMinor: number
  versements: { trace: string; amountMinor: number }[]
  /** La base de la conversion, s'il y en a eu une — voir `ContenuDeQuittance`. */
  conversion?: string
}

/**
 * QUITTANCE OU REÇU — LA RÈGLE EST CELLE DU SERVEUR, ET ELLE Y EST ÉCRITE.
 *
 * « Quittance seulement si la période est intégralement soldée. En deçà, on
 * émet un REÇU, qui n'atteste que le montant reçu. Confondre les deux ferait
 * signer au bailleur une preuve de paiement qu'il n'a pas reçu. » — la route
 * d'émission, qui calcule `solde <= 0` exactement comme ici.
 *
 * Le document du locataire s'intitulait « Quittance de loyer » sur TOUTES ses
 * périodes, celles qu'il n'a réglées qu'en partie comprises. Le même mois
 * portait donc deux noms selon qui le regardait — et c'est le locataire qui
 * garde le document et le présente.
 */
export function titreDuDocument(solde: number): ContenuDeQuittance['titre'] {
  return solde <= 0 ? 'app.receipts.quittance' : 'app.receipts.recu'
}

/**
 * LE STATUT D'UNE PIÈCE NE CONNAÎT PAS LE RETARD, et c'est un choix.
 *
 * `receiptStatus` en distingue quatre, dont `overdue` — qui demande une date
 * d'échéance. Le document arrêté par le serveur n'en porte pas : le chemin du
 * gestionnaire ne pouvait donc pas rendre le même mot que celui du locataire,
 * et les deux feuilles divergeaient sur un mois en retard.
 *
 * On aurait pu porter l'échéance jusqu'ici. On ne l'a pas fait, parce qu'une
 * PIÈCE atteste de ce qui a été reçu, pas de la diligence de qui devait payer.
 * Le retard est un état de gestion : il vit sur les écrans, où il appelle un
 * geste. Sur la feuille, « reste à régler » dit tout ce que le document a à
 * dire, et il le dit sans juger.
 */
function statutDeLaPiece(du: number, paye: number): 'status.paid' | 'status.partial' | 'status.pending' {
  if (paye >= du) return 'status.paid'
  return paye > 0 ? 'status.partial' : 'status.pending'
}

/**
 * LA COMPOSITION, UNE FOIS POUR LES DEUX SOURCES.
 *
 * Elle existe parce que la comparaison des deux feuilles a montré qu'elles
 * différaient : celle du locataire portait l'imputation poste par poste, celle
 * du gestionnaire non — même mois, mêmes chiffres, deux documents. Chaque
 * déduction faite d'un côté seulement est une divergence en attente ; il n'y a
 * donc plus qu'un endroit où déduire.
 */
export function composerLaQuittance(
  t: ReturnType<typeof useT>,
  argent: (montant: number) => string,
  faits: FaitsDeLaPeriode,
): ContenuDeQuittance {
  const solde = faits.dueMinor - faits.paidMinor
  const part = imputationDesPostes(faits, faits.paidMinor)

  return {
    titre: titreDuDocument(solde),
    conversion: faits.conversion,
    logement: faits.logement,
    periode: faits.periode,
    locataire: faits.locataire,
    postes: {
      rent: argent(faits.rentMinor),
      water: argent(faits.waterMinor),
      power: argent(faits.powerMinor),
    },
    du: argent(faits.dueMinor),
    paye: argent(faits.paidMinor),
    reste: solde > 0 ? argent(solde) : undefined,
    statut: t(statutDeLaPiece(faits.dueMinor, faits.paidMinor)),
    versements: faits.versements.map((versement) => ({
      trace: versement.trace,
      montant: argent(versement.amountMinor),
    })),
    /* L'imputation, seulement là où elle apprend quelque chose : sur une période
       partiellement réglée, elle dit QUEL poste reste ouvert. */
    imputation:
      solde > 0 && faits.paidMinor > 0
        ? t('app.documents.pdfImputation', {
            rent: argent(part.rent),
            water: argent(part.water),
            power: argent(part.power),
          })
        : undefined,
  }
}

/**
 * Une quittance, une page.
 *
 * ELLE REMPLACE UN CSV D'UNE SEULE LIGNE. Celui-ci était honnête faute de mieux
 * — son commentaire disait « le vrai document est un PDF que ce produit ne sait
 * pas encore fabriquer » — mais un tableur d'une ligne n'est pas ce qu'un
 * locataire présente à qui lui demande une quittance.
 *
 * LE DÉTAIL DE LA PÉRIODE Y FIGURE, poste par poste, et l'imputation des
 * versements suit la convention du produit : loyer, puis eau, puis électricité.
 * La recalculer ici en aurait fait une seconde convention.
 */

/**
 * LE CONTENU D'UNE QUITTANCE, INDÉPENDANT DE SA SOURCE.
 *
 * ═══ POURQUOI CETTE FORME NEUTRE EXISTE ═══
 *
 * Le produit émet la même pièce par DEUX chemins, et c'était la réserve écrite
 * au lot précédent : le gestionnaire ouvre un document ARRÊTÉ PAR LE SERVEUR —
 * `POST /:parkId/receipts`, avec la devise du parc et aucun montant recalculé —
 * pendant que le locataire télécharge ce que le client compose depuis les
 * données du portefeuille. Deux sources, et jusqu'ici deux mises en page.
 *
 * Les fondre en une seule SOURCE demanderait d'ouvrir la route d'émission au
 * locataire pour son propre bail : un lot serveur, avec sa garde
 * d'autorisation. Les fondre en une seule MISE EN PAGE ne demande que ceci —
 * une forme que les deux sources savent remplir. Le même mois rend désormais la
 * même feuille, quel que soit celui qui la demande.
 *
 * Les montants sont déjà MIS EN FORME par l'appelant, et c'est délibéré : le
 * document du serveur porte SA devise, celle du parc à l'émission, tandis que
 * l'espace locataire emploie la devise d'affichage. Composer ici aurait
 * réintroduit la divergence par la petite porte.
 */
export interface ContenuDeQuittance {
  titre: 'app.receipts.quittance' | 'app.receipts.recu'
  logement: string
  periode: string
  locataire: string
  postes: { rent: string; water: string; power: string }
  du: string
  paye: string
  /** Absent quand la période est soldée — voir plus bas. */
  reste?: string
  statut: string
  versements: { trace: string; montant: string }[]
  /** L'imputation, seulement là où elle apprend quelque chose. */
  imputation?: string
}


/**
 * Une quittance, une page.
 *
 * ELLE REMPLACE UN CSV D'UNE SEULE LIGNE. Celui-ci était honnête faute de mieux
 * — son commentaire disait « le vrai document est un PDF que ce produit ne sait
 * pas encore fabriquer » — mais un tableur d'une ligne n'est pas ce qu'un
 * locataire présente à qui lui demande une quittance.
 */
function pagesDeQuittance(
  page: MiseEnPage,
  t: ReturnType<typeof useT>,
  parc: string,
  emisLe: string,
  contenu: ContenuDeQuittance,
) {
  enTete(page, {
    parc,
    titre: t(contenu.titre),
    logement: contenu.logement,
    ligneDate: t('app.documents.pdfIssuedOn', { date: emisLe }),
  })

  page.paire(t('app.period'), contenu.periode, { gras: true })
  page.paire(t('app.portfolio.tenant'), contenu.locataire)

  page.section(t('app.documents.pdfBreakdown'))
  page.paire(t('app.tenant.colRent'), contenu.postes.rent)
  page.paire(t('app.tenant.colWater'), contenu.postes.water)
  page.paire(t('app.tenant.colPower'), contenu.postes.power)
  page.filet()

  page.paire(t('app.payments.due'), contenu.du, { gras: true })
  page.paire(t('app.payments.paid'), contenu.paye)
  /* LE RESTE N'APPARAÎT QUE S'IL EXISTE. « Reste à régler : 0 » sur une période
     soldée est un chiffre qu'il faut lire pour constater qu'il ne dit rien. */
  if (contenu.reste) page.paire(t('app.documents.pdfRemaining'), contenu.reste, { gras: true })
  page.paire(t('app.portfolio.status'), contenu.statut)

  page.section(t('app.documents.pdfPayments'))
  if (contenu.versements.length === 0) page.ligne(t('app.documents.pdfNoPayment'))
  for (const versement of contenu.versements) page.paire(versement.trace, versement.montant)

  /* LA BASE DE LA CONVERSION, en bas et en petit — mais SUR la pièce. Elle n'a
     pas sa place dans le corps, où elle passerait pour un poste ; elle en a une
     ici, où l'on lit les mentions qui qualifient ce qu'on vient de lire. */
  if (contenu.conversion) {
    page.saut(4)
    page.paragraphe(contenu.conversion, { petit: true })
  }

  if (contenu.imputation) {
    page.saut(4)
    page.paragraphe(contenu.imputation, { petit: true })
  }
}

/**
 * Ce que l'espace locataire sait d'une période, réduit à des FAITS.
 *
 * LA RÉFÉRENCE DE L'OPÉRATEUR EST SUR LA PIÈCE. C'est avec elle qu'un locataire
 * conteste un encaissement ; l'export en tableur la porte déjà, et un document
 * qui l'omettrait vaudrait moins que le fichier qu'il accompagne.
 */
function faitsDuPortefeuille(
  t: ReturnType<typeof useT>,
  d: ReturnType<typeof useDates>,
  unit: Unit,
  immeuble: string | undefined,
  receipt: Receipt,
  conversion?: string,
): FaitsDeLaPeriode {
  return {
    conversion,
    logement: logementNomme(unit, immeuble),
    periode: d.monthYear(receipt),
    locataire: unit.tenant ?? t('app.portfolio.noTenant'),
    rentMinor: receipt.rentMinor,
    waterMinor: receipt.waterMinor,
    powerMinor: receipt.powerMinor,
    dueMinor: receiptDue(receipt),
    paidMinor: receipt.paidMinor,
    versements: receipt.payments.map((versement) => ({
      trace: [
        d.fullDate(versement.paidOn),
        t(PAYMENT_METHOD_LABELS[versement.method] as 'app.payments.methodCash'),
        versement.reference,
      ]
        .filter(Boolean)
        .join(' · '),
      amountMinor: versement.amountMinor,
    })),
  }
}

/**
 * LA MENTION DE CONVERSION D'UN DOCUMENT — ou rien, s'il n'a rien converti.
 *
 * Elle nomme la devise D'ORIGINE et date le cours. La parité du franc CFA n'a
 * pas de date — elle est fixée par traité — et la phrase change alors plutôt que
 * d'annoncer un jour qu'on n'a pas.
 */
export function useMentionDeConversion() {
  const t = useT()
  const d = useDates()
  const { baseDeConversion } = useCurrency()

  return useCallback(
    (depuis: CurrencyCode): string | undefined => {
      const base = baseDeConversion(depuis)
      if (!base) return undefined
      const currency = CURRENCY_DEFS[base.depuis].label
      return base.date
        ? t('app.documents.pdfConverted', {
            currency,
            date: d.fullDate(partiesDeDateISO(base.date)),
          })
        : t('app.documents.pdfConvertedPegged', { currency })
    },
    [baseDeConversion, d, t],
  )
}

/** La date d'émission, celle du jour où l'on télécharge. */
function useEmisLe() {
  const d = useDates()
  return d.fullDate(partiesDeDate(new Date()))
}

export function useReceiptPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const emisLe = useEmisLe()
  const d = useDates()
  const { money, deviseSource } = useCurrency()
  const mentionner = useMentionDeConversion()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, receipt: Receipt): string => {
      const page = nouvelleMiseEnPage()
      /* LA DEVISE CHOISIE, ET NON PLUS CELLE DU PARC. Les documents étaient
         épinglés à `deviseSource` : on lisait ses loyers en euros et l'on
         téléchargeait une pièce en francs. La conversion se dit sur la feuille,
         voir `useMentionDeConversion`. */
      const argent = (montant: number) => money(montant, { compact: true })
      const contenu = composerLaQuittance(
        t,
        argent,
        faitsDuPortefeuille(t, d, unit, nommerLImmeuble(unit), receipt, mentionner(deviseSource)),
      )
      pagesDeQuittance(page, t, parc, emisLe, contenu)

      const titre = t(contenu.titre)
      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        // Le mois de la quittance, et non le jour du téléchargement : c'est la
        // période qui identifie le document.
        nomDeFichier([t('app.files.receipt'), unit.label], isoMonth(receipt), 'pdf'),
        'app.receiptDownloaded',
      )
    },
    [d, deviseSource, emisLe, mentionner, money, nommerLImmeuble, parc, remettre, t],
  )
}

/**
 * TOUTES LES QUITTANCES EN UN SEUL FICHIER, une page par période.
 *
 * Six téléchargements successifs se feraient arrêter par le navigateur dès le
 * deuxième, et le locataire repartirait avec une quittance sur six en croyant
 * les avoir toutes — c'est la raison qui avait donné un CSV unique à ce bouton.
 * Elle vaut toujours ; ce qui change est que le fichier unique est maintenant un
 * carnet de quittances plutôt qu'un tableau de chiffres.
 */
export function useAllReceiptsPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const emisLe = useEmisLe()
  const d = useDates()
  const { money, deviseSource } = useCurrency()
  const mentionner = useMentionDeConversion()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, receipts: Receipt[]): string => {
      const page = nouvelleMiseEnPage()
      /* LA DEVISE CHOISIE, ET NON PLUS CELLE DU PARC. Les documents étaient
         épinglés à `deviseSource` : on lisait ses loyers en euros et l'on
         téléchargeait une pièce en francs. La conversion se dit sur la feuille,
         voir `useMentionDeConversion`. */
      const argent = (montant: number) => money(montant, { compact: true })
      /* Cherché UNE fois pour tout le carnet : six pages, un seul logement. */
      const immeuble = nommerLImmeuble(unit)
      receipts.forEach((receipt, index) => {
        if (index > 0) page.pageNeuve()
        pagesDeQuittance(
          page,
          t,
          parc,
          emisLe,
          composerLaQuittance(
            t,
            argent,
            faitsDuPortefeuille(t, d, unit, immeuble, receipt, mentionner(deviseSource)),
          ),
        )
      })

      const titre = t('app.documents.allReceipts')
      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([t('app.documents.allReceipts'), unit.label], isoDay(new Date()), 'pdf'),
        'app.receiptDownloaded',
      )
    },
    [d, deviseSource, emisLe, mentionner, money, nommerLImmeuble, parc, remettre, t],
  )
}

/**
 * LA QUITTANCE DU GESTIONNAIRE, depuis le document que le SERVEUR a arrêté.
 *
 * C'est le second chemin, et il rend désormais la même feuille que le premier.
 * Il gardait `window.print()` pour seule issue : la boîte d'impression du
 * navigateur sait produire un PDF, mais elle y ajoute ses en-têtes, le nom du
 * fichier échappe au produit, et le comportement est inégal sur Android — la
 * cible principale. Un document remis à un locataire ne se remet pas au hasard
 * du réglage d'impression de qui l'émet.
 *
 * L'IMPRESSION SURVIT à côté : remettre une feuille de papier reste un geste du
 * métier, et une agence sans imprimante n'est pas la règle sur ce marché.
 *
 * LES MONTANTS NE SONT PAS RECALCULÉS, et c'est toute la valeur de ce
 * chemin-ci : ils viennent du document arrêté, dans SA devise — celle du parc à
 * l'émission — pour qu'une pièce réémise en octobre rende exactement celle de
 * juillet.
 */
/**
 * LE DOCUMENT ÉMIS, COMPOSÉ — ses pages et son nom, sans le remettre.
 *
 * Séparé de sa remise parce que DEUX gestes le veulent : « Télécharger » et
 * « Imprimer ». Ce dernier passait par `window.print()` et une feuille
 * `@media print`, donc par le DOM — et sortait la quittance coupée là où le
 * défilement de la modale s'arrêtait, sur deux pages portant chacune le même
 * haut de document. Les deux boutons partagent maintenant la composition, ce
 * que le commentaire du premier affirmait déjà sans que rien ne le tienne.
 */
function useCompositionDuDocumentEmis() {
  const t = useT()
  const parc = useEmetteur()
  const emisLe = useEmisLe()
  const mentionner = useMentionDeConversion()
  return useCallback(
    (document: DocumentEmisPdf) => {
      const page = nouvelleMiseEnPage()
      /*
        LA MÊME COMPOSITION QUE LE LOCATAIRE, à partir des faits du serveur.

        Cette branche déduisait autrefois son titre et son statut à part, et
        n'offrait pas l'imputation : le même mois rendait deux feuilles
        différentes. Ce qui est PROPRE au serveur reste ici — les montants
        arrêtés, leur devise, et son verdict entre quittance et reçu — le reste
        se déduit au seul endroit où il se déduit.
      */
      const contenu = composerLaQuittance(t, document.argent, {
        conversion: mentionner(document.devise),
        logement: [document.unit, document.building].filter(Boolean).join(' · '),
        periode: document.periode,
        locataire: document.tenant,
        rentMinor: document.rentMinor,
        waterMinor: document.waterMinor,
        powerMinor: document.powerMinor,
        dueMinor: document.dueMinor,
        paidMinor: document.paidMinor,
        versements: document.payments.map((versement) => ({
          trace: [versement.date, versement.moyen, versement.reference].filter(Boolean).join(' · '),
          amountMinor: versement.amountMinor,
        })),
      })

      /*
        LE VERDICT DU SERVEUR PRIME SUR LE CALCUL, et c'est le seul endroit où
        les deux chemins ont le droit de différer. Il connaît l'échéance et ses
        règles ; le client ne connaît que des montants. Ils s'accordent sur tous
        les cas ordinaires — c'est `solde <= 0` des deux côtés — et le jour où
        ils divergeraient, c'est le serveur qui a raison.
      */
      contenu.titre = document.kind === 'quittance' ? 'app.receipts.quittance' : 'app.receipts.recu'

      pagesDeQuittance(page, t, parc, emisLe, contenu)

      const titre = t(contenu.titre)
      return {
        pages: page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nom: nomDeFichier([titre, document.unit], document.moisISO, 'pdf'),
      }
    },
    [emisLe, mentionner, parc, t],
  )
}

/** Remet le document émis en fichier. */
export function useDocumentEmisPdf() {
  const composer = useCompositionDuDocumentEmis()
  const remettre = useRemise()
  return useCallback(
    (document: DocumentEmisPdf): string => {
      const { pages, nom } = composer(document)
      return remettre(pages, nom, 'app.receiptDownloaded')
    },
    [composer, remettre],
  )
}

/**
 * ENVOIE LE DOCUMENT ÉMIS À L'IMPRIMANTE — la pièce, pas l'écran.
 *
 * Aucun avis n'est levé, à la différence de la remise : un téléchargement se
 * termine hors de la vue, dans un dossier, et doit donc s'annoncer ; la boîte
 * d'impression, elle, s'ouvre par-dessus tout et s'annonce d'elle-même.
 */
export function useImpressionDuDocumentEmis() {
  const composer = useCompositionDuDocumentEmis()
  return useCallback(
    (document: DocumentEmisPdf): void => {
      printBinaryFile(construirePdf(composer(document).pages), PDF_MIME)
    },
    [composer],
  )
}

/**
 * Le document arrêté par le serveur, réduit à ce que la mise en page demande.
 *
 * La modale garde la forme complète — versements retirables, identifiants — et
 * ne passe ici que ce qui s'imprime. Les montants arrivent avec leur fonction de
 * mise en forme : c'est la devise DU DOCUMENT, pas celle de l'écran.
 */
export interface DocumentEmisPdf {
  kind: 'quittance' | 'recu'
  unit: string
  building: string
  tenant: string
  periode: string
  /** Le mois en ISO, pour le nom du fichier : c'est la période qui identifie. */
  moisISO: string
  rentMinor: number
  waterMinor: number
  powerMinor: number
  dueMinor: number
  paidMinor: number
  balanceMinor: number
  argent: (montant: number) => string
  /**
   * La devise D'ORIGINE de la pièce — celle du parc à l'émission.
   *
   * Elle sert à la mention de conversion, pas à la mise en forme : celle-ci
   * vient déjà d'`argent`. Sans elle, la feuille dirait « convertis » sans dire
   * depuis quoi, ce qui n'est pas une mention mais un aveu.
   */
  devise: CurrencyCode
  payments: { date: string; moyen: string; reference: string | null; amountMinor: number }[]
}

/* ─── LE REÇU DE CAUTION ──────────────────────────────────────────────────── */

export function useDepositPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const emisLe = useEmisLe()
  const d = useDates()
  const { money, deviseSource } = useCurrency()
  const mentionner = useMentionDeConversion()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, deposit: Deposit): string => {
      const page = nouvelleMiseEnPage()
      /* LA DEVISE CHOISIE, ET NON PLUS CELLE DU PARC. Les documents étaient
         épinglés à `deviseSource` : on lisait ses loyers en euros et l'on
         téléchargeait une pièce en francs. La conversion se dit sur la feuille,
         voir `useMentionDeConversion`. */
      const argent = (montant: number) => money(montant, { compact: true })
      const titre = t('app.documents.depositReceipt')

      enTete(page, {
        parc,
        titre,
        logement: logementNomme(unit, nommerLImmeuble(unit)),
        ligneDate: t('app.documents.pdfIssuedOn', { date: emisLe }),
      })

      page.paire(t('app.portfolio.tenant'), deposit.tenant ?? t('app.deposits.formerTenant'))
      page.paire(t('app.portfolio.status'), t(`app.deposits.${deposit.status}` as 'app.deposits.held'))

      page.section(t('app.deposits.totalHeld'))
      page.paire(t('app.deposits.amountHeld'), argent(deposit.held), { gras: true })
      page.paire(t('app.deposits.withheld'), argent(deposit.withheld))
      page.filet()
      page.paire(t('app.deposits.balance'), argent(deposit.held - deposit.withheld), { gras: true })

      /* LA RETENUE SANS SA JUSTIFICATION SERAIT UN CHIFFRE OPPOSÉ SANS MOTIF.
         Le produit n'enregistre pas encore le texte de la justification sur la
         caution — il la demande à l'arbitrage, dans la modale. Le document
         renvoie donc à la pièce qui la porte plutôt que d'inventer un motif. */
      if (deposit.withheld > 0) {
        page.saut(4)
        page.paragraphe(t('app.documents.pdfWithheldNote'), { petit: true })
      }

      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([t('app.files.deposit'), unit.label], isoDay(new Date()), 'pdf'),
        'app.documents.pdfDownloaded',
      )
    },
    [d, deviseSource, emisLe, mentionner, money, nommerLImmeuble, parc, remettre, t],
  )
}

/* ─── L'ÉTAT DES LIEUX ────────────────────────────────────────────────────── */

/**
 * L'ÉTAT DES CAUTIONS — ce que le parc détient, pour le compte de qui.
 *
 * ═══ POURQUOI CE DOCUMENT, ET SUR CET ÉCRAN ═══
 *
 * Une caution n'est pas l'argent du bailleur : c'est celui du locataire, détenu
 * pour lui. C'est donc la seule ligne du produit qu'on doit pouvoir JUSTIFIER
 * sur demande — à un locataire qui part, à un associé, à un contrôle — et
 * l'écran qui la porte n'avait aucun export, quand les paiements et les relevés
 * en ont un depuis longtemps.
 *
 * Il vit ici et non dans une page de rapports parce qu'il ne traverse AUCUN
 * autre écran : il est exactement la table des cautions, à une date. Un rapport
 * qui rassemble plusieurs écrans — le relevé annuel — appellerait autre chose ;
 * celui-ci s'exporte là où on le lit.
 *
 * ═══ UNE DATE, PAS UNE PÉRIODE ═══
 *
 * « Au 29/08/2026 » et non « du … au … ». Une caution ne se consomme pas sur un
 * mois : elle est détenue ou elle ne l'est plus. Un état daté se compare à un
 * autre état daté, ce qu'une période ne permettrait pas.
 *
 * ═══ TROIS SECTIONS, TROIS OBLIGATIONS ═══
 *
 * Consignée, en arbitrage, restituée ne sont pas trois nuances d'un même état :
 * la première est une dette entière, la deuxième une dette en litige, la
 * troisième une dette éteinte. Les mêler dans une liste triée par logement
 * ferait un tableau exact et inutilisable — c'est le total par section qui
 * répond à « combien dois-je ».
 *
 * LES RESTITUÉES FIGURENT QUAND MÊME, hors du total. Les retirer ferait un
 * document qui ne se recoupe pas avec l'écran dont il sort, et l'on chercherait
 * la caution manquante.
 */
export function useDepositsStatementPdf() {
  const t = useT()
  const emisLe = useEmisLe()
  const { money } = useCurrency()
  const { deviseSource } = useCurrency()
  const mentionner = useMentionDeConversion()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (cautions: { unite: string; locataire: string; deposit: Deposit }[]): string => {
      const page = nouvelleMiseEnPage()
      const argent = (montant: number) => money(montant, { compact: true })
      const titre = t('app.documents.depositsStatement')

      const detenues = cautions.filter(({ deposit }) => deposit.status !== 'returned')
      const consigne = cautions.reduce((somme, { deposit }) => somme + deposit.held, 0)
      const retenu = cautions.reduce((somme, { deposit }) => somme + deposit.withheld, 0)
      const du = detenues.reduce((somme, { deposit }) => somme + soldeDeCaution(deposit), 0)

      enTete(page, {
        parc,
        titre,
        /* La DATE prend la place que la quittance donne au logement : cet état
           porte sur le parc entier, il n'a pas de logement. */
        logement: t('app.documents.statementAsOf', { date: emisLe }),
        ligneDate: t('app.documents.pdfIssuedOn', { date: emisLe }),
      })

      page.paire(t('app.deposits.totalHeld'), argent(consigne))
      page.paire(t('app.deposits.withheld'), argent(retenu))
      page.filet()
      /* LA DETTE EN GRAS, parce que c'est la seule ligne qu'on cherche en
         ouvrant ce document. Elle exclut les cautions rendues — voir
         `Deposits`, où l'écran les comptait encore. */
      page.paire(t('app.deposits.balance'), argent(du), { gras: true })

      for (const statut of ['held', 'settling', 'returned'] as const) {
        const lignes = cautions.filter(({ deposit }) => deposit.status === statut)
        if (lignes.length === 0) continue

        page.section(t(`app.deposits.${statut}` as 'app.deposits.held'))
        for (const { unite, locataire, deposit } of lignes) {
          /* LA RETENUE SUR LA LIGNE QUI LA SUBIT. Une colonne de retenues à
             part obligerait à rapprocher deux listes de tête ; ici le montant
             rendu porte à côté de lui ce qui en a été ôté. */
          const trace = [
            unite,
            locataire,
            deposit.withheld > 0
              ? t('app.documents.statementWithheld', { amount: argent(deposit.withheld) })
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
          page.paire(
            trace,
            /* Une caution rendue n'a plus de solde : on montre ce qu'elle
               VALAIT, qui est le seul chiffre qu'elle porte encore. */
            argent(statut === 'returned' ? deposit.held : soldeDeCaution(deposit)),
          )
        }
      }

      const conversion = mentionner(deviseSource)
      if (conversion) {
        page.saut(4)
        page.paragraphe(conversion, { petit: true })
      }

      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([titre], isoDay(new Date()), 'pdf'),
        'app.documents.pdfDownloaded',
      )
    },
    [deviseSource, emisLe, mentionner, money, parc, remettre, t],
  )
}

export function useInspectionPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const emisLe = useEmisLe()
  const d = useDates()
  const { money, deviseSource } = useCurrency()
  const mentionner = useMentionDeConversion()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, inspection: Inspection): string => {
      const page = nouvelleMiseEnPage()
      const titre = t(
        inspection.kind === 'entry'
          ? 'app.documents.entryInspection'
          : 'app.documents.pdfExitInspection',
      )

      enTete(page, {
        parc,
        titre,
        logement: logementNomme(unit, nommerLImmeuble(unit)),
        ligneDate: t('app.documents.pdfIssuedOn', { date: emisLe }),
      })

      page.paire(t('app.inspections.performedOn'), d.fullDate(inspection.date), { gras: true })
      page.paire(t('app.inspections.roomCount'), String(inspection.rooms))
      page.paire(
        t('app.inspections.signedBy'),
        t(inspection.signed ? 'app.documents.pdfSigned' : 'app.documents.pdfNotSigned'),
      )

      page.section(t('app.inspections.findings'))
      const reserves = inspection.findings ?? []
      if (reserves.length === 0) {
        /* AUCUNE RÉSERVE ET RÉSERVES NON SERVIES NE SE DISENT PAS PAREIL. Le
           serveur ne rend pas toujours le détail ; annoncer « aucune réserve »
           sur un état des lieux qui en porte peut-être serait un document faux
           là où il compte le plus. */
        page.ligne(
          inspection.issues === 0
            ? t('app.documents.pdfNoFinding')
            : t('app.documents.pdfFindingsWithheld', { count: inspection.issues }),
        )
      }
      for (const reserve of reserves) {
        page.saut(4)
        page.ligne(reserve.room, { gras: true })
        page.paragraphe(reserve.description, { retrait: 12 })
        const marges = [
          t(`app.inspections.severity${reserve.severity === 'minor' ? 'Minor' : 'Major'}` as 'app.inspections.severityMinor'),
          reserve.costMinor === null
            ? null
            : `${t('app.inspections.cost')} ${money(reserve.costMinor, { compact: true })}`,
        ].filter(Boolean)
        page.paragraphe(marges.join(' · '), { petit: true, retrait: 12 })
      }

      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([t('app.files.inspection'), unit.label], isoDay(new Date()), 'pdf'),
        'app.documents.pdfDownloaded',
      )
    },
    [d, deviseSource, emisLe, mentionner, money, nommerLImmeuble, parc, remettre, t],
  )
}

/**
 * LE PIED DE PAGE, SUR CHAQUE PAGE, ET IL DIT CE QUE LE DOCUMENT N'EST PAS.
 *
 * « page 2 sur 3 » distingue un document complet d'un document dont il manque
 * la suite, et la mention de provenance distingue un relevé produit depuis des
 * données d'une pièce signée. Les deux sur la même ligne, parce qu'un pied de
 * page qu'on ne lit pas ne sert à rien et qu'un pied de page de trois lignes ne
 * se lit pas.
 */
function piedDePage(
  t: ReturnType<typeof useT>,
  parc: string,
  document: string,
  numero: number,
  total: number,
): string {
  return t('app.documents.pdfFooter', { park: parc, document, page: numero, total })
}
