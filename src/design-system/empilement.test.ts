import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du BORD BAS de la couche collante.
 *
 * Deux surfaces peintes se disputaient le même bord, à la même altitude, et
 * personne ne l'a vu pendant des lots : la barre de navigation mobile
 * d'`AppShell` et le bandeau « nouvelle version » portent l'une et l'autre
 * `fixed`, le bord bas, et le MÊME `var(--z-sticky)`. À z-index égal la
 * cascade ne tranche pas — c'est l'ordre du document, et `main.tsx` rend le
 * bandeau APRÈS `<App />`, délibérément, pour qu'il couvre aussi l'accueil et
 * l'inscription.
 *
 * Mesuré au navigateur à 375 px : barre à top=759 h=53, bandeau à top=716
 * h=97. `document.elementFromPoint(largeur / 2, hauteur - 20)` rendait le
 * bouton « Recharger » du bandeau, jamais le lien de navigation. Les cinq
 * destinations mobiles étaient donc inatteignables — pas en permanence, ce qui
 * se serait vu, mais à partir du déploiement suivant : le défaut n'apparaît
 * qu'au moment où l'on a le plus besoin de naviguer.
 *
 * AUCUN TEST NE RENDAIT `BandeauVersion`, et c'est la vraie cause. Le défaut
 * n'est pas DANS un composant, il est ENTRE deux composants que rien ne monte
 * ensemble. Un test de rendu aurait pu les réunir ; il n'aurait rien prouvé.
 * jsdom ne pose aucune géométrie — `getBoundingClientRect` rend des zéros,
 * `elementFromPoint` ne consulte aucune peinture, et `var(--z-sticky)` y reste
 * une chaîne jamais résolue. On aurait obtenu un vert pour de mauvaises
 * raisons, ce que `zonesSures.test.ts` et `cibles.test.ts` refusent déjà :
 * monter un composant et interroger son style rendu confirme le comportement
 * de jsdom, pas celui d'un téléphone. Le fichier est la source de vérité,
 * c'est le fichier qu'on interroge.
 *
 * LA RÈGLE : un seul propriétaire du bord bas sur la couche collante. Toute
 * autre surface épinglée à cette altitude s'écarte de la hauteur réservée,
 * `--h-barre-basse`, que la coquille de gestion élève tant qu'elle monte sa
 * barre et qui vaut 0 partout ailleurs.
 *
 * LE CORRECTIF A TROIS MOITIÉS, et chacune est inerte sans les deux autres :
 * le jeton déclaré dans la feuille, la coquille qui l'élève, le bandeau qui le
 * lit. Retirer la première rend les deux suivantes muettes ; retirer la
 * deuxième laisse le bandeau collé au bord ; retirer la troisième ramène le
 * recouvrement d'origine. Les trois sont gardées séparément, plus bas.
 *
 * LIMITE ASSUMÉE, la même que `cibles.test.ts` : la granularité est celle
 * d'UNE balise ouvrante. Une surface qui recevrait son épinglage ou son
 * altitude d'une variable partagée passerait entre les mailles. C'est voulu —
 * la règle pousse à écrire l'épinglage, le bord et l'altitude au même endroit,
 * ce qui est précisément ce qui les empêche de diverger.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/*
  Motifs assemblés par FRAGMENTS.

  Tailwind v4 lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair : un garde qui écrit
  `bottom-0` fabrique l'utilitaire qu'il surveille. Le piège a déjà coûté une
  classe fantôme dans le CSS livré, et `graisses.test.ts` le documente.

  `fixed` échappe à la règle pour la raison qui l'y fait échapper dans
  `zonesSures.test.ts` : le mot n'est pas décomposable en fragments qui
  restent lisibles, et l'utilitaire est de toute façon produit par les quatre
  surfaces épinglées du produit.
*/
const EPINGLEE = /(?<![-\w])fixed(?![-\w])/
const BORD_BAS = new RegExp(`(?<![-\\w])${['bottom', '0'].join('-')}(?![-\\w])`)
const RESERVE = ['--h', 'barre', 'basse'].join('-')
const COLLANTE = `var(${['--z', 'sticky'].join('-')})`

/**
 * L'UNIQUE propriétaire du bord bas, nommé et motivé.
 *
 * Une exemption sans raison écrite devient le tapis sous lequel on glisse le
 * prochain défaut — c'est `cibles.test.ts` qui l'écrit, et c'est exactement ce
 * que ce garde existe pour empêcher. Elle se repère par un fragment de sa
 * balise, jamais par un numéro de ligne qui dériverait au premier remaniement.
 */
