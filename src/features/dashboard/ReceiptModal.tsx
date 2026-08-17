import { useEffect, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { formatMoney } from '@/currency/currencies'
import { useDates } from '@/lib/useDates'
import { api, ApiError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'

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
  payments: { amountMinor: number; method: string; paidOn: string; reference: string | null }[]
}

/**
 * Émission d'une quittance, ou d'un reçu.
 *
 * Le mot affiché n'est jamais choisi par l'écran : il vient du serveur, qui
 * seul sait si la période est soldée. Un écran qui déciderait de dire
 * « quittance » ferait signer au bailleur une preuve de paiement qu'il n'a pas
 * reçu — et une quittance ne se reprend pas.
 *
 * L'impression passe par `window.print()` et une feuille de style dédiée
 * plutôt que par un générateur de PDF : le navigateur sait déjà produire un
 * PDF depuis sa boîte d'impression, et une bibliothèque de plus signifierait
 * des polices à embarquer, des accents à vérifier et une mise en page qui
 * diverge de ce qu'on voit à l'écran.
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
  const { etat } = useSession()
  const parkId = etat.statut === 'connecte' ? (etat.adhesions[0]?.parkId ?? null) : null

  /**
   * Le document se met en forme dans SA devise, pas dans celle de l'écran.
   *
   * `useCurrency` sert la lecture courante ; ici on atteste. Tant que le
   * document n'est pas revenu du serveur, on retombe sur l'affichage — il n'y a
   * alors aucun montant à mettre en forme.
   */
  const [document, setDocument] = useState<DocumentEmis | null>(null)
  const [echec, setEchec] = useState<string | null>(null)

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

  /** `AAAA-MM-JJ` en parties, pour le formateur de dates du produit. */
  const partsDe = (iso: string) => {
    const [y, m, j] = iso.split('-').map(Number)
    return { year: y!, month: m!, day: j! }
  }

  /**
   * Le moyen de paiement en clair.
   *
   * Le code brut — « mobile », « transfer » — n'a rien à faire sur un document
   * remis à un locataire : il n'est ni traduit ni compréhensible.
   */
  const libelleMoyen = (code: string) =>
    ({
      mobile: t('app.payments.methodMobile'),
      cash: t('app.payments.methodCash'),
      transfer: t('app.payments.methodTransfer'),
      check: t('app.payments.methodCheck'),
    })[code] ?? code

  return (
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
          <Button icon="download" onClick={() => window.print()} disabled={!document}>
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
              {document.payments.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {d.fullDate(partsDe(p.paidOn))} · {libelleMoyen(p.method)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className="numeric">{money(p.amountMinor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
