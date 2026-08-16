import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * La matrice doit annoncer ce que le SERVEUR applique.
 *
 * Elle expliquait neuf actions pendant que le produit en gagnait trois —
 * déclarer un immeuble, déclarer un logement, émettre une quittance. Un écran
 * qui promet moins que le produit ne fait est le bon sens du décalage ; l'autre
 * sens serait une brochure. Mais les deux finissent par mentir.
 *
 * Ce test garde surtout la règle qui structure la délégation : le gestionnaire
 * OPÈRE, le propriétaire ARBITRE ce qui engage son argent.
 */
describe('matrice des droits', () => {
  it('annonce les gestes qui constituent le parc', async () => {
    renderApp('/app/prise-en-main')
    await screen.findByRole('heading', { level: 1, name: /prise en main/i })

    for (const action of [
      /déclarer un immeuble/i,
      /déclarer un logement/i,
      /émettre une quittance/i,
    ]) {
      expect(screen.getByText(action), String(action)).toBeInTheDocument()
    }
  })

  it('groupe les droits par famille, dans l’ordre de la vie d’un parc', async () => {
    /**
     * À douze lignes, un tableau à plat cesse de se lire d'un coup : on cherche
     * une action au lieu de comprendre une règle.
     *
     * L'ordre n'est pas décoratif — constituer, exploiter, arbitrer, consulter
     * suit la vie d'un parc. Et le groupement est porté par la STRUCTURE du
     * tableau, un `<tbody>` et un en-tête `colgroup` par famille, plutôt que par
     * un espacement qu'un lecteur d'écran ignorerait.
     */
    renderApp('/app/prise-en-main')
    await screen.findByRole('heading', { level: 1, name: /prise en main/i })

    const familles = Array.from(document.querySelectorAll('th[scope="colgroup"]')).map((e) =>
      e.textContent?.trim(),
    )
    expect(familles).toEqual([
      'Constituer le parc',
      'Exploiter au quotidien',
      'Arbitrer ce qui engage l’argent',
      'Consulter',
    ])
  })

  it('réserve au propriétaire les deux gestes qui engagent son argent', async () => {
    /**
     * Valider un devis et arbitrer une caution restent fermés au gestionnaire
     * délégué. C'est la règle que le serveur impose — `exigerRole('owner')` sur
     * ces deux routes seulement — et l'écran doit la refléter, pas la
     * réinventer.
     */
    const user = userEvent.setup()
    renderApp('/app/prise-en-main')
    await screen.findByRole('heading', { level: 1, name: /prise en main/i })

    // On se place en gestion DÉLÉGUÉE : c'est le seul mode où la question se
    // pose. En gestion seule, la colonne du gestionnaire est vide par
    // construction, et le test passerait sans rien vérifier.
    await user.click(screen.getByRole('radio', { name: /gestion déléguée/i }))

    const ligne = (libelle: RegExp) => screen.getByText(libelle).closest('tr')!
    /**
     * Les trois cellules de rôle : propriétaire, gestionnaire, locataire.
     *
     * Sans `slice` : le libellé de l'action est un `<th scope="row">`, pas un
     * `<td>`. En sautant la première cellule je sautais la colonne
     * PROPRIÉTAIRE et lisais celle du locataire — l'assertion « le
     * gestionnaire n'a pas ce droit » passait alors sur le locataire, qui ne
     * l'a jamais. Un test vert qui ne vérifie rien.
     */
    const roles = (tr: HTMLElement) =>
      Array.from(tr.querySelectorAll('td')).map((c) => c.textContent?.trim())

    /**
     * Comparaison EXACTE, et non par expression régulière.
     *
     * « Autorisé » est contenu dans « Non autorisé » : un `/autoris/i` disait
     * donc le contraire de ce qu'il prétendait vérifier, et le test passait sur
     * un droit refusé comme sur un droit accordé. Le piège classique du test qui
     * rassure sans rien garder.
     */
    // Le gestionnaire — deuxième colonne — n'a pas ces deux droits.
    expect(roles(ligne(/valider un devis/i))[1]).toBe('Non autorisé')
    expect(roles(ligne(/arbitrer une caution/i))[1]).toBe('Non autorisé')
    // Mais il déclare bien les logements : il opère le parc au quotidien.
    expect(roles(ligne(/déclarer un logement/i))[1]).toBe('Autorisé')
    // Et le propriétaire, lui, peut tout : première colonne.
    expect(roles(ligne(/valider un devis/i))[0]).toBe('Autorisé')

    /**
     * Trois lignes voisines, deux droits différents.
     *
     * Déclarer, c'est AJOUTER — le gestionnaire le fait. Renommer ou supprimer,
     * c'est toucher à ce qui existe et à l'historique qui s'y rattache : cela
     * reste au propriétaire. La nuance tenait autrefois dans le seul mot
     * « Modifier », que rien ne distinguait de « Déclarer » à la lecture.
     */
    expect(roles(ligne(/déclarer un immeuble/i))[1]).toBe('Autorisé')
    expect(roles(ligne(/renommer ou supprimer/i))[1]).toBe('Non autorisé')
  })
})
