import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, waitFor, within, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE LOCATAIRE VOIT LES PREUVES QUI LE CONCERNENT.
 *
 * La photo d'une réserve est la pièce qui sert à RETENIR sur une caution. Elle
 * était déposée par le bailleur et servie au seul bailleur : la personne dont
 * on arbitre la caution ne pouvait pas regarder ce qu'on lui opposait.
 *
 * CE QUE CES CAS NE GARDENT PAS, et il faut le dire : le CLOISONNEMENT lui-même
 * n'est pas ici. Il vit dans la requête du serveur — `etatsDesLieuxVisibles` —
 * et `server/src/parks/routes.test.ts` le mesure, y compris le cas neuf : une
 * photo d'un AUTRE bail sur SA PROPRE unité rend 404. Un test d'écran qui
 * fabriquerait sa propre réponse ne prouverait rien de la frontière, puisqu'il
 * l'aurait tracée lui-même. Ce qui se mesure ici, c'est ce que l'écran FAIT de
 * ce que le serveur veut bien rendre.
 */

const PARC = 'parc-preuves'
const U1 = 'unite-preuves'
const PHOTO = 'photo-preuve-1'

function session(role: 'tenant' | 'owner' = 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc preuves', currency: 'XAF' }],
  }
}

/** Une réserve, avec ou sans preuve attachée. */
function reserve(photos: { id: string }[]) {
  return {
    id: 'reserve-1',
    room: 'Salle de bain',
    description: 'Joint de douche noirci',
    severity: 'minor' as const,
    costMinor: null,
    photos: photos.map((p) => ({
      id: p.id,
      contentType: 'image/jpeg',
      confirmedAt: '2026-02-01T10:00:00.000Z',
    })),
  }
}

function portefeuille(faux: FauxServeur, photos: { id: string }[]) {
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence',
          district: 'Essos',
          units: [
            {
              id: U1,
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: { id: 'loc-A1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-A1',
              leaseStartsOn: '2024-01-01T00:00:00.000Z',
              paidMinor: 145000,
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
          id: 'etat-1',
          unitId: U1,
          leaseId: 'bail-A1',
          kind: 'entry',
          performedOn: '2026-02-01T00:00:00.000Z',
          rooms: 3,
          issues: 1,
          findings: [reserve(photos)],
          signedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      notifications: [],
    },
  })
}

/** Le bloc « Preuves » du seul constat de l'écran. */
function bloc() {
  return screen.getByText('Preuves').closest('div')!
}

