import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE REGISTRE DES DÉCISIONS, CÔTÉ ÉCRAN.
 *
 * ═══ CE QUI DORMAIT ═══
 *
 * `AuditEvent` était écrit à seize endroits du serveur et lu nulle part. Le
 * produit tenait une piste d'audit qu'il n'ouvrait jamais : un propriétaire ne
 * pouvait pas savoir qui avait arbitré une caution, validé un devis ou retiré
 * un versement de son registre — alors que la base le savait depuis des mois.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Trois choses, et la troisième est celle qu'on oublie.
 *
 * Que l'écran RENDE ce que le serveur donne, dans l'ordre du registre — le plus
 * récent d'abord, parce qu'on ouvre un journal pour savoir ce qui vient de se
 * passer.
 *
 * Que chaque décision se lise EN TOUTES LETTRES. `work.approve` est un code de
 * base ; « Devis validé » est une phrase. Un registre illisible est un registre
 * qu'on n'ouvre pas deux fois.
 *
 * Et que le gestionnaire n'y ait pas accès — ni par le menu, ni par l'adresse.
 * Le premier est de la courtoisie, le second est la règle : le serveur la tient
 * déjà par un 403, et l'écran ne doit pas promettre ce que la porte refuse.
 */

const PARC = '00000000-0000-4000-8000-0000000000aa'

function session(role: 'owner' | 'manager'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
  }
}

/** Deux décisions, dans l'ordre où le serveur les rend : la plus récente d'abord. */
const DECISIONS = {
  decisions: [
    {
      id: 'd-2',
      action: 'deposit.settle',
      entity: 'Deposit',
      entityId: '00000000-0000-4000-8000-0000000000bb',
      payload: { withheldMinor: 40000, reason: 'Peinture du séjour' },
      at: '2026-08-28T14:05:00.000Z',
      actor: 'Arsène Nkolo',
    },
    {
      id: 'd-1',
      action: 'payment.record',
      entity: 'Payment',
      entityId: '00000000-0000-4000-8000-0000000000cc',
      payload: { amountMinor: 145000, method: 'mobile' },
      at: '2026-08-27T09:12:00.000Z',
      actor: 'Diane Fotso',
    },
  ],
  suivant: null,
}

