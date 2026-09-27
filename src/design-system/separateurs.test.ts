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

/**
 * UN FILET PEUT ÊTRE TRANSLUCIDE, ET IL FALLAIT L'APPRENDRE À CETTE GARDE.
 *
 * Le thème sombre adopté le 2026-09-27 pose `--color-border` en
 * `rgba(255, 255, 255, 0.1)` — la forme de la page de référence. L'ancienne
 * lecture n'acceptait qu'un hexadécimal et levait « jeton absent ou non
 * hexadécimal », ce qui est le pire des trois verdicts possibles : ni vert, ni
 * rouge motivé, mais une panne d'instrument déguisée en défaut.
 *
 * Un filet translucide n'est pas moins mesurable — il est seulement mesurable
 * AILLEURS : sa couleur réelle est celle qu'il rend une fois composé sur ce
 * qu'il borde. On la compose donc sur `--color-surface`, qui est le fond sur
 * lequel 30 des 31 séparateurs du produit sont posés, et la règle reprend
 * telle quelle. CE QUE ÇA NE VOIT PAS : le même filet posé sur un autre fond
 * rend un autre écart, et cette garde n'en mesure qu'un.
 */
function composer(dessus: string, dessous: string, alpha: number): string {
  const c = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(1).substr(i, 2), 16))
  const [a, b] = [c(dessus), c(dessous)]
  return (
    '#' +
    a.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)).toString(16).padStart(2, '0')).join('')
  )
}

function jeton(bloc: string, nom: string, fond?: string): string {
  const hexa = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
  if (hexa) return hexa[1]!
  const rgba = new RegExp(`${nom}\\s*:\\s*rgba\\(\\s*(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)[,\\s/]+([\\d.]+)\\s*\\)`).exec(
    bloc,
  )
  if (rgba && fond) {
    const teinte =
      '#' + [rgba[1], rgba[2], rgba[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')
    return composer(teinte, fond, Number(rgba[4]))
  }
  throw new Error(`jeton absent, ou couleur que cette garde ne sait pas lire : ${nom}`)
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
/*
  ═══ LE PLANCHER EST DESCENDU DE 8 À 6 LE 2026-09-27, SUR DEMANDE ═══

  Le thème adopté ce jour-là pose son filet clair à `#e6ebf1` sur carte blanche,
  soit ΔL* 7,2, et son `--color-divider` à 6,5. Les deux passaient sous 8. Le
  choix qui m'a été donné était explicite — reproduire la page au pixel et
  relâcher la garde, plutôt que d'assombrir le filet de deux points pour tenir
  la borne. C'est donc une DÉCISION, pas une mesure : rien n'a été remesuré qui
  justifierait 6 plutôt que 8.

  CE QUE LA BORNE GARDE ENCORE. Le défaut d'origine — le séparateur sombre à
  ΔL* 4,8, mesuré illisible, les lignes du tableau des paiements qui se
  touchaient — reste refusé, et avec une marge d'un point et demi. C'est la
  seule chose que 6 continue de promettre.

  CE QU'ELLE NE GARDE PLUS. Tout ce qui vit entre 6 et 8. Le clair y est
  maintenant, des deux traits, et personne ne saura dire par une porte s'il se
  lit : la question est redevenue une affaire d'œil sur l'écran.
*/
const PLANCHER = 6
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
        const carte = jeton(bloc, '--color-surface')
        const ecart = Math.abs(clarte(jeton(bloc, trait, carte)) - clarte(carte))
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
    /* La carte sert de fond de composition pour un filet translucide — elle est
       donc lue en premier, et comparée elle aussi. */
    const carteChoisie = jeton(BLOCS['sombre (choisi)'], '--color-surface')
    const carteSysteme = jeton(BLOCS['sombre (système)'], '--color-surface')
    expect(carteChoisie).toBe(carteSysteme)
    for (const trait of TRAITS) {
      expect(jeton(BLOCS['sombre (choisi)'], trait, carteChoisie)).toBe(
        jeton(BLOCS['sombre (système)'], trait, carteSysteme),
      )
    }
  })
})
