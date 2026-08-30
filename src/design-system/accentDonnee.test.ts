import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de l'ACCENT de marque employé comme DONNÉE.
 *
 * `tokens.css` écrit noir sur blanc que `--color-accent` n'est jamais autre chose
 * qu'un fond, une bordure décorative ou une icône : 2,87:1 sur blanc, sous le
 * seuil de 3:1 qu'un élément non textuel porteur de sens doit tenir. Quatre
 * points de code le contredisaient pourtant — la barre du mois courant, la
 * ligne d'objectif, le remplissage de la barre de progression et l'indicateur
 * d'onglet actif. Un commentaire qui proscrit ce que le code fait ne protège
 * personne ; c'est ce test qui le fait tenir.
 *
 * Il lit les FICHIERS SOURCES et le fichier de jetons, jamais le DOM : jsdom ne
 * résout ni les couches Tailwind ni les requêtes média, et un test monté
 * mesurerait le rendu de jsdom plutôt que la décision de design. Même détour
 * que `theme.test.ts` pour le chemin — `fileURLToPath` et non `new URL(...)`,
 * que Vite réécrirait en URL servie.
 *
 * Les motifs de classe sont assemblés par FRAGMENTS et jamais écrits entiers :
 * Tailwind scanne le contenu des fichiers, commentaires compris, et une classe
 * citée en exemple ici finirait générée dans la feuille de style livrée.
 */
const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')

const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')
const CHARTS = readFileSync(join(RACINE, 'components/primitives/Charts.tsx'), 'utf8')
/* `MiniBarChart` a quitté `Charts.tsx` pour sortir 12 949 octets du morceau
   impatient de la vitrine. La barre du mois courant, citée dans `SITES`, est
   dans CE fichier : sans cette ligne, son jeton devenait introuvable et la
   garde rougissait — ce qu'elle a fait, et c'est ainsi qu'on l'a su. */
const MINI = readFileSync(join(RACINE, 'components/primitives/MiniBarChart.tsx'), 'utf8')
const PORTAIL = readFileSync(join(RACINE, 'features/dashboard/TenantPortal.tsx'), 'utf8')

/** Retire les commentaires : ils citent l'or précisément pour dire de l'éviter. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CODE =
  sansCommentaires(CHARTS) + '\n' + sansCommentaires(MINI) + '\n' + sansCommentaires(PORTAIL)

/* --- Contrastes, calculés et non recopiés depuis un commentaire ----------- */

function luminance(hex: string): number {
  const s = hex.replace('#', '')
  const canaux = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(encre: string, fond: string): number {
  const [haut, bas] = [luminance(encre), luminance(fond)].sort((a, b) => b - a)
  return (haut + 0.05) / (bas + 0.05)
}

/** Corps d'un bloc, de l'accolade ouvrante à SA fermante. */
function corps(css: string, entete: string): string {
  const debut = css.indexOf(entete)
  if (debut === -1) throw new Error(`bloc introuvable : ${entete}`)
  let profondeur = 0
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0) return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function jetons(bloc: string): Map<string, string> {
  const trouves = new Map<string, string>()
  for (const [, nom, valeur] of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]?/g))
    trouves.set(nom, valeur.trim())
  return trouves
}

const NU = sansCommentaires(CSS)
const CLAIR = jetons(corps(NU, '@theme'))
const SOMBRE = jetons(corps(corps(NU, '@media (prefers-color-scheme: dark)'), ':root'))

/** Fragments : jamais de classe Tailwind écrite d'un seul tenant. */
const ACCENT = 'accent'
const CLASSES_INTERDITES = [`border-${ACCENT}`, `text-${ACCENT}`]

/**
 * `bg-accent` fait exception, et une seule : l'aplat doré PORTANT DE L'ENCRE.
 *
 * C'est le motif que `tokens.css` sanctionne explicitement — « l'or ne porte
 * jamais de texte : ici c'est un fond, avec de l'encre dessus » — et que
 * `.bg-accent` outille en refixant `--color-ink` sur l'aplat. La pastille
 * d'identité du portail est exactement cela : le doré est décor, la
 * signification est portée par les initiales, en encre, à 5,83:1.
 *
 * La garde interdisait `bg-accent` en bloc dans ces deux fichiers. C'était plus
 * large que la règle qu'elle défend : les quatre points de code d'origine
 * peignaient de la DONNÉE en or, pas un fond sous du texte foncé. On resserre
 * donc sur l'intention, sans rouvrir ce qui avait été fermé.
 *
 * Découpage par LITTÉRAUX et non par lignes : un `cn()` étale ses classes sur
 * plusieurs chaînes, et exiger que l'aplat et l'encre partagent le même
 * littéral fait échouer le cas douteux plutôt que de le laisser passer.
 */
