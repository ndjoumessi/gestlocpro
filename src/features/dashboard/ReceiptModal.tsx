import { useEffect, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { formatMoney } from '@/currency/currencies'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { api, ApiError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'
import { useRole } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/Toast'
import { Logo } from '@/components/primitives/Logo'
import { PAYMENT_METHOD_LABELS, type PaymentMethodKey } from '@/data/portfolio'
import { useDocumentEmisPdf } from './documentsPdf'

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
 * L'impression passe par `window.print()` et une feuille de style dédiée, et ce
 * choix a survécu à l'arrivée d'un émetteur PDF dans le produit — mais pas pour
 * la raison qu'il donnait. Il opposait « une bibliothèque de plus », ses polices
 * à embarquer et ses accents à vérifier : `lib/pdf.ts` n'est pas une
 * bibliothèque, n'embarque aucune police, et ses accents sont gardés.
 *
 * CE QUI SÉPARE VRAIMENT LES DEUX CHEMINS EST LA SOURCE. Ce document-ci est
 * ARRÊTÉ PAR LE SERVEUR — `api.issueReceipt`, avec sa propre devise, et aucun
 * montant recalculé ici. Les PDF de `documentsPdf` sont produits depuis les
 * données que le client détient. Deux sources, deux documents, et les fondre
 * demanderait de porter le document du serveur jusqu'à l'émetteur, ce qui est un
 * autre travail. En attendant, le locataire télécharge et le gestionnaire
 * imprime — et les deux pièces peuvent différer de mise en page.
 */
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

  /**
   * Le document se met en forme dans SA devise, pas dans celle de l'écran.
   *
   * `useCurrency` sert la lecture courante ; ici on atteste. Tant que le
   * document n'est pas revenu du serveur, on retombe sur l'affichage — il n'y a
   * alors aucun montant à mettre en forme.
   */
  const [document, setDocument] = useState<DocumentEmis | null>(null)
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

  useEffect(() => {
    if (!open || !parkId) return
    let annule = false
    setDocument(null)
    setEchec(null)
    void api
      .issueReceipt<{ document: DocumentEmis }>(parkId, { unitId, periodStart })
      .then(({ document: doc }) => {
        if (!annule) setDocument(doc)
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

  const [annee, mois] = periodStart.split('-').map(Number)

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

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={document ? t(`app.receipts.${document.kind}`) : t('app.receipts.title')}
      description={t('app.receipts.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {/*
            LE PDF, ET L'IMPRESSION À CÔTÉ.

            La modale n'offrait que `window.print()`. La boîte d'impression sait
            produire un PDF, mais elle y ajoute ses en-têtes, le nom du fichier
            échappe au produit, et son comportement est inégal sur Android — la
            cible principale. Surtout, la feuille ainsi obtenue ne ressemblait
            pas à celle que le LOCATAIRE télécharge du même mois : deux pièces
            pour un seul fait.

            Les deux passent maintenant par la même mise en page. L'impression
            survit parce que remettre du papier reste un geste du métier.
          */}
          <Button
            variant="secondary"
            icon="download"
            disabled={!document || Boolean(echec)}
            onClick={() =>
              document &&
              telechargerLePdf({
                kind: document.kind,
                unit: document.unit,
                building: document.building,
                tenant: document.tenant,
                periode: d.monthYear({ year: annee, month: mois - 1 }),
                moisISO: periodStart.slice(0, 7),
                rentMinor: document.rentMinor,
                waterMinor: document.waterMinor,
                powerMinor: document.powerMinor,
                dueMinor: document.dueMinor,
                paidMinor: document.paidMinor,
                balanceMinor: document.balanceMinor,
                /* La devise DU DOCUMENT, celle que le serveur a posée à
                   l'émission — pas celle de l'écran. Le même versement imprimé
                   sur deux postes réglés différemment portait deux monnaies. */
                argent: money,
                payments: document.payments.map((versement) => ({
                  date: d.fullDate(partiesDeDateISO(versement.paidOn)),
                  moyen: libelleMoyen(versement.method),
                  reference: versement.reference,
                  amountMinor: versement.amountMinor,
                })),
              })
            }
          >
            {t('app.documents.download')}
          </Button>
          <Button
            icon="file"
            onClick={() => window.print()}
            /*
              ÉTEINT AUSSI QUAND LE RETRAIT A ÉCHOUÉ.

              La branche d'erreur DÉMONTE la quittance entière et affiche le
              motif à sa place ; le bouton, lui, ne regardait que la présence du
              document. On pouvait donc imprimer sur un corps qui n'existe plus
              — la feuille sortait blanche, `.zone-imprimable` n'étant plus
              montée. Un bouton actif qui ne peut rien produire est pire qu'un
              bouton absent : il fait croire à une panne de l'imprimante.
            */
            disabled={!document || Boolean(echec)}
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
      ) : !document ? (
        <p className="text-body text-muted">{t('common.loading')}</p>
      ) : (
        /* `zone-imprimable` : la feuille d'impression ne garde que ce bloc.
           Imprimer la page entière sortirait la barre latérale et la
           navigation, que personne ne veut sur une quittance. */
        <div className="zone-imprimable flex flex-col gap-5 text-body">
          {/*
            UN EN-TÊTE, PARCE QU'UNE QUITTANCE DIT QUI L'ÉMET.

            La feuille commençait par un surtitre et un mois. Remise à un
            locataire, elle n'était signée de personne : rien dessus ne disait
            d'où elle venait, alors que c'est un document qui atteste.

            LA MARQUE EN UNE SEULE ENCRE, et c'est la raison d'être de
            `logo-monochrome.svg`. Les quatre carrés de la marque disent « états
            différents » par des opacités de 0,55 et 0,22 ; sur une feuille,
            elles deviennent des gris tramés qu'une imprimante laser bon marché
            rend en semis de points et qu'une thermique ne rend pas. La version
            imprimée porte donc la même opposition par la FORME — deux carrés
            pleins, deux évidés.

            Ce qu'on voit ici est ce qui sortira : une seule ressource, pas de
            bascule entre écran et papier. Un aperçu qui ne ressemble pas à la
            feuille est un aperçu qui ment.

            ON EMPRUNTE `Logo`, ON NE LE RECOPIE PAS. Une première rédaction
            réécrivait le mot-symbole ici, avec sa graisse : `graisses.test.ts`
            l'a refusée, et il avait raison — le dépôt n'admet qu'un seul 700 en
            ligne, et deux mot-symboles auraient divergé au premier ajustement.
            `to=""` rend une balise inerte plutôt qu'un lien : sur une feuille,
            un lien ne mène nulle part.
          */}
          <div className="border-b border-border pb-4">
            <Logo impression size="sm" to="" />
          </div>

          <div>
            <p className="eyebrow text-muted">{t(`app.receipts.${document.kind}`)}</p>
            <p className="text-h3">
              {d.monthYear({ year: annee!, month: mois! })}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <dt className="text-muted">{t('app.receipts.tenant')}</dt>
            <dd>{document.tenant}</dd>
            <dt className="text-muted">{t('app.receipts.unit')}</dt>
            <dd>
              {document.unit} · {document.building} ({document.district})
            </dd>
            <dt className="text-muted">{t('app.receipts.due')}</dt>
            <dd className="numeric">{money(document.dueMinor)}</dd>
            <dt className="text-muted">{t('app.receipts.paid')}</dt>
            <dd className="numeric">{money(document.paidMinor)}</dd>
            <dt className="text-muted">{t('app.receipts.balance')}</dt>
            <dd className="numeric">
              {/* Un solde négatif est une AVANCE, et se dit comme telle : le
                  laisser en « -55 000 » ferait lire un impayé à l'envers. */}
              {document.balanceMinor < 0
                ? t('app.receipts.credit', { amount: money(-document.balanceMinor) })
                : money(document.balanceMinor)}
            </dd>
          </dl>

          <div>
            <p className="eyebrow text-muted">{t('app.receipts.payments')}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {document.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {d.fullDate(partiesDeDateISO(p.paidOn))} · {libelleMoyen(p.method)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="numeric">{money(p.amountMinor)}</span>
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
                    {role === 'owner' && (
                      <IconButton
                        /*
                          LA GOMME NE SORT PAS DE L'IMPRIMANTE.

                          La feuille d'impression dit « seule la zone marquée
                          sort », et c'est vrai des ancêtres — mais elle rallume
                          TOUT ce que cette zone contient, `zone-imprimable *`.
                          Le bouton de retrait vit dedans : il s'imprimait donc
                          sur la quittance remise au locataire, une croix grise
                          au bout de chaque ligne de versement.

                          Un document qui atteste ne porte pas les commandes de
                          celui qui le consulte.
                        */
                        className="print:hidden"
                        icon="close"
                        label={t('app.receipts.removePayment')}
                        variant="ghost"
                        disabled={retraitEnCours}
                        onClick={() =>
                          setARetirer({
                            id: p.id,
                            montant: money(p.amountMinor),
                            date: d.fullDate(partiesDeDateISO(p.paidOn)),
                          })
                        }
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
