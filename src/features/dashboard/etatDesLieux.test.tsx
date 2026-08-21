import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, within, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Établissement d'un état des lieux, vu de l'écran.
 *
 * L'écran n'a jamais eu de commande, et c'était juste : aucune route
 * n'existait. Le bouton arrive avec la fonction, pas avant.
 *
 * Ce que ces cas surveillent d'abord est la RÈGLE MÉTIER portée par le
 * formulaire : le champ d'imputation n'apparaît que sur une sortie. Le serveur
 * refuse en 422 une réserve d'entrée chiffrée ; offrir le champ puis se faire
 * refuser apprendrait la règle par l'échec.
 */

const dialogue = () => screen.getByRole('dialog')

async function ouvrir() {
  const user = userEvent.setup()
  renderApp('/demo/etats-des-lieux')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: /établir un état des lieux/i }))
  return user
}

describe('état des lieux, formulaire', () => {
  it('n’offre PAS de chiffrer une réserve d’entrée', async () => {
    await ouvrir()

    /**
     * Le document d'entrée relève ce qui est DÉJÀ abîmé, précisément pour que
     * le locataire n'en réponde pas. Un champ de montant y inviterait à lui
     * facturer les dégâts du précédent — l'exact inverse de la protection que
     * ce document offre.
     */
    expect(within(dialogue()).queryByLabelText(/imputation/i)).not.toBeInTheDocument()
  })

  it('l’offre sur une sortie', async () => {
    const user = await ouvrir()
    await user.click(within(dialogue()).getByRole('button', { name: /^Sortie$/ }))

    // Le pendant positif : sans lui, un formulaire qui ne montrerait JAMAIS le
    // champ satisferait le cas précédent.
    expect(within(dialogue()).getByLabelText(/imputation/i)).toBeInTheDocument()
  })

  it('refuse un nombre de pièces nul, et n’enregistre rien', async () => {
    const user = await ouvrir()
    const pieces = within(dialogue()).getByLabelText(/nombre de pièces/i)
    await user.clear(pieces)
    await user.type(pieces, '0')
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('enregistre le constat et l’ajoute à la liste', async () => {
    const user = await ouvrir()
    await user.type(within(dialogue()).getByLabelText(/^pièce$/i), 'Cuisine')
    await user.type(
      within(dialogue()).getByLabelText(/^constat$/i),
      'Rayure profonde sur le plan de travail.',
    )
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    expect(await screen.findByText(/état des lieux enregistré/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * Une réserve COMMENCÉE ne s'évapore pas.
   *
   * Elle était écartée avec les lignes vides — même `continue`, aucun mot — et
   * le toast annonçait « état des lieux enregistré » sur un document qui ne la
   * portait pas. Le propriétaire repartait convaincu d'avoir relevé la rayure ;
   * la retenue sur caution s'arbitrait ensuite sur ce qui restait.
   *
   * Ce que le cas épingle est le COUPLE : rien n'est envoyé, ET quelque chose
   * est dit. Un refus muet aurait remplacé une perte silencieuse par un bouton
   * qui ne répond pas.
   */
  it('refuse une réserve commencée, plutôt que de la jeter', async () => {
    const user = await ouvrir()
    await user.type(within(dialogue()).getByLabelText(/^pièce$/i), 'Cuisine')
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    expect(within(dialogue()).getByRole('alert')).toHaveTextContent(/décrivez le constat/i)
    // Rien n'est parti : la modale tient, et aucun toast n'annonce le contraire.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/état des lieux enregistré/i)).not.toBeInTheDocument()
  })

  /**
   * Trois lignes, trois noms de bouton — et un retrait qui retire.
   *
   * « Retirer cette réserve » se répétait à l'identique sur chaque ligne : la
   * liste des contrôles d'un lecteur d'écran annonçait trois fois la même
   * commande, sans rien pour les distinguer puisque les champs sont vides. Et
   * sur la dernière ligne le bouton ne retirait pas : il la VIDAIT, sous un
   * libellé qui promettait un retrait.
   */
  it('nomme chaque retrait par son rang, et retire pour de bon', async () => {
    const user = await ouvrir()
    await user.click(within(dialogue()).getByRole('button', { name: /ajouter une réserve/i }))

    expect(within(dialogue()).getByRole('button', { name: /retirer la réserve n° 1/i })).toBeInTheDocument()
    expect(within(dialogue()).getByRole('button', { name: /retirer la réserve n° 2/i })).toBeInTheDocument()

    await user.click(within(dialogue()).getByRole('button', { name: /retirer la réserve n° 2/i }))
    expect(within(dialogue()).queryByRole('button', { name: /retirer la réserve n° 2/i })).toBeNull()

    // La DERNIÈRE s'en va aussi : c'est ce que le libellé promet.
    await user.click(within(dialogue()).getByRole('button', { name: /retirer la réserve n° 1/i }))
    expect(within(dialogue()).queryByLabelText(/^pièce$/i)).toBeNull()
  })
})

/**
 * CE QUI PART AU SERVEUR, sur un parc réel.
 *
 * La démonstration n'appelle personne : `addInspection` s'y contente d'ajouter
 * une ligne locale qui ne porte que le COMPTE des réserves. Le logement retenu
 * et la gravité saisie n'y laissent donc aucune trace observable — et c'est
 * précisément là que les deux défauts se logeaient. Il faut un parc servi pour
 * lire le corps de la requête.
 *
 * Deux logements, pas un : sur un parc à une seule unité, le premier en dur et
 * le choix de l'utilisateur donnent la même réponse, et la garde ne garderait
 * rien.
 */
describe('état des lieux — ce qui part au serveur', () => {
  const PARC = '33333333-4444-4555-8666-777777777777'
  const U1 = 'cccccccc-dddd-4eee-8fff-000000000001'
  const U2 = 'cccccccc-dddd-4eee-8fff-000000000002'

  function session(): EtatSession {
    return {
      statut: 'connecte',
      compte: COMPTE_FICTIF,
      adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
    }
  }

  function unite(id: string, label: string) {
    return {
      id,
      label,
      type: 'T2',
      surfaceSqm: 52,
      rentMinor: 90000,
      tenant: { id: `loc-${label}`, fullName: 'Awa Bello', phoneE164: null },
      status: 'paid',
      leaseId: `bail-${label}`,
      leaseStartsOn: '2024-03-01T00:00:00.000Z',
      paidMinor: 90000,
      overdueDays: null,
    }
  }

  async function ouvrirSurLeParc() {
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
            units: [unite(U1, 'B7'), unite(U2, 'B8')],
          },
        ],
        works: [],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
      },
    })
    for (const id of [U1, U2]) {
      faux.quand('POST', `/parks/${PARC}/units/${id}/inspections`, {
        status: 201,
        body: { inspection: { id: 'edl-neuf' } },
      })
    }

    const user = userEvent.setup()
    renderApp('/app/etats-des-lieux', { session: session() })
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /établir un état des lieux/i }))
    return { user, faux }
  }

  /** Le seul envoi d'état des lieux de la suite d'appels, corps compris. */
  const envoi = (faux: { appels: { methode: string; chemin: string; corps: unknown }[] }) =>
    faux.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/inspections'))

  async function saisirUneReserve(user: ReturnType<typeof userEvent.setup>) {
    await user.type(within(dialogue()).getByLabelText(/^pièce$/i), 'Séjour')
    await user.type(within(dialogue()).getByLabelText(/^constat$/i), 'Mur défoncé sur un mètre.')
  }

  /**
   * La gravité était DÉCLARÉE et jamais saisie.
   *
   * Le type la portait, la route l'enregistrait, la colonne de comparaison
   * l'écrivait en toutes lettres — et le formulaire l'envoyait invariablement à
   * « léger ». Le locataire qui conteste une retenue lisait « léger » sous un
   * mur défoncé, sans que personne ait pu dire le contraire.
   */
  it('porte la gravité choisie dans le corps envoyé', async () => {
    const { user, faux } = await ouvrirSurLeParc()
    await saisirUneReserve(user)
    await user.click(within(dialogue()).getByRole('button', { name: /^dégradé$/i }))
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    await waitFor(() => expect(envoi(faux)).toBeDefined())
    const corps = envoi(faux)!.corps as { findings: { severity: string }[] }
    expect(corps.findings).toHaveLength(1)
    expect(corps.findings[0].severity).toBe('major')
  })

  /**
   * Le logement RETENU, et non le premier du parc.
   *
   * L'écran passait `logements[0].id` en dur : le constat établi pour B8
   * s'enregistrait au nom de B7, et le serveur ne pouvait rien y voir puisque
   * B7 lui appartient. C'est l'unité qui décide de QUI répond des réserves.
   */
  it('adresse le constat au logement choisi', async () => {
    const { user, faux } = await ouvrirSurLeParc()
    await user.selectOptions(within(dialogue()).getByRole('combobox', { name: /logement/i }), U2)
    await saisirUneReserve(user)
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    await waitFor(() => expect(envoi(faux)).toBeDefined())
    expect(envoi(faux)!.chemin).toBe(`/parks/${PARC}/units/${U2}/inspections`)
  })
})
