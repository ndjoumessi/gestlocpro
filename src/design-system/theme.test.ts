import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du thème sombre.
 *
 * Le défaut le plus visible d'un mode sombre n'est pas une teinte discutable :
 * c'est le jeton qu'on a oublié de redéfinir. Il reste clair, et produit un
 * îlot éclatant au milieu d'une page sombre — un fond de carte blanc, une
 * bordure crème, une pastille lumineuse. Rien ne le signale à la compilation,
 * personne ne le voit tant qu'il n'est pas à l'écran.
 *
 * Ce test lit donc le CSS lui-même. Pas le DOM : jsdom ne calcule pas les
 * cascades de couches ni les requêtes média, et un test qui monterait un
 * composant vérifierait le rendu de jsdom, pas le fichier de jetons. La
 * source de vérité est le fichier ; c'est le fichier qu'on interroge.
 *
 * Le chemin part du fichier de test, jamais du répertoire courant : une
 * lecture relative au `cwd` casse dès qu'on lance vitest d'ailleurs que de la
 * racine, et un test d'i18n de ce dépôt s'y était déjà brûlé.
 *
 * Deux détours valent d'être expliqués, parce qu'ils ont chacun coûté un
 * essai. `import './tokens.css?raw'` rend une chaîne VIDE : vitest court-circuite
 * les modules CSS tant que `test.css` n'est pas activé. Et la forme habituelle
 * `new URL('./tokens.css', import.meta.url)` ne survit pas non plus — Vite y
 * reconnaît une référence d'actif statique et la réécrit en URL servie, que
 * `readFileSync` refuse. D'où le passage explicite par `fileURLToPath`, que
 * rien ne réécrit.
 */
const ICI = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/** Retire les commentaires : ils contiennent des accolades et des `--jeton:`. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Corps d'un bloc, de l'accolade ouvrante à SA fermante — imbrication comprise. */
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

/** Déclarations `--nom: valeur` d'un corps, à plat, dans l'ordre du fichier. */
function declarations(bloc: string): Map<string, string> {
  const trouvees = new Map<string, string>()
  for (const [, nom, valeur] of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]?/g))
    trouvees.set(nom, valeur.trim().replace(/\s+/g, ' '))
  return trouvees
}

const NU = sansCommentaires(CSS)

const CLAIR = declarations(corps(NU, '@theme'))
const MEDIA = declarations(corps(corps(NU, '@media (prefers-color-scheme: dark)'), ':root'))
const ATTRIBUT = declarations(corps(NU, ":root[data-theme='dark']"))

/** Les jetons de COULEUR du thème clair — la liste exacte à redéfinir. */
const COULEURS_CLAIRES = [...CLAIR.keys()].filter((n) => n.startsWith('--color-'))

