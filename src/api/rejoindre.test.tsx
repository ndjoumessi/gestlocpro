import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Rejoindre un parc avec un compte déjà créé.
 *
 * Le code d'invitation ne se consommait qu'à l'inscription. Un compte existant
 * — celui d'un invité dont le code n'était jamais parti — n'avait aucune porte :
 * l'invitation restait valable et inutilisable, et son porteur se retrouvait
 * propriétaire d'un parc vide, avec la navigation complète du bailleur.
 */

const SESSION: EtatSession = { statut: 'connecte', compte: COMPTE_FICTIF, adhesions: [] }

describe('rejoindre un parc', () => {
  it('envoie le code et rafraîchit la session', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
    serveur.quand('POST', '/join', { status: 201, body: { parkId: 'p', role: 'tenant' } })
    const user = userEvent.setup()
    await renderApp('/app/prise-en-main', { session: SESSION })

    await user.type(await screen.findByLabelText(/code d’invitation/i), 'LOC-WS4V-YEC9')
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }))

    expect(serveur.appels.some((a) => a.chemin === '/join')).toBe(true)
    /**
     * La session porte les adhésions : sans relecture, l'écran resterait sur
     * celles d'avant et le parc rejoint n'apparaîtrait qu'au prochain
     * rechargement — l'utilisateur croirait que rien ne s'est passé.
     */
    const rangJoin = serveur.appels.findIndex((a) => a.chemin === '/join')
    const rangMe = serveur.appels.map((a) => a.chemin).lastIndexOf('/auth/me')
    // La relecture suit le rattachement : l'ordre est ce qui compte, pas le
    // nombre — le harnais fournit l'état initial, donc `/auth/me` n'est pas
    // appelé au montage.
    expect(rangMe).toBeGreaterThan(rangJoin)
    expect(await screen.findByText(/parc rejoint/i)).toBeInTheDocument()
  })

  it('dit que le code est refusé, sans annoncer un rattachement', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
    serveur.quand('POST', '/join', { status: 400, body: { error: 'invitation_invalid' } })
    const user = userEvent.setup()
    await renderApp('/app/prise-en-main', { session: SESSION })

    await user.type(await screen.findByLabelText(/code d’invitation/i), 'LOC-FAUX-CODE')
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }))

    expect(await screen.findByText(/ne peut pas être utilisé/i)).toBeInTheDocument()
    expect(screen.queryByText(/parc rejoint/i)).not.toBeInTheDocument()
  })

  it('n’est PAS proposée à qui appartient déjà à un parc', async () => {
    /**
     * Posée sans condition, la carte s'affichait chez le propriétaire — qui a
     * fondé son parc et n'a aucun code à saisir. Elle lui proposait un geste
     * sans objet sur l'écran censé lui expliquer ses droits.
     */
    installerFauxServeur({ authentifie: true })
    await renderApp('/app/prise-en-main', {
      session: {
        statut: 'connecte',
        compte: COMPTE_FICTIF,
        adhesions: [
          { parkId: 'p1', role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' },
        ],
      },
    })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByLabelText(/code d’invitation/i)).not.toBeInTheDocument()
  })

  it('n’envoie rien tant que le code est trop court', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
    const user = userEvent.setup()
    await renderApp('/app/prise-en-main', { session: SESSION })

    await user.type(await screen.findByLabelText(/code d’invitation/i), 'LO')

    /* Un aller-retour pour deux caractères apprend le refus au lieu de la
       règle : RIEN NE PART, et c'est ce que ce cas tient. Le bouton, lui, n'est
       plus éteint — il l'était en silence, la validation locale ne posant
       jamais d'erreur. Il répond maintenant ; voir `refusEnonce.test.tsx`. */
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }))
    expect(serveur.appels.some((a) => a.chemin === '/join')).toBe(false)
  })
})
