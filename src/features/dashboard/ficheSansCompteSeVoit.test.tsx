import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UNE FICHE SANS COMPTE SE VOIT LÀ OÙ ELLE VIT.
 *
 * ═══ DEUX ÉCRANS QUI SE CONTREDISENT EN SILENCE ═══
 *
 * Capturé sur la production. « Locataires et baux » : BEKONO LANDRY, A1, bail
 * actif, statut « À jour », 32 798 FCFA. Son espace à lui, au même instant :
 * « Aucun logement rattaché à votre compte ». Les deux sont VRAIS — la fiche
 * existe et porte le bail, elle n'a simplement pas de compte.
 *
 * Et rien, sur l'écran du bailleur, ne le laissait deviner. L'anomalie n'était
 * lisible que sur « Accès au parc », c'est-à-dire à l'endroit où l'on va quand
 * on soupçonne DÉJÀ quelque chose. De son côté, tout allait bien : un locataire
 * en place, à jour, dans un logement. Il n'avait aucune raison de chercher.
 *
 * ═══ CE QUE CE FICHIER GARDE ═══
 *
 * Que le statut du BAIL ne serve jamais à conclure sur l'ACCÈS — un locataire
 * peut être parfaitement à jour de ses loyers et n'avoir aucun espace où le
 * lire. Le produit dit déjà cette distinction ailleurs, sur l'annonce : « un
 * locataire sans compte ne recevra rien — il n'a pas d'espace où lire ». Elle
 * manquait à l'écran qui liste les locataires.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

/** Le parc de la capture : A1 sans compte, B1 avec. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Residence Djoumessi',
      district: 'Bastos',
      units: [
        {
          id: 'u-a1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 100,
          rentMinor: 32798,
          tenant: {
            id: 'loc-landry',
            fullName: 'Bekono Landry',
            phoneE164: '+237600000001',
            hasAccount: false,
          },
          status: 'paid',
          leaseId: 'bail-a1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 32798,
          overdueDays: null,
        },
        {
          id: 'u-b1',
          label: 'B1',
          type: 'T3',
          surfaceSqm: 120,
          rentMinor: 69997,
          tenant: {
            id: 'loc-martial',
            fullName: 'Djoumessi Martial',
            phoneE164: '+237677111111',
            hasAccount: true,
          },
          status: 'pending',
          leaseId: 'bail-b1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 0,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', `/parks/${PARC}/access`, {
    status: 200,
    body: { members: [], invitations: [] },
  })
})

/** La ligne du tableau qui porte ce nom. */
function ligneDe(nom: string) {
  const cellule = screen.getByText(new RegExp(nom, 'i'))
  const ligne = cellule.closest('tr')
  expect(ligne, `aucune ligne pour ${nom}`).not.toBeNull()
  return ligne!
}

describe('une fiche sans compte, sur l’écran des locataires', () => {
  beforeEach(async () => {
    await renderApp('/app/locataires', { session: SESSION })
    await attendreLeChargement()
  })

  it('marque celle qui n’a pas de compte', async () => {
    expect(
      within(ligneDe('Bekono Landry')).getByText(/sans compte/i),
      'la fiche orpheline se présente comme les autres : le bailleur ne verra rien',
    ).toBeInTheDocument()
  })

  it('ne marque pas celle qui en a un', async () => {
    // La moitié sans laquelle marquer tout le monde satisferait le cas précédent.
    expect(within(ligneDe('Djoumessi Martial')).queryByText(/sans compte/i)).not.toBeInTheDocument()
  })

  it('dit la conséquence, et où la réparer', async () => {
    /* Une pastille seule nomme un état sans dire ce qu'il coûte. Ce qu'il coûte
       est précis : ce locataire n'a AUCUN espace où lire son bail, ses
       quittances ni ses relevés, et le geste qui répare vit sur un autre écran. */
    const note = screen.getByText(/ni bail, ni quittance/i).closest('div')!
    /* Borné à la NOTE : la barre latérale porte elle aussi un lien « Accès au
       parc », et le trouver ne dirait rien de ce que ce cas mesure. */
    const vers = within(note).getByRole('link', { name: /accès au parc|relier/i })
    expect(vers).toHaveAttribute('href', '/app/acces')
  })
})
