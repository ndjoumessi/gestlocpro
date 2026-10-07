import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LES RELEVÉS D'UN MOIS, LUS CONTRE LES UNITÉS D'UN AUTRE.
 *
 * ═══ LA SECONDE ROUTE VERS DES RELEVÉS ORPHELINS ═══
 *
 * La première a été refermée avec la garde du stockage de démonstration : un
 * parc réel partait dans `localStorage`, et `/demo` le relisait sous les dix
 * relevés du jeu fictif. Celle-ci n'a rien à voir avec la démonstration, et
 * elle vit sur un parc RÉEL.
 *
 * `Meters` lit DEUX réponses et n'en garde qu'une moitié de chacune :
 *
 *   · `relevesDUnAutreMois` vient de `chargerParc(parkId, mois)` — la réponse
 *     DATÉE, celle du mois choisi ;
 *   · `unitById` vient de `usePortfolio()`, c'est-à-dire de la réponse que le
 *     fournisseur a lue À SON MONTAGE, sans mois.
 *
 * LA RÉPONSE DATÉE PORTE SES UNITÉS, ET L'ÉCRAN LES JETAIT. `chargerParc` rend
 * un portefeuille entier : `parc.units` est là, à côté de `parc.readings`, lu
 * au même instant et sous le même périmètre. L'écran n'en prenait que les
 * relevés et allait chercher les libellés dans l'autre réponse.
 *
 * ═══ CE QUI N'EST PAS EN CAUSE, ET IL FAUT LE DIRE ═══
 *
 * LE SERVEUR NE PEUT PAS RENDRE UN ORPHELIN. Dans `GET /portfolio`, les unités
 * et les relevés passent les MÊMES deux filtres de périmètre — `perimetreUnite`
 * et les unités visibles — et la borne du mois ne s'applique qu'aux relevés,
 * jamais aux unités. Un relevé rendu appartient donc toujours à une unité
 * rendue, dans la MÊME réponse. Le désalignement naît de la rencontre de deux
 * réponses, pas d'une réponse.
 *
 * ═══ CE QUI LES FAIT DIVERGER, ET C'EST BANAL ═══
 *
 * Le fournisseur ne relit pas le parc quand on change de mois — `parcAffiche`
 * garde l'attente fermée tant que le parc ne change pas, et c'est voulu. Sa
 * réponse date donc du montage, et le parc, lui, vit : le propriétaire ajoute
 * un logement, le gestionnaire y relève un compteur, et la réponse datée
 * connaît un logement que celle du montage n'avait pas. Deux personnes sur un
 * parc suffisent, sans qu'aucune ne fasse rien d'anormal.
 *
 * C'est ce que ce cas met en scène, et c'est la forme la moins contestable du
 * désalignement : l'écart n'est pas une panne, c'est du temps qui passe.
 */

const PARC = '33333333-4444-4999-8aaa-cccccccccccc'
const MOIS_PASSE = '2026-07'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Un logement, réduit à ce que la réponse du portefeuille porte de lui. */
function unite(id: string, label: string) {
  return {
    id,
    label,
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    paidMinor: 185000,
    status: 'paid',
    overdueDays: null,
    leaseId: `bail-${id}`,
    leaseStartsOn: '2026-01-01',
    tenant: { id: `loc-${id}`, fullName: `Occupant de ${label}`, phoneE164: '+237677214408' },
  }
}

/** Les deux fluides d'un logement pour une période, index antérieur compris. */
function relevesDe(unitId: string, periodStart: string, eau: number, courant: number) {
  return [
    {
      unitId,
      utility: 'water' as const,
      id: `${unitId}-eau`,
      periodStart,
      indexValue: eau + 16,
      previousIndex: eau,
      readAt: periodStart,
      unitPriceMinor: 520,
    },
    {
      unitId,
      utility: 'power' as const,
      id: `${unitId}-elec`,
      periodStart,
      indexValue: courant + 120,
      previousIndex: courant,
      readAt: periodStart,
      unitPriceMinor: 99,
    },
  ]
}

