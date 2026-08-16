import { useCallback } from 'react'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { isoMonth } from '@/lib/csv'
import { useCsvExport } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { buildingById, type Receipt, type Unit } from '@/data/portfolio'

/**
 * Téléchargement d'une quittance.
 *
 * Deux écrans portent le même bouton — l'espace locataire et l'aperçu du
 * portail —, et tous deux ne faisaient rien du tout : ni `onClick`, ni `href`,
 * pas même un toast. Le geste vit ici plutôt qu'en double, sans quoi la
 * quittance de l'un et celle de l'autre finiraient par ne plus porter les
 * mêmes colonnes.
 *
 * Une quittance est un document d'une seule ligne : en-têtes, puis la période.
 * C'est pauvre pour un tableur, mais c'est honnête — le vrai document, celui
 * qui porte une signature et une mention légale, est un PDF que ce produit ne
 * sait pas encore fabriquer.
 */
export function useReceiptExport() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const exportCsv = useCsvExport()

  return useCallback(
    (unit: Unit, receipt: Receipt): string =>
      exportCsv({
        // L'unité entre dans le nom : un locataire qui télécharge six mois de
        // quittances doit pouvoir les distinguer dans son dossier.
        name: [t('app.files.receipt'), unit.id],
        // Le mois de la quittance, et non le jour du téléchargement : c'est la
        // période qui identifie le document.
        stamp: isoMonth(receipt),
        headers: [
          t('app.period'),
          t('app.portfolio.unit'),
          t('app.portfolio.building'),
          t('app.portfolio.tenant'),
          t('app.payments.amount'),
          t('app.payments.date'),
          t('app.portfolio.status'),
        ],
        rows: [
          [
            d.monthYear(receipt),
            unit.id,
            buildingById(unit.buildingId)?.name ?? null,
            unit.tenant ?? t('app.portfolio.noTenant'),
            money(unit.rent),
            d.fullDate({ year: receipt.year, month: receipt.month, day: receipt.paidDay }),
            t(`status.${receipt.status}` as 'status.paid'),
          ],
        ],
        notice: 'app.receiptDownloaded',
      }),
    [d, exportCsv, money, t],
  )
}
