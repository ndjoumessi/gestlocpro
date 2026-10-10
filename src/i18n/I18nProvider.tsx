import { effacerStockage, ecrireStockage, lireStockage } from '@/lib/stockage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DATE_LOCALE, DEFAULT_LOCALE, LOCALES, resolveDateLocale, type Locale } from './locales'
import { fr } from './fr'
import type { frApp } from './fr-app'
import type { frLegal } from './fr-legal'

/**
 * UN dictionnaire reste impatient, l'autre devient paresseux — pas les deux.
 *
 * MESURÉ avant ce lot : `fr.ts` pèse 27 274 o gzip, `en.ts` 17 879 o, tous
 * deux dans le paquet impatient de la vitrine, pour toute adresse et toute
 * langue. `readStoredLocale`, plus bas, déterminE déjà la langue de façon
 * SYNCHRONE — `localStorage` ou `navigator.language`, jamais de réseau — donc
 * rien n'empêchait techniquement de rendre n'importe lequel des deux
 * paresseux. Le choix n'est pas arbitraire pour autant :
 *
 *  - `fr` sert de REPLI RUNTIME pour toute clé absente d'`en` (`?? resolve(fr,
 *    key)`, plus bas) et pour la catégorie plurielle absente. Le rendre
 *    paresseux romprait ce repli pour LES DEUX langues pendant son
 *    chargement, pas seulement pour le français.
 *  - `MessageKey` — le typage qui vérifie chaque appel à `t()` à la
 *    compilation — est dérivé de `typeof fr`. Cette dépendance est un import
 *    de TYPE, erasé à la compilation, donc indépendant de la paresse ; mais
 *    `fr` reste la source de vérité que `en.ts` type-checke déjà contre lui
 *    (voir l'en-tête de `fr.ts`), et la garder impatiente garde le rôle de
 *    référence lisible sans détour.
 *  - `index.html` porte `lang="fr"` en valeur d'amorçage, et le marché visé
 *    est francophone (voir `index.html`) : c'est la langue qu'un premier
 *    visiteur voit le plus souvent, celle qui ne doit jamais attendre.
 *
 * MESURÉ ENSUITE, réseau bridé (Slow 3G — 500 kb/s, 400 ms de latence, le bas
 * du marché visé), sur `/`, moyenne de cinq passages :
 *
 *                                        AVANT ce lot      APRÈS ce lot
 *   fr-FR   premier texte peint            3298 ms          3063 ms
 *   en-US   premier texte peint (*)        3295 ms          3072 ms
 *   en-US   texte ANGLAIS peint            3295 ms          3930 ms
 *
 * (*) Avant ce lot, « premier texte peint » et « texte anglais peint »
 * coïncidaient : les deux dictionnaires arrivaient ensemble. Depuis ce lot,
 * ils divergent pour un visiteur anglophone — c'est tout le sujet de cette
 * troisième ligne.
 *
 * Le français gagne PARTOUT, sans contrepartie : 235 ms de moins, aucun repli
 * à gérer, `fr` n'a pas changé de statut. L'anglais est le VRAI échange : le
 * premier texte peint arrive plus vite qu'avant (le paquet impatient a
 * maigri de 129 Ko) — mais c'est le repli français qui s'affiche, pas
 * l'anglais demandé. Le texte anglais lui-même met 635 ms de PLUS qu'avant à
 * apparaître (+19 %), le temps que le paquet paresseux arrive derrière le
 * bundle principal — `chargerAnglais`, plus bas, le démarre dès l'évaluation
 * du module plutôt que dans un effet, mais ne peut pas s'exécuter avant que
 * CE module lui-même ait fini d'arriver, ce qui borne ce qu'un simple
 * réordonnancement peut gagner ici.
 *
 * CE QUE CET ÉCART VOULAIT DIRE — ET POURQUOI CE N'ÉTAIT PAS LE BON ARBITRAGE.
 *
 * Le paragraphe ci-dessus, tel qu'écrit par le lot qui a introduit la
 * paresse, ACCEPTAIT le repli français comme prix du gain. Un lot suivant l'a
 * corrigé : ce repli n'était pas un état de CHARGEMENT, c'était un état FAUX —
 * la page affichait une langue que personne n'avait demandée. Et les chiffres
 * ci-dessus le disent déjà, mal lus : le texte anglais met 3930 ms à
 * apparaître QUE le repli français s'affiche entre-temps ou non — comparer
 * les deux dernières lignes du tableau à la ligne « AVANT ce lot » du haut
 * montre que le repli n'accélère RIEN d'observable pour l'anglais, il fait
 * seulement mentir l'écran pendant ~850 ms. Un échange qui ne paie rien ne
 * mérite pas d'être gardé au nom du gain qu'il prétend financer.
 *
 * LA CORRECTION, plus bas dans `t()` : `dictionary === null` — c'est-à-dire
 * `locale === 'en'` avant que son paquet n'arrive, le SEUL cas où ça peut se
 * produire — rend `''`, jamais le français. Rien d'autre ne change : ni la
 * mise en page, ni le logo (`Logo.tsx` : « le nom de marque ne se traduit
 * pas », il ne passe jamais par `t()`), ni la structure de la page — seul le
 * TEXTE issu de `t()` attend. Pas d'écran de chargement plein cadre : ce
 * serait remplacer un défaut par un autre, en retirant ce qui s'affichait
 * déjà correctement pour repeindre un état d'attente par-dessus.
 *
 * REMESURÉ après cette correction, même protocole, même réseau bridé :
 *
 *   fr-FR   texte français peint         3049 ms   (inchangé — ce chemin ne
 *                                                    traverse jamais `dictionary
 *                                                    === null`, donc rien à y
 *                                                    corriger ni à y perdre)
 *   en-US   texte anglais peint          3934 ms   (inchangé — la ligne « AVANT
 *                                                    ce lot » valait 3295 ms
 *                                                    SANS paresse, 3930 ms AVEC ;
 *                                                    ce lot ne touche ni l'une ni
 *                                                    l'autre, seulement ce qui
 *                                                    s'affiche PENDANT l'attente)
 *
 * Confirmé aussi par un balayage dédié (échantillonnage toutes les 15 ms
 * jusqu'à l'apparition du texte anglais) : le français n'apparaît JAMAIS à
 * l'écran d'un visiteur anglophone, à aucun instant de la séquence. Le
 * français garde son gain intégral (3298 → 3063 ms, lot précédent), sans
 * qu'aucune attente n'y soit ajoutée par cette correction — `dictionary`
 * vaut toujours `fr`, jamais `null`, sur ce chemin.
 */
