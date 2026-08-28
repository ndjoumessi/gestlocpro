import { useCallback } from 'react'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { isoDay, isoMonth } from '@/lib/csv'
import { PDF_MIME, downloadBinaryFile } from '@/lib/download'
import { nouvelleMiseEnPage, type MiseEnPage } from '@/lib/miseEnPage'
import { nomDeFichier } from '@/lib/nomDeFichier'
import { construirePdf } from '@/lib/pdf'
import { partiesDeDate } from '@/lib/dates'
import { useDates } from '@/lib/useDates'
import { usePortfolio } from '@/data/PortfolioProvider'
import {
  PAYMENT_METHOD_LABELS,
  imputation,
  receiptDue,
  receiptStatus,
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
 * QUITTANCE OU REÇU — LA RÈGLE EST CELLE DU SERVEUR, ET ELLE Y EST ÉCRITE.
 *
 * « Quittance seulement si la période est intégralement soldée. En deçà, on
 * émet un REÇU, qui n'atteste que le montant reçu. Confondre les deux ferait
 * signer au bailleur une preuve de paiement qu'il n'a pas reçu. » — la route
 * d'émission, `POST /:parkId/receipts`, qui calcule `solde <= 0` exactement
 * comme ici.
 *
 * Le document du locataire s'intitulait « Quittance de loyer » sur TOUTES ses
 * périodes, celles qu'il n'a réglées qu'en partie comprises. Le même mois
 * portait donc deux noms selon qui le regardait — et c'est le locataire qui
 * garde le document et le présente.
 *
 * LES DEUX CHEMINS LISENT LA MÊME PAIRE DE CLÉS, `app.receipts.quittance` et
 * `app.receipts.recu`, celles que la modale du gestionnaire emploie déjà. Une
 * troisième clé au texte identique existait ici ; c'était la divergence en
 * germe, avec le mot juste par accident.
 */
function titreDeQuittance(receipt: Receipt): 'app.receipts.quittance' | 'app.receipts.recu' {
  return receiptDue(receipt) - receipt.paidMinor <= 0
    ? 'app.receipts.quittance'
    : 'app.receipts.recu'
}

function pagesDeQuittance(
  page: MiseEnPage,
  contexte: {
    t: ReturnType<typeof useT>
    d: ReturnType<typeof useDates>
    argent: (montant: number) => string
    parc: string
    unit: Unit
    immeuble: string | undefined
    receipt: Receipt
  },
) {
  const { t, d, argent, parc, unit, immeuble, receipt } = contexte

  enTete(page, {
    parc,
    titre: t(titreDeQuittance(receipt)),
    logement: logementNomme(unit, immeuble),
    ligneDate: t('app.documents.pdfIssuedOn', { date: d.fullDate(partiesDeDate(new Date())) }),
  })

  page.paire(t('app.period'), d.monthYear(receipt), { gras: true })
  page.paire(t('app.portfolio.tenant'), unit.tenant ?? t('app.portfolio.noTenant'))

  page.section(t('app.documents.pdfBreakdown'))
  page.paire(t('app.tenant.colRent'), argent(receipt.rentMinor))
  page.paire(t('app.tenant.colWater'), argent(receipt.waterMinor))
  page.paire(t('app.tenant.colPower'), argent(receipt.powerMinor))
  page.filet()

  const du = receiptDue(receipt)
  page.paire(t('app.payments.due'), argent(du), { gras: true })
  page.paire(t('app.payments.paid'), argent(receipt.paidMinor))
  /* LE RESTE N'APPARAÎT QUE S'IL EXISTE. « Reste à régler : 0 » sur une période
     soldée est un chiffre qu'il faut lire pour constater qu'il ne dit rien. */
  if (du > receipt.paidMinor)
    page.paire(t('app.documents.pdfRemaining'), argent(du - receipt.paidMinor), { gras: true })
  page.paire(t('app.portfolio.status'), t(`status.${receiptStatus(receipt, new Date())}` as 'status.paid'))

  page.section(t('app.documents.pdfPayments'))
  if (receipt.payments.length === 0) page.ligne(t('app.documents.pdfNoPayment'))
  for (const versement of receipt.payments) {
    /* LA RÉFÉRENCE DE L'OPÉRATEUR EST SUR LA PIÈCE. C'est avec elle qu'un
       locataire conteste un encaissement ; l'export CSV la portait déjà, et un
       document qui l'omettrait vaudrait moins que le tableur qu'il remplace. */
    const trace = [
      d.fullDate(versement.paidOn),
      t(PAYMENT_METHOD_LABELS[versement.method] as 'app.payments.methodCash'),
      versement.reference,
    ]
      .filter(Boolean)
      .join(' · ')
    page.paire(trace, argent(versement.amountMinor))
  }

  /* L'imputation, seulement là où elle apprend quelque chose : sur une période
     partiellement réglée, elle dit QUEL poste reste ouvert. */
  if (du > receipt.paidMinor && receipt.paidMinor > 0) {
    const part = imputation(receipt)
    page.saut(4)
    page.paragraphe(
      t('app.documents.pdfImputation', {
        rent: argent(part.rent),
        water: argent(part.water),
        power: argent(part.power),
      }),
      { petit: true },
    )
  }
}

export function useReceiptPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const d = useDates()
  const { money } = useCurrency()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, receipt: Receipt): string => {
      const page = nouvelleMiseEnPage()
      const argent = (montant: number) => money(montant, { round: true })
      pagesDeQuittance(page, { t, d, argent, parc, unit, immeuble: nommerLImmeuble(unit), receipt })

      const titre = t(titreDeQuittance(receipt))
      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        // Le mois de la quittance, et non le jour du téléchargement : c'est la
        // période qui identifie le document.
        nomDeFichier([t('app.files.receipt'), unit.label], isoMonth(receipt), 'pdf'),
        'app.receiptDownloaded',
      )
    },
    [d, money, nommerLImmeuble, parc, remettre, t],
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
  const d = useDates()
  const { money } = useCurrency()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, receipts: Receipt[]): string => {
      const page = nouvelleMiseEnPage()
      const argent = (montant: number) => money(montant, { round: true })
      /* Cherché UNE fois pour tout le carnet : six pages, un seul logement. */
      const immeuble = nommerLImmeuble(unit)
      receipts.forEach((receipt, index) => {
        if (index > 0) page.pageNeuve()
        pagesDeQuittance(page, { t, d, argent, parc, unit, immeuble, receipt })
      })

      const titre = t('app.documents.allReceipts')
      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([t('app.documents.allReceipts'), unit.label], isoDay(new Date()), 'pdf'),
        'app.receiptDownloaded',
      )
    },
    [d, money, nommerLImmeuble, parc, remettre, t],
  )
}

