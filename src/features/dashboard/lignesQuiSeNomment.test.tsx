import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import { NATURES_DU_DOSSIER } from '@/data/dossier'

/**
 * DEUX TABLEAUX NE DISAIENT PAS CE QUE LEURS COLONNES ÉTAIENT.
 *
 * ═══ CE QUE `role` COÛTE QUAND IL MANQUE ═══
 *
 * Il est facultatif sur une colonne de `DataTable`, et il manquait aux trois
 * colonnes de « Mes données » comme aux trois du registre des décisions. Ce
 * silence se paie deux fois :
 *
 * EN FICHES — la forme que les deux écrans prennent sous 64 rem, donc sur le
 * téléphone qui est l'appareil du marché visé — une colonne sans rôle tombe
 * dans le `contexte`, c'est-à-dire dans la liste de définitions. Les cartes
 * n'avaient donc AUCUNE ligne de tête : trois couples empilés, « Nature :
 * Loyers », « Lignes : 42 », « Fichier : [Télécharger] » — un bouton dans un
 * `<dd>`, présenté comme la définition d'un terme. Rien ne nommait la carte.
 *
 * EN TABLEAU, aucune ligne n'avait de nom. C'est le défaut que le lot précédent
 * a corrigé dans `DataTable` — l'identité devient `<th scope="row">` — et il ne
 * pouvait rien faire sur ces deux écrans, faute d'une colonne qui se déclare.
 *
 * ═══ ET LES RÉPONSES DE « MES DONNÉES » N'ÉTAIENT ANNONCÉES À PERSONNE ═══
 *
 * Ses trois bandeaux — dossier prêt, démonstration sans dossier, préparation
 * échouée — et celui de la fermeture de compte paraissent APRÈS un clic, en
 * remplacement du squelette, et le bouton qui les a demandés reste où il est :
 * rien ne bouge, rien n'est dit. Un bandeau inséré avec son texte déjà dedans
 * n'est pas annoncé ; `Toast` et `EcranSysteme` ont chacun payé cette leçon.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const PORTEFEUILLE_VIDE = {
  collections: [],
  buildings: [],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
}

const DOSSIER = {
  exporteLe: '2026-09-16T08:00:00.000Z',
  role: 'owner',
  compte: { email: COMPTE_FICTIF.email, fullName: COMPTE_FICTIF.fullName },
  parc: { name: 'Parc de test', currency: 'XAF' },
  ...Object.fromEntries(NATURES_DU_DOSSIER.map((nature) => [nature, [{ id: `${nature}-1` }]])),
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE_VIDE })
  serveur.quand('GET', `/parks/${PARC}/export`, { status: 200, body: DOSSIER })
})

async function preparerLeDossier(session: EtatSession = SESSION, largeur?: number) {
  const user = userEvent.setup()
  await renderApp('/app/mes-donnees', { session, largeur })
  await user.click(screen.getByRole('button', { name: /préparer mon export/i }))
  return user
}

describe('les lignes de « Mes données »', () => {
  it('nomme chaque ligne par sa nature', async () => {
    await preparerLeDossier()
    const tableau = await screen.findByRole('table', { name: /mes données/i })

    const lignes = within(tableau).getAllByRole('row').slice(1)
    expect(lignes.length, 'le tableau a perdu ses lignes').toBe(NATURES_DU_DOSSIER.length)

    for (const ligne of lignes) {
      /* `rowheader` ET NON `cell` : la nature NOMME la ligne, et c'est ce nom
         qu'un lecteur d'écran annonce à chaque déplacement. Sans lui, la colonne
         des comptes se lit « 1 », « 1 », « 2 » — des nombres sans natures. */
      const nom = within(ligne).getAllByRole('rowheader')
      expect(nom.length, 'la ligne n’a pas d’en-tête, ou en a plusieurs').toBe(1)
      expect(nom[0].textContent?.trim(), 'l’en-tête de ligne est vide').not.toBe('')
    }
  })

  it('donne une ligne de tête à la fiche, et sort le geste des définitions', async () => {
    /* 360 px — LE TÉLÉPHONE DU MARCHÉ VISÉ, et la seule largeur où ce défaut se
       voyait : au-delà de 64 rem l'écran rend un tableau, et les rôles n'y
       décident que l'en-tête de ligne. `matchMedia` du harnais répond par la
       largeur, donc la forme en fiches se rend pour de vrai. */
    await preparerLeDossier(SESSION, 360)
    const liste = await screen.findByRole('list', { name: /mes données/i })
    const fiche = within(liste).getAllByRole('listitem')[0]

    /* LA CARTE A UN NOM. Sans rôle, elle n'était qu'une liste de définitions :
       « Nature : Loyers », « Lignes : 42 », « Fichier : [Télécharger] ». La
       nature était un terme parmi trois, et rien ne nommait la carte. */
    /* PLUS AUCUN TERME À DÉFINIR : les trois colonnes ont désormais un rôle, donc
       la carte est une ligne de tête — nature et compte — suivie de son geste.
       Sans rôle, les trois étaient des couples « Nature : Loyers », « Lignes :
       42 », « Fichier : [Télécharger] », et rien ne nommait la carte. */
    expect(
      fiche.querySelector('dt'),
      'la carte range encore ses colonnes en définitions',
    ).toBeNull()
    /* ET L'INTITULÉ « Nature » A DISPARU DE LA CARTE : une identité se reconnaît
       à sa place, elle ne se fait pas précéder de son nom de colonne. Le compte,
       lui, garde son surtitre — trois nombres empilés ne se distingueraient pas
       sans lui. */
    expect(
      fiche.textContent,
      'la carte redit encore le nom de la colonne au-dessus de la nature',
    ).not.toMatch(/nature/i)

    const bouton = within(fiche).getByRole('button', { name: /tableur/i })
    /* LE TÉLÉCHARGEMENT EST UN GESTE, pas la définition d'un terme. Sous le rôle
       `geste`, il rejoint la rangée des gestes de la fiche ; sans rôle, il
       atterrissait dans un `<dd>` sous « Fichier : ». Le tableau, lui, ne change
       pas d'un pixel — c'est la forme en fiches que ce rôle décide. */
    expect(
      bouton.closest('dd'),
      'le bouton de téléchargement se fait passer pour une définition',
    ).toBeNull()
  })

  it('annonce l’échec de la préparation, et l’interrompt', async () => {
    serveur.quand('GET', `/parks/${PARC}/export`, { status: 500 })
    await preparerLeDossier()

    /* CHERCHÉ DANS `main` : un toast d'échec porte lui aussi `role="alert"`
       depuis le lot précédent, et c'est voulu — deux surfaces, deux annonces. On
       tient ici celle de l'ÉCRAN, qui reste quand le toast est parti. */
    const bandeau = await within(screen.getByRole('main')).findByRole('alert')
    /* `alert` ET NON `status` : la demande a échoué, le bouton est resté en
       place, et rien d'autre ne le dit. Même partage que les toasts — l'échec
       interrompt, le reste attend son tour. */
    expect(bandeau.textContent, 'ce n’est pas l’échec qui est annoncé').toMatch(
      /n’a pas pu être préparé/i,
    )
  })

  it('annonce le dossier prêt sans couper la parole', async () => {
    await preparerLeDossier()

    const bandeau = await within(screen.getByRole('main')).findByRole('status')
    expect(bandeau.textContent, 'la réponse au clic n’est annoncée à personne').toMatch(
      /dossier arrêté/i,
    )
    /* UN SUCCÈS N'A RIEN À COUPER : interrompre pour une bonne nouvelle apprend
       à ignorer les interruptions, et c'est l'échec qui en paie le prix. */
    expect(
      within(screen.getByRole('main')).queryByRole('alert'),
      'le succès interrompt la parole en cours',
    ).toBeNull()
  })
})