describe('thème sombre — couverture des jetons', () => {
  it('le fichier expose bien une palette claire à couvrir', () => {
    /*
      Garde du garde : un analyseur qui ne trouve rien valide n'importe quoi.

      LA SECONDE ASSERTION N'ÉPINGLE PLUS UN HEX, et c'est un correctif. Elle
      lisait `toBe('#efebe2')` — la valeur exacte du fond clair — ce qui la
      faisait tomber au premier repeint de la palette, sans rien dire de plus
      que « la couleur a changé ». Or ce qu'elle DOIT prouver est autre chose :
      que l'analyseur a lu le bloc CLAIR et non le sombre, et qu'il en a sorti
      une couleur réelle. Les deux lignes ci-dessous le disent sans dépendre
      d'une teinte : un hex bien formé, et surtout DIFFÉRENT de son homologue
      sombre. Un analyseur qui retomberait sur le mauvais bloc les rendrait
      identiques. `MEDIA` est le bloc `prefers-color-scheme`, celui que ce
      fichier compare partout ailleurs.
    */
    expect(COULEURS_CLAIRES.length).toBeGreaterThan(40)
    expect(CLAIR.get('--color-canvas')).toMatch(/^#[0-9a-f]{6}$/)
    expect(CLAIR.get('--color-canvas')).not.toBe(MEDIA.get('--color-canvas'))
    expect(MEDIA.size).toBeGreaterThan(40)
  })

  it('ne laisse aucun jeton de couleur sans redéfinition sombre', () => {
    const oublies = COULEURS_CLAIRES.filter((nom) => !MEDIA.has(nom))
    expect(oublies, 'jetons restés clairs sur fond sombre').toEqual([])
  })

  it('redéfinit aussi les ombres, invisibles telles quelles sur fond sombre', () => {
    // `--shadow-focus` est écrit en `var()` : il suit ses jetons tout seul.
    for (const ombre of ['--shadow-e1', '--shadow-e2', '--shadow-e3'])
      expect(MEDIA.has(ombre), `${ombre} non repris`).toBe(true)
  })

  it('éloigne réellement les surfaces et les encres de leur valeur claire', () => {
    // Une redéfinition qui recopie la valeur claire est une non-redéfinition.
    // Certains jetons gardent leur valeur À DESSEIN — l'or de marque, les
    // contreparties `-on-dark` — donc la règle ne vaut que là où le sens du
    // jeton impose de bouger.
    for (const nom of [
      '--color-canvas',
      '--color-paper',
      '--color-surface',
      '--color-surface-sunken',
      '--color-border',
      '--color-divider',
      '--color-ink',
      '--color-muted',
      '--color-on-dark',
    ])
      expect(MEDIA.get(nom), `${nom} identique au thème clair`).not.toBe(CLAIR.get(nom))
  })
})

describe('thème sombre — les deux blocs restent jumeaux', () => {
  /**
   * CSS ne sait pas partager un corps de règle entre une requête média et un
   * sélecteur d'attribut : la palette sombre est écrite deux fois. Ce test est
   * ce qui rend cette duplication tenable — sans lui, une correction de teinte
   * n'atterrit que dans le thème que le correcteur avait sous les yeux.
   */
  it('déclare la même chose dans le bloc système et dans le bloc explicite', () => {
    expect(Object.fromEntries(ATTRIBUT)).toEqual(Object.fromEntries(MEDIA))
  })
})

describe('thème sombre — le choix explicite gagne dans les deux sens', () => {
  it('rend le clair à qui le demande sous un système sombre', () => {
    // Sans ce `:not()`, un utilisateur en système sombre qui choisit le clair
    // reste en sombre : le cas facile marche, l'autre non.
    expect(NU).toContain(":root:not([data-theme='light'])")
  })

  it('force le sombre sous un système clair', () => {
    expect(NU).toContain(":root[data-theme='dark']")
  })

  it('cadre les widgets natifs sur le thème retenu', () => {
    // Sans `color-scheme`, ascenseurs et sélecteurs de date restent clairs.
    expect(MEDIA.size).toBeGreaterThan(0)
    expect(corps(NU, ":root[data-theme='light']")).toContain('color-scheme: light')
    expect(corps(NU, ":root[data-theme='dark']")).toContain('color-scheme: dark')
    expect(corps(corps(NU, '@media (prefers-color-scheme: dark)'), ':root')).toContain(
      'color-scheme: dark',
    )
  })
})

/* ---------------------------------------------------------------------------
   Contrastes — calculés depuis le fichier, pas recopiés depuis un commentaire.
   Un commentaire de ratio ment dès la première retouche de teinte ; un calcul,
   non.
   ------------------------------------------------------------------------- */

function luminance(hex: string): number {
  const s = hex.replace('#', '')
  const canaux = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Aplatit un `rgba()` sur un fond opaque : le contraste ne se lit qu'opaque. */
function aplati(valeur: string, fond: string): string {
  const rgba = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s/]+([\d.]+)\s*\)/.exec(valeur)
  if (!rgba) return valeur
  const [, r, g, b, a] = rgba.map(Number) as unknown as [string, number, number, number, number]
  const base = fond.replace('#', '')
  const canaux = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16))
  return (
    '#' +
    [r, g, b]
      .map((c, i) => Math.round(c * a + canaux[i] * (1 - a)).toString(16).padStart(2, '0'))
      .join('')
  )
}

function ratio(encre: string, fond: string): number {
  const [haut, bas] = [luminance(encre), luminance(fond)].sort((a, b) => b - a)
  return (haut + 0.05) / (bas + 0.05)
}

