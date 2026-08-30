import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN SQUELETTE EMPRUNTE LA GRILLE DE SA RANGÉE CHARGÉE, IL N'EN ÉCRIT PAS UNE.
 *
 * LE DÉFAUT QUI A FAIT ÉCRIRE CE FICHIER. L'espace locataire attendait sous
 * QUATRE cartes égales — `sm:grid-cols-2 xl:grid-cols-4` — et chargeait TROIS
 * cartes inégales — `lg:grid-cols-[1.4fr_1fr_1fr]`. Sur une tablette, deux
 * colonnes pendant l'attente et une seule après ; sur un grand écran, quatre
 * cartes pendant l'attente et trois après. La page se réorganisait entièrement
 * à la seconde où elle cesse d'attendre, c'est-à-dire à la seconde où l'on pose
 * le doigt sur ce qu'on croit avoir vu.
 *
 * POURQUOI RIEN NE POUVAIT LE VOIR. Aucune porte du dépôt ne rend jamais un
 * état de chargement : la démonstration n'attend pas, la vitrine n'a pas de
 * squelette d'écran, et la mesure au navigateur mesure la page CHARGÉE. Le
 * squelette est le seul morceau du produit qu'on écrit sans jamais le regarder.
 * Il a donc dérivé de sa rangée pendant toute une refonte, en silence, et c'est
 * un refactoring — pas un œil, pas une porte — qui a mis les deux littéraux
 * côte à côte.
 *
 * LA RÈGLE EST MÉCANIQUE, et c'est le seul genre qui tienne ici. On ne peut pas
 * comparer statiquement « le nombre de cartes chargées » — elles arrivent par
 * `.map()` sur des données que le fichier ne connaît pas. Ce qu'on PEUT exiger,
 * c'est que les deux rangées lisent LE MÊME NOM : si `SkeletonStatRow` reçoit
 * une constante que la rangée chargée emploie aussi, aucune des deux ne peut
 * bouger sans l'autre. Une chaîne littérale à cet endroit rouvre exactement la
 * porte par laquelle le défaut est entré.
 *
 * Le compte de cartes, lui, reste à la charge de qui écrit : la garde ne sait
 * pas qu'il en faut trois. Elle sait seulement qu'il n'y aura plus deux grilles.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

function sources(depuis: string): string[] {
  const entrees: string[] = []
  for (const nom of readdirSync(depuis)) {
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) entrees.push(...sources(chemin))
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) entrees.push(chemin)
  }
  return entrees
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/*
  MOTIF ASSEMBLÉ PAR FRAGMENTS, comme dans les gardes voisines.

  Tailwind lit les SOURCES comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair. Le dépôt a déjà payé
  une classe fantôme livrée dans le CSS pour cette raison — `graisses.test.ts`
  en tient le récit. Rien de ce fichier ne doit ressembler à une classe.
*/
const COLS = 'grid-' + 'cols-'
const GRILLE_DE_RANGEE = new RegExp(String.raw`["'\`][^"'\`]*\bgrid\b[^"'\`]*\b(?:sm|md|lg|xl):${COLS}`)

/** Les appels à `SkeletonStatRow`, avec le fichier et l'attribut `className`. */
function appels(): { fichier: string; className: string }[] {
  const trouves: { fichier: string; className: string }[] = []
  for (const chemin of sources(SRC)) {
    const source = sansCommentaires(readFileSync(chemin, 'utf8'))
    for (const appel of source.matchAll(/<SkeletonStatRow\b([^>]*)>/g)) {
      const className = /className=(\{[^}]*\}|"[^"]*")/.exec(appel[1])?.[1] ?? ''
      trouves.push({ fichier: relative(SRC, chemin), className })
    }
  }
  return trouves
}

