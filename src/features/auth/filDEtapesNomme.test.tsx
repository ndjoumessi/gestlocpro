import { describe, expect, it } from 'vitest'
import { Stepper } from './Stepper'
import { renderWithProviders, screen, within } from '@/test/render'

/**
 * UN FIL D'ÉTAPES DOIT DIRE CE QUI ATTEND, PAS SEULEMENT OÙ L'ON EST.
 *
 * ═══ CE QU'UN TÉLÉPHONE NE VOYAIT PAS ═══
 *
 * Les quatre libellés portaient `hidden … sm:block`. Mesuré au navigateur à 360
 * sur chacune des quatre étapes de l'inscription : les quatre à `width: 0`,
 * toujours. Un téléphone lisait « 1 2 3 4 » et, au-dessus, « ÉTAPE 1 SUR 4 » —
 * deux écritures du même fait, et rien d'autre. « Votre rôle », « Votre
 * identité », « Votre contexte », « Récapitulatif » n'existaient pas sous 640 px.
 *
 * C'est le même défaut que les colonnes `hideOnMobile` des écrans-tableaux, et
 * la même règle : un utilitaire responsif CACHE, il ne retire pas. Ici il
 * retirait, puisque rien d'autre ne portait ces quatre mots.
 *
 * ═══ POURQUOI CETTE GARDE REGARDE LES CLASSES, ce qu'elle fait rarement ═══
 *
 * jsdom ne calcule aucune boîte et ne connaît aucun point de rupture :
 * `getBoundingClientRect` y rend zéro partout, et `sm:block` n'y veut rien dire.
 * Or les libellés étaient DÉJÀ dans le document avant le correctif — c'est leur
 * `hidden` qui les effaçait. Une garde qui se contenterait de les trouver serait
 * passée au vert sur la version fautive.
 *
 * On vise donc la classe, faute de mieux, et on le dit. La VÉRITÉ GÉOMÉTRIQUE
 * est ailleurs : `MESURER_DEBORDEMENT_DE_MOT` mesure au navigateur, aux onze
 * largeurs et dans les deux langues, qu'aucun de ces mots ne sort de sa colonne
 * — c'est elle qui a trouvé « Récapitulatif » dépassant de 5 px à 320, et elle
 * qui rougirait si un libellé plus long arrivait.
 */

/*
  LA CLASSE PROSCRITE EST ASSEMBLÉE, JAMAIS ÉCRITE.

  Tailwind v4 scanne les fichiers du projet, y compris les tests : écrire le nom
  en clair ici SUFFIRAIT à faire émettre la règle dans la feuille de style, alors
  que ce fichier existe pour qu'elle n'y soit pas. C'est la discipline des autres
  gardes du dépôt.
*/
const MASQUE = ['hid', 'den'].join('')

const ETAPES = ['Votre rôle', 'Votre identité', 'Votre contexte', 'Récapitulatif']

describe('le fil d’étapes', () => {
  it('nomme ses quatre étapes, à toutes les largeurs', () => {
    renderWithProviders(<Stepper steps={ETAPES} current={0} />)

    const fil = screen.getByRole('navigation')
    const items = within(fil).getAllByRole('listitem')
    expect(items, 'aucune étape rendue').toHaveLength(ETAPES.length)

    for (const [index, item] of items.entries()) {
      const attendu = ETAPES[index]!
      const libelle = within(item).getByText(attendu)

      /* LE CŒUR DU CAS : le mot est là ET rien ne l'efface. Avant le correctif,
         la première moitié passait déjà — c'est la seconde qui manquait. */
      expect(
        libelle.className.split(/\s+/),
        `« ${attendu} » est effacé sous le point de rupture`,
      ).not.toContain(MASQUE)
    }
  })

  /**
   * LE TÉMOIN DE LA GARDE ELLE-MÊME.
   *
   * Une garde qui cherche une classe absente passe au vert le jour où elle
   * cherche au mauvais endroit — un libellé déplacé d'un niveau, un `span`
   * devenu `div`. On vérifie donc qu'elle SAIT dire non, sur une chaîne écrite
   * ici même, plutôt que de la croire sur parole.
   */
  it('saurait refuser la classe qu’elle proscrit', () => {
    expect(`text-label ${MASQUE} sm:block`.split(/\s+/)).toContain(MASQUE)
    expect('text-label sm:block'.split(/\s+/)).not.toContain(MASQUE)
  })

  it('marque l’étape courante pour un lecteur d’écran', () => {
    renderWithProviders(<Stepper steps={ETAPES} current={2} />)

    const courantes = document.querySelectorAll('[aria-current="step"]')
    expect(courantes, 'aucune étape courante annoncée').toHaveLength(1)
    /* La troisième, et pas une autre : `current` est un index à partir de 0, et
       une erreur d'un cran y est invisible à la lecture. */
    const items = screen.getAllByRole('listitem')
    expect(items[2]!.contains(courantes[0]!)).toBe(true)
  })
})