/** [encre, fond, seuil] — 4.5 texte courant, 3 grand texte et non textuel. */
const PAIRES: [string, string, number][] = [
  ['--color-ink', '--color-canvas', 4.5],
  ['--color-ink', '--color-paper', 4.5],
  ['--color-ink', '--color-surface', 4.5],
  ['--color-ink', '--color-surface-sunken', 4.5],
  ['--color-ink-2', '--color-surface', 4.5],
  ['--color-ink-3', '--color-surface', 4.5],
  ['--color-muted', '--color-canvas', 4.5],
  ['--color-muted', '--color-paper', 4.5],
  ['--color-muted', '--color-surface', 4.5],
  ['--color-muted', '--color-surface-sunken', 4.5],
  ['--color-accent-ink', '--color-paper', 4.5],
  ['--color-accent-ink', '--color-surface', 4.5],
  ['--color-accent-ink', '--color-accent-tint', 4.5],
  ['--color-accent-ink-hover', '--color-surface', 4.5],
  ['--color-ok', '--color-surface', 4.5],
  ['--color-ok', '--color-ok-tint', 4.5],
  ['--color-warn', '--color-surface', 4.5],
  ['--color-warn', '--color-warn-tint', 4.5],
  ['--color-danger', '--color-surface', 4.5],
  ['--color-danger', '--color-danger-tint', 4.5],
  ['--color-neutral', '--color-surface', 4.5],
  ['--color-neutral', '--color-neutral-tint', 4.5],
  // La surface inversée : `bg-ink` devient clair, `text-on-dark` devient sombre.
  ['--color-on-dark', '--color-ink', 4.5],
  ['--color-on-dark', '--color-ok', 4.5],
  ['--color-on-dark', '--color-danger', 4.5],
  ['--color-on-dark', '--color-danger-strong', 4.5],
  /* C'ÉTAIT `--color-on-dark` SUR L'ACCENT, et la paire a changé de nom avec sa
     réalité. L'aplat d'accent portait l'encre inversée parce que l'or, à
     2,87:1 sur blanc, ne pouvait recevoir que du sombre. Le bleu de l'action
     porte du BLANC — `--color-on-accent` — et c'est cette paire-là qu'il faut
     tenir. Laisser l'ancienne aurait certifié un appariement que plus aucun
     composant ne pose : une garde verte sur une combinaison morte. */
  ['--color-on-accent', '--color-accent', 4.5],
  ['--color-on-dark-muted', '--color-ink', 4.5],
  // Non textuel : icônes, séries de graphique, accents.
  ['--color-muted-soft', '--color-surface', 3],
  ['--color-accent', '--color-surface', 3],
  ['--color-accent', '--color-canvas', 3],
  ['--color-on-dark-faint', '--color-ink', 3],
  ['--color-data-1', '--color-surface', 3],
  ['--color-data-2', '--color-surface', 3],
  ['--color-data-3', '--color-surface', 3],
  ['--color-data-4', '--color-surface', 3],
  ['--color-data-5', '--color-surface', 3],
  ['--color-data-6', '--color-surface', 3],
]

describe('thème sombre — contrastes', () => {
  it('sait reconnaître un contraste insuffisant', () => {
    // Garde du garde : sans ce cas, un calcul faux validerait toute la palette.
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(ratio('#ece7dd', '#26221b')).toBeGreaterThan(4.5)
    expect(ratio('#c58e3e', '#ffffff')).toBeLessThan(3) // l'or sur blanc, connu
    expect(aplati('rgba(20, 32, 30, 0.72)', '#ece7dd')).toBe('#505853')
  })

  for (const [encre, fond, seuil] of PAIRES) {
    it(`${encre.replace('--color-', '')} sur ${fond.replace('--color-', '')} tient ${seuil}:1`, () => {
      const valeurFond = MEDIA.get(fond)
      const valeurEncre = MEDIA.get(encre)
      expect(valeurFond, `${fond} absent du thème sombre`).toBeDefined()
      expect(valeurEncre, `${encre} absent du thème sombre`).toBeDefined()

      const mesure = ratio(aplati(valeurEncre!, valeurFond!), valeurFond!)
      expect(Number(mesure.toFixed(2))).toBeGreaterThanOrEqual(seuil)
    })
  }

  it("conserve l'ordre d'élévation des surfaces", () => {
    // Une carte doit rester au-dessus du fond de page, donc plus claire.
    const echelle = [
      '--color-canvas',
      '--color-surface-sunken',
      '--color-paper',
      '--color-surface',
    ].map((nom) => luminance(MEDIA.get(nom)!))

    expect(echelle, "l'échelle des surfaces n'est plus croissante").toEqual(
      [...echelle].sort((a, b) => a - b),
    )
  })
})
