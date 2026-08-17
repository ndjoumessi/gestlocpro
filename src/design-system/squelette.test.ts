import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du BALAYAGE de squelette.
 *
 * Le défaut : l'animation tournait, et personne ne la voyait.
 *
 * La crête du balayage empruntait `--color-border`. Sur le thème sombre, le
 * creux (`#14110d`) et la bordure (`#3a342a`) sont très éloignés : la crête s'en
 * détachait de ΔL* 16,8 et le reflet se lisait. Sur le thème clair, les mêmes
 * deux jetons sont presque confondus — `#f2f0ea` et `#e5dfd3`, ΔL* 5,8 — et le
 * balayage devenait invisible. Quatre pavés gris parfaitement immobiles, sur
 * l'écran dont l'unique fonction est de montrer que le produit sait attendre.
 *
 * Aucune garde existante ne pouvait le voir. `theme.test.ts` vérifie la
 * COUVERTURE — le jeton était bien défini dans les deux thèmes, c'était même la
 * cause. `appariements.test.ts` vérifie les paires premier-plan/fond du code
 * TSX, et cette paire-ci vit dans une règle CSS. `durees.test.ts` vérifie que
 * l'animation existe et dure ce qu'il faut : elle durait, précisément.
 *
 * Ce que ce fichier tient est donc d'une autre nature : non pas qu'une couleur
 * existe, mais qu'un ÉCART reste perceptible — et qu'il le reste dans les DEUX
 * thèmes, ce qu'aucune inspection d'un seul thème ne peut établir.
 *
 * On lit les sources et non le DOM, comme les gardes voisines : jsdom ne résout
 * ni les couches ni `prefers-color-scheme`, et n'y rendrait que le thème clair.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/** Retire les commentaires : ils citent des hexadécimaux et des `--jeton:`. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Corps d'un bloc, de l'accolade ouvrante à SA fermante, imbrication comprise. */
function corps(css: string, entete: string): string {
  const debut = css.indexOf(entete)
  if (debut === -1) throw new Error(`bloc introuvable dans tokens.css : ${entete}`)
  let profondeur = 0
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0)
      return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function jeton(bloc: string, nom: string): string {
  const trouve = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(bloc)
  if (!trouve) throw new Error(`jeton absent ou non hexadécimal : ${nom}`)
  return trouve[1]
}

/**
 * Clarté CIE L*, et non le rapport de contraste WCAG.
 *
 * WCAG mesure la lisibilité d'un TEXTE sur son fond ; ici rien ne se lit. Ce
 * qu'on veut savoir, c'est si l'œil distingue un aplat d'un autre — c'est L*
 * qui le dit, et il le dit de la même façon en haut et en bas de l'échelle,
 * là où un rapport de contraste s'écrase près du blanc.
 */
function clarte(hexa: string): number {
  const canaux = [0, 2, 4].map((i) => parseInt(hexa.slice(1).substr(i, 2), 16))
  const [r, v, b] = canaux.map((c) => {
    const n = c / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  })
  const y = 0.2126 * r + 0.7152 * v + 0.0722 * b
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
}

const NU = sansCommentaires(CSS)

/**
 * Les trois blocs qui portent la palette : le clair de référence, le sombre
 * automatique et le sombre choisi à la main. Les deux sombres doivent dire la
 * même chose — un utilisateur qui bascule le sélecteur ne change pas d'écart.
 */
const BLOCS = {
  clair: corps(NU, '@theme'),
  'sombre (système)': corps(NU, '@media (prefers-color-scheme: dark)'),
  'sombre (choisi)': corps(NU, ":root[data-theme='dark']"),
}

/**
 * La fourchette.
 *
 * Le plancher à 12 vient du sombre qui fonctionnait déjà, à 16,8 : on garde de
 * la marge sous lui sans descendre vers les 5,8 qui ne se voyaient pas. Le
 * plafond à 24 existe parce qu'un squelette est un ATTENTE, pas une alerte :
 * au-delà, la crête cesse d'être un reflet et devient une barre qui traverse,
 * ce qui attire l'œil sur le décor plutôt que sur le contenu qui arrive.
 */
const PLANCHER = 12
const PLAFOND = 24

