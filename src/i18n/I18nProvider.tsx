import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_LOCALE, LOCALES, resolveDateLocale, type Locale } from './locales'
import { fr } from './fr'
import { en } from './en'

const DICTIONARIES = { fr, en } as const

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
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale

  const browser = window.navigator.language.slice(0, 2)
  return (LOCALES as readonly string[]).includes(browser) ? (browser as Locale) : DEFAULT_LOCALE
}

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
  const stored = window.localStorage.getItem(REGION_KEY)
  return stored && /^[A-Z]{2}$/.test(stored) ? stored : null
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)
  const [region, setRegionState] = useState<string | null>(readStoredRegion)

  useEffect(() => {
    document.documentElement.lang = locale
    window.localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    if (region) window.localStorage.setItem(REGION_KEY, region)
    else window.localStorage.removeItem(REGION_KEY)
  }, [region])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])
  const setRegion = useCallback((next: string | null) => setRegionState(next), [])

  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => {
      const dictionary = DICTIONARIES[locale]
      // Repli sur le français plutôt que d'afficher une clé brute à l'écran.
      const template = resolve(dictionary, key) ?? resolve(fr, key)
      if (template === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`)
        return key
      }
      return interpolate(template, vars)
    },
    [locale],
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
