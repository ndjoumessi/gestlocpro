import { describe, expect, it } from 'vitest'
import { CODES_PAYS, INDICATIFS, nomDuPays } from './indicatifs'
import { COUNTRIES } from './countries'

/**
 * La table des indicatifs, éprouvée par échantillon et par invariants.
 *
 * On ne vérifie pas 250 chiffres un par un — un tel test recopierait la table
 * et ne garderait rien. On vérifie ce qui la rend UTILISABLE : sa couverture,
 * sa forme, et le fait qu'elle contienne au moins tout ce que le produit
 * servait déjà.
 */
describe('indicatifs téléphoniques', () => {
  it('couvre le monde, et non une poignée de pays', () => {
    // 22 pays auparavant. Le seuil dit « c'est bien une table mondiale »
    // sans figer un décompte qui bougera au gré des territoires.
    expect(CODES_PAYS.length).toBeGreaterThan(200)
  })

  it('ne contient que des codes ISO et des indicatifs bien formés', () => {
    for (const code of CODES_PAYS) {
      expect(code, code).toMatch(/^[A-Z]{2}$/)
      expect(INDICATIFS[code], code).toMatch(/^\+[1-9]\d{0,3}$/)
    }
  })

  it('n’a perdu aucun pays de la liste servie jusqu’ici', () => {
    /**
     * Le garde qui compte.
     *
     * Passer de 22 pays à 250 ne doit RIEN retirer : un bailleur camerounais
     * déjà inscrit ne doit pas voir son pays disparaître. Et l'indicatif doit
     * rester le même — c'est lui qui compose les numéros enregistrés.
     */
    for (const pays of COUNTRIES) {
      if (pays.code === 'OTHER') continue
      expect(INDICATIFS[pays.code], pays.code).toBe(pays.dial)
    }
  })

  it('conserve les indicatifs partagés au lieu de les dédoublonner', () => {
    // `+1` couvre les États-Unis, le Canada et une vingtaine de territoires ;
    // les fusionner ferait disparaître des pays de la liste.
    expect(INDICATIFS.US).toBe('+1')
    expect(INDICATIFS.CA).toBe('+1')
    expect(INDICATIFS.RU).toBe('+7')
    expect(INDICATIFS.KZ).toBe('+7')
  })

  it('traduit les noms selon la langue demandée', () => {
    expect(nomDuPays('CM', 'fr')).toBe('Cameroun')
    expect(nomDuPays('CM', 'en')).toBe('Cameroon')
    // Repli : mieux vaut le code qu'une ligne vide dans une liste de choix.
    expect(nomDuPays('ZZ', 'fr')).toBe('ZZ')
  })
})
