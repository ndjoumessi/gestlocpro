import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA VARIATION COMPARE CE QUI EST COMPARABLE : DEUX MOIS AU MÊME JOUR.
 *
 * ═══ CE QUE LE LOT PRÉCÉDENT AVAIT RAISON DE VOULOIR ═══
 *
 * « 950 000 F encaissés, est-ce beaucoup ? » n'a de réponse que par rapport au
 * mois d'avant. Ce fichier tenait déjà cette idée, et elle reste : la carte
 * porte une variation CHIFFRÉE, elle NOMME sa base, et le SENS suit la donnée.
 *
 * ═══ CE QU'IL COMPARAIT, ET POURQUOI C'ÉTAIT FAUX ═══
 *
 * La base était le mois précédent ENTIER. Le numérateur, lui, est le mois
 * COURANT — celui que le graphique d'à côté hachure et annonce « encore
 * ouvert ». On rapportait donc un mois entamé à un mois complet, et la pastille
 * se peignait en danger pour cette seule raison.
 *
 * Le défaut n'est pas anecdotique : il se rejoue TOUS LES MOIS, chez tout le
 * monde, et il est maximal le 3 du mois — où la carte annoncera −90 % d'un parc
 * qui va parfaitement bien. Mesuré sur la démonstration au 28 septembre :
 * « −24 % vs 1 250 000 le mois dernier », en rouge, sur un mois dont les loyers
 * étaient déjà rentrés.
 *
 * ═══ LA BASE JUSTE, ET POURQUOI ELLE EXISTE ═══
 *
 * Le serveur connaît la DATE de chaque versement. Il peut donc dire ce que le
 * mois précédent avait encaissé AU MÊME JOUR DU MOIS — `rentToDate`. C'est la
 * seule base qui rende la pastille vérifiable, et elle ne s'invente pas : on ne
 * proratise pas le mois entier, parce que le loyer n'arrive pas régulièrement
 * mais dans les premiers jours, et qu'un prorata fabriquerait un nombre.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * Que `rentToDate` soit JUSTE : il est ici servi par la fixture. Sa règle de
 * calcul — les versements dont le jour du mois ne dépasse pas celui
 * d'aujourd'hui — se garde côté serveur, dans `encaisseALaMemeDate.test.ts`.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/**
 * Deux mois d'encaissements.
 *
 * `avantEntier` est ce que le mois précédent a fini par encaisser ; `avantALaDate`
 * ce qu'il en avait encaissé au jour où nous sommes. Les séparer est tout le
 * sujet : une fixture où ils sont égaux ne peut distinguer aucune des deux
 * règles, et c'est exactement l'état dans lequel ce fichier passait au vert sur
 * le code fautif.
 */
function collections({
  avantEntier,
  avantALaDate,
  courant,
}: {
  avantEntier: number
  avantALaDate: number
  courant: number
}) {
  return [
    { year: 2026, month: 6, rent: avantEntier, rentToDate: avantALaDate, water: 0, power: 0 },
    { year: 2026, month: 7, rent: courant, rentToDate: courant, water: 0, power: 0 },
  ]
}

/*
  LE PARC ET LA SÉRIE DISENT LE MÊME CHIFFRE POUR LE MOIS COURANT, et ce n'est
  pas une coquetterie de jeu d'essai : la carte affiche `kpis.collected`, calculé
  sur les unités, pendant que la variation se calcule sur la SÉRIE des
  encaissements. Deux sources pour un même mois. Les faire diverger dans la
  fixture ferait passer la garde sur un écran incohérent.
*/
function serveur(encaissements: ReturnType<typeof collections>) {
  const courant = encaissements[encaissements.length - 1]!.rent
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: encaissements,
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: 'u-1',
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: courant,
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2026-06-01T00:00:00.000Z',
              paidMinor: courant,
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
    },
  })
  return faux
}

/** La carte d'indicateur qui porte cet intitulé. */
function carte(intitule: RegExp): HTMLElement {
  const libelle = screen.getByText(intitule)
  const boite = libelle.closest('[data-indicateur]')
  if (!boite) throw new Error(`aucune carte pour ${intitule}`)
  return boite as HTMLElement
}

