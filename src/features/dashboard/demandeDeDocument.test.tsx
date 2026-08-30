import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La demande de pièce administrative, des deux côtés.
 *
 * Elle n'avait pas d'objet : l'écran « Documents » l'envoyait par `addWork`, le
 * canal des signalements — le seul que le gestionnaire relève réellement. Elle
 * lui parvenait donc, ce qui valait mieux qu'un toast sans envoi, mais sous la
 * forme d'une INTERVENTION. « Attestation de résidence » s'affichait dans
 * « Travaux dans mon logement » entre une fuite d'évier et un volet cassé, avec
 * un métier, une urgence, une référence de chantier et un cycle devis →
 * validation → clôture dont rien ne s'applique à une attestation.
 *
 * Le commentaire `DETTE DE MODÈLE` de `TenantDocuments.tsx` l'annonçait ; ces
 * cas gardent qu'elle est soldée.
 */

async function ouvrirEnLocataire(route: string) {
  await renderApp(route)
  await switchRole('tenant')
  await attendreLeChargement()
}

/** La liste de suivi du locataire, nommée pour être atteignable comme il l'atteint. */
const suivi = () => screen.getByRole('list', { name: 'Mes demandes' })

/*
  `radio` ET NON `button` : le choix de pièce est EXCLUSIF.

  Il était rendu en trois boutons `aria-pressed`, c'est-à-dire trois
  interrupteurs indépendants — un lecteur d'écran en annonçait trois sans lien,
  quand il doit annoncer « 2 sur 3 ». Le changement de rôle dans ces cas est
  donc le signe que la sémantique a été corrigée, pas une retouche de confort.
*/
describe('le locataire demande une pièce', () => {
  it('affiche l’état de ses demandes, réponse comprise', async () => {
    await ouvrirEnLocataire('/demo/documents')
    const carte = suivi()

    // Deux demandes au jeu de démonstration, dans deux états : c'est la RÉPONSE
    // qui distingue cette entité d'un simple formulaire d'envoi.
    expect(carte).toHaveTextContent('Attestation de bon paiement')
    expect(carte).toHaveTextContent('Demandée')
    expect(carte).toHaveTextContent('Attestation de résidence')
    expect(carte).toHaveTextContent('Fournie')
  })

  /**
   * LE CŒUR DU CORRECTIF.
   *
   * Une demande de pièce ne doit plus atteindre la liste des interventions.
   * Elle y arrivait avec le titre « Demande de document : … », rangée parmi les
   * travaux du logement.
   */
  it('n’envoie plus la demande dans les travaux du logement', async () => {
    const user = userEvent.setup()
    await ouvrirEnLocataire('/demo/documents')

    await user.click(screen.getByRole('radio', { name: 'Duplicata de bail' }))
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }))
    await screen.findByText('Demande envoyée au gestionnaire')

    // Elle se suit ici, dans sa propre liste…
    expect(suivi()).toHaveTextContent('Duplicata de bail')

    // …et nulle part dans « Travaux dans mon logement ».
    await user.click(screen.getByRole('link', { name: 'Mon espace' }))
    await attendreLeChargement()
    expect(screen.getByRole('main')).not.toHaveTextContent(/Demande de document/i)
    expect(screen.getByRole('main')).not.toHaveTextContent('Duplicata de bail')
  })

  /**
   * Le serveur refuse en 409 une pièce déjà demandée et sans réponse — un index
   * unique partiel le garantit. Le bouton doit le dire AVANT le clic : proposer
   * un geste dont on sait qu'il échouera fabrique une erreur au lieu d'offrir
   * un choix.
   */
  it('ne laisse pas redemander une pièce déjà en attente', async () => {
    await ouvrirEnLocataire('/demo/documents')
    // « Attestation de bon paiement » est en attente au jeu de démonstration.
    expect(screen.getByRole('radio', { name: 'Attestation de bon paiement' })).toBeDisabled()
    // Celle qui a reçu sa réponse, elle, se redemande : six mois plus tard,
    // c'est légitime.
    expect(screen.getByRole('radio', { name: 'Attestation de résidence' })).toBeEnabled()
  })
})