/*
  `object` ET NON `Dictionary` : ce que `./en` exporte est désormais la MOITIÉ
  vitrine, et la forme entière n'existe qu'une fois les deux réunies. Le typage
  fin vit là où il sert — `en.ts` est typé `DictionaryVitrine`, `en-app.ts`
  `DictionaryApp`, tous deux dérivés du français. Ici on ne transporte qu'un
  objet dont `t()` lira des chemins, exactement comme `francais`.
*/
let promesseAnglais: Promise<object> | null = null
/**
 * Exportée pour `src/test/render.tsx` : c'est le seul repère stable qu'un
 * test puisse attendre avant d'asserter sur du texte anglais, la promesse
 * étant PARTAGÉE avec l'effet du fournisseur ci-dessous — même raison que le
 * `data-testid` de `ChargementEspaceApplicatif` dans `App.tsx`, sous une
 * forme différente parce qu'ici rien ne doit apparaître dans le DOM.
 */
export function chargerAnglais(): Promise<object> {
  promesseAnglais ??= import('./en').then((module) => {
    vitrineAnglaise = module.en
    recomposerAnglais()
    return module.en
  })
  /*
    SI L'ESPACE APPLICATIF EST DÉJÀ LÀ, L'ANGLAIS DOIT ARRIVER ENTIER.

    C'est le cas de la bascule TARDIVE : un utilisateur déjà dans un écran
    passe au français vers l'anglais. `chargerEspaceApplicatif` est passé il y a
    longtemps et ne repassera pas, donc personne d'autre ne demanderait la
    moitié applicative — et `t('app.…')` rendrait `''` sur un tableau de bord
    déjà peint. L'invariant du fournisseur (`locale` n'avance que muni du
    dictionnaire) s'étend ainsi à la seconde moitié, sans l'affaiblir.
  */
  return chargeursAnglaisDemandes.length > 0
    ? Promise.all([promesseAnglais, ...chargeursAnglaisDemandes.map((c) => c())]).then(
        ([vitrine]) => vitrine,
      )
    : promesseAnglais
}