const LITTERAUX = /'[^']*'|"[^"]*"|`[^`]*`/g

describe('l’accent de marque ne porte pas de donnée', () => {
  it('trouve bien les sources à inspecter', () => {
    // Garde du garde : un lecteur qui rend une chaîne vide valide tout.
    expect(CHARTS).toContain('StackedBarChart')
    expect(PORTAIL).toContain('role="tablist"')
    /* Troisième pin d'un hex retiré dans cette refonte, pour la même raison que
       les deux autres : il lisait `toBe('#c58e3e')` et ne prouvait que « la
       couleur n'a pas changé ». Ce qu'il DOIT prouver est que l'analyseur a
       sorti une couleur réelle du bloc clair. */
    expect(CLAIR.get('--color-accent')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('sait reconnaître un contraste insuffisant', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    /* L'or sur blanc — 2,87 — le cas connu qui a motivé toute la correction, et
       qu'on garde comme ÉTALON du calculateur même si l'or a quitté la palette :
       c'est un fait de colorimétrie, pas un état du produit. */
    expect(ratio('#c58e3e', '#ffffff')).toBeLessThan(3)
  })

  it('n’emploie plus la variable CSS d’accent comme remplissage de série', () => {
    // `var(--color-accent)` dans un `style` de barre : c'est de la donnée peinte.
    expect(CODE).not.toContain('var(--color-' + ACCENT + ')')
  })

  it('n’emploie plus les utilitaires d’or nus dans ces deux fichiers', () => {
    // `accent-ink`, `accent-tint`, `accent-border` restent permis : ce sont d'autres
    // jetons. Seul l'accent nu est visé, d'où la limite de mot.
    for (const classe of CLASSES_INTERDITES) {
      const motif = new RegExp(`\\b${classe}\\b(?!-)`)
      expect(motif.test(CODE), `${classe} encore employé`).toBe(false)
    }
  })

  it('n’admet l’aplat d’accent que sous son encre dédiée', () => {
    /*
      L'ENCRE ATTENDUE A CHANGÉ AVEC L'ACCENT, et la règle reste la même : un
      aplat de marque ne se pose JAMAIS nu.

      Elle exigeait `text-ink` — l'encre sombre — parce que l'or, à 2,87:1 sur
      blanc, ne pouvait recevoir que du sombre. Le bleu de l'action est
      l'inverse : `text-ink` n'y rend que 3,39, sous le seuil, et c'est
      `--color-on-accent` qui tient 5,17 dans les deux thèmes. Le cas a rougi
      sur la pastille d'identité du portail au moment exact où l'aplat a changé
      de teinte, ce qui est précisément son travail.
    */
    const aplat = new RegExp(`\\bbg-${ACCENT}\\b(?!-)`)
    const encre = /\btext-on-accent\b(?!-)/
    const fautifs = (CODE.match(LITTERAUX) ?? []).filter(
      (litteral) => aplat.test(litteral) && !encre.test(litteral),
    )
    expect(fautifs, 'aplat d’accent sans son encre dessus').toEqual([])
  })
})

/**
 * Blocs de CLASSE qui refixent des jetons pour tout ce qui vit dessous.
 *
 * Sans eux, le test lit `--color-ink` au niveau du thème et conclut de travers
 * sur la barre sombre : en thème sombre l'encre de thème s'éclaircit, alors que
 * `.on-dark` la rabat à #14201e quel que soit le thème. Le rendu était juste,
 * c'est le modèle qui manquait une couche de la cascade.
 */
const PORTEES = {
  'on-dark': jetons(corps(NU, '.on-dark {')),
  /* `bg-accent` A DISPARU DE CETTE TABLE AVEC SON BLOC CSS, et l'oubli a été
     instructif : `corps()` lève quand le bloc manque, ce fichier a donc cessé
     de s'EXÉCUTER — onze gardes tombées d'un coup, et l'échec vit à la
     COLLECTE, pas sur une assertion. Un filtre de sortie qui ne cherche que
     « AssertionError » ne le voit pas ; seul le compte des tests le trahit.
     C'est la panne que ce dépôt reproche partout ailleurs, arrivée ici. */
} as const

/** Le jeton tel que le voit l'élément : sa portée d'abord, le thème ensuite. */
function resolu(palette: Map<string, string>, portee: Portee, jeton: string) {
  return (portee && PORTEES[portee].get(jeton)) || palette.get(jeton)
}

type Portee = keyof typeof PORTEES | null

/**
 * [rôle, encre, fond, seuil, portée] — le fond est celui SUR lequel l'élément
 * se pose, la portée le bloc de classe sous lequel il vit.
 *
 * Le seuil est 3:1 pour les éléments non textuels mais porteurs de sens, 4,5:1
 * dès qu'il s'agit de texte lu.
 */
const SITES: [string, string, string, number, Portee][] = [
  ['barre du mois courant (MiniBarChart)', '--color-accent-ink', '--color-surface', 3, null],
  ['ligne d’objectif (StackedBarChart)', '--color-accent-ink', '--color-surface', 3, null],
  ['remplissage de progression', '--color-accent-ink', '--color-surface-sunken', 3, null],
  // La rangée d'onglets est passée sur fond sombre : elle se lit désormais
  // sous `.on-dark`, qui fige l'encre, et non plus sur `--color-paper`.
  ['indicateur d’onglet actif (portail)', '--color-accent-on-dark', '--color-ink', 3, 'on-dark'],
  /* Du TEXTE, donc 4,5:1 : les initiales sont lues, pas devinées. L'encre a
     changé avec l'accent — c'était `--color-ink` refixée par un bloc de classe,
     parce que l'or ne pouvait recevoir que du sombre ; c'est `--color-on-accent`
     depuis que l'aplat est bleu, et il n'y a plus de portée à traverser. */
  ['initiales sur la pastille d’identité (portail)', '--color-on-accent', '--color-accent', 4.5, null],
]

describe('le jeton retenu tient le seuil dans les DEUX thèmes', () => {
  it('la portée l’emporte bien sur le thème', () => {
    /*
      Garde du garde : si `resolu` retombait toujours sur le thème, les deux
      sites du portail passeraient pour une raison qui n'est pas la bonne.

      PLUS D'HEX ÉPINGLÉ : la seconde ligne lisait `toBe('#14201e')`, l'encre
      claire d'alors, et tombait au premier repeint. Ce qu'elle prouve est que
      la PORTÉE l'emporte sur le THÈME — donc que, sous `.on-dark` en thème
      sombre, l'encre résolue est celle du bloc de portée et non celle du
      thème. Il suffit de le dire ainsi : les deux résolutions doivent
      DIFFÉRER, et la portée doit rendre exactement ce que le thème CLAIR rend
      sans portée, puisque `.on-dark` fige l'encre claire.
    */
    expect(resolu(SOMBRE, null, '--color-ink')).not.toBe(
      resolu(SOMBRE, 'on-dark', '--color-ink'),
    )
    expect(resolu(SOMBRE, 'on-dark', '--color-ink')).toBe(resolu(CLAIR, null, '--color-ink'))
  })

  for (const [role, encre, fond, seuil, portee] of SITES) {
    it(`${role} tient ${seuil}:1`, () => {
      for (const [nom, palette] of [
        ['clair', CLAIR],
        ['sombre', SOMBRE],
      ] as const) {
        const e = resolu(palette, portee, encre)
        const f = resolu(palette, portee, fond)
        expect(e, `${encre} absent du thème ${nom}`).toBeDefined()
        expect(f, `${fond} absent du thème ${nom}`).toBeDefined()
        expect(
          Number(ratio(e!, f!).toFixed(2)),
          `${role} en ${nom} : ${encre} sur ${fond}`,
        ).toBeGreaterThanOrEqual(seuil)
      }
    })
  }
})
