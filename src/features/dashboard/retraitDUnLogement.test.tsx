import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE LOGEMENT N'AVAIT AUCUNE ISSUE, ET L'ÉCRAN NE POUVAIT PAS L'INVENTER.
 *
 * ═══ POURQUOI LE DRAPEAU VIENT DU SERVEUR ═══
 *
 * Un logement dont le bail est TERMINÉ rend `vacant` et `tenant: null` — très
 * exactement comme un logement qu'on vient de créer. Les deux sont
 * indiscernables dans cette projection, et l'un s'efface quand l'autre ne le
 * doit pas : le second a des échéances, des versements, peut-être une caution.
 *
 * L'écran ne peut donc PAS déduire le seuil ; il le reçoit. Sans ce drapeau, il
 * offrirait un geste que la route refuse par 409 — « offrir un geste qu'il
 * refusera revient à promettre ce qu'on ne tient pas », la règle que la
 * suppression d'immeuble applique déjà.
 *
 * ═══ L'ABSENCE FERME, ELLE N'OUVRE PAS ═══
 *
 * Le troisième cas est le plus important des trois. Un serveur antérieur au
 * champ ne le rend pas, et la démonstration non plus sur ses douze logements
 * d'origine. `deletable !== true` et non `=== false` : une donnée manquante
 * n'autorise rien. Écrit à l'envers, la première mise en production offrirait le
 * retrait sur tout un parc.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Un parc d'un logement, dont le serveur dit — ou tait — qu'il est retirable. */
function parcAvecUnLogement(deletable?: boolean) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'b-1',
          name: 'Résidence Neuve',
          district: 'Bastos',
          units: [
            {
              id: 'u-1',
              label: 'Z9',
              type: 'apartment',
              surfaceSqm: 30,
              rentMinor: 90000,
              paidMinor: 0,
              status: 'vacant',
              overdueDays: null,
              tenant: null,
              ...(deletable === undefined ? {} : { deletable }),
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
  return serveur
}

async function ouvrir(deletable?: boolean) {
  const serveur = parcAvecUnLogement(deletable)
  await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
  await attendreLeChargement()
  await screen.findByText('Z9')
  return serveur
}

describe('retirer un logement, depuis le parc', () => {
  it('ouvre le geste sur un logement que le serveur déclare retirable', async () => {
    const serveur = await ouvrir(true)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Actions du logement Z9' }))
    const croix = screen.getByRole('menuitem', { name: 'Retirer le logement Z9' })
    expect(croix, 'un geste ouvert ne porte pas d’état fermé').not.toHaveAttribute('aria-disabled')

    await userEvent.setup().click(croix)

    /* LA CONFIRMATION D'ABORD. Un retrait définitif qui part au premier clic
       est le défaut que toutes les autres suppressions de cet écran évitent. */
    const boite = await screen.findByRole('dialog')
    expect(within(boite).getByText(/Retirer Z9/)).toBeInTheDocument()
    /* L'IMMEUBLE DANS LA BOÎTE : « Z9 » ne désigne rien seul, le schéma ne pose
       l'unicité que DANS l'immeuble. C'est la raison qui met aussi son nom dans
       la trace du registre. */
    expect(within(boite).getByText('Résidence Neuve')).toBeInTheDocument()

    await userEvent.setup().click(within(boite).getByRole('button', { name: /Confirmer/i }))

    /* L'APPEL A BIEN EU LIEU, et sur la bonne cible. La ligne ne part qu'APRÈS
       l'accord du serveur : la retirer d'abord montrerait un retrait qui n'a pas
       eu lieu, et c'est la règle que le retrait d'immeuble applique déjà. */
    const retrait = serveur.appels.filter(
      (a) => a.methode === 'DELETE' && a.chemin === `/parks/${PARC}/units/u-1`,
    )
    expect(retrait, 'le retrait doit atteindre le serveur, une fois').toHaveLength(1)
  })

  it('ferme le geste, et dit pourquoi, sur un logement qui a une histoire', async () => {
    await ouvrir(false)

    /* LE MOTIF EST DANS LE NOM ACCESSIBLE, et il commence par l'ÉTAT. Un nom
       fermé qui commencerait par « Retirer le logement… » porterait le même
       préfixe que le geste ouvert : `modales` sélectionne par ce préfixe et
       cliquerait le mauvais bouton — le lot précédent s'est fait prendre là,
       côté immeuble, et la modale en est devenue inatteignable. */
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actions du logement Z9' }))
    expect(screen.queryByRole('menuitem', { name: 'Retirer le logement Z9' })).toBeNull()
    const ferme = screen.getByRole('menuitem', { name: /^Retrait impossible — Z9/ })
    expect(ferme).toHaveAttribute('aria-disabled', 'true')

    // Et il ne promet rien : cliqué, il n'ouvre aucune confirmation.
    await userEvent.setup().click(ferme)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ferme le geste quand le serveur ne dit RIEN', async () => {
    await ouvrir(undefined)

    /*
      LE CAS QUI TIENT LE SENS DU TEST. `deletable !== true` et non
      `=== false` : un serveur antérieur au champ ne le rend pas, et l'absence
      doit fermer. Écrit à l'envers, ce même écran offrirait le retrait sur tout
      un parc dès la première mise en production — sur des logements dont le
      serveur, lui, refuserait chaque appel par un 409.
    */
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actions du logement Z9' }))
    expect(screen.queryByRole('menuitem', { name: 'Retirer le logement Z9' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /^Retrait impossible — Z9/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
