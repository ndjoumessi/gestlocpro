import { describe, expect, it } from 'vitest'
import { CURRENCIES, CURRENCY_DEFS, enUniteDUsage, formatMoney, parseMoney } from './currencies'
import { COUNTRIES, dialOptions } from '@/lib/countries'

/**
 * Formatage monétaire et cohérence des devises.
 *
 * Une règle de produit est verrouillée ici : l'absence de conversion de CHANGE.
 * Un même montant s'affiche tel quel dans toutes les devises, seuls le formatage
 * et le symbole changent.
 *
 * À ne pas confondre avec la conversion d'UNITÉ, qui elle existe : les montants
 * arrivent en unités mineures et s'affichent en unités d'usage. Les cas de
 * `formatage` ci-dessous passent donc des centimes là où ils passaient des
 * euros — ce n'est pas un ajustement de chiffres, c'est le contrat du module
 * qui a changé. Voir `unités mineures`.
 *
 * Les codes `XAF` et `XOF` ont depuis été fusionnés en un seul `CFA` — même nom
 * d'usage, même parité, et rien à l'écran ne dépendait de la distinction. Les
 * pays restent groupés par zone dans `lib/countries`, ce qui suffira à retrouver
 * l'un ou l'autre le jour d'une intégration de paiement.
 */

/**
 * LES MONTANTS SONT DES UNITÉS MINEURES, ET C'EST LE SERVEUR QUI L'AVAIT DÉCIDÉ.
 *
 * ═══ LES DEUX MOITIÉS NE PARLAIENT PAS DE LA MÊME UNITÉ ═══
 *
 * Ce module travaillait en unités d'AFFICHAGE : `formatMoney(1500.5, 'EUR')`
 * rendait « 1 500,50 », et `parseMoney` rendait la même chose en sens inverse.
 * Entrée et sortie s'accordaient, donc rien ne paraissait de travers.
 *
 * Le serveur, lui, tient ces montants pour des unités MINEURES depuis toujours :
 * ses colonnes sont des `Int`, ses schémas exigent `z.number().int()`, et ses
 * champs s'appellent `…Minor`. Les deux moitiés du produit se contredisaient, et
 * cela ne se voyait NULLE PART — la démonstration, les mille trois cents cas et
 * le marché visé tournent en franc CFA, où l'unité mineure et l'unité
 * d'affichage coïncident. Il faut un parc en euros pour que l'écart apparaisse,
 * et l'inscription en crée un dès qu'on choisit la France.
 *
 * ═══ CE QUE L'ÉCART COÛTAIT ═══
 *
 *   · un loyer saisi « 900,50 » partait en `rentMinor: 900.5` et se faisait
 *     refuser par un schéma qui exige un entier, sans que rien n'explique
 *     pourquoi ;
 *   · un loyer de 900 enregistré valait neuf euros pour le serveur et neuf cents
 *     euros pour l'écran.
 *
 * ═══ LA CONVERSION VIT ICI, ET NULLE PART AILLEURS ═══
 *
 * Elle aurait pu vivre à la frontière de l'API — une vingtaine de lectures, une
 * huitaine d'envois. Elle vit dans les deux fonctions par lesquelles TOUT
 * montant passe déjà : celle qui l'écrit et celle qui le lit. Un seul endroit à
 * tenir, et la garde des montants lus à la main empêche qu'on la contourne.
 *
 * En franc CFA, `10 ** 0` vaut un : rien ne change, et c'est pourquoi le reste
 * du dépôt ne bronche pas.
 */