let promesseAnglaisApplicatif: Promise<object> | null = null

/**
 * LA MOITIÉ APPLICATIVE ANGLAISE — et pourquoi elle ne se dépose pas comme la
 * française.
 *
 * `fr-app` arrive par un import STATIQUE depuis `EspaceApplicatif.tsx` : la
 * sémantique d'un import garantit que le module est évalué avant le premier
 * rendu, donc rien à attendre et aucun re-rendu à déclencher. La même recette
 * mettrait ici les mots ANGLAIS dans le morceau que les utilisateurs FRANÇAIS
 * téléchargent — voir l'en-tête de `en-app.ts`.
 *
 * La moitié anglaise arrive donc par son propre `import()`, joint à la promesse
 * de l'espace applicatif dans `chargerEspaceApplicatif` (`App.tsx`). Les deux
 * partent dans le même battement, derrière la même frontière `Suspense` : aucun
 * écran ne se rend avant ses mots, et le temps au mur ne bouge pas puisque le
 * morceau applicatif est 6,4 fois plus gros.
 */
export function chargerAnglaisApplicatif(): Promise<object> {
  promesseAnglaisApplicatif ??= import('./en-app').then((module) => {
    poserDictionnaireApplicatifAnglais(module.enApp)
    return module.enApp
  })
  return promesseAnglaisApplicatif
}

/**
 * LA MOITIÉ JURIDIQUE ANGLAISE — même raison et même chemin que l'applicative.
 */
let promesseAnglaisJuridique: Promise<object> | null = null

export function chargerAnglaisJuridique(): Promise<object> {
  promesseAnglaisJuridique ??= import('./en-legal').then((module) => {
    poserSectionAnglaise(module.enLegal)
    return module.enLegal
  })
  return promesseAnglaisJuridique
}

/**
 * LES MOITIÉS ANGLAISES RÉCLAMÉES JUSQU'ICI.
 *
 * Chaque frontière paresseuse d'`App.tsx` se signale en partant et reçoit en
 * retour la promesse à joindre à la sienne. La liste sert deux fois : à rendre
 * cette promesse-là, et à faire en sorte qu'une bascule TARDIVE vers l'anglais
 * réclame TOUTES les moitiés déjà ouvertes — sans quoi un utilisateur passé à
 * l'anglais depuis une page juridique y lirait des trous.
 *
 * LA CONDITION EST `promesseAnglais`, ET NON LA LANGUE STOCKÉE. Elle vaut non
 * nulle exactement quand l'anglais a été demandé une fois — par le stockage au
 * démarrage ou par une bascule. Un utilisateur français ne paie donc NI octet
 * NI requête pour des mots qu'il ne lira pas, ce qui est tout l'objet du lot.
 */
const chargeursAnglaisDemandes: (() => Promise<object>)[] = []

function signalerMoitieAnglaise(chargeur: () => Promise<object>): Promise<unknown> {
  if (!chargeursAnglaisDemandes.includes(chargeur)) chargeursAnglaisDemandes.push(chargeur)
  return promesseAnglais ? chargeur() : Promise.resolve()
}

/** `chargerEspaceApplicatif` (`App.tsx`) le dit en partant. */
export function signalerEspaceApplicatif(): Promise<unknown> {
  return signalerMoitieAnglaise(chargerAnglaisApplicatif)
}

/** `chargerPagesJuridiques` (`App.tsx`) le dit en partant. */
export function signalerPagesJuridiques(): Promise<unknown> {
  return signalerMoitieAnglaise(chargerAnglaisJuridique)
}

