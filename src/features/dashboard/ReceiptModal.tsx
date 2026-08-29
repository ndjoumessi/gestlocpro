import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { receiptDue } from '@/data/portfolio'
import { formatMoney } from '@/currency/currencies'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { api, ApiError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'
import { useRole } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/Toast'
import { Logo } from '@/components/primitives/Logo'
import { PAYMENT_METHOD_LABELS, type PaymentMethodKey } from '@/data/portfolio'
import {
  composerLaQuittance,
  useDocumentEmisPdf,
  useImpressionDuDocumentEmis,
} from './documentsPdf'
import { StatusPill } from '@/components/primitives/StatusPill'
import { cn } from '@/lib/cn'
import { partiesDeDate } from '@/lib/dates'

/**
 * Document de quittance ou de reçu, tel que le SERVEUR l'a arrêté.
 *
 * Aucun montant n'est recalculé ici. C'est la condition pour qu'un document
 * réémis en octobre rende exactement celui de juillet : le loyer du logement a
 * pu changer entre-temps, l'échéance non.
 */
interface DocumentEmis {
  kind: 'quittance' | 'recu'
  periodStart: string
  tenant: string
  unit: string
  building: string
  district: string
  rentMinor: number
  waterMinor: number
  powerMinor: number
  dueMinor: number
  paidMinor: number
  balanceMinor: number
  /**
   * Devise du document, posée par le SERVEUR à l'émission.
   *
   * Le document n'en portait aucune : il était mis en forme avec la devise
   * d'affichage de la machine. Le même versement imprimé sur deux postes réglés
   * différemment portait deux monnaies — sur le seul papier que le locataire
   * gardera pour prouver qu'il a payé.
   */
  currency: 'XAF' | 'XOF' | 'EUR' | 'CAD' | 'USD'
  payments: { id: string; amountMinor: number; method: string; paidOn: string; reference: string | null }[]
}

/**
 * Émission d'une quittance, ou d'un reçu.
 *
 * Le mot affiché n'est jamais choisi par l'écran : il vient du serveur, qui
 * seul sait si la période est soldée. Un écran qui déciderait de dire
 * « quittance » ferait signer au bailleur une preuve de paiement qu'il n'a pas
 * reçu — et une quittance ne se reprend pas.
 *
 * L'IMPRESSION EST PASSÉE AU PDF, ELLE AUSSI. Elle employait `window.print()` et
 * une feuille `@media print`, et ce choix avait survécu à l'arrivée d'un
 * émetteur PDF dans le produit — pour une raison qui ne tenait pas : il
 * opposait « une bibliothèque de plus », ses polices à embarquer et ses accents
 * à vérifier, quand `lib/pdf.ts` n'est pas une bibliothèque, n'embarque aucune
 * police, et garde ses accents.
 *
 * Ce qui l'a tranché est une capture d'aperçu d'impression : deux pages portant
 * chacune la même quittance COUPÉE après « Détail de la période ». La feuille
 * éteignait la page par `visibility: hidden`, qui conserve la géométrie des
 * ancêtres — le corps de la modale restait donc un conteneur de défilement
 * borné, et rognait le document qu'il contenait.
 *
 * CE QUI SÉPARE VRAIMENT LES DEUX CHEMINS EST LA SOURCE. Ce document-ci est
 * ARRÊTÉ PAR LE SERVEUR — `api.issueReceipt`, avec sa propre devise, et aucun
 * montant recalculé ici. Les PDF de `documentsPdf` sont produits depuis les
 * données que le client détient. Deux sources, deux documents, et les fondre
 * demanderait de porter le document du serveur jusqu'à l'émetteur, ce qui est un
 * autre travail. En attendant, le locataire télécharge et le gestionnaire
 * imprime — et les deux pièces peuvent différer de mise en page.
 */
/** Des parties de date vers l'ISO du document — l'inverse de `partiesDeDateISO`. */
function enISO({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * UNE LIGNE DE DOCUMENT : ce qu'on nomme à gauche, ce qu'on chiffre à droite.
 *
 * C'est la `paire` de `miseEnPage`, rendue en HTML — même géométrie, mêmes
 * règles. Elle existe pour que l'aperçu et la feuille ne puissent pas dériver
 * l'un de l'autre par accident de mise en page : cinq appels ici, cinq `paire`
 * là-bas, dans le même ordre.
 *
 * `numeric` sur le montant, jamais sur le libellé : les chiffres tabulaires
 * gardent la même chasse d'une ligne à l'autre, sans quoi un « 1 » décale toute
 * la colonne et l'œil ne peut plus comparer deux montants d'un coup.
 */
function LigneDeDocument({
  libelle,
  valeur,
  montant,
  fort,
  ton,
}: {
  libelle: string
  /** Un texte ordinaire — un nom de locataire. */
  valeur?: string
  /** Un montant déjà mis en forme dans la devise DU DOCUMENT. */
  montant?: string
  fort?: boolean
  ton?: 'danger'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cn('text-muted', fort && 'font-semibold text-ink')}>{libelle}</span>
      <span
        className={cn(
          'text-right',
          montant && 'numeric',
          fort && 'font-semibold',
          ton === 'danger' && 'text-danger',
        )}
      >
        {montant ?? valeur}
      </span>
    </div>
  )
}

/** Le ton de la pastille : soldé, ou pas encore. */
const TONS_DE_PIECE = { paid: 'ok', other: 'warn' } as const

export function ReceiptModal({
  unitId,
  periodStart,
  open,
  onClose,
}: {
  unitId: string
  periodStart: string
  open: boolean
  onClose: () => void
}) {
  const t = useT()
  const { money: moneyAffichage } = useCurrency()
  const d = useDates()
  const { adhesionActive } = useSession()
  const parkId = adhesionActive?.parkId ?? null
  const { units, buildingById, receiptsForUnit } = usePortfolio()

  /*
    ═══ LE DOCUMENT DE LA DÉMONSTRATION, COMPOSÉ ICI ═══

    LE DÉFAUT : l'effet ci-dessous sortait sur `if (!open || !parkId) return`.
    En démonstration il n'y a pas d'adhésion, donc pas de `parkId` : la modale
    s'ouvrait, ne demandait RIEN — zéro requête, mesuré au navigateur — et
    n'obtenait ni document ni échec. Donc « Chargement… » pour toujours, et ses
    deux boutons éteints. Une porte sans pièce derrière.

    POURQUOI COMPOSER PLUTÔT QUE D'AVOUER. La démonstration existe pour montrer
    le produit sans compte, et une quittance est ce que ce produit remet. La
    refuser sur l'écran qui sert à convaincre reviendrait à démontrer un cahier
    des charges. Les faits sont d'ailleurs là : c'est avec eux que l'espace
    LOCATAIRE compose ses quittances depuis plusieurs lots.

    ET LE `kind` EST DÉCIDÉ ICI, ce que l'en-tête de ce fichier interdit — « le
    mot affiché n'est jamais choisi par l'écran ». L'interdit vaut, et sa raison
    aussi : le serveur seul connaît l'échéance. Mais en démonstration il n'y a
    pas de serveur, et le registre EST le jeu de données du client, échéance
    comprise (`receipt.dueOn`). Ce n'est pas l'écran qui tranche à la place du
    registre : c'est le même registre, tenu ailleurs. Sur un parc réel, `parkId`
    existe et rien de ceci ne s'exécute — le troisième cas de
    `quittanceEnDemonstration` le tient.
  */
  const documentLocal = useMemo<DocumentEmis | null>(() => {
    if (parkId || !open) return null

    const logement = units.find((u) => u.id === unitId)
    if (!logement) return null

    const [an, moisISO] = periodStart.split('-').map(Number)
    const echeance = receiptsForUnit(unitId).find((r) => r.year === an && r.month === moisISO - 1)
    if (!echeance) return null

    const du = receiptDue(echeance)
    return {
      kind: echeance.paidMinor >= du ? 'quittance' : 'recu',
      periodStart,
      tenant: logement.tenant ?? t('app.portfolio.noTenant'),
      unit: logement.label,
      building: buildingById(logement.buildingId)?.name ?? '',
      district: buildingById(logement.buildingId)?.district ?? '',
      rentMinor: echeance.rentMinor,
      waterMinor: echeance.waterMinor,
      powerMinor: echeance.powerMinor,
      dueMinor: du,
      paidMinor: echeance.paidMinor,
      balanceMinor: du - echeance.paidMinor,
      /* Le jeu de démonstration compte en francs CFA — c'est écrit dans
         `CurrencyProvider`, dont c'est la devise par défaut. */
      currency: 'XAF',
      /* LE REGISTRE DU CLIENT RANGE SES DATES EN PARTIES, jamais en `Date` ni
         en chaîne — c'est la règle de `lib/dates`, posée contre le décalage
         horaire. Le document du serveur, lui, les porte en ISO. La conversion
         est ici, à la frontière, et non dans les trois endroits qui affichent
         ensuite `partiesDeDateISO(versement.paidOn)`.

         `id` N'EXISTE PAS côté client : ce registre ne l'expose pas. On en
         fabrique un stable à partir du rang, qui suffit à `key` — et le retrait
         d'un versement, lui, est retiré en démonstration (voir plus bas) : il
         appelle le serveur, qui n'est pas là. */
      payments: echeance.payments.map((versement, rang) => ({
        id: `demo-${periodStart}-${rang}`,
        amountMinor: versement.amountMinor,
        method: versement.method,
        paidOn: enISO(versement.paidOn),
        reference: versement.reference ?? null,
      })),
    }
  }, [buildingById, open, parkId, periodStart, receiptsForUnit, t, unitId, units])

  /**
   * Le document se met en forme dans SA devise, pas dans celle de l'écran.
   *
   * `useCurrency` sert la lecture courante ; ici on atteste. Tant que le
   * document n'est pas revenu du serveur, on retombe sur l'affichage — il n'y a
   * alors aucun montant à mettre en forme.
   */
  const [documentServeur, setDocumentServeur] = useState<DocumentEmis | null>(null)
  const [echec, setEchec] = useState<string | null>(null)
  /*
    LE RETRAIT SE CONFIRME, comme partout ailleurs dans ce produit.

    Il partait au PREMIER clic, sur une gomme discrète posée à huit pixels du
    montant, et rien n'empêchait deux appuis rapides d'émettre deux
    suppressions. Le commentaire voisin défend l'EXISTENCE de cette gomme —
    « c'est là que les vraies erreurs commencent » — jamais son déclenchement
    immédiat. Retirer un versement fait réapparaître une dette : c'est de
    l'argent qu'on déclare ne plus avoir reçu.

    Le motif est celui de la fiche locataire, recopié : `alertdialog`, un titre
    qui NOMME ce qu'on retire, et l'action en variante dangereuse.
  */
  const [aRetirer, setARetirer] = useState<{ id: string; montant: string; date: string } | null>(
    null,
  )
  const [retraitEnCours, setRetraitEnCours] = useState(false)
  const { role } = useRole()
  const { notify } = useToast()
  const telechargerLePdf = useDocumentEmisPdf()
  const imprimerLePdf = useImpressionDuDocumentEmis()

  /**
   * Le document se referme après le retrait, plutôt que de se recalculer ici.
   *
   * Il atteste d'un état ; celui-ci vient de changer. Le rafraîchir sur place
   * afficherait une quittance dont les montants ne correspondent plus à
   * l'en-tête qu'on vient de lire.
   */
  const retirer = (paymentId: string) => {
    if (!parkId) return
    // Le bouton s'éteint pendant le vol : sans cela, deux appuis rapides
    // émettent deux suppressions, et la seconde porte sur un versement qui
    // n'existe plus.
    setRetraitEnCours(true)
    void api
      .deletePayment(parkId, paymentId)
      .then(() => {
        onClose()
        notify(t('app.receipts.paymentRemoved'), { tone: 'ok' })
      })
      .catch(() => setEchec(t('common.actionFailed')))
      .finally(() => {
        setRetraitEnCours(false)
        setARetirer(null)
      })
  }

  const money = (montant: number) =>
    document
      ? formatMoney(montant, ({ XAF: 'CFA', XOF: 'CFA', EUR: 'EUR', CAD: 'CAD', USD: 'USD' } as const)[
          document.currency
        ])
      : moneyAffichage(montant)

  /* Le document affiché : celui du serveur quand il y a un parc, celui composé
     localement en démonstration. Jamais les deux — `documentLocal` ne se
     compose que si `parkId` est absent. */
  const document = documentServeur ?? documentLocal


  useEffect(() => {
    if (!open || !parkId) return
    let annule = false
    setDocumentServeur(null)
    setEchec(null)
    void api
      .issueReceipt<{ document: DocumentEmis }>(parkId, { unitId, periodStart })
      .then(({ document: doc }) => {
        if (!annule) setDocumentServeur(doc)
      })
      .catch((err: unknown) => {
        if (annule) return
        // 404 : aucune échéance pour cette période. On le dit, plutôt que
        // d'afficher un document vide qui laisserait croire à un mois traité.
        setEchec(
          err instanceof ApiError && err.status === 404
            ? t('app.receipts.noCharge')
            : t('common.actionFailed'),
        )
      })
    return () => {
      annule = true
    }
  }, [open, parkId, unitId, periodStart, t])

  /**
   * Le moyen de paiement en clair.
   *
   * Le code brut — « mobile », « transfer » — n'a rien à faire sur un document
   * remis à un locataire : il n'est ni traduit ni compréhensible.
   */
  /* La TABLE PARTAGÉE, et non une troisième copie : elle vit auprès du type
     qu'elle nomme. Un code inconnu ressort tel quel — mieux vaut « mobile » à
     l'écran qu'une case vide, et cela se voit assez pour être corrigé. */
  const libelleMoyen = (code: string) => {
    const cle = PAYMENT_METHOD_LABELS[code as PaymentMethodKey]
    return cle ? t(cle as 'app.payments.methodCash') : code
  }

  const [annee, mois] = periodStart.split('-').map(Number)
  /* La période du document, convertie UNE fois. Deux appelants la voulaient —
     l'aperçu et le PDF — et l'un des deux avait oublié le décalage. */
  const periode = { year: annee!, month: mois! - 1 }
  /** La date d'émission : celle du jour où l'on regarde la pièce, comme sur la feuille. */
  const emisLe = d.fullDate(partiesDeDate(new Date()))

  /*
    LE CONTENU, COMPOSÉ UNE FOIS POUR L'APERÇU ET POUR LA FEUILLE.

    `composerLaQuittance` existe justement parce que « chaque déduction faite
    d'un côté seulement est une divergence en attente ». L'aperçu la contournait
    et refaisait la sienne, à la main, en oubliant la moitié des lignes — et en
    se trompant d'un mois. Il passe désormais par elle, comme le bouton
    « Télécharger » juste à côté.
  */
  const contenu = useMemo(
    () =>
      document
        ? composerLaQuittance(t, money, {
            logement: [document.unit, document.building].filter(Boolean).join(' · '),
            periode: d.monthYear(periode),
            locataire: document.tenant,
            rentMinor: document.rentMinor,
            waterMinor: document.waterMinor,
            powerMinor: document.powerMinor,
            dueMinor: document.dueMinor,
            paidMinor: document.paidMinor,
            versements: document.payments.map((versement) => ({
              trace: [
                d.fullDate(partiesDeDateISO(versement.paidOn)),
                libelleMoyen(versement.method),
                versement.reference,
              ]
                .filter(Boolean)
                .join(' · '),
              amountMinor: versement.amountMinor,
            })),
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, document, periode.month, periode.year, t],
  )

  /*
    LA PIÈCE, TELLE QU'ELLE PART — en fichier ou à l'imprimante.

    Elle était décrite dans le `onClick` du téléchargement, en dix-huit lignes,
    et l'impression n'y avait pas accès : elle appelait `window.print()`. Décrite
    ici, les deux boutons remettent le MÊME document, ce qui est la seule façon
    de tenir la promesse écrite à côté d'eux.

    `null` porte les deux refus à la fois — pas encore de document, ou un retrait
    qui a échoué et démonté la quittance — et c'est lui qui éteint les boutons.
  */
  const piece =
    document && !echec
      ? {
          kind: document.kind,
          unit: document.unit,
          building: document.building,
          tenant: document.tenant,
          periode: d.monthYear(periode),
          moisISO: periodStart.slice(0, 7),
          rentMinor: document.rentMinor,
          waterMinor: document.waterMinor,
          powerMinor: document.powerMinor,
          dueMinor: document.dueMinor,
          paidMinor: document.paidMinor,
          balanceMinor: document.balanceMinor,
          /* La devise DU DOCUMENT, celle que le serveur a posée à l'émission —
             pas celle de l'écran. Le même versement imprimé sur deux postes
             réglés différemment portait deux monnaies. */
          argent: money,
          payments: document.payments.map((versement) => ({
            date: d.fullDate(partiesDeDateISO(versement.paidOn)),
            moyen: libelleMoyen(versement.method),
            reference: versement.reference,
            amountMinor: versement.amountMinor,
          })),
        }
      : null


  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={document ? t(`app.receipts.${document.kind}`) : t('app.receipts.title')}
      /* LA MENTION DIT D'OÙ VIENT LA PIÈCE, et elle mentait en démonstration :
         « Émis par le serveur » sous un document que le client venait de
         composer. C'est la phrase qui donne son autorité au papier ; la laisser
         inchangée aurait fait passer un jeu de données fictif pour un registre. */
      description={t(parkId ? 'app.receipts.description' : 'app.receipts.descriptionDemo')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {/*
            LE PDF, ET L'IMPRESSION QUI PASSE PAR LUI.

            La modale n'offrait que `window.print()`. La boîte d'impression sait
            produire un PDF, mais elle y ajoute ses en-têtes, le nom du fichier
            échappe au produit, et son comportement est inégal sur Android — la
            cible principale. Surtout, la feuille ainsi obtenue ne ressemblait
            pas à celle que le LOCATAIRE télécharge du même mois : deux pièces
            pour un seul fait.

            CE COMMENTAIRE DISAIT « les deux passent maintenant par la même mise
            en page », ET C'ÉTAIT FAUX de l'impression : seul le téléchargement
            était passé au PDF, le bouton d'à côté imprimant toujours le DOM.
            Ce qui sortait de l'imprimante était donc la quittance COUPÉE là où
            le défilement de la modale s'arrêtait — deux pages portant chacune
            le même haut de document. Les deux boutons partagent désormais la
            même pièce ; voir `printBinaryFile` pour le cadre invisible et
            `useImpressionDuDocumentEmis` pour la composition.
          */}
          <Button
            variant="secondary"
            icon="download"
            disabled={!piece}
            onClick={() => piece && telechargerLePdf(piece)}
          >
            {t('app.documents.download')}
          </Button>
          <Button
            icon="file"
            onClick={() => piece && imprimerLePdf(piece)}
            /*
              ÉTEINT QUAND IL N'Y A PAS DE PIÈCE — parce qu'il n'y a rien à
              composer, et non plus parce que le DOM ne serait pas monté. C'est
              `piece` qui porte la condition maintenant : elle vaut `null` tant
              que le document n'est pas là, et quand le retrait a échoué (la
              branche d'erreur démonte la quittance entière). Un bouton actif
              qui ne peut rien produire fait croire à une panne d'imprimante.
            */
            disabled={!piece}
          >
            {t('app.receipts.print')}
          </Button>
        </>
      }
    >
      {echec ? (
        <p role="alert" className="text-body text-danger">
          {echec}
        </p>
      ) : !document || !contenu ? (
        <p className="text-body text-muted">{t('common.loading')}</p>
      ) : (
        /* PLUS DE `zone-imprimable` : l'impression ne passe plus par le DOM,
           donc plus par une feuille `@media print` qui éteignait la page pour
           rallumer ce bloc. Elle a été retirée d'`index.css`, dont cette modale
           était la seule cliente — et c'est elle qui rognait le document, les
           ancêtres gardant leur géométrie sous `visibility: hidden`.

           `gap-5` et non `gap-6` : un document se compose SERRÉ. Le relevé
           bancaire, la facture, la quittance rapprochent tous leurs lignes,
           parce que l'œil y descend une colonne plutôt qu'il ne parcourt des
           blocs. */
        <div className="flex flex-col gap-5 text-body">
          {/*
            L'APERÇU EST LE DOCUMENT, et il ne l'était pas.

            Ce fichier promet en toutes lettres — dix lignes plus haut — que
            « ce qu'on voit ici est ce qui sortira » et qu'« un aperçu qui ne
            ressemble pas à la feuille est un aperçu qui ment ». Mises côte à
            côte, les deux pièces du MÊME mois disaient :

              feuille : logement, date d'émission, période, locataire, loyer,
                        eau, électricité, dû, réglé, statut, versements
              aperçu  : période, locataire, logement, dû, réglé, solde

            L'aperçu perdait le DÉTAIL — quelle part est du loyer, quelle part
            de l'eau —, qui est précisément ce qu'un locataire conteste, et le
            STATUT, que le gestionnaire vérifie avant de remettre la pièce.

            Ce n'était pas une omission de mise en page : les deux composaient
            leur contenu SÉPARÉMENT. C'est ainsi que le mois avait divergé d'un
            cran entre l'écran et la feuille — un défaut corrigé à la main, que
            cette rédaction rend impossible. Les deux passent maintenant par
            `composerLaQuittance`, dans le même ORDRE que `pagesDeQuittance`.

            CE QUE L'ÉCRAN AJOUTE, et que le papier ne peut pas : le statut en
            pastille colorée plutôt qu'en mot, et le reste dû en ton d'alerte.
            Ce n'est pas de l'ornement — c'est l'information la plus lue de la
            pièce, et sur papier elle se cherche ligne à ligne.
          */}
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <Logo impression size="sm" to="" />
            <span className="text-caption text-muted">
              {t('app.documents.pdfIssuedOn', { date: emisLe })}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="eyebrow text-muted">{t(contenu.titre)}</p>
            <p className="text-h3">{contenu.periode}</p>
            <p className="text-body text-muted">{contenu.logement}</p>
          </div>

          <LigneDeDocument libelle={t('app.portfolio.tenant')} valeur={contenu.locataire} />

          {/*
            LES MONTANTS EN COLONNE, alignés à droite et en chiffres tabulaires.

            La rédaction précédente les posait dans une grille à deux colonnes
            égales, calés à GAUCHE : « 8 320 FCFA » et « 170 942 FCFA »
            commençaient au même pixel et se comparaient chiffre à chiffre. Un
            document d'argent se lit par la droite — c'est là que les unités
            s'alignent — et `numeric` donne aux chiffres la même chasse, sans
            quoi un 1 déplace toute la colonne.
          */}
          <section className="flex flex-col gap-2">
            <p className="eyebrow text-muted">{t('app.documents.pdfBreakdown')}</p>
            <LigneDeDocument libelle={t('app.tenant.colRent')} montant={contenu.postes.rent} />
            <LigneDeDocument libelle={t('app.tenant.colWater')} montant={contenu.postes.water} />
            <LigneDeDocument libelle={t('app.tenant.colPower')} montant={contenu.postes.power} />

            {/* Le filet de la feuille : ce qui suit TOTALISE ce qui précède. */}
            <div className="mt-1 flex flex-col gap-2 border-t border-border pt-2.5">
              <LigneDeDocument fort libelle={t('app.payments.due')} montant={contenu.du} />
              <LigneDeDocument libelle={t('app.payments.paid')} montant={contenu.paye} />
              {/* LE RESTE N'APPARAÎT QUE S'IL EXISTE — même règle que la feuille :
                  « Reste à régler : 0 » sur une période soldée est un chiffre
                  qu'il faut lire pour constater qu'il ne dit rien. */}
              {contenu.reste && (
                <LigneDeDocument
                  fort
                  ton="danger"
                  libelle={t('app.documents.pdfRemaining')}
                  montant={contenu.reste}
                />
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">{t('app.portfolio.status')}</span>
                {/* LA PASTILLE À L'ÉCRAN, LE MOT SUR LE PAPIER. `impression`
                    rend la pastille en texte à l'impression : la feuille garde
                    donc exactement ce que `pagesDeQuittance` écrit. */}
                <StatusPill tone={TONS_DE_PIECE[document.kind === 'quittance' ? 'paid' : 'other']}>
                  {contenu.statut}
                </StatusPill>
              </div>
            </div>

            {/* L'imputation, seulement là où elle apprend quelque chose : sur
                une période partiellement réglée, elle dit QUEL poste reste
                ouvert. La feuille la pose en petit, en bas ; ici elle suit les
                montants qu'elle explique. */}
            {contenu.imputation && (
              <p className="text-caption text-muted">{contenu.imputation}</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            {/* LE MÊME INTITULÉ QUE LA FEUILLE — « Versements reçus » — et non
                « Versements ». Deux mots pour la même liste sur deux pièces du
                même document, c'était le reste de la divergence. */}
            <p className="eyebrow text-muted">{t('app.documents.pdfPayments')}</p>
            {contenu.versements.length === 0 ? (
              /* La feuille écrit cette ligne ; l'aperçu laissait un intitulé
                 suivi de rien, qui se lit comme un défaut d'affichage. */
              <p className="text-muted">{t('app.documents.pdfNoPayment')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {contenu.versements.map((versement, rang) => (
                  <li
                    key={document.payments[rang]!.id}
                    className="flex items-baseline justify-between gap-4"
                  >
                    {/* LA TRACE VIENT DE LA COMPOSITION, comme sur la feuille :
                        date, moyen, référence, dans cet ordre et joints de la
                        même façon. Elle était réassemblée ici à la main. */}
                    <span className="text-muted">{versement.trace}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="numeric">{versement.montant}</span>
                    {/*
                      La gomme, à l'endroit où l'erreur se découvre.

                      Un encaissement saisi sur la mauvaise période, au mauvais
                      montant ou pour le mauvais locataire ne se réparait que
                      dans la base. Un registre sans gomme force à contourner le
                      produit, et c'est là que les vraies erreurs commencent.

                      Propriétaire seul : retirer un versement fait réapparaître
                      une dette — c'est de l'argent qu'on déclare ne plus avoir
                      reçu. Le journal, lui, garde le montant retiré.
                    */}
                    {role === 'owner' && parkId && (
                      <IconButton
                        /* PLUS DE `print:hidden` : la gomme ne pouvait sortir
                           de l'imprimante que parce qu'on imprimait le DOM. On
                           imprime la pièce, qui ne porte aucune commande — un
                           document qui atteste ne porte pas les boutons de qui
                           le consulte, et il n'y a plus à le rappeler classe
                           par classe. */
                        icon="close"
                        label={t('app.receipts.removePayment')}
                        variant="ghost"
                        disabled={retraitEnCours}
                        onClick={() =>
                          setARetirer({
                            id: document.payments[rang]!.id,
                            montant: versement.montant,
                            date: d.fullDate(
                              partiesDeDateISO(document.payments[rang]!.paidOn),
                            ),
                          })
                        }
                      />
                    )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>

      {/*
        LA CONFIRMATION, hors de la quittance et non dedans.

        Une modale dans une modale : la seconde se monte par-dessus la première,
        qui reste ouverte derrière. C'est voulu — annuler doit rendre la
        quittance telle qu'on l'avait, avec la ligne qu'on hésitait à retirer.
      */}
      {aRetirer && (
        <Modal
          open
          onClose={() => setARetirer(null)}
          role="alertdialog"
          size="sm"
          title={t('app.receipts.removeTitle', { amount: aRetirer.montant })}
          description={t('app.receipts.removeBody', { date: aRetirer.date })}
          footer={
            <>
              <Button variant="secondary" onClick={() => setARetirer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                loading={retraitEnCours}
                onClick={() => retirer(aRetirer.id)}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          {/* Le titre nomme le montant, la description la date : le corps
              n'aurait qu'à les répéter. */}
          <span className="sr-only">{t('app.receipts.removeBody', { date: aRetirer.date })}</span>
        </Modal>
      )}
    </>
  )
}