const PROPRIETAIRE = {
  fichier: 'components/layout/AppShell.tsx',
  marqueur: "aria-label={t('nav.quickNav')}",
  raison:
    'La barre de navigation basse EST la surface dont la hauteur est réservée : elle ' +
    'ne peut pas s’écarter d’elle-même. C’est elle qui touche le bord physique, et ' +
    'c’est pour elle que `--h-barre-basse` existe.',
}

/* -------------------------------------------------------------------------- */
/* Lecture des sources                                                        */
/* -------------------------------------------------------------------------- */

/** Fichiers examinés : le JSX livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx$/.test(entree)) return []
    if (/\.test\.tsx$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Commentaires BLANCHIS, et non retirés.
 *
 * Les retirer écraserait un bloc de vingt lignes en une seule, et tout numéro
 * rapporté ensuite désignerait la mauvaise ligne. Dans un dépôt qui commente
 * autant, le décalage est systématique et rend le message trompeur au moment
 * précis où on s'y fie : quand il échoue. C'est aussi ce qui permet aux
 * commentaires de `BandeauVersion` de NOMMER les classes qu'ils expliquent
 * sans faire rougir le garde qui vient de les corriger.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

/**
 * Les attributs d'une balise ouvrante — `className` ET `style` ensemble.
 *
 * L'unité ne peut pas être le seul `className`, comme dans `zonesSures.test.ts` :
 * l'altitude de ces surfaces vit dans `style={{ zIndex: … }}`, parce qu'un
 * z-index tiré d'un jeton n'a pas d'utilitaire Tailwind. Les deux moitiés du
 * conflit sont donc dans la même balise, et c'est la balise qu'on lit.
 *
 * On suit la profondeur des accolades et des parenthèses, et on IGNORE le `>`
 * d'une fonction fléchée : sans cette précaution la lecture s'arrête au premier
 * `onClick={() =>` venu, ce qui coupe la balise avant son `style`. Le piège est
 * documenté dans `cibles.test.ts`, où il avait fait rapporter quarante-neuf
 * manquements pour dix-sept.
 */
/**
 * L'ouverture d'une balise JSX, et rien d'autre.
 *
 * Le contexte gauche n'est pas décoratif : sans lui, `Map<string, string>`,
 * `useState<Role>` et `Ref<HTMLElement>` sont lus comme des balises. La
 * conséquence n'est pas un faux positif anodin — la lecture des attributs court
 * alors jusqu'à la fin du fichier, y ramasse au passage `fixed`, le bord bas et
 * l'altitude collante, et le garde accuse une balise qui n'existe pas.
 */
const BALISE_OUVRANTE = /(?<=^|[\s(){}[\],=>])<[A-Za-z][\w.]*(?=[\s/>])/g

function attributs(source: string, debut: number): string {
  let profondeur = 0
  for (let i = debut; i < source.length; i++) {
    const c = source[i]
    if (c === '{' || c === '(') profondeur++
    else if (c === '}' || c === ')') profondeur--
    else if (c === '>' && profondeur === 0 && source[i - 1] !== '=') return source.slice(debut, i)
  }
  return source.slice(debut)
}

interface Surface {
  fichier: string
  ligne: number
  balise: string
}

/**
 * Les surfaces qui réclament le bord bas nu, sur la couche collante.
 *
 * Séparé du parcours de l'arbre pour pouvoir être exercé sur une source
 * TÉMOIN. Un contrôle qui n'affirme qu'une absence ne distingue pas un dépôt
 * sain d'un détecteur cassé — la leçon est celle de `cibles.test.ts`, où
 * élargir un motif faisait passer le produit entier en silence.
 */
function surfacesBasses(relatif: string, brut: string): Surface[] {
  const source = sansCommentaires(brut)
  const trouvees: Surface[] = []

  for (const trouve of source.matchAll(BALISE_OUVRANTE)) {
    const balise = attributs(source, trouve.index)
    if (!EPINGLEE.test(balise)) continue
    if (!BORD_BAS.test(balise)) continue
    if (!balise.includes(COLLANTE)) continue
    trouvees.push({
      fichier: relatif,
      ligne: source.slice(0, trouve.index).split('\n').length,
      balise,
    })
  }

  return trouvees
}

const BASSES: Surface[] = fichiersSources(SRC).flatMap((chemin) =>
  surfacesBasses(chemin.slice(SRC.length + 1), readFileSync(chemin, 'utf8')),
)

