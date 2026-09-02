import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, cliquerAction, renderApp, screen, userEvent } from '@/test/render'
import { captureDownloads } from '@/test/downloads'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE GESTIONNAIRE N'AVAIT AUCUN MENU SUR L'ÉCRAN DU PARC.
 *
 * ═══ CE QUI MANQUAIT, ET POURQUOI CE N'ÉTAIT PAS UN DÉFAUT ═══
 *
 * Le bouton « … » de cet écran ne portait qu'une entrée — « Corriger le parc » —
 * réservée au propriétaire, parce qu'elle règle le pays et la DEVISE, donc
 * l'unité de tous les montants. Un gestionnaire n'étant pas propriétaire, le
 * menu était vide, donc non peint.
 *
 * C'était correct : un « … » vide serait pire. Mais l'écran offrait alors à un
 * rôle entier deux boutons et rien d'autre, là où tous les autres écrans du
 * produit portent un geste périodique derrière ce même bouton — l'export du
 * relevé sur les paiements, l'historique sur les documents, l'annonce sur les
 * locataires.
 *
 * ═══ POURQUOI L'EXPORT, ET POUR LES DEUX RÔLES ═══
 *
 * Le critère écrit dans `Portfolio.tsx` est le geste PÉRIODIQUE contre le geste
 * quotidien : ajouter un logement se fait tous les jours, sortir l'état de son
 * parc se fait une fois par mois. L'export tient ce critère pour tout le monde.
 *
 * ET IL EST DÉJÀ BORNÉ, sans qu'on ait à le borner. `usePortfolio` ne rend au
 * gestionnaire que ce qui lui est confié : le fichier suit donc son périmètre
 * sans une ligne de plus, et un gestionnaire ne peut pas exporter un immeuble
 * qu'on ne lui a pas remis. C'est le cloisonnement du serveur qui fait le
 * travail, pas une garde recopiée ici — une garde recopiée aurait divergé.
 *
 * ═══ CE QUE CETTE GARDE NE DIT PAS ═══
 *
 * Que le cloisonnement fonctionne. Elle sert un portefeuille déjà borné par le
 * faux serveur ; c'est `immeublesConfies` et le serveur qui en jugent.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function session(role: 'owner' | 'manager'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [
      { parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF', countryCode: 'CM' },
    ],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLeParc(role: 'owner' | 'manager') {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      scoped: role === 'manager',
      accessUntil: null,
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'u-1',
              label: 'A1',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: 'Charlie Ngassa',
              status: 'paid',
              leaseId: 'bail-1',
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
      leaseCharges: [],
    },
  })
  await renderApp('/app/parc', { session: session(role) })
  await attendreLeChargement()
}

describe('l’export du parc', () => {
  it('est ATTEIGNABLE par le gestionnaire, qui n’avait aucun menu', async () => {
    await ouvrirLeParc('manager')
    const capture = captureDownloads()
    try {
      await cliquerAction(/exporter le parc/i)
      const fichiers = await capture.settle()
      expect(fichiers, 'le menu n’existait pas pour ce rôle').toHaveLength(1)
    } finally {
      capture.restore()
    }
  })

  it('porte le logement, son immeuble et son occupant', async () => {
    await ouvrirLeParc('manager')
    const capture = captureDownloads()
    try {
      await cliquerAction(/exporter le parc/i)
      const [fichier] = await capture.settle()
      expect(fichier.text).toContain('A1')
      expect(fichier.text).toContain('Résidence Bonamoussadi')
      expect(fichier.text).toContain('Charlie Ngassa')
      /* Le loyer BRUT, sans séparateur de milliers : c'est ce qu'un tableur
         sait additionner. Même règle que l'export des paiements. */
      expect(fichier.text).toContain('90000')
    } finally {
      capture.restore()
    }
  })

  it('laisse au propriétaire SES deux entrées, et ne lui en retire aucune', async () => {
    await ouvrirLeParc('owner')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Autres actions/ }))
    expect(screen.getByRole('menuitem', { name: /Corriger le parc/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Exporter le parc/i })).toBeTruthy()
  })

  it('n’ouvre PAS la correction du parc au gestionnaire', async () => {
    /* Le garde-fou d'origine tient : corriger le parc règle sa devise, donc
       l'unité de tous ses montants. Ce lot ajoute une entrée, il n'en relâche
       aucune. */
    await ouvrirLeParc('manager')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Autres actions/ }))
    expect(screen.queryByRole('menuitem', { name: /Corriger le parc/ })).toBeNull()
  })
})
