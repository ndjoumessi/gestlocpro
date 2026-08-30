/**
 * Devises supportées.
 *
 * Aucune conversion de change n'est appliquée : un montant est affiché tel quel,
 * avec le formatage et le symbole de la devise en vigueur.
 *
 * Ce parti pris se réclamait d'un avertissement, « signalé à l'utilisateur par
 * `MoneyBasisNote` » — composant qui n'a jamais existé. La justification était
 * donc invoquée sans être tenue, et un parc camerounais pouvait s'afficher en
 * euros parce que le navigateur l'avait retenu.
 *
 * Ce qui le rend tenable aujourd'hui n'est pas une note mais une contrainte :
 * la devise vient du PARC (voir `AppShell`), et le sélecteur ne survit qu'en
 * démonstration, où les montants sont fictifs. Sans conversion, il n'y a qu'une
 * devise juste pour un parc — la sienne.
 * Les tarifs de la landing, eux, sont ancrés indépendamment par devise (voir
 * `features/marketing/pricing.ts`) et ne sont donc pas concernés.
 */

/**
 * `CFA` couvre les deux zones franc, CEMAC et UEMOA.
 *
 * Elles portaient auparavant deux codes distincts, `XAF` et `XOF`. Ce sont bien
 * deux monnaies séparées — un billet XAF n'a pas cours légal en zone UEMOA —
 * mais elles partagent le nom « FCFA » et la même parité fixe avec l'euro
 * (655,957). Le produit n'affichant que des montants, sans conversion ni
 * paiement, la distinction ne changeait rien à l'écran sauf le suffixe du
 * sélecteur.
 *
 * `CFA` n'est pas un code ISO 4217 : il n'existe pas de code commun aux deux
 * zones. Une intégration comptable ou bancaire devra donc rétablir `XAF` et
 * `XOF`, et le pays de l'utilisateur — déjà connu, voir `lib/countries` — suffit
 * à retrouver lequel s'applique.
 */
export const CURRENCIES = ['CFA', 'EUR', 'CAD', 'USD'] as const

export type CurrencyCode = (typeof CURRENCIES)[number]

export interface CurrencyDef {
  code: CurrencyCode
  /** Symbole compact affiché à côté des montants. */
  symbol: string
  /**
   * Forme COMPACTE — le déclencheur du menu, la pastille de la vitrine.
   *
   * Ce n'est PAS le nom de la devise. Le nom se traduit, donc il vit dans le
   * dictionnaire (`common.currencyNames`) et c'est lui que portent les LISTES :
   * l'en-tête, l'inscription, la correction du parc. Ici on ne cherche qu'une
   * étiquette courte pour un espace contraint, où le code fait l'affaire parce
   * que le choix courant est déjà connu de celui qui l'a fait.
   */
  label: string
  /** Locale utilisée pour le groupement des milliers. */
  locale: string
  /** Sous-unités affichées. Les francs CFA n'en ont pas. */
  decimals: 0 | 2
  /** Symbole avant ou après le nombre. */
  position: 'before' | 'after'
}

