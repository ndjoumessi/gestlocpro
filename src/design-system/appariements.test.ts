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

/**
 * Les séries de l'histogramme, sur le fond de CARTE.
 *
 * Elles portent de l'information : le seuil est 3:1, celui d'un élément non
 * textuel porteur de sens. Rien ne le vérifiait — le fichier de jetons récite
 * les ratios en commentaire, et un commentaire ne se recalcule pas quand on
 * change une teinte.
 *
 * Ce garde est né d'un remaniement volontaire : le loyer occupe environ 90 % de
 * chaque colonne et prenait la teinte la plus SOMBRE de l'échelle, ce qui
 * faisait de douze colonnes un mur. Les trois séries ont été réassignées pour
 * que la plus grande surface porte le moins de poids. Un tel échange se fait à
 * l'œil ; le seuil, lui, doit se mesurer, et dans les deux thèmes.
 */
describe('séries de l’histogramme', () => {
  const CSS = readFileSync(join(SRC, 'design-system', 'tokens.css'), 'utf8')
  const NU = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const CODE = sansCommentaires(
    readFileSync(join(SRC, 'components', 'primitives', 'Charts.tsx'), 'utf8'),
  )

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

  function luminance(hexa: string): number {
    const [r, v, b] = [0, 2, 4]
      .map((i) => parseInt(hexa.slice(1).substr(i, 2), 16))
      .map((c) => {
        const n = c / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      })
    return 0.2126 * r + 0.7152 * v + 0.0722 * b
  }

  function ratio(a: string, b: string): number {
    const [x, y] = [luminance(a), luminance(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  /**
   * Les jetons de l'HISTOGRAMME EMPILÉ, lus dans sa table.
   *
   * Portés sur `SERIES_COLORS` et non sur tous les `var(--color-data-N)` du
   * fichier : l'histogramme simple, voisin, emploie `--color-data-1` pour une
   * série unique dont aucune ne domine, et l'y inclure ferait échouer un choix
   * parfaitement valide.
   */
  const TABLE = /const SERIES_COLORS: Record<string, string> = \{([\s\S]*?)\}/.exec(CODE)?.[1] ?? ''
  const EMPLOYES = [...TABLE.matchAll(/var\(--color-(data-\d)\)/g)].map(
    ([, nom]) => `--color-${nom}`,
  )

  const BLOCS = {
    clair: corps('@theme'),
    'sombre (systeme)': corps('@media (prefers-color-scheme: dark)'),
    'sombre (choisi)': corps(":root[data-theme='dark']"),
  }

  it('emploie bien trois séries distinctes', () => {
    expect(EMPLOYES).toHaveLength(3)
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    for (const serie of EMPLOYES) {
      it(`tient 3:1 pour ${serie} en ${theme}`, () => {
        const fond = jeton(bloc, '--color-surface')
        const r = ratio(jeton(bloc, serie), fond)
        expect(r, `${theme} : ${serie} sur ${fond} — ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
      })
    }
  }
})

/**
 * La pastille de comptage, sur son fond qui s'inverse.
 *
 * Troisième occurrence du même défaut d'appariement, et la plus retorse : la
 * pastille était `bg-danger` + `text-on-dark`, juste en thème clair. En sombre
 * `--color-danger` s'éclaircit en saumon, et le commentaire de sa version
 * sombre annonçait justement une encre FONCÉE — mais la pastille vit dans la
 * barre latérale, sous `.on-dark`, et cette classe FIGE `--color-on-dark` à
 * blanc. Clair sur clair : 2,49:1.
 *
 * Le garde lit donc le premier plan là où il est réellement résolu, y compris
 * sous la bascule de contexte, et vérifie la paire dans les trois blocs.
 */
describe('pastille de comptage', () => {
  const CSS = readFileSync(join(SRC, 'design-system', 'tokens.css'), 'utf8')
  const NU = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

  function corps(entete: string): string {
    const debut = NU.indexOf(entete)
    if (debut === -1) throw new Error(`bloc introuvable : ${entete}`)
    let profondeur = 0
    for (let i = NU.indexOf('{', debut); i < NU.length; i++) {
      if (NU[i] === '{') profondeur++
      else if (NU[i] === '}' && --profondeur === 0) return NU.slice(NU.indexOf('{', debut) + 1, i)
    }
    throw new Error(`accolade non refermée après ${entete}`)
  }
  function jeton(bloc: string, nom: string): string {
    const t = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
    if (!t) throw new Error(`jeton absent : ${nom}`)
    return t[1]
  }
  function luminance(h: string): number {
    const [r, v, b] = [0, 2, 4]
      .map((i) => parseInt(h.slice(1).substr(i, 2), 16))
      .map((c) => {
        const n = c / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      })
    return 0.2126 * r + 0.7152 * v + 0.0722 * b
  }
  function ratio(a: string, b: string): number {
    const [x, y] = [luminance(a), luminance(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  const BLOCS = {
    clair: corps('@theme'),
    'sombre (systeme)': corps('@media (prefers-color-scheme: dark)'),
    'sombre (choisi)': corps(":root[data-theme='dark']"),
  }

  it('emploie un premier plan qui suit son fond', () => {
    // `text-on-dark` est figé à blanc sous `.on-dark` : il ne peut pas servir
    // sur une surface qui, elle, s'inverse.
    const badge = sansCommentaires(
      readFileSync(join(SRC, 'components', 'primitives', 'Badge.tsx'), 'utf8'),
    )
    const ligne = badge.split('\n').find((l) => /danger:/.test(l) && /bg-danger/.test(l)) ?? ''
    expect(ligne).toContain('text-on-danger')
    expect(ligne).not.toContain('text-on-dark')
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    it(`tient 4,5:1 en ${theme}`, () => {
      const r = ratio(jeton(bloc, '--color-on-danger'), jeton(bloc, '--color-danger'))
      expect(r, `${theme} — ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    })
  }
})

/**
 * Le séparateur du fil d'Ariane.
 *
 * Il portait `text-border-strong` : un jeton de BORDURE employé pour un glyphe.
 * 1,66:1 en clair, 2,42 en sombre — sous le seuil de 3:1 des éléments non
 * textuels. Le fil perdait sa structure : on devinait la séparation plutôt
 * qu'on ne la voyait.
 *
 * Ces chiffres ont d'abord été mal mesurés, et c'est ce qui rend ce garde
 * utile : la barre supérieure est peinte en `oklab()` avec alpha, notation
 * qu'une lecture naïve des nombres d'une chaîne CSS interprète comme du RGB.
 * Le premier relevé annonçait 2,72 en sombre et des valeurs absurdes en clair.
 * Le garde, lui, lit les jetons, dont les ratios sont vérifiables.
 */
describe('séparateur du fil d’Ariane', () => {
  const CSS = readFileSync(join(SRC, 'design-system', 'tokens.css'), 'utf8')
  const NU = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

  function corps(entete: string): string {
    const debut = NU.indexOf(entete)
    if (debut === -1) throw new Error(`bloc introuvable : ${entete}`)
    let profondeur = 0
    for (let i = NU.indexOf('{', debut); i < NU.length; i++) {
      if (NU[i] === '{') profondeur++
      else if (NU[i] === '}' && --profondeur === 0) return NU.slice(NU.indexOf('{', debut) + 1, i)
    }
    throw new Error(`accolade non refermée après ${entete}`)
  }
  function jeton(bloc: string, nom: string): string {
    const t = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
    if (!t) throw new Error(`jeton absent : ${nom}`)
    return t[1]
  }
  function luminance(h: string): number {
    const [r, v, b] = [0, 2, 4]
      .map((i) => parseInt(h.slice(1).substr(i, 2), 16))
      .map((c) => {
        const n = c / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      })
    return 0.2126 * r + 0.7152 * v + 0.0722 * b
  }
  function ratio(a: string, b: string): number {
    const [x, y] = [luminance(a), luminance(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  const BLOCS = {
    clair: corps('@theme'),
    'sombre (systeme)': corps('@media (prefers-color-scheme: dark)'),
    'sombre (choisi)': corps(":root[data-theme='dark']"),
  }

  it('n’emploie pas un jeton de bordure pour un glyphe', () => {
    const coque = sansCommentaires(
      readFileSync(join(SRC, 'components', 'layout', 'AppShell.tsx'), 'utf8'),
    )
    const ligne = coque
      .split('\n')
      .findIndex((l) => /aria-hidden="true"/.test(l) && /text-/.test(l) && /muted-soft|border-strong/.test(l))
    expect(ligne, 'séparateur introuvable').toBeGreaterThan(-1)
    expect(coque.split('\n')[ligne]).not.toContain('border-strong')
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    it(`tient le seuil non textuel de 3:1 en ${theme}`, () => {
      // Sur `--color-paper` : la barre supérieure en est un voile à 88 %, donc
      // la composition y retombe à un cheveu près.
      const r = ratio(jeton(bloc, '--color-muted-soft'), jeton(bloc, '--color-paper'))
      expect(r, `${theme} — ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    })
  }
})
