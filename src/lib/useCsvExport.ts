import { useCallback, useMemo } from 'react'
import { useToast } from '@/components/primitives/Toast'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { enUniteDUsage } from '@/currency/currencies'
import { csvDelimiter, csvFilename, csvNumber, isoDay, serializeCsv, type CsvCell } from './csv'
import { downloadTextFile } from './download'

/**
 * Le geste « exporter », d'un seul tenant.
 *
 * Cinq boutons répartis sur quatre écrans exportent du CSV. Sans ce point de
 * passage, chacun devrait connaître le séparateur de sa langue, la forme du nom
 * de fichier et l'ordre des opérations — et c'est justement l'ordre qui était
 * faux : le toast annonçait un fichier que personne ne fabriquait. Ici il vient
 * **après** le téléchargement, et une erreur de sérialisation le supprime au
 * lieu de mentir.
 */
export interface CsvExportRequest {
  /**
   * Segment(s) parlant(s) du nom de fichier, déjà traduits. Ils sont réduits à
   * une forme sûre par `csvFilename` — accents et espaces compris.
   */
  name: string | readonly (string | number)[]
  /** Suffixe daté. Par défaut le jour de l'export ; une quittance passe son mois. */
  stamp?: string
  /** Première ligne du fichier. Les en-têtes sont traduits comme le reste. */
  headers: readonly string[]
  /** Corps du fichier, cellules déjà mises en forme comme à l'écran. */
  rows: readonly (readonly CsvCell[])[]
  /** Message du toast. Reçoit le nom du fichier en `{file}`. */
  notice?: MessageKey
}

/**
 * Montants d'un CSV : la cellule porte un nombre, l'en-tête porte la devise.
 *
 * Séparer les deux est ce qui rend le fichier calculable. Mettre la devise dans
 * chaque cellule — « 145 000 FCFA » — la répète mille fois et interdit la somme
 * ; la mettre en en-tête la dit une fois, à l'endroit où elle vaut pour toute
 * la colonne. C'est aussi ce que fait n'importe quel export comptable.
 */
export function useCsvMoney() {
  const { locale } = useI18n()
  const { currency, definition } = useCurrency()

  return useMemo(
    () => ({
      /**
       * Montant calculable : sans groupement ni symbole, et EN UNITÉS D'USAGE.
       *
       * Les montants arrivent du serveur en mineures. Sans cette conversion, le
       * tableur écrirait « 145000,00 » là où l'écran affiche « 1 450,00 € » —
       * un fichier qui contredit la page dont il est l'export, et qui fausse
       * toute somme qu'on en tire.
       */
      amount: (value: number): string =>
        csvNumber(enUniteDUsage(value, currency), locale, definition.decimals),
      /** En-tête portant la devise : « Loyer (FCFA) ». */
      header: (label: string): string => `${label} (${definition.label})`,
    }),
    [currency, locale, definition],
  )
}

/** Rend une fonction d'export : sérialise, télécharge, puis annonce. */
export function useCsvExport() {
  const { locale, t } = useI18n()
  const { notify } = useToast()

  return useCallback(
    ({ name, stamp, headers, rows, notice }: CsvExportRequest): string => {
      const parts = typeof name === 'string' ? [name] : name
      const filename = csvFilename(parts, stamp ?? isoDay(new Date()))
      const content = serializeCsv([headers, ...rows], { delimiter: csvDelimiter(locale) })

      downloadTextFile(content, filename)
      notify(t(notice ?? 'app.exported', { file: filename }), { tone: 'ok' })

      return filename
    },
    [locale, notify, t],
  )
}