describe('les preuves que le locataire voit', () => {
  /**
   * LA VIGNETTE VIENT D'UNE ADRESSE DEMANDÉE, pas d'un champ du portefeuille.
   *
   * Le seau n'est jamais public : l'adresse est signée et périme en quelques
   * minutes. La sceller dans le portefeuille — qui vit en mémoire des heures —
   * la rendrait morte avant d'être affichée. Le cas exige donc l'APPEL, et pas
   * seulement l'image.
   */
  it('demande l’adresse de la photo et l’affiche sous le constat', async () => {
    const faux = installerFauxServeur()
    portefeuille(faux, [{ id: PHOTO }])
    faux.quand('GET', `/parks/${PARC}/photos/${PHOTO}`, {
      status: 200,
      body: { photo: { id: PHOTO }, lecture: { url: 'https://depot/essai.jpg', expireLe: 0 } },
    })

    await renderApp('/app/etats-des-lieux', { session: session() })
    await attendreLeChargement()

    const image = await within(bloc()).findByRole('img')
    expect(image).toHaveAttribute('src', 'https://depot/essai.jpg')
    // Le texte de remplacement porte le CONSTAT : « photo 1 sur 1 » seul ne
    // dirait rien à qui ne voit pas l'image.
    expect(image).toHaveAccessibleName(/Joint de douche noirci/)
    expect(
      faux.appels.some((a) => a.chemin === `/parks/${PARC}/photos/${PHOTO}`),
    ).toBe(true)

    // La réserve est NOMMÉE au-dessus de sa preuve : une vignette seule ne dit
    // pas de quoi elle est la preuve, et c'est la seule chose qui compte quand
    // on conteste.
    expect(within(bloc()).getByText(/Salle de bain · Joint de douche noirci/)).toBeInTheDocument()
  })

  /**
   * UN REFUS SE DIT, il ne se tait pas.
   *
   * Le serveur rend 404 sur tout ce qui sort du bail — y compris sur le propre
   * logement du locataire. Une case vide se lirait comme une photo qu'on a
   * oublié d'afficher ; sur l'écran qui fonde une retenue, c'est le pire
   * endroit où laisser un doute.
   */
  it('dit que la photo est indisponible quand le serveur refuse l’adresse', async () => {
    const faux = installerFauxServeur()
    portefeuille(faux, [{ id: PHOTO }])
    faux.quand('GET', `/parks/${PARC}/photos/${PHOTO}`, {
      status: 404,
      body: { error: 'not_found' },
    })

    await renderApp('/app/etats-des-lieux', { session: session() })
    await attendreLeChargement()

    expect(await within(bloc()).findByText('Photo indisponible')).toBeInTheDocument()
    expect(within(bloc()).queryByRole('img')).not.toBeInTheDocument()
  })

  /**
   * IL REGARDE, IL NE DÉPOSE PAS.
   *
   * Le serveur garde les trois routes d'écriture derrière `exigerRole` ; l'écran
   * ne doit pas non plus PROPOSER le geste. Un bouton qui rendrait 403 n'offre
   * pas un choix, il fabrique une erreur.
   */
  it('n’offre aucune commande au locataire, ni sur la preuve ni sur l’écran', async () => {
    const faux = installerFauxServeur()
    portefeuille(faux, [{ id: PHOTO }])
    faux.quand('GET', `/parks/${PARC}/photos/${PHOTO}`, {
      status: 200,
      body: { photo: { id: PHOTO }, lecture: { url: 'https://depot/essai.jpg', expireLe: 0 } },
    })

    await renderApp('/app/etats-des-lieux', { session: session() })
    await attendreLeChargement()
    await within(bloc()).findByRole('img')

    // Aucune commande DANS le bloc des preuves : ni plein écran, ni retrait.
    expect(within(bloc()).queryAllByRole('button')).toHaveLength(0)
    expect(within(bloc()).queryAllByRole('link')).toHaveLength(0)
    // Et pas davantage la commande d'établissement, qui n'a jamais été la sienne.
    expect(screen.queryByRole('button', { name: /établir un état des lieux/i })).toBeNull()
    // Aucune requête d'écriture n'est partie.
    expect(faux.appels.every((a) => a.methode === 'GET')).toBe(true)
  })

  /**
   * PAS DE RUBRIQUE SANS CONTENU.
   *
   * « Preuves » posé au-dessus d'un vide annoncerait des photographies qui
   * n'existent pas — le défaut que l'écran des documents refuse déjà de faire
   * avec ses « Télécharger » morts.
   */
  it('n’annonce pas de rubrique « Preuves » quand la réserve n’en porte aucune', async () => {
    const faux = installerFauxServeur()
    portefeuille(faux, [])

    await renderApp('/app/etats-des-lieux', { session: session() })
    await attendreLeChargement()

    // Le constat est bien là — c'est la rubrique, et elle seule, qui manque.
    expect(screen.getByText('1 réserve')).toBeInTheDocument()
    expect(screen.queryByText('Preuves')).not.toBeInTheDocument()
    expect(faux.appels.some((a) => a.chemin.includes('/photos/'))).toBe(false)
  })

  /**
   * LA DÉMONSTRATION PORTE UNE PREUVE — ET C'EST CE QUI REND CE BLOC MESURABLE.
   *
   * `mesure-ui` balaie `/demo`, jamais `/app`. Tant que le jeu de démonstration
   * ne portait aucune photo, ce bloc n'existait sur AUCUN des 506 points
   * mesurés : ni contraste, ni cible 44 px, ni nom accessible. C'était mesuré,
   * pas supposé — un bouton de 32 px posé ici laissait la porte verte.
   *
   * Ce cas garde la CHAÎNE qui referme le trou : la réserve d'A1 porte une
   * photo, `lirePhoto` la résout dans le registre local, et l'image est INLINÉE
   * — donc aucune requête. La dernière assertion est celle qui compte pour
   * `poids-ecrans`, qui refuse tout aller-retour de plus.
   */
  it('sert les preuves de la démonstration sans aucune requête', async () => {
    const faux = installerFauxServeur()
    await renderApp('/demo/etats-des-lieux')
    await attendreLeChargement()
    await switchRole('tenant')

    /**
     * TROIS, et le nombre est le sujet du cas.
     *
     * Une seule vignette ne fait pas de rangée : le repli (`flex-wrap`) n'est
     * rendu qu'à partir de trois, et ce qui n'est jamais rendu n'est jamais
     * mesuré. Ces trois-là sont ce qui met `mesure-ui` en position de voir la
     * rangée déborder à 320 px.
     */
    await waitFor(() => expect(within(bloc()).getAllByRole('img')).toHaveLength(3))
    const images = within(bloc()).getAllByRole('img')

    for (const image of images) {
      expect(image.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/)
    }
    // TROIS SOURCES DISTINCTES : la même image resservie trois fois serait un
    // faux, et une garde qui compte sans regarder ne l'aurait pas vu.
    expect(new Set(images.map((i) => i.getAttribute('src'))).size).toBe(3)

    // Le rang est DIT, sans quoi trois vignettes s'annoncent trois fois pareil.
    expect(images[0]).toHaveAccessibleName(/1 sur 3.*Peinture écaillée derrière la porte/)
    expect(images[2]).toHaveAccessibleName(/3 sur 3/)

    // Aucune adresse demandée au réseau : les images sont dans le paquet.
    expect(faux.appels.some((a) => a.chemin.includes('/photos/'))).toBe(false)
  })

  /**
   * LE BAILLEUR VOIT LA MÊME CHOSE, et c'est voulu : c'est lui qui a déposé la
   * pièce, et il doit pouvoir relire ce qu'il pourra produire. Le lot n'ouvre
   * pas une vue de locataire à part — il ouvre la MÊME vue à une personne de
   * plus, ce qui est exactement ce qui empêche les deux de diverger.
   */
  it('montre la même preuve au bailleur', async () => {
    const faux = installerFauxServeur()
    portefeuille(faux, [{ id: PHOTO }])
    faux.quand('GET', `/parks/${PARC}/photos/${PHOTO}`, {
      status: 200,
      body: { photo: { id: PHOTO }, lecture: { url: 'https://depot/essai.jpg', expireLe: 0 } },
    })

    await renderApp('/app/etats-des-lieux', { session: session('owner') })
    await attendreLeChargement()

    expect(await within(bloc()).findByRole('img')).toHaveAttribute(
      'src',
      'https://depot/essai.jpg',
    )
  })
})
