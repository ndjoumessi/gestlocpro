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
  exigeUnFluxDeCours,
  formatMoney,
  parseMoney,
  tauxLisible,
  type CurrencyCode,
  type CurrencyDef,
  type FormatMoneyOptions,
  type TauxLisible,
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
   * Le montant CONVERTI, en unités mineures de la devise affichée — sans mise
   * en forme.
   *
   * Les exports en ont besoin : un tableur veut un nombre calculable, pas
   * « 39,55 € ». Ils appelaient jusqu'ici `enUniteDUsage` sur la devise
   * demandée, ce qui change l'échelle sans convertir — un parc de Douala lu en
   * euros exportait 259,42 pour 39,55 €, sous un en-tête annonçant des euros.
   */
  enDeviseAffichee: (amount: number, depuis?: CurrencyCode) => number
  /**
   * Le même, pour un montant dont la devise d'origine est DÉCLARÉE.
   *
   * Les DOCUMENTS en ont besoin : une pièce arrêtée par le serveur porte la
   * devise du parc AU MOMENT DE L'ÉMISSION, qui n'est pas forcément celle du
   * parc aujourd'hui. `money` suppose la seconde ; celle-ci ne suppose rien.
   */
  argentDepuis: (amount: number, depuis: CurrencyCode, options?: FormatMoneyOptions) => string
  /**
   * La base de la conversion, à écrire SUR la pièce — `null` s'il n'y en a pas.
   *
   * Une quittance convertie sans dire depuis quoi ni à quel taux affirme qu'on
   * a reçu des euros là où des francs ont été encaissés. C'est la différence
   * entre convertir et falsifier, et elle tient en une ligne de bas de page.
   *
   * LES TROIS TERMES : d'où, à quel taux, de quand. Cette promesse était écrite
   * ici et tenue aux deux tiers — le `taux` manquait, si bien qu'une pièce
   * archivée n'était plus recalculable par personne : le cours du 28/08/2026 ne
   * se repêche pas dans six mois par un lecteur qui n'a pas ce produit.
   */
  baseDeConversion: (
    depuis: CurrencyCode,
  ) => { depuis: CurrencyCode; date: string | null; taux: TauxLisible } | null
  /**
   * Lit un montant saisi, selon les conventions de la devise active.
   * Rend `null` quand la saisie ne contient aucun nombre lisible.
   */
  parseAmount: (input: string) => number | null
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'gestlocpro.currency'

/**
 * LES COURS SURVIVENT À L'ONGLET, ET C'EST LE POINT.
 *
 * ═══ LE DÉFAUT ═══
 *
 * Le client ne retenait rien. Chaque rechargement repartait sans cours, et la
 * moindre interruption — API redémarrée, réseau qui bronche, service déployé —
 * faisait retomber le dollar canadien et l'américain dans la monnaie du parc,
 * sous « Cours indisponibles ». Vu en capture sur les deux dollars à la fois,
 * quelques minutes après que le produit les eut servis.
 *
 * Le franc et l'euro ne bronchaient pas : leur parité est une constante que le
 * client tient. Le défaut ne frappait donc QUE les monnaies sans repli.
 *
 * ═══ POURQUOI SERVIR UN COURS D'HIER N'EST PAS MENTIR ═══
 *
 * Parce que l'écran DIT de quand il date. C'est la règle que `taux.ts` pose
 * déjà — « la réponse porte toujours sa DATE » — et elle vaut des deux côtés.
 * Le mensonge serait de servir un cours ancien en le faisant passer pour celui
 * du jour ; la perte sèche est de n'en servir aucun quand on en a un de la
 * veille.
 *
 * ═══ SEPT JOURS, ET LA RAISON DU CHIFFRE ═══
 *
 * La Banque centrale européenne publie chaque jour OUVRÉ : un cours du vendredi
 * est le cours courant jusqu'au lundi, et un pont de fin d'année ouvre quatre
 * jours sans publication. Sept jours couvrent la plus longue interruption
 * normale sans jamais couvrir une panne durable — au-delà, ce n'est plus « le
 * flux n'a pas publié », c'est « le flux est perdu », et l'aveu vaut mieux que
 * la conversion. Un cours d'il y a trois semaines sur un relevé de loyer est
 * faux, date ou pas : personne ne lit la mention avant le montant.
 */
const MEMOIRE_DES_COURS = 'gestlocpro.rates'
const AGE_MAXIMAL_JOURS = 7

type Cours = { date: string | null; parEuro: Partial<Record<string, number>> }

const SANS_COURS: Cours = { date: null, parEuro: {} }

/** Le jour courant en ISO, pour décider si les cours en mémoire sont d'aujourd'hui. */
const jourISO = () => new Date().toISOString().slice(0, 10)

/**
 * Ce qu'une session précédente a laissé, s'il est encore utilisable.
 *
 * TOUT ÉCHEC REND `null` PLUTÔT QUE DE LANCER. Un `localStorage` illisible —
 * navigation privée, quota, contenu d'une version antérieure du produit — ne
 * doit pas empêcher l'application de se monter : sans cours, on affiche la
 * monnaie du parc, ce que le produit sait déjà faire.
 */
