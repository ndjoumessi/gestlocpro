import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde des zones sûres.
 *
 * Le correctif des encoches a DEUX moitiés, et chacune est inutile sans
 * l'autre. C'est ce qui le rend facile à casser par inadvertance, et c'est
 * pourquoi il est gardé ici plutôt que confié à la relecture.
 *
 * Moitié une, `viewport-fit=cover` dans `index.html` : sans elle le navigateur
 * rétrécit la fenêtre d'affichage pour contourner l'encoche, et TOUS les
 * `env(safe-area-inset-*)` valent 0. Le plus beau CSS de zones sûres ne fait
 * alors rien du tout — panne silencieuse, invisible en relecture de diff.
 *
 * Moitié deux, les rembourrages : avec `cover`, la page couvre l'écran entier,
 * donc tout ce qui touchait un bord passe désormais SOUS l'encoche, la Dynamic
 * Island, la barre de gestes iOS ou la barre de navigation Android. Retirer la
 * première moitié rend la seconde inerte ; retirer la seconde rend la première
 * nuisible.
 *
 * Ce test lit les SOURCES et non le DOM, pour la même raison que
 * `theme.test.ts` et `couches.test.ts` : jsdom ne calcule ni `env()` ni les
 * requêtes média. Monter un composant et interroger son style rendu
 * confirmerait le comportement de jsdom, pas celui d'un téléphone. Le fichier
 * est la source de vérité, c'est le fichier qu'on interroge.
 *
 * Limite assumée : la granularité est celle d'UN attribut `className`. Une
 * surface épinglée dont les rembourrages vivraient sur un élément enfant passe
 * donc entre les mailles. C'est voulu — la règle pousse à écrire l'épinglage et
 * son inset au même endroit, ce qui est précisément ce qui les empêche de
 * diverger.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')
const RACINE = join(SRC, '..')

/* -------------------------------------------------------------------------- */
/* Lecture des sources                                                        */
/* -------------------------------------------------------------------------- */

/** Fichiers de source examinés : le code livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx?$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/** Retire les commentaires : ils citent les classes qu'ils expliquent. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Valeurs des attributs `className`, guillemets comme accolades.
 *
 * L'unité d'analyse est l'attribut ENTIER et non le littéral de chaîne : la
 * barre latérale répartit ses classes sur quatre lignes dans un `cn(…)`, et
 * l'épinglage n'est pas dans le même littéral que le rembourrage. Les accolades
 * sont comptées pour trouver la fermante qui correspond, comme `corps()` dans
 * `theme.test.ts`.
 */
function attributsClassName(source: string): string[] {
  const valeurs: string[] = []
  const marqueur = /className=/g
  let trouve: RegExpExecArray | null

  while ((trouve = marqueur.exec(source))) {
    const debut = trouve.index + trouve[0].length

    if (source[debut] === '"') {
      const fin = source.indexOf('"', debut + 1)
      if (fin !== -1) valeurs.push(source.slice(debut + 1, fin))
      continue
    }

    if (source[debut] !== '{') continue
    let profondeur = 0
    for (let i = debut; i < source.length; i++) {
      if (source[i] === '{') profondeur++
      else if (source[i] === '}' && --profondeur === 0) {
        valeurs.push(source.slice(debut + 1, i))
        break
      }
    }
  }

  return valeurs
}

interface Surface {
  fichier: string
  classes: string
}

const SURFACES: Surface[] = fichiersSources(SRC).flatMap((chemin) =>
  attributsClassName(sansCommentaires(readFileSync(chemin, 'utf8'))).map((classes) => ({
    fichier: chemin.slice(RACINE.length + 1),
    classes: classes.replace(/\s+/g, ' ').trim(),
  })),
)

/* -------------------------------------------------------------------------- */
/* Motifs                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Les préfixes négatifs `(?<![-\w])` ne sont pas décoratifs : sans eux
 * `min-h-dvh` — qui ne pose aucun problème, sa hauteur étant un MINIMUM sur du
 * contenu qui coule — se ferait prendre pour `h-dvh`.
 */
const EPINGLEE = /(?<![-\w])(fixed|sticky)(?![-\w])/
const BORD = /(?<![-\w])(inset-|top-|bottom-|left-|right-)/
const PLEINE_HAUTEUR = /(?<![-\w])h-dvh(?![-\w])/
/** `inset-0` et `inset-x-0` touchent les DEUX bords latéraux ; `inset-y-0` non. */
const DEUX_BORDS_LATERAUX = /(?<![-\w])inset-(x-)?0(?![-\w])/
const INSET = 'env(safe-area-inset-'

