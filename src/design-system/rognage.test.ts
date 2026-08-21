import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde contre ce qui se peint HORS d'une boîte qui rogne.
 *
 * L'infobulle du graphe empilé a vécu un lot entier invisible. Elle flottait
 * au-dessus de sa colonne, ancrée par `bottom-full` — donc entièrement à
 * l'extérieur de son parent — et la zone de tracé est passée à
 * `overflow-x-auto` pour porter le plancher de pas de 24 px. Or `overflow-x`
 * non visible CONTRAINT AUSSI l'axe vertical : le navigateur n'accepte pas un
 * `visible` d'un côté et un `auto` de l'autre. Mesuré : sur 158 px de haut,
 * 154 étaient rognés. Il en restait quatre.
 *
 * Le défaut n'a été trouvé qu'en survolant une colonne, à la main, en cherchant
 * autre chose. Aucun test ne rendait ce composant — `grep Tooltip` sur les
 * fichiers de test rendait zéro — et aucune garde ne pouvait le voir : les
 * gardes de ce dossier lisent des fichiers, et la géométrie n'est pas dans le
 * fichier.
 *
 * CE QUI EST DANS LE FICHIER, en revanche, c'est la CONTRADICTION : un ancrage
 * hors boîte et un conteneur qui rogne, déclarés dans la même source. C'est
 * elle qu'on interdit ici. Ce n'est pas la mesure du rognage — c'est la
 * cohabitation qui le rend possible.
 *
 * LIMITE ASSUMÉE, dite comme `zonesSures.test.ts` dit la sienne : la
 * granularité est celle d'un FICHIER. Un ancrage hors boîte et un conteneur qui
 * rogne peuvent coexister dans un même fichier sans être imbriqués — deux
 * composants voisins, par exemple. La règle demande alors une exemption
 * nommée, et c'est le bon prix : elle force à écrire pourquoi les deux ne se
 * rencontrent pas, ce qui est exactement ce que personne n'avait vérifié.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/*
  Motifs assemblés par FRAGMENTS.

  Tailwind lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair. Le piège a déjà coûté
  une classe fantôme dans le CSS livré, et `graisses.test.ts` le documente.
*/
const COTES = ['bottom', 'top', 'left', 'right'].join('|')
const HORS_BOITE = new RegExp(`\\b(?:${COTES})-${'full'}\\b`)
const ROGNEUR = new RegExp(`\\b${'overflow'}-(?:x-|y-)?(?:${['auto', 'scroll', 'hidden', 'clip'].join('|')})\\b`)

/**
 * Les cohabitations TOLÉRÉES, nommées et motivées.
 *
 * Aucune aujourd'hui, et c'est le but. Une entrée devenue sans objet fait
 * rougir la garde du garde plus bas : une liste d'exceptions qu'on n'élague
 * pas devient le tapis sous lequel on glisse le prochain défaut.
 */
const TOLERES: { fichier: string; raison: string }[] = []

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
 * Les commentaires sont RETIRÉS avant lecture.
 *
 * Ce n'est pas un détail de confort : la première rédaction de cette garde,
 * essayée à la main, a signalé `Charts.tsx` alors que le code était corrigé —
 * le seul `bottom-full` restant vivait dans le commentaire qui EXPLIQUE le
 * correctif. Une garde qui lit les commentaires accuse les fichiers les mieux
 * documentés.
 *
 * Ses voisines les BLANCHISSENT sur place, pour garder les numéros de ligne
 * justes. Pas ici : ce contrôle nomme des fichiers, jamais des lignes, et une
 * mutation l'a prouvé — écraser un bloc en un espace ne le fait pas broncher.
 * Un mécanisme dont on ne peut pas montrer l'effet ne doit pas figurer dans le
 * code : il apprendrait au prochain lecteur à en recopier un qui compte.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

/** Ce fichier fait-il cohabiter un ancrage hors boîte et un rogneur ? */
function cohabitationDe(brut: string): boolean {
  const source = sansCommentaires(brut)
  return HORS_BOITE.test(source) && ROGNEUR.test(source)
}

describe('rien ne se peint hors d’une boîte qui rogne', () => {
  it('ne laisse aucun ancrage hors boîte cohabiter avec un conteneur qui rogne', () => {
    const fautifs = fichiersSources(SRC)
      .filter((chemin) => cohabitationDe(readFileSync(chemin, 'utf8')))
      .map((chemin) => chemin.slice(SRC.length + 1))
      .filter((relatif) => !TOLERES.some((e) => e.fichier === relatif))

    expect(fautifs).toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel le reste ne garde rien.
   *
   * Un contrôle qui n'affirme qu'une absence ne distingue pas un dépôt sain
   * d'un détecteur cassé. Ce dépôt l'a payé deux fois en deux jours : une règle
   * de recouvrement élargie à tout, puis un `cn()` pris pour une délégation,
   * faisaient passer le produit ENTIER en silence.
   */
  it('reconnaît la cohabitation, et elle seule', () => {
    const hors = `${'bottom'}-${'full'}`
    const rogneur = `${'overflow'}-x-${'auto'}`

    // Les deux ensemble : c'est le défaut.
    expect(cohabitationDe(`<div className="${rogneur}"><span className="absolute ${hors}" /></div>`)).toBe(true)
    // L'un sans l'autre : rien à signaler, une infobulle dans une boîte qui ne
    // rogne pas est parfaitement saine.
    expect(cohabitationDe(`<span className="absolute ${hors}" />`)).toBe(false)
    expect(cohabitationDe(`<div className="${rogneur}" />`)).toBe(false)
    // Et dans un commentaire, jamais : c'est le faux positif qui a failli
    // condamner le fichier qui documente le correctif.
    expect(cohabitationDe(`/* ${hors} dans une ${rogneur} */\n<div />`)).toBe(false)
  })

  /**
   * Une tolérance qui ne couvre plus rien est une tolérance qui ment.
   *
   * Le fichier qu'elle couvrait a pu être corrigé : la ligne reste alors dans
   * la liste, avec sa raison, et blanchira un jour un défaut qu'on n'a pas
   * examiné.
   */
  it('ne garde aucune tolérance devenue sans objet', () => {
    const orphelines = TOLERES.filter(
      (e) => !cohabitationDe(readFileSync(join(SRC, e.fichier), 'utf8')),
    ).map((e) => e.fichier)

    expect(orphelines).toEqual([])
  })
})
