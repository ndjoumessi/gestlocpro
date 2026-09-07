import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { PARK, SESSION_AVEC_PARC, portefeuille } from '@/api/noTechnicalIds.test'

/**
 * « LES LOYERS ONT DÉJÀ ÉTÉ APPELÉS » EST DIT QUAND RIEN N'A ÉTÉ APPELÉ.
 *
 * Trouvé en production le 2026-09-07, et par accident : je cherchais à
 * chronométrer l'appel de loyers sur le parc réel de Nelson. Il a cliqué,
 * l'écran a répondu « Les loyers de ce mois ont déjà été appelés » — et NI le
 * proxy de l'hébergeur NI le journal de l'application n'ont vu passer la
 * moindre requête `POST`. Le message ne venait pas du serveur : il ne venait
 * de nulle part.
 *
 * ═══ TROIS SITUATIONS, UN SEUL ZÉRO ═══
 *
 * `callRent` rend un NOMBRE, et trois chemins y écrivent zéro :
 *
 *   — le serveur répond « rien à appeler » (vrai : déjà fait ce mois) ;
 *   — il n'y a pas de parc, donc AUCUNE requête n'est partie ;
 *   — la requête a ÉCHOUÉ, donc rien n'est écrit.
 *
 * L'écran lit `emises > 0` et raconte les trois comme un succès tranquille.
 *
 * ═══ POURQUOI LE TROISIÈME CAS EST LE PLUS CHER ═══
 *
 * Un bailleur qui perd le réseau au mauvais moment est informé que sa
 * facturation est faite. Il ne recliquera pas. Le mois suivant, ses locataires
 * n'ont pas d'échéance, donc aucun n'est « en retard » — et le produit entier
 * repose sur cette dette-là.
 *
 * C'est le mensonge que ce dépôt traque explicitement ailleurs : la route
 * d'encaissement porte encore son propre constat, « l'écran affichait
 * "Paiement enregistré · quittance envoyée" sans rien écrire nulle part ».
 *
 * ═══ LA FORME DU CORRECTIF EXISTE DÉJÀ DANS LE PRODUIT ═══
 *
 * `serveFormalNotice` rend `'enregistree' | 'demonstration' | 'echec'`, et son
 * appelant écrit déjà la règle : « la phrase suit ce qui a eu lieu ». On ne
 * cherche donc pas une forme, on applique celle qui est là.
 */

describe('l’appel de loyers ne ment pas sur ce qu’il a fait', () => {
  it('ne prétend pas « déjà appelés » en démonstration, où rien n’est appelé', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    const user = userEvent.setup()

    const menu = within(screen.getByRole('main')).getByRole('button', {
      name: /Autres actions|More actions/i,
    })
    await user.click(menu)
    await user.click(await screen.findByText(/Appeler les loyers|Issue rent/i))

    /* Le message doit dire CE QUI N'A PAS EU LIEU, du ton neutre réservé à ce
       qui n'est ni un succès ni un échec — exactement comme la mise en demeure
       le fait déjà en démonstration. */
    expect(
      screen.queryByText(/déjà été appelés|already been issued/i),
      'la démonstration n’a appelé aucun loyer : elle ne peut pas dire qu’ils l’étaient déjà',
    ).toBeNull()
    /* On vise la PHRASE du message, pas le mot « démonstration » : le bandeau
       de l'écran le porte déjà, et une requête trop large trouverait deux
       éléments et ne prouverait rien. */
    expect(
      await screen.findByText(/n’appelle aucun loyer|issues no rent/i),
      'le message doit dire ce qui n’a pas eu lieu',
    ).toBeInTheDocument()
  })
})

describe('l’appel de loyers face à un serveur qui refuse', () => {
  it('ne prétend pas « déjà appelés » quand la requête a échoué', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER. Un bailleur informé que sa facturation est
      faite alors qu'elle a échoué ne recliquera pas — et personne ne sera en
      retard le mois prochain, faute d'échéance à devoir.
    */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/charges`, {
      status: 500,
      body: { error: 'server_error' },
    })

    await renderApp('/app/paiements', { session: SESSION_AVEC_PARC })
    await attendreLeChargement()
    const user = userEvent.setup()

    const menu = within(screen.getByRole('main')).getByRole('button', {
      name: /Autres actions|More actions/i,
    })
    await user.click(menu)
    await user.click(await screen.findByText(/Appeler les loyers|Issue rent/i))

    expect(
      screen.queryByText(/déjà été appelés|already been issued/i),
      'un échec annoncé comme « déjà fait » fait perdre un mois de facturation',
    ).toBeNull()
  })
})
