import { describe, expect, it } from 'vitest'
import { validateCountry } from './validation'
import { initialSignupState } from './signupState'

/**
 * LE PAYS N'EST PLUS DÉDUIT DE LA DEVISE AFFICHÉE.
 *
 * `initialSignupState` prenait le premier pays de la liste portant la devise
 * ambiante — la France, parce qu'elle est en tête de la zone euro. Personne
 * n'avait décidé que ce serait la France : l'ordre d'un tableau l'avait décidé.
 *
 * Le prix ne se voyait pas depuis là. La devise gouverne l'affichage, et un
 * visiteur la change pour lire la grille tarifaire dans sa monnaie ; le pays,
 * lui, est stocké sur le parc et commande la devise de tout ce qui s'y compte.
 * Regarder les tarifs en euros suffisait à faire naître son parc français — et
 * c'est arrivé sur le premier parc réel du produit, « Parc Bastos », né FR/EUR
 * alors que Bastos est un quartier de Yaoundé.
 */
describe('le pays du compte', () => {
  it('n’est pas pré-rempli, quelle que soit la devise regardée', () => {
    // Le cas historique : euro affiché ⟹ France retenue.
    expect(initialSignupState('owner', 'fr', 'EUR').country).toBe('')
    // Et la même chose vaut pour le CFA : on ne devine pas davantage quand le
    // hasard tombe juste, sinon la règle ne tient que par chance.
    expect(initialSignupState('owner', 'fr', 'CFA').country).toBe('')
  })

  it('garde un indicatif utilisable en attendant', () => {
    // L'indicatif est visible et modifiable, et il suit le pays dès qu'on en
    // choisit un : le laisser vide ferait payer au champ téléphone une règle
    // qui ne le concerne pas.
    expect(initialSignupState('owner', 'fr', 'EUR').dial).toBe('+237')
  })

  it('est exigé', () => {
    expect(validateCountry('')).toBe('auth.errors.countryRequired')
    expect(validateCountry('CM')).toBeNull()
  })

  it('n’exige pas d’appartenir aux pays desservis', () => {
    /**
     * `COUNTRIES` compte vingt et un pays — ceux dont on connaît la devise, la
     * langue et l'indicatif — quand le formulaire en propose deux cent
     * quarante-deux. Un premier jet vérifiait l'appartenance : il interdisait
     * l'inscription à un bailleur de Harare, et c'est un cas existant du
     * harnais qui l'a attrapé avant la livraison.
     */
    expect(validateCountry('ZW')).toBeNull()
    // « Mon pays n'est pas proposé » est une réponse : le formulaire ne
    // transmet alors aucun code plutôt qu'un faux.
    expect(validateCountry('OTHER')).toBeNull()
  })
})