/* -------------------------------------------------------------------------- */

describe('bord bas de la couche collante', () => {
  /**
   * GARDE DU GARDE, et vérification que l'exemption a toujours un objet.
   *
   * Un analyseur qui ne trouve rien valide n'importe quoi ; et une exemption
   * qui ne désigne plus rien couvrira un jour une surface qu'on n'a pas
   * examinée. Les deux se disent d'une seule assertion : la barre basse, et
   * elle seule, doit apparaître au rapport.
   */
  it('trouve la barre de navigation, et elle seule, sur ce bord', () => {
    expect(BASSES.map((s) => `${s.fichier}:${s.ligne}`)).toHaveLength(1)
    expect(BASSES[0]?.fichier).toBe(PROPRIETAIRE.fichier)
    expect(BASSES[0]?.balise).toContain(PROPRIETAIRE.marqueur)
  })

  it('ne laisse le bord bas qu’à la barre de navigation', () => {
    const usurpateurs = BASSES.filter(
      (s) => !(s.fichier === PROPRIETAIRE.fichier && s.balise.includes(PROPRIETAIRE.marqueur)),
    ).map((s) => `${s.fichier}:${s.ligne} — doit s’écarter de ${RESERVE}`)

    expect(usurpateurs, 'surfaces empilées sur la barre basse').toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel le reste ne garde rien.
   *
   * Trois formes, et la règle doit trancher les trois dans le bon sens : la
   * surface qui prend le bord nu à cette altitude est fautive ; celle qui
   * s'écarte de la réserve ne l'est pas ; celle qui vit sur une AUTRE couche —
   * le toast, l'écran du menu public — ne concerne pas cette règle, elle passe
   * déjà par-dessus tout et c'est son office.
   */
  it('reconnaît les trois formes sur une source témoin', () => {
    const bas = ['bottom', '0'].join('-')
    const ecarte = `${['bottom', '[var('].join('-')}${RESERVE},0px)]`
    const flottante = `var(${['--z', 'toast'].join('-')})`
    const epinglee = ['inset', 'x', '0'].join('-')

    const temoin = [
      `<nav className={cn('fixed ${epinglee} ${bas}')} style={{ zIndex: '${COLLANTE}' }}>`,
      `<div className={cn('fixed ${epinglee} ${ecarte}')} style={{ zIndex: '${COLLANTE}' }}>`,
      `<div className={cn('fixed ${epinglee} ${bas}')} style={{ zIndex: '${flottante}' }}>`,
    ].join('\n')

    expect(surfacesBasses('temoin.tsx', temoin).map((s) => s.ligne)).toEqual([1])
  })
})

/**
 * LES TROIS MOITIÉS DU CORRECTIF.
 *
 * La règle ci-dessus ne voit qu'une absence : elle resterait verte si le jeton
 * disparaissait de la feuille, si la coquille cessait de l'élever, ou si le
 * bandeau était simplement supprimé. Chacune de ces trois pièces se garde donc
 * pour elle-même, comme les deux moitiés de `zonesSures.test.ts` — dont l'une
 * rend l'autre inerte quand elle tombe.
 */
describe('la réserve du bord bas', () => {
  it('est déclarée dans la feuille de jetons, et vaut zéro par défaut', () => {
    // Zéro par défaut : le bandeau vit aussi sur l'accueil, la connexion et
    // l'inscription, où aucune barre basse n'est montée et où il doit toucher
    // le bord physique. Un défaut à 4rem y laisserait une bande vide.
    const css = readFileSync(join(ICI, 'tokens.css'), 'utf8')
    expect(css).toContain(`${RESERVE}: 0px`)
    expect(css).toContain(`${RESERVE}-montee: 4rem`)
  })

  it('est élevée par la coquille, seule à monter une barre basse', () => {
    // Sans cette écriture, `main` perdrait aussi sa marge de fin de
    // défilement : la barre recouvrirait la dernière ligne de chaque page,
    // c'est-à-dire le défaut d'origine rendu à l'identique.
    const code = sansCommentaires(readFileSync(join(SRC, PROPRIETAIRE.fichier), 'utf8'))
    expect(code).toContain(`setProperty('${RESERVE}'`)
    expect(code).toContain(`${RESERVE})+env(`)
  })

  it('est lue par le bandeau de version, qui partage cette altitude', () => {
    const code = sansCommentaires(
      readFileSync(join(SRC, 'components/feedback/BandeauVersion.tsx'), 'utf8'),
    )
    expect(code).toContain(RESERVE)
  })
})