export const CURRENCY_DEFS: Record<CurrencyCode, CurrencyDef> = {
  CFA: {
    code: 'CFA',
    symbol: 'FCFA',
    label: 'FCFA',
    // La locale ne sert qu'au groupement des milliers, identique dans tous les
    // français ; aucune des deux zones n'est donc privilégiée par ce choix.
    locale: 'fr',
    decimals: 0,
    position: 'after',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    label: 'Euro (€)',
    locale: 'fr-FR',
    decimals: 2,
    position: 'after',
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    label: 'CAD ($)',
    locale: 'fr-CA',
    decimals: 2,
    position: 'after',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    label: 'USD ($)',
    locale: 'en-US',
    decimals: 2,
    position: 'before',
  },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'CFA'

export interface FormatMoneyOptions {
  /** Masque le symbole — utile quand une colonne le porte déjà en en-tête. */
  omitSymbol?: boolean
  /**
   * FORME COMPACTE : les décimales tombent quand elles sont NULLES.
   *
   * L'option s'appelait `round` et forçait zéro décimale. Elle est employée à
   * soixante-treize endroits — partout où le produit montre un montant — et
   * personne ne l'a jamais choisie contre les centimes : en franc CFA elle est
   * SANS EFFET, `decimals` y valant zéro. L'idiome s'est donc répandu sous une
   * monnaie où il ne coûtait rien, et la première conversion en euros a montré
   * ce qu'il coûtait ailleurs : « 681 € » pour 681,45 € dus, et un tableau de
   * cautions où la différence affichée ne tombe plus juste sous les termes qui
   * la produisent.
   *
   * L'intention — ne pas encombrer un chiffre-clé de « ,00 » — survit ; la
   * troncature, non.
   */
  compact?: boolean
}

/**
 * Formate un montant selon la devise active.
 *
 * DEUX espaces insécables différentes, et la distinction se voit à l'écran.
 *
 * Les milliers prennent la FINE (U+202F), qui est la convention française et
 * qui empêche un montant de se couper en fin de cellule.
 *
 * Le symbole, lui, prend l'insécable PLEINE (U+00A0). Il portait la fine aussi,
 * ce qui a tenu tant que les montants étaient composés en chasse fixe : une
 * police à chasse fixe donne à chaque glyphe la même avance, espaces comprises,
 * donc la fine y occupait la largeur d'un chiffre. Le passage à la police
 * proportionnelle l'a ramenée à sa vraie valeur — 1,7 px contre 3,6 pour la
 * pleine — et « 231 178 FCFA » se lisait « 231 178FCFA », la devise soudée au
 * montant. L'usage français veut de toute façon une espace pleine devant une
 * unité, et une fine seulement entre les tranches de chiffres.
 */
/**
 * D'UNITÉS MINEURES EN UNITÉS D'USAGE.
 *
 * Le serveur compte en mineures — colonnes `Int`, schémas `z.number().int()`,
 * champs `…Minor`. Les écrans lisent des unités d'usage. La division vit ici,
 * nommée, parce que deux appelants en ont besoin : la mise en forme et l'export
 * calculable. Écrite deux fois, elle aurait donné un tableur qui ne dit pas ce
 * que l'écran affiche.
 *
 * En franc CFA, `10 ** 0` vaut un : la fonction est l'identité, et c'est
 * pourquoi tout le reste du produit ne bronche pas.
 */
export function enUniteDUsage(mineur: number, currency: CurrencyCode): number {
  return mineur / 10 ** CURRENCY_DEFS[currency].decimals
}

/**
 * Le montant tombe-t-il juste dans l'unité d'usage ?
 *
 * Sert à décider si l'on montre les décimales : « 4 € » quand elles sont nulles,
 * « 6,40 € » sinon. `Number.isInteger` remplissait cet office du temps où les
 * montants étaient en unités d'usage ; en mineures il est toujours vrai, et la
 * page des tarifs affichait « 6 € » pour six euros quarante.
 */
/**
 * LE CODE ISO DE LA DEVISE, pour interroger les cours.
 *
 * `CFA` est un nom d'USAGE : il recouvre le XAF et le XOF, deux monnaies
 * distinctes de même parité, que l'écran ne distingue pas. Les cours, eux, sont
 * publiés par code ISO. On prend le XAF — la parité étant identique, le choix ne
 * porte que sur l'étiquette, et `lib/countries` garde le rattachement par zone
 * pour le jour d'une intégration de paiement.
 */
export const CODE_ISO: Record<CurrencyCode, 'XAF' | 'EUR' | 'CAD' | 'USD'> = {
  CFA: 'XAF',
  EUR: 'EUR',
  CAD: 'CAD',
  USD: 'USD',
}

/**
 * LA PARITÉ LÉGALE DU FRANC CFA, ET POURQUOI LE CLIENT LA TIENT.
 *
 * 1 EUR = 655,957 XAF, autant de XOF, fixé par le traité de coopération
 * monétaire. Ce n'est pas un cours : le nombre est exact, il n'a pas de date, et
 * sa dernière révision date du passage à l'euro en 1999.
 *
 * ═══ LE DÉFAUT QUE CETTE CONSTANTE SUPPRIME ═══
 *
 * Elle ne vivait que chez le serveur, servie par `/api/rates` avec les cours
 * flottants. Un client dont l'API ne répond pas — le développement seul, un
 * incident réseau, un service qui tarde à démarrer — annonçait donc « Cours
 * indisponibles » pour une conversion qu'il savait faire de tête. Et cela
 * frappait exactement la paire du marché visé : un parc de Douala qu'on veut
 * lire en euros.
 *
 * Faire dépendre d'une requête un nombre qui ne peut pas changer, c'est ajouter
 * une panne possible à un calcul qui n'en avait aucune.
 *
 * ═══ LE PRIX, ET IL EST PAYÉ ═══
 *
 * La constante existe désormais des DEUX côtés — client et serveur sont deux
 * paquets sans code commun. `pariteSansServeur` lit celle du serveur et compare
 * les deux : une divergence rougit, au lieu de rendre un montant plausible.
 */
export const PARITE_FRANC_CFA = 655.957

/**
 * Ce que le client sait SANS RIEN DEMANDER : l'euro pivot, et les deux francs.
 *
 * Rien d'autre n'y entre jamais. Le dollar canadien et le dollar américain
 * flottent — leur cours se publie, il ne se déduit pas — et les poser ici à une
 * valeur quelconque recréerait le défaut d'origine : quatre devises affichant le
 * même nombre, la fausseté rendue plausible par la mise en forme.
 */
const COURS_SANS_FLUX: Readonly<Partial<Record<string, number>>> = {
  EUR: 1,
  XAF: PARITE_FRANC_CFA,
  XOF: PARITE_FRANC_CFA,
}

/**
 * CETTE DEVISE A-T-ELLE BESOIN DU FLUX, ou le client sait-il déjà ?
 *
 * L'euro et les deux francs sont dans `COURS_SANS_FLUX` : leur rapport est une
 * constante de traité. Tout le reste FLOTTE et se publie.
 *
 * La question sert à décider quand redemander : un parc lu en euros n'a aucune
 * raison d'interroger la Banque centrale, même une fois par jour, alors qu'un
 * parc lu en dollars canadiens en a une par jour ouvré. Elle se déduit de la
 * table plutôt que d'une seconde liste, qui pourrait en diverger.
 */
export function exigeUnFluxDeCours(devise: CurrencyCode): boolean {
  return !(CODE_ISO[devise] in COURS_SANS_FLUX)
}

/**
 * LE RAPPORT ENTRE DEUX MONNAIES : combien de `vers` pour UNE unité de `depuis`.
 *
 * ═══ LE CHEMIN PASSE PAR L'EURO, ET C'EST VOULU ═══
 *
 * Les cours sont tous publiés pour un euro : celui de la BCE comme la parité du
 * franc CFA. Passer de source à euro puis d'euro à cible n'introduit aucune
 * inversion — l'endroit où l'on se trompe — et fait tomber les deux cas
 * triviaux tout seuls : source égale cible, ou l'une des deux étant l'euro.
 *
 * ═══ POURQUOI CE CALCUL EST SORTI DE `convertir` ═══
 *
 * Parce que le taux s'ÉCRIT, désormais : les documents et les exports le
 * portent en toutes lettres, à côté des montants qu'il a produits. Un second
 * calcul du même rapport, ailleurs, aurait pu diverger de celui qui a servi —
 * et un taux faux à côté de montants justes est pire que pas de taux : il donne
 * de quoi « vérifier » et fait conclure à une erreur qui n'existe pas.
 *
 * ═══ SANS COURS, PAS DE RAPPORT ═══
 *
 * Rend `null` plutôt qu'un nombre. Un appelant qui recevrait 1 par défaut
 * afficherait quatre devises au même montant — le défaut d'origine du produit.
 */
export function coursEntre(
  depuis: CurrencyCode,
  vers: CurrencyCode,
  parEuro: Partial<Record<string, number>>,
): number | null {
  if (depuis === vers) return 1

  /* LA PARITÉ D'ABORD, LE FLUX PAR-DESSUS. L'ordre compte peu — le serveur
     publie la même constante — mais il donne le dernier mot à la réponse reçue
     plutôt qu'à une valeur figée dans un paquet déployé il y a six mois. */
  const cours = { ...COURS_SANS_FLUX, ...parEuro }
  const coursDepuis = cours[CODE_ISO[depuis]]
  const coursVers = cours[CODE_ISO[vers]]
  if (!coursDepuis || !coursVers) return null

  return coursVers / coursDepuis
}

/**
 * CONVERTIR UN MONTANT D'UNE DEVISE VERS UNE AUTRE, en unités mineures.
 *
 * ═══ LES UNITÉS MINEURES SE DÉFONT PUIS SE REFONT ═══
 *
 * Un cours porte sur des unités d'USAGE : 655,957 francs pour un euro, et non
 * 655,957 centimes. Le montant quitte donc sa mineure, traverse, et reprend
 * celle de la cible — dont le nombre de décimales n'est pas le même. C'est
 * l'unique endroit du produit où les deux échelles se croisent.
 *
 * Le rapport, lui, vient de `coursEntre` : c'est celui que les pièces et les
 * exports ÉCRIVENT, et il ne se calcule donc qu'une fois.
 */
export function convertir(
  mineur: number,
  depuis: CurrencyCode,
  vers: CurrencyCode,
  parEuro: Partial<Record<string, number>>,
): number | null {
  if (depuis === vers) return mineur

  const taux = coursEntre(depuis, vers, parEuro)
  if (taux === null) return null

  return Math.round(enUniteDUsage(mineur, depuis) * taux * 10 ** CURRENCY_DEFS[vers].decimals)
}

/** « Un `un` vaut `vaut` `en` » — le taux dans le sens où on l'écrit. */
export interface TauxLisible {
  un: CurrencyCode
  vaut: number
  en: CurrencyCode
}

/**
 * LE TAUX DANS LE SENS OÙ IL SE LIT.
 *
 * Un rapport entre deux monnaies s'écrit dans les deux sens, et l'un des deux
 * est illisible. « 1 FCFA = 0,00152 Euro » et « 1 Euro = 655,957 FCFA » disent
 * le même fait ; le premier oblige à compter les zéros après la virgule pour
 * savoir de quel ordre on parle. On retient donc le sens dont le nombre est
 * SUPÉRIEUR À UN — règle qui ne dépend d'aucune liste à tenir à jour et qui
 * tombe juste sur les quatre paires du produit.
 *
 * CE N'EST PAS LE SENS DE LA CONVERSION, et c'est voulu : on convertit des
 * francs en dollars, et l'on écrit ce que vaut un dollar. Un taux se lit, il ne
 * se suit pas — celui qui veut refaire le calcul divise, et il sait le faire.
 */
export function tauxLisible(
  depuis: CurrencyCode,
  vers: CurrencyCode,
  parEuro: Partial<Record<string, number>>,
): TauxLisible | null {
  const direct = coursEntre(depuis, vers, parEuro)
  const inverse = coursEntre(vers, depuis, parEuro)
  if (direct === null || inverse === null) return null
  return direct >= 1 ? { un: depuis, vaut: direct, en: vers } : { un: vers, vaut: inverse, en: depuis }
}

/**
 * La devise en forme COURTE : « FCFA », « Euro », « CAD », « USD ».
 *
 * Le libellé du produit débarrassé de son symbole entre parenthèses. Dans un
 * en-tête de colonne — « Consigné (CAD ($)) » — ou dans un taux — « 1 CAD ($) =
 * 409,973 FCFA » — la parenthèse imbriquée n'ajoute rien à qui reconnaît déjà
 * le code.
 */
export function libelleCourt(currency: CurrencyCode): string {
  return CURRENCY_DEFS[currency].label.replace(/\s*\([^)]*\)\s*$/, '')
}

