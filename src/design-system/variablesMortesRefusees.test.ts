import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UNE VARIABLE MORTE EST REFUSÉE, PAS SIGNALÉE.
 *
 * ═══ CE QUE LE SIGNALEMENT COÛTAIT ═══
 *
 * `oxlint` rendait `no-unused-vars` en AVERTISSEMENT. La porte passait donc, et
 * rien ne le refusait jamais. Trois déclarations mortes ont vécu ainsi dans
 * `espace-connecte.mjs` — l'une depuis le 2026-08-31, l'autre depuis le
 * 2026-09-02, la troisième posée le 2026-09-05 par le lot qui convertissait
 * `docker exec` en `prisma db execute` et laissait son import derrière.
 *
 * ELLES ONT ÉTÉ TROUVÉES DANS UN JOURNAL DE LA CI, par hasard, en lisant la
 * PREMIÈRE exécution verte de la porte publique. C'est la forme la plus
 * discrète de dette : celle qu'une porte VOIT, NOMME, et laisse passer.
 *
 * ═══ ELLE NAÎT VERTE, ET JE LE DIS ═══
 *
 * Les trois ont été retirées avant ce lot : la règle passe donc de trois
 * occurrences à zéro sans rien casser. Ce dépôt se méfie des gardes préventives,
 * et celle-ci l'assume pour la raison que `MESURER_LE_PLI` a posée : SON MODE DE
 * DÉFAILLANCE EST SILENCIEUX. Un avertissement que personne ne lit ne devient
 * jamais rouge — il a fallu un journal d'intégration continue la première fois,
 * il en faudrait un la seconde.
 *
 * ═══ POURQUOI CE FICHIER, PUISQUE `oxlint` FAIT DÉJÀ LE TRAVAIL ═══
 *
 * Parce que la sévérité vit dans un JSON, que rien ne relit. La ramener de
 * `error` à `warn` — ou retirer la ligne — se fait en un caractère, ne casse
 * rien, et rend le dépôt exactement à l'état d'avant. Ce cas est la garde de la
 * garde : il tient la DÉCISION, quand `oxlint` tient son application.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Il ne compte pas les variables mortes — c'est le travail du linter, et le
 * refaire ici en dupliquerait la définition. Il ne touche pas non plus aux
 * TRENTE-DEUX autres avertissements du dépôt, mesurés le 2026-09-05 :
 *
 *     17  react(only-export-components)      déclarés « warn » DÉLIBÉRÉMENT
 *     12  react-hooks(exhaustive-deps)
 *      3  eslint(no-unsafe-optional-chaining)
 *
 * Les dix-sept premiers sont un choix écrit dans la configuration. Les trois
 * derniers méritent d'être regardés — un chaînage optionnel non sûr peut lever —
 * et c'est un autre sujet, nommé ici pour qu'il ne se perde pas.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('la configuration du linter', () => {
  const config = JSON.parse(readFileSync(join(RACINE, '.oxlintrc.json'), 'utf8')) as {
    rules?: Record<string, unknown>
  }

  it('refuse une variable morte, au lieu de la signaler', () => {
    const severite = config.rules?.['eslint/no-unused-vars']
    expect(
      Array.isArray(severite) ? severite[0] : severite,
      'ramenée à `warn` ou retirée, la règle laisse repasser ce que ce lot vient ' +
        'de retirer — et personne ne le verra, puisqu’un avertissement ne fait ' +
        'rougir aucune porte.',
    ).toBe('error')
  })

  it('refuse une dépendance de crochet oubliée ou de trop', () => {
    /*
      LA MÊME LEÇON, UNE FAMILLE PLUS LOIN — et celle-ci pouvait cacher un défaut
      VIVANT. `react-hooks(exhaustive-deps)` portait DOUZE avertissements que rien
      ne refusait : quatre dépendances MANQUANTES, huit INUTILES.

      Les manquantes périmaient un calcul. L'une d'elles vivait sur la valeur du
      contexte de `PortfolioProvider` — `tenantUnitIds` — et `isMine(unitId)`
      répondait donc depuis une liste de baux morte, sur le fournisseur qui
      alimente tous les écrans.

      Les douze sont résolues, sauf UNE, déclarée sur place avec sa mesure :
      `DatePicker` réabonnerait trois écouteurs à chaque rendu si on l'écoutait,
      et ce qu'elle capture ne bouge pas — deux littéraux passés par ses seuls
      appelants. Un `eslint-disable-next-line` la porte, avec son motif.

      C'EST LE SEUL ÉCHAPPEMENT DE CETTE RÈGLE, et il est nommé. Une garde qui
      compterait les échappements serait le cran suivant ; elle n'est pas écrite.
    */
    const severite = config.rules?.['react-hooks/exhaustive-deps']
    expect(
      Array.isArray(severite) ? severite[0] : severite,
      'ramenée à `warn`, la règle laisse repasser une fermeture périmée — et rien ' +
        'ne la verra, puisqu’un avertissement ne fait rougir aucune porte.',
    ).toBe('error')
  })

  it('garde la lecture du fichier, sans quoi le cas du dessus est creux', () => {
    /* GARDE DU GARDE. Si le fichier changeait de nom ou de forme, `config.rules`
       vaudrait `undefined` et le cas ci-dessus rougirait — mais pour la mauvaise
       raison, et son message parlerait d'une décision qu'on n'a pas prise. */
    expect(Object.keys(config.rules ?? {}).length).toBeGreaterThan(0)
  })
})
