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

/**
 * Pastilles de série sur l'infobulle des graphiques.
 *
 * Le défaut jumeau du précédent, et plus silencieux encore. La pastille
 * « Loyer » prenait `--color-data-1`, qui vaut `#14201e` en thème clair —
 * exactement la valeur de `--color-ink`, dont l'infobulle fait son fond. Elle
 * était peinte, à la bonne taille, à la bonne place, de la couleur du fond.
 * Les deux autres séries, teintes moyennes, s'en tiraient : une ligne sur trois
 * perdait son repère de couleur sans que rien ne signale l'absence.
 *
 * La bascule `.on-dark` ne pouvait rien : elle redirige des CLASSES
 * utilitaires, et la pastille reçoit sa couleur par un `style` en ligne.
 *
 * On vérifie donc l'ÉCART réel entre chaque teinte de l'infobulle et le fond
 * qu'elle occupe, dans les deux thèmes — c'est le seul angle qui attrape une
 * pastille invisible, aucune couverture de jetons ne pouvant la voir.
 */
describe('pastilles de l’infobulle', () => {
  const CSS = readFileSync(join(SRC, 'design-system', 'tokens.css'), 'utf8')
  const NU = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

  function corps(entete: string): string {
    const debut = NU.indexOf(entete)
    if (debut === -1) throw new Error(`bloc introuvable : ${entete}`)
    let profondeur = 0
    for (let i = NU.indexOf('{', debut); i < NU.length; i++) {
      if (NU[i] === '{') profondeur++
      else if (NU[i] === '}' && --profondeur === 0)
        return NU.slice(NU.indexOf('{', debut) + 1, i)
    }
    throw new Error(`accolade non refermée après ${entete}`)
  }

  function jeton(bloc: string, nom: string): string {
    const t = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
    if (!t) throw new Error(`jeton absent : ${nom}`)
    return t[1]
  }

  /** Clarté CIE L*, comme pour le squelette : c'est elle qui dit si l'œil sépare deux aplats. */
  function clarte(hexa: string): number {
    const [r, v, b] = [0, 2, 4]
      .map((i) => parseInt(hexa.slice(1).substr(i, 2), 16))
      .map((c) => {
        const n = c / 255
        return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      })
    const y = 0.2126 * r + 0.7152 * v + 0.0722 * b
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
  }

  const BLOCS = {
    clair: corps('@theme'),
    'sombre (systeme)': corps('@media (prefers-color-scheme: dark)'),
    'sombre (choisi)': corps(":root[data-theme='dark']"),
  }

  /**
   * Le fond RÉEL, lu là où il est peint.
   *
   * C'est le piège qui a coûté une correction fausse. `--color-ink` s'inverse
   * avec le thème dans les blocs de palette — mais l'infobulle porte `.on-dark`,
   * et cette classe la REFIXE à sa valeur sombre pour tout ce qui vit dessous.
   * Un garde qui lit la palette mesure donc un fond que ce composant n'a jamais.
   * Il avait ainsi « prouvé » qu'il fallait des jetons inversants, ce qui a
   * réparé le thème clair en rendant la pastille invisible en sombre.
   *
   * On lit le bloc `.on-dark` lui-même : une seule valeur, pour les deux thèmes,
   * ce qui est exactement ce que le composant voit.
   */
  const FOND = jeton(corps('.on-dark'), '--color-ink')

  /** Les trois séries que l'infobulle affiche. */
  const SERIES = ['--color-data-1-on-dark', '--color-data-4-on-dark', '--color-data-5-on-dark']

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    for (const serie of SERIES) {
      it(`détache ${serie} du fond de l’infobulle en ${theme}`, () => {
        const pastille = jeton(bloc, serie)
        const ecart = Math.abs(clarte(pastille) - clarte(FOND))
        expect(
          ecart,
          `${theme} : ${serie} ${pastille} sur ${FOND} — ΔL* ${ecart.toFixed(1)}`,
        ).toBeGreaterThan(20)
      })
    }
  }

  it('peint l’infobulle avec les contreparties, jamais avec les teintes claires', () => {
    // La correction consiste à choisir la BONNE table ; l'oubli consiste à
    // reprendre celle des barres, qui vivent sur une carte claire.
    const code = sansCommentaires(readFileSync(join(SRC, 'components', 'primitives', 'Charts.tsx'), 'utf8'))
    const lignesInfobulle = code
      .split('\n')
      .filter((l) => /color:\s*SERIES_COLORS/.test(l))
    expect(lignesInfobulle.length, 'aucune pastille d’infobulle trouvée').toBeGreaterThan(0)
    for (const ligne of lignesInfobulle) expect(ligne).toContain('SERIES_COLORS_ON_DARK')
  })
})
