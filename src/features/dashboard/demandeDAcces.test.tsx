import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * DEMANDER L'ACCÈS QUAND ON N'A PAS DE CODE.
 *
 * ═══ L'IMPASSE QU'ON REFERME ═══
 *
 * L'assistant d'inscription portait « Je n'ai pas de code — envoyer une demande
 * d'accès ». Elle n'avait AUCUNE route derrière : la cocher produisait un compte
 * rattaché à aucun parc, et `wiring.test.tsx` l'a retirée — « ne propose plus
 * une demande d'accès que rien ne reçoit ».
 *
 * Restait un écran sans issue : un compte sans parc ne voyait que « rejoindre
 * par code », c'est-à-dire le geste de celui à qui l'on a DÉJÀ remis quelque
 * chose. Celui qui est arrivé avant, ou dont le propriétaire ne sait pas qu'il
 * doit émettre un code, n'avait rien.
 *
 * ═══ CE QUE L'ÉCRAN NE DOIT PAS PROMETTRE ═══
 *
 * Le serveur répond PAREIL que l'adresse existe ou non — sinon la route
 * deviendrait un détecteur de clientèle. Un « nous avons prévenu Untel » serait
 * donc à la fois faux et dangereux : il dirait à qui essaie des adresses
 * lesquelles gèrent du locatif.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const DEMANDE = '33333333-4444-4555-8666-777777777777'

/**
 * `session: null` — ON LAISSE LA SESSION SE RÉSOUDRE, comme en production.
 *
 * La coquille n'affirme « aucun parc » que sur un état REÇU du serveur, jamais
 * sur un état injecté par le harnais : voir `sessionResolue`. Injecter une
 * session sans adhésion ne monterait donc PAS cet écran — c'est le piège que
 * `compteSansParc.test.tsx` documente déjà, et j'y suis tombé en l'écrivant.
 * La réponse par défaut du faux serveur — un compte valide, `memberships: []` —
 * est exactement notre sujet.
 */
const SANS_PARC: { session: null } = { session: null }
const PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

describe('le compte sans parc', () => {
  it('peut demander l’accès en nommant le propriétaire', async () => {
    serveur.quand('POST', '/access-requests', { status: 202, body: {} })
    await renderApp('/app', SANS_PARC)
    await attendreLeChargement()
    const user = userEvent.setup()

    await user.type(
      screen.getByLabelText(/adresse e-mail du propriétaire/i),
      'proprio@example.com',
    )
    await user.click(screen.getByRole('button', { name: /envoyer la demande/i }))

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.chemin === '/access-requests')
      expect(appel, 'l’écran était une impasse pour qui n’a pas de code').toBeTruthy()
      expect((appel?.corps as { ownerEmail?: string })?.ownerEmail).toBe('proprio@example.com')
    })
  })

  it('ne promet pas plus que ce que le serveur garantit', async () => {
    serveur.quand('POST', '/access-requests', { status: 202, body: {} })
    await renderApp('/app', SANS_PARC)
    await attendreLeChargement()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/adresse e-mail du propriétaire/i), 'inconnu@example.com')
    await user.click(screen.getByRole('button', { name: /envoyer la demande/i }))

    /* « Transmise », jamais « reçue » : le serveur répond pareil sur une adresse
       qui n'existe pas, et l'écran ne doit pas trahir ce silence. */
    expect(await screen.findByText(/demande transmise/i)).toBeTruthy()
  })
})

describe('le registre des accès du propriétaire', () => {
  function registre(demandes: unknown[]) {
    serveur.quand('GET', `/parks/${PARC}/access`, {
      status: 200,
      body: {
        members: [
          {
            id: 'm-1',
            role: 'owner',
            userId: 'u-proprio',
            tenantId: null,
            fullName: COMPTE_FICTIF.fullName,
            email: COMPTE_FICTIF.email,
            since: '2026-01-15T09:00:00.000Z',
          },
        ],
        requests: demandes,
        invitations: [],
      },
    })
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        scoped: false, accessUntil: null, collections: [], buildings: [], works: [],
        deposits: [], readings: [], inspections: [], notifications: [], leaseCharges: [],
      },
    })
  }

  const UNE_DEMANDE = [
    {
      id: DEMANDE,
      userId: 'u-gestion',
      fullName: 'Diane Mballa',
      email: 'diane@example.com',
      since: '2026-09-03T06:00:00.000Z',
    },
  ]

  it('montre la demande, avec le compte qui la porte', async () => {
    registre(UNE_DEMANDE)
    await renderApp('/app/acces', { session: PROPRIETAIRE })
    await attendreLeChargement()
    /* Deux fois : l'en-tête de la carte, et la légende du tableau — qui
       existe pour les technologies d'assistance. On vise le TITRE. */
    expect(screen.getByRole('heading', { name: /demandes d’accès/i })).toBeTruthy()
    expect(screen.getByText('Diane Mballa')).toBeTruthy()
  })

  it('accorde, et le dit au serveur', async () => {
    registre(UNE_DEMANDE)
    serveur.quand('PATCH', `/parks/${PARC}/memberships/${DEMANDE}/decision`, {
      status: 204,
      body: {},
    })
    await renderApp('/app/acces', { session: PROPRIETAIRE })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /^accorder$/i }))
    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH')
      expect((appel?.corps as { accorder?: boolean })?.accorder).toBe(true)
    })
  })

  it('refuse, et le dit aussi — c’est l’autre moitié de la décision', async () => {
    registre(UNE_DEMANDE)
    serveur.quand('PATCH', `/parks/${PARC}/memberships/${DEMANDE}/decision`, {
      status: 204,
      body: {},
    })
    await renderApp('/app/acces', { session: PROPRIETAIRE })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /^refuser$/i }))
    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH')
      expect((appel?.corps as { accorder?: boolean })?.accorder).toBe(false)
    })
  })

  it('ne montre RIEN quand il n’y a rien à trancher', async () => {
    /* Une section vide sur un écran qui en porte déjà trois ajouterait du bruit
       à qui n'a aucune décision à prendre. */
    registre([])
    await renderApp('/app/acces', { session: PROPRIETAIRE })
    await attendreLeChargement()
    expect(screen.queryByRole('heading', { name: /demandes d’accès/i })).toBeNull()
  })
})