function corps(unites: ReturnType<typeof unite>[], releves: unknown[]) {
  return {
    collections: [],
    buildings: [{ id: 'imm-1', name: 'Résidence Essos', district: 'Essos', units: unites }],
    works: [],
    deposits: [],
    readings: releves,
    inspections: [],
    notifications: [],
    leaseCharges: [],
  }
}

/**
 * Le parc tel qu'il était au montage, et tel qu'il est au mois demandé.
 *
 * A1 est dans les deux ; B7 n'est QUE dans la réponse datée — il a été créé
 * après que le fournisseur a lu le parc, et son compteur a été relevé depuis.
 * C'est le couple qui fait le cas : sur deux réponses identiques, « l'écran lit
 * ses unités dans le même mois que ses relevés » passerait au vert sur un écran
 * qui ne les lit nulle part.
 */
function parcQuiAGrandiDepuisLeMontage() {
  const serveur = installerFauxServeur()

  // La réponse du MONTAGE : un seul logement, relevé en août.
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: corps([unite('u-1', 'A1')], relevesDe('u-1', '2026-08-01', 342, 1180)),
  })

  // La réponse DATÉE : le parc en porte deux, et les deux sont relevés.
  serveur.quand('GET', `/parks/${PARC}/portfolio?mois=${MOIS_PASSE}`, {
    status: 200,
    body: corps(
      [unite('u-1', 'A1'), unite('u-2', 'B7')],
      [
        ...relevesDe('u-1', '2026-07-01', 324, 1060),
        ...relevesDe('u-2', '2026-07-01', 415, 2210),
      ],
    ),
  })

  return serveur
}

const principal = () => screen.getByRole('main')

/**
 * Les libellés d'unité du tableau, tels que l'œil les lit.
 *
 * LE PREMIER `span` DE CHAQUE EN-TÊTE DE RANGÉE, et pas tous : la cellule
 * d'identité en porte deux — le logement, puis son occupant. Une première
 * rédaction les prenait tous et rendait « A1, Occupant de A1 », ce qui aurait
 * fait passer le cas négatif pour un défaut.
 */
function libellesDesLignes() {
  return Array.from(principal().querySelectorAll('tbody tr th'))
    .map((th) => th.querySelector('span')?.textContent?.trim() ?? '')
    .filter((t) => t !== '')
}

/**
 * Attend que la SECONDE rangée paraisse, celle de B7.
 *
 * Le point d'attente est choisi pour être vrai AVANT la correction : le tableau
 * affiche déjà les deux relevés du mois demandé — c'est le libellé de leur
 * logement qui manque. Attendre « B7 » ferait échouer les cas sur leur attente
 * plutôt que sur leur sujet, et un cas rouge sur son échafaudage n'atteste rien
 * du produit.
 *
 * ET PAS SUR L'INDEX : une première rédaction attendait « 431 », que le DOM ne
 * porte pas seul — la cellule rend « 16 415→431 » d'un trait, flèche comprise.
 */
function attendreLesDeuxRangees() {
  return waitFor(() =>
    expect(principal().querySelectorAll('tbody tr')).toHaveLength(2),
  )
}

