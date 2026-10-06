import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'
import { MOIS_DEMO } from '@/data/portfolio'

/**
 * ÉMIS OU CALCULÉ — CE QUE LA BOÎTE DIT, ET QUI PEUT L'ARRÊTER.
 *
 * ═══ POURQUOI CES CAS NE PEUVENT PAS VIVRE EN DÉMONSTRATION ═══
 *
 * `honorairesDuMandat.test.tsx` ouvre cette même boîte sur `/demo/acces`, où
 * `parkId` est nul : aucun relevé n'est demandé, et TOUT le bloc du
 * compte-rendu est masqué. C'est ce que son troisième cas éprouve — « sans
 * barème, elle le dit ». Rien de ce lot n'y est donc atteignable, et c'est aussi
 * pourquoi `modales` ne mesure aucune hauteur de plus : en démonstration, cette
 * boîte n'a pas changé d'un pixel.
 *
 * Ces cas montent donc un VRAI parc simulé — même forme que
 * `relancesReglables` et `registreDesAcces`.
 *
 * ═══ CE QU'ILS GARDENT ═══
 *
 *   1. LA BOÎTE DIT TOUJOURS LEQUEL DES DEUX ELLE MONTRE. Un compte-rendu qui
 *      ne le dirait pas serait pire que l'ancien, qui calculait toujours : on
 *      lirait des chiffres sans savoir s'ils suivent encore les lignes du parc.
 *
 *   2. LE TAUX DE L'ÉMISSION PARAÎT QUAND IL DIFFÈRE DU COURANT. Sans cela, un
 *      mandant qui a changé de taux lirait un montant d'honoraires que le taux
 *      affiché au-dessus n'explique pas.
 *
 *   3. LE GESTIONNAIRE NE VOIT PAS LE GESTE. Le serveur le refuse déjà (403) ;
 *      l'écran ne le propose pas. Un bouton qui ouvre sur un refus est un
 *      cul-de-sac sous un libellé qui promet un acte.
 *
 * ═══ CE QU'ILS NE GARDENT PAS ═══
 *
 * LE FIGEAGE LUI-MÊME. Qu'un document n'évolue plus se mesure en base, et
 * `server/src/parks/compteRenduEmis.test.ts` le tient contre un vrai Postgres.
 * Ici le serveur est simulé : il rendrait tout ce qu'on lui fait rendre, et un
 * cas écrit ici « prouverait » le figeage en le postulant.
 */
const PARC = '11111111-2222-4333-8444-555555555555'
const MANDAT = 'm-diane'

/**
 * L'ADRESSE EXACTE DU RELEVÉ, CHAÎNE DE REQUÊTE COMPRISE.
 *
 * Le faux serveur indexe une requête sur son chemin ENTIER — `const chemin =
 * url.replace(/^\/api/, '')`, query incluse. Un stub posé sans `?from=…` rend
 * donc 404, l'écran retombe sur « aucun relevé », et le cas échoue sur une
 * absence qui ressemble à un défaut de rendu. Mesuré : c'est exactement ce que
 * la première rédaction de ce fichier faisait.
 *
 * LES BORNES SONT RECALCULÉES ICI, et c'est une duplication assumée de
 * `bornesDuMois` : un test doit s'adresser à l'URL que le composant appelle, et
 * lui demander cette URL serait lui faire valider sa propre arithmétique.
 */
const [AN, MOIS_NUM] = MOIS_DEMO.split('-').map(Number) as [number, number]
const DERNIER = new Date(Date.UTC(AN, MOIS_NUM, 0)).getUTCDate()
const CHEMIN_RELEVE =
  `/parks/${PARC}/memberships/${MANDAT}/statement` +
  `?from=${MOIS_DEMO}-01&to=${MOIS_DEMO}-${String(DERNIER).padStart(2, '0')}`

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const REGISTRE = {
  members: [
    {
      id: 'moi',
      role: 'owner',
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-01-15T09:00:00.000Z',
    },
    {
      id: MANDAT,
      role: 'manager',
      fullName: 'Diane Mballa',
      email: 'diane@example.com',
      since: '2026-03-02T09:00:00.000Z',
    },
  ],
  invitations: [],
}

