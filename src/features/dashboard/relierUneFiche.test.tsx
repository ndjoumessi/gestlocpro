import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * RELIER UNE FICHE LOCATAIRE À UN COMPTE, DEPUIS L'ÉCRAN QUI ADMINISTRE LES ACCÈS.
 *
 * ═══ UNE PROMESSE SANS MÉCANISME ═══
 *
 * L'espace du locataire sans fiche dit, mot pour mot : « Demandez à votre
 * propriétaire ou à votre gestionnaire de relier votre fiche locataire à ce
 * compte. » Ce geste n'existait NULLE PART. Le produit envoyait le locataire
 * réclamer une action introuvable — pire que de se taire, puisqu'il fait douter
 * celui qui cherche.
 *
 * ═══ POURQUOI SUR CET ÉCRAN-LÀ ═══
 *
 * « Accès au parc » dit qui accède. Le défaut est précisément qu'une personne
 * accède SANS être reliée à sa fiche : c'est ici que l'anomalie se voit, donc
 * ici qu'elle se répare. La liste des fiches, elle, montre des baux — pas des
 * comptes — et n'aurait rien à quoi rattacher.
 *
 * Le serveur garde les refus, éprouvés par `relierLaFiche.test.ts` : compte non
 * membre, membre non locataire, fiche déjà reliée, compte déjà relié. L'écran
 * ne les redit pas ; il ne propose que ce qui est reliable.
 */
const PARC = '11111111-2222-4333-8444-555555555555'

function session(role: 'owner' | 'manager' | 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

const REGISTRE = {
  members: [
    {
      id: 'm-proprio',
      role: 'owner',
      userId: 'u-proprio',
      tenantId: null,
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-08-17T09:00:00.000Z',
    },
    {
      id: 'm-relie',
      role: 'tenant',
      userId: 'u-charles',
      tenantId: 'loc-charles',
      fullName: 'Eloundou Charles',
      email: 'charles@example.cm',
      since: '2026-08-18T09:00:00.000Z',
    },
    {
      id: 'm-orphelin',
      role: 'tenant',
      userId: 'u-landry',
      tenantId: null,
      fullName: 'Bekono Landry',
      email: 'landry@example.cm',
      since: '2026-08-18T09:30:00.000Z',
    },
  ],
  invitations: [],
  unlinkedTenants: [{ id: 'loc-landry', fullName: 'Bekono Landry', unitLabel: 'A1' }],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  /* Le portefeuille aussi : sans lui, `CadreDuParc` rend l'écran d'échec du
     parc à la place de TOUT écran, et les cas ci-dessous mesureraient cela. */
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
      leaseCharges: [],
    },
  })
})

async function ouvrirLeRegistre(role: 'owner' | 'manager' | 'tenant' = 'owner') {
  const utilisateur = userEvent.setup()
  await renderApp('/app/acces', { session: session(role) })
  await attendreLeChargement()
  /* Le registre a son PROPRE chargement, distinct de celui du parc : attendre
     le second laisserait les cas asserter sur un squelette. */
  await screen.findByText('Bekono Landry')
  return utilisateur
}

const rangee = (nom: RegExp) =>
  screen.getByRole('row', { name: nom }) as HTMLElement

describe('un membre locataire sans fiche', () => {
  it('porte le geste qui le répare', async () => {
    await ouvrirLeRegistre()
    expect(
      within(rangee(/Bekono Landry/)).getByRole('button', { name: /relier/i }),
      'rien ne permet de réparer un accès orphelin, que l’écran est pourtant seul à voir',
    ).toBeInTheDocument()
  })

  it('et le membre DÉJÀ relié ne le porte pas', async () => {
    /* Sans ce cas, le geste s'afficherait sur toutes les rangées et proposerait
       de réécrire un lien existant — ce que le serveur refuse, mais qu'un écran
       ne doit pas offrir. */
    await ouvrirLeRegistre()
    expect(
      within(rangee(/Eloundou Charles/)).queryByRole('button', { name: /relier/i }),
    ).toBeNull()
  })

  it('ni le PROPRIÉTAIRE, qui n’a pas de bail', async () => {
    await ouvrirLeRegistre()
    expect(within(rangee(/Compte de test|Sarah/)).queryByRole('button', { name: /relier/i })).toBeNull()
  })
})

describe('le rattachement lui-même', () => {
  it('propose les fiches libres AVEC leur logement, et envoie le choix', async () => {
    /* Le logement est indispensable au choix : deux locataires peuvent porter
       le même nom, jamais le même bail actif. */
    const utilisateur = await ouvrirLeRegistre()
    await utilisateur.click(within(rangee(/Bekono Landry/)).getByRole('button', { name: /relier/i }))

    const modale = within(await screen.findByRole('dialog'))
    const choix = modale.getByRole('combobox')
    expect(
      within(choix).getByRole('option', { name: /Bekono Landry/ }).textContent,
      'la fiche proposée ne dit pas de quel logement il s’agit',
    ).toMatch(/A1/)

    serveur.quand('POST', `/parks/${PARC}/tenants/loc-landry/compte`, { status: 204 })
    await utilisateur.click(modale.getByRole('button', { name: /relier/i }))

    await waitFor(() => {
      const appel = serveur.appels.find(
        (a) => a.methode === 'POST' && a.chemin === `/parks/${PARC}/tenants/loc-landry/compte`,
      )
      expect(appel, 'le rattachement n’est jamais parti').toBeDefined()
      expect((appel!.corps as { userId?: unknown }).userId).toBe('u-landry')
    })
  })
})

describe('le locataire', () => {
  it('n’atteint pas cet écran, et donc pas ce geste', async () => {
    /* Le garde de route existait déjà ; ce cas empêche qu'un lot suivant ouvre
       la porte en croyant n'ajouter qu'un bouton. Se relier soi-même à la fiche
       de son choix est l'escalade que ce lot ne doit pas créer. */
    await renderApp('/app/acces', { session: session('tenant') })
    expect(screen.queryByRole('button', { name: /relier/i })).toBeNull()
  })
})
