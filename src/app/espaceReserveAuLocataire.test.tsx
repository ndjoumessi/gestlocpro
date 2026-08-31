import { describe, expect, it } from 'vitest'
import { renderApp, screen, within, SESSION_ANONYME } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * « MON ESPACE » APPARTIENT AU LOCATAIRE, ET À LUI SEUL.
 *
 * ═══ LA SEULE ROUTE DE RÔLE SANS GARDE ═══
 *
 * `EspaceApplicatif` protège douze adresses par `Restricted allow={…}` — le
 * parc, les paiements, les cautions, le registre des accès. `mon-espace`,
 * `documents` et `signaler` n'en portaient AUCUN. Un propriétaire connecté qui
 * ouvrait `/app/mon-espace` obtenait « Mon espace locataire », sa barre latérale
 * complète autour, et l'écran lui expliquait qu'aucun bail ne porte son nom.
 *
 * Signalé sur la production, avec la capture : « je me suis log in comme
 * propriétaire, je vois une référence au locataire ».
 *
 * ═══ 404 ET NON « ACCÈS REFUSÉ » ═══
 *
 * `TenantRestricted` est le refus servi au LOCATAIRE qui tente un écran de
 * gestion, et il finit par un bouton « revenir à mon espace ». Le rendre ici
 * enverrait un propriétaire vers un espace locataire qu'il n'a pas.
 *
 * Le fichier a déjà tranché ce cas pour les écrans de vitrine : « sous un vrai
 * compte, ces adresses n'existent pas, et c'est ce qu'un 404 dit. Rediriger
 * ferait passer une page absente pour une page déplacée. » La même phrase vaut
 * ici, dans l'autre sens.
 */
const PARC = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'

function session(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

function installer() {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
  return faux
}

describe('les trois écrans du locataire', () => {
  it.each(['mon-espace', 'documents', 'signaler'])(
    'n’existent pas pour le PROPRIÉTAIRE : /app/%s',
    async (adresse) => {
      installer()
      await renderApp(`/app/${adresse}`, { session: session('owner') })
      expect(
        screen.queryByRole('heading', { name: /mon espace locataire|mes documents|signaler/i }),
        'le propriétaire atteint un écran de locataire',
      ).toBeNull()
    },
  )

  /**
   * « INTROUVABLE » ÉTAIT FAUX, ET SE LISAIT COMME UNE PANNE.
   *
   * L'adresse EXISTE. Elle n'est simplement pas la sienne. Lui rendre « Écran
   * introuvable · Adresse demandée /app/mon-espace » lui apprend qu'un écran du
   * produit a disparu — ce qui est le message d'un défaut, pas d'un droit.
   *
   * Capturé sur la production, et par le geste le plus ordinaire qui soit :
   * changer de compte dans le même onglet. Le locataire se déconnecte depuis
   * son espace, le propriétaire se connecte, l'adresse est restée. Le renvoi de
   * la CONNEXION est déjà corrigé — voir `adressesParRole` — mais il ne couvre
   * pas l'onglet resté ouvert, ni le signet, ni le retour arrière.
   *
   * `TenantRestricted` ne convient pas davantage : c'est le refus servi au
   * LOCATAIRE qui tente un écran de gestion, et il finit par « revenir à mon
   * espace ». Le rendre ici enverrait un propriétaire vers un espace qu'il n'a
   * pas. Il fallait donc le troisième écran, celui qui dit la vérité : cette
   * adresse appartient à l'autre.
   */
  it('dit au propriétaire que l’écran n’est pas le sien, sans crier à la panne', async () => {
    installer()
    await renderApp('/app/mon-espace', { session: session('owner') })

    expect(
      screen.queryByRole('heading', { name: /introuvable/i }),
      'l’adresse existe : la dire introuvable annonce un défaut du produit',
    ).toBeNull()
    expect(await screen.findByRole('heading', { name: /celui du locataire/i })).toBeInTheDocument()
    /* Et une sortie qui lui convient : son tableau de bord, jamais « mon
       espace », qu'il n'a pas. Bornée à `main` — la barre latérale porte la
       même destination, et la trouver ne dirait rien de cet écran. */
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /tableau de bord/i }),
    ).toHaveAttribute('href', '/app')
  })

  it('n’existent pas non plus pour le GESTIONNAIRE', async () => {
    /* Le gestionnaire opère le parc pour le compte du propriétaire : il n'a pas
       plus de bail que lui. Le distinguer ici n'aurait aucun fondement. */
    installer()
    await renderApp('/app/mon-espace', { session: session('manager') })
    expect(screen.queryByRole('heading', { name: /mon espace locataire/i })).toBeNull()
  })

  it('restent ouverts au LOCATAIRE, sans quoi ce lot fermerait le produit', async () => {
    /* Le cas positif, et il n'est pas décoratif : un garde trop large ferait
       disparaître l'espace de ceux à qui il appartient, et les trois cas
       ci-dessus resteraient verts. */
    installer()
    await renderApp('/app/mon-espace', { session: session('tenant') })
    /* `getByRole` et non `findByRole` : `renderApp` attend déjà la résolution
       de la frontière paresseuse, donc le titre est là quand elle rend la main.
       L'attente asynchrone, elle, rejetait en 28 ms après les cas précédents —
       une horloge laissée en place par l'un d'eux — et faisait passer un écran
       PRÉSENT pour un écran refusé. */
    expect(
      screen.getByRole('heading', { name: /mon espace locataire/i }),
    ).toBeInTheDocument()
  })
})

describe('la démonstration', () => {
  it('garde son espace locataire, que le sélecteur de profil dessert', async () => {
    /* RÉGRESSION PAYÉE DANS CE LOT. Le premier jet gardait les trois adresses
       sans distinction : sous `/demo`, le rôle par défaut est celui du
       propriétaire, et l'espace locataire de la démonstration est devenu
       inatteignable. `mesure-ui` l'a dit par sa garde du garde — deux
       tolérances locales, toutes deux relevées sur `/demo/mon-espace`, ne
       couvraient plus aucun débordement. Un écran qu'on ferme emporte avec lui
       les tolérances qui le décrivaient. */
    await renderApp('/demo/mon-espace')
    expect(
      screen.getByRole('heading', { name: /mon espace locataire/i }),
      'la démonstration a perdu l’espace du locataire',
    ).toBeInTheDocument()
  })
})

describe('un visiteur non connecté', () => {
  it('est renvoyé à la connexion, comme partout sous /app', async () => {
    await renderApp('/app/mon-espace', { session: SESSION_ANONYME })
    expect(screen.queryByRole('heading', { name: /mon espace locataire/i })).toBeNull()
  })
})
