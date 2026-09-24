import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import {
  ouvrirLaListe,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import { InviteModal } from './InviteModal'

/**
 * LA MODALE D'INVITATION S'OUVRE DEUX FOIS, ET LA SECONDE VAUT LA PREMIÈRE.
 *
 * ═══ CE QUE LE MONTAGE CONDITIONNEL FAISAIT À SA PLACE ═══
 *
 * Les deux appelants écrivaient `{inviteOuverte && <InviteModal open …>}` :
 * fermer DÉMONTAIT le composant. Chaque `useState` repartait donc de sa valeur
 * initiale et chaque effet de montage se rejouait — non parce que la modale
 * savait se remettre à zéro, mais parce qu'il n'en restait rien à remettre.
 *
 * Il n'y avait aucun défaut à l'écran, et c'est précisément ce qui rend celui-ci
 * dangereux : la garde qu'on veut retirer — le `&&` — est la seule chose qui le
 * cachait. Le jour où la modale reste montée pour SORTIR en animation, deux
 * choses fuient d'une ouverture à l'autre :
 *
 *  1. `fermer()` remettait `code`, `envoye` et `envoi`, mais ni `roleInvite` ni
 *     `unitId`. On rouvrait sur « Gestionnaire délégué » choisi la fois d'avant,
 *     et le champ du logement, absent sur ce rôle, ne revenait pas.
 *  2. L'effet du registre était keyé `[parkId, estDemo]` : une seule lecture
 *     pour toute la vie de la page. Un code émis pour A1 laissait A1 dans le
 *     menu à l'ouverture suivante — le 409 que le registre existe pour éviter,
 *     et que l'en-tête d'`InviteModal` cite comme signalé sur la production.
 *
 * ═══ POURQUOI CE FICHIER MONTE LA MODALE UNE SEULE FOIS ═══
 *
 * Même angle mort que `sortieDeModale.test.tsx` a nommé pour le `Modal` : tous
 * les cas existants de l'invitation la montent sous condition ou lui passent
 * `open` en dur sans jamais le faire retomber. Aucun ne traverse le seul geste
 * qui compte ici — `true → false → true` sur un composant qui RESTE monté. Le
 * bouton « Ouvrir » vit donc hors de la modale, et le harnais ne démonte rien.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [
    { parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF', delegation: 'delegate' },
  ],
}

/** A1 loué, B1 loué, B2 vacant — le parc de `codeParLogementUnique`. */
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
          tenant: { id: 'loc-landry', fullName: 'Bekono Landry', phoneE164: null },
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
          tenant: { id: 'loc-martial', fullName: 'Djoumessi Martial', phoneE164: null },
          status: 'pending',
          leaseId: 'bail-b1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 0,
          overdueDays: null,
        },
        {
          id: 'u-b2',
          label: 'B2',
          type: 'T2',
          surfaceSqm: 90,
          rentMinor: 30000,
          tenant: null,
          status: 'vacant',
          leaseId: null,
          leaseStartsOn: null,
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

const MOI = {
  id: 'm-moi',
  role: 'owner',
  fullName: COMPTE_FICTIF.fullName,
  email: COMPTE_FICTIF.email,
  since: '2026-08-17T09:00:00.000Z',
  userId: 'u-proprio',
  tenantId: null,
}

/** Le registre de la PREMIÈRE ouverture : aucun code vivant, tout le parc est offert. */
const REGISTRE_VIERGE = { members: [MOI], invitations: [] }

/**
 * Le registre de la SECONDE : un code attend désormais pour B1.
 *
 * B1 et non A1, à dessein : A1 est le défaut du champ, et le retirer
 * mélangerait deux mesures — « le registre est relu » et « le choix retiré
 * retombe sur aucun ». Ce fichier ne mesure que la première.
 */
const REGISTRE_AVEC_B1 = {
  members: [MOI],
  invitations: [
    {
      id: 'i-b1',
      role: 'tenant',
      codeHint: 'Q55P',
      expiresAt: '2026-09-14T10:00:00.000Z',
      issuedAt: '2026-08-31T10:00:00.000Z',
      unitId: 'u-b1',
      unitLabel: 'B1',
    },
  ],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE_VIERGE })
  serveur.quand('POST', `/parks/${PARC}/invitations`, {
    status: 201,
    body: { code: 'LOC-1234-5678', envoye: false },
  })
})

