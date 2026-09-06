import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * « LE STATUT PORTE SUR LE MOIS AFFICHÉ » — ET AUCUN MOIS NE S'AFFICHAIT.
 *
 * Le sous-titre du Parc porte cette phrase depuis son écriture. Rien ne montrait
 * de mois, rien n'en changeait : la route rendait la dernière échéance de chaque
 * bail, et l'écran nommait une dimension qu'il ne donnait pas.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * 1. Le mois vit dans l'URL. C'est ce qui le rend partageable et lui fait
 *    survivre à l'aller-retour vers le dossier d'un logement — la raison exacte
 *    pour laquelle le filtre d'immeuble y vivait avant d'en être retiré.
 * 2. Reculer d'un mois RELIT le parc à ce mois-là. Deux lectures, deux réponses :
 *    sans quoi le contrôle serait un ornement qui déplace une étiquette.
 * 3. On ne va pas au-delà du mois en cours. Un mois futur n'a rien d'appelé : sa
 *    colonne entière dirait « Non appelé », ce qui se lit comme un défaut du parc
 *    et non comme un calendrier.
 * 4. EN DÉMONSTRATION LE CONTRÔLE EST FERMÉ, ET IL DIT POURQUOI. Le jeu ne porte
 *    pas d'historique d'échéances. Le laisser agir mentirait sur le nombre le
 *    plus sensible de l'écran ; le cacher le mettrait hors de portée de
 *    `mesure-ui`, `modales` et `espace-connecte`, qui ne visitent que `/demo`.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Le mois précédent, calculé comme l'écran le calcule. */
function moisPrecedent() {
  const d = new Date()
  const p = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1))
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Un parc dont le logement est À JOUR ce mois-ci et EN RETARD le mois d'avant.
 *
 * C'est le couple qui fait le cas : sur un jeu où les deux mois se
 * ressembleraient, « le contrôle relit » passerait au vert sur un contrôle qui
 * ne relit rien.
 */
function parcQuiChangeAvecLeMois() {
  const serveur = installerFauxServeur()
  const unite = (status: string) => ({
    id: 'u-1',
    label: 'A1',
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    paidMinor: status === 'paid' ? 185000 : 0,
    status,
    overdueDays: status === 'overdue' ? 40 : null,
    leaseId: 'bail-1',
    leaseStartsOn: '2026-01-01',
    tenant: { id: 't-1', fullName: 'Charles Ngassa', phoneE164: '+237677214408' },
  })
  const corps = (status: string) => ({
    collections: [],
    buildings: [
      { id: 'b-1', name: 'Résidence Pleine', district: 'Bastos', units: [unite(status)] },
    ],
    works: [],
    deposits: [],
    readings: [],
    inspections: [],
    notifications: [],
  })

  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: corps('paid') })
  serveur.quand('GET', `/parks/${PARC}/portfolio?mois=${moisPrecedent()}`, {
    status: 200,
    body: corps('overdue'),
  })
  return serveur
}

describe('le mois affiché du parc', () => {
  it('relit le parc au mois précédent, et le montre', async () => {
    parcQuiChangeAvecLeMois()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    const table = () => screen.getByRole('table')
    expect(within(table()).getByText('À jour'), 'ce mois-ci, le loyer est réglé').toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Mois précédent' }))
    /*
      DEUX LECTURES, DEUX RÉPONSES. C'est la seule preuve que le contrôle RELIT
      et ne déplace pas seulement une étiquette : le faux serveur sert un état
      différent sur l'adresse portant `?mois=`.
    */
    expect(await within(table()).findByText('En retard')).toBeInTheDocument()
  })

  it('demande le mois au serveur, et jamais le mois courant', async () => {
    const serveur = parcQuiChangeAvecLeMois()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    /*
      CE CAS INTERROGE LES REQUÊTES, PAS `window.location`, et il faut le dire :
      le harnais monte un `MemoryRouter` — « pas d'URL réelle à manipuler ». Une
      assertion sur `window.location.search` y passerait au vert quoi qu'il
      arrive, puisqu'elle reste vide en toutes circonstances. Un premier jet la
      portait ; elle ne gardait rien.

      Ce qui se prouve ici est plus fort de toute façon : le mois ATTEINT le
      serveur. Que l'adresse le porte se prouve dans l'autre sens, au cas
      suivant, en ouvrant l'écran dessus.
    */
    const lectures = () =>
      serveur.appels.filter((a) => a.methode === 'GET' && a.chemin.includes('/portfolio'))

    expect(lectures()[0]!.chemin, 'le mois courant ne se demande pas').not.toContain('mois=')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Mois précédent' }))
    await screen.findByText('En retard')
    expect(lectures().at(-1)!.chemin).toContain(`mois=${moisPrecedent()}`)
  })

  it('ouvre directement sur le mois que porte l’adresse', async () => {
    parcQuiChangeAvecLeMois()
    await renderApp(`/app/parc?mois=${moisPrecedent()}`, { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    /* C'est ce qui rend la vue PARTAGEABLE et lui fait survivre à l'aller-retour
       vers le dossier d'un logement — la raison pour laquelle le filtre
       d'immeuble vivait dans l'URL avant d'en être retiré. */
    expect(await screen.findByText('En retard')).toBeInTheDocument()
  })

  it('refuse d’aller au-delà du mois en cours, et dit pourquoi', async () => {
    parcQuiChangeAvecLeMois()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    const suivant = screen.getByRole('button', { name: /^Mois suivant — rien n’est appelé/ })
    expect(suivant).toHaveAttribute('aria-disabled', 'true')

    await userEvent.setup().click(suivant)

    /* GARDE DU GARDE — reculé d'un mois, le geste s'OUVRE. Sans cette moitié,
       « le suivant est fermé » serait satisfait par un bouton fermé pour
       toujours, ce qui est un autre défaut. */
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(await screen.findByRole('button', { name: 'Mois suivant' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('montre le contrôle FERMÉ en démonstration, avec son motif', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 1280 })
    await attendreLeChargement()

    /*
      NI ABSENT NI AGISSANT. Le jeu de démonstration ne porte pas d'historique
      d'échéances : le laisser agir mentirait, et le cacher le mettrait hors de
      portée des trois portes au navigateur, qui ne visitent que `/demo`.

      Le motif vit dans le NOM ACCESSIBLE, atteignable au clavier — c'est
      pourquoi `aria-disabled` et non `disabled`.
    */
    const fermes = screen.getAllByRole('button', {
      name: /^Changer de mois — la démonstration ne porte qu’un mois$/,
    })
    expect(fermes, 'les deux flèches sont fermées').toHaveLength(2)
    for (const f of fermes) expect(f).toHaveAttribute('aria-disabled', 'true')

    // Et le mois EN COURS reste affiché : fermé ne veut pas dire muet.
    expect(screen.getByRole('group', { name: 'Mois affiché' }).textContent).toBeTruthy()
  })
})
