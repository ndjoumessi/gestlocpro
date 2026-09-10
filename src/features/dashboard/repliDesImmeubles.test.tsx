import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE REPLI DES IMMEUBLES EST PARTI, et ce fichier ne garde que l'ordre.
 *
 * Nelson l'a demandé le 2026-09-07 : sur bureau, chaque immeuble est une
 * carte et ses logements une grille de fiches ; replier cachait la seule chose
 * qu'on vient lire. Les trois cas du chevron sont partis avec lui. Reste
 * l'ordre — un immeuble sans logement en fin de liste, et dit comme tel —,
 * qui ne dépend pas du repli et que rien d'autre ne tient.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function loue(id: string, label: string) {
  return {
    id,
    label,
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    paidMinor: 185000,
    status: 'paid',
    leaseId: `bail-${id}`,
    leaseStartsOn: '2026-01-01',
    overdueDays: null,
    tenant: { id: `t-${id}`, fullName: 'Charles Ngassa', phoneE164: '+237677214408' },
  }
}

/** Un immeuble PLEIN et un immeuble SANS LOGEMENT : c'est le couple qui fait le cas. */
function parcAvecUnImmeubleVide() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      /*
        L'IMMEUBLE VIDE EST DÉCLARÉ EN PREMIER, ET C'EST LE POINT.

        Déclaré en second, il arrivait dernier de toute façon : la garde de
        l'ordre passait au vert SANS la partition, et une mutation l'a montré —
        retirer le tri ne la faisait pas rougir. Un cas qui ne peut pas échouer
        ne garde rien.

        Ici seul le tri peut le renvoyer en fin de liste.
      */
      buildings: [
        { id: 'b-vide', name: 'Résidence Neuve', district: 'Akwa', units: [] },
        {
          id: 'b-plein',
          name: 'Résidence Pleine',
          district: 'Bastos',
          units: [loue('u-1', 'A1'), loue('u-2', 'A2')],
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

/** L'en-tête de groupe qui porte ce nom d'immeuble. */
function enTete(nom: string) {
  const bloc = Array.from(document.querySelectorAll('[data-groupe]')).find(
    (e) => e.querySelector('h3')?.textContent?.trim() === nom,
  )
  if (!bloc) throw new Error(`Aucun en-tête de groupe pour « ${nom} »`)
  return bloc as HTMLElement
}

async function ouvrir() {
  parcAvecUnImmeubleVide()
  await renderApp('/app/parc', { session: SESSION_PROPRIETAIRE, largeur: 1280 })
  await attendreLeChargement()
  await screen.findByText('Résidence Pleine')
}

describe('l’ordre des immeubles', () => {
  it('range l’immeuble sans logement en FIN de liste, et le dit', async () => {
    await ouvrir()

    const noms = Array.from(document.querySelectorAll('[data-groupe]')).map((e) =>
      e.querySelector('h3')?.textContent?.trim(),
    )
    /* « Neuve » est déclarée PREMIÈRE par le serveur et arrive DERNIÈRE :
       seule la partition peut produire cet ordre. Voir le jeu de données. */
    expect(noms).toEqual(['Résidence Pleine', 'Résidence Neuve'])

    /* ET LA MENTION, parce que « 0/0 » est exact et muet : il faut savoir le
       lire pour comprendre qu'il n'y a pas encore de logement. */
    expect(within(enTete('Résidence Neuve')).getByText(/aucun logement/)).toBeInTheDocument()
  })
})

/**
 * L'IMMEUBLE VIDE PORTE LE GESTE QUI LE REMPLIT.
 *
 * Relevé en production : quatre résidences sans logement, chacune sur une rangée
 * pleine, disant trois fois la même absence — « aucun logement », un loyer de
 * zéro, un rapport de zéro sur zéro — et n'offrant aucun moyen d'y remédier. Le
 * seul chemin rouvrait la liste des immeubles sur le PREMIER du parc.
 *
 * La démonstration n'a que trois immeubles, tous peuplés : aucune porte au
 * navigateur ne rend ce cas. Ce fichier est le seul endroit qui le mesure.
 */
describe('l’immeuble vide', () => {
  it('offre d’y ajouter un logement, et le plein ne l’offre pas', async () => {
    await ouvrir()

    /* LE NOM ACCESSIBLE PORTE L'IMMEUBLE : quatre immeubles vides, c'est quatre
       boutons au même texte visible, qu'un lecteur d'écran doit distinguer. */
    const geste = within(enTete('Résidence Neuve')).getByRole('button', {
      name: 'Ajouter un logement à Résidence Neuve',
    })
    expect(geste).toBeInTheDocument()
    expect(
      within(enTete('Résidence Pleine')).queryByRole('button', { name: /Ajouter un logement à/ }),
      'un immeuble peuplé n’a pas à se faire remplir',
    ).toBeNull()

    /* « 0/0 » ÉTAIT EXACT ET MUET, et il part avec le loyer de zéro. Le plein,
       lui, garde son rapport — c'est la mesure de cet écran. */
    expect(within(enTete('Résidence Neuve')).queryByText('0/0')).toBeNull()
    expect(within(enTete('Résidence Pleine')).getByText('2/2')).toBeInTheDocument()
  })

  it('ouvre la modale SUR cet immeuble, et non sur le premier du parc', async () => {
    /*
      L'IMMEUBLE VIDE EST DÉCLARÉ EN SECOND ICI, ET C'EST TOUT LE CAS.

      La fixture du fichier le déclare en PREMIER, pour éprouver l'ordre. Avec
      elle, la modale le pré-choisissait de toute façon — c'est le premier du
      parc —, et ce cas passait SANS le correctif. Il a été écrit ainsi, puis
      relu : un cas qui ne peut pas échouer ne garde rien.

      Déclaré second, seul l'immeuble transmis peut le faire choisir.
    */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [
          {
            id: 'b-plein',
            name: 'Résidence Pleine',
            district: 'Bastos',
            units: [loue('u-1', 'A1'), loue('u-2', 'A2')],
          },
          { id: 'b-vide', name: 'Résidence Neuve', district: 'Akwa', units: [] },
        ],
        works: [],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
      },
    })
    await renderApp('/app/parc', { session: SESSION_PROPRIETAIRE, largeur: 1280 })
    await attendreLeChargement()
    await screen.findByText('Résidence Pleine')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ajouter un logement à Résidence Neuve' }))

    const modale = await screen.findByRole('dialog')
    const immeuble = within(modale).getByRole('combobox', { name: /Immeuble/ }) as HTMLSelectElement
    expect(immeuble.value, 'la modale s’ouvre sur le premier immeuble du parc').toBe('b-vide')
  })
})

