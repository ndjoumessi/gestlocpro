import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LA BANDE INVERSÉE SE DÉTACHE, ET CE QU'ELLE PORTE RESTE LISIBLE DESSUS.
 *
 * DE QUOI ON PARLE. `.on-dark` est la portée des blocs qui s'inversent : les
 * trois sections d'encre de la vitrine, le pied de page, la bande de marque des
 * écrans d'authentification, `Card tone="dark"`. Elle GÈLE `--color-ink` pour
 * que ces blocs restent sombres quel que soit le thème de la page.
 *
 * LE DÉFAUT, ET IL A TRAVERSÉ TOUTE LA REFONTE. Le gel valait la MÊME valeur
 * dans les deux thèmes, #131a22. En clair, la bande est un coup de tonnerre —
 * ΔL* 88,6 sur le papier — et c'est elle qui donne son rythme à sept mille
 * pixels de vitrine. En sombre, elle tombait à 3,2 : les trois fonds de la page
 * tenaient dans 5,4 ΔL*, la vitrine se lisait comme un seul aplat, et
 * `Card tone="dark"` y était invisible.
 *
 * POURQUOI RIEN NE POUVAIT LE VOIR. Un fond de section n'est ni du texte ni un
 * contrôle : aucun seuil WCAG ne le regarde, donc ni la mesure de contraste du
 * navigateur ni `theme.test.ts`, qui vérifie la COUVERTURE d'un jeton et non
 * l'écart entre deux. Il a fallu ouvrir le produit en sombre pour le voir — ce
 * qu'aucun des sept lots de la refonte n'avait fait.
 *
 * L'ÉTAU QU'IL FAUT COMPRENDRE POUR NE PAS LE REFERMER. Éclaircir la bande est
 * borné des deux côtés :
 *
 *   · PAR LE BAS — une bande qui vaudrait `--color-surface` se confondrait avec
 *     les cartes posées sur la page ;
 *   · PAR LE HAUT — l'aplat d'accent, s'il reste le bleu PLEIN, perd le seuil
 *     non textuel de 3:1 dès que le fond s'éclaircit : mesuré 3,39 sur #131a22,
 *     3,13 sur la carte, 2,76 un cran plus haut.
 *
 * Il n'existe AUCUNE valeur entre les deux tant que l'aplat porte du blanc :
 * cherché par balayage sur toute la famille froide, le meilleur couple rendait
 * 4,70 et 3,08 pour 4,5 et 3 exigés, soit 2,6 % de marge. La sortie n'est pas un
 * autre bleu, c'est l'autre SENS — sous `.on-dark`, en sombre, l'aplat devient
 * la contrepartie CLAIRE de l'accent et son encre passe au sombre.
 *
 * CE FICHIER TIENT LES DEUX BOUTS DE L'ÉTAU À LA FOIS. Une règle qui ne
 * garderait que l'écart de la bande laisserait quelqu'un l'éclaircir et couler
 * l'aplat ; une règle qui ne garderait que l'aplat laisserait quelqu'un
 * rassombrir la bande pour se donner de l'air. Les deux ensemble, et dans les
 * deux thèmes, sont la seule formulation qui décrive la contrainte réelle.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')

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

function jeton(bloc: string, nom: string): string | null {
  const trouve = new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloc)
  return trouve ? trouve[1] : null
}

function exige(bloc: string, nom: string): string {
  const valeur = jeton(bloc, nom)
  if (!valeur) throw new Error(`jeton absent ou non hexadécimal : ${nom}`)
  return valeur
}

/** Clarté CIE L* — voir `separateurs.test.ts` pour le choix de L* plutôt que WCAG. */
function clarte(hexa: string): number {
  const canaux = [0, 2, 4].map((i) => parseInt(hexa.slice(1).substr(i, 2), 16))
  const [r, v, b] = canaux.map((c) => {
    const n = c / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  })
  const y = 0.2126 * r + 0.7152 * v + 0.0722 * b
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
}