describe('un squelette de rangée emprunte sa grille', () => {
  const sites = appels()

  it('trouve bien les appels à inspecter', () => {
    // GARDE DE LA GARDE. Une garde qui n'inspecte rien passe au vert et ne dit
    // rien : c'est le mode de défaillance que ce dépôt refuse partout. Six
    // écrans portent une rangée d'indicateurs en attente ; si le compte tombe,
    // c'est soit qu'un écran l'a perdue, soit que le motif ne reconnaît plus la
    // forme de l'appel — et dans les deux cas il faut le savoir.
    expect(sites.length).toBeGreaterThanOrEqual(6)
  })

  for (const { fichier, className } of sites) {
    it(`${fichier} : passe un NOM de grille, pas une chaîne`, () => {
      expect(className).not.toBe('')
      // Une accolade contenant un identifiant, et rien d'autre : ni chaîne
      // littérale, ni ternaire — deux grilles derrière un `?` sont deux grilles.
      expect(className).toMatch(/^\{[A-Za-z_$][\w$]*\}$/)
    })

    it(`${fichier} : ce nom sert AUSSI ailleurs dans le fichier`, () => {
      const nom = className.slice(1, -1)
      const source = sansCommentaires(readFileSync(join(SRC, fichier), 'utf8'))
      const emplois = source.match(new RegExp(String.raw`\b${nom}\b`, 'g')) ?? []
      // Trois au moins : l'import (ou la déclaration), la rangée chargée, et
      // l'attente. Deux voudrait dire une constante que SEUL le squelette lit —
      // c'est-à-dire la même divergence sous un autre nom.
      expect(emplois.length).toBeGreaterThanOrEqual(3)
    })
  }

  it('n’écrit pas la même grille des deux côtés de l’attente', () => {
    /*
      LA RÈGLE PORTE SUR UN FICHIER, PAS SUR LE DÉPÔT, et c'est un correctif.

      La première rédaction interdisait toute grille recopiée où que ce soit.
      Elle a rendu huit couples — un formulaire à deux colonnes et une rangée de
      cartes à deux colonnes, une grille de vitrine et une d'inscription. Aucune
      de ces paires n'est un défaut : deux mises en page indépendantes ont le
      droit d'avoir la même forme, et leur donner un nom commun les couplerait
      pour de bon. Une garde qui refuse tout est désactivée dans la semaine.

      Ce qui est un défaut est PLUS ÉTROIT et parfaitement identifiable : la
      même grille écrite une fois dans la fonction d'attente d'un écran et une
      fois dehors. Ces deux-là ne se ressemblent pas par hasard — elles se
      ressemblent parce que l'une SERT à annoncer l'autre — et rien ne les tient
      ensemble tant qu'elles sont deux chaînes.
    */
    const fautives: string[] = []
    let ecransInspectes = 0

    for (const chemin of sources(SRC)) {
      const source = sansCommentaires(readFileSync(chemin, 'utf8'))
      const attente = corpsDesFonctionsDAttente(source)
      if (attente === null) continue
      ecransInspectes++

      const dedans = grilles(attente)
      const dehors = grilles(source.split(attente).join('\n'))
      for (const classe of dedans) {
        if (dehors.has(classe)) fautives.push(`${relative(SRC, chemin)} : « ${classe} »`)
      }
    }

    // GARDE DE LA GARDE : un motif cassé ne trouverait plus une seule fonction
    // d'attente, et la liste des fautives serait vide pour la pire des raisons.
    expect(ecransInspectes).toBeGreaterThanOrEqual(6)
    expect(fautives).toEqual([])
  })
})

/**
 * UN PAVÉ DE SQUELETTE FAIT LA HAUTEUR DE LA LIGNE QU'IL REMPLACE.
 *
 * LA PREMIÈRE RÈGLE DE `Skeleton` EST QU'IL TIENT LA PLACE, et son en-tête le
 * dit en toutes lettres : « un squelette plus court que son contenu ne fait que
 * déplacer le problème — l'attente cesse, la page sursaute, et le doigt tombe à
 * côté de ce qu'il visait ». `LIGNES` porte donc des hauteurs CALCULÉES —
 * taille × interligne — et non choisies à l'œil.
 *
 * ELLES AVAIENT DÉRIVÉ, DANS LES DEUX SENS. Le lot de typographie a supprimé
 * `--text-body-s` (13 px) en migrant ses 110 emplois sur `--text-body` (14) et
 * a replié `--text-title-m` de 17 à 16. `LIGNES` n'a pas suivi : son `bodyS`
 * est resté 2 px trop COURT sur huit emplois, son `title` 1,4 px trop HAUT, et
 * les deux commentaires citaient des tailles qui n'existaient plus. Un jeton se
 * change en une ligne ; les hauteurs qui en dépendent vivent dans un autre
 * fichier et ne bronchent pas.
 *
 * POURQUOI RIEN NE POUVAIT LE VOIR : un squelette n'apparaît sur AUCUN écran de
 * la porte — la démonstration n'attend pas, la vitrine n'en montre pas. Il n'y
 * a que la source pour trancher, et il faut la comparer à `tokens.css`, ce que
 * seule une règle peut faire à chaque passage.
 *
 * LA TOLÉRANCE EST D'UN DEMI-PIXEL. Les hauteurs sont écrites en `rem` à trois
 * décimales : 12 × 1,3 = 15,6 px = 0,975rem tombe juste, 16 × 1,35 = 21,6 px =
 * 1,35rem aussi. Un pixel entier laisserait passer le `title` fautif.
 */
