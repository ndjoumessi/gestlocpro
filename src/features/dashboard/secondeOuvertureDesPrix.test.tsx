import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import { TariffsModal } from './TariffsModal'

/**
 * LA MODALE DES PRIX S'OUVRE DEUX FOIS, ET LA SECONDE VAUT LA PREMIÈRE.
 *
 * ═══ CE QUE LE MONTAGE CONDITIONNEL FAISAIT À SA PLACE ═══
 *
 * `Meters.tsx` écrivait `{tarifsOuverts && <TariffsModal open …>}` : fermer
 * DÉMONTAIT le composant, et chaque `useState` repartait de sa valeur initiale
 * sans que personne ne l'ait demandé. Il n'y avait aucun défaut à l'écran — le
 * montage faisait en silence le travail que la modale ne faisait pas, et ce `&&`
 * est exactement ce que la sortie en animation demande de retirer.
 *
 * SEPT ÉTATS SURVIVENT alors à une fermeture, et la modale n'a aucune fonction
 * de remise à zéro : `onClose` part tel quel. Rouvrir en pleine correction
 * montrerait un formulaire prérempli, l'énergie FIGÉE, le pied disant
 * « Corriger ce prix », et le bouton secondaire ne fermant plus rien — il
 * quitte la correction. Un retrait armé rouvrirait droit sur sa confirmation.
 *
 * ═══ POURQUOI CE FICHIER MONTE LA MODALE UNE SEULE FOIS ═══
 *
 * Même angle mort que `secondeOuvertureDeLInvitation` a nommé pour l'invitation.
 * Les cas existants de cette modale-ci — `prixEnVigueur`, `clavierDesModales` —
 * l'ouvrent depuis l'écran des relevés, donc sous le montage conditionnel, ou
 * lui passent `open` en dur sans jamais le faire retomber. Aucun ne traverse le
 * seul geste qui compte : `true → false → true` sur un composant qui RESTE
 * monté. Le bouton « Ouvrir » vit donc hors de la modale.
 *
 * ═══ RIEN NE SE REMET À ZÉRO À LA FERMETURE ═══
 *
 * Un seul point d'écriture, à l'OUVERTURE. La modale reste peinte 150 ms pour
 * sortir : vider le formulaire sur le chemin de la fermeture ferait regarder
 * partir autre chose que ce qu'on lisait. C'est la règle qu'`InviteModal` a
 * posée, et ce fichier la reconduit — tous ses constats portent sur la SECONDE
 * ouverture, aucun sur l'instant de la sortie.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [
    { parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF', delegation: 'delegate' },
  ],
}

/** Un parc sans logement : cette modale n'en lit aucun, seule la session compte. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

/**
 * Deux prix déjà posés — un par fluide.
 *
 * Il en faut au moins un : la correction et le retrait se déclenchent depuis une
 * LIGNE de l'historique, et une liste vide rendrait ces deux cas vides eux
 * aussi, donc verts pour rien.
 */
const PRIX = [
  { id: 'eau-2026-08', utility: 'water' as const, unitPriceMinor: 520, effectiveFrom: '2026-08-01' },
  { id: 'elec-2026-08', utility: 'power' as const, unitPriceMinor: 99, effectiveFrom: '2026-08-01' },
]

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', `/parks/${PARC}/tariffs`, { status: 200, body: { tariffs: PRIX } })
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * `open` BASCULE, `TariffsModal` NE SE DÉMONTE PAS.
 *
 * C'est la forme que `Meters.tsx` prend à la fin de ce lot, et la seule sous
 * laquelle la modale doit se remettre à zéro elle-même.
 */
function PrixQuiRestentMontes() {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <button onClick={() => setOuverte(true)}>Ouvrir</button>
      <TariffsModal open={ouverte} onClose={() => setOuverte(false)} />
    </>
  )
}

async function ouvrir(clavier: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await clavier.click(screen.getByRole('button', { name: 'Ouvrir' }))
  const dialogue = await screen.findByRole('dialog')
  /* L'historique arrive par le réseau : l'attendre est ce qui distingue « la
     modale est ouverte » de « la modale est prête ». */
  await waitFor(() => expect(within(dialogue).getAllByRole('listitem').length).toBe(PRIX.length))
  return dialogue
}

function pied(): HTMLElement {
  const p = screen.getByRole('dialog').querySelector('[data-pied-de-modale]')
  if (!p) throw new Error('la modale n’a pas de pied')
  return p as HTMLElement
}