/** Rapport WCAG — ici il s'agit bien de lisibilité, d'où le rapport et non L*. */
function rapport(a: string, b: string): number {
  const relative = (hexa: string) => {
    const canaux = [0, 2, 4].map((i) => parseInt(hexa.slice(1).substr(i, 2), 16))
    const [r, v, bl] = canaux.map((c) => {
      const n = c / 255
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * v + 0.0722 * bl
  }
  const [haut, bas] = [relative(a), relative(b)].sort((x, y) => y - x)
  return (haut + 0.05) / (bas + 0.05)
}

const NU = sansCommentaires(CSS)

/** Le gel commun aux deux thèmes. */
const SOCLE = corps(NU, '.on-dark {')

/**
 * Ce qui vaut RÉELLEMENT sous `.on-dark`, thème par thème.
 *
 * TROIS ÉTAGES, ET IL FAUT LES TROIS. La surcharge sombre d'abord, le socle
 * `.on-dark` ensuite, la palette de la page en dernier — c'est la cascade, et la
 * reproduire est le seul moyen de savoir ce qui S'APPLIQUE. Lire la surcharge
 * seule dirait ce qui CHANGE.
 *
 * Le troisième étage n'est pas un détail : `--color-accent` et
 * `--color-on-accent` ne sont PAS figés par `.on-dark` en clair — ils viennent
 * de la palette. Sans lui, la règle levait « jeton absent » sur le thème clair
 * et n'aurait mesuré que le sombre, c'est-à-dire la moitié de la contrainte.
 */
function souLaPortee(surcharge: string | null, page: string) {
  return (nom: string): string =>
    (surcharge && jeton(surcharge, nom)) || jeton(SOCLE, nom) || exige(page, nom)
}

const SURCHARGES = {
  'sombre (système)': corps(NU, ":root:not([data-theme='light']) .on-dark {"),
  'sombre (choisi)': corps(NU, ":root[data-theme='dark'] .on-dark {"),
}

/** Les fonds de page, par thème — ce sont eux dont la bande doit se détacher. */
const PAGES = {
  clair: { bloc: corps(NU, '@theme'), surcharge: null as string | null },
  'sombre (système)': {
    bloc: corps(NU, '@media (prefers-color-scheme: dark)'),
    surcharge: SURCHARGES['sombre (système)'],
  },
  'sombre (choisi)': {
    bloc: corps(NU, ":root[data-theme='dark'] {"),
    surcharge: SURCHARGES['sombre (choisi)'],
  },
}

/**
 * LES SEUILS.
 *
 * `ECART_MINIMAL` à 8 : le sombre tenait 3,2 et ne se voyait pas ; la valeur
 * retenue en rend 14,7. Huit sépare franchement le cas mesuré comme illisible
 * du cas mesuré comme lisible, sans imposer au clair une valeur qu'il dépasse
 * de toute façon d'un ordre de grandeur.
 *
 * `ECART_CARTE` à 4 : en dessous, la bande et une carte posée sur la page se
 * lisent comme un seul plan. La valeur retenue en rend 7,9.
 *
 * 3 et 4,5 sont les seuils WCAG — non textuel pour l'aplat contre sa bande,
 * textuel pour son libellé contre l'aplat.
 */
const ECART_MINIMAL = 8
const ECART_CARTE = 4

describe('la bande inversée', () => {
  it('lit bien les trois portées', () => {
    // GARDE DE LA GARDE : un sélecteur qui cesserait de correspondre rendrait
    // `null`, la surcharge serait ignorée, et l'on mesurerait le socle trois
    // fois en croyant mesurer trois thèmes.
    expect(SOCLE.length).toBeGreaterThan(80)
    for (const [nom, bloc] of Object.entries(SURCHARGES))
      expect(bloc.length, `surcharge ${nom} introuvable ou vide`).toBeGreaterThan(40)
    expect(Object.keys(PAGES)).toHaveLength(3)
  })

  for (const [theme, { bloc, surcharge }] of Object.entries(PAGES)) {
    const sous = souLaPortee(surcharge, bloc)

    it(`se détache du papier en ${theme}`, () => {
      const ecart = Math.abs(clarte(sous('--color-ink')) - clarte(exige(bloc, '--color-paper')))
      expect(ecart, `bande à ΔL* ${ecart.toFixed(1)} du papier`).toBeGreaterThanOrEqual(
        ECART_MINIMAL,
      )
    })

    it(`ne se confond pas avec une carte en ${theme}`, () => {
      const ecart = Math.abs(clarte(sous('--color-ink')) - clarte(exige(bloc, '--color-surface')))
      expect(ecart, `bande à ΔL* ${ecart.toFixed(1)} de la carte`).toBeGreaterThanOrEqual(
        ECART_CARTE,
      )
    })

    it(`porte un aplat d’accent visible sur elle en ${theme}`, () => {
      const r = rapport(sous('--color-accent'), sous('--color-ink'))
      expect(r, `aplat d’accent à ${r.toFixed(2)}:1 sur la bande`).toBeGreaterThanOrEqual(3)
    })

    it(`garde son libellé lisible sur l’aplat en ${theme}`, () => {
      const r = rapport(sous('--color-on-accent'), sous('--color-accent'))
      expect(r, `libellé à ${r.toFixed(2)}:1 sur l’aplat`).toBeGreaterThanOrEqual(4.5)
    })

    it(`garde la carte surélevée AU-DESSUS de son support en ${theme}`, () => {
      // `darkRaised` est la carte posée SUR la bande : sous elle, elle
      // disparaîtrait dans son support — le défaut que ce ton existe pour éviter.
      const ecart = clarte(sous('--color-ink-2')) - clarte(sous('--color-ink'))
      expect(ecart, `carte surélevée à ΔL* ${ecart.toFixed(1)} de la bande`).toBeGreaterThanOrEqual(
        ECART_CARTE,
      )
    })
  }

  it('dit la même chose dans les deux sombres', () => {
    // Les deux blocs sont recopiés à la main : c'est le genre de couple qui
    // dérive, et un utilisateur qui force le thème ne doit pas changer de bande.
    for (const nom of ['--color-ink', '--color-ink-2', '--color-accent', '--color-on-accent']) {
      expect(jeton(SURCHARGES['sombre (choisi)'], nom)).toBe(
        jeton(SURCHARGES['sombre (système)'], nom),
      )
    }
  })

  it('ne surcharge RIEN en clair — le clair fonctionnait', () => {
    /*
      La surcharge est délibérément bornée au sombre : en clair la bande est à
      88,6 du papier et l'aplat plein y tient. Une surcharge non gardée
      éclaircirait l'accent d'une bande qui n'en a pas besoin, et le blanc de son
      libellé tomberait à 1,95:1 — mesuré, à la faveur d'une transition figée qui
      a montré à quoi ressemblerait l'erreur.
    */
    const surLeSocle = ['--color-accent', '--color-on-accent', '--color-accent-hover']
    for (const nom of surLeSocle) expect(jeton(SOCLE, nom), `${nom} figé hors thème`).toBeNull()
  })
})