/**
 * Le taux en toutes lettres : « 1 CAD = 409,973 FCFA ».
 *
 * SIX CHIFFRES SIGNIFICATIFS, et le nombre est choisi. La parité du franc en
 * demande exactement six — 655,957 — et l'arrondir plus court la fausserait,
 * sur la seule paire du produit dont la valeur est EXACTE. Au-delà, on
 * publierait des décimales que le flux lui-même n'a pas.
 *
 * La locale est celle de la LANGUE et non de la devise : le taux est une phrase
 * avant d'être un montant, et il se lit dans le texte qui l'entoure.
 */
export function formatTaux(taux: TauxLisible, locale: string): string {
  const nombre = new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 })
    .format(taux.vaut)
    // Le même traitement que `formatMoney` : les milliers prennent la fine.
    .replace(/[\u00a0\u202f\s]/g, '\u202f')
  return `1 ${libelleCourt(taux.un)} = ${nombre} ${libelleCourt(taux.en)}`
}

export function estRondEnUniteDUsage(mineur: number, currency: CurrencyCode): boolean {
  return mineur % 10 ** CURRENCY_DEFS[currency].decimals === 0
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options: FormatMoneyOptions = {},
): string {
  const def = CURRENCY_DEFS[currency]
  const decimals = options.compact && estRondEnUniteDUsage(amount, currency) ? 0 : def.decimals

  const number = new Intl.NumberFormat(def.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(enUniteDUsage(amount, currency))
    // Uniformise les séparateurs de milliers en espace insécable étroit.
    .replace(/[  \s]/g, ' ')

  if (options.omitSymbol) return number
  return def.position === 'before'
    ? `${def.symbol} ${number}`
    : `${number} ${def.symbol}`
}

/**
 * Lit un montant saisi au clavier et le rend en UNITÉS MINEURES.
 *
 * La conversion vit ici et dans `formatMoney`, les deux fonctions par lesquelles
 * tout montant du produit passe déjà — voir l'en-tête d'`unités mineures` dans
 * les cas. En franc CFA, `10 ** 0` vaut un : rien ne change.
 *
 * Le code appelait `amount.replace(',', '.')` : la virgule était traitée comme
 * un séparateur décimal, toujours. En français c'est exact — « 1 450,50 ». En
 * anglais c'est le séparateur des **milliers**, si bien qu'un utilisateur qui
 * tapait `1,450` enregistrait **1,45**. Silencieusement : le montant est un
 * nombre valide et positif, donc aucune validation ne se déclenchait. Le
 * paiement était simplement enregistré cent fois trop bas.
 *
 * Les séparateurs ne sont pas devinés mais **demandés à `Intl`**, qui est déjà
 * la source de vérité de `formatMoney` : les deux fonctions ne peuvent donc pas
 * diverger. Écrire les séparateurs à la main ici aurait recréé le même défaut,
 * une couche plus bas.
 *
 * Rend `null` quand la saisie ne contient aucun nombre lisible, plutôt que le
 * `NaN` de `Number('')` — un appelant qui teste `!parsed` confondrait sinon
 * zéro et illisible.
 */
export function parseMoney(input: string, currency: CurrencyCode): number | null {
  const def = CURRENCY_DEFS[currency]
  const parts = new Intl.NumberFormat(def.locale).formatToParts(12345.6)
  const group = parts.find((p) => p.type === 'group')?.value ?? ''
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'

  let cleaned = input.trim()

  /*
    LE SYMBOLE DE CETTE DEVISE SE RETIRE — et lui seul.

    Un montant affiché doit pouvoir être resaisi tel quel : « 145 000 FCFA »
    recopié depuis l'écran est une saisie légitime, et le symbole n'y est pas
    une faute de frappe. On l'enlève donc explicitement, par son nom, au lieu de
    balayer toutes les lettres.
  */
  if (def.symbol) cleaned = cleaned.split(def.symbol).join('')

  // Les espaces sous toutes leurs formes servent de séparateur de milliers en
  // français, y compris l'insécable étroite que `formatMoney` produit.
  if (group) cleaned = cleaned.split(group).join('')
  cleaned = cleaned.replace(/[\s\u00a0\u202f\u2009]/g, '')
  cleaned = cleaned.split(decimal).join('.')

  /*
    ═══ CE QUI RESTE DOIT ÊTRE UN NOMBRE, SANS QUOI ON REFUSE ═══

    LA RÉDACTION PRÉCÉDENTE GOMMAIT : `cleaned.replace(/[^\d.-]/g, '')`, sous le
    commentaire « tout le reste — symbole monétaire, lettres, ponctuation — est
    écarté ». L'intention était juste pour le SYMBOLE ; appliquée aux lettres,
    elle recollait les deux moitiés du nombre et rendait un montant PLAUSIBLE
    que rien ne signalait. Mesuré sur l'ancienne rédaction :
   
      « 1o3 »   -> 13     un « o » tapé pour un zéro, et le loyer perd un ordre
      « 12abc » -> 12
      « 1a2b3 » -> 123
   
    Aucune de ces saisies ne rendait `null`. Elles partaient au serveur, et
    l'écran confirmait un chiffre que personne n'avait tapé. Sur un loyer, une
    caution ou un devis, c'est le pire mode de panne : il ne se voit pas.
   
    UN REFUS N'EST PAS UNE GÊNE, c'est la seule réponse honnête. L'appelant rend
    déjà « montant invalide » sur `null` — le chemin existe, il n'était
    simplement jamais emprunté. Et le symbole d'une AUTRE devise tombe ici aussi,
    ce qui est voulu : « 100 € » saisi sur un parc en francs n'est pas « cent »,
    c'est une question que seul l'écran peut trancher, puisque lui seul sait
    quelle devise il affiche.
  */
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null

  if (!/\d/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null

  /* ARRONDI, ET NON TRONQUÉ : une saisie « 900,505 » vaut 90 051 centimes et
     non 90 050. Sur une devise sans sous-unité, l'arrondi ramène « 900,50 » à
     901 — un centime de franc CFA n'a pas cours, et transmettre 900,5 dans un
     champ que le serveur exige entier le ferait refuser sans explication. */
  return Math.round(value * 10 ** def.decimals)
}
