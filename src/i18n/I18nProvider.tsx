import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales'
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
  t: (key: MessageKey, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'gestlocpro.locale'

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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    window.localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])

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

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

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
