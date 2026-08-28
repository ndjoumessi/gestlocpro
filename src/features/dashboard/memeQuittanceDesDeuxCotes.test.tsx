import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { captureDownloads } from '@/test/downloads'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA MÊME PIÈCE, DES DEUX CÔTÉS.
 *
 * ═══ LA RÉSERVE QUI A FAIT ÉCRIRE CE FICHIER ═══
 *
 * Le produit émet la quittance d'un mois par deux chemins. Le gestionnaire ouvre
 * un document ARRÊTÉ PAR LE SERVEUR — `POST /:parkId/receipts`, dans la devise
 * du parc, sans qu'aucun montant soit recalculé. Le locataire télécharge ce que
 * le client compose depuis son portefeuille.
 *
 * Jusqu'ici, le premier n'avait que `window.print()` : la boîte d'impression du
 * navigateur, ses en-têtes à elle, un nom de fichier qui échappe au produit, et
 * un comportement inégal sur Android — la cible principale. Surtout, la feuille
 * obtenue ne ressemblait pas à celle que le locataire téléchargeait du même
 * mois. Deux pièces pour un seul fait, et c'est le locataire qui les présente.
 *
 * ═══ CE QUE CE CAS TIENT, ET CE QU'IL NE TIENT PAS ═══
 *
 * Il tient que le chemin du gestionnaire produit bien un PDF, qu'il porte les
 * montants DU SERVEUR — et non ceux que le client recalculerait — et qu'il
 * nomme le document comme le serveur l'a tranché.
 *
 * Il ne tient PAS que les deux feuilles soient identiques au pixel : elles
 * partagent une mise en page, pas une source, et leurs montants peuvent
 * légitimement différer le jour où le portefeuille du client n'est plus à jour.
 * C'est précisément pourquoi le document du serveur existe.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function sessionBailleur(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Résidence Essos',
      district: 'Essos',
      units: [
        {
          id: UNITE,
          label: 'B7',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2026-06-01T00:00:00.000Z',
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
}

/**
 * Le document que le serveur arrête.
 *
 * SES MONTANTS SONT VOLONTAIREMENT ÉTRANGERS AU PORTEFEUILLE — 77 777 de loyer
 * là où l'unité en porte 90 000. C'est la seule façon de prouver que la pièce
 * vient bien du serveur : avec les mêmes chiffres des deux côtés, un document
 * recalculé par le client passerait le cas sans qu'on s'en aperçoive.
 */
const DOCUMENT = {
  kind: 'recu',
  periodStart: '2026-08-01',
  tenant: 'Awa Bello',
  unit: 'B7',
  building: 'Résidence Essos',
  district: 'Essos',
  rentMinor: 77777,
  waterMinor: 3333,
  powerMinor: 4444,
  dueMinor: 85554,
  paidMinor: 60000,
  balanceMinor: 25554,
  currency: 'XAF',
  payments: [
    {
      id: 'v-1',
      amountMinor: 60000,
      method: 'mobile',
      paidOn: '2026-08-03T00:00:00.000Z',
      reference: 'MM-9021',
    },
  ],
}

const enLatin1 = (octets: Uint8Array) => Array.from(octets, (o) => String.fromCharCode(o)).join('')

describe('la quittance du gestionnaire', () => {
  it('se télécharge en PDF, avec les montants du serveur', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    faux.quand('POST', `/parks/${PARC}/receipts`, { status: 200, body: { document: DOCUMENT } })

    const capture = captureDownloads()
    try {
      await renderApp('/app/paiements', { session: sessionBailleur() })
      await attendreLeChargement()

      const user = userEvent.setup()
      await user.click(screen.getAllByRole('button', { name: /^Quittance$/ })[0])
      /* Le document arrive du serveur : la modale montre « Chargement… » entre
         l'ouverture et lui, et le bouton reste éteint jusque-là. */
      const telecharger = await screen.findByRole('button', { name: /^Télécharger$/ })
      await user.click(telecharger)
      const [fichier] = await capture.settle()

      expect(fichier.type).toBe('application/pdf')
      const document = enLatin1(fichier.bytes)

      /* LE VERDICT DU SERVEUR, ET NON UN CALCUL DU CLIENT : la période n'est pas
         soldée, il a donc arrêté un REÇU. Un écran qui déciderait de dire
         « quittance » ferait signer une preuve de paiement jamais reçue. */
      expect(document).toContain('(Re\xE7u de paiement)')
      expect(document).not.toContain('(Quittance de loyer)')

      // Les montants du document, étrangers au portefeuille — voir `DOCUMENT`.
      expect(document, 'le loyer ne vient pas du document arrêté').toMatch(/77\s?777/)
      expect(document, 'le reste dû du serveur n’est pas repris').toMatch(/25\s?554/)
      expect(document).toContain('MM-9021')

      // Et la pièce dit ce qu'elle n'est pas, comme celle du locataire.
      expect(document).toContain('sans signature')
      expect(document).toContain('Parc Bonamoussadi')
    } finally {
      capture.restore()
    }
  })

  /**
   * L'IMPRESSION SURVIT À CÔTÉ.
   *
   * Remettre une feuille de papier reste un geste du métier, et une agence sans
   * imprimante n'est pas la règle sur ce marché. Le PDF s'ajoute, il ne
   * remplace pas — et ce cas garde que le remplacement n'a pas eu lieu par
   * inadvertance.
   */
  it('garde l’impression à côté du téléchargement', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    faux.quand('POST', `/parks/${PARC}/receipts`, { status: 200, body: { document: DOCUMENT } })

    await renderApp('/app/paiements', { session: sessionBailleur() })
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^Quittance$/ })[0])

    expect(await screen.findByRole('button', { name: /^Télécharger$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imprimer|Print/i })).toBeInTheDocument()
  })
})
