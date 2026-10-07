import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE PARC RÉEL NE DOIT PAS SURVIVRE DANS LA DÉMONSTRATION.
 *
 * `PortfolioProvider` enregistre `units`, `works` et `deposits` dans
 * `localStorage` à chaque changement d'état, sous une clé unique. L'effet a été
 * écrit pour la DÉMONSTRATION — « un rafraîchissement accidentel ne doit pas
 * effacer le parcours en cours » — mais il ne distingue pas la provenance : dès
 * que la réponse du serveur arrive, `setUnits(parc.units)` change la référence
 * et le parc RÉEL part au même endroit.
 *
 * Ce que ces trois collections portent est nominatif : le nom du locataire et
 * son TÉLÉPHONE sur l'unité, le nom de qui a ouvert une intervention sur le
 * travail, le nom du locataire sur la caution.
 *
 * `/demo` relit cette clé au premier rendu — `loadState()` sème l'état initial
 * — et rien ne l'écrase ensuite, puisque la démonstration n'appelle aucun
 * serveur. Quiconque a ouvert son espace puis visité la démonstration y voit
 * donc les personnes de son propre parc, sur une adresse publique dont la
 * raison d'être est précisément de ne montrer personne.
 */

const PARC = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'

/**
 * Ce qu'un parc réel porte de nominatif, et que la démonstration ne doit jamais
 * rendre.
 *
 * LES TROIS COLLECTIONS SONT PEUPLÉES, et ce n'est pas de la décoration :
 * `formeValide` rejette toute collection VIDE — « une collection vide signale un
 * enregistrement corrompu ». Un parc d'essai sans travaux ni cautions se fait
 * donc purger à la relecture suivante, et le cas passerait au vert sans que
 * rien ne soit corrigé. C'est exactement ce qui est arrivé à la première
 * rédaction de ce fichier.
 */
const LOCATAIRE_REEL = 'Awa Bello'
const CAUTIONNAIRE_REEL = 'Solange Mbida'
const TELEPHONE_REEL = '+237 6 55 00 11 22'
const DECLARANT_REEL = 'Blaise Kamdem'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc réel', currency: 'XAF' }],
  }
}

function serveurAvecParcReel() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: 'unite-1',
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: { id: 'loc-1', fullName: LOCATAIRE_REEL, phoneE164: TELEPHONE_REEL },
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2025-03-01T00:00:00.000Z',
              paidMinor: 90000,
              overdueDays: null,
            },
          ],
        },
      ],
      works: [
        {
          id: 'trav-1',
          unitId: 'unite-1',
          title: 'Fuite au compteur',
          trade: 'plumbing',
          status: 'reported',
          quotedAmountMinor: null,
          approvedAmountMinor: null,
          reportedAt: '2026-08-01T00:00:00.000Z',
          urgent: false,
          origin: 'tenantReport',
          reportedBy: DECLARANT_REEL,
        },
      ],
      deposits: [
        {
          id: 'caut-1',
          unitId: 'unite-1',
          tenant: CAUTIONNAIRE_REEL,
          heldMinor: 180000,
          withheldMinor: 0,
          status: 'held',
        },
      ],
      readings: [],
      inspections: [],
      notifications: [],
      leaseCharges: [],
    },
  })
  return serveur
}

/** Tout ce que l'enregistrement local ne doit pas contenir après un parc réel. */
const NOMINATIF = [LOCATAIRE_REEL, TELEPHONE_REEL, DECLARANT_REEL, CAUTIONNAIRE_REEL]

describe('le parc réel ne s’enregistre pas dans le stockage de la démonstration', () => {
  it('n’écrit aucun nom ni téléphone réel dans `localStorage`', async () => {
    serveurAvecParcReel()
    await renderApp('/app/parc', { session: sessionProprietaire() })
    await attendreLeChargement()

    // Le parc réel est bien à l'écran : sans cela le cas ne prouverait rien.
    expect(screen.getByRole('main')).toHaveTextContent(LOCATAIRE_REEL)

    const enregistre = window.localStorage.getItem('gestlocpro.portfolio') ?? ''
    for (const trace of NOMINATIF) expect(enregistre, trace).not.toContain(trace)
  })

  it('ne montre pas le parc réel à qui ouvre ensuite la démonstration', async () => {
    serveurAvecParcReel()
    const espace = await renderApp('/app/parc', { session: sessionProprietaire() })
    await attendreLeChargement()
    expect(screen.getByRole('main')).toHaveTextContent(LOCATAIRE_REEL)

    // Le visiteur quitte son espace et ouvre l'adresse publique.
    espace.unmount()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const main = screen.getByRole('main')
    for (const trace of NOMINATIF) expect(main, trace).not.toHaveTextContent(trace)
  })
})

