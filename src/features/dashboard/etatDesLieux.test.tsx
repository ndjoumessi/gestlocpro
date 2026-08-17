import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within, attendreLeChargement } from '@/test/render'

/**
 * Établissement d'un état des lieux, vu de l'écran.
 *
 * L'écran n'a jamais eu de commande, et c'était juste : aucune route
 * n'existait. Le bouton arrive avec la fonction, pas avant.
 *
 * Ce que ces cas surveillent d'abord est la RÈGLE MÉTIER portée par le
 * formulaire : le champ d'imputation n'apparaît que sur une sortie. Le serveur
 * refuse en 422 une réserve d'entrée chiffrée ; offrir le champ puis se faire
 * refuser apprendrait la règle par l'échec.
 */

const dialogue = () => screen.getByRole('dialog')

async function ouvrir() {
  const user = userEvent.setup()
  renderApp('/demo/etats-des-lieux')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: /établir un état des lieux/i }))
  return user
}

describe('état des lieux, formulaire', () => {
  it('n’offre PAS de chiffrer une réserve d’entrée', async () => {
    await ouvrir()

    /**
     * Le document d'entrée relève ce qui est DÉJÀ abîmé, précisément pour que
     * le locataire n'en réponde pas. Un champ de montant y inviterait à lui
     * facturer les dégâts du précédent — l'exact inverse de la protection que
     * ce document offre.
     */
    expect(within(dialogue()).queryByLabelText(/imputation/i)).not.toBeInTheDocument()
  })

  it('l’offre sur une sortie', async () => {
    const user = await ouvrir()
    await user.click(within(dialogue()).getByRole('button', { name: /^Sortie$/ }))

    // Le pendant positif : sans lui, un formulaire qui ne montrerait JAMAIS le
    // champ satisferait le cas précédent.
    expect(within(dialogue()).getByLabelText(/imputation/i)).toBeInTheDocument()
  })

  it('refuse un nombre de pièces nul, et n’enregistre rien', async () => {
    const user = await ouvrir()
    const pieces = within(dialogue()).getByLabelText(/nombre de pièces/i)
    await user.clear(pieces)
    await user.type(pieces, '0')
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('enregistre le constat et l’ajoute à la liste', async () => {
    const user = await ouvrir()
    await user.type(within(dialogue()).getByLabelText(/^pièce$/i), 'Cuisine')
    await user.type(
      within(dialogue()).getByLabelText(/^constat$/i),
      'Rayure profonde sur le plan de travail.',
    )
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    expect(await screen.findByText(/état des lieux enregistré/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