const PARC_DECISIONS = '00000000-0000-4000-8000-0000000000aa'

const DECISIONS = {
  decisions: [
    {
      id: 'd-2',
      action: 'payment.record',
      entity: 'Payment',
      entityId: '00000000-0000-4000-8000-0000000000cc',
      payload: { amountMinor: 145000, method: 'mobile' },
      at: '2026-08-28T14:05:00.000Z',
      actor: 'Arsène Nkolo',
    },
    {
      /* LE MÊME JOUR QUE LA PREMIÈRE, et c'est le cœur de ce cas : deux
         décisions d'une même date porteraient le même nom si la date nommait la
         ligne — ce qui est le cas ORDINAIRE d'un registre, pas un cas limite. */
      id: 'd-1',
      action: 'work.approve',
      entity: 'Work',
      entityId: '00000000-0000-4000-8000-0000000000dd',
      payload: {},
      at: '2026-08-28T09:12:00.000Z',
      actor: 'Diane Fotso',
    },
  ],
  suivant: null,
}

describe('les lignes du registre des décisions', () => {
  it('nomme chaque ligne par l’action, et non par sa date', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC_DECISIONS}/decisions`, { status: 200, body: DECISIONS })
    faux.quand('GET', `/parks/${PARC_DECISIONS}/portfolio`, {
      status: 200,
      body: PORTEFEUILLE_VIDE,
    })

    await renderApp('/app/decisions', {
      session: {
        statut: 'connecte',
        compte: COMPTE_FICTIF,
        adhesions: [
          { parkId: PARC_DECISIONS, role: 'owner', parkName: 'Parc Bonamoussadi', currency: 'XAF' },
        ],
      },
    })

    const tableau = await screen.findByRole('table')
    const lignes = within(tableau).getAllByRole('row').slice(1)
    expect(lignes.length, 'le registre a perdu ses lignes').toBe(2)

    const noms = lignes.map((ligne) => {
      const entetes = within(ligne).getAllByRole('rowheader')
      expect(entetes.length, 'la ligne n’a pas d’en-tête, ou en a plusieurs').toBe(1)
      return entetes[0].textContent ?? ''
    })

    /* DEUX NOMS DISTINCTS pour deux décisions du même jour. C'est ce que la date
       ne pouvait pas donner, et c'est pour cela que l'identité est l'ACTION —
       sans que la date perde sa première colonne, qui est l'ordre de lecture
       d'une chronologie. */
    expect(noms[0], 'l’en-tête ne nomme pas l’action').toMatch(/paiement|loyer|encaiss/i)
    expect(noms[1], 'l’en-tête ne nomme pas l’action').toMatch(/devis|travaux|valid/i)
    expect(noms[0]).not.toBe(noms[1])
  })
})