describe('unités mineures', () => {
  it('rend en unités d’affichage ce que le serveur compte en mineures', () => {
    // 150 050 centimes font mille cinq cents euros et cinquante centimes.
    expect(formatMoney(150050, 'EUR')).toContain('1\u202f500,50')
    // Le franc CFA n'a pas de sous-unité : mineure et affichage coïncident.
    expect(formatMoney(150050, 'CFA')).toContain('150\u202f050')
  })

  it('rend au serveur des unités mineures, et toujours entières', () => {
    // C'est la saisie qui se faisait refuser : `900.5` dans un champ entier.
    expect(parseMoney('900,50', 'EUR')).toBe(90050)
    expect(Number.isInteger(parseMoney('900,50', 'EUR'))).toBe(true)
    expect(parseMoney('900', 'CFA')).toBe(900)
  })

  it('n’accepte pas de sous-unité là où la devise n’en a pas', () => {
    /* Un centime de franc CFA n'a pas cours. La saisie est ramenée à l'entier
       le plus proche plutôt que transmise telle quelle : un montant fractionnaire
       dans un champ que le serveur exige entier est refusé sans explication. */
    expect(parseMoney('900,50', 'CFA')).toBe(901)
  })

  /**
   * LA CONVERSION EST NOMMÉE PARCE QUE DEUX APPELANTS EN ONT BESOIN.
   *
   * La mise en forme et l'export calculable. Écrite deux fois, elle aurait donné
   * un tableur qui ne dit pas ce que l'écran affiche : « 145000,00 » dans le
   * fichier, « 1 450,00 € » sur la page, et toute somme tirée du premier fausse.
   */
  it('rend la même unité à la mise en forme et à l’export', () => {
    expect(enUniteDUsage(145000, 'EUR')).toBe(1450)
    expect(enUniteDUsage(145000, 'CFA')).toBe(145000)
    for (const code of CURRENCIES)
      expect(formatMoney(145000, code, { omitSymbol: true }).replace(/\D/g, ''), code).toContain(
        String(enUniteDUsage(145000, code)).replace(/\D/g, ''),
      )
  })

  it('fait l’aller-retour sans rien perdre', () => {
    for (const code of CURRENCIES) {
      const mineur = 150050
      const rendu = formatMoney(mineur, code)
      expect(parseMoney(rendu, code), `aller-retour en ${code}`).toBe(mineur)
    }
  })
})

describe('formatage', () => {
  it('n’applique aucune conversion de change', () => {
    // La valeur numérique est identique partout ; seule la présentation varie.
    // `round` est nécessaire : sans lui, l'euro rend « 1 000,00 » et retirer
    // les non-chiffres concatènerait la partie décimale en « 100000 ».
    const rendus = CURRENCIES.map((code) =>
      // Mille unités d'usage, exprimées dans la mineure de chaque devise : la
      // règle porte sur le CHANGE, et mille euros doivent se lire « 1 000 »
      // comme mille francs.
      formatMoney(1000 * 10 ** CURRENCY_DEFS[code].decimals, code, {
        omitSymbol: true,
        round: true,
      }),
    )
    const chiffres = rendus.map((r) => r.replace(/\D/g, ''))
    expect(new Set(chiffres)).toEqual(new Set(['1000']))
  })

  it('place le symbole selon la convention de la devise', () => {
    // DEUX espaces insécables différentes, et l'écart entre les deux est le
    // sujet du test. Les milliers prennent la FINE (U+202F) ; le symbole prend
    // la PLEINE (U+00A0). Les deux étaient fines tant que les montants étaient
    // composés en chasse fixe, qui donne la même avance à tous les glyphes —
    // espaces comprises. En police proportionnelle la fine retombe à 1,7 px et
    // la devise se soude au montant. Insécables l'une comme l'autre : « 1 000 »
    // ne doit jamais se retrouver séparé de « FCFA » en fin de ligne.
    expect(formatMoney(1000, 'CFA', { round: true })).toBe('1\u202f000\u00a0FCFA')
    // Le dollar suit `en-US` et sépare donc les milliers par une virgule, là
    // où le franc CFA et l'euro emploient une espace.
    expect(formatMoney(100000, 'USD', { round: true })).toBe('$\u00a01,000')
  })

  it('n’ajoute pas de sous-unité au franc CFA', () => {
    // Le centime de franc CFA n'a pas cours.
    expect(formatMoney(1500, 'CFA')).not.toContain(',')
  })

  it('conserve les sous-unités des devises qui en ont', () => {
    expect(formatMoney(150050, 'EUR')).toContain('1\u202f500,50')
  })

  it('arrondit sur demande, pour les indicateurs compacts', () => {
    expect(formatMoney(150050, 'EUR', { round: true })).not.toContain(',50')
  })

  it('sépare les milliers par une espace insécable étroite', () => {
    // Une espace ordinaire autoriserait une coupure de ligne au milieu d'un
    // montant, dans un tableau où les colonnes sont déjà serrées.
    const rendu = formatMoney(1415000, 'CFA', { round: true })
    expect(rendu).toContain('\u202f')
    expect(rendu).not.toMatch(/\d \d/)
  })
})

