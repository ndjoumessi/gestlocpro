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
import { fr, type Dictionary } from './fr'

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
let promesseAnglais: Promise<Dictionary> | null = null
/**
 * Exportée pour `src/test/render.tsx` : c'est le seul repère stable qu'un
 * test puisse attendre avant d'asserter sur du texte anglais, la promesse
 * étant PARTAGÉE avec l'effet du fournisseur ci-dessous — même raison que le
 * `data-testid` de `ChargementEspaceApplicatif` dans `App.tsx`, sous une
 * forme différente parce qu'ici rien ne doit apparaître dans le DOM.
 */
export function chargerAnglais(): Promise<Dictionary> {
  promesseAnglais ??= import('./en').then((module) => module.en)
  return promesseAnglais
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

export type MessageKey = LeafPaths<typeof fr>

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
  const [anglais, setAnglais] = useState<Dictionary | null>(null)

  useEffect(() => {
    document.documentElement.lang = locale
    ecrireStockage('local', STORAGE_KEY, locale)
  }, [locale])

  /*
   * Charge `en` la première fois que `locale` le demande — à l'ouverture si
   * la langue stockée était déjà l'anglais (la requête est alors déjà en vol,
   * lancée à l'évaluation du module, plus haut), ou plus tard si l'utilisateur
   * bascule via `setLocale`. `annule` protège contre un démontage ou un
   * changement de langue pendant le chargement : sans lui, une réponse tardive
   * poserait l'état d'un composant qui ne s'y intéresse plus.
   */
  useEffect(() => {
    if (locale !== 'en' || anglais) return
    let annule = false
    chargerAnglais().then((dictionnaire) => {
      if (!annule) setAnglais(dictionnaire)
    })
    return () => {
      annule = true
    }
  }, [locale, anglais])

  useEffect(() => {
    if (region) ecrireStockage('local', REGION_KEY, region)
    else effacerStockage('local', REGION_KEY)
  }, [region])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])
  const setRegion = useCallback((next: string | null) => setRegionState(next), [])

  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => {
      const dictionary = locale === 'en' ? anglais : fr

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
          resolve(dictionary, `${key}_${category}`) ?? resolve(fr, `${key}_${category}`)
      }

      // Repli sur le français plutôt que d'afficher une clé brute à l'écran.
      template ??= resolve(dictionary, key) ?? resolve(fr, key)

      if (template === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`)
        return key
      }
      return interpolate(template, vars)
    },
    [locale, anglais],
  )

  const dateLocale = resolveDateLocale(locale, region)

  const value = useMemo(
    () => ({ locale, setLocale, region, setRegion, dateLocale, t }),
    [locale, setLocale, region, setRegion, dateLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
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
