import { useCallback } from 'react'
import { useT } from '@/i18n/I18nProvider'
import { isoMonth } from '@/lib/csv'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import {
  buildingById,
  dernierVersement,
  receiptDue,
  receiptStatus,
  type Receipt,
  type Unit,
} from '@/data/portfolio'

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
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()

  return useCallback(
    (unit: Unit, receipt: Receipt): string => {
      const versement = dernierVersement(receipt)
      return exportCsv({
        // L'unité entre dans le nom : un locataire qui télécharge six mois de
        // quittances doit pouvoir les distinguer dans son dossier.
        // Le libellé et non l'identifiant : sinon le locataire
        // télécharge « quittance-3f7a91c2-….csv ».
        name: [t('app.files.receipt'), unit.label],
        // Le mois de la quittance, et non le jour du téléchargement : c'est la
        // période qui identifie le document.
        stamp: isoMonth(receipt),
        headers: [
          t('app.period'),
          t('app.portfolio.unit'),
          t('app.portfolio.building'),
          t('app.portfolio.tenant'),
          csvMoney.header(t('app.payments.due')),
          csvMoney.header(t('app.payments.paid')),
          t('app.payments.date'),
          t('app.portfolio.status'),
        ],
        /**
         * Le DÛ de la période et ce qui a été reçu, en deux colonnes.
         *
         * Il n'y en avait qu'une, remplie avec le loyer courant de l'unité :
         * elle ignorait l'eau et l'électricité, et une révision de loyer
         * l'aurait réécrite pour toutes les périodes passées. Une quittance qui
         * change de montant après coup n'atteste plus rien.
         *
         * Le statut se DÉRIVE des deux, il n'est plus porté par la donnée : un
         * champ recopié à côté des montants qu'il résume peut les contredire.
         */
        rows: [
          [
            d.monthYear(receipt),
            unit.label,
            buildingById(unit.buildingId)?.name ?? null,
            unit.tenant ?? t('app.portfolio.noTenant'),
            csvMoney.amount(receiptDue(receipt)),
            csvMoney.amount(receipt.paidMinor),
            // La date du règlement, pas celle de l'échéance — et rien tant
            // qu'aucun versement n'a été reçu.
            versement ? d.fullDate(versement.paidOn) : null,
            t(`status.${receiptStatus(receipt, new Date())}` as 'status.paid'),
          ],
        ],
        notice: 'app.receiptDownloaded',
      })
    },
    [csvMoney, d, exportCsv, t],
  )
}
