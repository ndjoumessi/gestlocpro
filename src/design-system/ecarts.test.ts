import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de l'ÉCART entre deux cibles tactiles.
 *
 * `cibles.test.ts` tient la TAILLE d'une cible et le dit dès sa première ligne.
 * Il ne tient pas la DISTANCE entre deux, et l'inventaire du dépôt le déclarait
 * sans détour : « l'écart de 8 px entre cibles n'est mesuré nulle part ».
 *
 * Deux cibles conformes séparées de quatre pixels se manquent quand même — le
 * doigt couvre plus large que ce qu'il vise. Le pire site du produit mettait
 * ainsi côte à côte, à quatre pixels, une mise en demeure et une quittance :
 * un acte juridique et un document anodin, deux gestes OPPOSÉS.
 *
 * `--spacing` n'étant pas redéfini dans `tokens.css`, l'échelle de Tailwind
 * s'applique : `gap-1` vaut 4 px, `gap-1.5` en vaut 6, `gap-2` en vaut 8. Le
 * standard maison est `gap-2`, employé partout où deux commandes se suivent.
 *
 * CE QUI EST GARDÉ N'EST PAS TOUTE PETITE VALEUR, mais une petite valeur DANS
 * UNE RANGÉE DE COMMANDES. Un `gap-1` entre deux pastilles décoratives, entre
 * deux lignes de texte ou dans une liste ne sépare aucune cible, et l'interdire
 * ferait rougir des dizaines d'endroits sains — c'est exactement le genre de
 * règle trop large que ce dépôt refuse ailleurs par écrit.
 *
 * Le voisinage compte, et non la seule ligne : une liste de classes s'écrit sur
 * plusieurs lignes, et le marqueur de commande tombe souvent trois lignes plus
 * bas. `graisses.test.ts` a payé cette leçon avant nous.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/** Un pas de l'échelle d'espacement de Tailwind vaut 0.25rem, soit 4 px. */
const PAS_PX = 4

/** 8 px : l'écart en dessous duquel deux cibles voisines se confondent. */
const ECART_MIN_PX = 8

/*
  Motifs assemblés par FRAGMENTS.

  Tailwind lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair. Le piège a déjà coûté
  une classe fantôme dans le CSS livré.
*/
const ECART = new RegExp(`\\b${'gap'}-(?:x-|y-)?(\\d+(?:\\.\\d+)?)\\b`, 'g')
const RANGEE = new RegExp(`\\b${'flex'}\\b`)

/** Ce qui, dans le voisinage, désigne une rangée de COMMANDES. */
const COMMANDE = /<Button\b|<IconButton\b|<Link\b|<button\b|role="group"/

/**
 * L'ÉLÉMENT EST LUI-MÊME UNE CIBLE : son écart est alors INTERNE.
 *
 * Un lien « ← Retour » porte `min-h-11` et sépare son icône de son libellé de
 * six pixels. Ce six-là ne sépare pas deux cibles, il compose la seule qu'il y
 * ait — et l'élargir écarterait une flèche de son mot. La première rédaction de
 * cette garde accusait six sites de cette forme, tous sains : un lien de
 * retour sur quatre écrans, une option de contrôle segmenté, un onglet de la
 * barre basse.
 *
 * Le critère qui les distingue existait déjà, à côté : porter un plancher de
 * cible, c'est déclarer qu'on EST une cible.
 */
const EST_UNE_CIBLE = new RegExp(`\\b(?:${['min-h', 'h', 'size'].join('|')})-1[1-9]\\b`)

/** Fenêtre de lecture, en lignes, de part et d'autre de l'écart trouvé. */
const FENETRE = 6

/**
 * Les écarts TOLÉRÉS, nommés et motivés.
 *
 * Aucun aujourd'hui, et c'est le but. La garde du garde plus bas fait rougir
 * une entrée devenue sans objet : une liste d'exceptions qu'on n'élague pas
 * devient le tapis sous lequel on glisse le prochain défaut.
 */