function coursRetenus(): Cours | null {
  if (typeof window === 'undefined') return null
  try {
    const brut = window.localStorage.getItem(MEMOIRE_DES_COURS)
    if (!brut) return null
    const lu = JSON.parse(brut) as Cours
    if (typeof lu?.date !== 'string' || typeof lu?.parEuro !== 'object' || !lu.parEuro) return null

    const age = (Date.now() - Date.parse(`${lu.date}T00:00:00Z`)) / 86_400_000
    if (!Number.isFinite(age) || age > AGE_MAXIMAL_JOURS) return null
    return { date: lu.date, parEuro: lu.parEuro }
  } catch {
    return null
  }
}

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
  /* SEMÉ DEPUIS LA MÉMOIRE, et non vide : c'est ce qui fait qu'un rechargement
     ne perd pas les deux dollars. Une fonction d'initialisation et non une
     valeur — sans cela, `localStorage` serait lu à chaque rendu. */
  const [cours, setCours] = useState<Cours>(() => coursRetenus() ?? SANS_COURS)

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
  /*
    TROIS RAISONS DE DEMANDER, ET PAS UNE DE PLUS.

    On a demandé — le sélecteur s'ouvre, et la liste doit savoir ce qu'elle peut
    offrir. Ou l'on ne sait pas faire ce qui est demandé. Ou l'on sait le faire,
    mais avec un cours qui n'est pas du jour ET une paire qui dépend vraiment du
    flux.

    La condition interroge `convertir` plutôt que de comparer deux codes : la
    parité du franc CFA vit dans le client, donc un parc de Douala lu en euros
    n'a rien à demander à personne — sinon un visiteur ayant choisi l'euro une
    fois paierait une requête sur CHAQUE page, vitrine comprise.

    Et `exigeUnFluxDeCours` porte le même soin sur la fraîcheur : sans lui, ce
    même parc en euros redemanderait les cours chaque jour pour une constante de
    traité qui ne changera pas.
  */
  const parLeFlux = exigeUnFluxDeCours(deviseSource) || exigeUnFluxDeCours(currency)

  /*
    UNE RÉPONSE REÇUE ARRÊTE DE DEMANDER — et c'est un garde-fou, pas une
    optimisation.

    La condition ci-dessous compare la date des cours au jour courant. Or la
    Banque centrale ne publie pas le week-end : le dimanche, un cours du vendredi
    n'est PAS du jour et ne le deviendra jamais. Sans ce drapeau, la réponse du
    serveur relancerait donc la condition qui l'a demandée — une requête par
    rendu, en boucle, précisément le jour où le flux va bien.

    IL N'EST POSÉ QU'AU SUCCÈS. Un échec le laisse à faux, ce qui ne boucle pas
    pour autant : l'effet ne se rejoue que si `besoinDeCours` ou la raison de
    demander changent, et un échec ne change ni l'un ni l'autre. Ouvrir le
    sélecteur, lui, change la raison — et c'est ainsi qu'on retente après une API
    trouvée en train de redémarrer.

    Une PREMIÈRE rédaction employait une référence retenant la dernière
    signature tentée. Elle se retournait contre le double montage de
    `StrictMode` : la première passe lançait la requête et posait la référence,
    son démontage simulé invalidait la réponse, et la seconde passe se voyait
    refuser la requête par sa propre référence. Résultat mesuré au navigateur —
    aucun cours en développement, sur un poste où l'API répondait 200.
  */
  const [repondu, setRepondu] = useState(false)
  const besoinDeCours =
    !repondu &&
    (demande ||
      convertir(0, deviseSource, currency, cours.parEuro) === null ||
      (parLeFlux && cours.date !== jourISO()))
  const chargerLesCours = useCallback(() => setDemande(true), [])

  useEffect(() => {
    if (!besoinDeCours) return

    let vivant = true
    void api
      .rates()
      .then((recu) => {
        if (!vivant) return
        setCours(recu)
        setRepondu(true)
        /* ON NE RETIENT QUE CE QUI PORTE UNE DATE. Une réponse sans cours
           flottants ne contient que la parité, que le client tient déjà ; la
           garder écraserait des cours utilisables par rien du tout. */
        if (recu.date) {
          try {
            window.localStorage.setItem(MEMOIRE_DES_COURS, JSON.stringify(recu))
          } catch {
            /* Quota plein ou stockage refusé : la session courante garde ses
               cours en mémoire vive, la suivante les redemandera. */
          }
        }
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [besoinDeCours])

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
      argentDepuis: (amount, depuis, options) => {
        const montant = convertir(amount, depuis, deviseAffichee, cours.parEuro)
        return formatMoney(montant ?? amount, montant === null ? depuis : deviseAffichee, options)
      },
      baseDeConversion: (depuis) => {
        if (depuis === deviseAffichee) return null
        const taux = tauxLisible(depuis, deviseAffichee, cours.parEuro)
        if (taux === null) return null
        /*
          LA DATE SUIT LA PAIRE, PAS LA MÉMOIRE.

          Une première rédaction rendait `cours.date` dès qu'une conversion avait
          lieu. Le franc lu en euros s'annonçait donc « au taux du 28/08 » quand
          des cours flottants traînaient en mémoire, et « à la parité légale »
          quand il n'y en avait pas — deux phrases pour un seul fait, selon un
          état qui ne concerne pas cette paire. Or 655,957 est fixé par traité :
          il n'a pas de date, et lui en donner une invente une péremption.
        */
        const parLeFlux = exigeUnFluxDeCours(depuis) || exigeUnFluxDeCours(deviseAffichee)
        return { depuis, date: parLeFlux ? cours.date : null, taux }
      },
      enDeviseAffichee: (amount, depuis = deviseSource) =>
        convertir(amount, depuis, deviseAffichee, cours.parEuro) ?? amount,
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
