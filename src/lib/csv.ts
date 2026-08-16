import type { Locale } from '@/i18n/locales'

/**
 * Sérialisation CSV.
 *
 * Trois écrans annonçaient « Relevé du mois exporté » sans produire le moindre
 * fichier. Le remède tient en deux modules : celui-ci fabrique le texte, et
 * `lib/download` le remet au navigateur. Les deux sont séparés parce qu'ils
 * n'ont pas la même nature — l'un est une fonction pure et se teste en une
 * ligne, l'autre touche au DOM et demande à être simulé.
 *
 * Le module ne connaît ni les écrans ni la devise : il reçoit des cellules déjà
 * mises en forme par `formatMoney`, `useDates` et `useNumbers`, comme l'écran
 * les affiche. Ce qui est exporté est ce qui est vu.
 */

/** Valeur d'une cellule avant sérialisation. `null` rend une cellule vide. */
export type CsvCell = string | number | null | undefined

/**
 * Séparateur de colonnes.
 *
 * Deux valeurs seulement, et pas un `string` libre : un séparateur exotique
 * demanderait de revoir la règle de citation ci-dessous, qui protège
 * volontairement contre les deux à la fois.
 */
export type CsvDelimiter = ';' | ','

/**
 * Séparateur attendu par le tableur, selon la langue.
 *
 * Excel FR lit la virgule comme un séparateur **décimal** : un fichier
 * virgulé y arrive sur une seule colonne. Excel EN fait l'inverse avec le
 * point-virgule. Le séparateur suit donc la langue de l'interface, faute de
 * mieux — c'est l'indice le plus proche de la configuration du tableur.
 */
export function csvDelimiter(locale: Locale): CsvDelimiter {
  return locale === 'fr' ? ';' : ','
}

/**
 * Marque d'ordre des octets UTF-8.
 *
 * Sans elle, Excel lit le fichier dans l'encodage régional de la machine et
 * « Deïdo » devient « DeÃ¯do ». Trois octets qui font toute la différence entre
 * un export lisible et un export à retaper.
 */
export const UTF8_BOM = '\uFEFF'

/** RFC 4180 : fin de ligne CRLF, celle qu'attendent les tableurs. */
const EOL = '\r\n'

/**
 * Caractères qui ouvrent une **formule** dans Excel, LibreOffice et Google
 * Sheets.
 *
 * C'est une faille, pas une coquetterie de format : un locataire nommé
 * `=HYPERLINK("http://…","Cliquez")` ou `@SUM(1+1)*cmd|' /C calc'!A0` voit sa
 * cellule exécutée à l'ouverture du fichier par le gestionnaire. Les noms de
 * locataires sont de la donnée saisie, donc hostile par défaut.
 *
 * La tabulation et le retour chariot sont du lot : les tableurs les ignorent en
 * tête de cellule et évaluent ce qui suit.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * Un nombre écrit en toutes lettres n'est pas une formule.
 *
 * `-45000` et `-1450,50` commencent par un tiret et déclenchent donc la règle
 * ci-dessus — qui les préfixerait d'une apostrophe et les rendrait textuels.
 * C'est le défaut même que la colonne numérique corrige, revenu par la couche
 * d'échappement : une retenue de caution, toujours négative, redeviendrait
 * insommable.
 *
 * L'exemption est **étroite à dessein** : elle ne couvre qu'un nombre entier ou
 * décimal, signe compris et rien d'autre. `-1+1` reste une expression, et
 * `-45000;=cmd` aussi.
 */
const NOMBRE_SEUL = /^-?\d+(?:[.,]\d+)?$/

/**
 * Caractères qui obligent à citer le champ.
 *
 * Les **deux** séparateurs y figurent, pas seulement celui du fichier : un
 * export français ouvert par un tableur configuré en virgule doit rester sur
 * une seule colonne. Citer un peu plus que nécessaire ne coûte rien, se
 * tromper de colonne coûte une relecture entière.
 */