describe('balayage de squelette', () => {
  it('a sa propre crête, et n’emprunte plus la couleur des bordures', () => {
    // L'emprunt est la CAUSE du défaut : deux rôles distincts sur un seul
    // jeton, donc un réglage impossible à corriger dans un thème sans le
    // dérégler dans l'autre.
    const regle = corps(NU, '.gl-skeleton::after')
    expect(regle).toContain('var(--color-skeleton-sweep)')
    expect(regle).not.toContain('var(--color-border)')
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    it(`détache la crête du creux en ${theme}`, () => {
      const creux = jeton(bloc, '--color-surface-sunken')
      const crete = jeton(bloc, '--color-skeleton-sweep')
      const ecart = Math.abs(clarte(crete) - clarte(creux))

      expect(
        ecart,
        `${theme} : crête ${crete} sur creux ${creux} — ΔL* ${ecart.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(PLANCHER)
      expect(ecart).toBeLessThanOrEqual(PLAFOND)
    })
  }

  it('garde les deux thèmes sombres identiques', () => {
    expect(jeton(BLOCS['sombre (choisi)'], '--color-skeleton-sweep')).toBe(
      jeton(BLOCS['sombre (système)'], '--color-skeleton-sweep'),
    )
  })
})

/**
 * Garde de la GÉOMÉTRIE du balayage.
 *
 * Une crête unique dans un élément large comme le pavé n'était visible que la
 * moitié du cycle : elle entrait au quart de la course et sortait aux trois
 * quarts, laissant sept dixièmes de seconde d'aplat mort en boucle. Le motif se
 * répète désormais, et la course vaut exactement une période.
 *
 * Ce fichier ne fige pas les VALEURS — 200%, 50%, ±25% peuvent toutes changer
 * ensemble sans dommage. Il fige les deux RELATIONS dont dépend le résultat, et
 * qu'un réglage à l'œil casse sans prévenir parce que les pourcentages se lisent
 * sur des bases différentes : ceux du dégradé et ceux de `translateX` portent
 * sur la largeur de l'élément, pas sur celle du pavé.
 */
describe('géométrie du balayage', () => {
  const REGLE = /\.gl-skeleton::after \{([\s\S]*?)\n\}/.exec(NU)?.[1] ?? ''
  const KEYFRAMES = /@keyframes gl-skeleton-sweep \{([\s\S]*?)\n\}/.exec(NU)?.[1] ?? ''

  /** Largeur de l'élément, en multiples de celle du pavé. */
  const largeur = Number(/width:\s*([\d.]+)%/.exec(REGLE)?.[1]) / 100
  /** Période du motif, exprimée sur la largeur de l'ÉLÉMENT puis ramenée au pavé. */
  const periode = (Number(/transparent\s+([\d.]+)%\s*\n?\s*\)/.exec(REGLE)?.[1]) / 100) * largeur
  /** Course d'un cycle, même conversion. */
  const bornes = [...KEYFRAMES.matchAll(/translateX\((-?[\d.]+)%\)/g)].map(([, v]) => Number(v))
  const course = ((Math.max(...bornes) - Math.min(...bornes)) / 100) * largeur

  it('répète le motif plutôt que de promener une crête unique', () => {
    // Une crête seule ne peut pas être partout : c'est la répétition qui fait
    // qu'une autre entre à gauche quand la première sort à droite.
    expect(REGLE).toContain('repeating-linear-gradient')
  })

  it('parcourt exactement une période, pour que la boucle ne se voie pas', () => {
    // Course plus COURTE que la période : un trou où rien ne passe. Plus
    // LONGUE : un saut à la reprise, la crête se téléportant en arrière.
    expect(course, `course ${course} pavé(s) contre période ${periode}`).toBeCloseTo(periode, 5)
  })

  it('couvre le pavé à tout instant de la course', () => {
    // L'élément se déplace : s'il n'est pas plus large que le pavé PLUS sa
    // course, il découvre un bord et y laisse une bande morte.
    expect(largeur).toBeGreaterThanOrEqual(1 + course)
  })
})

/**
 * Garde du relais sans mouvement.
 *
 * La règle globale de `prefers-reduced-motion` neutralise toute animation en
 * `!important`. Le balayage ne portant pas de `fill`, la crête retombait alors
 * hors du pavé : quatre aplats morts, sans le moindre repère d'attente pour qui
 * voit l'écran. Les technologies d'assistance, elles, restaient prévenues — ce
 * qui a masqué le trou d'autant plus longtemps.
 *
 * Deux choses se vérifient ici, et la seconde a failli manquer.
 *
 * Que le relais EXISTE. Et qu'il porte `!important` : à importance égale, c'est
 * la spécificité qui départage, mais sans `!important` du tout la déclaration
 * globale — importante, elle — l'emporterait quelle que soit la spécificité.
 * Le relais serait écrit, présent dans la feuille, et sans aucun effet.
 */
describe('relais sans mouvement', () => {
  const REGLE =
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.gl-skeleton::after \{([^}]*)\}/.exec(NU)?.[1] ??
    ''

  it('anime encore le squelette quand le mouvement est réduit', () => {
    expect(REGLE, 'aucun relais `.gl-skeleton::after` sous prefers-reduced-motion').toContain(
      'gl-skeleton-breath',
    )
    expect(NU).toContain('@keyframes gl-skeleton-breath')
  })

  it('l’emporte sur la neutralisation globale', () => {
    // Sans `!important`, la règle serait présente et sans effet : c'est le
    // genre de correctif qu'on croit livré parce qu'on l'a écrit.
    const animation = /animation:[^;]*/.exec(REGLE)?.[0] ?? ''
    expect(animation).toContain('!important')
  })

  it('ne déplace rien : le relais est une opacité, pas un mouvement', () => {
    // Toute la raison d'être de la préférence. Une translation ou une mise à
    // l'échelle ici trahirait l'utilisateur qui a demandé moins de mouvement.
    const corpsAnim = /@keyframes gl-skeleton-breath \{([\s\S]*?)\n\}/.exec(NU)?.[1] ?? ''
    expect(corpsAnim).toContain('opacity')
    expect(corpsAnim).not.toMatch(/translate|scale|rotate/)
    expect(REGLE).toContain('transform: none')
  })

  it('respire assez lentement pour ne pas clignoter', () => {
    // 3 Hz est le seuil photosensible ; on se tient très en dessous.
    const duree = /animation:[^;]*?([\d.]+)s/.exec(REGLE)?.[1]
    expect(duree, 'durée du relais introuvable').toBeDefined()
    expect(1 / Number(duree)).toBeLessThan(1)
  })
})
