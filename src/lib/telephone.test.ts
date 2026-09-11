import { describe, expect, it } from 'vitest'
import { telephoneLisible } from './telephone'

/**
 * UN NUMÉRO SE LIT PAR GROUPES, ET S'APPELLE TEL QU'IL EST ENREGISTRÉ.
 *
 * Le serveur rend l'E.164 brut — « +237677111111 » —, que personne ne relit ni
 * ne dicte sans compter les chiffres du doigt. La démonstration, elle, écrit
 * « +237 6 77 21 44 08 » depuis toujours : c'est la forme que ce dépôt pratique,
 * et un parc réel l'affichait autrement que la démo qui le présente.
 */
describe('telephoneLisible', () => {
  it('groupe un numéro camerounais comme la démonstration l’écrit', () => {
    expect(telephoneLisible('+237677111111')).toBe('+237 6 77 11 11 11')
    expect(telephoneLisible('+237233421010')).toBe('+237 2 33 42 10 10')
  })

  it('rend à l’identique un numéro déjà groupé', () => {
    expect(telephoneLisible('+237 6 77 21 44 08')).toBe('+237 6 77 21 44 08')
  })

  /* LE RESTE N'EST PAS INVENTÉ. Chaque pays groupe à sa façon, et un découpage
     faux se lit comme un numéro faux : on rend ce qu'on a reçu. */
  it('laisse tel quel ce qu’il ne sait pas grouper', () => {
    expect(telephoneLisible('+33612345678')).toBe('+33612345678')
    expect(telephoneLisible('+23767711111')).toBe('+23767711111')
    expect(telephoneLisible('+2376771111112')).toBe('+2376771111112')
    expect(telephoneLisible('')).toBe('')
  })
})
