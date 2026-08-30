import { describe, expect, it } from 'vitest'
import { CORPS, nouvelleMiseEnPage } from './miseEnPage'
import { PAGE, type Commande } from './pdf'

/**
 * UN INTERTITRE NE RESTE PAS SEUL EN BAS D'UNE PAGE.
 *
 * ═══ LA RÉSERVE QUI A FAIT ÉCRIRE CE FICHIER ═══
 *
 * La mise en page coupait où le curseur tombait. Rien n'empêchait « Réserves »
 * d'atterrir en dernière ligne d'une feuille, la première réserve commençant sur
 * la suivante : le lecteur tourne la page pour savoir de quoi on parle, et sur
 * un état des lieux de douze constats cela arrive dès que le hasard s'y met.
 *
 * `documentDansLaPage` ne pouvait pas le dire : elle mesure les DÉBORDEMENTS,
 * et une orpheline ne déborde de rien — elle est parfaitement dans sa page, au
 * mauvais endroit.
 *
 * ═══ POURQUOI CE CAS EST PUR, ET NON UN DOCUMENT RENDU ═══
 *
 * Il faudrait, pour l'éprouver sur un vrai document, un jeu de données qui
 * place l'intertitre exactement au bas d'une feuille. Ce réglage-là se périme
 * au premier mot ajouté à une traduction. La règle porte sur la MISE EN PAGE :
 * on la remplit jusqu'au bord et on regarde ce qu'elle fait, ce qui ne dépend
 * d'aucun contenu.
 */

/** Les textes d'une page, dans l'ordre où ils y ont été posés. */
function textes(page: Commande[]): Commande[] {
  return page.filter((commande) => commande.sorte === 'texte')
}

/** Le pied de page, posé en dernier sur chaque feuille — voir `pages()`. */
const SANS_PIED = (page: Commande[]) => textes(page).slice(0, -1)

describe('la mise en page', () => {
  /** Une page presque pleine : on empile jusqu'à ce qu'une seconde s'ouvre. */
  function presquePleine() {
    const feuille = nouvelleMiseEnPage()
    let posees = 0
    while (feuille.pages(() => '').length === 1) {
      feuille.ligne(`ligne ${posees++}`)
      if (posees > 200) throw new Error('la page ne se remplit jamais')
    }
    return posees
  }

  it('remplit bien une page avant d’en ouvrir une autre', () => {
    // GARDE DE LA GARDE : sans cela, un cas qui n'atteindrait jamais le bas de
    // la feuille mesurerait une règle qui n'a pas eu à s'exercer.
    const posees = presquePleine()
    expect(posees, 'la feuille se remplit en trop peu de lignes').toBeGreaterThan(30)
  })

  /**
   * LE BALAYAGE, ET NON UNE SEULE POSITION.
   *
   * Un cas posé à UNE hauteur de remplissage ne prouve rien : il tombe sur la
   * frontière ou il la manque, et l'on ne sait pas lequel des deux. La première
   * rédaction de ce cas passait pour cette raison — le saut qui précède
   * l'intertitre suffisait à le pousser, à cette hauteur-là seulement.
   *
   * On balaie donc les six dernières lignes avant la rupture : l'une d'elles
   * laisse exactement la place du titre et pas celle de sa suite.
   */
  it.each([1, 2, 3, 4, 5, 6])(
    'n’abandonne pas un intertitre à %i ligne(s) du bas',
    (recul) => {
      const feuille = nouvelleMiseEnPage()
      for (let i = 0; i < presquePleine() - recul; i++) feuille.ligne(`ligne ${i}`)

      feuille.section('Réserves')
      feuille.ligne('La première réserve')

      const pages = feuille.pages(() => 'pied')
      for (const page of pages) {
        const dernier = SANS_PIED(page).at(-1)
        expect(
          dernier?.sorte === 'texte' && dernier.contenu,
          'l’intertitre finit la page, son contenu commence la suivante',
        ).not.toBe('Réserves')
      }

      /* Et il reste ACCOMPAGNÉ : le repousser ne vaut que s'il emmène sa
         suite. On cherche donc les deux textes côte à côte, sur une page. */
      const ensemble = pages.some((page) => {
        const contenus = SANS_PIED(page).map((c) => (c.sorte === 'texte' ? c.contenu : ''))
        const rang = contenus.indexOf('Réserves')
        return rang !== -1 && contenus[rang + 1] === 'La première réserve'
      })
      expect(ensemble, 'l’intertitre a été séparé de son contenu').toBe(true)
    },
  )

  it('ne repousse pas un intertitre qui a la place de vivre', () => {
    /* L'inverse, et il compte autant : une règle qui ouvrirait une page à chaque
       intertitre rendrait un document d'une section par feuille. */
    const feuille = nouvelleMiseEnPage()
    feuille.ligne('Une seule ligne')
    feuille.section('Réserves')
    feuille.ligne('La première réserve')

    expect(feuille.pages(() => 'pied')).toHaveLength(1)
  })
})

/**
 * LA PAIRE SE REPLIE PLUTÔT QUE DE SORTIR DE LA PAGE.
 *
 * Ce cas double, en pur, ce que `documentDansLaPage` mesure sur un document
 * rendu — et il le fait à la frontière exacte, là où un jeu de données ne sait
 * pas se placer.
 */
describe('une paire trop longue', () => {
  const DROITE = PAGE.largeur - PAGE.marge

  it('passe à la ligne au lieu de partir vers la gauche', () => {
    const feuille = nouvelleMiseEnPage()
    feuille.paire('Locataire', 'Marie-Joséphine '.repeat(12).trim())

    const poses = SANS_PIED(feuille.pages(() => 'pied')[0])
    for (const commande of poses) {
      if (commande.sorte !== 'texte') continue
      expect(commande.x, `« ${commande.contenu} » commence hors marge`).toBeGreaterThanOrEqual(
        PAGE.marge,
      )
      expect(commande.x, `« ${commande.contenu} » finit hors marge`).toBeLessThanOrEqual(DROITE)
    }

    /* Le libellé et la valeur ne partagent plus la ligne : c'est le repli. La
       valeur reste calée à droite, sur autant de lignes qu'il en faut. */
    const [libelle, ...valeur] = poses
    expect(libelle.sorte === 'texte' && libelle.contenu).toBe('Locataire')
    expect(valeur.length, 'la valeur n’a pas été coupée').toBeGreaterThan(1)
    for (const ligne of valeur)
      expect(ligne.sorte === 'texte' && ligne.aDroite, 'une ligne de valeur perd son calage').toBe(
        true,
      )
  })

  it('laisse une paire courte sur une seule ligne', () => {
    const feuille = nouvelleMiseEnPage()
    feuille.paire('Loyer', '145 000 FCFA')

    const poses = SANS_PIED(feuille.pages(() => 'pied')[0]).slice(0, 2)
    expect(poses).toHaveLength(2)
    // Même ligne de base : c'est ce qui distingue une paire d'un repli.
    expect(poses[0].sorte === 'texte' && poses[0].y).toBe(poses[1].sorte === 'texte' && poses[1].y)
    expect(CORPS, 'la taille du corps a changé sans que ce cas le sache').toBe(10)
  })
})
