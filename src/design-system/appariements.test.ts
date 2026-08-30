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
 * Un fond en `--color-ink` associé à un texte en `--color-accent` tenait 5,83:1 en
 * clair et tombait à **2,33:1** en sombre. Les deux jetons étaient pourtant
 * parfaitement définis dans les deux thèmes : `--color-ink` s'inverse — sombre
 * en clair, clair en sombre — tandis que `--color-accent` garde sa valeur. C'est
 * donc leur MISE EN PAIRE qui casse, pas l'un ni l'autre. Aucune lecture du
 * fichier de jetons ne pouvait le révéler ; il a fallu parcourir les écrans un
 * par un pour le trouver, sur trois sites dont la tuile SÉLECTIONNÉE d'un
 * formulaire d'inscription — l'élément le moins lisible de sa carte.
 *
 * La règle est donc simple et vaut mieux qu'une heuristique : sur un fond qui
 * s'inverse, la couleur de premier plan doit s'inverser aussi. `--color-accent-on-ink`
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
    const PREMIER_PLAN = ['text', 'accent'].join('-')

    // La variante qui s'inverse est légitime : on ne signale QUE l'accent fixe
    // — que `orFixe` nomme encore d'après l'or de marque d'alors —,
    // c'est-à-dire `text-accent` non suivi d'un tiret.
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
 * « Loyer » prenait `--color-data-1`, qui vaut `#131a22` en thème clair —
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
describe('pastilles de la lecture du graphe', () => {
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
   * Le fond RÉEL, lu là où il est peint — ET IL A CHANGÉ DE CÔTÉ.
   *
   * ═══ CE QUE CE GARDE TENAIT, ET POURQUOI IL LE TIENT ENCORE ═══
   *
   * La lecture du graphe était peinte sur `--color-ink` sous la portée
   * `.on-dark`, qui refixe cette encre à sa valeur SOMBRE dans les deux thèmes.
   * Un garde qui lisait `--color-ink` dans la palette mesurait donc un fond que
   * le composant n'avait jamais — il avait ainsi « prouvé » qu'il fallait des
   * jetons inversants, ce qui réparait le clair en rendant la pastille
   * invisible en sombre.
   *
   * ═══ CE QUI A CHANGÉ ═══
   *
   * La lecture a quitté le fond encre : elle vit sur la SURFACE DE LA CARTE,
   * bordée, et ses pastilles prennent la palette des barres. La règle, elle,
   * n'a pas bougé d'un mot — c'est la même phrase qui la porte : « le fond d'un
   * composant se lit là où il est PEINT, pas dans la palette dont il tire son
   * nom. » Seul le fond qu'on va lire est l'autre.
   *
   * `--color-surface` s'inverse AVEC le thème et aucune portée ne le refixe : on
   * le lit donc dans chaque bloc de palette, et non une fois pour toutes comme
   * `.on-dark` l'imposait. C'est le sens du `FOND` devenu une fonction.
   */
  const fondDe = (bloc: string) => jeton(bloc, '--color-surface')

  /**
   * Les séries de la lecture, lues DANS SA TABLE plutôt que recopiées.
   *
   * Cette liste était figée à la main, et elle a périmé sans bruit. Le lot qui a
   * inversé l'ordre des teintes — la plus grande surface porte le moins de poids
   * — a repeint la lecture en `data-6`, `data-4` et `data-3`, pendant que le
   * garde continuait de mesurer `data-1`, `data-4` et `data-5`. UNE SEULE des
   * trois séries affichées était donc surveillée ; les deux autres passaient
   * sans contrôle, et deux jetons que plus personne ne peint étaient déclarés
   * sains à chaque exécution.
   *
   * C'est le défaut le plus insidieux d'un garde : il n'échoue pas, il achète de
   * la confiance sans rien tenir. On extrait donc la table à la source, avec sa
   * garde du garde.
   */
  const TABLE =
    /const SERIES_COLORS: Record<string, string> = \{([\s\S]*?)\}/.exec(CODE)?.[1] ?? ''
  const SERIES = [...TABLE.matchAll(/var\((--color-data-\d)\)/g)].map(([, nom]) => nom)

  it('lit bien les trois séries de la lecture', () => {
    // Une extraction qui rend une liste vide ne mesure rien et passe au vert :
    // exactement le silence qu'on vient de corriger.
    expect(SERIES).toHaveLength(3)
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    for (const serie of SERIES) {
      it(`détache ${serie} du fond de la lecture en ${theme}`, () => {
        const pastille = jeton(bloc, serie)
        const fond = fondDe(bloc)
        const ecart = Math.abs(clarte(pastille) - clarte(fond))
        expect(
          ecart,
          `${theme} : ${serie} ${pastille} sur ${fond} — ΔL* ${ecart.toFixed(1)}`,
        ).toBeGreaterThan(20)
      })
    }
  }

  it('peint la lecture avec la palette de ses propres barres', () => {
    /*
      UNE SEULE TABLE POUR LA CARTE, et c'est l'inverse exact de ce que ce cas
      exigeait hier.

      Il demandait `SERIES_COLORS_ON_DARK` — la palette inversée — parce que la
      lecture était le seul objet à fond sombre de la carte. Elle ne l'est plus,
      et la conséquence saute aux yeux dès qu'on la nomme : la pastille « Loyer »
      de la lecture était d'une AUTRE teinte que la barre juste au-dessus d'elle
      et que la légende juste à côté. Trois repères, trois couleurs, une seule
      série.

      La règle qu'on tient est donc la même à un mot près : la pastille prend la
      palette du fond sur lequel elle se pose. Ce fond est désormais celui de la
      carte, et c'est `SERIES_COLORS` qui le sert — celle des barres.
    */
    const code = sansCommentaires(readFileSync(join(SRC, 'components', 'primitives', 'Charts.tsx'), 'utf8'))
    const lignes = code.split('\n').filter((l) => /color:\s*SERIES_COLORS/.test(l))
    expect(lignes.length, 'aucune pastille de lecture trouvée').toBeGreaterThan(0)
    for (const ligne of lignes) {
      expect(ligne).not.toContain(['SERIES_COLORS', 'ON_DARK'].join('_'))
    }
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

  /**
   * Les jetons que ce fichier PEINT, toutes marques confondues.
   *
   * Plus large qu'`EMPLOYES`, et à dessein : une opacité ne connaît pas les
   * tables. Elle s'applique à ce qui se trouve sous elle, et l'histogramme
   * simple — `data-1` pour les mois révolus, `accent-ink` pour le mois courant,
   * `muted-soft` pour une période sans relevé — était le premier concerné.
   */
  const MARQUES = [
    ...new Set(
      [...CODE.matchAll(/var\(--color-(data-\d|accent-ink|muted-soft)\)/g)].map(
        ([, nom]) => `--color-${nom}`,
      ),
    ),
  ]

  /**
   * Les OPACITÉS littérales du composant. C'est l'angle mort qui a laissé passer
   * trois défauts d'affilée.
   *
   * Le garde mesurait les jetons NUS et les déclarait à 3,16, 4,50 et 5,82 en
   * clair — vrai du jeton, faux de la marque. Le composant peignait la dernière
   * colonne à 0,55 AU REPOS (1,78 / 2,09 / 2,35 sur la carte), les colonnes non
   * visées à 0,40 (1,50 / 1,67 / 1,81) et les parts d'anneau à 0,35. Aucun de
   * ces chiffres n'est atteignable sans composer l'alpha sur le fond, et le
   * défaut n'est pas théorique : le 0,40 se déclenche aussi au FOCUS, donc c'est
   * un état stable, atteint au clavier, pas un instant de survol.
   *
   * `scripts/contrast-audit.js` ne pouvait pas les voir non plus : il n'écarte
   * l'opacité que si elle vaut exactement `0`, ne la compose jamais, et ignore
   * tout élément sans texte propre — une barre en est un. Doublement aveugle.
   *
   * La liste reste VIDE tant qu'aucune marque ne dépend d'une transparence : la
   * boucle ne mesure alors rien, et c'est l'état voulu. Elle mord dès qu'une
   * opacité revient dans un `style`.
   */
  function alphasDe(source: string): number[] {
    return [
      ...new Set(
        source
          .split('\n')
          .filter((ligne) => /\bopacity\b\s*[:=]/.test(ligne))
          .flatMap((ligne) =>
            [...ligne.matchAll(/(?:^|[^\w.])(0?\.\d+)/g)].map(([, a]) => Number(a)),
          ),
      ),
    ]
  }

  const ALPHAS = alphasDe(CODE)

  /** La couleur RÉELLEMENT peinte : la teinte, son alpha, et ce qu'elle recouvre. */
  function composer(teinte: string, fond: string, alpha: number): string {
    const canaux = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(1).substr(i, 2), 16))
    const [t, f] = [canaux(teinte), canaux(fond)]
    return (
      '#' +
      [0, 1, 2]
        .map((i) =>
          Math.round(t[i] * alpha + f[i] * (1 - alpha))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    )
  }

  /**
   * Le jeton de la période SANS RELEVÉ, lu dans le ternaire qui la peint.
   *
   * Elle prenait `--color-divider` : 1,29:1 sur la carte claire, 1,13:1 en
   * sombre. Le raisonnement du commentaire était juste — « la colonne reste
   * visible et cliquable », sans quoi le trou se lirait comme un mois qui
   * n'existe pas — mais la valeur du jeton le démentait : à 1,29:1, un filet de
   * deux pixels ne se voit pas, et le défaut que le commentaire prétendait
   * éviter était précisément celui qu'il produisait.
   */
  const ABSENTE = /background:\s*bar\.value === null\s*\?\s*'var\((--color-[\w-]+)\)'/.exec(
    CODE,
  )?.[1]

  const BLOCS = {
    clair: corps('@theme'),
    'sombre (systeme)': corps('@media (prefers-color-scheme: dark)'),
    'sombre (choisi)': corps(":root[data-theme='dark']"),
  }

  it('emploie bien trois séries distinctes', () => {
    expect(EMPLOYES).toHaveLength(3)
  })

  it('sait extraire une opacité littérale', () => {
    // Garde du garde. Sans lui, une expression régulière cassée rendrait une
    // liste vide, la boucle ne mesurerait rien, et la suite passerait au vert
    // pour la pire des raisons — celle-là même que la liste de séries figée du
    // bloc précédent a servie pendant tout un lot.
    expect(alphasDe('opacity: isLast ? 0.55 : 1')).toEqual([0.55])
    expect(alphasDe('opacity={active ? 0.35 : 1}')).toEqual([0.35])
    // Un nombre à virgule qui n'est pas une opacité ne doit pas être mesuré.
    expect(alphasDe('height: `${ratio * 0.5}%`')).toEqual([])
  })

  it('trouve bien les marques peintes par le fichier', () => {
    expect(MARQUES.length).toBeGreaterThanOrEqual(3)
  })

  it('ne peint pas une période sans relevé avec un jeton de séparateur', () => {
    expect(ABSENTE, 'jeton de la barre absente introuvable').toBeDefined()
    expect(ABSENTE).not.toBe('--color-divider')
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    for (const serie of EMPLOYES) {
      it(`tient 3:1 pour ${serie} en ${theme}`, () => {
        const fond = jeton(bloc, '--color-surface')
        const r = ratio(jeton(bloc, serie), fond)
        expect(r, `${theme} : ${serie} sur ${fond} — ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
      })
    }

    it(`la période sans relevé tient 3:1 en ${theme}`, () => {
      const fond = jeton(bloc, '--color-surface')
      const r = ratio(jeton(bloc, ABSENTE ?? ''), fond)
      expect(r, `${theme} : ${ABSENTE} sur ${fond} — ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    })

    // La marque telle qu'elle est PEINTE, alpha composé sur la carte : c'est la
    // seule mesure qui corresponde à ce que l'œil reçoit.
    for (const alpha of ALPHAS) {
      for (const marque of MARQUES) {
        it(`tient 3:1 pour ${marque} à ${alpha} d’opacité en ${theme}`, () => {
          const fond = jeton(bloc, '--color-surface')
          const peint = composer(jeton(bloc, marque), fond, alpha)
          const r = ratio(peint, fond)
          expect(
            r,
            `${theme} : ${marque} à ${alpha} donne ${peint} sur ${fond} — ${r.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(3)
        })
      }
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

  /**
   * LE SÉPARATEUR A DISPARU AVEC LE FIL D'ARIANE, et ce cas a changé d'objet.
   *
   * Il visait UNE ligne : le glyphe « / » entre le nom du parc et celui de
   * l'écran. Le lot de la coquille a retiré le fil — il annonçait « PARC DE
   * DÉMONSTRATION / TABLEAU DE BORD » quinze pixels au-dessus d'un `<h1>` qui
   * disait « Tableau de bord » — et cette assertion cherchait donc une ligne
   * qui n'existe plus. Elle échouait sur un produit correct, ce qui est la
   * pire espèce de garde.
   *
   * Plutôt que de la supprimer, on l'ÉLARGIT à l'invariant qu'elle défendait
   * vraiment : un jeton de BORDURE ne peint pas un glyphe, nulle part dans la
   * coquille. `--color-border-strong` tenait 1,66:1 en clair et 2,42 en
   * sombre, sous le seuil de 3:1 des éléments non textuels ; le fil n'était
   * qu'un de ses emplois possibles.
   *
   * Le motif de classe est assemblé par FRAGMENTS : ce fichier est balayé par
   * le générateur d'utilitaires, et un nom écrit en entier serait réellement
   * produit dans la feuille livrée.
   */
  it('n’emploie nulle part un jeton de bordure comme encre', () => {
    const coque = sansCommentaires(
      readFileSync(join(SRC, 'components', 'layout', 'AppShell.tsx'), 'utf8'),
    )
    const encreDeBordure = new RegExp('text' + '-' + 'border' + '-' + 'strong')
    const fautives = coque.split('\n').filter((l) => encreDeBordure.test(l))
    expect(fautives, 'jeton de bordure employé comme encre').toEqual([])
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