/**
 * LE DICTIONNAIRE DES ÉCRANS EST POSÉ PAR LE MORCEAU QUI LES PORTE.
 *
 * ═══ POURQUOI UN DÉPÔT, ET NON UNE PROMESSE ═══
 *
 * La première rédaction de ce lot chargeait `fr-app.ts` par son propre
 * `import()`, joint aux promesses des deux frontières paresseuses. Ça marchait,
 * et `poids-ecrans` l'a REFUSÉ, avec le nombre qui tranche :
 *
 *     /demo@1280 : 2 → 3 REQUÊTES
 *     /          : −26 622 o sur le fil, −532 ms à 400 kb/s
 *     /demo      : +28 090 o sur le fil, +562 ms, PLUS un aller-retour
 *
 * « Les octets se rapportent ; les requêtes se refusent » — un aller-retour
 * coûte 300 à 800 ms sur le réseau visé, quoi qu'il transporte. L'échange
 * revenait à faire payer ceux qui SE SERVENT du produit pour accélérer ceux qui
 * le regardent. Ce dépôt a déjà refusé trois `lazy()` pour cette raison exacte.
 *
 * `EspaceApplicatif.tsx` importe donc `fr-app` STATIQUEMENT et appelle
 * `poserDictionnaireApplicatif` à l'évaluation de son module. Rollup range les
 * mots dans le morceau applicatif, que l'écran télécharge de toute façon : la
 * vitrine garde son gain entier, l'application ne paie ni octet ni requête de
 * plus, et il n'y a plus rien à attendre — le module est évalué avant que le
 * premier écran ne se rende, c'est la sémantique d'un import.
 *
 * `francais` est RECOMPOSÉ une fois, au dépôt, et non à chaque appel de `t()` :
 * étaler trois mille clés par traduction serait un coût par mot rendu.
 *
 * AUCUN RE-RENDU N'EST DÉCLENCHÉ, et il ne doit pas l'être. Les seuls modules
 * qui lisent `app.*` vivent dans le morceau qui vient de poser le dictionnaire —
 * quand ils se rendent, la fusion a déjà eu lieu. Poser un état React ici ferait
 * repeindre tout l'arbre pour un changement que personne ne peut observer.
 *
 * ET CE QUI GARDE TOUT ÇA : `check-dictionnaire-impatient.mjs` refuse qu'un
 * module du paquet d'entrée cite `app.*` ou importe `fr-app`, et
 * `dictionnaireApplicatif.test.tsx` refuse que le morceau applicatif oublie de
 * déposer ses mots.
 */
/**
 * LES SECTIONS FRANÇAISES DIFFÉRÉES, et il y en a PLUSIEURS depuis le 2026-10-10.
 *
 * `poserDictionnaireApplicatif` écrivait `francais = { ...fr, ...section }` :
 * juste tant qu'il n'y en avait qu'une, faux dès la deuxième — chaque dépôt
 * repartait de `fr` et effaçait le précédent. Les sections s'accumulent donc, et
 * `francais` se recompose à chaque arrivée.
 *
 * UNE SECTION NE S'EMPILE PAS DEUX FOIS. `src/test/setup.ts` les dépose à
 * l'évaluation du module, et un rechargement à chaud rejouerait ce module : sans
 * ce garde-fou le tableau grossirait sans fin pour un résultat identique.
 *
 * LA FUSION EST DE SURFACE, et c'est ce qui dicte le découpage : deux moitiés
 * qui porteraient la même clé de premier niveau s'écraseraient au lieu de se
 * compléter. C'est pourquoi les quatre clés que le paquet d'entrée doit lire —
 * les trois liens juridiques du pied de page et l'indice du sommaire — ont
 * changé de SECTION plutôt que de rester dans `legal`, `privacy` et `terms` :
 * `nav` et `common` restent entières dans `fr.ts`, et les trois sections
 * juridiques partent entières.
 */
const sectionsDifferees: object[] = []
let francais: object = fr

function recomposerFrancais(): void {
  francais = Object.assign({}, fr, ...sectionsDifferees)
}

export function poserDictionnaireApplicatif(section: object): void {
  poserSectionFrancaise(section)
}

export function poserSectionFrancaise(section: object): void {
  if (sectionsDifferees.includes(section)) return
  sectionsDifferees.push(section)
  recomposerFrancais()
}

/**
 * LE DICTIONNAIRE ANGLAIS VIT AU MODULE, comme le français, et pour la même
 * raison : la fusion des deux moitiés se paie UNE FOIS, au dépôt, et non à
 * chaque appel de `t()`.
 *
 * Il valait auparavant un état React, parce qu'il n'avait qu'une moitié et que
 * son arrivée devait faire avancer `locale`. Ce rôle-là reste à un état — mais
 * un BOOLÉEN désormais (`anglaisPret`), parce qu'une seconde moitié peut
 * arriver plus tard et qu'un état porteur de la première l'aurait masquée.
 *
 * `null` tant que l'anglais n'est pas chargé : c'est le seul cas où `t()` rend
 * `''`, et le fournisseur le rend injoignable après le premier rendu en
 * retenant `locale` au français jusqu'à l'arrivée du dictionnaire.
 */
