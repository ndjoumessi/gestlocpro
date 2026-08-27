import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * CHAQUE INDICATEUR PORTE SON REPÈRE, ET LE REPÈRE SUIT L'ÉTAT.
 *
 * Quatre rectangles nus se lisaient de gauche à droite comme un tableur : rien
 * n'y accrochait l'œil de qui revient sur la page pour la dixième fois de la
 * journée. Une tuile teintée et un glyphe donnent à chaque carte un point
 * d'ancrage qu'on retrouve sans lire.
 *
 * CE QUE CES CAS GARDENT N'EST PAS LA JOLIESSE — elle ne se teste pas — mais
 * les deux règles SANS LESQUELLES le repère cesse d'aider :
 *
 * 1. IL EST SUR TOUTES LES CARTES. Une rangée où trois cartes sur quatre ont
 *    une tuile n'a pas trois quarts d'un système : elle a une exception, et
 *    l'œil s'arrête sur la carte dépareillée plutôt que sur celle qui compte.
 *    C'est la régression la plus probable de toutes — quelqu'un ajoute une
 *    cinquième carte, oublie `icone`, et rien ne le lui dit.
 *
 * 2. IL NE FABRIQUE PAS UNE SECONDE GRAMMAIRE DE COULEUR. Une carte en alerte
 *    a déjà une bordure rouge et une pastille rouge ; une tuile restée à la
 *    teinte d'accent au milieu se lirait comme une contradiction — et le
 *    lecteur qui distingue mal le rouge y verrait deux signaux qui se
 *    contredisent au lieu d'un.
 *
 * Les cas lisent `data-tuile`, jamais une classe : voir le commentaire de
 * `StatCard` pour les deux erreurs inverses qu'une assertion sur la teinte
 * commettrait.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/**
 * `releveIncomplet` : le relevé dont l'index courant manque.
 *
 * C'est la seule donnée du produit qui allume encore un état sur une rangée
 * d'indicateurs — celle de l'écran des relevés. Le tableau de bord n'en porte
 * plus depuis que sa file du jour a repris l'urgence, et la règle « le repère
 * suit l'état sans en fabriquer un second » n'a plus d'autre sujet où
 * s'observer. Le paramètre existe donc pour cette règle-là, et pour elle seule.
 */
function parcAvec(
  logement: { status: 'paid' | 'overdue'; paidMinor: number; overdueDays: number | null },
  releveIncomplet = false,
) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'bbbbbbbb-2222-4333-8444-555555555555',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: {
                id: 'dddddddd-2222-4333-8444-555555555555',
                fullName: 'Charles Ngassa',
                phoneE164: '+237677214408',
              },
              ...logement,
            },
          ],
        },
      ],
      works: [],
      deposits: [],
      readings: releveIncomplet
        ? [
            {
              unitId: 'bbbbbbbb-2222-4333-8444-555555555555',
              waterPrevious: 342,
              waterCurrent: null,
              powerPrevious: 4120,
              powerCurrent: null,
              readAt: null,
              unitPriceMinor: 520,
            },
          ]
        : [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

describe('le repère visuel des indicateurs', () => {
  it('est posé sur les quatre cartes du tableau de bord, sans exception', async () => {
    parcAvec({ status: 'paid', paidMinor: 145000, overdueDays: null })
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/taux d’occupation/i)

    // QUATRE, écrit en toutes lettres. Un compte « au moins un » passerait au
    // vert sur une rangée à moitié dépareillée, ce qui est exactement le défaut.
    expect(document.querySelectorAll('[data-tuile]')).toHaveLength(4)

    // Et chaque tuile porte bien UN glyphe : une tuile vide serait un carré de
    // couleur, c'est-à-dire du bruit.
    // `Array.from` et non `for...of` sur la `NodeList` : la cible de compilation
    // du dépôt n'itère pas les collections DOM sans `downlevelIteration`, et ce
    // n'est pas à un cas de test de faire bouger un réglage de compilateur.
    for (const tuile of Array.from(document.querySelectorAll('[data-tuile]'))) {
      expect(tuile.querySelectorAll('svg')).toHaveLength(1)
      // Décoratif, et il doit le rester : ce que la carte mesure est dit par son
      // intitulé. Un lecteur d'écran n'a que faire d'entendre « horloge » avant
      // « reste à percevoir ».
      expect(tuile.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  /**
   * LE CAS A CHANGÉ D'ÉCRAN, ET IL FAUT DIRE POURQUOI.
   *
   * Il s'observait sur le tableau de bord, dont la carte du reste à percevoir
   * portait un état `danger`. Cette carte n'en porte plus : la FILE DU JOUR qui
   * ouvre l'écran s'allume désormais sous la même condition, et deux rouges
   * pour un fait — le même chiffre, à deux cents pixels — étaient la « seconde
   * grammaire de couleur » que l'en-tête de ce fichier interdit.
   *
   * La règle vaut telle quelle sur l'écran des relevés, qui garde une carte en
   * état à côté de cartes qui renseignent. C'est le dernier endroit du produit
   * où une rangée d'indicateurs porte un état, donc le seul où la règle 2 peut
   * encore s'observer — et l'y déplacer plutôt que la retirer est ce qui
   * distingue une doctrine d'une assertion.
   */
  it('prend le ton de l’état plutôt que d’en ajouter un second', async () => {
    parcAvec({ status: 'overdue', paidMinor: 0, overdueDays: 24 }, true)
    await renderApp('/app/releves', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/relevé manquant pour la période/i)

    const carte = document.querySelector('[data-etat]')
    expect(carte, 'aucune carte en état sur les relevés').not.toBeNull()
    const ton = carte!.getAttribute('data-etat')
    expect(carte!.querySelector('[data-tuile]')).toHaveAttribute('data-tuile', ton!)

    // Les voisines restent neutres : un état qui déteint sur elles ne dit plus
    // laquelle appelle un geste.
    const teintees = Array.from(document.querySelectorAll('[data-tuile]')).filter(
      (tuile) => tuile.getAttribute('data-tuile') !== 'neutre',
    )
    expect(teintees).toHaveLength(1)
  })
})