const BAREME_COURANT = {
  basis: 'percentOfCollected',
  rateBasisPoints: 2000,
  fixedMinor: null,
  currency: 'XAF',
  startsOn: '2026-01-01',
  endsOn: null,
}

/** Le compte-rendu CALCULÉ : il suit encore les lignes du parc. */
const CALCULE = {
  fee: BAREME_COURANT,
  collectedMinor: 100000,
  expensesMinor: 0,
  worksMinor: 0,
  feeMinor: 20000,
  netMinor: 80000,
  managedUnits: 1,
  issuedAt: null,
}

/**
 * Le compte-rendu ÉMIS, avec un taux figé DIFFÉRENT du courant.
 *
 * 1000 points de base contre 2000 : c'est ce décalage qui rend le deuxième cas
 * utile. Avec le même taux des deux côtés, la ligne du taux figé serait masquée
 * — à juste titre — et le cas passerait sans rien éprouver.
 */
const EMIS = {
  fee: BAREME_COURANT,
  issuedFee: {
    basis: 'percentOfCollected',
    rateBasisPoints: 1000,
    fixedMinor: null,
    currency: 'XAF',
  },
  collectedMinor: 100000,
  expensesMinor: 0,
  worksMinor: 0,
  feeMinor: 10000,
  netMinor: 90000,
  managedUnits: 1,
  issuedAt: '2026-10-06T08:30:00.000Z',
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLeMandat(role: Role, releve: unknown) {
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  /* LE PORTEFEUILLE AUSSI : cet écran le lit pour proposer de relier une fiche
     de locataire à un compte. Sans lui, il rend son état d'erreur — « Réessayer »
     — et aucun déclencheur n'existe. Mesuré en sondant les boutons rendus. */
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
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
  /* LE RELEVÉ EST DEMANDÉ AVEC LES BORNES DU MOIS AFFICHÉ. Le faux serveur
     répond sur le CHEMIN, sans regarder la requête : c'est suffisant ici, où le
     sujet est ce que la boîte DIT de la réponse. */
  serveur.quand('GET', CHEMIN_RELEVE, { status: 200, body: releve })
  await renderApp('/app/acces', { session: sessionDuRole(role), largeur: 1280 })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Honoraires et relevé — Diane Mballa/ }))
  return { user, boite: await screen.findByRole('dialog') }
}

describe('ce que la boîte dit du compte-rendu', () => {
  it('ANNONCE UN CALCUL VIVANT tant que rien n’est émis', async () => {
    const { boite } = await ouvrirLeMandat('owner', CALCULE)
    expect(
      await within(boite).findByText(/suivent les lignes du parc/),
      'sans cette phrase, on lirait des chiffres sans savoir s’ils sont arrêtés',
    ).toBeInTheDocument()
    expect(within(boite).queryByText(/Émis le/)).not.toBeInTheDocument()
  })

  it('ANNONCE LA DATE DU DOCUMENT une fois émis, et le taux qui l’explique', async () => {
    const { boite } = await ouvrirLeMandat('owner', EMIS)
    expect(await within(boite).findByText(/Émis le/)).toBeInTheDocument()
    expect(within(boite).queryByText(/suivent les lignes du parc/)).not.toBeInTheDocument()
    /* LE TAUX FIGÉ, parce qu'il diffère du courant : 10 % explique les 10 000
       d'honoraires, là où le 20 % du barème en vigueur ne les explique pas. */
    expect(
      within(boite).getByText(/taux de l’émission : 10 %/),
      'un montant figé sous un taux courant serait deux chiffres sans rapport',
    ).toBeInTheDocument()
  })

  it('N’AFFICHE PAS LE TAUX FIGÉ quand il est celui du barème courant', async () => {
    /* La ligne ne doit paraître que lorsqu'elle APPREND quelque chose. Répéter
       « taux de l'émission : 20 % » sous un barème à 20 % serait du bruit, et le
       bruit finit par cacher le cas où le taux diffère vraiment. */
    const memeTaux = { ...EMIS, issuedFee: { ...EMIS.issuedFee, rateBasisPoints: 2000 } }
    const { boite } = await ouvrirLeMandat('owner', memeTaux)
    expect(await within(boite).findByText(/Émis le/)).toBeInTheDocument()
    expect(within(boite).queryByText(/taux de l’émission/)).not.toBeInTheDocument()
  })
})