let anglais: object | null = null
let vitrineAnglaise: object | null = null
const sectionsAnglaises: object[] = []

/**
 * LES DEUX MOITIÉS SE RÉUNISSENT DANS N'IMPORTE QUEL ORDRE.
 *
 * Le premier jet écrivait `if (anglais) anglais = { ...anglais, ...section }` :
 * un dépôt arrivé AVANT le chargement de la vitrine était jeté en silence. Ça
 * ne se voyait pas en production, où `chargerEspaceApplicatif` joint les deux
 * promesses et où la vitrine gagne toujours — mais `src/test/setup.ts` dépose
 * les sections à l'évaluation du module, donc avant tout chargement, et quatorze
 * cas sont tombés d'un coup. Le français n'avait pas ce défaut parce que sa
 * vitrine est un import statique, présente dès le départ.
 *
 * Garder les deux moitiés SÉPARÉMENT et recomposer à chaque arrivée supprime
 * l'ordre du problème. La fusion reste payée une fois par arrivée, jamais par
 * appel de `t()`.
 *
 * `anglais` reste `null` tant que la VITRINE manque : c'est le seul cas où
 * `t()` rend `''`, et le fournisseur le rend injoignable après le premier rendu
 * en retenant `locale` au français jusque-là. Une moitié applicative seule ne
 * suffit donc pas à déclarer l'anglais prêt.
 */
function recomposerAnglais(): void {
  anglais = vitrineAnglaise ? Object.assign({}, vitrineAnglaise, ...sectionsAnglaises) : null
}

export function poserDictionnaireApplicatifAnglais(section: object): void {
  poserSectionAnglaise(section)
}

export function poserSectionAnglaise(section: object): void {
  if (sectionsAnglaises.includes(section)) return
  sectionsAnglaises.push(section)
  recomposerAnglais()
}

/**
 * REND UN ÉTAT DE PREMIER CHARGEMENT — réservé aux cas qui éprouvent l'attente.
 *
 * ═══ POURQUOI CETTE FONCTION A DÛ EXISTER ═══
 *
 * Le dictionnaire anglais vivait dans un état React, qui repart à zéro à chaque
 * montage. Il vit au module depuis la scission du 2026-10-10, parce qu'il a
 * deux moitiés et qu'un état porteur de la première masquerait la seconde — et
 * une variable de module SURVIT d'un cas au suivant dans un même fichier.
 *
 * En production la différence est invisible : il n'y a qu'un montage par
 * chargement de page, et `anglais` y est toujours nul au départ. Mieux même —
 * un remontage ultérieur affiche désormais l'anglais SANS repasser par le fond
 * uni, là où l'ancienne rédaction imposait une attente pour un dictionnaire
 * déjà en mémoire. L'invariant tenu n'a pas bougé : le sous-arbre ne se monte
 * jamais avec du français ni du vide quand l'anglais est demandé.
 *
 * ═══ CE QU'ELLE N'EFFACE PAS, ET C'EST VOULU ═══
 *
 * `sectionsAnglaises` reste en place. `src/test/setup.ts` les dépose une fois pour
 * tous les cas, comme le morceau applicatif le fait en production ; l'effacer
 * ici obligerait chaque appelant à la reposer, et modéliserait un état qui
 * n'existe pas — une application chargée sans ses mots.
 */
export function oublierLAnglaisCharge(): void {
  vitrineAnglaise = null
  promesseAnglais = null
  promesseAnglaisApplicatif = null
  promesseAnglaisJuridique = null
  chargeursAnglaisDemandes.length = 0
  recomposerAnglais()
}

/** Chemins pointés valides, dérivés du dictionnaire français. */
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never

type Paths<T> = T extends object
  ? { [K in keyof T]-?: K extends string ? K | Join<K, Paths<T[K]>> : never }[keyof T]
  : never

type LeafPaths<T> = T extends object
  ? {
      [K in keyof T]-?: T[K] extends string ? (K extends string ? K : never) : Join<K, LeafPaths<T[K]>>
    }[keyof T]
  : never

/**
 * Les deux moitiés du dictionnaire français, réunies — voir `fr-app.ts`.
 *
 * Le TYPE reste entier des deux côtés de la frontière de chargement, et c'est
 * délibéré : un écran applicatif nomme `app.portfolio.title` sans avoir à savoir
 * que ces mots arrivent par un autre morceau. Ce que le typage ne peut donc PAS
 * dire, c'est qu'un module du paquet d'entrée n'a pas le droit d'y toucher —
 * `check-dictionnaire-impatient.mjs` est la garde qui le dit à sa place.
 */