const TOLERES: { fichier: string; ligne: number; raison: string }[] = [
  {
    fichier: 'components/controls/LanguageSwitcher.tsx',
    ligne: 24,
    raison:
      'CONTRÔLE SEGMENTÉ : deux options dans un même cadre bordé, avec son propre ' +
      'rembourrage. Les segments d’un tel contrôle se TOUCHENT par convention — ' +
      'les écarter en ferait deux boutons voisins, ce qui dit autre chose : un ' +
      'segmenté propose un choix EXCLUSIF, deux boutons proposent deux gestes. ' +
      'Chaque segment porte par ailleurs son plancher de 44 px, donc rien ne ' +
      'manque à la cible elle-même.',
  },
  {
    fichier: 'components/controls/ThemeSwitcher.tsx',
    ligne: 74,
    raison: 'Contrôle segmenté à trois options, même raison que le sélecteur de langue.',
  },
  {
    fichier: 'components/primitives/Choice.tsx',
    ligne: 210,
    raison:
      'La primitive de contrôle segmenté elle-même — celle dont les deux sélecteurs ' +
      'ci-dessus reprennent la forme.',
  },
]

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
 * Commentaires BLANCHIS sur place, pour garder les numéros de ligne justes.
 *
 * Ce contrôle rapporte des lignes, contrairement à ses voisins qui nomment des
 * fichiers : les écraser décalerait chaque numéro d'autant que le fichier est
 * commenté, c'est-à-dire beaucoup ici.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

/** Les rangées de commandes trop serrées d'une source. */
export function ecartsTropSerres(relatif: string, brut: string): string[] {
  const lignes = sansCommentaires(brut).split('\n')

  return lignes.flatMap((ligne, i) => {
    if (!RANGEE.test(ligne)) return []

    const trop = [...ligne.matchAll(ECART)].some(
      ([, pas]) => Number(pas) * PAS_PX < ECART_MIN_PX,
    )
    if (!trop) return []

    // L'écart d'une cible avec elle-même n'est pas un écart entre cibles.
    if (EST_UNE_CIBLE.test(ligne)) return []

    const voisinage = lignes.slice(Math.max(0, i - FENETRE), i + FENETRE).join('\n')
    if (!COMMANDE.test(voisinage)) return []

    return [`${relatif}:${i + 1}`]
  })
}

describe('l’écart entre deux cibles', () => {
  it('n’est jamais inférieur au plancher dans une rangée de commandes', () => {
    const fautifs = fichiersSources(SRC).flatMap((chemin) => {
      const relatif = chemin.slice(SRC.length + 1)
      return ecartsTropSerres(relatif, readFileSync(chemin, 'utf8')).filter(
        (site) => !TOLERES.some((e) => `${e.fichier}:${e.ligne}` === site),
      )
    })

    expect(fautifs).toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel le précédent ne garde rien.
   *
   * Un contrôle qui n'affirme qu'une absence ne distingue pas un dépôt sain
   * d'un détecteur cassé. Ce dépôt l'a payé quatre fois cette semaine, et la
   * règle exercée ici est CELLE du contrôle ci-dessus, jamais une paraphrase —
   * une garde qui réécrit sa règle dans son témoin ne garde que la paraphrase.
   */
  it('reconnaît une rangée de commandes trop serrée, et elle seule', () => {
    const serre = `${'gap'}-1`
    const large = `${'gap'}-2`
    const rangee = `${'flex'} items-center`

    // Une rangée de boutons à 4 px : c'est le défaut.
    expect(ecartsTropSerres('t.tsx', `<div className="${rangee} ${serre}">\n<Button />`)).toEqual([
      't.tsx:1',
    ])
    // La même à 8 px : rien à signaler.
    expect(ecartsTropSerres('t.tsx', `<div className="${rangee} ${large}">\n<Button />`)).toEqual([])
    // Serrée mais SANS commande : deux pastilles décoratives ne se visent pas.
    expect(ecartsTropSerres('t.tsx', `<div className="${rangee} ${serre}">\n<span />`)).toEqual([])
    // Une commande sans rangée : l'écart ne concerne que ce qui s'aligne.
    expect(ecartsTropSerres('t.tsx', `<div className="${serre}">\n<Button />`)).toEqual([])
    // Un écart INTERNE à une cible : l'icône et son libellé dans un même lien.
    const cible = `${'min-h'}-11`
    expect(
      ecartsTropSerres('t.tsx', `<Link className="${rangee} ${cible} ${serre}">\n<Icon />`),
    ).toEqual([])
    // Et dans un commentaire, jamais.
    expect(ecartsTropSerres('t.tsx', `/* ${rangee} ${serre} <Button /> */\n<div />`)).toEqual([])
  })

  /** Une tolérance qui ne couvre plus rien est une tolérance qui ment. */
  it('ne garde aucune tolérance devenue sans objet', () => {
    const orphelines = TOLERES.filter((e) => {
      const sites = ecartsTropSerres(e.fichier, readFileSync(join(SRC, e.fichier), 'utf8'))
      return !sites.includes(`${e.fichier}:${e.ligne}`)
    }).map((e) => `${e.fichier}:${e.ligne}`)

    expect(orphelines).toEqual([])
  })
})
