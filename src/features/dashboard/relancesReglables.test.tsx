import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA RELANCE AUTOMATIQUE SE RÈGLE DEPUIS LE PRODUIT.
 *
 * ═══ LE PARTAGE DES RÔLES ═══
 *
 * Le CRON est bête : il passe tous les jours à heure fixe. La POLITIQUE vit
 * ici — faut-il relancer, et au bout de combien de jours. Laisser le jalon dans
 * la planification obligerait un propriétaire à ouvrir un tableau de bord
 * d'hébergeur pour changer d'avis sur ses propres locataires.
 *
 * C'est déjà la disposition de `leaseAccessMonths`, dans cette même modale.
 *
 * ═══ POURQUOI L'INTERRUPTEUR EXISTE ═══
 *
 * La relance n'avait jamais tourné : aucun cron ne la lançait. Elle se met à
 * partir pour de bon, et le premier geste qu'un propriétaire doit pouvoir faire
 * est de l'ARRÊTER — avant d'avoir à comprendre le reste.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [
    { parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF', countryCode: 'CM' },
  ],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLesReglages() {
  /* UN PARC PEUPLÉ : sur un parc vide, l'écran ne rend pas sa rangée d'actions,
     et le déclencheur des réglages n'existe pas. Ce n'est pas un défaut — il n'y
     a rien à corriger sur un parc qu'on n'a pas encore rempli. */
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      scoped: false,
      accessUntil: null,
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'u-1',
              label: 'A1',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: null,
              status: 'vacant',
              leaseId: null,
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
    },
  })
  await renderApp('/app/parc', { session })
  await attendreLeChargement()
  const user = userEvent.setup()
  /* Le déclencheur vit dans le menu de DÉBORDEMENT de l'écran, pas dans sa
     rangée d'actions — il faut donc l'ouvrir d'abord. */
  await user.click(screen.getByRole('button', { name: /Autres actions/ }))
  await user.click(screen.getByRole('menuitem', { name: /Corriger le parc/ }))
  return user
}

describe('les relances automatiques', () => {
  it('se coupent depuis la modale du parc', async () => {
    serveur.quand('PATCH', `/parks/${PARC}`, { status: 200, body: { park: {} } })
    const user = await ouvrirLesReglages()

    await user.click(screen.getByRole('checkbox', { name: /relance/i }))
    /* PORTÉE À LA MODALE, et ce n'est pas un contournement.

       `screen` cherche dans la PAGE entière : depuis que l'écran du parc offre
       « Corriger » sur chaque logement, ce motif large trouvait treize boutons
       au lieu d'un. Le test cherchait le bouton d'enregistrement des réglages ;
       il désignait en fait « le seul bouton de la page qui ressemble à ça », ce
       qui n'a jamais été la même chose. La modale est ce qu'on éprouve — c'est
       elle qui borne la recherche. */
    const reglages = await screen.findByRole('dialog')
    await user.click(within(reglages).getByRole('button', { name: /Enregistrer|Corriger/ }))

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH')
      expect(
        (appel?.corps as { autoReminders?: boolean })?.autoReminders,
        'le premier geste possible doit être de l’arrêter',
      ).toBe(false)
    })
  })

  it('portent le JOUR à partir duquel elles partent', async () => {
    serveur.quand('PATCH', `/parks/${PARC}`, { status: 200, body: { park: {} } })
    const user = await ouvrirLesReglages()

    const jour = screen.getByRole('spinbutton', { name: /jour/i })
    await user.clear(jour)
    await user.type(jour, '3')
    const reglages = await screen.findByRole('dialog')
    await user.click(within(reglages).getByRole('button', { name: /Enregistrer|Corriger/ }))

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH')
      expect(
        (appel?.corps as { reminderMilestoneDays?: number })?.reminderMilestoneDays,
        'un bailleur qui relance à trois jours a un autre parc, pas tort',
      ).toBe(3)
    })
  })
})