/* ─── LE REÇU DE CAUTION ──────────────────────────────────────────────────── */

export function useDepositPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const d = useDates()
  const { money } = useCurrency()
  const parc = useEmetteur()
  const remettre = useRemise()

  return useCallback(
    (unit: Unit, deposit: Deposit): string => {
      const page = nouvelleMiseEnPage()
      const argent = (montant: number) => money(montant, { round: true })
      const titre = t('app.documents.depositReceipt')

      enTete(page, {
        parc,
        titre,
        logement: logementNomme(unit, nommerLImmeuble(unit)),
        ligneDate: t('app.documents.pdfIssuedOn', { date: d.fullDate(partiesDeDate(new Date())) }),
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
    [d, money, nommerLImmeuble, parc, remettre, t],
  )
}

/* ─── L'ÉTAT DES LIEUX ────────────────────────────────────────────────────── */

export function useInspectionPdf() {
  const t = useT()
  const nommerLImmeuble = useNomDeLImmeuble()
  const d = useDates()
  const { money } = useCurrency()
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
        ligneDate: t('app.documents.pdfIssuedOn', { date: d.fullDate(partiesDeDate(new Date())) }),
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
            : `${t('app.inspections.cost')} ${money(reserve.costMinor, { round: true })}`,
        ].filter(Boolean)
        page.paragraphe(marges.join(' · '), { petit: true, retrait: 12 })
      }

      return remettre(
        page.pages((numero, total) => piedDePage(t, parc, titre, numero, total)),
        nomDeFichier([t('app.files.inspection'), unit.label], isoDay(new Date()), 'pdf'),
        'app.documents.pdfDownloaded',
      )
    },
    [d, money, nommerLImmeuble, parc, remettre, t],
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
