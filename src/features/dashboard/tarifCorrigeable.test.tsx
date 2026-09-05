import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE TABLEAU DES PRIX N'ÉTAIT QU'EN LECTURE.
 *
 * ═══ CE QUE SON ABSENCE COÛTAIT ═══
 *
 * La route de création nomme la victime dans son propre rattrapage d'erreur —
 * « un propriétaire qui CORRIGE UNE FAUTE DE FRAPPE en réémettant le même
 * jour » — et lui rendait un 409, l'unicité `(parc, énergie, date)` fermant la
 * porte du remplacement. L'historique, juste en dessous du formulaire, listait
 * la ligne fausse sans offrir aucun geste dessus.
 *
 * ═══ POURQUOI CES CAS ET PAS D'AUTRES ═══
 *
 * `tarifCorrigeable.test.ts`, côté serveur, garde les deux routes. Il ne sait
 * pas si un bouton y mène. C'est la leçon de `ficheRetirable` : une colonne de
 * gestes qui n'apparaît jamais échappe aussi bien aux yeux qu'au balayage.
 *
 * ═══ LA CORRECTION SE FAIT DANS LE MÊME FORMULAIRE ═══
 *
 * Sans seconde modale : `clavierDesModales` exige d'ouvrir, tenir, fermer et
 * RENDRE le focus, et rien de cela ne se compose à deux niveaux. Les cas
 * vérifient donc que le formulaire du haut se CHARGE, que le pied dit le geste,
 * et que l'énergie se fige — le serveur ne l'accepte pas, et offrir un choix
 * sans effet vaut moins que pas de choix.
 */
describe('le tableau des prix de refacturation', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()
    /* LA MODALE VIT DANS LE MENU DE DÉBORDEMENT de l'écran des relevés : deux
       clics, et le premier n'est pas décoratif — un cas qui ouvrirait la modale
       autrement ne dirait rien du chemin réel. */
    await utilisateur.click(screen.getByRole('button', { name: /Autres actions/ }))
    await utilisateur.click(await screen.findByRole('menuitem', { name: /Prix de refacturation/ }))
    await screen.findByRole('dialog')
    return utilisateur
  }

  it('offre la correction et le retrait sur CHAQUE ligne', async () => {
    await ouvrir()
    const modale = screen.getByRole('dialog')

    /* Le nom porte l'énergie ET la date : « Corriger » répété ne dirait pas
       laquelle des lignes on active. */
    expect(within(modale).getAllByRole('button', { name: /^Corriger le prix — / }).length)
      .toBeGreaterThan(0)
    expect(within(modale).getAllByRole('button', { name: /^Retirer le prix — / }).length)
      .toBeGreaterThan(0)
  })

  it('charge la ligne dans le formulaire, et le pied DIT le geste', async () => {
    const utilisateur = await ouvrir()
    const modale = screen.getByRole('dialog')

    expect(within(modale).getByRole('button', { name: /Enregistrer ce prix/ })).toBeInTheDocument()

    await utilisateur.click(
      within(modale).getAllByRole('button', { name: /^Corriger le prix — / })[0]!,
    )

    /* Le bouton change de phrase : « Enregistrer ce prix » sur un formulaire
       prérempli laisserait croire qu'on en pose un SECOND, ce que le serveur
       refuserait par 409 après le clic. */
    expect(within(modale).getByRole('button', { name: /Corriger ce prix/ })).toBeInTheDocument()
    expect(within(modale).queryByRole('button', { name: /Enregistrer ce prix/ })).toBeNull()
  })

  it('FIGE l’énergie pendant une correction', async () => {
    /* Un prix de l'eau n'est pas un prix du courant mal rangé : c'est une autre
       grandeur, au m³ contre le kWh. Le serveur ne l'accepte pas, et l'écran ne
       doit pas offrir un choix sans effet. */
    const utilisateur = await ouvrir()
    const modale = screen.getByRole('dialog')

    expect(within(modale).getByRole('combobox', { name: /Énergie/ })).toBeEnabled()
    await utilisateur.click(
      within(modale).getAllByRole('button', { name: /^Corriger le prix — / })[0]!,
    )
    expect(within(modale).getByRole('combobox', { name: /Énergie/ })).toBeDisabled()
  })

  /**
   * L'AIDE SOUS LA DATE DIT LE CONTRAIRE SELON LE GESTE, ET ELLE LE DOIT.
   *
   * « Un prix ne vaut pas pour le passé » est juste quand on POSE un prix. En
   * CORRECTION, c'est faux : rien ne fige un tarif, le serveur relit la table à
   * chaque lecture, et corriger réécrit ce que toutes les périodes suivantes
   * affichent. Laisser la première phrase ferait croire l'ancien montant à
   * l'abri.
   */
  it('avertit que corriger RÉÉCRIT ce que les périodes affichent', async () => {
    const utilisateur = await ouvrir()
    const modale = screen.getByRole('dialog')

    expect(within(modale).getByText(/ne vaut pas pour le passé/)).toBeInTheDocument()

    await utilisateur.click(
      within(modale).getAllByRole('button', { name: /^Corriger le prix — / })[0]!,
    )

    expect(within(modale).getByText(/y compris passées/)).toBeInTheDocument()
    expect(within(modale).queryByText(/ne vaut pas pour le passé/)).toBeNull()
  })

  it('demande une CONFIRMATION avant de retirer', async () => {
    /* Deux temps sur la rangée : le geste est destructeur, et une confirmation
       en modale demanderait la modale imbriquée qu'on écarte. */
    const utilisateur = await ouvrir()
    const modale = screen.getByRole('dialog')

    expect(within(modale).queryByRole('button', { name: /Confirmer le retrait/ })).toBeNull()
    await utilisateur.click(
      within(modale).getAllByRole('button', { name: /^Retirer le prix — / })[0]!,
    )
    expect(
      within(modale).getByRole('button', { name: /Confirmer le retrait/ }),
    ).toBeInTheDocument()
  })
})
