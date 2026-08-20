import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La comparaison entrée / sortie.
 *
 * Le badge « comparer entrée et sortie » promettait ce que l'écran ne montrait
 * pas : deux lignes et un NOMBRE de réserves. La donnée était pourtant saisie
 * depuis l'origine — pièce, description, gravité, coût — et la retenue proposée
 * sur la caution en dérivait déjà. Le locataire à qui l'on retient 91 000
 * pouvait lire la somme, jamais ce qui la compose.
 */

const tableau = () => screen.getByRole('table', { name: 'Comparaison entrée / sortie' })

/** La liste des dossiers, celle des logements et non celle des réserves. */
const dossiers = () => screen.getByRole('list', { name: 'États des lieux par logement' })

/**
 * Le dossier d'un logement, remonté depuis son titre PAR UN RÔLE.
 *
 * Première rédaction : `closest('div')` — qui s'arrêtait sur un div nu ne
 * contenant ni la pastille ni le tableau. La portée ne pouvait rien voir, et
 * l'assertion d'absence qu'elle portait ne pouvait pas échouer. Deuxième
 * rédaction : deux `parentElement` de plus, ce qui marchait — jusqu'à la
 * prochaine enveloppe ajoutée au rendu, qui l'aurait recassée en silence.
 *
 * Une chaîne d'ancêtres anonymes n'est pas une portée, c'est un pari sur la
 * profondeur du DOM. `closest` sur un RÔLE ne fait aucun pari : il remonte
 * jusqu'à la frontière du dossier, où qu'elle soit.
 */
const carte = (label: string) =>
  screen
    .getByRole('heading', { name: new RegExp(label) })
    .closest<HTMLElement>('[role="listitem"]')!

async function ouvrir() {
  renderApp('/demo/etats-des-lieux')
  await attendreLeChargement()
}