/**
 * `open` BASCULE, `InviteModal` NE SE DÉMONTE PAS.
 *
 * C'est la forme que les deux appelants prennent à la fin de ce lot, et la
 * seule sous laquelle la modale doit se remettre à zéro elle-même.
 */
function InvitationQuiResteMontee() {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <button onClick={() => setOuverte(true)}>Ouvrir</button>
      <InviteModal open={ouverte} onClose={() => setOuverte(false)} />
    </>
  )
}

/** Lectures du registre reçues par le faux serveur, depuis le début du cas. */
function lecturesDuRegistre(): number {
  return serveur.appels.filter(
    (a) => a.methode === 'GET' && a.chemin === `/parks/${PARC}/access`,
  ).length
}

async function ouvrir(clavier: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await clavier.click(screen.getByRole('button', { name: 'Ouvrir' }))
  return screen.findByRole('dialog')
}

async function fermer(clavier: ReturnType<typeof userEvent.setup>): Promise<void> {
  const dialogue = screen.getByRole('dialog')
  await clavier.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
  /* La modale reste PEINTE le temps de sa sortie : attendre son départ, et non
     le clic, est ce qui distingue « fermée » de « en train de se fermer ». */
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

/** Le champ du logement, une fois le parc arrivé. */
function champDuLogement(): Promise<HTMLElement> {
  return screen.findByRole('combobox', { name: /Logement/ })
}

describe('la seconde ouverture vaut la première', () => {
  it('rouvre sur le rôle initial, et non sur celui choisi la fois d’avant', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<InvitationQuiResteMontee />, { session: SESSION })

    await ouvrir(clavier)
    const role = await screen.findByRole('combobox', { name: /Rôle/ })
    expect(role).toHaveValue('tenant')
    await clavier.selectOptions(role, 'manager')
    expect(role).toHaveValue('manager')

    await fermer(clavier)
    await ouvrir(clavier)

    expect(
      await screen.findByRole('combobox', { name: /Rôle/ }),
      'la modale rouvre sur « Gestionnaire délégué » : `fermer()` ne remet pas `roleInvite`',
    ).toHaveValue('tenant')
    /* La moitié sans laquelle un rôle juste ne prouverait rien : sur
       « manager », le champ du logement DISPARAÎT. Sa présence dit que le
       formulaire entier est revenu, pas seulement une valeur de menu. */
    expect(await champDuLogement()).toBeInTheDocument()
  })

  it('rouvre sur le logement par défaut, et non sur celui choisi la fois d’avant', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<InvitationQuiResteMontee />, { session: SESSION })

    await ouvrir(clavier)
    const champ = await champDuLogement()
    await waitFor(() => expect(champ).toHaveDisplayValue(/^A1/))

    /* B2 est vacant : un choix que rien d'autre ne pourrait produire. */
    const liste = within(await ouvrirLaListe(champ))
    await clavier.click(liste.getByRole('option', { name: /B2/ }))
    expect(champ).toHaveDisplayValue(/^B2/)

    await fermer(clavier)
    await ouvrir(clavier)

    expect(
      await champDuLogement(),
      'la modale rouvre sur B2 : `fermer()` ne remet pas `unitId`',
    ).toHaveDisplayValue(/^A1/)
  })

  it('relit le registre à chaque ouverture', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<InvitationQuiResteMontee />, { session: SESSION })

    await ouvrir(clavier)
    await champDuLogement()
    await waitFor(() => expect(lecturesDuRegistre()).toBe(1))

    await fermer(clavier)
    await ouvrir(clavier)
    await champDuLogement()

    await waitFor(
      () => expect(lecturesDuRegistre()).toBe(2),
      { timeout: 2000 },
    ).catch(() => {
      throw new Error(
        `le registre n'a été lu que ${lecturesDuRegistre()} fois pour deux ouvertures : ` +
          "l'effet est keyé sur le montage, pas sur `open`",
      )
    })
  })

  /**
   * CE QUI S'EN VA RESSEMBLE À CE QU'IL ÉTAIT.
   *
   * `fermer()` remettait `code` à `null` AVANT de rendre la main : la modale
   * partait donc en montrant un formulaire vide à la place du code que la
   * personne était en train de lire, et la substitution se jouait pendant les
   * 150 ms de la sortie. Une sortie anime un DÉPART, pas une transformation.
   *
   * Tant que fermer démontait le composant, cela ne se voyait pas — il n'y avait
   * plus de panneau à repeindre. C'est le passage à `open={…}` qui rend ce
   * défaut visible, et ce cas est ce qui empêche de remettre la remise à zéro
   * sur le chemin de la fermeture.
   *
   * ET LE CODE N'EST PAS N'IMPORTE QUEL ÉTAT : le produit dit lui-même qu'il
   * n'est « plus lisible ensuite, même par vous ». Le montrer une seconde de
   * trop à la sortie est sans conséquence ; le montrer À L'OUVERTURE SUIVANTE
   * serait rendre lisible ce qu'on a promis de ne plus rendre. Les deux moitiés
   * de ce cas tiennent donc les deux bouts.
   */
  it('s’en va en montrant le code, et l’a oublié à l’ouverture suivante', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<InvitationQuiResteMontee />, { session: SESSION })

    const dialogue = await ouvrir(clavier)
    await champDuLogement()
    await clavier.click(within(dialogue).getByRole('button', { name: 'Émettre le code' }))
    expect(await screen.findByText('LOC-1234-5678')).toBeInTheDocument()

    /*
      `fireEvent`, ET NON `userEvent` — la différence est toute la garde.

      `userEvent.click` est asynchrone : entre le clic et le constat, la pile
      rend la main, et les 150 ms de la sortie peuvent s'écouler sur une machine
      chargée. Le panneau serait alors déjà démonté quand le cas vient
      l'examiner, et ce cas rougirait sans qu'il y ait de défaut — c'est le piège
      exact que `sortieDeModale.test.tsx` nomme. `fireEvent` est SYNCHRONE :
      aucune minuterie ne peut se déclencher entre ces deux lignes, il n'y a donc
      pas d'horloge à courir.
    */
    /* Celui du PIED, que le fichier décrit comme « un Fermer explicite » — la
       croix de l'en-tête porte le même nom accessible. */
    const pied = screen.getByRole('dialog').querySelector('[data-pied-de-modale]')
    if (!pied) throw new Error('la modale n’a pas de pied')
    fireEvent.click(within(pied as HTMLElement).getByRole('button', { name: 'Fermer' }))
    expect(
      screen.queryByText('LOC-1234-5678'),
      'la modale s’en va en montrant un formulaire vide à la place du code qu’on lisait',
    ).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await ouvrir(clavier)
    expect(
      screen.queryByText('LOC-1234-5678'),
      'le code d’hier est encore là : il n’est « plus lisible ensuite » que sur le papier',
    ).not.toBeInTheDocument()
    expect(await champDuLogement()).toBeInTheDocument()
  })

  it('cesse d’offrir un logement pris ENTRE les deux ouvertures', async () => {
    const clavier = userEvent.setup()
    renderWithProviders(<InvitationQuiResteMontee />, { session: SESSION })

    await ouvrir(clavier)
    const premier = within(await ouvrirLaListe(await champDuLogement()))
    expect(
      premier.getByRole('option', { name: /B1/ }),
      'B1 manque dès la première ouverture : le cas négatif ne mesurerait rien',
    ).toBeInTheDocument()
    await clavier.keyboard('{Escape}')

    await fermer(clavier)
    /* Quelqu'un d'autre — ou cette modale même, à l'ouverture précédente — a
       émis un code pour B1 pendant que la modale attendait, montée. */
    serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE_AVEC_B1 })

    await ouvrir(clavier)
    const champ = await champDuLogement()
    await waitFor(async () => {
      const liste = within(await ouvrirLaListe(champ))
      expect(
        liste.queryByRole('option', { name: /B1/ }),
        'B1 est encore offert : le registre lu au montage a vieilli, le serveur rendra 409',
      ).not.toBeInTheDocument()
      expect(
        liste.getAllByRole('option').length,
        'la liste est vide : le cas négatif ne mesurerait plus rien',
      ).toBeGreaterThan(1)
    })
  })
})
