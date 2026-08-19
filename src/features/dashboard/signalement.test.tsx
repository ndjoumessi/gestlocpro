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
 * pas dans le produit ». Il avait tort par omission sur le locataire — et sa
 * moitié restante, « le bailleur ne déclare toujours pas », est tombée depuis :
 * la route serveur acceptait les trois rôles, seule l'interface refusait.
 *
 * Ce que ces cas fixent désormais, ce n'est plus une absence mais une
 * DISTINCTION. Deux gestes coexistent, et ils ne portent ni le même verbe ni
 * les mêmes choix : le locataire signale ce qu'il constate, sur son logement,
 * sans choisir le corps de métier « multi-corps » ; le bailleur ouvre ce qu'il
 * décide, sur un logement qu'il choisit dans tout le parc.
 */

const dialogue = () => screen.getByRole('dialog')

describe('signalement par le locataire', () => {
  /**
   * Ce cas disait « n'est pas proposé au bailleur », et il avait raison à sa
   * date. Il est resté VERT après l'ouverture de la création au bailleur, et
   * c'est ce qui le rendait dangereux : le nouveau bouton s'appelle « Ouvrir un
   * chantier », donc l'assertion sur « signaler un problème » continuait de
   * passer. Il gardait une formulation, plus une intention.
   *
   * Ce qui SURVIT du garde est la moitié qui reste vraie : le bailleur ne
   * SIGNALE pas. Il ne constate pas une fuite chez quelqu'un d'autre — il
   * décide un chantier, et c'est un autre verbe.
   */
  it('n’offre pas au bailleur de SIGNALER, mais d’ouvrir un chantier', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /signaler un problème/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ouvrir un chantier/i })).toBeInTheDocument()
  })

  /**
   * Et réciproquement : le locataire n'ouvre pas de chantier.
   *
   * Sans ce cas, monter la modale du bailleur pour tous les rôles passerait —
   * le locataire garderait son bouton, en gagnant un second qui lui offrirait
   * de choisir un logement dans le parc entier.
   */
  it('n’offre pas au locataire d’ouvrir un chantier', async () => {
    const { switchRole } = await import('@/test/render')
    renderApp('/demo/travaux')
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /ouvrir un chantier/i })).not.toBeInTheDocument()
  })

  /**
   * Le chantier du bailleur porte le vocabulaire du BAILLEUR.
   *
   * `TRADES_REPORTABLE` exclut délibérément « multi-corps » de ce qu'un
   * locataire peut déclarer : « il qualifie un chantier que le bailleur
   * arbitre, jamais un problème que le locataire constate ». C'est donc
   * exactement la valeur qui doit apparaître ici, et qui prouve que la modale
   * n'est pas celle du locataire déguisée.
   */
  it('lui offre le corps de métier que le locataire ne peut pas déclarer', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()
    await userEvent.click(screen.getByRole('button', { name: /ouvrir un chantier/i }))

    const modale = dialogue()
    expect(within(modale).getByRole('radio', { name: /multi-corps/i })).toBeInTheDocument()
    // Et le logement se CHOISIT — la seule différence de forme entre les deux
    // modales, celle qui interdisait de partager celle du locataire.
    expect(within(modale).getByRole('combobox')).toBeInTheDocument()
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