describe('comparaison entrée / sortie', () => {
  /**
   * Les dossiers s'annoncent COMME UNE LISTE, et le compte se dit.
   *
   * Ce cas garde le câblage d'accessibilité pour lui-même. Les autres cas s'y
   * adossent déjà — `carte()` remonte au `listitem` — donc casser le rôle les
   * fait tous tomber ; mais ils tomberaient pour une raison de plomberie, et
   * une plomberie se réécrit. Ce fichier l'a fait deux fois. À la troisième, le
   * contrat d'accessibilité perdrait son seul garde EN SILENCE.
   *
   * Une fonctionnalité gardée par accident n'est pas gardée.
   */
  it('annonce les dossiers comme une liste nommée de logements', async () => {
    await ouvrir()
    // Les éléments DIRECTS : chaque dossier porte aussi des listes de réserves
    // dans les cellules de son tableau, et une réserve n'est pas un dossier.
    const directs = within(dossiers())
      .getAllByRole('listitem')
      .filter((el) => el.parentElement === dossiers())
    expect(directs).toHaveLength(5)
    // Et ce sont bien LES logements du parc, pas cinq éléments quelconques.
    // Cinq dossiers, dont un seul — B4 — porte les deux documents : les cas
    // voisins ne nommaient que A1, B4 et C3, et leurs comptes globaux
    // tenaient A4 et A5 sans jamais les dire.
    for (const label of ['A1', 'B4', 'C3', 'A4', 'A5']) {
      expect(directs).toContain(carte(label))
    }
  })

  it('apparie les réserves par PIÈCE, et non par description', async () => {
    await ouvrir()
    // « Légère trace d'usure au sol » à l'entrée et « Parquet rayé sur deux
    // lames » à la sortie parlent du même endroit sans partager un mot : seule
    // la pièce les rapproche.
    const sejour = within(tableau()).getByRole('row', { name: /Séjour/ })
    expect(sejour).toHaveTextContent('Légère trace d’usure au sol')
    expect(sejour).toHaveTextContent('Parquet rayé sur deux lames')
    expect(sejour).toHaveTextContent('35 000')
  })

  /**
   * « Bon état » plutôt qu'une case vide : sur un tableau de comparaison, le
   * vide se lit comme une donnée manquante, alors qu'ici il dit quelque chose
   * de précis — rien n'était à signaler.
   */
  it('dit « bon état » là où l’entrée n’avait rien relevé', async () => {
    await ouvrir()
    const chambre = within(tableau()).getByRole('row', { name: /Chambre 2/ })
    expect(chambre).toHaveTextContent('Bon état')
    expect(chambre).toHaveTextContent('Vitre fêlée')
  })

  it('totalise la retenue proposée sur la caution', async () => {
    await ouvrir()
    // 35 000 + 20 000 + 18 000 + 6 000 + 12 000 = 91 000. La plaque de cuisson
    // rayée ne coûte rien : une réserve n'est pas nécessairement imputée.
    expect(screen.getByText('Retenue proposée sur la caution').parentElement).toHaveTextContent(
      '91 000',
    )
  })

  /**
   * Une réserve peut ne rien coûter, et la ligne doit le dire.
   *
   * Une cellule vide se lirait comme un montant qu'on a oublié de porter, sur
   * un tableau dont la dernière colonne est précisément ce qu'on oppose au
   * locataire.
   */
  it('marque explicitement une réserve non imputée', async () => {
    await ouvrir()
    const cuisine = within(tableau()).getByRole('row', { name: /Cuisine/ })
    expect(cuisine).toHaveTextContent('Plaque de cuisson rayée')
    expect(cuisine).toHaveTextContent('—')
  })

  /**
   * Un seul document ne se compare à rien.
   *
   * A1 n'a qu'une entrée : dresser le tableau y montrerait une colonne de
   * sortie entièrement vide, ce qui se lit comme un état des lieux bâclé plutôt
   * que comme un locataire encore en place.
   */
  it('ne compare rien là où un seul état des lieux existe', async () => {
    await ouvrir()
    // UNE seule comparaison sur tout le parc : B4 est le seul logement à porter
    // les deux documents. A1 n'a qu'une entrée, C3 qu'une sortie — et la
    // première rédaction de ce cas en attendait deux, ce qui aurait laissé
    // passer un tableau dressé sur un document unique.
    expect(screen.getAllByRole('table', { name: 'Comparaison entrée / sortie' })).toHaveLength(1)
    expect(within(carte('A1')).queryByRole('table')).toBeNull()
    expect(within(carte('C3')).queryByRole('table')).toBeNull()
    expect(
      within(carte('B4')).getByRole('table', { name: 'Comparaison entrée / sortie' }),
    ).toBeInTheDocument()
  })

  /**
   * La pastille s'éteint là où le tableau ne se dresse pas.
   *
   * Elle annonce « Entrée et sortie » : sur un logement qui n'en porte qu'un
   * seul, elle promet une comparaison que la carte ne montre pas — le décalage
   * même que ce chantier poursuit. Elle partage la garde du tableau, mais
   * personne ne la regardait : la supprimer de cette garde ne faisait rougir
   * aucun test de la suite, dans aucun fichier.
   *
   * Le cas positif compte autant que le négatif. Sans lui, retirer la pastille
   * pour de bon resterait muet à son tour.
   */
  it('n’allume la pastille que là où les deux documents existent', async () => {
    await ouvrir()
    // UNE seule sur tout le parc, comme un seul tableau : A1 n'a qu'une
    // entrée, C3 qu'une sortie.
    expect(screen.getAllByText('Entrée et sortie')).toHaveLength(1)
    expect(within(carte('B4')).getByText('Entrée et sortie')).toBeInTheDocument()
    expect(within(carte('A1')).queryByText('Entrée et sortie')).toBeNull()
    expect(within(carte('C3')).queryByText('Entrée et sortie')).toBeNull()
  })
})

/**
 * Sur un parc dont le serveur ne rend pas le détail — une version antérieure —
 * l'écran reste ce qu'il était : deux lignes et leur compte de réserves.
 * Dresser un tableau vide sous un badge qui promet une comparaison serait pire
 * que de ne rien promettre.
 */
