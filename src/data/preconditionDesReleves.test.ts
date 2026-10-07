import { describe, expect, it } from 'vitest'
import { READINGS, UNITS } from './portfolio'

/**
 * LA PRÉCONDITION DE LA SERRURE DE COHÉRENCE, ET POURQUOI ELLE MÉRITE SON PROPRE CAS.
 *
 * `coherentAvecLesReleves` (voir `persistence.ts`) refuse tout enregistrement
 * dont les unités ne portent pas l'intégralité des `unitId` que `READINGS`
 * référence. Cette règle suppose, SANS LE DIRE, que la fixture elle-même est
 * cohérente : `READINGS ⊆ UNITS`.
 *
 * LE JOUR OÙ CETTE SUPPOSITION TOMBE, LA SERRURE DEVIENT INSATISFIABLE. Un
 * relevé de démonstration qui pointe une unité absente du jeu ne peut être
 * satisfait par AUCUN enregistrement, pas même par le jeu complet : `loadState`
 * refuse et efface à chaque lecture, et la démonstration cesse de mémoriser quoi
 * que ce soit. Aucun écran ne le dit — le visiteur voit simplement son parcours
 * disparaître à chaque rafraîchissement.
 *
 * ═══ POURQUOI CE CAS EXISTE, ALORS QUE LA SUITE ATTRAPE DÉJÀ LE DÉFAUT ═══
 *
 * Mesuré sur une copie propre de `1477cdf`, fixture dérivée d'un onzième relevé
 * pointant une unité `Z9` absente de `UNITS` : **sept cas rougissent, sur six
 * fichiers**. La suite attrape donc le défaut, et bruyamment.
 *
 * Mais elle l'attrape MAL, et c'est la raison d'être de ce fichier. Les sept
 * rouges sont des cas qui parlent d'autre chose — la persistance, le fournisseur,
 * la période des relevés, et les deux cas de la serrure elle-même. Aucun ne NOMME
 * la précondition. Qui les lit voit sept défauts sans rapport et cherche la cause
 * dans sept directions ; le relevé de ce jour-là montre même les deux cas de
 * `relevesSansLeurLogement` rougir, ce qui envoie droit vers la serrure alors que
 * la faute est dans la FIXTURE. Ils sont les victimes du défaut, pas ses témoins.
 *
 * Ce cas-ci est le témoin : il échoue SEUL sur la bonne cause, avec le nom de
 * l'unité fautive dans son message, avant que les six autres fichiers n'aient
 * l'occasion de brouiller la piste.
 *
 * ═══ CE CAS NAÎT VERT, ET C'EST ASSUMÉ ═══
 *
 * La fixture est cohérente aujourd'hui ; il ne peut donc pas naître rouge. Sa
 * valeur se prouve par MUTATION, et la mutation est celle du relevé ci-dessus :
 * un `unitId` que `UNITS` ne porte pas, ajouté à `RELEVES_DE_LA_PERIODE`. Mesuré
 * — il rougit en nommant l'unité, là où il est vert sur la fixture en place.
 */
describe('la précondition de la serrure de cohérence', () => {
  it('ne réclame que des logements que le jeu de démonstration porte', () => {
    const logementsDuJeu = new Set(UNITS.map((unite) => unite.id))
    const reclames = READINGS.map((releve) => releve.unitId)

    /* L'AFFIRMATION POSITIVE D'ABORD. Sans elle, un `READINGS` vidé rendrait ce
       cas vert en n'ayant rien vérifié — la classe `cas-negatif-vert-a-vide` que
       ce dépôt a déjà payée, et deux fois dans ce dossier même. */
    expect(reclames.length, 'le jeu doit porter des relevés, sinon ce cas est creux').toBeGreaterThan(
      0,
    )

    /* LA RÈGLE, DITE POSITIVEMENT ET NOMMANT SON COUPABLE — en UNE ligne, et ce
       n'est pas de l'élégance mal placée.

       Elle en faisait deux : un compte (« tous se résolvent ») puis un
       diagnostic (« voici les introuvables »). Mesuré sous la mutation, le
       compte échouait LE PREMIER et rendait « expected […] to have a length of
       11 but got 10 » — un écart de comptes, sans le nom de l'unité fautive. Le
       diagnostic que ce fichier promettait n'était jamais atteint, `expect`
       s'arrêtant à la première rupture. Deux assertions pour une même règle, et
       c'est la moins lisible qui parlait.

       Comparer les deux listes dit la même chose positivement — tout logement
       réclamé se résout — et le DIFF nomme celui qui manque : `- "Z9"` sous la
       mutation. La ligne de résumé, elle, tronque les deux listes à cinq
       éléments et ne le montre pas ; c'est le diff qu'il faut lire, pas elle. */
    const resolus = reclames.filter((unitId) => logementsDuJeu.has(unitId))
    expect(
      resolus,
      'un relevé réclame un logement absent de `UNITS` (le diff le nomme) : la ' +
        'serrure de `persistence.ts` devient alors insatisfiable, et la ' +
        'démonstration cesse de mémoriser en silence. Corrigez la FIXTURE, pas ' +
        'la serrure.',
    ).toEqual(reclames)
  })
})
