import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CURRENCIES,
  CURRENCY_DEFS,
  DEFAULT_CURRENCY,
  formatMoney,
  formatMoneyCompact,
  type CurrencyCode,
  type CurrencyDef,
  type FormatMoneyOptions,
} from './currencies'

interface CurrencyContextValue {
  currency: CurrencyCode
  definition: CurrencyDef
  setCurrency: (currency: CurrencyCode) => void
  /** Formate un montant dans la devise active. */
  money: (amount: number, options?: FormatMoneyOptions) => string
  /** Variante compacte pour les axes de graphe. */
  moneyCompact: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'gestlocpro.currency'

function readStoredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored && (CURRENCIES as readonly string[]).includes(stored)
    ? (stored as CurrencyCode)
    : DEFAULT_CURRENCY
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(readStoredCurrency)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, currency)
  }, [currency])

  const setCurrency = useCallback((next: CurrencyCode) => setCurrencyState(next), [])

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      definition: CURRENCY_DEFS[currency],
      setCurrency,
      money: (amount, options) => formatMoney(amount, currency, options),
      moneyCompact: (amount) => formatMoneyCompact(amount, currency),
    }),
    [currency, setCurrency],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency doit être utilisé dans un <CurrencyProvider>')
  return context
}

/** Raccourci : `const money = useMoney()` puis `money(1415000)`. */
export function useMoney() {
  return useCurrency().money
}
