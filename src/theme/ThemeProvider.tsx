import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ecrireStockage, effacerStockage, lireStockage } from '@/lib/stockage'

/**
 * Préférence de thème.
 *
 * `auto` n'est PAS une troisième palette : c'est l'absence de choix, qui laisse
 * `prefers-color-scheme` décider en CSS pur. C'est aussi le seul état qui suit
 * l'utilisateur quand il bascule son système en cours de session, sans qu'on
 * ait à écouter quoi que ce soit — la requête média s'en charge.
 */
export const THEMES = ['auto', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

const DEFAULT_THEME: Theme = 'auto'

/**
 * Clé partagée avec le script d'amorçage de `index.html`.
 *
 * Les deux doivent rester d'accord : le script pose l'attribut avant le premier
 * rendu, ce provider le repose ensuite à l'identique. Changer la clé ici sans
 * la changer là-bas ne casse rien de visible tout de suite — le thème choisi
 * réapparaîtrait simplement après un éclair de clair, ce qui est précisément le
 * défaut qu'on cherche à éviter.
 */
const STORAGE_KEY = 'gestlocpro.theme'

/** L'attribut que lisent les sélecteurs `[data-theme]` de `tokens.css`. */
const ATTRIBUTE = 'data-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = lireStockage('local', STORAGE_KEY)
  return stored && (THEMES as readonly string[]).includes(stored)
    ? (stored as Theme)
    : DEFAULT_THEME
}

/**
 * `auto` RETIRE l'attribut au lieu de le poser à une valeur neutre.
 *
 * `tokens.css` distingue trois états par la seule présence de l'attribut :
 * absent, la requête média s'applique ; présent, elle est court-circuitée. Un
 * `data-theme="auto"` laissé en place ne serait donc pas neutre — il ne
 * correspondrait à aucun sélecteur, et le système redeviendrait muet.
 */
function appliquerTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  if (theme === 'auto') document.documentElement.removeAttribute(ATTRIBUTE)
  else document.documentElement.setAttribute(ATTRIBUTE, theme)
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    appliquerTheme(theme)
    // `auto` efface la clé plutôt que d'écrire « auto » : un stockage vide et un
    // stockage à « auto » veulent dire la même chose, et le script d'amorçage
    // n'a alors qu'un seul cas à traiter.
    if (theme === 'auto') effacerStockage('local', STORAGE_KEY)
    else ecrireStockage('local', STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme doit être utilisé dans un <ThemeProvider>')
  return context
}
