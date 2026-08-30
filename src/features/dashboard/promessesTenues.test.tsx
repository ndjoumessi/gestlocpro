import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * TROIS PROMESSES QUE LE PRODUIT SE FAIT À LUI-MÊME, ET NE TIENT QU'UNE FOIS SUR
 * DEUX.
 *
 * Chacune de ces trois règles est ÉCRITE quelque part dans le dépôt, appliquée à
 * un écran, et absente de son jumeau. Ce n'est pas une omission de conception :
 * c'est un correctif qui n'a pas traversé.
 *
 * ═══ 1. L'ATTENTE PASSE AVANT LE FORMULAIRE ═══
 *
 * `TenantDocuments` le pose en toutes lettres : « pendant le chargement, le jeu
 * de démonstration fournit toujours une unité, et l'écran montrerait le dossier
 * d'un autre ». L'écran SIGNALER a le même fournisseur, la même unité de
 * démonstration servie pendant l'attente — et son formulaire reste vivant. Il
 * poste sur `mesUnites[0]`, c'est-à-dire, tant que le vrai parc n'est pas
 * arrivé, sur un logement qui n'est pas celui du locataire.
 *
 * Ce n'est pas un défaut d'affichage : c'est une fiche d'intervention ouverte
 * sur le logement de quelqu'un d'autre.
 *
 * ═══ 2. UN SUCCÈS S'ANNONCE APRÈS LA RÉPONSE, PAS AVEC L'APPEL ═══
 *
 * `Signaler` porte le récit du correctif : « la phrase partait avec l'appel et
 * non avec sa réponse : sur un refus, le locataire lisait qu'il avait signalé sa
 * fuite PUIS que rien n'avait été enregistré ». La demande de pièce, elle, part
 * toujours en `void` : `notify('Demande envoyée')` s'exécute avant que le
 * serveur ait dit quoi que ce soit, et un refus laisse à l'écran deux messages
 * qui se contredisent.
 *
 * ═══ 3. UN CODE ACCEPTÉ À L'INSCRIPTION EST ACCEPTÉ À LA PRISE EN MAIN ═══
 *
 * `formatInviteCode` regroupe la saisie au fil de la frappe — `loc4a7b92cd`
 * devient `LOC-4A7B-92CD` — et l'inscription l'emploie. La prise en main, non :
 * elle envoie la frappe brute. Le serveur, lui, normalise par
 * `trim().toUpperCase().replace(/\s+/g, '')` et NE RÉTABLIT PAS les tirets.
 *
 * Conséquence vérifiable : le même code, tapé de la même façon, ouvre un compte
 * et se fait refuser une adhésion. L'utilisateur en conclut que son code est
 * mauvais.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function sessionLocataire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un compte sans aucun parc : le seul état où l'on rejoint par un code. */
function sessionSansParc(): EtatSession {
  return { statut: 'connecte', compte: COMPTE_FICTIF, adhesions: [] }
}

const PORTEFEUILLE = {
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
          tenant: { id: COMPTE_FICTIF.id, fullName: COMPTE_FICTIF.fullName, phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2026-06-01T00:00:00.000Z',
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
}

function serveur(): FauxServeur {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  return faux
}

describe('les promesses que le produit se fait', () => {
  it('ne laisse pas signaler tant que le vrai parc n’est pas arrivé', async () => {
    /*
      LA RÉPONSE EST RETENUE, ET C'EST LA SEULE FAÇON D'OBSERVER L'ATTENTE.

      `renderApp` attend la frontière paresseuse de `/app`, c'est-à-dire
      l'instant où l'écran se monte et lance son `fetch`. Sur un faux serveur
      qui répond en une microtâche, le parc est déjà arrivé quand le cas
      interroge le DOM : la fenêtre du défaut existe, mais elle est refermée.
      `retenir` la tient ouverte — c'est le procédé que le harnais a écrit
      exprès, plutôt qu'un délai qui déplacerait le pari sans le supprimer.
    */
    const faux = installerFauxServeur()
    const relacher = faux.retenir('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: PORTEFEUILLE,
    })
    await renderApp('/app/signaler', { session: sessionLocataire() })

    /*
      On interroge le GESTE et non la mise en page : peu importe que l'écran
      montre un squelette, une attente ou rien — ce qui compte est qu'on ne
      puisse pas écrire tant que le parc servi est celui de la démonstration.
    */
    const envoyer = screen.queryAllByRole('button', { name: /envoyer le signalement|send report/i })
    expect(
      envoyer.filter((b) => !(b as HTMLButtonElement).disabled),
      'le formulaire accepte un signalement sur une unité de démonstration',
    ).toHaveLength(0)
    relacher()
  })

  it('n’annonce la demande de pièce qu’une fois le serveur d’accord', async () => {
    const faux = serveur()
    faux.quand('POST', `/parks/${PARC}/units/${UNITE}/document-requests`, {
      status: 409,
      body: { error: 'already_pending' },
    })
    await renderApp('/app/documents', { session: sessionLocataire() })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('radio')[0]!)
    await user.click(screen.getByRole('button', { name: /envoyer la demande|send request/i }))

    /* Le serveur a refusé. « Demande envoyée » serait un mensonge, et il
       cohabiterait avec le message d'échec que le fournisseur émet déjà. */
    expect(
      screen.queryByText(/demande envoyée|request sent/i),
      'un succès annoncé sur un refus',
    ).toBeNull()
  })

  it('envoie le code d’invitation dans la forme que le serveur comprend', async () => {
    const faux = serveur()
    faux.quand('POST', '/join', { status: 200, body: { parkId: PARC, role: 'tenant' } })
    await renderApp('/app/prise-en-main', { session: sessionSansParc() })

    const user = userEvent.setup()
    const champ = await screen.findByLabelText(/code d’invitation|invitation code/i)
    // Tapé comme on le lit sur un message : sans tirets, en minuscules.
    await user.type(champ, 'loc4a7b92cd')
    await user.click(screen.getByRole('button', { name: /^rejoindre|^join/i }))

    /*
      LE SERVEUR NE RÉTABLIT PAS LES TIRETS. Il normalise la casse et les
      espaces, rien de plus : `LOC4A7B92CD` ne retrouvera jamais le code stocké.
      C'est donc à l'écran de regrouper, comme l'inscription le fait déjà.
    */
    const envoye = faux.appels.find((a) => a.chemin === '/join')
    expect(envoye?.corps, 'le code part tel qu’il a été tapé').toMatchObject({
      invitationCode: 'LOC-4A7B-92CD',
    })
  })
})