/**
 * ═══ L'ADHÉSION QUI DISPARAÎT SOUS LE FOURNISSEUR ═══
 *
 * Les deux cas ci-dessus éprouvent un parc réel dont le `parkId` ne bouge
 * jamais : la garde `if (parkId) return` de la boucle d'enregistrement tient,
 * et rien ne part dans `localStorage`.
 *
 * ELLE NE TIENT PLUS DÈS QUE LE `parkId` TOMBE À `null` SOUS LES DONNÉES DÉJÀ
 * CHARGÉES. Se déconnecter fait exactement cela : `setEtat({ statut:
 * 'anonyme' })` vide `adhesions`, donc `adhesionActive`, donc `parkId` — mais
 * AUCUN chemin ne remet `units`, `works` et `deposits` à leur jeu de
 * démonstration. Le rendu suivant voit donc `parkId === null` et trois
 * collections qui ne sont pas celles du démarrage : la condition de la boucle
 * est satisfaite dans les deux sens, et le parc réel s'enregistre.
 *
 * Le fournisseur est encore MONTÉ à cet instant : il enveloppe `/app` et
 * `/demo`, et la barrière d'accès vit à l'intérieur — sa redirection n'a lieu
 * qu'à l'effet suivant. L'écriture passe avant le démontage.
 *
 * CE QUE CELA COÛTE EST LE DÉFAUT DU 2026-10-07 : `loadState()` sème les unités
 * au premier rendu, `READINGS_DEMO` sème les relevés, et aucun autre chemin ne
 * repose des relevés de démonstration. Un parc réel dans la clé donne donc
 * exactement l'écran mesuré en production — dix relevés de démonstration dont
 * aucun ne trouve son logement.
 */
describe('une adhésion qui disparaît n’enregistre pas le parc réel', () => {
  it('n’écrit aucun nom ni téléphone réel en se déconnectant', async () => {
    const serveur = serveurAvecParcReel()
    serveur.quand('POST', '/auth/logout', { status: 204 })
    const user = userEvent.setup()
    await renderApp('/app/parc', { session: sessionProprietaire() })
    await attendreLeChargement()

    // Le parc réel est bien à l'écran : sans cela le cas ne prouverait rien.
    expect(screen.getByRole('main')).toHaveTextContent(LOCATAIRE_REEL)

    await user.click(screen.getByRole('button', { name: /sarah ngassa/i }))
    await user.click(screen.getByRole('menuitem', { name: /se déconnecter/i }))

    const enregistre = window.localStorage.getItem('gestlocpro.portfolio') ?? ''
    for (const trace of NOMINATIF) expect(enregistre, trace).not.toContain(trace)
  })

  it('ne laisse pas des relevés de démonstration orphelins sur `/demo/releves`', async () => {
    const serveur = serveurAvecParcReel()
    serveur.quand('POST', '/auth/logout', { status: 204 })
    const user = userEvent.setup()
    const espace = await renderApp('/app/parc', { session: sessionProprietaire() })
    await attendreLeChargement()
    expect(screen.getByRole('main')).toHaveTextContent(LOCATAIRE_REEL)

    await user.click(screen.getByRole('button', { name: /sarah ngassa/i }))
    await user.click(screen.getByRole('menuitem', { name: /se déconnecter/i }))
    espace.unmount()

    // Le visiteur ouvre l'adresse publique, comme la production le 2026-10-07.
    await renderApp('/demo/releves')
    await attendreLeChargement()

    /* « Logement inconnu » est le NOM que le lot du symptôme a donné au manque.
       Sur la démonstration il ne doit jamais paraître : le jeu de relevés et le
       jeu d'unités sortent du même module. */
    expect(screen.queryAllByText('Logement inconnu')).toHaveLength(0)
  })
})