describe('un pavé de squelette tient la place', () => {
  const CSS = readFileSync(join(SRC, 'design-system/tokens.css'), 'utf8')
  const SOURCE = readFileSync(join(SRC, 'components/primitives/Skeleton.tsx'), 'utf8')

  /** Le jeton de taille et son interligne, en pixels, lus dans `tokens.css`. */
  function styleDeTexte(nom: string): { taille: number; interligne: number } {
    const taille = new RegExp(String.raw`${nom}:\s*([\d.]+)rem`).exec(CSS)
    const interligne = new RegExp(String.raw`${nom}--line-height:\s*([\d.]+)`).exec(CSS)
    if (!taille) throw new Error(`jeton de taille introuvable ou fluide : ${nom}`)
    if (!interligne) throw new Error(`interligne introuvable : ${nom}`)
    return { taille: parseFloat(taille[1]) * 16, interligne: parseFloat(interligne[1]) }
  }

  /** La hauteur écrite dans `LIGNES`, en pixels. */
  function hauteurDuPave(cle: string): number {
    const trouve = new RegExp(String.raw`\b${cle}:\s*'h-\[([\d.]+)rem\]'`).exec(SOURCE)
    if (!trouve) throw new Error(`hauteur introuvable dans LIGNES : ${cle}`)
    return parseFloat(trouve[1]) * 16
  }

  /** Le pavé, et le style de texte dont il doit reproduire la boîte de ligne. */
  const ATTELAGES: { pave: string; jeton: string }[] = [
    { pave: 'eyebrow', jeton: '--text-caps' },
    { pave: 'body', jeton: '--text-body' },
    { pave: 'title', jeton: '--text-title-m' },
  ]

  it('couvre les pavés calés sur un jeton de texte', () => {
    // GARDE DE LA GARDE. `kpi` en est absent volontairement : `--text-kpi` n'a
    // pas d'interligne déclaré et vaut 1 par défaut, donc `styleDeTexte`
    // lèverait. Le dire ici plutôt que de laisser croire à une couverture
    // complète — et si `LIGNES` gagne un pavé, le compte doit bouger.
    const cles = [...SOURCE.matchAll(/^\s{2}(\w+): 'h-\[/gm)].map((m) => m[1])
    expect(cles.sort()).toEqual(['body', 'eyebrow', 'kpi', 'title'])
    expect(ATTELAGES).toHaveLength(3)
  })

  for (const { pave, jeton } of ATTELAGES) {
    it(`\`${pave}\` fait la boîte de ligne de \`${jeton}\``, () => {
      const { taille, interligne } = styleDeTexte(jeton)
      const attendu = taille * interligne
      const ecrit = hauteurDuPave(pave)
      expect(
        Math.abs(ecrit - attendu),
        `${pave} vaut ${ecrit.toFixed(1)}px, ${jeton} en mesure ${attendu.toFixed(1)}`,
      ).toBeLessThanOrEqual(0.5)
    })
  }
})

/** Les littéraux de grille responsive d'une portion de source. */
function grilles(source: string): Set<string> {
  const trouvees = new Set<string>()
  for (const ligne of source.split('\n')) {
    if (!GRILLE_DE_RANGEE.test(ligne)) continue
    const litteral = /["'`]([^"'`]*)["'`]/.exec(ligne)?.[1]
    if (litteral) trouvees.add(litteral)
  }
  return trouvees
}

/**
 * Le corps réuni des fonctions `…Skeleton` d'un fichier, ou `null` s'il n'en a
 * aucune. Découpé à l'accolade appariée : un découpage à la ligne vide ou à la
 * fonction suivante ramasserait ce qui vient après.
 */
function corpsDesFonctionsDAttente(source: string): string | null {
  const corps: string[] = []
  for (const debut of source.matchAll(/function \w*Skeleton\w*\s*\(/g)) {
    const ouvrante = source.indexOf('{', debut.index)
    if (ouvrante === -1) continue
    let profondeur = 0
    for (let i = ouvrante; i < source.length; i++) {
      if (source[i] === '{') profondeur++
      else if (source[i] === '}' && --profondeur === 0) {
        corps.push(source.slice(ouvrante, i))
        break
      }
    }
  }
  return corps.length ? corps.join('\n') : null
}
