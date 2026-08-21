import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, within, attendreLeChargement } from '@/test/render'
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

/** Ouvre « Corriger le parc » depuis l'écran du parc immobilier. */
async function ouvrirLesReglages(delegation: 'solo' | 'delegate') {
  installer()
  await renderApp('/app/parc', { session: session('owner', delegation) })
  await attendreLeChargement()
  const clavier = userEvent.setup()
  await clavier.click(screen.getByRole('button', { name: /Corriger le parc/ }))
  return clavier
}

describe('la délégation se règle avec le reste du parc', () => {
  /**
   * LE RÉGLAGE A DÉMÉNAGÉ, et l'écran qui l'écrivait ne l'écrit plus.
   *
   * Il vivait sur la prise en main, qui est un écran d'EXPLICATION : deux
   * endroits réglaient donc le parc, avec deux contrôles d'apparence identique
   * dont un seul enregistrait. Sans ce cas, on pourrait remettre le sélecteur
   * là-bas sans que rien ne rougisse.
   */
  it('n’est plus un contrôle de la prise en main', async () => {
    installer()
    await renderApp('/app/prise-en-main', { session: session('owner', 'solo') })

    // Ce que l'écran garde : il DIT le mode du parc, et renvoie où il se change.
    await screen.findByRole('link', { name: /Modifier dans les réglages du parc/ })
    expect(screen.queryByRole('radio', { name: /Vous gérez seul/i })).not.toBeInTheDocument()
  })

  /**
   * LA MATRICE SUIT LE PARC, et pas seulement le sélecteur qui a déménagé.
   *
   * Le réglage est parti dans les réglages du parc, et le cas qui gardait sa
   * lecture est parti avec lui. Mais `mode` n'a pas quitté cet écran : il
   * gouverne encore toute la colonne « Gestionnaire » — son en-tête, ses douze
   * cases et la note du bas. Un parc en gestion seule qui afficherait cette
   * colonne ouverte annoncerait des droits à quelqu'un qui n'existe pas, et
   * plus rien ne le disait : le seul cas qui monte encore cet écran ne vérifie
   * qu'une ABSENCE de contrôle, jamais ce que le tableau montre.
   *
   * Mesuré : neutraliser la dérivation de `mode` ne faisait rougir aucun cas.
   */
  it('barre la colonne du gestionnaire quand le parc se gère seul', async () => {
    installer()
    await renderApp('/app/prise-en-main', { session: session('owner', 'solo') })

    /**
     * L'EN-TÊTE de la colonne, et non « quelque part sur la page » : le libellé
     * « non activé » est aussi porté, hors écran, par chacune des douze cases du
     * gestionnaire. Un motif cherché sur la page entière passerait donc au vert
     * sur ces cases seules, sans rien dire de la colonne elle-même.
     */
    const enTete = await screen.findByRole('columnheader', { name: /Gestionnaire/ })
    expect(within(enTete).getByText('non activé')).toBeInTheDocument()

    // Et la note qui remplace douze refus par une phrase. Elle énonce la RÈGLE
    // depuis que le sélecteur a quitté cet écran : elle ne peut plus désigner
    // « ci-dessus » un contrôle qui n'y est pas.
    expect(screen.getByText(/Ces droits n.existent que si le parc/)).toBeInTheDocument()
  })

  /**
   * L'AUTRE MOITIÉ, sans laquelle un écran barrant toujours la colonne
   * satisferait le cas précédent — et retirerait le gestionnaire aux parcs qui
   * en ont un.
   */
  it('la laisse ouverte quand le parc délègue', async () => {
    installer()
    await renderApp('/app/prise-en-main', { session: session('owner', 'delegate') })

    await screen.findByRole('link', { name: /Modifier dans les réglages du parc/ })
    expect(screen.queryByText('non activé')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ces droits n.existent que si le parc/)).not.toBeInTheDocument()
  })

  it('montre celui du parc, et non un défaut d’écran', async () => {
    await ouvrirLesReglages('solo')

    const champ = await screen.findByRole('combobox', { name: /Délégation/i })
    // Sans le branchement, le champ montrerait « Gestion déléguée » quoi qu'il
    // arrive — le défaut du `useState` que ce lot a fini de retirer.
    expect(champ).toHaveValue('solo')
  })

  it('n’envoie que ce qui a changé', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}`, {
      status: 200,
      body: { park: { id: PARC, name: 'Parc de test', delegation: 'solo' } },
    })
    await renderApp('/app/parc', { session: session('owner', 'delegate') })
    await attendreLeChargement()
    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: /Corriger le parc/ }))

    await clavier.selectOptions(
      await screen.findByRole('combobox', { name: /Délégation/i }),
      'solo',
    )
    await clavier.click(screen.getByRole('button', { name: /Enregistrer/ }))

    await waitFor(() => {
      const appel = faux.appels.find((a) => a.methode === 'PATCH' && a.chemin === `/parks/${PARC}`)
      /*
        LA DÉLÉGATION SEULE. Le nom, le pays et la devise n'ont pas bougé :
        les envoyer réécrirait le parc avec ce que l'écran croyait savoir en
        s'ouvrant — c'est la règle que cette modale portait déjà pour trois
        champs, et le quatrième s'y plie.
      */
      expect(appel?.corps).toEqual({ delegation: 'solo' })
    })
    // RELUE et non retouchée en mémoire : le serveur peut refuser.
    await waitFor(() => expect(faux.appels.some((a) => a.chemin === '/auth/me')).toBe(true))
  })

  it('dit pourquoi la gestion seule a été refusée', async () => {
    const faux = installer()
    faux.quand('PATCH', `/parks/${PARC}`, { status: 409, body: { error: 'has_managers' } })
    await renderApp('/app/parc', { session: session('owner', 'delegate') })
    await attendreLeChargement()
    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: /Corriger le parc/ }))

    await clavier.selectOptions(
      await screen.findByRole('combobox', { name: /Délégation/i }),
      'solo',
    )
    await clavier.click(screen.getByRole('button', { name: /Enregistrer/ }))

    // « L'action a échoué » laisserait chercher une panne là où il y a une règle,
    // et surtout ne nommerait pas le geste qui débloque — retirer l'accès.
    await screen.findByText(/registre des accès/)
  })

  /**
   * EN DÉMONSTRATION, la bascule reste — et c'est le seul contexte où elle ne
   * peut pas mentir : il n'y a pas de parc où enregistrer. Elle réécrit les neuf
   * lignes de la colonne « Gestionnaire », ce qui est sa valeur pédagogique.
   */
  it('reste une bascule pédagogique en démonstration', async () => {
    const faux = installerFauxServeur()
    await renderApp('/demo/prise-en-main')
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
    await renderApp('/app/locataires', { session: session('owner', 'solo') })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /Inviter/ }))

    await screen.findByText(/gestion seule/)
    // Le champ du rôle disparaît : le serveur rend 409 `delegation_off`, et un
    // menu qui ne mène qu'à un refus se lit comme une panne.
    expect(screen.queryByRole('combobox', { name: /Rôle/i })).not.toBeInTheDocument()
  })

  it('le propose encore quand le parc délègue', async () => {
    installer()
    await renderApp('/app/locataires', { session: session('owner', 'delegate') })
    await attendreLeChargement()

    await userEvent.setup().click(screen.getByRole('button', { name: /Inviter/ }))

    // La moitié sans laquelle tout masquer satisferait le cas précédent.
    expect(await screen.findByRole('combobox', { name: /Rôle/i })).toBeInTheDocument()
  })
})
