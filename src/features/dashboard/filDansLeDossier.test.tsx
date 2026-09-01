import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE FIL SE LIT AUSSI DEPUIS LE DOSSIER DU LOGEMENT.
 *
 * ═══ LE DERNIER ÉCRAN QUI NE LE PORTAIT PAS ═══
 *
 * Le dossier d'un logement liste ses travaux depuis toujours, avec leur statut
 * et leur montant engagé. Ce qui s'est DIT autour, non : « le plombier passe
 * jeudi entre 8 h et 12 h », « je serai absent toute la semaine ».
 *
 * Ces deux phrases sont exactement ce qu'on cherche en ouvrant un dossier avant
 * d'appeler quelqu'un — et il fallait aller les lire sur un autre écran, ou
 * dans une liste d'avis mêlée d'impayés.
 *
 * ═══ LE MÊME REGROUPEMENT QUE PARTOUT AILLEURS ═══
 *
 * Même `workId`, même ordre — du plus ancien au plus récent —, mêmes deux
 * étiquettes. Un échange n'a pas trois histoires selon l'écran qui l'ouvre, et
 * c'est ce que ces cas gardent : le troisième écran dit la même chose que les
 * deux autres.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const IMM = 'cccccccc-3333-4000-8333-333333333333'
const A1 = 'aaaaaaaa-1111-4000-8111-111111111111'
const CHANTIER = 'w-fuite'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

const avis = (id: string, cle: 'workReply' | 'tenantReply', texte: string) => ({
  id,
  kind: 'work',
  messageKey: cle,
  params: {
    text: texte,
    workId: CHANTIER,
    reference: 'SIG-2026-042',
    ...(cle === 'tenantReply' ? { tenant: 'Charles Ngassa', unitId: 'A1' } : {}),
  },
  severity: 'medium',
  unitId: A1,
  createdAt: cle === 'workReply' ? '2026-08-19T10:00:00.000Z' : '2026-08-20T10:00:00.000Z',
  read: true,
})

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: IMM,
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: A1,
              label: 'A1',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: { id: 'loc-A1', fullName: 'Charles Ngassa', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-A1',
              leaseStartsOn: '2025-03-01T00:00:00.000Z',
              paidMinor: 90000,
              overdueDays: null,
            },
          ],
        },
      ],
      works: [
        {
          id: CHANTIER,
          reference: 'SIG-2026-042',
          unitId: A1,
          title: 'Fuite sous l’évier',
          trade: 'plumbing',
          status: 'reported',
          urgency: 'normal',
          reportedAt: '2026-07-12T00:00:00.000Z',
          origin: 'tenantReport',
          reportedBy: 'Charles Ngassa',
        },
      ],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [
        avis('n-descend', 'workReply', 'Le plombier passe jeudi entre 8 h et 12 h.'),
        avis('n-monte', 'tenantReply', 'Je serai absent toute la semaine.'),
      ],
      leaseCharges: [],
    },
  })
})

describe('le dossier d’un logement', () => {
  it('porte l’échange sous le chantier dont il parle', async () => {
    await renderApp(`/app/parc/${A1}`, { session })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(
      within(main).getByText(/Le plombier passe jeudi entre 8 h et 12 h/),
      'il fallait aller lire l’échange sur un autre écran avant d’appeler',
    ).toBeInTheDocument()
    expect(within(main).getByText(/Je serai absent toute la semaine/)).toBeInTheDocument()
  })

  it('permet de RÉPONDRE depuis le dossier, par la même modale que les travaux', async () => {
    /* Le fil est entré ici en lecture seule au lot précédent — « on le lit, on
       n'y écrit pas ». C'était couper le geste de son contexte : on relit
       « je serai absent » ICI, puis il fallait changer d'écran pour répondre. */
    serveur.quand('POST', `/parks/${PARC}/works/${CHANTIER}/reply`, {
      status: 201,
      body: { delivered: true, reporter: { fullName: 'Charles Ngassa' } },
    })
    await renderApp(`/app/parc/${A1}`, { session })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Répondre' }))
    const modale = within(await screen.findByRole('dialog'))
    await user.type(modale.getByRole('textbox'), 'Le plombier repasse mardi.')
    await user.click(modale.getByRole('button', { name: /Envoyer/ }))

    await waitFor(() => {
      const appel = serveur.appels.find(
        (x) => x.methode === 'POST' && x.chemin.endsWith('/reply'),
      )
      expect(appel?.corps, 'le geste doit partir vers la MÊME route que les travaux').toEqual({
        message: 'Le plombier repasse mardi.',
      })
    })
  })

  it('dit qui a parlé, comme les deux autres écrans', async () => {
    /* Un échange n'a pas trois histoires selon l'écran qui l'ouvre : les
       étiquettes sont celles de `Travaux`, et non une troisième formulation. */
    await renderApp(`/app/parc/${A1}`, { session })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(within(main).getByText(/Réponse de la gestion/)).toBeInTheDocument()
    expect(within(main).getByText(/Réponse du locataire/)).toBeInTheDocument()
  })
})

describe('la réponse de la gestion, une fois envoyée', () => {
  /**
   * ═══ « ENVOYÉE » ET RIEN NE BOUGE ═══
   *
   * Le lot qui a posé la réponse depuis le dossier le nommait en dette : « la
   * modale dit “réponse envoyée” et le fil ne se rafraîchit qu'au
   * rechargement ». Le chemin du LOCATAIRE, lui, écrit une alerte locale
   * depuis toujours — `replyToWork` dans le provider — et sa phrase paraît à
   * l'instant. Deux chemins pour le même geste, dont un seul tenait sa
   * promesse.
   *
   * L'ALERTE LOCALE N'EST PAS UN MENSONGE : le serveur a répondu 201 avant
   * qu'on la pose. Elle porte ce qui vient d'être écrit, à l'endroit où le
   * serveur le rendra au prochain chargement.
   */
  it('fait paraître la phrase sous le chantier, sans recharger', async () => {
    serveur.quand('POST', `/parks/${PARC}/works/${CHANTIER}/reply`, {
      status: 201,
      body: { delivered: true, reporter: { fullName: 'Charles Ngassa' } },
    })
    await renderApp(`/app/parc/${A1}`, { session })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Répondre' }))
    const modale = within(await screen.findByRole('dialog'))
    await user.type(modale.getByRole('textbox'), 'Le plombier repasse mardi.')
    await user.click(modale.getByRole('button', { name: /Envoyer/ }))

    await waitFor(() => {
      const phrase = screen.getByText('Le plombier repasse mardi.')
      expect(
        phrase,
        'la modale disait « envoyée » et le fil restait muet jusqu’au rechargement',
      ).toBeInTheDocument()
      /* ET SOUS LA BONNE ÉTIQUETTE. `workReply` et non `tenantReply` : c'est ce
         mot qui décide de la phrase d'en-tête, et l'inverser ferait d'une
         réponse du bailleur celle du locataire. Un premier témoin a refusé de
         rougir sur ce point — la garde ne regardait que le texte. */
      expect(phrase.parentElement?.textContent).toContain('Réponse de la gestion')
    })
  })
})
