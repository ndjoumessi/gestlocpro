import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde des APPARIEMENTS de couleurs.
 *
 * Les gardes voisines vérifient la COUVERTURE : que chaque jeton de couleur a
 * bien une contrepartie sombre. Elles ne peuvent pas voir le défaut corrigé ici,
 * et c'est tout l'intérêt de ce fichier.
 *
 * Un fond en `--color-ink` associé à un texte en `--color-gold` tenait 5,83:1 en
 * clair et tombait à **2,33:1** en sombre. Les deux jetons étaient pourtant
 * parfaitement définis dans les deux thèmes : `--color-ink` s'inverse — sombre
 * en clair, clair en sombre — tandis que `--color-gold` garde sa valeur. C'est
 * donc leur MISE EN PAIRE qui casse, pas l'un ni l'autre. Aucune lecture du
 * fichier de jetons ne pouvait le révéler ; il a fallu parcourir les écrans un
 * par un pour le trouver, sur trois sites dont la tuile SÉLECTIONNÉE d'un
 * formulaire d'inscription — l'élément le moins lisible de sa carte.
 *
 * La règle est donc simple et vaut mieux qu'une heuristique : sur un fond qui
 * s'inverse, la couleur de premier plan doit s'inverser aussi. `--color-gold-on-ink`
 * existe pour cela, et son nom dit le fond qu'il accompagne plutôt que sa
 * propre teinte.
 *
 * Ce test lit les SOURCES, pas le DOM : jsdom ne calcule ni les couches en
 * cascade ni les requêtes média, et un composant monté n'y rendrait que le
 * thème clair.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Le code livré : ni les tests, ni les fichiers de jetons eux-mêmes. */
function sources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(entree) || /\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Les commentaires sont retirés avant l'examen : sans cela le garde se
 * déclencherait sur les explications qui décrivent le défaut, dans les fichiers
 * mêmes où il vient d'être corrigé — ce qui pousse à effacer l'explication pour
 * faire passer la suite, exactement le mauvais réflexe.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('appariements de couleurs', () => {
  it('n’associe jamais un fond `ink` à l’or de marque, qui ne s’inverse pas', () => {
    // Motifs assemblés par fragments : Tailwind lit les sources comme du texte,
    // fichiers de test compris, et générerait pour de bon toute classe citée en
    // clair dans ce fichier.
    const FOND = ['bg', 'ink'].join('-')
    const PREMIER_PLAN = ['text', 'gold'].join('-')

    // La variante qui s'inverse est légitime : on ne signale QUE l'or fixe,
    // c'est-à-dire `text-gold` non suivi d'un tiret.
    const orFixe = new RegExp(`${PREMIER_PLAN}(?![\\w-])`)
    const fondEncre = new RegExp(`${FOND}(?![\\w-])`)

    const coupables = sources(SRC)
      .map((chemin) => ({ chemin, code: sansCommentaires(readFileSync(chemin, 'utf8')) }))
      .flatMap(({ chemin, code }) =>
        code
          .split('\n')
          // Les deux classes doivent vivre sur la même ligne : c'est ainsi que
          // Tailwind les compose, et c'est la seule proximité qu'on puisse
          // établir en lisant du texte.
          .map((ligne, i) => ({ ligne, numero: i + 1 }))
          .filter(({ ligne }) => fondEncre.test(ligne) && orFixe.test(ligne))
          .map(({ numero }) => `${chemin.slice(SRC.length + 1)}:${numero}`),
      )

    expect(coupables).toEqual([])
  })
})
