import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE JEU DE DÉMONSTRATION PORTE UN IDENTIFIANT DE LOCATAIRE.
 *
 * ═══ CE QUE SON ABSENCE CACHAIT ═══
 *
 * « Retirer la fiche » n'est offert que si `unit.tenantId` existe — le serveur
 * supprime par identifiant de LOCATAIRE, pas par logement, et proposer un geste
 * sans de quoi l'exécuter ferait un bouton qui échoue. La règle est juste.
 *
 * Or aucune unité de la démonstration n'en portait : zéro occurrence de
 * `tenantId` dans `portfolio.ts`. Le bouton n'apparaissait donc JAMAIS hors
 * d'un vrai parc, et toute la colonne de geste des locataires échappait au
 * balayage — `mesure-ui` ne mesure que ce que la démonstration rend.
 *
 * TROUVÉ PAR UNE MUTATION QUI A ÉCHOUÉ. Pour éprouver la garde du glyphe, j'ai
 * retiré l'icône de ce bouton-ci : la garde est restée VERTE. Ce n'est pas
 * elle qui était faible, c'est la démonstration qui ne rendait pas la colonne.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Que la colonne EXISTE sous les yeux du balayage, et que le geste aille
 * jusqu'au bout — un identifiant posé pour faire apparaître un bouton qui
 * planterait ensuite ne vaudrait pas mieux que pas de bouton.
 */
describe('la fiche locataire de démonstration', () => {
  it('offre son retrait au propriétaire', async () => {
    installerFauxServeur()
    await renderApp('/demo/locataires')
    await attendreLeChargement()

    const ligne = screen.getAllByRole('row').find((r) => /Charles Ngassa/.test(r.textContent ?? ''))
    expect(ligne, 'la ligne de A1 est introuvable').toBeDefined()
    expect(
      within(ligne!).getByRole('button', { name: /Retirer/ }),
      'la démonstration ne rend pas la colonne de geste des locataires',
    ).toBeInTheDocument()
  })

  /**
   * ET LE GESTE VA JUSQU'AU BOUT.
   *
   * Sans parc serveur, `removeTenant` libère l'unité localement — c'est le
   * chemin de la démonstration. Le cas le parcourt en entier, confirmation
   * comprise : c'est la seule façon de savoir que l'identifiant qu'on vient de
   * poser sert à quelque chose, et pas seulement à faire apparaître un bouton.
   */
  it('libère le logement quand on va au bout', async () => {
    installerFauxServeur()
    await renderApp('/demo/locataires')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    const ligne = screen.getAllByRole('row').find((r) => /Charles Ngassa/.test(r.textContent ?? ''))
    await utilisateur.click(within(ligne!).getByRole('button', { name: /Retirer/ }))

    const confirmation = await screen.findByRole('alertdialog')
    await utilisateur.click(within(confirmation).getByRole('button', { name: /Retirer|Confirmer/ }))

    expect(
      screen.queryByText('Charles Ngassa'),
      'la fiche est encore là après un retrait confirmé',
    ).not.toBeInTheDocument()
  })
})
