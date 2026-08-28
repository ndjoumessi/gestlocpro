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
  convertir,
  formatMoney,
  parseMoney,
  type CurrencyCode,
  type CurrencyDef,
  type FormatMoneyOptions,
} from './currencies'
import { api } from '@/api/client'

interface CurrencyContextValue {
  /** La devise DEMANDÉE pour l'affichage. */
  currency: CurrencyCode
  definition: CurrencyDef
  setCurrency: (currency: CurrencyCode) => void
  /**
   * La devise dans laquelle les DONNÉES sont tenues — celle du parc.
   *
   * Elle est déclarée par la coquille applicative, qui seule connaît
   * l'adhésion. Tout montant du produit arrive dans cette devise ; c'est le
   * point de départ de toute conversion, et la valeur de repli quand aucun
   * cours ne permet d'atteindre celle qu'on demande.
   */
  deviseSource: CurrencyCode
  setDeviseSource: (currency: CurrencyCode) => void
  /**
   * La devise réellement RENDUE : celle qu'on demande si l'on sait y aller,
   * celle du parc sinon. Un écran ne mélange jamais les deux.
   */
  deviseAffichee: CurrencyCode
  /** Les devises atteignables depuis celle du parc, cours en main. */
  devisesAtteignables: readonly CurrencyCode[]
  /** Jour de publication des cours flottants, `null` si le flux n'a rien rendu. */
  dateDesCours: string | null
  /** `true` quand ce qui s'affiche a été converti — donc daté, donc à dire. */
  converti: boolean
  /**
   * `true` quand on a DEMANDÉ une devise qu'aucun cours ne permet d'atteindre.
   *
   * C'est le seul état où le produit n'obéit pas, et il doit donc se voir. Sans
   * lui, le sélecteur enregistrait le choix, l'écran restait dans la devise du
   * parc, et rien n'expliquait pourquoi — un contrôle qui a l'air cassé.
   */
  coursIndisponibles: boolean
  /** Demande les cours maintenant — à l'ouverture du sélecteur, par exemple. */
  chargerLesCours: () => void
  /** Formate un montant, DONNÉ DANS LA DEVISE DU PARC, dans celle qu'on affiche. */
  money: (amount: number, options?: FormatMoneyOptions) => string
  /**
   * Lit un montant saisi, selon les conventions de la devise active.
   * Rend `null` quand la saisie ne contient aucun nombre lisible.
   */
  parseAmount: (input: string) => number | null
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
  /**
   * La devise du parc, jusqu'à ce que la coquille la déclare.
   *
   * Le franc CFA par défaut : c'est la devise du jeu de démonstration et celle
   * du marché visé. Une valeur neutre n'existe pas — il faut bien lire les
   * montants dans quelque chose — et se tromper vers le marché principal est le
   * moindre des deux torts.
   */
  const [deviseSource, setDeviseSource] = useState<CurrencyCode>(DEFAULT_CURRENCY)
  const [cours, setCours] = useState<{ date: string | null; parEuro: Partial<Record<string, number>> }>(
    { date: null, parEuro: {} },
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, currency)
  }, [currency])

  /*
    ═══ LES COURS NE SONT DEMANDÉS QUE SI L'ON CONVERTIT ═══

    Une première rédaction les chargeait au montage, donc sur CHAQUE page — la
    vitrine comprise, où il n'y a rien à convertir : ses prix sont écrits à la
    main pour chaque devise. `poids-ecrans` l'a refusé, et sa règle est juste :
    « les octets se rapportent, les requêtes se refusent ». Une requête de plus
    sur le premier écran d'un prospect, pour un service dont il n'a pas besoin,
    ne se rattrape pas.

    Ils partent donc quand la devise demandée diffère de celle du parc,
    c'est-à-dire au premier changement — et jamais sur le chemin par défaut, où
    l'on lit le parc dans sa propre monnaie.

    LEUR ÉCHEC NE FAIT RIEN TOMBER. Un écran qui attendrait les cours pour
    peindre ferait dépendre l'affichage d'un tiers ; un écran qui les exigerait
    ne s'afficherait pas du tout le jour où le flux est en panne. Leur absence se
    lit comme « aucune conversion possible » : la devise du parc, qui est de
    toute façon celle des données.
  */
  const [demande, setDemande] = useState(false)
  const coursConnus = Object.keys(cours.parEuro).length > 0
  /* On charge dès qu'on DEMANDE une autre devise, et dès qu'on ouvre le
     sélecteur : sans le second, la liste ne saurait pas ce qu'elle peut
     offrir avant qu'on ait déjà choisi. */
  const besoinDeCours = demande || currency !== deviseSource
  const chargerLesCours = useCallback(() => setDemande(true), [])

  useEffect(() => {
    if (!besoinDeCours || coursConnus) return
    let vivant = true
    void api
      .rates()
      .then((recu) => {
        if (vivant) setCours(recu)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [besoinDeCours, coursConnus])

  const setCurrency = useCallback((next: CurrencyCode) => setCurrencyState(next), [])

  const value = useMemo<CurrencyContextValue>(() => {
    /* Atteignable = il existe un cours pour la source ET pour la cible. La
       source elle-même l'est toujours : ne pas convertir est toujours possible. */
    const devisesAtteignables = CURRENCIES.filter(
      (code) => code === deviseSource || convertir(0, deviseSource, code, cours.parEuro) !== null,
    )
    const deviseAffichee = devisesAtteignables.includes(currency) ? currency : deviseSource
    const converti = deviseAffichee !== deviseSource

    return {
      currency,
      definition: CURRENCY_DEFS[deviseAffichee],
      setCurrency,
      deviseSource,
      setDeviseSource,
      deviseAffichee,
      devisesAtteignables,
      dateDesCours: cours.date,
      converti,
      coursIndisponibles: currency !== deviseAffichee,
      chargerLesCours,
      money: (amount, options) => {
        const montant = convertir(amount, deviseSource, deviseAffichee, cours.parEuro)
        /* `convertir` ne rend `null` que si un cours manque, ce que
           `deviseAffichee` a déjà écarté. Le repli sur le montant d'origine est
           donc mort — et il vaut mieux qu'une exception : un écran ne doit pas
           tomber parce qu'un cours a disparu entre deux rendus. */
        return formatMoney(montant ?? amount, deviseAffichee, options)
      },
      parseAmount: (input) => {
        const lu = parseMoney(input, deviseAffichee)
        /* LA SAISIE REVIENT DANS LA DEVISE DU PARC, parce que c'est elle qu'on
           enregistre. Saisir « 100 € » sur un parc de Douala doit écrire des
           francs : sans ce retour, le montant partirait au serveur avec la
           valeur d'un euro et l'étiquette d'un franc. */
        return lu === null ? null : convertir(lu, deviseAffichee, deviseSource, cours.parEuro)
      },
    }
  }, [currency, deviseSource, cours, setCurrency, chargerLesCours])

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
