import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * L'HEURE D'ENVOI SE RÈGLE ICI, ET SON FUSEAU AVEC ELLE.
 *
 * ═══ POURQUOI CET ÉCRAN PEUT LA PORTER ═══
 *
 * Le cron passait une fois par jour à heure fixe : l'heure lui appartenait, et
 * la changer demandait d'ouvrir un tableau de bord d'hébergeur. Il passe
 * désormais TOUTES LES HEURES et ne fait rien pour un parc dont ce n'est pas
 * l'heure. La planification ne sait plus QUAND envoyer, seulement quand
 * REGARDER — et c'est ce qui libère ce champ.
 *
 * ═══ POURQUOI LE FUSEAU EST À CÔTÉ, ET NON DÉDUIT ═══
 *
 * « 7 h » ne veut rien dire seul. Le pays ne le donne pas : ce produit a en
 * production un parc qui porte `FR` et loue à Yaoundé. Déduire le fuseau du
 * pays réveillerait des locataires à 6 h du matin pour la seule raison que le
 * parc a été créé avec le mauvais drapeau.
 *
 * C'est l'heure de qui REÇOIT qui compte, jamais celle de qui administre.
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
  /* Un parc PEUPLÉ : sur un parc vide, l'écran ne rend pas sa rangée d'actions
     et le déclencheur des réglages n'existe pas. */
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
  await user.click(screen.getByRole('button', { name: /Autres actions/ }))
  await user.click(screen.getByRole('menuitem', { name: /Corriger le parc/ }))
  return user
}

describe('l’heure de la relance', () => {
  it('part telle que le parc l’a choisie', async () => {
    serveur.quand('PATCH', `/parks/${PARC}`, { status: 200, body: { park: {} } })
    const user = await ouvrirLesReglages()

    const heure = screen.getByRole('spinbutton', { name: /heure/i })
    await user.clear(heure)
    await user.type(heure, '7')
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
        (appel?.corps as { reminderHour?: number })?.reminderHour,
        'l’heure doit sortir de la planification et entrer dans le produit',
      ).toBe(7)
    })
  })

  it('emporte le FUSEAU, sans lequel une heure ne veut rien dire', async () => {
    serveur.quand('PATCH', `/parks/${PARC}`, { status: 200, body: { park: {} } })
    const user = await ouvrirLesReglages()

    const fuseau = screen.getByRole('combobox', { name: /fuseau/i })
    await user.click(fuseau)
    await user.type(fuseau, 'Douala')
    await user.click(screen.getByRole('option', { name: 'Africa/Douala' }))
    const reglages = await screen.findByRole('dialog')
    await user.click(within(reglages).getByRole('button', { name: /Enregistrer|Corriger/ }))

    await waitFor(() => {
      const appel = serveur.appels.find((a) => a.methode === 'PATCH')
      expect(
        (appel?.corps as { reminderTimeZone?: string })?.reminderTimeZone,
        'c’est le fuseau de qui REÇOIT, jamais celui de qui administre',
      ).toBe('Africa/Douala')
    })
  })

  it('disparaît avec l’interrupteur, plutôt que de rester grisée', async () => {
    /* Un réglage dont l'effet dépend d'un autre doit disparaître : grisé, il
       occupe la place et laisse croire qu'il reste quelque chose à décider. */
    const user = await ouvrirLesReglages()
    expect(screen.getByRole('spinbutton', { name: /heure/i })).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /relance/i }))

    expect(screen.queryByRole('spinbutton', { name: /heure/i })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /fuseau/i })).toBeNull()
  })
})
