import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * CHANGER D'ÉCRAN, C'EST REPARTIR DU HAUT, ET LE DIRE AU CLAVIER.
 *
 * Une application à page unique ne recharge rien : après un appui sur un
 * onglet de la barre basse depuis une page défilée, le nouvel écran s'ouvrait
 * à l'ancien décalage — au milieu d'un tableau qu'on n'avait pas encore lu —,
 * et le focus restait sur l'onglet qu'on venait de quitter, dans une barre qui
 * n'a plus rien à dire. Un lecteur d'écran n'apprenait pas qu'il avait changé
 * de page. `EcranSysteme` sait déjà focaliser un `h1`, mais seulement pour les
 * écrans d'erreur.
 *
 * La coquille fait désormais les deux à chaque route poussée : remonter en
 * haut et poser le focus sur `<main>` — la cible que le lien d'évitement vise
 * déjà —, d'où le lecteur reprend au titre. Le retour arrière ne remonte pas :
 * on revient là où l'on était, c'est ce que « retour » promet.
 */

const PARC = '16161616-4545-4656-8949-606060606060'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

beforeEach(() => {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('au changement de route', () => {
  it('remonte en haut et pose le focus sur le contenu', async () => {
    await renderApp('/app', { session: SESSION })
    await attendreLeChargement()
    const user = userEvent.setup()
    ;(window.scrollTo as ReturnType<typeof vi.fn>).mockClear()

    const nav = screen.getByRole('navigation', { name: 'Sections du produit' })
    await user.click(screen.getAllByRole('link', { name: /Paiements/ }).find((l) => nav.contains(l))!)

    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 0))
    const main = document.getElementById('main')
    expect(main, '<main id="main">').not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(main))
  })
})