function serveur(role: 'owner' | 'manager' = 'owner') {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/decisions`, { status: 200, body: DECISIONS })
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
    },
  })
  return { faux, session: session(role) }
}

describe('le registre des décisions', () => {
  it('montre ce que le parc a écrit, le plus récent d’abord', async () => {
    const { session: etat } = serveur()
    await renderApp('/app/decisions', { session: etat })
    await attendreLeChargement()

    const texte = screen.getByRole('main').textContent ?? ''
    /* L'ORDRE EST L'INFORMATION, et on le mesure par les POSITIONS plutôt que
       par un index de ligne : la table se rend en fiches sous un point de
       rupture, et un cas qui compte les `row` mesurerait la mise en page. Un
       registre rendu à l'endroit oblige à descendre jusqu'en bas pour voir ce
       qui vient d'arriver. */
    const arbitrage = texte.indexOf('Caution arbitrée')
    const encaissement = texte.indexOf('Encaissement saisi')
    expect(arbitrage, 'la décision la plus récente est absente').toBeGreaterThan(-1)
    expect(encaissement, 'la décision plus ancienne est absente').toBeGreaterThan(-1)
    expect(arbitrage, 'le registre se lit à l’endroit').toBeLessThan(encaissement)
  })

  /**
   * LA TRADUCTION EST LA MOITIÉ DU PRODUIT.
   *
   * Le serveur écrit `deposit.settle`, `payment.record`, `work.approve` — un
   * vocabulaire de base de données. Rendu tel quel, le registre serait exact et
   * inutilisable ; c'est la différence entre exporter une table et construire
   * un écran.
   */
  it('dit chaque décision en toutes lettres, jamais son code', async () => {
    const { session: etat } = serveur()
    await renderApp('/app/decisions', { session: etat })
    await attendreLeChargement()

    const principal = screen.getByRole('main')
    expect(principal.textContent, 'le code brut du serveur est à l’écran').not.toMatch(
      /deposit\.settle|payment\.record/,
    )
    /* ET L'ACTEUR EST NOMMÉ : c'est le nom qui fait du registre un contrôle
       plutôt qu'une liste d'événements. */
    expect(within(principal).getByText(/Arsène Nkolo/)).toBeInTheDocument()
    expect(within(principal).getByText(/Diane Fotso/)).toBeInTheDocument()
  })

  /**
   * CE QUI A CHANGÉ, ET PAS SEULEMENT QU'IL S'EST PASSÉ QUELQUE CHOSE.
   *
   * Chaque décision porte un `payload` — le montant retenu sur une caution, le
   * moyen d'un encaissement, le prix du mètre cube posé. Il était rendu par la
   * route et ignoré par l'écran : « Caution arbitrée » sans le montant retenu
   * est une demi-information, et un registre d'audit qui ne dit pas COMBIEN ne
   * sert pas à auditer.
   */
  it('dit ce qui a changé, et pas seulement qu’il s’est passé quelque chose', async () => {
    const { session: etat } = serveur()
    await renderApp('/app/decisions', { session: etat })
    await attendreLeChargement()

    const texte = (screen.getByRole('main').textContent ?? '').replace(/[\s ]/g, ' ')
    /* La caution : le montant retenu ET le motif. Le second est ce qu'on
       conteste, le premier ce qu'on vérifie. */
    expect(texte, 'le montant retenu manque').toMatch(/40 000/)
    expect(texte, 'le motif de la retenue manque').toMatch(/Peinture du séjour/)
    /* L'encaissement : son montant et son moyen, en toutes lettres. */
    expect(texte, 'le montant encaissé manque').toMatch(/145 000/)
    expect(texte, 'le moyen de paiement manque').toMatch(/Mobile Money/)
  })

  /**
   * ET LE DÉTAIL NE DÉBORDE PAS EN JSON.
   *
   * `payload` est un `Json` dont la forme varie selon l'action : un rendu
   * générique produirait `{"withheldMinor":40000,...}` à l'écran, ce qui est
   * exact et illisible. Une action sans détail utile n'en montre AUCUN — mieux
   * vaut une ligne muette qu'une accolade.
   */
  it('ne déverse jamais la forme brute du serveur', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/decisions`, {
      status: 200,
      body: {
        decisions: [
          {
            id: 'd-x',
            /* Une action que le dictionnaire ne connaît pas, avec un contenu
               qu'aucune recette ne sait lire : le pire cas, et le seul qui
               puisse laisser fuir la forme du serveur. */
            action: 'chose.inconnue',
            entity: 'Chose',
            entityId: '00000000-0000-4000-8000-0000000000dd',
            payload: { machin: 42, truc: { imbrique: true } },
            at: '2026-08-28T14:05:00.000Z',
            actor: 'Arsène Nkolo',
          },
        ],
        suivant: null,
      },
    })
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
      },
    })

    await renderApp('/app/decisions', { session: session('owner') })
    await attendreLeChargement()

    const texte = screen.getByRole('main').textContent ?? ''
    expect(texte, 'la forme brute du serveur est à l’écran').not.toMatch(/[{}]|machin|imbrique/)
  })

  /**
   * LE CONTREPOIDS, et il porte le sujet du lot.
   *
   * Le registre existe pour que le propriétaire contrôle ce qu'il délègue. Un
   * gestionnaire qui le lirait y verrait ses propres actes rassemblés pour son
   * employeur — et surtout, le serveur le refuse par un 403 : un écran qui
   * l'offrirait promettrait ce que la porte n'accorde pas.
   */
  it('se refuse au gestionnaire, par le menu comme par l’adresse', async () => {
    const { session: etat } = serveur('manager')
    await renderApp('/app', { session: etat })
    await attendreLeChargement()

    expect(
      screen.queryByRole('link', { name: /Décisions|Decisions/ }),
      'le menu propose un écran interdit',
    ).toBeNull()

    await renderApp('/app/decisions', { session: session('manager') })
    await attendreLeChargement()
    expect(
      screen.queryByText(/Caution arbitrée|Deposit settled/),
      'l’adresse forgée rend le registre',
    ).toBeNull()
  })

  /**
   * LA DÉMONSTRATION SERT SON PROPRE REGISTRE.
   *
   * Sans cela, l'écran est une impasse dans un parcours qui montre trois
   * immeubles et douze logements — et il n'est mesuré par personne : ni
   * `mesure-ui` en géométrie, ni `couleur-non-seule` en contraste. C'est la
   * leçon déjà payée par `Access`, `TariffsModal` et `ParkSettingsModal`.
   */
  it('existe aussi en démonstration', async () => {
    installerFauxServeur()
    await renderApp('/demo/decisions')
    await attendreLeChargement()

    expect(screen.getAllByRole('row').length, 'le registre de démonstration est vide').toBeGreaterThan(
      1,
    )
  })
})