const MUST_QUOTE = /[";,\r\n]/

/**
 * Échappe une cellule.
 *
 * Deux dangers distincts, traités dans cet ordre :
 *
 *  1. la **formule** — on préfixe d'une apostrophe, ce que le tableur lit comme
 *     « ceci est du texte » ; la cellule reste lisible et n'est plus évaluée ;
 *  2. le **format** — guillemets doublés, champ cité dès qu'il contient un
 *     séparateur, un guillemet ou un saut de ligne.
 *
 * Un `number` échappe à la première règle : `-45000` est un nombre négatif, pas
 * une expression, et le neutraliser rendrait tout montant négatif illisible.
 */
export function escapeCsvField(value: CsvCell, delimiter: CsvDelimiter = ';'): string {
  if (value === null || value === undefined) return ''

  const text = typeof value === 'number' ? String(value) : value
  const estNombre = typeof value === 'number' || NOMBRE_SEUL.test(text)
  const guarded = !estNombre && FORMULA_PREFIX.test(text) ? `'${text}` : text

  // Un champ neutralisé est toujours cité : l'apostrophe de protection doit
  // arriver telle quelle jusqu'au tableur, sans dépendre de son analyseur.
  const needsQuotes = guarded !== text || guarded.includes(delimiter) || MUST_QUOTE.test(guarded)
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export interface CsvOptions {
  delimiter?: CsvDelimiter
  /** BOM UTF-8 en tête. Actif par défaut : c'est Excel qui l'exige. */
  bom?: boolean
}

/** Sérialise des lignes de cellules en un document CSV complet. */
export function serializeCsv(
  rows: readonly (readonly CsvCell[])[],
  options: CsvOptions = {},
): string {
  const { delimiter = ';', bom = true } = options

  const body = rows
    .map((row) => row.map((cell) => escapeCsvField(cell, delimiter)).join(delimiter))
    .join(EOL)

  // Fin de ligne finale : certains outils avalent la dernière ligne sans elle.
  return (bom ? UTF8_BOM : '') + (body ? body + EOL : '')
}

/**
 * Nombre destiné à être **calculé** par le tableur.
 *
 * Les montants passaient par `formatMoney`, pour que le fichier montre ce que
 * montre l'écran. La règle était mauvaise : `145 000 FCFA` est du texte, avec
 * une espace insécable étroite et un suffixe. Excel ne sait pas en faire la
 * somme, et un fichier dont l'unique raison d'être est d'être ouvert dans un
 * tableur devient inutilisable pour ce à quoi il sert.
 *
 * Deux règles, et elles sont liées :
 *
 *  1. **aucun groupement des milliers** — l'espace ou la virgule qui embellit à
 *     l'écran coupe le nombre en deux à l'import ;
 *  2. **le séparateur décimal suit la langue**, comme le séparateur de
 *     colonnes. Les deux vont ensemble : un tableur configuré en français lit
 *     la virgule comme décimale, ce qui est précisément la raison pour laquelle
 *     le fichier français est délimité par des points-virgules. Émettre
 *     `1450.5` dans un fichier français produirait une date ou du texte.
 *
 * La devise ne figure pas dans la cellule : elle est constante sur tout le
 * fichier et se nomme une fois, en en-tête de colonne.
 */
export function csvNumber(value: number, locale: Locale, decimals = 0): string {
  const fixe = value.toFixed(decimals)
  return locale === 'fr' ? fixe.replace('.', ',') : fixe
}

/** Jour au format ISO, en heure locale : `2026-08-16`. */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Mois au format ISO : `2026-08`. `month` est un index, 0 = janvier. */
export function isoMonth(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month + 1).padStart(2, '0')}`
}

/** Prénom du fichier. Nom de marque, il ne se traduit pas. */
const PREFIX = 'gestlocpro'

/**
 * Réduit un libellé traduit à un segment de nom de fichier.
 *
 * Les segments viennent du dictionnaire — donc de la traduction — et rien ne
 * garantit qu'ils soient sûrs pour un système de fichiers : « Relevés
 * compteurs » porte un accent et une espace, et Windows refuse une bonne
 * partie de la ponctuation. On enlève les diacritiques plutôt que de les
 * interdire au traducteur.
 */
function slug(value: string | number): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Nom de fichier parlant et daté : `gestlocpro-paiements-2026-08-16.csv`.
 *
 * L'horodatage est en ISO et non au format du pays : c'est un nom de fichier,
 * il doit se trier dans un dossier de téléchargements et ne jamais contenir de
 * barre oblique — ce que « 16/08/2026 » ferait.
 */
export function csvFilename(parts: readonly (string | number)[], stamp: string): string {
  const segments = [PREFIX, ...parts, stamp].map(slug).filter((part) => part.length > 0)
  return `${segments.join('-')}.csv`
}