/**
 * Lecture d'un montant saisi.
 *
 * Le code remplaçait la virgule par un point, quelle que soit la devise. En
 * français c'est juste ; en anglais la virgule sépare les milliers, et
 * « 1,450 » devenait **1,45**. Sans erreur : le résultat est un nombre valide
 * et positif, donc aucune validation ne se déclenchait et le paiement partait
 * cent fois trop bas.
 */
describe('lecture d’un montant saisi', () => {
  it('ne prend pas le séparateur de milliers anglais pour une virgule décimale', () => {
    // Le défaut, dans sa forme exacte : ce cas rendait 1,45 au lieu de 1 450.
    // Mille quatre cent cinquante dollars font 145 000 cents.
    expect(parseMoney('1,450', 'USD')).toBe(145000)
  })

  it('lit la virgule comme décimale là où la devise l’emploie ainsi', () => {
    // La virgule est bien décimale : 1 450,50 € font 145 050 centimes, et non
    // 145 000 — ce que rendrait une virgule prise pour un séparateur de milliers.
    expect(parseMoney('1450,50', 'EUR')).toBe(145050)
  })

  it('relit ce que `formatMoney` a écrit', () => {
    // Un montant recopié depuis l'écran doit pouvoir être resaisi tel quel,
    // espaces insécables étroites et symbole compris.
    for (const code of CURRENCIES) {
      /* `round` retire les sous-unités à l'affichage : on part donc d'un
         montant ROND dans l'unité d'usage, sans quoi l'aller-retour perdrait
         les centimes que la présentation a masqués — ce qui mesurerait
         l'arrondi et non la relecture. */
      const mineur = 1450 * 10 ** CURRENCY_DEFS[code].decimals
      const rendu = formatMoney(mineur, code, { round: true })
      expect(parseMoney(rendu, code), `aller-retour en ${code}`).toBe(mineur)
    }
  })

  it('écarte le symbole monétaire et les lettres', () => {
    expect(parseMoney('145 000 FCFA', 'CFA')).toBe(145000)
    expect(parseMoney('$ 1,450', 'USD')).toBe(145000)
  })

  it('distingue une saisie vide d’un zéro', () => {
    // `Number('')` vaut 0 : un appelant qui teste `!parsed` confondrait les
    // deux, et une saisie illisible passerait pour un montant nul valide.
    expect(parseMoney('', 'CFA')).toBeNull()
    expect(parseMoney('abc', 'CFA')).toBeNull()
    expect(parseMoney('0', 'CFA')).toBe(0)
  })
})

describe('franc CFA unifié', () => {
  it('ne porte qu’un code, sans suffixe de zone', () => {
    expect(CURRENCIES.filter((code) => CURRENCY_DEFS[code].symbol === 'FCFA')).toEqual(['CFA'])
    expect(CURRENCY_DEFS.CFA.label).toBe('FCFA')
  })

  it('couvre les deux zones franc, de Douala à Dakar', () => {
    // Le Cameroun relevait du XAF, le Sénégal du XOF : tous deux tombent
    // désormais sur la même devise.
    expect(COUNTRIES.find((c) => c.code === 'CM')?.currency).toBe('CFA')
    expect(COUNTRIES.find((c) => c.code === 'SN')?.currency).toBe('CFA')
  })

  it('y rattache les quatorze pays des deux zones', () => {
    expect(COUNTRIES.filter((c) => c.currency === 'CFA')).toHaveLength(14)
  })
})

