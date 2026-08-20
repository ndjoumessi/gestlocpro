import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde des graisses typographiques.
 *
 * Quatre graisses coexistaient dans l'interface — 400, 500, 600 et 700 — sans
 * que personne ne l'ait décidé. La cause n'était pas la valeur 600 : c'est
 * qu'elle était posée EN LIGNE, à la main, dans une vingtaine de fichiers. Une
 * graisse écrite à côté d'un `text-title-l` échappe à l'échelle typographique,
 * donc elle ne peut plus être arbitrée nulle part — et une deuxième, puis une
 * troisième s'ajoutent sans que le fichier de jetons en sache rien.
 *
 * Quinze titres réassemblaient ainsi la même triade : famille, taille, graisse.
 * L'échelle ne portait que des jetons de TAILLE pour `title-l` et `title-m`,
 * là où les quatre échelles d'affichage déclaraient leur graisse depuis
 * toujours. Les deux rôles manquants ont été ajoutés ; la triade a disparu.
 *
 * Ce test lit les SOURCES : jsdom ne résout pas les `@utility` de Tailwind, et
 * un composant monté n'y rendrait aucune des graisses en question.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

function sources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(entree) || /\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Les commentaires sont retirés avant examen : sans cela le garde se
 * déclencherait sur les explications qui décrivent le défaut, dans les fichiers
 * mêmes où il vient d'être corrigé — ce qui pousserait à effacer l'explication
 * pour faire passer la suite.
 */
/**
 * Commentaires BLANCHIS, et non retirés.
 *
 * Un bloc `/* … *\/` se remplaçait par UN espace, écrasant vingt lignes en une.
 * Tout numéro rapporté ensuite désignait donc la mauvaise ligne, et d'autant
 * plus loin qu'on descendait dans un fichier — dans un dépôt qui commente
 * autant, le décalage est systématique. Le message du garde trompait au moment
 * précis où on s'y fie : quand il échoue.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source.replace(/\/\*[\s\S]*?\*\//g, blanchir).replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function lignes(predicat: (ligne: string) => boolean): string[] {
  return sources(SRC).flatMap((chemin) =>
    sansCommentaires(readFileSync(chemin, 'utf8'))
      .split('\n')
      .map((ligne, i) => ({ ligne, numero: i + 1 }))
      .filter(({ ligne }) => predicat(ligne))
      .map(({ numero }) => `${chemin.slice(SRC.length + 1)}:${numero}`),
  )
}

// Motifs assemblés par fragments : Tailwind lit les sources comme du texte,
// fichiers de test compris, et générerait pour de bon toute classe citée ici en
// clair — le piège a déjà coûté une classe fantôme dans le CSS livré.
const TAILLE_TITRE = new RegExp(['text', 'title', '(l|m)'].join('-'))
const LOURD = new RegExp(`\\bfont-(${['semibold', 'bold'].join('|')})\\b`)
const CORPS = new RegExp(['text', 'body'].join('-') + '\\b')
const GRAS = new RegExp('\\bfont-' + 'bold' + '\\b')

describe('graisses typographiques', () => {
  it('fait porter la graisse des titres par un rôle de l’échelle, pas par une classe', () => {
    // La triade `font-sans` + taille de titre + graisse est exactement ce que
    // les rôles `title-l` / `title-m` existent pour remplacer.
    expect(lignes((l) => TAILLE_TITRE.test(l) && LOURD.test(l))).toEqual([])
  })

  it('tient le corps de texte sous la graisse 500', () => {
    // Un CONTRÔLE peut légitimement rester lourd — un bouton, un lien, un
    // onglet actif. La règle des deux graisses vise la PROSE, et c'est elle
    // qu'on isole : les contrôles se reconnaissent à leur cible tactile ou à
    // leur état de survol.
    // Le voisinage compte, pas la seule ligne : une liste de classes s'écrit en
    // `cn()` sur plusieurs lignes, et le marqueur de contrôle — cible tactile,
    // état de survol, gestionnaire — tombe souvent trois lignes plus haut. Une
    // détection ligne à ligne classait donc un bouton comme de la prose, ce qui
    // aurait poussé à aplatir un contrôle pour faire taire le garde.
    const MARQUEUR = /min-h-1[12]|inline-flex|hover:|focus:|aria-|onClick|<button|<Link/
    const FENETRE = 6

    const coupables = sources(SRC).flatMap((chemin) => {
      const lignesFichier = sansCommentaires(readFileSync(chemin, 'utf8')).split('\n')
      return lignesFichier.flatMap((ligne, i) => {
        if (!CORPS.test(ligne) || !LOURD.test(ligne)) return []
        const voisinage = lignesFichier.slice(Math.max(0, i - FENETRE), i + FENETRE).join('\n')
        return MARQUEUR.test(voisinage) ? [] : [`${chemin.slice(SRC.length + 1)}:${i + 1}`]
      })
    })

    expect(coupables).toEqual([])
  })

  it('ne souffre qu’une seule graisse 700 en ligne, celle du mot-symbole', () => {
    // Le logotype est une signature, pas du texte : sa graisse lui appartient.
    // Toute autre occurrence signifierait qu'une cinquième valeur s'installe.
    const fichiers = [...new Set(lignes((l) => GRAS.test(l)).map((s) => s.split(':')[0]))]
    expect(fichiers).toEqual(['components/primitives/Logo.tsx'])
  })
})