describe('qui peut arrêter le compte', () => {
  it('OFFRE LE GESTE AU PROPRIÉTAIRE', async () => {
    const { boite } = await ouvrirLeMandat('owner', CALCULE)
    expect(
      await within(boite).findByRole('button', { name: /Émettre le compte-rendu/ }),
    ).toBeInTheDocument()
  })

  it('N’OUVRE MÊME PAS la boîte à un gestionnaire', async () => {
    /*
      CE CAS A CHANGÉ DE SUJET EN COURS D'ÉCRITURE, et c'est ce qu'il garde qui
      compte. Il vérifiait d'abord que le BOUTON d'émission est retiré au
      gestionnaire — et il n'a pas su ouvrir la boîte pour le constater.

      Le déclencheur, sur l'écran des accès, est gardé par
      `m.role === 'manager' && estProprietaire` : un gestionnaire n'a aucune
      porte vers cette boîte. Le `role === 'owner'` qu'on avait posé sur le
      bouton était donc une seconde garde pour la même règle, infalsifiable —
      elle a été retirée.

      CE QUI RESTE À GARDER EST L'ABSENCE DE PORTE, et c'est ici. Le refus
      d'émission, lui, vit au serveur (403) et s'éprouve contre une vraie base
      dans `compteRenduEmis.test.ts` — là où il tient même si cette boîte
      s'ouvre un jour depuis un autre écran.
    */
    serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
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
    await renderApp('/app/acces', { session: sessionDuRole('manager'), largeur: 1280 })
    await attendreLeChargement()
    expect(
      screen.queryByRole('button', { name: /Honoraires et relevé/ }),
      'aucune porte vers la boîte des honoraires',
    ).not.toBeInTheDocument()
  })

  it('NE L’OFFRE PAS une seconde fois sur un mois déjà émis', async () => {
    /* Rien ne réémet. Un bouton qui ouvrirait sur un 409 serait un cul-de-sac
       sous un libellé qui promet un acte. */
    const { boite } = await ouvrirLeMandat('owner', EMIS)
    expect(await within(boite).findByText(/Émis le/)).toBeInTheDocument()
    expect(
      within(boite).queryByRole('button', { name: /Émettre le compte-rendu/ }),
    ).not.toBeInTheDocument()
  })

  it('ÉMET, puis affiche le document que le serveur a rendu', async () => {
    /*
      L'ÉCRAN NE DEVINE PAS `issuedAt` : il prend la réponse. Poser la date
      depuis l'horloge du navigateur afficherait une date que le document ne
      porte pas, et les deux divergent dès que les machines divergent.
    */
    const { user, boite } = await ouvrirLeMandat('owner', CALCULE)
    serveur.quand('POST', `/parks/${PARC}/memberships/${MANDAT}/statement`, {
      status: 201,
      body: EMIS,
    })
    await user.click(await within(boite).findByRole('button', { name: /Émettre le compte-rendu/ }))
    expect(await within(boite).findByText(/Émis le/)).toBeInTheDocument()
    expect(
      within(boite).queryByRole('button', { name: /Émettre le compte-rendu/ }),
      'le geste se retire, parce qu’il ne se refait pas',
    ).not.toBeInTheDocument()
  })
})
