import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within, attendreLeChargement } from '@/test/render'

/**
 * Le locataire signale.
 *
 * C'est l'origine NORMALE d'une intervention, et le produit ne l'offrait nulle
 * part : `reportedByTenantId` existait au modèle depuis le premier jour sans
 * qu'une seule ligne ne l'écrive. La chaîne — signalement, devis, validation,
 * clôture — partait de son deuxième maillon.
 *
 * Un commentaire de `etatsVides.test.tsx` affirmait même que « le geste n'existe
 * pas dans le produit ». Il avait raison sur le bailleur, qui ne déclare
 * toujours pas ; il avait tort par omission sur le locataire.
 */

const dialogue = () => screen.getByRole('dialog')

describe('signalement par le locataire', () => {
  it('n’est pas proposé au bailleur, qui ne déclare pas d’intervention', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()

    // Le propriétaire arbitre et clôt ; il ne constate pas une fuite chez
    // quelqu'un d'autre.
    expect(screen.queryByRole('button', { name: /signaler un problème/i })).not.toBeInTheDocument()
  })

  it('est proposé au locataire', async () => {
    const { switchRole } = await import('@/test/render')
    renderApp('/demo/travaux')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.getByRole('button', { name: /signaler un problème/i })).toBeInTheDocument()
  })

  it('refuse un signalement sans description, et n’ajoute rien', async () => {
    const user = userEvent.setup()
    const { switchRole } = await import('@/test/render')
    renderApp('/demo/travaux')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    const avant = screen.queryAllByText('Signalé').length
    await user.click(screen.getByRole('button', { name: /signaler un problème/i }))
    await user.click(within(dialogue()).getByRole('button', { name: /envoyer le signalement/i }))

    // Un signalement sans énoncé arrive chez le gestionnaire comme une ligne
    // vide : il ne peut ni le qualifier ni rappeler.
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryAllByText('Signalé')).toHaveLength(avant)
  })

  it('ajoute l’intervention déclarée à la liste', async () => {
    const user = userEvent.setup()
    const { switchRole } = await import('@/test/render')
    renderApp('/demo/travaux')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    const avant = screen.queryAllByText('Signalé').length
    await user.click(screen.getByRole('button', { name: /signaler un problème/i }))
    await user.type(
      within(dialogue()).getByRole('textbox', { name: /que se passe-t-il/i }),
      'Fuite sous l’évier',
    )
    await user.click(within(dialogue()).getByRole('button', { name: /envoyer le signalement/i }))

    // « Signalé » et non « chiffré » : le locataire décrit, il n'ouvre pas un
    // chantier et ne fixe aucun montant.
    expect(screen.queryAllByText('Signalé')).toHaveLength(avant + 1)
    expect(await screen.findByText(/signalement envoyé/i)).toBeInTheDocument()
  })
})
