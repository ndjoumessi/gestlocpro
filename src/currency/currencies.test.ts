import { describe, expect, it } from 'vitest'
import { CURRENCIES, CURRENCY_DEFS, formatMoney, parseMoney } from './currencies'
import { COUNTRIES, dialOptions } from '@/lib/countries'

/**
 * Formatage monétaire et cohérence des devises.
 *
 * Une règle de produit est verrouillée ici : l'absence de conversion de change.
 * Un même montant s'affiche tel quel dans toutes les devises, seuls le formatage
 * et le symbole changent.
 *
 * Les codes `XAF` et `XOF` ont depuis été fusionnés en un seul `CFA` — même nom
 * d'usage, même parité, et rien à l'écran ne dépendait de la distinction. Les
 * pays restent groupés par zone dans `lib/countries`, ce qui suffira à retrouver
 * l'un ou l'autre le jour d'une intégration de paiement.
 */

describe('formatage', () => {
  it('n’applique aucune conversion de change', () => {
    // La valeur numérique est identique partout ; seule la présentation varie.
    // `round` est nécessaire : sans lui, l'euro rend « 1 000,00 » et retirer
    // les non-chiffres concatènerait la partie décimale en « 100000 ».
    const rendus = CURRENCIES.map((code) =>
      formatMoney(1000, code, { omitSymbol: true, round: true }),
    )
    const chiffres = rendus.map((r) => r.replace(/\D/g, ''))
    expect(new Set(chiffres)).toEqual(new Set(['1000']))
  })

  it('place le symbole selon la convention de la devise', () => {
    // L'espace entre montant et symbole est elle aussi insécable : « 1 000 »
    // ne doit pas se retrouver séparé de « FCFA » en fin de ligne.
    expect(formatMoney(1000, 'CFA', { round: true })).toBe('1\u202f000\u202fFCFA')
    // Le dollar suit `en-US` et sépare donc les milliers par une virgule, là
    // où le franc CFA et l'euro emploient une espace.
    expect(formatMoney(1000, 'USD', { round: true })).toBe('$\u202f1,000')
  })

  it('n’ajoute pas de sous-unité au franc CFA', () => {
    // Le centime de franc CFA n'a pas cours.
    expect(formatMoney(1500, 'CFA')).not.toContain(',')
  })

  it('conserve les sous-unités des devises qui en ont', () => {
    expect(formatMoney(1500.5, 'EUR')).toContain('1\u202f500,50')
  })

  it('arrondit sur demande, pour les indicateurs compacts', () => {
    expect(formatMoney(1500.5, 'EUR', { round: true })).not.toContain(',50')
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
    // Le défaut, dans sa forme exacte : ce test échouait à 1.45.
    expect(parseMoney('1,450', 'USD')).toBe(1450)
  })

  it('lit la virgule comme décimale là où la devise l’emploie ainsi', () => {
    expect(parseMoney('1450,50', 'EUR')).toBe(1450.5)
  })

  it('relit ce que `formatMoney` a écrit', () => {
    // Un montant recopié depuis l'écran doit pouvoir être resaisi tel quel,
    // espaces insécables étroites et symbole compris.
    for (const code of CURRENCIES) {
      const rendu = formatMoney(1450, code, { round: true })
      expect(parseMoney(rendu, code)).toBe(1450)
    }
  })

  it('écarte le symbole monétaire et les lettres', () => {
    expect(parseMoney('145 000 FCFA', 'CFA')).toBe(145000)
    expect(parseMoney('$ 1,450', 'USD')).toBe(1450)
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
