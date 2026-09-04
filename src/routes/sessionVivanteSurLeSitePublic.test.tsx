import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, SESSION_CONNECTEE, renderApp, screen, waitFor } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE SITE PUBLIC IGNORAIT UNE SESSION VIVANTE, ET LE DISAIT À VOIX HAUTE.
 *
 * ═══ LE PARCOURS, CAPTURÉ EN PRODUCTION ═══
 *
 * Un locataire dans son espace ouvre le menu de son compte et clique « Retour au
 * site ». Il arrive sur la page de vente, où l'en-tête lui propose « Se
 * connecter » et « Essayer gratuitement ». Il clique « Se connecter » : le
 * formulaire de connexion, son adresse pré-remplie, un champ de mot de passe
 * vide. Il en conclut ce que n'importe qui en conclurait — le produit l'a
 * éjecté.
 *
 * ═══ IL NE L'AVAIT PAS ÉTÉ ═══
 *
 * « Retour au site » est un lien vers `/`, et rien d'autre : la déconnexion est
 * une entrée distincte du même menu. Le cookie de session survit intact.
 *
 * Ce qui manquait est ailleurs, et en deux endroits :
 *
 *   `PublicHeader.tsx`   n'appelait JAMAIS `useSession`. Il servait donc les
 *                        deux boutons d'entrée à tout le monde, y compris à
 *                        quelqu'un qui est déjà entré.
 *   `Login.tsx`          importait `useSession` mais n'en tirait que
 *                        `connecter` : il ne regardait pas `etat.statut`, et
 *                        rendait son formulaire à une session ouverte.
 *
 * L'adresse pré-remplie vient de l'e-mail mémorisé, pas d'une session — elle
 * rendait le mensonge plus crédible encore.
 *
 * ═══ CE QUE ÇA COÛTE, ET POURQUOI CE N'EST PAS COSMÉTIQUE ═══
 *
 * C'est un écran qui affirme un état que la donnée dément. Le geste qu'il
 * appelle est de retaper un mot de passe — ou d'en demander un nouveau. Sur un
 * produit où le locataire n'ouvre son espace qu'une fois par mois, pour une
 * quittance, c'est le genre de friction dont on ne revient pas.
 *
 * ═══ CE QUE CES CAS NE TIENNENT PAS ═══
 *
 * La GÉOMÉTRIE de l'en-tête une fois le bouton remplacé. « Mon espace » est plus
 * court que « Se connecter » + « Essayer gratuitement » réunis, donc la rangée
 * ne peut que rétrécir — mais c'est un raisonnement, pas une mesure, et seule la
 * porte au navigateur le dirait.
 */

const SANS_DONNEES = { collections: [], buildings: [], deposits: [], works: [], meterReadings: [] }

function serveur() {
  const faux = installerFauxServeur({ authentifie: true })
  faux.quand('GET', '/parks/*/portfolio', { status: 200, body: SANS_DONNEES })
  return faux
}

describe('une session vivante, vue du site public', () => {
  it('mène à l’espace plutôt que de proposer d’entrer', async () => {
    serveur()
    await renderApp('/', { session: SESSION_CONNECTEE })

    const espace = await screen.findByRole('link', { name: /^reprendre mon espace$/i })
    expect(espace).toHaveAttribute('href', '/app')
    expect(
      screen.queryByRole('link', { name: /^se connecter$/i }),
      'on propose d’entrer à quelqu’un qui est déjà entré',
    ).toBeNull()
  })

  it('propose toujours d’entrer à un visiteur anonyme', async () => {
    /* L'AUTRE SENS, et il compte autant : un site de vente qui n'offre plus de
       porte d'entrée ne vend rien. */
    await renderApp('/', { session: SESSION_ANONYME })

    expect(await screen.findByRole('link', { name: /^se connecter$/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^reprendre mon espace$/i })).toBeNull()
  })

  it('ne rend pas le formulaire de connexion à une session ouverte', async () => {
    serveur()
    await renderApp('/connexion', { session: SESSION_CONNECTEE })

    await waitFor(() => {
      expect(
        screen.queryByLabelText(/^Mot de passe/),
        'on redemande son mot de passe à quelqu’un qui est déjà connecté',
      ).toBeNull()
    })
  })

  it('rend le formulaire à un visiteur anonyme', async () => {
    await renderApp('/connexion', { session: SESSION_ANONYME })

    expect(await screen.findByLabelText(/^Mot de passe/)).toBeInTheDocument()
  })
})
