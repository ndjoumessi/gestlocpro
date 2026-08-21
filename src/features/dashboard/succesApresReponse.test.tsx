import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * ON N'ANNONCE PAS UN SUCCÈS QU'ON N'A PAS ENCORE.
 *
 * `addTenant` et `addWork` étaient typés `=> void` : les écrans les appelaient,
 * félicitaient dans le même souffle, et n'avaient aucun moyen de savoir si le
 * serveur avait dit oui. Sur un 409 — l'unité porte déjà un bail en cours, ce que
 * l'index unique partiel de la base tranche seul, et deux onglets ouverts
 * suffisent à l'obtenir — le bailleur lisait « Fiche locataire créée » puis « le
 * serveur a refusé cette action ». Deux phrases contradictoires côte à côte, dont
 * la première était fausse.
 *
 * Le même défaut avait déjà été corrigé sur l'écran voisin — le retrait d'une
 * fiche attend sa réponse depuis plusieurs lots — et rien ne reliait les deux :
 * la signature du fournisseur ne PERMETTAIT pas d'attendre, donc rien ne tombait.
 * C'est cette signature qui change, et ces cas qui la tiennent.
 *
 * La modale reste ouverte sur un refus. C'est le second point : le succès annoncé
 * s'accompagnait d'une fermeture, et la saisie partait avec — nom, téléphone,
 * loyer, caution, tout était à retaper pour un conflit qui n'est pas celui du
 * bailleur.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [
    { parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'CFA', countryCode: 'CM' },
  ],
}

/** Un immeuble, une unité VACANTE : de quoi ouvrir « Créer une fiche locataire ». */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'b-1',
      name: 'Résidence Essoss',
      district: 'Bastos',
      units: [
        {
          id: 'u-a1',
          label: 'A1',
          type: 'apartment',
          surfaceSqm: 45,
          rentMinor: 185000,
          paidMinor: 0,
          status: 'vacant',
          leaseId: null,
          leaseStartsOn: null,
          overdueDays: null,
          tenant: null,
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

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
})

/** Ouvre la modale de création et remplit ce que la validation exige. */
async function remplirLaFiche(user: ReturnType<typeof userEvent.setup>) {
  renderApp('/app/locataires', { session: SESSION })
  await attendreLeChargement()

  await user.click(screen.getByRole('button', { name: 'Créer une fiche locataire' }))
  const modale = screen.getByRole('dialog')
  await user.type(within(modale).getByLabelText(/nom complet/i), 'Serge Mbarga')
  await user.type(within(modale).getByLabelText(/téléphone/i), '677214408')
  return modale
}

describe('création d’une fiche locataire refusée par le serveur', () => {
  it('ne dit pas « créée » quand le serveur a dit non', async () => {
    const user = userEvent.setup()
    serveur.quand('POST', `/parks/${PARC}/tenants`, {
      status: 409,
      body: { error: 'unit_already_leased' },
    })

    const modale = await remplirLaFiche(user)
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(/Le serveur a refusé cette action/)).toBeInTheDocument()
    expect(screen.queryByText('Fiche locataire créée')).not.toBeInTheDocument()
  })

  it('garde la modale ouverte, et la saisie avec elle', async () => {
    const user = userEvent.setup()
    serveur.quand('POST', `/parks/${PARC}/tenants`, {
      status: 409,
      body: { error: 'unit_already_leased' },
    })

    const modale = await remplirLaFiche(user)
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText(/Le serveur a refusé cette action/)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/nom complet/i)).toHaveValue('Serge Mbarga')
  })

  it('félicite, et une seule fois, quand le serveur a dit oui', async () => {
    const user = userEvent.setup()
    serveur.quand('POST', `/parks/${PARC}/tenants`, { status: 201, body: { lease: { id: 'l-1' } } })

    const modale = await remplirLaFiche(user)
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Fiche locataire créée')).toBeInTheDocument()
    // Le message ne promet plus de SMS : la route de création n'émet aucun code
    // d'invitation, et `envoyerSms` rend `false` sans appeler personne.
    expect(screen.queryByText(/SMS/)).not.toBeInTheDocument()
  })
})

/**
 * LA DOUBLE SOUMISSION, que le passage en promesse rend possible.
 *
 * Tant que l'appel n'était pas attendu, la modale se refermait aussitôt et il n'y
 * avait plus de bouton à recliquer. Maintenant qu'elle attend, l'attente est
 * visible — et une attente visible invite à recliquer. Sans l'extinction du
 * bouton, deux fiches partiraient pour la même personne, sur la même unité, et la
 * seconde reviendrait en 409 après que la première a réussi.
 *
 * On retient la réponse à la main plutôt que de courir après un délai : un test
 * qui dépend d'un `setTimeout` dit surtout à quelle vitesse tourne la machine.
 */
describe('double soumission pendant le vol', () => {
  it('n’envoie qu’une seule requête, bouton éteint', async () => {
    const user = userEvent.setup()
    serveur.quand('POST', `/parks/${PARC}/tenants`, { status: 201, body: { lease: { id: 'l-1' } } })

    const brut = globalThis.fetch
    let relacher!: () => void
    const barriere = new Promise<void>((resoudre) => {
      relacher = resoudre
    })
    vi.stubGlobal('fetch', async (entree: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST' && String(entree).endsWith('/tenants')) await barriere
      return brut(entree, init)
    })

    const modale = await remplirLaFiche(user)
    const enregistrer = within(modale).getByRole('button', { name: 'Enregistrer' })
    await user.click(enregistrer)

    expect(enregistrer).toBeDisabled()
    await user.click(enregistrer)

    relacher()
    expect(await screen.findByText('Fiche locataire créée')).toBeInTheDocument()
    expect(serveur.appels.filter((a) => a.methode === 'POST' && a.chemin.endsWith('/tenants'))).toHaveLength(1)
  })
})
