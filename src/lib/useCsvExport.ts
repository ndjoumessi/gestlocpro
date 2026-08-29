import { useCallback, useMemo } from 'react'
import { useToast } from '@/components/primitives/Toast'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS, enUniteDUsage } from '@/currency/currencies'
import { useDates } from './useDates'
import { partiesDeDateISO } from './dates'
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
  const { locale, t } = useI18n()
  const dates = useDates()
  const { deviseAffichee, deviseSource, definition, enDeviseAffichee, baseDeConversion } =
    useCurrency()

  return useMemo(
    () => ({
      /**
       * Montant calculable : sans groupement ni symbole, et EN UNITÉS D'USAGE.
       *
       * Les montants arrivent du serveur en mineures. Sans cette conversion, le
       * tableur écrirait « 145000,00 » là où l'écran affiche « 1 450,00 € » —
       * un fichier qui contredit la page dont il est l'export, et qui fausse
       * toute somme qu'on en tire.
       *
       * ET IL FAUT CONVERTIR AVANT DE CHANGER D'ÉCHELLE. Cette fonction faisait
       * `enUniteDUsage(value, currency)` : elle divisait par les décimales de la
       * devise DEMANDÉE sans jamais appliquer le cours. Un parc de Douala lu en
       * euros exportait donc 259,42 pour 25 942 FCFA — qui valent 39,55 € — sous
       * un en-tête annonçant des euros. Un facteur 6,5, et le même reproche que
       * le paragraphe ci-dessus : le fichier contredisait sa page.
       *
       * Le défaut ne se voyait pas parce que la démonstration tourne en franc
       * CFA, où la conversion est l'identité et `10 ** 0` vaut un.
       */
      amount: (value: number): string =>
        csvNumber(enUniteDUsage(enDeviseAffichee(value), deviseAffichee), locale, definition.decimals),
      /**
       * En-tête portant la devise : « Loyer (FCFA) ».
       *
       * ET SA BASE, QUAND IL Y A CONVERSION : « Loyer (Euro (€), converti du
       * FCFA à la parité légale) ».
       *
       * UN CSV N'A AUCUNE PLACE POUR DE LA PROSE. Les documents portent leur
       * mention en bas de feuille ; un tableur n'a pas de bas de feuille. Une
       * ligne ajoutée avant l'en-tête casse tout analyseur qui suppose que la
       * première ligne nomme les colonnes ; une ligne ajoutée après les données
       * entre dans les colonnes qu'on somme. Le seul endroit à la fois sûr et
       * attaché à ce qu'il qualifie est l'en-tête lui-même.
       *
       * ET C'EST ICI QUE ÇA COMPTE LE PLUS. Un tableur se somme, se recoupe et
       * se TRANSMET : il quitte le produit, arrive chez un comptable, et
       * personne ne se souvient alors des réglages de l'écran d'où il sort. La
       * colonne doit se suffire.
       *
       * Sans conversion, l'en-tête ne s'allonge pas : une mention sur un fichier
       * exact jetterait un doute sur des montants qui n'en méritent pas.
       */
      header: (label: string): string => {
        const base = baseDeConversion(deviseSource)
        if (!base) return `${label} (${definition.label})`

        const depuis = CURRENCY_DEFS[base.depuis].label
        const mention = base.date
          ? t('app.documents.csvConverted', {
              currency: definition.label,
              from: depuis,
              date: dates.fullDate(partiesDeDateISO(base.date)),
            })
          : t('app.documents.csvConvertedPegged', { currency: definition.label, from: depuis })
        return `${label} (${mention})`
      },
    }),
    [baseDeConversion, dates, deviseAffichee, deviseSource, enDeviseAffichee, locale, definition, t],
  )
}

/** Rend une fonction d'export : sérialise, télécharge, puis annonce. */
export function useCsvExport() {
  const { locale, t } = useI18n()
  const { deviseAffichee } = useCurrency()
  const { notify } = useToast()

  return useCallback(
    ({ name, stamp, headers, rows, notice }: CsvExportRequest): string => {
      /* LE NOM PORTE LA DEVISE LUE. Deux exports du même parc dans deux
         monnaies rendaient deux fichiers de MÊME NOM : le second écrasait le
         premier dans le dossier des téléchargements, sans un mot. Un fichier
         qui quitte le produit doit se suffire, nom compris. */
      const parts = [...(typeof name === 'string' ? [name] : name), deviseAffichee]
      const filename = csvFilename(parts, stamp ?? isoDay(new Date()))
      const content = serializeCsv([headers, ...rows], { delimiter: csvDelimiter(locale) })

      downloadTextFile(content, filename)
      notify(t(notice ?? 'app.exported', { file: filename }), { tone: 'ok' })

      return filename
    },
    [deviseAffichee, locale, notify, t],
  )
}
