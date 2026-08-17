import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde des couches CSS.
 *
 * Ce test existe à cause d'un défaut qui a vécu longtemps sans être vu :
 * `controlClasses` posait `focus:outline-none`, et cela annulait l'anneau de
 * focus de TOUS les champs de saisie du produit — `Input`, `PasswordInput`,
 * `Select`, `Textarea`, `Combobox`, donc le formulaire d'inscription en entier.
 * Il ne restait qu'un changement de couleur de bordure d'un pixel, à 1,33:1
 * contre le fond du champ. Naviguer au clavier revenait à avancer à l'aveugle.
 *
 * Le piège n'est pas une affaire de spécificité, et c'est ce qui le rend
 * difficile à voir en lisant le code. `*:focus-visible` est déclaré dans
 * `@layer base` ; l'utilitaire `outline-none` atterrit dans `@layer utilities` ;
 * et une couche déclarée PLUS TARD l'emporte quelle que soit la spécificité des
 * sélecteurs. Un sélecteur universel bat donc ici une classe, à l'envers de
 * l'intuition. Le même mécanisme est documenté dans `tokens.css` pour la
 * bascule `.on-dark`, où la leçon avait été tirée — et manquée ici.
 *
 * D'où un test qui lit les SOURCES plutôt que le DOM. jsdom ne calcule pas les
 * couches en cascade : monter un champ et interroger son style rendu
 * confirmerait le comportement de jsdom, pas celui du navigateur. Le fichier
 * est la source de vérité, c'est le fichier qu'on interroge.
 *
 * La règle appliquée est volontairement absolue : aucune neutralisation
 * d'`outline` nulle part dans `src/`. Une exception légitime existe en théorie
 * — supprimer le contour du navigateur pour en dessiner un meilleur — mais elle
 * suppose que le remplaçant soit hors `@layer`, faute de quoi il tombe dans le
 * même piège. Tant qu'aucun cas réel ne se présente, l'interdiction franche
 * vaut mieux qu'une heuristique qui laisserait repasser le défaut d'origine.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Fichiers de source examinés : le code livré, pas les tests ni les types. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.(tsx?|css)$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Retire les commentaires avant l'examen.
 *
 * Sans cela, le test se déclenchait sur le commentaire qui EXPLIQUE le défaut,
 * dans le fichier même où il avait été corrigé. Un garde qui interdit de nommer
 * ce contre quoi il protège pousse à supprimer l'explication pour faire passer
 * la suite — exactement le mauvais réflexe. On examine donc le code, et lui
 * seul.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('anneau de focus', () => {
  it('n’est neutralisé nulle part dans les sources', () => {
    // `outline-none` couvre l'utilitaire Tailwind sous toutes ses variantes
    // (`focus:`, `focus-visible:`, `active:`…) ; `outline: none` couvre le CSS
    // brut. Les deux produisent la même panne.
    const coupables = fichiersSources(SRC)
      .map((chemin) => ({ chemin, code: sansCommentaires(readFileSync(chemin, 'utf8')) }))
      .filter(({ code }) => /outline-none|outline:\s*none/.test(code))
      .map(({ chemin }) => chemin.slice(SRC.length + 1))

    expect(coupables).toEqual([])
  })
})