describe('les relevés et les unités viennent du même mois', () => {
  it('nomme un logement que seule la réponse datée connaît', async () => {
    parcQuiAGrandiDepuisLeMontage()
    await renderApp(`/app/releves?mois=${MOIS_PASSE}`, { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    /* On attend la réponse DATÉE, et non le seul chargement du fournisseur : ce
       sont deux allers-retours. La seconde rangée n'existe que dans la réponse
       datée — sa présence atteste donc que la lecture datée a eu lieu, sans
       quoi le cas passerait au vert sur un écran resté en août, qui n'a qu'une
       rangée et aucun orphelin à montrer. */
    await attendreLesDeuxRangees()

    /* LE CŒUR DU CAS. « Logement inconnu » est le nom que le lot du symptôme a
       donné au manque, le 2026-10-07. Il est juste quand le parc ignore
       vraiment l'unité ; il est FAUX ici, où la réponse qui porte le relevé
       porte aussi le logement, deux champs plus loin. */
    expect(
      within(principal()).queryAllByText('Logement inconnu'),
      'la réponse datée nomme ce logement : l’écran ne doit pas avouer l’ignorer',
    ).toHaveLength(0)

    expect(libellesDesLignes()).toEqual(['A1', 'B7'])
  })

  it('n’affiche « Aucun locataire » sur aucun des deux logements', async () => {
    parcQuiAGrandiDepuisLeMontage()
    await renderApp(`/app/releves?mois=${MOIS_PASSE}`, { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    await attendreLesDeuxRangees()

    /*
      LA SECONDE CELLULE, ET ELLE SE PERD AUTREMENT QUE LA PREMIÈRE.

      Le libellé manquant se voyait ; le locataire manquant se lit comme un
      FAIT — « ce logement est vide » — alors que la réponse datée nomme son
      occupant. C'est la cellule la plus trompeuse des deux : un vide avoué
      interroge, une vacance affirmée se croit.
    */
    expect(
      within(principal()).queryAllByText('Aucun locataire'),
      'les deux logements sont occupés dans la réponse qui porte leurs relevés',
    ).toHaveLength(0)
    /* `getAllByText` : la cellule d'identité porte DEUX copies du nom, celle de
       la forme étroite et celle de la forme large — c'est la règle « deux
       formes, un seul nom » de ce produit, pas un doublon. */
    expect(within(principal()).getAllByText('Occupant de B7').length).toBeGreaterThan(0)
  })

  it('relâche les unités datées quand on revient au mois du fournisseur', async () => {
    /*
      LE CAS NÉGATIF, ET IL A FALLU LE RÉÉCRIRE POUR QU'IL GARDE QUELQUE CHOSE.

      La correction consiste à tenir les unités de la réponse datée en RENFORT.
      Un renfort qui ne se relâche pas vaut une fuite : l'écran garderait les
      logements de juillet au-dessus des relevés d'août, et nommerait un
      logement que le mois affiché ne porte pas.

      PREMIÈRE RÉDACTION, ET POURQUOI ELLE NE VALAIT RIEN : elle ouvrait l'écran
      directement sur le mois du fournisseur. `moisLu` n'y est jamais posé —
      aucune lecture datée n'a lieu — donc le cas restait vert même en RETIRANT
      le `setMoisLu(null)` qui le relâche. Témoin passé, mutation posée, trois
      cas verts : il n'éprouvait rien. Le relâchement ne se voit que sur la
      TRANSITION, et la transition demande le vrai geste.
    */
    parcQuiAGrandiDepuisLeMontage()
    await renderApp(`/app/releves?mois=${MOIS_PASSE}`, { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    await attendreLesDeuxRangees()
    expect(libellesDesLignes(), 'juillet porte les deux logements').toEqual(['A1', 'B7'])

    // Le geste réel : ouvrir le sélecteur de période et choisir août, le mois
    // du fournisseur. L'adresse perd alors `?mois`, et la lecture datée tombe.
    const utilisateur = userEvent.setup()
    await utilisateur.click(screen.getByRole('button', { name: /Période relevée/i }))
    await utilisateur.click(screen.getByRole('button', { name: 'août' }))

    await waitFor(() =>
      expect(principal().querySelectorAll('tbody tr')).toHaveLength(1),
    )
    expect(libellesDesLignes(), 'août ne connaît que A1').toEqual(['A1'])
    expect(
      within(principal()).queryByText('B7'),
      'le renfort de juillet ne doit pas survivre à août',
    ).toBeNull()
  })
})
