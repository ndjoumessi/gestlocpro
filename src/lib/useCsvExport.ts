import { useCallback, useMemo } from 'react'
import { useToast } from '@/components/primitives/Toast'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS, enUniteDUsage, formatTaux, libelleCourt } from '@/currency/currencies'
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
       * En-tête portant l'UNITÉ, et rien de plus : « Loyer (FCFA) ».
       *
       * Une première rédaction y logeait aussi la base de conversion —
       * « Loyer (CAD ($), converti du FCFA au taux du 28/08/2026) ». Ouvert dans
       * un tableur, l'état des cautions rendait trois fois cette phrase sur une
       * ligne d'en-tête de deux cents caractères, et le tableau ne tenait plus
       * dans une fenêtre. La mention était juste, sa place ne l'était pas :
       * elle vaut pour le FICHIER, pas pour chaque colonne. Elle est passée en
       * pied, voir `useCsvExport`.
       *
       * La forme COURTE de la devise — « CAD » plutôt que « CAD ($) » : dans un
       * en-tête de colonne, le symbole n'ajoute rien et ouvre une parenthèse
       * dans une parenthèse.
       */
      header: (label: string): string => `${label} (${libelleCourt(deviseAffichee)})`,
    }),
    [baseDeConversion, dates, deviseAffichee, deviseSource, enDeviseAffichee, locale, definition, t],
  )
}

/** Rend une fonction d'export : sérialise, télécharge, puis annonce. */
export function useCsvExport() {
  const { locale, t } = useI18n()
  const dates = useDates()
  const { deviseAffichee, deviseSource, definition, baseDeConversion } = useCurrency()
  const { notify } = useToast()

  /**
   * D'où viennent les montants du fichier — ou rien, s'ils n'ont pas bougé.
   *
   * Les cautions ont été versées en francs : les 713,11 $ sont une conversion,
   * pas ce qui a été reçu. Un fichier qui l'oublie affirme un encaissement qui
   * n'a pas eu lieu, et il se transmet — il arrive chez un comptable, où
   * personne ne se souvient des réglages de l'écran d'où il sort.
   *
   * La parité du franc CFA n'a pas de date : elle est fixée par traité. Lui en
   * donner une inventerait une péremption — même règle que les documents, servie
   * par le même `baseDeConversion`.
   *
   * ET LE TAUX Y FIGURE, pas seulement sa date. C'est ce qui rend le fichier
   * RECALCULABLE : sans le nombre, on ne peut ni remonter aux montants reçus, ni
   * recouper une somme, ni retrouver plus tard quel cours a servi — le cours du
   * 28/08/2026 ne se repêche pas dans six mois, sur un fichier archivé, par
   * quelqu'un qui n'a pas ce produit. Et c'est le taux QUI A SERVI : il vient de
   * `coursEntre`, celui-là même dont sortent les montants des colonnes.
   */
  const mentionDeConversion = useCallback((): string | null => {
    const base = baseDeConversion(deviseSource)
    if (!base) return null
    const depuis = CURRENCY_DEFS[base.depuis].label
    const rate = formatTaux(base.taux, locale)
    return base.date
      ? t('app.documents.csvConverted', {
          currency: definition.label,
          from: depuis,
          date: dates.fullDate(partiesDeDateISO(base.date)),
          rate,
        })
      : t('app.documents.csvConvertedPegged', {
          currency: definition.label,
          from: depuis,
          rate,
        })
  }, [baseDeConversion, dates, definition, deviseSource, locale, t])

  return useCallback(
    ({ name, stamp, headers, rows, notice }: CsvExportRequest): string => {
      /* LE NOM PORTE LA DEVISE LUE. Deux exports du même parc dans deux
         monnaies rendaient deux fichiers de MÊME NOM : le second écrasait le
         premier dans le dossier des téléchargements, sans un mot. Un fichier
         qui quitte le produit doit se suffire, nom compris. */
      const parts = [...(typeof name === 'string' ? [name] : name), deviseAffichee]
      const filename = csvFilename(parts, stamp ?? isoDay(new Date()))
      /*
        LA NOTE DE CONVERSION EN PIED, séparée par une ligne VIDE.

        J'avais écrit qu'un CSV n'a pas de bas de feuille et posé la mention dans
        chaque en-tête de colonne : ouvert dans un tableur, l'état des cautions
        rendait trois fois la même phrase sur une ligne de deux cents caractères.
        L'affirmation était fausse. Une ligne vide puis une note ne touchent pas
        la table — les tableurs les affichent sous elle, `SUM` ignore une cellule
        de texte, et un analyseur qui lit ligne à ligne rencontre une ligne vide,
        qui est la fin naturelle d'un enregistrement.

        ELLE N'APPARAÎT QUE S'IL Y A CONVERSION. Un pied sur un fichier exact
        jetterait un doute sur des montants qui n'en méritent pas, et ajouterait
        deux lignes à tous les exports du chemin ordinaire.
      */
      const note = mentionDeConversion()
      const lignes = note ? [headers, ...rows, [], [note]] : [headers, ...rows]
      const content = serializeCsv(lignes, { delimiter: csvDelimiter(locale) })

      downloadTextFile(content, filename)
      notify(t(notice ?? 'app.exported', { file: filename }), { tone: 'ok' })

      return filename
    },
    [deviseAffichee, locale, mentionDeConversion, notify, t],
  )
}