export type MessageKey = LeafPaths<typeof fr & typeof frApp & typeof frLegal>

export type TranslateVars = Record<string, string | number>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /**
   * Code pays à deux lettres, choisi à l'inscription. Il ne sert qu'au
   * formatage — dates, et plus tard nombres — et non à la traduction : la
   * langue reste un choix distinct du pays.
   */
  region: string | null
  setRegion: (region: string | null) => void
  /** Étiquette BCP-47 dérivée de la langue et du pays. */
  dateLocale: string
  t: (key: MessageKey, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'gestlocpro.locale'
const REGION_KEY = 'gestlocpro.region'

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = lireStockage('local', STORAGE_KEY)
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale

  const browser = window.navigator.language.slice(0, 2)
  return (LOCALES as readonly string[]).includes(browser) ? (browser as Locale) : DEFAULT_LOCALE
}

/*
 * Démarré ICI, à l'évaluation du module — pas dans un effet.
 *
 * Un effet n'arrive qu'après le premier rendu commis, donc après la première
 * peinture : demander le paquet paresseux à ce moment-là ajouterait la durée
 * du rendu initial au-dessus de l'aller-retour réseau, pour rien. La langue
 * est déjà connue de façon synchrone (`readStoredLocale`, juste au-dessus) —
 * autant lancer la requête au plus tôt que le module s'évalue.
 */
if (readStoredLocale() === 'en') chargerAnglais()

function resolve(dictionary: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), dictionary)
  return typeof value === 'string' ? value : undefined
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

