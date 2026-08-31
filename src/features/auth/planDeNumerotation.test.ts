import { describe, expect, it } from 'vitest'
import { validatePhone } from './validation'

/**
 * LE NUMÉRO SUIT LE PLAN DE SON PAYS, LÀ OÙ NOUS LE CONNAISSONS.
 *
 * ═══ CE QUI PASSAIT ═══
 *
 * `validatePhone` ne posait qu'un plancher de six chiffres et le plafond E.164
 * — quinze, indicatif compris. Son en-tête le disait et l'assumait : « plus
 * permissif que les plans nationaux réels — le Cameroun tient en neuf chiffres
 * — et c'est délibéré : une borne trop serrée refuserait un numéro valide dans
 * un pays dont on n'a pas la règle ».
 *
 * L'argument reste juste POUR LES PAYS DONT ON N'A PAS LA RÈGLE. Il ne l'est
 * pas pour ceux dont on l'a. « 60000001 », huit chiffres, n'est pas un numéro
 * camerounais ; il partait quand même, et se retrouvait dans la colonne
 * « Contact » sous la forme `+23760000001`, qu'aucun téléphone n'appellera.
 *
 * Signalé sur la production : « dans la fiche locataire, le format du numéro de
 * téléphone n'est pas conforme au pays ».
 *
 * ═══ CE QUE CES CAS GARDENT, ET CE QU'ILS NE GARDENT PAS ═══
 *
 * Que la règle EXISTE et qu'elle reste bornée. Ils ne garantissent pas que la
 * table soit exacte : sept longueurs y sont affirmées de mémoire, pas mesurées,
 * et une entrée fausse REFUSERAIT un numéro valide — c'est le risque que
 * l'ancienne rédaction refusait de prendre, et il est nommé dans le lot.
 */
describe('le plan de numérotation, là où on le connaît', () => {
  it('refuse huit chiffres au Cameroun, qui en veut neuf', () => {
    expect(validatePhone('60000001', '+237')).toBe('auth.errors.phoneCountry')
  })

  it('accepte les neuf du signalement', () => {
    expect(validatePhone('677111111', '+237')).toBeNull()
  })

  it('refuse aussi le numéro TROP LONG, que le plafond E.164 laissait passer', () => {
    /* Dix chiffres derrière `+237` font treize au total : sous le plafond de
       quinze, donc invisibles pour l'ancienne règle. */
    expect(validatePhone('6771111119', '+237')).toBe('auth.errors.phoneCountry')
  })

  it('compte dix chiffres en Côte d’Ivoire, et non neuf', () => {
    /* Deux pays voisins, deux plans : c'est exactement pourquoi la règle ne peut
       pas être une constante unique. */
    expect(validatePhone('0102030405', '+225')).toBeNull()
    expect(validatePhone('010203040', '+225')).toBe('auth.errors.phoneCountry')
  })
})

describe('les pays dont on n’a PAS la règle', () => {
  it('gardent l’ancienne permissivité, et c’est le point', () => {
    /* `+973` (Bahreïn) n'est pas dans la table. Refuser ici sur une longueur
       inventée coûterait plus qu'un numéro mal formé accepté : cela fermerait
       le produit à un pays entier sur une supposition. */
    expect(validatePhone('12345678', '+973')).toBeNull()
    expect(validatePhone('1234567890', '+973')).toBeNull()
  })

  it('conservent leurs deux bornes universelles', () => {
    /* Les règles qui ne dépendent d'aucun plan restent, et ce cas empêche que la
       table les remplace au lieu de s'y ajouter. */
    expect(validatePhone('', '+973')).toBe('auth.errors.phoneRequired')
    expect(validatePhone('12345', '+973')).toBe('auth.errors.phoneInvalid')
    expect(validatePhone('1234567890123', '+973')).toBe('auth.errors.phoneTooLong')
  })
})