describe('comparaison — sans détail servi', () => {
  const PARC = '11111111-2222-4333-8444-555555555555'
  const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

  function sessionProprietaire(): EtatSession {
    return {
      statut: 'connecte',
      compte: COMPTE_FICTIF,
      adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
    }
  }

  it('garde le compte des réserves et ne dresse aucun tableau', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
                id: UNITE,
                label: 'B7',
                type: 'T2',
                surfaceSqm: 52,
                rentMinor: 90000,
                tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
                status: 'paid',
                leaseId: 'bail-1',
                leaseStartsOn: '2024-03-01T00:00:00.000Z',
                paidMinor: 90000,
                overdueDays: null,
              },
            ],
          },
        ],
        works: [],
        deposits: [],
        readings: [],
        // Les deux natures, mais aucun détail : c'est ce que rendait le serveur
        // avant ce chantier.
        inspections: [
          {
            id: 'edl-1',
            unitId: UNITE,
            kind: 'entry',
            performedOn: '2024-03-01T00:00:00.000Z',
            rooms: 3,
            issues: 2,
            signedAt: '2024-03-01T00:00:00.000Z',
          },
          {
            id: 'edl-2',
            unitId: UNITE,
            kind: 'exit',
            performedOn: '2026-07-01T00:00:00.000Z',
            rooms: 3,
            issues: 4,
            signedAt: null,
          },
        ],
        notifications: [],
      },
    })

    renderApp('/app/etats-des-lieux', { session: sessionProprietaire() })
    await attendreLeChargement()

    expect(screen.queryByRole('table', { name: 'Comparaison entrée / sortie' })).toBeNull()
    // Le compte, lui, reste : c'est ce que l'écran a toujours montré.
    expect(screen.getByRole('main')).toHaveTextContent('4 réserves')
  })
})

/**
 * Le coût d'une réserve d'ENTRÉE n'entre jamais dans la retenue.
 *
 * C'est la règle qui donne son sens à l'état des lieux d'entrée : il relève ce
 * qui est déjà abîmé précisément pour que le locataire n'en réponde pas. Le
 * serveur refuse la saisie en 422 — mais l'écran totalise ce qu'on lui envoie,
 * et une donnée héritée, importée ou forgée le ferait facturer au locataire les
 * dégâts du précédent.
 *
 * Ce cas est né d'une mutation qui ne mordait pas : ajouter les réserves
 * d'entrée au total ne changeait rien, parce qu'aucune n'en porte dans le jeu
 * de démonstration. L'invariant n'était donc gardé par personne.
 */
describe('comparaison — un coût porté par une entrée', () => {
  const PARC = '22222222-3333-4444-8555-666666666666'
  const UNITE = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

  it('l’affiche dans sa colonne, mais l’exclut de la retenue proposée', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
                id: UNITE,
                label: 'B7',
                type: 'T2',
                surfaceSqm: 52,
                rentMinor: 90000,
                tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
                status: 'paid',
                leaseId: 'bail-1',
                leaseStartsOn: '2024-03-01T00:00:00.000Z',
                paidMinor: 90000,
                overdueDays: null,
              },
            ],
          },
        ],
        works: [],
        deposits: [],
        readings: [],
        inspections: [
          {
            id: 'edl-1',
            unitId: UNITE,
            leaseId: 'bail-1',
            kind: 'entry',
            performedOn: '2024-03-01T00:00:00.000Z',
            rooms: 3,
            issues: 1,
            // 999 000 sur une ENTRÉE : la donnée que le serveur refuse d'écrire.
            findings: [
              {
                id: 'f1',
                room: 'Séjour',
                description: 'Mur déjà fissuré à la remise des clés',
                severity: 'major',
                costMinor: 999000,
              },
            ],
            signedAt: '2024-03-01T00:00:00.000Z',
          },
          {
            id: 'edl-2',
            unitId: UNITE,
            leaseId: 'bail-1',
            kind: 'exit',
            performedOn: '2026-07-01T00:00:00.000Z',
            rooms: 3,
            issues: 1,
            findings: [
              {
                id: 'f2',
                room: 'Séjour',
                description: 'Fissure agrandie',
                severity: 'major',
                costMinor: 30000,
              },
            ],
            signedAt: null,
          },
        ],
        notifications: [],
      },
    })

    renderApp('/app/etats-des-lieux', {
      session: {
        statut: 'connecte',
        compte: COMPTE_FICTIF,
        adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
      },
    })
    await attendreLeChargement()

    const total = screen.getByText('Retenue proposée sur la caution').parentElement!
    expect(total).toHaveTextContent('30 000')
    expect(total).not.toHaveTextContent('999 000')
    expect(total).not.toHaveTextContent('1 029 000')
  })
})
