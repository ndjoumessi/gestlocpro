import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Le dossier d'un logement.
 *
 * La question « que s'est-il passé dans ce logement ? » n'avait aucune réponse :
 * ce qu'on en sait vivait sur cinq écrans, dont aucun ne le montre avec sa
 * propre histoire. L'occupation passée n'apparaissait nulle part, alors que le
 * modèle porte des baux datés depuis l'origine.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/**
 * Deux occupations successives du MÊME logement.
 *
 * C'est le cas que le produit ne savait pas montrer : Awa Bello habite depuis
 * mars, Marc Ekani a occupé le logement avant elle et en est parti. Le loyer
 * d'alors — 82 000 — n'est pas celui d'aujourd'hui, et c'est aussi ce qu'un
 * dossier doit conserver.
 */
const OCCUPATIONS = [
  {
    id: 'bail-2',
    unitId: UNITE,
    tenant: 'Awa Bello',
    startsOn: '2026-03-01T00:00:00.000Z',
    endsOn: null,
    rentMinor: 90000,
    status: 'active' as const,
  },
  {
    id: 'bail-1',
    unitId: UNITE,
    tenant: 'Marc Ekani',
    startsOn: '2023-09-01T00:00:00.000Z',
    endsOn: '2026-02-28T00:00:00.000Z',
    rentMinor: 82000,
    status: 'ended' as const,
  },
]

function serveur(leases: typeof OCCUPATIONS | []) {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: UNITE,
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-2',
              leaseStartsOn: '2026-03-01T00:00:00.000Z',
              paidMinor: 90000,
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
      leases,
    },
  })
  return faux
}

async function ouvrirLeDossier(leases: typeof OCCUPATIONS | [] = OCCUPATIONS) {
  serveur(leases)
  await renderApp(`/app/parc/${UNITE}`, { session: sessionProprietaire() })
  await attendreLeChargement()
}

describe('dossier d’un logement', () => {
  it('réunit l’occupation, les périodes, les travaux et les pièces', async () => {
    await ouvrirLeDossier()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Résidence Essos — B7')
    for (const carte of ['Occupation', 'Périodes facturées', 'Travaux du logement', 'Pièces du dossier'])
      expect(screen.getByRole('heading', { level: 2, name: carte })).toBeInTheDocument()
  })

  /**
   * LE CŒUR DU CHANTIER : les locataires successifs.
   *
   * Le portefeuille ne rendait que le bail en cours. Un logement a autant de
   * dossiers que d'occupants, et le loyer d'alors n'est pas celui
   * d'aujourd'hui.
   */
  it('montre les occupants passés, avec le loyer de leur époque', async () => {
    await ouvrirLeDossier()
    const carte = screen.getByRole('list', { name: 'Occupation' })

    expect(carte).toHaveTextContent('Awa Bello')
    expect(carte).toHaveTextContent('Marc Ekani')
    // 82 000 était le loyer de Marc Ekani ; l'unité en vaut 90 000 aujourd'hui.
    expect(carte).toHaveTextContent('82 000')
  })

  /**
   * « depuis le … » pour un bail qui court, « du … au … » pour un bail
   * terminé : la même formule dirait sinon « du 01/03/2026 au — », ce qui se
   * lit comme une date manquante plutôt que comme une occupation en cours.
   */
  it('distingue le bail en cours du bail terminé', async () => {
    await ouvrirLeDossier()
    const carte = screen.getByRole('list', { name: 'Occupation' })
    expect(carte.textContent).toMatch(/depuis le 01\/03\/2026/)
    expect(carte.textContent).toMatch(/du 01\/09\/2023 au 28\/02\/2026/)
  })

  /**
   * Sans occupation servie, on le DIT — et on n'invente pas d'occupants passés
   * qu'aucun autre écran ne connaîtrait.
   */
  it('annonce la case vide quand le serveur ne rend aucun bail', async () => {
    await ouvrirLeDossier([])
    expect(screen.getByText('Aucun bail enregistré')).toBeInTheDocument()
  })

  /**
   * Une adresse forgée ne renvoie pas en silence vers la liste : ce serait se
   * faire passer pour un clic manqué.
   */
  it('dit qu’un logement est introuvable au lieu de replier vers le parc', async () => {
    serveur(OCCUPATIONS)
    await renderApp('/app/parc/nexiste-pas', { session: sessionProprietaire() })
    await attendreLeChargement()
    expect(screen.getByText('Ce logement est introuvable')).toBeInTheDocument()
  })
})

describe('le parc mène au dossier', () => {
  /**
   * Un LIEN dans la cellule, pas une ligne cliquable.
   *
   * `DataTable` avait laissé la voie ouverte en toutes lettres : « le jour où
   * une ligne devra mener quelque part, la réponse juste sera un vrai lien dans
   * une cellule — focalisable, ouvrable dans un nouvel onglet, annoncé par sa
   * destination — et non une rangée piégée ».
   */
  it('ouvre le dossier depuis un lien nommé par sa destination', async () => {
    const user = userEvent.setup()
    serveur(OCCUPATIONS)
    await renderApp('/app/parc', { session: sessionProprietaire() })
    await attendreLeChargement()

    const lien = within(screen.getByRole('table')).getByRole('link', {
      name: 'Ouvrir le dossier du logement B7',
    })
    await user.click(lien)
    await attendreLeChargement()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Résidence Essos — B7')
  })

  /**
   * LE DOSSIER SE NOMME LUI-MÊME, ET N'EST JAMAIS « ÉCRAN INTROUVABLE ».
   *
   * Ce cas visait le fil d'Ariane, qui comparait l'adresse par égalité
   * stricte : le dossier — qui n'est l'adresse d'aucune entrée de navigation —
   * s'y annonçait « Écran introuvable » sur une page qui s'ouvrait
   * parfaitement. Le lot de la coquille a retiré le fil, et avec lui cette
   * déduction : le nom de l'écran ne se devine plus, il vient de l'écran.
   *
   * CE QUE LE CAS GARDE MAINTENANT, et c'est la moitié qui comptait : le
   * dossier ne bascule pas sur le 404. Le titre du document est le bon endroit
   * pour le vérifier — c'est lui qu'on retrouve dans un signet et dans
   * l'historique, et c'est lui qui portait le mensonge le plus durable.
   */
  it('se nomme lui-même, et non « écran introuvable »', async () => {
    await ouvrirLeDossier()
    expect(document.title).toContain('Résidence Essos — B7')
    expect(document.title).not.toContain('introuvable')
    expect(screen.queryByText('Écran introuvable')).not.toBeInTheDocument()
  })
})
