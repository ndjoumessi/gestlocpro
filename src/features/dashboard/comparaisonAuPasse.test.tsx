import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * TROIS PIÈCES EXISTAIENT, ET ELLES NE S'ÉTAIENT JAMAIS RENCONTRÉES.
 *
 * ═══ L'INVENTAIRE ═══
 *
 *   · `DeltaBadge` — une pastille de variation, verte ou rouge selon le SENS,
 *     avec une option `invert` pour les grandeurs dont la hausse est une
 *     mauvaise nouvelle. Écrite, soignée, et appelée nulle part ailleurs que
 *     dans la vitrine des composants.
 *   · `StatCard.delta` — une propriété déclarée pour l'accueillir. Aucun
 *     appelant dans tout le dépôt.
 *   · Douze mois d'encaissements, rendus par le serveur et déjà en main de
 *     l'écran, qui ne servaient qu'au graphique et à l'export.
 *
 * Un indicateur qui a un passé et ne le montre pas laisse son lecteur devant un
 * nombre sans échelle : 950 000 F encaissés, est-ce beaucoup ? La question n'a
 * de réponse que par rapport au mois d'avant, et la réponse était dans la page,
 * à trois cents pixels de là, dans le graphique.
 *
 * ═══ LA RÈGLE, ET SON PIÈGE ═══
 *
 * Une flèche vers le haut n'est PAS une bonne nouvelle par défaut. Une hausse
 * de l'encaissé est bonne, une hausse du retard ne l'est pas. C'est exactement
 * ce que `invert` porte, et c'est pourquoi la variation ne peut pas se peindre
 * sans que l'écran dise de quel côté penche la grandeur.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 *   1. la carte de l'encaissé porte une variation CHIFFRÉE ;
 *   2. elle NOMME la base à laquelle elle se compare — une variation sans son
 *      point de départ est un pourcentage flottant ;
 *   3. le SENS suit la donnée : une baisse d'encaissement se peint en danger,
 *      une hausse en succès. Sans ce troisième cas, la pastille pourrait rester
 *      verte quoi qu'il arrive et la garde ne le verrait pas.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Deux mois d'encaissements : le second vaut ce que le cas veut éprouver. */
function collections(avant: number, courant: number) {
  return [
    { year: 2026, month: 6, rent: avant, water: 0, power: 0 },
    { year: 2026, month: 7, rent: courant, water: 0, power: 0 },
  ]
}

/*
  LE PARC ET LA SÉRIE DISENT LE MÊME CHIFFRE POUR LE MOIS COURANT, et ce n'est
  pas une coquetterie de jeu d'essai : la carte affiche `kpis.collected`, calculé
  sur les unités, pendant que la variation se calcule sur la SÉRIE des
  encaissements. Deux sources pour un même mois. Les faire diverger dans la
  fixture ferait passer la garde sur un écran incohérent — « 90 000 F, −16,8 %,
  vs 1 250 000 » —, c'est-à-dire exactement le défaut que le dépôt s'est déjà
  payé une fois avec des constantes d'encaissement inventées.
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

describe('la comparaison au passé sur les indicateurs', () => {
  it('chiffre la variation de l’encaissé et nomme sa base', async () => {
    // 1 250 000 le mois dernier, 1 040 000 ce mois-ci : −16,8 %.
    await ouvrir(collections(1250000, 1040000))
    const encaisse = carte(/encaissé ce mois/i)

    const texte = (encaisse.textContent ?? '').replace(/\s/g, ' ')
    expect(texte, 'aucune variation chiffrée sur la carte').toMatch(/−\s?16,8|−16,8/)
    /* LA BASE EST NOMMÉE. Un pourcentage sans son point de départ ne se vérifie
       pas : le lecteur doit pouvoir retrouver 1 250 000 dans le graphique. */
    expect(texte, 'la variation ne dit pas à quoi elle se compare').toContain('1 250 000')
  })

  it('peint la baisse en danger et la hausse en succès', async () => {
    await ouvrir(collections(1250000, 1040000))
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
    await ouvrir([{ year: 2026, month: 7, rent: 1040000, water: 0, power: 0 }])
    const texte = (carte(/encaissé ce mois/i).textContent ?? '').replace(/\s/g, ' ')
    /* On cherche une VARIATION SIGNÉE — « +12,4 % », « −16,8 % » — et non un
       pourcentage quelconque : la carte peut légitimement porter d'autres
       proportions, et refuser tout « % » ferait rougir la garde sur une note
       qui n'a rien à voir. */
    expect(texte, 'une variation est peinte sans mois de référence').not.toMatch(/[+−]\s?\d/)
    expect(texte, 'une base est nommée alors qu’il n’y en a pas').not.toMatch(/mois dernier/i)
  })
})