async function ouvrir(encaissements: ReturnType<typeof collections>) {
  serveur(encaissements)
  await renderApp('/app', { session: sessionProprietaire() })
  await attendreLeChargement()
}

/** Le texte de la carte, espaces insécables ramenés à des espaces ordinaires. */
function texteDe(intitule: RegExp): string {
  return (carte(intitule).textContent ?? '').replace(/\s/g, ' ')
}

describe('la comparaison au passé sur les indicateurs', () => {
  /**
   * LE CŒUR DU LOT, et le seul cas qui distingue les deux règles.
   *
   * Le mois dernier a FINI à 1 250 000 mais n'en avait encaissé que 800 000 au
   * jour où nous sommes. 1 040 000 aujourd'hui est donc une HAUSSE de 30 %, là
   * où la comparaison au mois entier annonçait une chute de 16,8 % — même
   * donnée, verdict opposé.
   */
  it('compare à la même date du mois dernier, jamais au mois entier', async () => {
    await ouvrir(collections({ avantEntier: 1250000, avantALaDate: 800000, courant: 1040000 }))
    const texte = texteDe(/encaissé ce mois/i)

    expect(
      texte,
      'la base nommée est le mois ENTIER : on rapporte un mois entamé à un mois complet, et la pastille rougit pour cette seule raison',
    ).toContain('800 000')
    expect(texte, 'le mois entier est encore cité comme base').not.toContain('1 250 000')
    expect(
      texte,
      'le sens est resté celui de la comparaison au mois entier — une hausse réelle annoncée comme une baisse',
    ).toMatch(/\+\s?30/)
  })

  it('peint la baisse en danger et la hausse en succès', async () => {
    await ouvrir(collections({ avantEntier: 1250000, avantALaDate: 1250000, courant: 1040000 }))
    const baisse = within(carte(/encaissé ce mois/i)).getByText(/16,8/)
    /*
      LE SENS SUIT LA DONNÉE, et sans ce cas la pastille pourrait rester verte
      quoi qu'il arrive. On interroge la CLASSE de ton plutôt que la couleur
      calculée : jsdom ne résout aucun jeton, et la classe est ce que le
      composant décide.
    */
    const tonDe = (el: HTMLElement) => el.closest('[class]')?.className ?? ''
    expect(tonDe(baisse), 'une baisse d’encaissement se peint en succès').toContain('danger')
  })

  it('ne compare rien quand il n’y a pas de mois précédent', async () => {
    /*
      GARDE DU GARDE. Un parc dont le serveur ne rend qu'un seul mois n'a pas de
      passé : inventer une variation de 0 % y serait un chiffre, pas une mesure.
      Sans ce cas, la règle serait satisfaite par une pastille inconditionnelle.
    */
    await ouvrir([{ year: 2026, month: 7, rent: 1040000, rentToDate: 1040000, water: 0, power: 0 }])
    const texte = texteDe(/encaissé ce mois/i)
    /* On cherche une VARIATION SIGNÉE — « +12,4 % », « −16,8 % » — et non un
       pourcentage quelconque : la carte peut légitimement porter d'autres
       proportions, et refuser tout « % » ferait rougir la garde sur une note
       qui n'a rien à voir. */
    expect(texte, 'une variation est peinte sans mois de référence').not.toMatch(/[+−]\s?\d/)
    expect(texte, 'une base est nommée alors qu’il n’y en a pas').not.toMatch(/mois dernier/i)
  })

  /**
   * LA BASE ABSENTE NE SE REMPLACE PAS PAR LE MOIS ENTIER.
   *
   * Un serveur plus ancien ne rend pas `rentToDate`. Se rabattre alors sur
   * `rent` rétablirait le défaut en silence, sur les seuls déploiements où
   * personne ne regarde. On préfère ne rien comparer.
   */
  it('ne compare rien quand le serveur ne dit pas l’encaissé à la date', async () => {
    await ouvrir([
      { year: 2026, month: 6, rent: 1250000, water: 0, power: 0 },
      { year: 2026, month: 7, rent: 1040000, water: 0, power: 0 },
    ] as ReturnType<typeof collections>)
    const texte = texteDe(/encaissé ce mois/i)
    expect(texte, 'la variation est retombée sur le mois entier faute de mieux').not.toMatch(/[+−]\s?\d/)
  })
})
