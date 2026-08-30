import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN SÉPARATEUR SE DÉTACHE DE LA CARTE, DANS LES DEUX THÈMES.
 *
 * LE DÉFAUT QUI A FAIT ÉCRIRE CE FICHIER, ET LA FAÇON DONT IL A SURVÉCU. En
 * thème sombre, `--color-divider` (#252b34) ne s'écartait de `--color-surface`
 * (#1c2128) que de ΔL* 4,8 — la moitié du clair. Les lignes du tableau des
 * paiements se touchaient : le texte se lisait, mais le tableau n'avait plus de
 * rythme.
 *
 * AUCUNE PORTE NE POUVAIT LE VOIR, et il faut dire pourquoi, parce que c'est
 * l'angle mort qu'on ferme ici. Un séparateur n'est ni du TEXTE — pas de seuil
 * 4,5:1 — ni un CONTRÔLE — pas de seuil 3:1 non textuel : WCAG ne le regarde
 * pas, et la mesure de contraste de la porte non plus. `theme.test.ts` vérifie
 * qu'un jeton EXISTE dans les deux thèmes ; il existait, c'était même la cause.
 * `appariements.test.ts` vérifie des couples premier-plan/fond nommés un à un,
 * et celui-ci n'y était pas. Le défaut a donc traversé sept lots de refonte,
 * porte au vert, et il a fallu OUVRIR le produit en sombre pour le voir — ce
 * qu'aucun de ces sept lots n'avait fait.
 *
 * L'INVERSION EST LE PIÈGE, et c'est elle qu'il faut comprendre pour que la
 * règle ait un sens. En clair, le séparateur est plus SOMBRE que tous les
 * fonds : son écart décroît à mesure que le fond fonce — 9,9 sur la carte, 7,4
 * sur le papier, 5,7 sur le creusé. En sombre il est plus CLAIR que tous les
 * fonds, donc l'ordre s'inverse — 11,6 sur le papier, 12,4 sur le creusé, et
 * 4,8 seulement sur la carte, qui est le plus clair des fonds sombres.
 *
 * Un thème sombre n'est pas un thème clair retourné : le fond le plus employé
 * y devient le plus proche du séparateur, et c'est précisément le fond sur
 * lequel un séparateur travaille. Compté dans la page sur deux écrans : 30 des
 * 31 éléments qui portent un séparateur sont posés sur `--color-surface`. La
 * règle ne mesure donc QUE ce fond-là — mesurer les autres reviendrait à
 * garder une paire que personne ne rend.
 *
 * On lit les sources, comme les gardes voisines : jsdom ne résout ni les
 * couches ni `prefers-color-scheme`, et n'y rendrait que le thème clair.
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
    else if (css[i] === '}' && --profondeur === 0) return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function jeton(bloc: string, nom: string): string {
  const trouve = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
  if (!trouve) throw new Error(`jeton absent ou non hexadécimal : ${nom}`)
  return trouve[1]
}

/**
 * Clarté CIE L*, et non le rapport de contraste WCAG — même raison que dans
 * `squelette.test.ts` : rien ne se LIT sur un séparateur, on veut seulement
 * savoir si l'œil distingue un aplat d'un autre. Un rapport de contraste
 * s'écrase près du blanc ; L* dit la même chose en haut et en bas de l'échelle.
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
 * Les trois blocs qui portent la palette. Les deux sombres doivent dire la même
 * chose : un utilisateur qui bascule le sélecteur ne change pas d'écart.
 */
const BLOCS = {
  clair: corps(NU, '@theme'),
  'sombre (système)': corps(NU, '@media (prefers-color-scheme: dark)'),
  'sombre (choisi)': corps(NU, ":root[data-theme='dark']"),
}

/**
 * LA FOURCHETTE, ET CE QUI LA FONDE.
 *
 * Plancher à 8. Le clair tient 9,9 et se lit ; le sombre tenait 4,8 et ne se
 * lisait pas. Entre les deux, 8 laisse au clair un pixel de marge et refuse
 * catégoriquement ce qui a été mesuré comme illisible. Ce n'est pas un seuil
 * perceptuel publié — je n'en connais pas pour cette question — c'est la borne
 * qui sépare le cas qui marche du cas qui ne marchait pas.
 *
 * Plafond à 16. Au-delà, le trait cesse de séparer et se met à encadrer : le
 * dépôt a déjà un jeton pour ça, `--color-border-strong`, qui vit à 22,9 en
 * clair et 23,2 en sombre. Deux jetons au même écart seraient un jeton de trop.
 *
 * `--color-border` est mesuré sous la même règle mais il est SERRÉ contre le
 * plancher en sombre — 8,4 pour 8 exigés. C'est dit ici plutôt que caché : le
 * jour où il faudra y toucher, la marge est de quatre dixièmes.
 */
const PLANCHER = 8
const PLAFOND = 16

const TRAITS = ['--color-divider', '--color-border'] as const

describe('les traits se détachent de la carte', () => {
  it('lit bien les trois blocs de palette', () => {
    // GARDE DE LA GARDE : un découpage cassé rendrait trois blocs vides, et
    // `jeton` lèverait — mais une régression plus subtile (un bloc qui devient
    // le sous-ensemble d'un autre) passerait. Le compte et la taille le disent.
    expect(Object.keys(BLOCS)).toHaveLength(3)
    for (const [nom, bloc] of Object.entries(BLOCS))
      expect(bloc.length, `bloc ${nom} trop court pour porter une palette`).toBeGreaterThan(200)
  })

  for (const [theme, bloc] of Object.entries(BLOCS)) {
    for (const trait of TRAITS) {
      it(`${trait} tient la fourchette sur la carte en ${theme}`, () => {
        const ecart = Math.abs(clarte(jeton(bloc, trait)) - clarte(jeton(bloc, '--color-surface')))
        expect(ecart, `${trait} à ΔL* ${ecart.toFixed(1)} de --color-surface`).toBeGreaterThanOrEqual(
          PLANCHER,
        )
        expect(ecart).toBeLessThanOrEqual(PLAFOND)
      })
    }
  }

  it('dit la même chose dans les deux sombres', () => {
    // Un utilisateur qui force le thème depuis le sélecteur ne doit pas obtenir
    // une autre palette que celui qui le laisse au système. Les deux blocs sont
    // recopiés à la main dans `tokens.css` — c'est le genre de couple qui dérive.
    for (const trait of [...TRAITS, '--color-surface']) {
      expect(jeton(BLOCS['sombre (choisi)'], trait)).toBe(jeton(BLOCS['sombre (système)'], trait))
    }
  })
})
