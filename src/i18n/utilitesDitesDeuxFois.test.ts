import { describe, expect, it } from 'vitest'
import { fr } from './fr'
import { en } from './en'

/**
 * LES DEUX BLOCS QUI NOMMENT L'EAU ET L'ÉLECTRICITÉ DISENT LA MÊME CHOSE.
 *
 * ═══ POURQUOI ILS SONT DEUX ═══
 *
 * `Utility` vaut `water` ou `power`, en base. Deux endroits du produit les
 * nomment : l'écran des compteurs (`app.meters.utility`) et le registre des
 * décisions (`app.decisions.utilities`), qui rend la charge utile d'un
 * `tariff.set`.
 *
 * Les fusionner serait le vrai correctif. Je ne l'ai pas fait, et pas par
 * paresse : les deux blocs sont composés depuis des écrans différents, leurs
 * clés vivent sous des chemins que `t()` type à la compilation, et déplacer l'un
 * sous l'autre créerait une dépendance de dictionnaire entre deux familles qui
 * n'en ont aucune. Le prix de la duplication est qu'elle DÉRIVE ; cette garde
 * paie ce prix-là, et le nomme.
 *
 * ═══ CE QUE LA DÉRIVE DONNERAIT À LIRE ═══
 *
 * Rien. Aucune clé manquante, aucun repli, aucune rougeur : l'écran des
 * compteurs dirait « Électricité » et le registre « Courant » pour la même
 * valeur de la même énumération. Deux mots pour une chose, dans le même produit,
 * et rien pour le dire.
 *
 * C'est la forme exacte du danger que le remaniement du dictionnaire vient de
 * fermer ailleurs — un libellé qui a l'air juste à sa place — sauf qu'ici il
 * n'est même pas faux, seulement autre.
 *
 * ═══ LES DEUX SENS ═══
 *
 * Mêmes valeurs de part et d'autre, et mêmes CLÉS : un bloc qui gagnerait un
 * troisième fluide sans que l'autre le suive ferait rougir aussi. `Utility` n'en
 * compte que deux aujourd'hui ; `valeursAffichesNommees` garde ce compte-là
 * contre le schéma, celle-ci garde les deux blocs l'un contre l'autre.
 */
const paires = [
  ['fr', fr.app.meters.utility, fr.app.decisions.utilities],
  ['en', en.app.meters.utility, en.app.decisions.utilities],
] as const

describe('l’eau et l’électricité, nommées à deux endroits', () => {
  it.each(paires.map(([langue]) => langue))('portent les mêmes CLÉS en %s', (langue) => {
    const [, compteurs, decisions] = paires.find(([l]) => l === langue)!
    expect(
      Object.keys(compteurs).sort(),
      'un bloc a gagné ou perdu un fluide sans que l’autre le suive',
    ).toEqual(Object.keys(decisions).sort())
  })

  it.each(paires.map(([langue]) => langue))('portent les mêmes MOTS en %s', (langue) => {
    const [, compteurs, decisions] = paires.find(([l]) => l === langue)!
    const ecarts = Object.entries(compteurs)
      .filter(([cle, mot]) => mot !== (decisions as Record<string, string>)[cle])
      .map(
        ([cle, mot]) =>
          `${cle} : « ${mot} » à l’écran des compteurs, ` +
          `« ${(decisions as Record<string, string>)[cle]} » au registre des décisions`,
      )

    expect(
      ecarts,
      'le même fluide porte deux noms dans le même produit, et rien ne le dit :\n  ' +
        ecarts.join('\n  '),
    ).toEqual([])
  })

  it('trouve bien deux fluides — sans quoi cette garde ne garderait rien', () => {
    /* Deux blocs vides sont d'accord. La garde comparerait alors deux façons de
       ne rien dire, et passerait. */
    for (const [langue, compteurs] of paires)
      expect(Object.keys(compteurs).length, `${langue} : aucun fluide lu`).toBeGreaterThanOrEqual(2)
  })
})