describe('le gestionnaire répond aux demandes', () => {
  async function ouvrirLesLocataires() {
    const user = userEvent.setup()
    await renderApp('/demo/locataires')
    await attendreLeChargement()
    return user
  }

  it('les range chez les LOCATAIRES, et non dans les travaux', async () => {
    await ouvrirLesLocataires()
    const carte = screen.getByRole('list', { name: 'Demandes de documents' })
    // Une pièce administrative se rattache à une personne, pas à un logement :
    // la ligne porte le nom du locataire.
    expect(carte).toHaveTextContent('Attestation de bon paiement')
    expect(carte).toHaveTextContent('Charles Ngassa')
  })

  it('retire la ligne dès qu’il a répondu', async () => {
    const user = await ouvrirLesLocataires()
    await user.click(screen.getByRole('button', { name: 'Marquer fournie' }))
    await screen.findByText('Réponse enregistrée · le locataire la voit dans son espace')

    // Traitée, elle quitte la liste de travail : elle reste lisible chez le
    // locataire, qui est celui que la réponse concerne.
    expect(screen.queryByRole('list', { name: 'Demandes de documents' })).toBeNull()
  })

  /**
   * Le REFUS est une réponse, et il n'est pas caché derrière la première.
   *
   * Une pièce qu'on ne peut pas produire — bail non signé, document inexistant
   * — laisserait sinon la demande en attente indéfiniment : le locataire
   * guetterait, et la ligne ne partirait jamais de cet écran.
   */
  it('offre le refus au même rang que la fourniture', async () => {
    const user = await ouvrirLesLocataires()
    const carte = screen.getByRole('list', { name: 'Demandes de documents' })
    expect(within(carte).getByRole('button', { name: 'Ne peut pas être fournie' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Ne peut pas être fournie' }))
    await screen.findByText('Réponse enregistrée · le locataire la voit dans son espace')
    expect(screen.queryByRole('list', { name: 'Demandes de documents' })).toBeNull()
  })

  /**
   * La carte n'existe que s'il y a quelque chose à traiter.
   *
   * Une section « Demandes de documents » vide sur un parc calme occuperait la
   * place d'une commande utile en laissant croire qu'il y a quelque chose à
   * voir — la règle que l'écran « Documents » a déjà payée une fois.
   */
  it('disparaît quand il n’y a plus rien à traiter', async () => {
    const user = await ouvrirLesLocataires()
    await user.click(screen.getByRole('button', { name: 'Marquer fournie' }))
    await screen.findByText('Réponse enregistrée · le locataire la voit dans son espace')
    expect(screen.queryByText('Vos locataires attendent ces pièces.')).toBeNull()
  })
})

/**
 * Le GESTIONNAIRE d'un vrai parc.
 *
 * Le piège est symétrique de celui que `donneesReellesDuLocataire` garde, mais
 * il se referme d'un autre côté : la carte du gestionnaire liste les demandes
 * de TOUT le parc, sans filtre d'unité. Rien n'écarterait donc les deux
 * demandes du jeu de démonstration — un gestionnaire réel lirait « Charles
 * Ngassa · Attestation de bon paiement » au-dessus de son fichier de
 * locataires, et pourrait y répondre.
 *
 * Ce cas est né d'une vérification par mutation : en empêchant le fournisseur
 * d'écrire les demandes du serveur, la suite restait verte. Elle ne l'était
 * que parce que l'écran du locataire filtre sur son unité, et que l'unité de
 * démonstration s'appelle « A1 » quand un vrai parc porte des uuid. Côté
 * gestionnaire, ce filtre n'existe pas.
 */
describe('demandes de documents — le gestionnaire sur un vrai parc', () => {
  const PARC = '11111111-2222-4333-8444-555555555555'

  function sessionProprietaire(): EtatSession {
    return {
      statut: 'connecte',
      compte: COMPTE_FICTIF,
      adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
    }
  }

  it('ne lui sert aucune demande de la démonstration', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
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
                id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                label: 'B7',
                type: 'T2',
                surfaceSqm: 52,
                rentMinor: 90000,
                tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
                status: 'paid',
                leaseId: 'bail-1',
                leaseStartsOn: '2025-03-01T00:00:00.000Z',
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
      },
    })

    await renderApp('/app/locataires', { session: sessionProprietaire() })
    await attendreLeChargement()

    // Aucune demande dans la réponse : pas de carte, et surtout aucune trace du
    // locataire de la démonstration.
    expect(screen.queryByRole('list', { name: 'Demandes de documents' })).toBeNull()
    expect(screen.getByRole('main')).not.toHaveTextContent('Charles Ngassa')
  })

  /**
   * LE CLAVIER ATTEINT LES TROIS PIÈCES, ET IL N'EST PLUS ÉCRIT ICI.
   *
   * ═══ CE QUE CE CAS MESURAIT ═══
   *
   * Le groupe était une rangée de `<button role="radio">` avec un `tabIndex`
   * roulant et une navigation aux flèches écrite dans l'écran. Ce cas mesurait
   * cette navigation, et il avait raison de le faire : le formulaire de
   * signalement porte l'avertissement, payé sur un autre écran — « annoncer une
   * navigation aux flèches sans la câbler est pire qu'une rangée de boutons
   * ordinaires, qui au moins ne promet rien ».
   *
   * ═══ DEUX DÉFAUTS QU'IL NE VOYAIT PAS ═══
   *
   * Il vérifiait ce que la copie faisait, pas ce qu'elle omettait :
   *
   *   · les flèches SÉLECTIONNAIENT une pièce désactivée — `auClavier` ne
   *     consultait jamais `disabled`. Le bouton d'envoi s'activait alors, et
   *     partait chercher le 409 que cet écran s'emploie à éviter avant le clic ;
   *   · le groupe devenait INATTEIGNABLE à la tabulation dès que la PREMIÈRE
   *     pièce était déjà demandée, puisque c'est elle qui portait l'arrêt.
   *
   * Ce cas passait dans les deux situations : il partait de la première entrée
   * ATTEIGNABLE, ce qui contournait précisément le second défaut.
   *
   * ═══ CE QU'IL TIENT MAINTENANT ═══
   *
   * Le groupe passe par `RadioCards`, donc par de vrais `input[type=radio]`. Les
   * flèches, l'arrêt unique de tabulation et le saut des entrées désactivées
   * appartiennent au navigateur — les mesurer reviendrait à tester Chrome, et à
   * le tester dans jsdom, qui n'implémente pas cette part-là.
   *
   * Reste ce qui est à nous, et qui est ce dont le clavier dépend : de vraies
   * entrées, un nom de groupe partagé, et un `disabled` PORTÉ PAR L'ENTRÉE — la
   * seule forme que le navigateur sait sauter.
   */
  it('offre de vraies entrées radio, dont celles qui sont indisponibles', async () => {
    await ouvrirEnLocataire('/demo/documents')

    const groupe = screen.getByRole('group', { name: /demander un document|request a document/i })
    const choix = within(groupe).getAllByRole('radio', { hidden: true })
    expect(choix.length).toBeGreaterThan(1)

    for (const entree of choix) expect(entree.tagName).toBe('INPUT')
    const noms = new Set(choix.map((c) => c.getAttribute('name')))
    expect(noms.size, 'les entrées ne partagent pas un nom de groupe').toBe(1)
  })

})