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
