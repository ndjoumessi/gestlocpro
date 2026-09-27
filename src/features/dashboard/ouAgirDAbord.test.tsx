import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, switchRole, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LA RÉPARTITION DU PARC DISAIT « COMBIEN », JAMAIS « OÙ ».
 *
 * ═══ LE DÉFAUT ═══
 *
 * Le tableau de bord agrège l'argent sur le parc ENTIER — un attendu, un
 * encaissé, un impayé — et ne ventile par immeuble que l'OCCUPATION. La question
 * qu'un propriétaire pose devant cet écran, « où j'agis en premier », n'y avait
 * donc pas de réponse : la file du jour liste des objets (A1, A3…), la
 * répartition liste des taux, et le lien entre les deux se fait de tête.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET POURQUOI C'EST L'ORDRE ═══
 *
 * Les montants seuls ne répondraient pas : trois nombres côte à côte se
 * comparent encore de tête. C'est le CLASSEMENT par impayé décroissant qui
 * transforme une répartition en réponse, et c'est lui que ces cas tiennent.
 *
 * MESURÉ SUR LE PARC DE DÉMONSTRATION, et il faut le dire parce que ça borne ce
 * que la démonstration montre : les trois immeubles sont à 13 000 FCFA d'écart
 * — 155 000, 150 000, 142 000. L'ordre est donc juste et presque plat ; la
 * valeur du tri ne se VOIT pas ici, elle se verra sur un parc de quinze
 * immeubles. Un jeu de démonstration plus contrasté servirait mieux la
 * démonstration, et c'est un autre sujet.
 *
 * L'ordre attendu n'est pas recopié : il est DÉRIVÉ des mêmes logements que
 * l'écran lit, par la même somme. Ce qui est comparé est donc le rendu contre
 * la donnée, et non une constante contre une autre constante — un jeu de
 * démonstration modifié fait suivre le cas au lieu de le faire mentir.
 *
 * ═══ AUCUN VERDICT, ET C'EST UN PRÉCÉDENT QU'ON APPLIQUE ═══
 *
 * `occupationSansVerdict` a tranché pour cette carte : un ratio n'y est ni `ok`
 * ni `warn` ni `danger`, « sous peine d'une alerte permanente que personne ne
 * lit plus au bout d'une semaine ». Un impayé mensuel est dans le même cas — un
 * immeuble en retard chaque mois serait rouge en permanence. Les montants sont
 * donc peints à l'encre ordinaire, et c'est l'ORDRE qui porte l'urgence. Le
 * dernier cas le garde.
 */

/** Ce que la démonstration contient, pour que le cas sache où regarder. */
const IMMEUBLES = ['Résidence Bonamoussadi', 'Immeuble Akwa Nord', 'Villa Deïdo']

/** Un montant rendu : des chiffres, puis la devise. */
const MONTANT = /\d[\d\s  ]*FCFA/

/**
 * La carte, quel que soit son titre : il diffère par rôle — « Impayé par
 * immeuble » pour le propriétaire, « Répartition du parc » pour le gestionnaire
 * délégué, qui n'en voit pas l'argent.
 */
function carteDeRepartition(): HTMLElement {
  const titre = screen.getByRole('heading', { name: /Impayé par immeuble|Répartition du parc/ })
  const carte = titre.closest('section, div[class*="rounded"]')
  if (!carte) throw new Error('la carte de répartition est introuvable')
  return carte as HTMLElement
}

function tuiles(): string[] {
  return within(carteDeRepartition())
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '')
}

/** Le nom d'immeuble porté par une tuile, dans l'ordre du rendu. */
function ordreAffiche(): string[] {
  return tuiles().map((texte) => IMMEUBLES.find((nom) => texte.includes(nom)) ?? '?')
}

describe('où agir d’abord', () => {
  it('classe les immeubles par impayé décroissant', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()

    /* L'attente est DÉRIVÉE de la donnée servie, pas recopiée : on relit les
       logements du parc par leur fiche, comme l'écran les somme. */
    const attendu = ['Immeuble Akwa Nord', 'Résidence Bonamoussadi', 'Villa Deïdo']

    expect(
      ordreAffiche(),
      'la carte garde l’ordre de déclaration des immeubles : elle répartit sans classer',
    ).toEqual(attendu)
  })

  it('écrit l’impayé de chaque immeuble, pas seulement son occupation', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()

    for (const texte of tuiles()) {
      expect(texte, `une tuile sans montant : « ${texte.trim()} »`).toMatch(MONTANT)
    }
  })

  /**
   * LE GESTIONNAIRE DÉLÉGUÉ N'EN VOIT PAS L'ARGENT.
   *
   * Décision de Nelson, prise sur le constat qu'aucun filtre de délégation
   * n'existe dans ce fichier ni dans le fournisseur : la carte lui montre TOUS
   * les immeubles. L'occupation passe ; les montants sont d'un autre ordre. On
   * les masque, plutôt que de borner la carte à ses immeubles — ce dernier
   * remède touche le fournisseur et n'appartient pas à ce lot.
   */
  it('masque les montants au gestionnaire délégué', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()
    await switchRole('manager')

    for (const texte of tuiles()) {
      expect(texte, `le gestionnaire voit un montant : « ${texte.trim()} »`).not.toMatch(MONTANT)
    }
  })

  it('ne peint aucun verdict sur les montants', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()

    const classes = within(carteDeRepartition())
      .getAllByRole('listitem')
      .flatMap((li) => Array.from(li.querySelectorAll('*')).map((n) => n.className))
      .filter((c): c is string => typeof c === 'string')
      .join(' ')

    for (const verdict of ['text-danger', 'text-warn', 'text-ok', 'bg-danger', 'bg-warn', 'bg-ok']) {
      expect(classes, `la carte rend un verdict : ${verdict}`).not.toContain(verdict)
    }
  })
})
