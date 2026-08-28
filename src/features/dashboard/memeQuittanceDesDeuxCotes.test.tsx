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
  /* LES MÊMES CHIFFRES QUE `DOCUMENT`, à l'unité près. C'est la condition du
     cas de comparaison : deux feuilles composées sur des données différentes
     différeraient pour une raison qui n'est pas celle qu'on mesure. */
  leaseCharges: [
    {
      leaseId: 'bail-1',
      periodStart: '2026-08-01T00:00:00.000Z',
      dueOn: '2026-08-05T00:00:00.000Z',
      rentMinor: 77777,
      waterMinor: 3333,
      powerMinor: 4444,
      paidMinor: 60000,
      payments: [
        {
          amountMinor: 60000,
          method: 'mobile',
          paidOn: '2026-08-03T00:00:00.000Z',
          reference: 'MM-9021',
        },
      ],
    },
  ],
}

function sessionLocataire(): EtatSession {
  return {
    statut: 'connecte',
    compte: { ...COMPTE_FICTIF, id: 'loc-1' },
    adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
  }
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

/** La suite des textes posés par un document, dans l'ordre de la page. */
function textesDe(octets: Uint8Array): string[] {
  const fichier = enLatin1(octets)
  return [...fichier.matchAll(/Td \(([\s\S]*?)\) Tj/g)].map(([, brut]) =>
    brut.replace(/\\([()\\])/g, '$1'),
  )
}

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
   * LES DEUX FEUILLES, CÔTE À CÔTE.
   *
   * Elles partagent une fonction de composition, ce qui devrait les rendre
   * identiques par construction. « Devrait » n'est pas une garde : une
   * divergence introduite dans un SEUL des deux appelants — un intitulé, un
   * statut, un montant pris ailleurs — passerait sans que rien ne bronche, et
   * c'était la réserve écrite au lot précédent.
   *
   * Le cas donne aux deux sources les mêmes chiffres, puis compare la suite des
   * textes posés. Ce qu'il refuse n'est pas que les deux documents disent la
   * même chose — c'est qu'ils la disent DIFFÉREMMENT alors que rien ne les y
   * oblige.
   */
  /*
    DEUX ÉTATS DE LA PÉRIODE, et le second n'est pas décoratif.

    Sans versement du tout, le statut de la pièce n'est ni « payé » ni
    « partiel » : c'est le cas où les deux chemins déduisaient autrefois deux
    mots différents, le gestionnaire n'ayant que le verdict binaire du serveur —
    quittance ou reçu — pour trancher un état qui en compte trois.
  */
  const CAS = [
    { nom: 'partiellement réglée', paidMinor: 60000, versements: true },
    { nom: 'sans aucun versement', paidMinor: 0, versements: false },
  ]

  it.each(CAS)('rend la même feuille des deux côtés, période $nom', async ({ paidMinor, versements }) => {
    const capture = captureDownloads()
    try {
      const versementsDuMois = versements
        ? [
            {
              amountMinor: 60000,
              method: 'mobile',
              paidOn: '2026-08-03T00:00:00.000Z',
              reference: 'MM-9021',
            },
          ]
        : []
      const faux = installerFauxServeur()
      faux.quand('GET', `/parks/${PARC}/portfolio`, {
        status: 200,
        body: {
          ...PORTEFEUILLE,
          leaseCharges: [{ ...PORTEFEUILLE.leaseCharges[0], paidMinor, payments: versementsDuMois }],
        },
      })
      faux.quand('POST', `/parks/${PARC}/receipts`, {
        status: 200,
        body: {
          document: {
            ...DOCUMENT,
            paidMinor,
            balanceMinor: DOCUMENT.dueMinor - paidMinor,
            payments: versementsDuMois.map((v, i) => ({ id: `v-${i}`, ...v })),
          },
        },
      })

      const user = userEvent.setup()

      // Le gestionnaire, depuis le document arrêté par le serveur.
      const bailleur = await renderApp('/app/paiements', { session: sessionBailleur() })
      await attendreLeChargement()
      await user.click(screen.getAllByRole('button', { name: /^Quittance$/ })[0])
      await user.click(await screen.findByRole('button', { name: /^Télécharger$/ }))
      bailleur.unmount()

      // Le locataire, depuis son portefeuille.
      await renderApp('/app/documents', { session: sessionLocataire() })
      await attendreLeChargement()
      await user.click(screen.getAllByRole('button', { name: /^Télécharger$/ })[0])

      const [duBailleur, duLocataire] = await capture.settle()
      expect(textesDe(duLocataire.bytes)).toEqual(textesDe(duBailleur.bytes))
    } finally {
      capture.restore()
    }
  })

  /**
   * LA DEVISE VIENT DU DOCUMENT, PAS DE L'ÉCRAN.
   *
   * Le serveur pose la devise du parc à l'émission, et la modale la respecte
   * depuis toujours : « le même versement imprimé sur deux postes réglés
   * différemment portait deux monnaies — sur le seul papier que le locataire
   * gardera pour prouver qu'il a payé ».
   *
   * Le PDF passe par cette mise en forme-là, et je m'y appuyais sans l'avoir
   * éprouvée : c'était la dernière réserve du lot précédent. Un parc en zone
   * euro est le cas qui la met à nu — l'adhésion annonce XAF, le document dit
   * EUR, et c'est le document qui doit gagner.
   *
   * C'est aussi le seul cas où le symbole `€` est tracé, et donc le seul qui
   * exerce la chasse que le fichier déclare désormais lui-même.
   */
  it('met en forme dans la devise du document, et non celle de l’adhésion', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    faux.quand('POST', `/parks/${PARC}/receipts`, {
      status: 200,
      body: { document: { ...DOCUMENT, currency: 'EUR' } },
    })

    const capture = captureDownloads()
    try {
      await renderApp('/app/paiements', { session: sessionBailleur() })
      await attendreLeChargement()
      const user = userEvent.setup()
      await user.click(screen.getAllByRole('button', { name: /^Quittance$/ })[0])
      await user.click(await screen.findByRole('button', { name: /^Télécharger$/ }))
      const [fichier] = await capture.settle()

      const document = enLatin1(fichier.bytes)
      /*
        LE SYMBOLE EST CELUI DE WINANSI — 0x80, que le latin-1 ne place pas.
        C'est aussi le seul caractère du produit dont la chasse divergeait entre
        la police du système et les métriques historiques ; le fichier la déclare
        désormais lui-même.

        Le montant est passé TEL QUEL, comme partout ailleurs dans le produit :
        `money` met en forme sans convertir. Ce cas mesure la DEVISE, pas la
        conversion des unités mineures — laquelle n'existe nulle part et
        n'appartient pas à ce lot.
      */
      expect(document).toMatch(/77\s?777,00\s?\x80/)
      /* Et surtout PAS la devise de l'adhésion, qui annonce des francs CFA :
         c'est elle qui gagnerait si le document ne portait pas la sienne. */
      expect(document, 'la devise de l’écran a pris le pas sur celle du document').not.toContain(
        'FCFA',
      )
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
