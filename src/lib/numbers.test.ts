import { describe, expect, it } from 'vitest'
import { formatInteger, formatList } from './numbers'

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
