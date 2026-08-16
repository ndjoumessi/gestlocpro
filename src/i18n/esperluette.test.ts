import { describe, expect, it } from 'vitest'
import { fr } from './fr'
import { en } from './en'

/**
 * Pas d'esperluette dans les textes affichés.
 *
 * En français, « & » est un anglicisme typographique : il appartient aux
 * raisons sociales — « Dupont & Fils » — et non au texte courant, où « et »
 * s'impose. Cinq titres d'écran le portaient, et il saute d'autant plus aux
 * yeux que la police d'affichage lui donne un dessin très marqué.
 *
 * La garde parcourt les dictionnaires EXPORTÉS plutôt que le texte du fichier :
 * une lecture de source dépend du chemin d'exécution, et une première version
 * de ce test échouait pour cette seule raison — sans rien dire du produit.
 */
const DICTIONNAIRES: [string, Record<string, unknown>][] = [
  ['fr', fr as unknown as Record<string, unknown>],
  ['en', en as unknown as Record<string, unknown>],
]

/** Toutes les chaînes d'un dictionnaire, à plat, avec leur chemin de clé. */
function chaines(valeur: unknown, prefixe = ''): [string, string][] {
  if (typeof valeur === 'string') return [[prefixe, valeur]]
  if (!valeur || typeof valeur !== 'object') return []
  return Object.entries(valeur as Record<string, unknown>).flatMap(([cle, sous]) =>
    chaines(sous, prefixe ? `${prefixe}.${cle}` : cle),
  )
}

describe('typographie des dictionnaires', () => {
  for (const [langue, dictionnaire] of DICTIONNAIRES) {
    it(`${langue} n’affiche pas d’esperluette`, () => {
      const fautives = chaines(dictionnaire)
        .filter(([, texte]) => / & /.test(texte))
        .map(([cle, texte]) => `${cle} : ${texte}`)

      expect(fautives, 'esperluette dans un texte affiché').toEqual([])
    })
  }

  it('détecterait une esperluette réintroduite', () => {
    // Garde du garde : un test incapable de reconnaître ce qu'il cherche passe
    // toujours.
    expect(chaines({ a: { b: 'Travaux & signalements' } })).toEqual([
      ['a.b', 'Travaux & signalements'],
    ])
    expect(/ & /.test('Travaux & signalements')).toBe(true)
    expect(/ & /.test('Travaux et signalements')).toBe(false)
  })
})