describe('cohérence de la liste des pays', () => {
  it('n’attache aucun pays à une devise non prise en charge', () => {
    for (const country of COUNTRIES) {
      expect(CURRENCIES).toContain(country.currency)
    }
  })

  it('donne à chaque pays un indicatif bien formé', () => {
    for (const country of COUNTRIES) {
      expect(country.dial).toMatch(/^\+\d{1,4}$/)
    }
  })

  it('n’a pas de code pays en double', () => {
    const codes = COUNTRIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('nomme chaque pays dans les deux langues', () => {
    for (const country of COUNTRIES) {
      expect(country.nameFr.length).toBeGreaterThan(1)
      expect(country.nameEn.length).toBeGreaterThan(1)
    }
  })
})

/**
 * Indicatifs téléphoniques.
 *
 * Le menu ne rendait que des nombres nus — « +225 » ne dit rien à qui cherche
 * la Côte d'Ivoire. La déduplication par `Set` écartait les doublons et, ce
 * faisant, jetait le pays.
 */
describe('indicatifs téléphoniques', () => {
  it('nomme le pays avant l’indicatif', () => {
    const cameroun = dialOptions('fr').find((o) => o.dial === '+237')
    // Le pays d'abord : un `<select>` natif saute à l'option dont le TEXTE
    // commence par ce qu'on tape, donc « cam » doit mener au Cameroun.
    expect(cameroun?.label).toBe('Cameroun · +237')
  })

  it('regroupe les pays qui partagent un indicatif en une seule entrée', () => {
    const partages = dialOptions('fr').filter((o) => o.dial === '+1')
    // Deux options de même valeur dans un `<select>` contrôlé se marqueraient
    // toutes deux sélectionnées, et le choix semblerait sauter d'un pays à
    // l'autre.
    expect(partages).toHaveLength(1)
    /**
     * Les pays SERVIS en tête, puis les autres, puis une ellipse.
     *
     * `+1` couvre vingt-cinq territoires. Classés alphabétiquement, la ligne
     * commençait par « Anguilla » et enterrait le Canada et les États-Unis,
     * seuls reconnaissables par qui cherche. Un regroupement doit montrer ce
     * qui IDENTIFIE l'indicatif, pas ce qui vient en premier dans l'alphabet.
     */
    expect(partages[0].label).toBe('Canada, États-Unis, Anguilla… · +1')
  })

  it('couvre tous les indicatifs du catalogue, sans doublon', () => {
    const options = dialOptions('fr')
    // La liste couvre désormais le MONDE : tout indicatif du catalogue servi
    // doit s'y trouver, et aucun ne doit apparaître deux fois — deux options de
    // même valeur dans un `<select>` contrôlé se marqueraient toutes deux
    // sélectionnées.
    for (const pays of COUNTRIES) {
      expect(options.some((o) => o.dial === pays.dial), pays.code).toBe(true)
    }
    expect(new Set(options.map((o) => o.dial)).size).toBe(options.length)
    expect(options.length).toBeGreaterThan(100)
  })

  it('suit la langue', () => {
    /**
     * L'Allemagne et non la Côte d'Ivoire : le CLDR nomme cette dernière
     * « Côte d'Ivoire » DANS LES DEUX LANGUES — c'est son nom officiel, et
     * « Ivory Coast » que nous écrivions à la main était un usage, pas une
     * traduction. Éprouver la langue sur un pays où elle ne change rien
     * n'aurait rien gardé.
     */
    expect(dialOptions('fr').find((o) => o.dial === '+49')?.label).toContain('Allemagne')
    expect(dialOptions('en').find((o) => o.dial === '+49')?.label).toContain('Germany')
  })
})
