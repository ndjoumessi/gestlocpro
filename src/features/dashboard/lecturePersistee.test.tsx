import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * « TOUT MARQUER COMME LU » ÉCRIT QUELQUE PART.
 *
 * Le geste vivait dans un `useState` : la pastille s'éteignait, et le
 * rechargement suivant la rallumait avec exactement le même compte. Le serveur
 * relisait `readAt` depuis l'origine — personne ne l'écrivait. Un compteur qui
 * revient après un F5 apprend à l'utilisateur à ne plus le croire, ce qui est le
 * défaut que ce produit retire partout ailleurs.
 */

const PARC = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
const A3 = 'aaaaaaaa-1111-4000-8111-111111111111'

function session(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Une lue, deux non lues : le geste ne doit porter que sur les secondes. */
const NOTIFICATIONS = [
  {
    id: 'n-lue',
    kind: 'payment',
    messageKey: 'rentOverdue',
    params: { tenant: 'Serge Mbarga', unit: 'A3', count: 24 },
    severity: 'high',
    unitId: A3,
    createdAt: '2026-08-17T09:00:00.000Z',
    read: true,
  },
  {
    id: 'n-neuve',
    kind: 'announcement',
    messageKey: 'announcement',
    params: { text: 'Coupure d’eau jeudi de 8 h à 12 h.' },
    severity: 'medium',
    unitId: null,
    createdAt: '2026-08-19T09:00:00.000Z',
    read: false,
  },
  {
    id: 'n-autre',
    kind: 'work',
    messageKey: 'workReply',
    params: { text: 'Le plombier passe jeudi.', workId: 'w-1', reference: 'SIG-2026-042' },
    severity: 'medium',
    unitId: A3,
    createdAt: '2026-08-19T10:00:00.000Z',
    read: false,
  },
]

function installer(): FauxServeur {
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
      notifications: NOTIFICATIONS,
      leaseCharges: [],
    },
  })
  return faux
}

describe('l’état « lu » d’une notification', () => {
  it('compte ce que le SERVEUR dit non lu, et non toute la liste', async () => {
    installer()
    await renderApp('/app/signalements', { session: session() })
    // Une donnée du serveur, jamais le titre : le `<h1>` est rendu par l'écran
    // de chargement autant que par l'écran chargé.
    await screen.findByText(/Coupure d’eau jeudi/)

    // Deux, et non trois : `read: true` arrivait du serveur et l'écran le lisait
    // déjà — ce cas garde qu'il continue de le lire une fois le geste branché.
    expect(screen.getByText('2 non lues')).toBeInTheDocument()
  })

  it('n’envoie au serveur que les identifiants non lus', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}/notifications/read`, { status: 200, body: { marked: 2 } })
    await renderApp('/app/signalements', { session: session() })
    await screen.findByText(/Coupure d’eau jeudi/)

    await userEvent.setup().click(screen.getByRole('button', { name: /Tout marquer comme lu/ }))

    await waitFor(() => expect(screen.getByText(/Toutes les notifications sont lues/)).toBeInTheDocument())
    const appel = faux.appels.find((a) => a.methode === 'PATCH' && a.chemin.endsWith('/notifications/read'))
    /*
      LA LISTE ENTIÈRE serait passée sans que rien ne se voie : le serveur aurait
      rendu `marked: 2` de la même façon, puisqu'il ne recompte que les nouvelles
      lectures. Elle est pourtant bornée à deux cents identifiants, et un parc
      bavard aurait vu le bouton échouer en validation.
    */
    expect(appel?.corps).toEqual({ ids: ['n-neuve', 'n-autre'] })
  })

  /**
   * Le bouton disparaît quand il n'a plus rien à marquer — il le faisait déjà —
   * et la moitié qui compte est qu'il n'appelle plus le serveur pour rien.
   */
  it('ne rappelle pas le serveur quand tout est déjà lu', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}/notifications/read`, { status: 200, body: { marked: 2 } })
    await renderApp('/app/signalements', { session: session() })
    await screen.findByText(/Coupure d’eau jeudi/)

    await userEvent.setup().click(screen.getByRole('button', { name: /Tout marquer comme lu/ }))
    await waitFor(() => expect(screen.getByText(/Toutes les notifications sont lues/)).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Tout marquer comme lu/ })).not.toBeInTheDocument()
    const appels = faux.appels.filter((a) => a.chemin.endsWith('/notifications/read'))
    expect(appels).toHaveLength(1)
  })

  /**
   * En DÉMONSTRATION, rien ne part — et ce n'est pas un oubli.
   *
   * Le parcours de démonstration n'a pas de compte à qui rattacher une lecture,
   * et son état est celui de la session : c'est le comportement documenté du
   * provider, que le branchement au serveur ne doit pas emporter au passage.
   */
  it('ne prétend pas écrire une lecture en démonstration', async () => {
    const faux = installerFauxServeur()
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /Tout marquer comme lu/ }))

    await waitFor(() => expect(screen.getByText(/Toutes les notifications sont lues/)).toBeInTheDocument())
    expect(faux.appels.some((a) => a.chemin.includes('/notifications/read'))).toBe(false)
  })
})