function readStoredRegion(): string | null {
  if (typeof window === 'undefined') return null
  const stored = lireStockage('local', REGION_KEY)
  return stored && /^[A-Z]{2}$/.test(stored) ? stored : null
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)
  const [region, setRegionState] = useState<string | null>(readStoredRegion)
  /*
    UN BOOLÉEN, ET NON LE DICTIONNAIRE. Cet état ne sert qu'à faire avancer
    `locale` et à repeindre l'arbre quand l'anglais arrive ; le dictionnaire
    lui-même vit au module, parce qu'il a DEUX moitiés et qu'un état porteur de
    la première masquerait la seconde.
  */
  const [anglaisPret, setAnglaisPret] = useState(false)

  /**
   * La langue DEMANDÉE, distincte de `locale` — la langue EFFECTIVE, celle
   * que `t()` et `children` emploient réellement.
   *
   * Elles ne divergent que dans un seul cas : `demandee === 'en'` alors que
   * `anglais` n'est pas encore chargé. Tant que ça dure, `locale` ne bouge
   * PAS — voir l'effet plus bas, qui ne le fait avancer QUE muni du
   * dictionnaire. Une bascule vers le français, elle, n'a jamais rien à
   * attendre : `locale` la suit dans le même battement.
   *
   * POURQUOI CETTE INDIRECTION, et pas `setLocale` posant `locale`
   * directement (comme avant ce lot) : un contenu déjà affiché — un tableau
   * de parc rempli, un texte français lu — ne doit JAMAIS être démonté pour
   * une bascule de langue (`chargement.test.tsx` le garde depuis un lot
   * antérieur : rouvrir un état de chargement sur des données déjà valides
   * EST une régression, pas un détail). Si `locale` passait à `'en'` avant
   * que son dictionnaire n'existe, `t()` retomberait sur `dictionary ===
   * null` en PLEIN milieu d'un arbre déjà monté — exactement le défaut que ce
   * lot corrige, mais réapparu par la porte de la bascule au lieu de celle du
   * premier rendu. En retardant `locale` lui-même, le contenu français reste
   * affiché, intact, jusqu'à ce que l'anglais soit prêt à le remplacer d'un
   * coup — jamais entre les deux.
   */
  const [demandee, setDemandee] = useState<Locale>(locale)

  useEffect(() => {
    document.documentElement.lang = locale
    ecrireStockage('local', STORAGE_KEY, locale)
  }, [locale])

  /*
   * Fait avancer `locale` vers `demandee` — immédiatement si rien à charger,
   * une fois `en.ts` arrivé sinon. Se déclenche au premier rendu (si la
   * langue stockée était déjà l'anglais, la requête est alors déjà en vol,
   * lancée à l'évaluation du module, plus haut) comme à toute bascule
   * ultérieure via `setLocale` — un seul mécanisme pour les deux moments.
   *
   * `setAnglais` et `setLocaleState('en')` dans le MÊME callback : React les
   * applique dans le même rendu, donc `locale` ne vaut jamais `'en'` sans que
   * `anglais` ne soit déjà posé — c'est ce qui rend `dictionary === null`
   * injoignable dans `t()` une fois le premier rendu passé.
   *
   * `annule` protège d'une réponse tardive après démontage ou après un
   * second changement de langue survenu avant que le premier n'ait résolu.
   */
  useEffect(() => {
    if (demandee !== 'en' || anglaisPret) {
      if (demandee !== locale) setLocaleState(demandee)
      return
    }
    let annule = false
    chargerAnglais().then(() => {
      if (annule) return
      setAnglaisPret(true)
      setLocaleState('en')
    })
    return () => {
      annule = true
    }
  }, [demandee, anglaisPret, locale])

  useEffect(() => {
    if (region) ecrireStockage('local', REGION_KEY, region)
    else effacerStockage('local', REGION_KEY)
  }, [region])

  const setLocale = useCallback((next: Locale) => setDemandee(next), [])
  const setRegion = useCallback((next: string | null) => setRegionState(next), [])

  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => {
      const dictionary = locale === 'en' ? anglais : francais

      /**
       * PENDANT LE CHARGEMENT DU DICTIONNAIRE PARESSEUX : AUCUN texte, plutôt
       * que le français en repli.
       *
       * Ce lot corrige exactement l'inverse de ce que ce commentaire disait
       * avant lui : se rabattre sur `fr` le temps que `en` arrive n'était pas
       * un état de chargement, c'était un état FAUX — la page affichait une
       * langue que personne n'avait demandée, mesuré à ~850 ms sans acheter
       * le moindre gain (le vrai texte anglais arrivait à la même vitesse
       * avec ou sans ce repli). `dictionary === null` ne peut se produire que
       * pour `locale === 'en'` avant que son paquet ne soit résolu — jamais
       * pour `fr`, impatient, jamais pour `en` déjà chargé — donc ce court-
       * circuit ne coûte rien à la langue impatiente ni au cas normal.
       *
       * DIFFÉRENT du repli plus bas (`?? resolve(fr, key)`) : celui-ci reste
       * intact pour une clé manquante DANS un dictionnaire déjà chargé — un
       * défaut de traduction, pas une fenêtre de chargement. Les deux ne
       * doivent pas se confondre : l'un protège d'un trou, l'autre annonçait
       * une langue qui n'était pas encore là.
       */
      if (dictionary === null) return ''

      /**
       * Accord en nombre.
       *
       * `t()` ne faisait que de l'interpolation : « {count} réserves » rendait
       * « 1 réserves ». La règle du pluriel dépend de la langue — le français
       * met au singulier à zéro (« 0 réserve »), l'anglais au pluriel
       * (« 0 issues ») — donc on la délègue à `Intl.PluralRules` plutôt que de
       * la coder à la main.
       *
       * Convention : une clé `x` peut porter des variantes `x_one`, `x_many`…
       * La clé de base reste la forme par défaut, ce qui garde les appels
       * existants valides et laisse le typage vérifier les chemins.
       */
      let template: string | undefined
      if (typeof vars?.count === 'number') {
        const category = new Intl.PluralRules(DATE_LOCALE[locale]).select(vars.count)
        template =
          resolve(dictionary, `${key}_${category}`) ?? resolve(francais, `${key}_${category}`)
      }

      // Repli sur le français plutôt que d'afficher une clé brute à l'écran.
      template ??= resolve(dictionary, key) ?? resolve(francais, key)

      if (template === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`)
        return key
      }
      return interpolate(template, vars)
    },
    /*
      `locale` SEUL, et le dictionnaire anglais n'y figure pas — ni la valeur,
      qui vit au module et n'est pas réactive, ni le booléen `anglaisPret`, que
      le linter a eu raison de refuser.

      CE N'EST PAS UNE CONCESSION AU LINTER : `t` lit `anglais` À L'APPEL, pas à
      sa création, donc il n'a jamais besoin d'être recréé pour voir une moitié
      qui vient d'arriver. Les trois moments où ce qu'il rend change sont
      couverts autrement :

        · bascule fr → en : `setAnglaisPret` et `setLocaleState('en')` partent
          dans le même callback, donc `locale` change et recrée `t` de toute façon ;
        · premier rendu sous l'anglais stocké : `children` n'est pas monté tant
          que le dictionnaire manque, donc personne n'appelle `t` avant ;
        · dépôt de la moitié applicative : aucun re-rendu n'est nécessaire, pour
          la raison exacte écrite du côté français — les seuls modules qui
          nomment `app.*` se rendent après la frontière `Suspense` qui a attendu
          ce dépôt.
    */
    [locale],
  )

  const dateLocale = resolveDateLocale(locale, region)

  const value = useMemo(
    () => ({ locale, setLocale, region, setRegion, dateLocale, t }),
    [locale, setLocale, region, setRegion, dateLocale, t],
  )

  /**
   * NE MONTE PAS `children` tant que le dictionnaire de LA LANGUE DEMANDÉE
   * n'est pas résolu.
   *
   * Un lot précédent laissait `t()` rendre `''` pendant ce temps, en gardant
   * `children` monté. MESURÉ, ce choix avait trois coûts que `mesure-ui` ne
   * peut pas voir — il mesure l'état stable, après résolution — et que ce lot
   * a mesurés au navigateur, réseau bridé, `en-US`, pendant la fenêtre
   * d'attente (~750 ms) :
   *
   *   noms accessibles vides    jusqu'à 6 `aria-label`/`alt` simultanés
   *   décalage de mise en page  0,147 de CLS (« à améliorer » au sens des
   *                             Core Web Vitals), un seul saut, au moment
   *                             précis où le texte arrive
   *   titre d'onglet            « — » (le tiret cadratin nu — `document.title`
   *                             normalise les espaces autour) pendant la
   *                             même fenêtre, au lieu du titre statique ou du
   *                             titre anglais
   *
   * Une chaîne vide n'est pas une absence : le DOM la porte quand même — un
   * `<nav aria-label="">` a perdu son nom, pas gagné le silence. Ne PAS
   * monter le sous-arbre évite les trois d'un coup, par construction : rien
   * n'est peint, donc rien ne porte d'attribut vide et rien ne se remplit
   * ensuite.
   *
   * `dictionnairePret` vaut TOUJOURS `true` pour `fr` — `anglais` n'entre
   * dans le calcul que si `locale === 'en'` — donc la langue impatiente ne
   * traverse jamais ce montage différé : zéro attente, zéro rendu
   * conditionnel sur son chemin.
   *
   * NE VAUT `false` QU'AU TOUT PREMIER RENDU — jamais à une bascule
   * ultérieure. `locale` (voir `demandee`, plus haut) n'atteint `'en'` que
   * lorsque `anglais` est DÉJÀ posé, sauf sur le rendu initial où
   * `readStoredLocale` peut l'y placer directement. Une bascule en cours de
   * page ne fait donc jamais tomber cette condition à `false` : le contenu
   * déjà affiché reste monté, intact, pendant que l'anglais charge en
   * arrière-plan — voir le commentaire de `demandee` pour la raison, dictée
   * par `chargement.test.tsx`.
   *
   * CE QUI RESTE AFFICHÉ : rien qui porte du texte ou une image à charger —
   * un fond uni, `bg-canvas`, la même couleur que ce sur quoi `children`
   * finira par peindre. Remesuré : le remplacement de ce fond par `children`
   * une fois prêt ne produit AUCUNE entrée `layout-shift` — un fond qui ne
   * bouge jamais ne peut pas se décaler à l'arrivée de ce qui le recouvre.
   * Le point d'arrivée du texte anglais est inchangé (~3930 ms, comme les
   * deux lots précédents) : ce lot ne fait que changer ce qui s'affiche
   * AVANT, jamais quand le vrai contenu arrive.
   */
  const dictionnairePret = locale !== 'en' || anglais !== null

  return (
    <I18nContext.Provider value={value}>
      {dictionnairePret ? children : <div aria-hidden="true" className="min-h-dvh bg-canvas" />}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n doit être utilisé dans un <I18nProvider>')
  return context
}

/** Raccourci : `const t = useT()` puis `t('nav.dashboard')`. */
export function useT() {
  return useI18n().t
}

export type { Paths }
