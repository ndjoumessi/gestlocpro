import { describe, expect, it } from 'vitest'
import { formatInteger, formatList, formatPercent } from './numbers'

/**
 * Formatage des nombres qui ne sont pas des montants.
 *
 * Le produit avait un module pour l'argent et un pour les dates, mais rien pour
 * les entiers ordinaires. Chaque écran interpolait donc directement, et un
 * index de compteur s'affichait « 4120 » dans les deux langues.
 *
 * Le défaut est discret : il n'apparaît qu'à partir de quatre chiffres. Un jeu
 * de démonstration à trois chiffres passe la relecture — d'où les cas à quatre
 * et cinq chiffres ici, et non un `1234` symbolique.
 */
describe('entiers groupés', () => {
  it('groupe les milliers selon la langue et le pays', () => {
    expect(formatInteger(4120, 'fr-FR')).toBe('4 120')
    expect(formatInteger(4120, 'en-US')).toBe('4,120')
  })

  it('ne groupe pas en deçà du seuil, comme le veut chaque langue', () => {
    // Trois chiffres : identique partout. C'est exactement pourquoi le défaut
    // survivait à la relecture d'un jeu de démonstration modeste.
    expect(formatInteger(192, 'fr-FR')).toBe(formatInteger(192, 'en-US'))
  })

  it('diverge réellement d’une langue à l’autre', () => {
    // Garde contre une régression qui rendrait le formatage inerte.
    expect(formatInteger(7640, 'fr-FR')).not.toBe(formatInteger(7640, 'en-US'))
  })

  it('n’ajoute pas de décimale à un entier', () => {
    expect(formatInteger(520, 'en-US')).toBe('520')
  })
})

describe('énumération', () => {
  it('emploie la conjonction de la langue', () => {
    // On concaténait par `', '` : une liste anglaise en français, et une liste
    // française en anglais.
    expect(formatList(['A5', 'C2'], 'fr-FR')).toBe('A5 et C2')
    expect(formatList(['A5', 'C2'], 'en-GB')).toBe('A5 and C2')
  })

  it('ponctue une liste de plus de deux éléments', () => {
    expect(formatList(['A5', 'B2', 'C2'], 'en-US')).toBe('A5, B2, and C2')
  })

  it('rend un élément seul sans conjonction', () => {
    expect(formatList(['A5'], 'fr-FR')).toBe('A5')
  })
})

/**
 * UN POURCENTAGE NE SE COUPE PAS EN DEUX LIGNES.
 *
 * ═══ CE QUI ÉTAIT À L'ÉCRAN ═══
 *
 * « 100 » sur une ligne, « % » sur la suivante, dans la carte du loyer de
 * l'espace locataire. Le signe était collé au nombre par une espace ORDINAIRE,
 * écrite à la main dans le JSX — `{value} %` — donc sécable, dans une colonne
 * large de quarante pixels qui suffisait à « 83 % » et pas à « 100 % ».
 *
 * AUCUNE GARDE NE POUVAIT LE VOIR. `mesure-ui` mesure les DÉBORDEMENTS : un
 * texte qui passe à la ligne ne déborde de rien, il est parfaitement dans sa
 * boîte, en deux morceaux. C'est le même angle mort que le rognage.
 *
 * ═══ ET L'ANGLAIS N'ÉCRIT PAS COMME LE FRANÇAIS ═══
 *
 * « 100 % » est français ; l'anglais écrit « 100% », sans espace. La chaîne
 * écrite à la main donnait donc la ponctuation française aux deux langues — un
 * second défaut, celui-là jamais signalé, que le passage par `Intl` corrige du
 * même geste. C'est la doctrine de ce fichier : les séparateurs se DEMANDENT,
 * ils ne s'écrivent pas.
 */
describe('pourcentages', () => {
  it('sépare selon la langue, et l’anglais ne sépare pas', () => {
    /* L'insécable PLEINE, et non la fine qu'`Intl` compose : `formatMoney` a
       mesuré la seconde à 1,7 px en police proportionnelle et l'a refusée devant
       une unité — « 231 178FCFA ». Le même produit ne peut pas espacer ses
       pourcentages autrement que ses montants. */
    expect(formatPercent(100, 'fr-FR')).toBe('100\u00a0%')
    expect(formatPercent(100, 'en-US')).toBe('100%')
  })

  it('n’emploie aucune espace sécable', () => {
    /* LE CŒUR DU DÉFAUT. Une espace ordinaire autorise la coupure ; l'insécable
       l'interdit, quelle que soit la largeur de la colonne. On refuse donc
       l'espace ORDINAIRE, et non « toute espace » — la fine insécable en est
       une, et c'est précisément celle qu'on veut. */
    for (const tag of ['fr-FR', 'en-US', 'fr-CA'])
      expect(formatPercent(100, tag), `séparateur sécable en ${tag}`).not.toMatch(/ /)
  })

  it('rend un entier, sans décimale inventée', () => {
    expect(formatPercent(83, 'fr-FR')).toBe('83\u00a0%')
    expect(formatPercent(0, 'fr-FR')).toBe('0\u00a0%')
  })
})