/**
 * Les deux seules surfaces épinglées qui n'ont légitimement rien à rembourrer.
 * Toute autre doit traiter ses bords ; on ajoute ici en connaissance de cause,
 * pas pour faire taire le test.
 */
const TOLEREES = [
  // Le voile du tiroir : aucun contenu à protéger, et il DOIT couvrir l'écran
  // entier, encoche comprise — c'est tout son office.
  'bg-scrim backdrop-blur-[2px]',
  // Barre latérale en tiroir : ce `className` COMPLÈTE celui que `Sidebar` pose
  // sur elle-même, et les insets vivent là-bas, sur la base commune aux deux
  // variantes (tiroir mobile et rail de bureau).
  'fixed inset-y-0 left-0 flex w-72',
]

const A_TRAITER = SURFACES.filter(
  (s) =>
    !TOLEREES.some((tolere) => s.classes.includes(tolere)) &&
    EPINGLEE.test(s.classes) &&
    (BORD.test(s.classes) || PLEINE_HAUTEUR.test(s.classes)),
)

/* -------------------------------------------------------------------------- */

describe('zones sûres — la balise viewport', () => {
  const HTML = readFileSync(join(RACINE, 'index.html'), 'utf8')

  it('demande `viewport-fit=cover`, sans quoi tous les insets valent 0', () => {
    const balise = HTML.match(/<meta[^>]*name="viewport"[^>]*>/)?.[0]
    expect(balise, 'balise viewport introuvable dans index.html').toBeDefined()
    expect(balise).toMatch(/viewport-fit\s*=\s*cover/)
  })
})

describe('zones sûres — les surfaces épinglées', () => {
  it('l’analyseur trouve bien des surfaces à examiner', () => {
    // Garde du garde : un analyseur qui ne trouve rien valide n'importe quoi.
    // La coquille applicative, la landing, les toasts, les modales et les deux
    // bandeaux en fournissent largement autant.
    expect(A_TRAITER.length).toBeGreaterThan(6)
  })

  it('rembourre chaque surface collante ou fixe contre l’encoche', () => {
    const nues = A_TRAITER.filter((s) => !s.classes.includes(INSET)).map((s) => s.fichier)
    expect([...new Set(nues)], 'surfaces épinglées sans zone sûre').toEqual([])
  })

  it('traite les DEUX côtés quand la surface va d’un bord latéral à l’autre', () => {
    // En paysage, l'encoche mord à gauche OU à droite selon le sens de
    // rotation. Une barre pleine largeur qui ne traiterait qu'un côté est
    // correcte une fois sur deux, ce qui est la pire des situations : le défaut
    // ne se reproduit pas quand on le cherche.
    const bancales = A_TRAITER.filter(
      (s) =>
        DEUX_BORDS_LATERAUX.test(s.classes) &&
        !(s.classes.includes(`${INSET}left`) && s.classes.includes(`${INSET}right`)),
    ).map((s) => s.fichier)

    expect([...new Set(bancales)], 'surfaces pleine largeur à un seul côté traité').toEqual([])
  })
})

describe('zones sûres — composer, jamais substituer', () => {
  it('n’écrit aucun `env()` nu, qui effacerait l’espacement hors encoche', () => {
    /*
      Le piège que cette règle ferme : `pb-4` remplacé par un rembourrage bas
      valant `safe-area-inset-bottom` tout seul. Sur iPhone le résultat semble
      correct, et sur tout appareil sans encoche — c'est-à-dire la majorité du
      parc Android visé — l'inset vaut 0 et l'espacement DISPARAÎT. La panne ne
      se voit pas sur la machine de celui qui écrit le correctif.

      L'exemple n'est volontairement pas écrit sous sa forme Tailwind : le
      scanner lit ce fichier, commentaires compris, et générerait pour de bon
      l'utilitaire nu que la règle interdit. Le même piège a été retiré du
      commentaire d'`index.html`.

      La règle est volontairement absolue : toute valeur arbitraire contenant
      `env(safe-area-inset-*)` doit la composer, par `max(base, env(…))` quand
      l'inset REMPLACE une marge déjà suffisante, ou par `calc(base + env(…))`
      quand la surface est peinte et doit déborder jusqu'au bord physique.
      Une valeur nue peut être juste — quand le rembourrage de base vit
      ailleurs — mais elle cesse de l'être le jour où l'on déplace ce
      rembourrage, sans que rien ne le signale.
    */
    const nus: string[] = []

    for (const { fichier, classes } of SURFACES) {
      for (const [, valeur] of classes.matchAll(/-\[([^\]]*env\(safe-area-inset-[^\]]*)\]/g))
        if (!/max\(|calc\(/.test(valeur)) nus.push(`${fichier} : ${valeur}`)
    }

    expect(nus, 'insets non composés').toEqual([])
  })
})