/**
 * LA CROIX DE L'EN-TÊTE, et non le bouton du pied.
 *
 * Les deux portent le même nom accessible, « Fermer » — et pendant une
 * correction le pied n'en a plus : son bouton secondaire devient « Annuler » et
 * quitte la correction au lieu de fermer. La croix est alors la SEULE sortie,
 * ce qui est précisément ce qu'un `enCorrection` fuité impose à quelqu'un qui
 * rouvre.
 */
function croix(): HTMLElement {
  const dialogue = screen.getByRole('dialog')
  const dansLePied = pied()
  const sorties = within(dialogue)
    .getAllByRole('button', { name: 'Fermer' })
    .filter((b) => !dansLePied.contains(b))
  if (sorties.length !== 1) throw new Error(`${sorties.length} croix dans l’en-tête`)
  return sorties[0]
}

async function fermerPar(
  clavier: ReturnType<typeof userEvent.setup>,
  bouton: HTMLElement,
): Promise<void> {
  await clavier.click(bouton)
  /* La modale reste PEINTE le temps de sa sortie : attendre son départ, et non
     le clic, est ce qui distingue « fermée » de « en train de se fermer ». */
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

function champDuPrix(): HTMLElement {
  return within(screen.getByRole('dialog')).getByLabelText(/Prix unitaire/)
}

function champDeLEnergie(): HTMLElement {
  return within(screen.getByRole('dialog')).getByLabelText(/Énergie/)
}

/** La valeur machine du champ de date, telle que le formulaire l'enverrait. */
function dateDEffet(): string {
  const cache = screen.getByRole('dialog').querySelector('input[name="effectiveFrom"]')
  if (!(cache instanceof HTMLInputElement)) throw new Error('le champ de date a disparu')
  return cache.value
}

describe('la seconde ouverture des prix vaut la première', () => {
  it('rouvre sur un champ de prix vide, et non sur celui tapé la fois d’avant', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    await ouvrir(clavier)
    await clavier.type(champDuPrix(), '750')
    expect(champDuPrix()).toHaveValue('750')

    await fermerPar(clavier, within(pied()).getByRole('button', { name: 'Fermer' }))
    await ouvrir(clavier)

    expect(
      champDuPrix(),
      'le prix tapé la fois d’avant est encore là : rien ne remet `prix` à l’ouverture',
    ).toHaveValue('')
  })

  it('rouvre sur l’eau et sans refus, et non sur l’énergie et l’erreur d’avant', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    await ouvrir(clavier)
    await clavier.selectOptions(champDeLEnergie(), 'power')
    /* Un prix illisible : le refus vit SOUS le champ, il ne part pas seul. */
    await clavier.type(champDuPrix(), 'abc')
    await clavier.click(within(pied()).getByRole('button', { name: 'Enregistrer ce prix' }))
    expect(await screen.findByText(/Saisissez un prix entier/)).toBeInTheDocument()

    await fermerPar(clavier, within(pied()).getByRole('button', { name: 'Fermer' }))
    await ouvrir(clavier)

    expect(
      champDeLEnergie(),
      'la modale rouvre sur l’électricité : rien ne remet `utility` à l’ouverture',
    ).toHaveValue('water')
    expect(
      screen.queryByText(/Saisissez un prix entier/),
      'le refus d’hier est encore sous le champ : rien ne remet `erreurPrix`',
    ).not.toBeInTheDocument()
  })

  /**
   * LA CORRECTION EST LE PIRE DES SEPT.
   *
   * Elle ne laisse pas seulement une valeur derrière : elle change ce que la
   * modale EST. Le pied dit « Corriger ce prix » alors qu'on vient de l'ouvrir
   * pour en poser un, l'énergie est figée sans qu'aucun mot ne le justifie, et
   * le bouton secondaire ne ferme plus — il quitte une correction dont personne
   * n'a connaissance. Les trois sont constatés ensemble parce qu'ils sont trois
   * visages du même état fuité.
   */
  it('rouvre sur « poser un prix », et non sur la correction commencée la fois d’avant', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    const dialogue = await ouvrir(clavier)
    await clavier.click(within(dialogue).getAllByRole('button', { name: /^Corriger le prix/ })[0])

    /* La correction est bien engagée — sans ce constat, la suite ne mesurerait
       que l'absence d'un état qu'on n'a jamais posé. */
    expect(within(pied()).getByRole('button', { name: 'Corriger ce prix' })).toBeInTheDocument()
    expect(champDeLEnergie()).toBeDisabled()
    expect(champDuPrix()).not.toHaveValue('')

    await fermerPar(clavier, croix())
    await ouvrir(clavier)

    expect(
      within(pied()).queryByRole('button', { name: 'Corriger ce prix' }),
      'le pied propose encore de corriger : rien ne remet `enCorrection` à l’ouverture',
    ).not.toBeInTheDocument()
    expect(within(pied()).getByRole('button', { name: 'Enregistrer ce prix' })).toBeInTheDocument()
    expect(
      champDeLEnergie(),
      'l’énergie reste figée : la modale se croit encore en correction',
    ).not.toBeDisabled()
    expect(champDuPrix(), 'le prix de la ligne corrigée est encore là').toHaveValue('')
  })

  it('rouvre sans confirmation de retrait armée', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    const dialogue = await ouvrir(clavier)
    await clavier.click(within(dialogue).getAllByRole('button', { name: /^Retirer le prix/ })[0])
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmer le retrait' }),
    ).toBeInTheDocument()

    await fermerPar(clavier, within(pied()).getByRole('button', { name: 'Fermer' }))
    await ouvrir(clavier)

    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Confirmer le retrait' }),
      'la modale rouvre droit sur une confirmation de retrait : rien ne remet `aRetirer`',
    ).not.toBeInTheDocument()
  })

  /**
   * LA DATE SE RECALCULE, ELLE NE SE RESTAURE PAS.
   *
   * `effet` naît d'un initialiseur paresseux — le PREMIER DU MOIS COURANT — et
   * une remise à zéro qui rejouerait une valeur capturée au montage tiendrait
   * tous les autres cas de ce fichier tout en restant fausse ici. Une modale
   * montée avec la page le 31 août et rouverte le 1er septembre doit proposer
   * septembre : la refacturation est mensuelle, et le mois d'avant est
   * exactement la date qu'on ne veut pas.
   *
   * Seule `Date` est simulée. Les minuteries restent réelles — la sortie de la
   * modale en tient une de 150 ms, et la figer ferait attendre un départ qui
   * n'arriverait jamais.
   */
  it('recalcule la date d’effet, et ne rejoue pas celle du montage', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T09:00:00.000Z'))

    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    await ouvrir(clavier)
    expect(dateDEffet()).toBe('2026-08-01')

    await fermerPar(clavier, within(pied()).getByRole('button', { name: 'Fermer' }))
    vi.setSystemTime(new Date('2026-09-01T09:00:00.000Z'))
    await ouvrir(clavier)

    expect(
      dateDEffet(),
      'la modale propose encore le mois d’avant : `effet` a été figé au montage',
    ).toBe('2026-09-01')
  })

  /**
   * L'ENVOI EN COURS NE SE RAPPORTE PLUS AU FORMULAIRE QU'ON VOIT.
   *
   * Fermer pendant l'appel laisse `envoi` à vrai : la modale rouvre sur un pied
   * qui se dit occupé — bouton désactivé, `aria-busy` — pour une requête qui ne
   * concerne plus rien de ce qui est à l'écran. L'état se répare tout seul quand
   * la réponse arrive, mais il n'y a aucune raison qu'une ouverture neuve hérite
   * de l'attente de la précédente.
   */
  it('rouvre sur un pied disponible, et non sur l’envoi resté en vol', async () => {
    const liberer = serveur.retenir('POST', `/parks/${PARC}/tariffs`, {
      status: 201,
      body: {
        tariff: { id: 'eau-2026-09', utility: 'water', unitPriceMinor: 600, effectiveFrom: '2026-09-01' },
      },
    })
    const clavier = userEvent.setup()
    renderWithProviders(<PrixQuiRestentMontes />, { session: SESSION })

    await ouvrir(clavier)
    await clavier.type(champDuPrix(), '600')
    await clavier.click(within(pied()).getByRole('button', { name: 'Enregistrer ce prix' }))
    await waitFor(() =>
      expect(within(pied()).getByRole('button', { name: 'Enregistrer ce prix' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    )

    await fermerPar(clavier, within(pied()).getByRole('button', { name: 'Fermer' }))
    await ouvrir(clavier)

    expect(
      within(pied()).getByRole('button', { name: 'Enregistrer ce prix' }),
      'le pied rouvre occupé : rien ne remet `envoi` à l’ouverture',
    ).not.toHaveAttribute('aria-busy')

    /* La requête retenue est relâchée AVANT la fin du cas : une promesse encore
       en vol reposerait un état après le démontage du harnais. */
    liberer()
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(PRIX.length + 1))
  })
})
