import { useCallback } from 'react'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { dernierVersement, type Receipt, type Unit } from '@/data/portfolio'

/**
 * L'HISTORIQUE DES QUITTANCES EN TABLEUR, à côté du carnet PDF.
 *
 * ═══ POURQUOI IL REVIENT ═══
 *
 * Il a disparu quand « Tout télécharger » est passé au PDF, et je l'ai retiré
 * sans que personne le demande. Ce n'était pas un remplacement : les deux
 * fichiers ne servent pas au même geste. Le carnet se PRÉSENTE — à un bailleur
 * suivant, à une administration —, le tableau se CALCULE : on y trie ses
 * périodes, on y somme une année, on le colle dans une feuille.
 *
 * Un PDF ne fait ni l'un ni l'autre de ces trois gestes. Retirer une capacité
 * parce qu'on en ajoute une autre n'est un progrès que si elles se recouvrent,
 * et celles-ci ne se recouvrent pas.
 *
 * ═══ CE QU'IL PORTE, ET CE QU'IL NE PORTE PAS ═══
 *
 * Les montants de CHAQUE période, pris tels que le serveur les a figés. Le
 * loyer sortait autrefois de `unit.rent` — celui du bail d'aujourd'hui, recopié
 * sur les six lignes — et l'eau comme l'électricité se recalculaient au tarif
 * courant : un fichier téléchargé en octobre ne disait pas la même chose que le
 * même fichier téléchargé en juillet.
 *
 * La NOTE du bailleur n'y est pas, et ne peut pas y être : le serveur ne la sert
 * pas à un locataire.
 */
export function useHistoriqueCsv() {
  const t = useT()
  const d = useDates()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()

  return useCallback(
    (unit: Unit, receipts: Receipt[]): string =>
      exportCsv({
        name: [t('app.documents.allReceipts'), unit.label],
        headers: [
          t('app.period'),
          csvMoney.header(t('app.tenant.colRent')),
          csvMoney.header(t('app.tenant.colWater')),
          csvMoney.header(t('app.tenant.colPower')),
          csvMoney.header(t('app.payments.paid')),
          t('app.payments.date'),
          t('app.payments.reference'),
        ],
        rows: receipts.map((receipt) => {
          const versement = dernierVersement(receipt)
          return [
            d.monthYear(receipt),
            csvMoney.amount(receipt.rentMinor),
            csvMoney.amount(receipt.waterMinor),
            csvMoney.amount(receipt.powerMinor),
            /* La colonne « réglé » : c'est le seul chiffre qui distingue une
               période payée d'une période en cours. Son absence laissait croire
               chaque ligne soldée. */
            csvMoney.amount(receipt.paidMinor),
            // Pas de versement, pas de date : inventer celle de l'échéance
            // laisserait croire à un règlement reçu.
            versement ? d.fullDate(versement.paidOn) : null,
            /* LA RÉFÉRENCE DE L'OPÉRATEUR, dans le fichier que le locataire
               garde. C'est avec elle qu'il conteste : sans elle, l'export lui
               demande de croire sur parole un encaissement qu'il ne peut pas
               retrouver chez son opérateur. */
            versement?.reference ?? null,
          ]
        }),
        notice: 'app.exported',
      }),
    [csvMoney, d, exportCsv, t],
  )
}
