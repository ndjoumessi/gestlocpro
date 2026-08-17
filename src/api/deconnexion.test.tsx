import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Se déconnecter.
 *
 * `deconnecter()` existait dans la session, `api.logout` existait, la route
 * serveur existait — et RIEN ne les appelait. L'avatar en haut à droite était
 * un littéral, « AN », les initiales d'un personnage de la démonstration,
 * écrites en dur et `aria-hidden`.
 *
 * Ce n'est pas un manque d'écran mais un défaut de sécurité : sur un poste
 * partagé — le cas courant du marché visé — la session restait ouverte pour le
 * suivant, sans aucun moyen de la fermer.
 */

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: { ...COMPTE_FICTIF, fullName: 'Nelson Djoumessi', email: 'nelson@example.com' },
  adhesions: [
    { parkId: '11111111-2222-4333-8444-555555555555', role: 'owner', parkName: 'Parc', currency: 'XAF' },
  ],
}

const avatar = () => screen.getByRole('button', { name: /nelson djoumessi/i })

describe('déconnexion', () => {
  it('porte les initiales du COMPTE, et non celles d’un personnage', async () => {
    installerFauxServeur({ authentifie: true })
    renderApp('/app', { session: SESSION })

    // « ND », pas « AN ». Le nom du titulaire répond à la question qu'on se pose
    // sur un poste partagé avant même de se déconnecter : qui est connecté ?
    expect(avatar()).toHaveTextContent('ND')
  })

  it('appelle réellement le serveur', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
    serveur.quand('POST', '/auth/logout', { status: 204 })
    const user = userEvent.setup()
    renderApp('/app', { session: SESSION })

    await user.click(avatar())
    await user.click(screen.getByRole('menuitem', { name: /se déconnecter/i }))

    /**
     * Vider l'état local sans prévenir le serveur laisserait le cookie de
     * session valable : un rechargement rouvrirait la session qu'on croyait
     * fermée.
     */
    expect(serveur.appels.some((a) => a.chemin === '/auth/logout')).toBe(true)
  })

  it('montre à qui appartient la session avant de la fermer', async () => {
    installerFauxServeur({ authentifie: true })
    const user = userEvent.setup()
    renderApp('/app', { session: SESSION })

    await user.click(avatar())
    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('Nelson Djoumessi')
    expect(menu).toHaveTextContent('nelson@example.com')
  })

  it('n’en propose pas en démonstration, où il n’y a pas de compte', async () => {
    renderApp('/demo')

    // Rien à déconnecter : le visiteur n'a pas de session à fermer, et un bouton
    // qui ne peut rien faire occupe la place d'une action utile.
    expect(screen.queryByRole('button', { name: /ouvrir le menu/i })).not.toBeInTheDocument()
  })
})
