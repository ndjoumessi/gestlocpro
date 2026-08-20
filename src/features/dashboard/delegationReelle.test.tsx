import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LA DÉLÉGATION CESSE D'ÊTRE UN DÉCOR.
 *
 * L'écran d'onboarding présentait deux modes en boutons radio — « je délègue » /
 * « je gère seul » — reliés à un `useState` initialisé à `delegate`. La colonne
 * `Park.delegation` existait pourtant depuis l'origine du schéma, et son
 * commentaire affirmait que « le serveur s'en sert pour autoriser ».
 *
 * Le propriétaire choisissait donc une politique qui gouverne deux droits réels,
 * elle vivait le temps du rendu, et il pouvait recruter un gestionnaire dans la
 * minute après avoir répondu qu'il gérait seul.
 */

const PARC = '12121212-3434-4565-8787-989898989898'

function session(role: Role, delegation?: 'solo' | 'delegate'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [
      {
        parkId: PARC,
        role,
        parkName: 'Parc de test',
        currency: 'XAF',
        ...(delegation ? { delegation } : {}),
      },
    ],
  }
}

function installer(): FauxServeur {
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

describe('le mode de délégation vient du parc', () => {
  it('affiche celui du parc, et non un défaut d’écran', async () => {
    installer()
    renderApp('/app/prise-en-main', { session: session('owner', 'solo') })

    // Le bouton radio « je gère seul » est celui qui porte la valeur du parc.
    // Sans le branchement, l'écran montrait « je délègue » quoi qu'il arrive.
    const seul = await screen.findByRole('radio', { name: /Vous gérez seul/i })
    await waitFor(() => expect(seul).toBeChecked())
  })

  it('écrit le choix au serveur, puis relit la session', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}`, {
      status: 200,
      body: { park: { id: PARC, name: 'Parc de test', delegation: 'solo' } },
    })
    renderApp('/app/prise-en-main', { session: session('owner', 'delegate') })

    const seul = await screen.findByRole('radio', { name: /Vous gérez seul/i })
    await userEvent.setup().click(seul)

    await waitFor(() => {
      const appel = faux.appels.find((a) => a.methode === 'PATCH' && a.chemin === `/parks/${PARC}`)
      expect(appel?.corps).toEqual({ delegation: 'solo' })
    })
    /*
      RELUE et non retouchée en mémoire : c'est le serveur qui refuse `solo`
      quand un gestionnaire est en place, et poser la valeur d'abord afficherait
      une politique que le parc n'a pas.
    */
    await waitFor(() => expect(faux.appels.some((a) => a.chemin === '/auth/me')).toBe(true))
  })

  it('dit pourquoi la gestion seule a été refusée', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}`, { status: 409, body: { error: 'has_managers' } })
    renderApp('/app/prise-en-main', { session: session('owner', 'delegate') })

    const seul = await screen.findByRole('radio', { name: /Vous gérez seul/i })
    await userEvent.setup().click(seul)

    // « L'action a échoué » laisserait chercher une panne là où il y a une règle,
    // et surtout ne nommerait pas le geste qui débloque — retirer l'accès.
    await screen.findByText(/registre des accès/)
  })

  /**
   * En DÉMONSTRATION, la matrice reste pédagogique : il n'y a pas de parc où
   * écrire, et basculer le mode doit continuer de réécrire les neuf lignes de la
   * colonne « Gestionnaire » sans prétendre enregistrer quoi que ce soit.
   */
  it('reste une démonstration en démonstration', async () => {
    const faux = installerFauxServeur()
    renderApp('/demo/prise-en-main')
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('radio', { name: /Vous gérez seul/i }))

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Vous gérez seul/i })).toBeChecked(),
    )
    expect(faux.appels.some((a) => a.methode === 'PATCH' && a.chemin.startsWith('/parks/'))).toBe(false)
  })
})

describe('recruter dans un parc qui se gère seul', () => {
  it('ne propose plus le code gestionnaire, et dit ce qui le rendrait possible', async () => {
    installer()
    renderApp('/app/locataires', { session: session('owner', 'solo') })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /Inviter/ }))

    await screen.findByText(/gestion seule/)
    // Le champ du rôle disparaît : le serveur rend 409 `delegation_off`, et un
    // menu qui ne mène qu'à un refus se lit comme une panne.
    expect(screen.queryByRole('combobox', { name: /Rôle/i })).not.toBeInTheDocument()
  })

  it('le propose encore quand le parc délègue', async () => {
    installer()
    renderApp('/app/locataires', { session: session('owner', 'delegate') })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /Inviter/ }))

    // La moitié sans laquelle tout masquer satisferait le cas précédent.
    expect(await screen.findByRole('combobox', { name: /Rôle/i })).toBeInTheDocument()
  })
})
