import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * « GÈRE TOUT LE PARC » SE DISAIT DE QUELQU'UN QUI NE VOYAIT RIEN.
 *
 * ═══ LES DEUX VIDES ═══
 *
 * L'écran concluait : `buildingIds` et `unitIds` vides ⇒ « Gère tout le parc ».
 * C'était juste tant qu'un seul état produisait des listes vides. Il y en a
 * DEUX depuis le lot de la portée :
 *
 *   `wholePark` + vide  → gère réellement tout le parc ;
 *   `declared`  + vide  → ne voit RIEN — et c'est l'état de NAISSANCE de tout
 *                         gestionnaire invité depuis ce lot.
 *
 * Le registre affirmait donc l'inverse de la vérité sur le cas le plus
 * fréquent : celui qui vient d'arriver. Et c'est le SEUL écran d'où un
 * propriétaire peut s'apercevoir de ce qu'il a confié.
 *
 * ═══ LE SERVEUR D'AVANT GARDE L'ANCIEN LIBELLÉ ═══
 *
 * `scope` absent ne veut pas dire `declared` : il veut dire « ce serveur ne
 * sait pas ». Conclure « rien de confié » d'un silence inventerait un bornage,
 * et afficherait « rien » sur des gestionnaires qui gèrent tout. Même règle que
 * `buildingIds`, et pour la même raison.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const GESTION = '22222222-3333-4444-8555-666666666666'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

/** Le registre avec un seul gestionnaire, dont on choisit la portée. */
async function registreAvecUnGestionnaire(portee?: 'wholePark' | 'declared') {
  serveur.quand('GET', `/parks/${PARC}/access`, {
    status: 200,
    body: {
      members: [
        {
          id: GESTION,
          role: 'manager',
          userId: 'compte-gestion',
          tenantId: null,
          fullName: 'Diane Mballa',
          email: 'diane@example.com',
          // Les listes sont VIDES dans les trois cas : c'est tout le sujet.
          buildingIds: [],
          unitIds: [],
          excludedUnitIds: [],
          since: '2026-03-02T09:00:00.000Z',
          ...(portee ? { scope: portee } : {}),
        },
      ],
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
  await renderApp('/app/acces', { session })
  await attendreLeChargement()
}

describe('la portée au registre des accès', () => {
  it('ne dit PLUS « gère tout le parc » de celui qui ne voit rien', async () => {
    await registreAvecUnGestionnaire('declared')
    expect(
      screen.queryByText(/Gère tout le parc/i),
      'il vient d’arriver, rien ne lui est confié, et le registre affirmait l’inverse',
    ).toBeNull()
  })

  it('dit ce qu’il en est : rien ne lui est encore confié', async () => {
    await registreAvecUnGestionnaire('declared')
    expect(screen.getByText(/rien ne lui est encore confié/i)).toBeTruthy()
  })

  it('garde « gère tout le parc » pour celui qui le gère vraiment', async () => {
    await registreAvecUnGestionnaire('wholePark')
    expect(screen.getByText(/Gère tout le parc/i)).toBeTruthy()
  })

  it('garde l’ancien libellé quand le serveur ne dit pas la portée', async () => {
    /* Un serveur d'avant ce lot ne rend pas `scope`. Conclure « rien de
       confié » de son silence inventerait un bornage. */
    await registreAvecUnGestionnaire(undefined)
    expect(screen.getByText(/Gère tout le parc/i)).toBeTruthy()
  })
})
