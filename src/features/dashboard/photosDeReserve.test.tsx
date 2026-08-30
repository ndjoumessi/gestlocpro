import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, screen, userEvent, waitFor, within, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Transcodage } from '@/lib/transcoderPhoto'

/**
 * LES PHOTOS D'UNE RÉSERVE, VUES DE L'ÉCRAN.
 *
 * `scripts/photo-transcodage.mjs` garde la FONCTION dans un vrai navigateur ;
 * ces cas-ci gardent ce que l'écran en FAIT, et ce ne sont pas les mêmes
 * questions. Le transcodage est donc simulé : jsdom n'a ni `createImageBitmap`
 * ni `canvas.toBlob`, et le simuler ici ne prétend rien mesurer — ce qui est
 * mesuré, c'est quel blob l'écran affiche, ce qu'il dit d'un refus, et ce
 * qu'il fait quand une jonction du réseau casse.
 */

const { transcoderPhoto } = vi.hoisted(() => ({ transcoderPhoto: vi.fn() }))

vi.mock('@/lib/transcoderPhoto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/transcoderPhoto')>()),
  transcoderPhoto,
}))

const PARC = 'parc-photo'
const U1 = 'unite-photo-1'
const dialogue = () => screen.getByRole('dialog')

/** Le blob que le transcodage est censé rendre — reconnaissable à sa taille. */
const OCTETS_TRANSCODES = new Blob([new Uint8Array(1234)], { type: 'image/jpeg' })
/** Le fichier CHOISI, volontairement plus gros : c'est ce qu'on ne doit pas voir. */
const FICHIER_ORIGINAL = new File([new Uint8Array(99_999)], 'photo.jpg', { type: 'image/jpeg' })

const succes: Transcodage = {
  transcode: true,
  octets: OCTETS_TRANSCODES,
  largeur: 900,
  hauteur: 1600,
  typeMime: 'image/jpeg',
}

/**
 * jsdom n'implémente pas les URL d'objet — même raison que `lib/download`.
 * L'espion est ce qui rend la première question mesurable : de QUEL blob
 * l'aperçu est-il fait ?
 */
let urlsCreees: (Blob | MediaSource)[] = []
let urlsRevoquees: string[] = []

beforeEach(() => {
  urlsCreees = []
  urlsRevoquees = []
  URL.createObjectURL = vi.fn((objet: Blob | MediaSource) => {
    urlsCreees.push(objet)
    return `blob:essai/${urlsCreees.length}`
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    urlsRevoquees.push(url)
  })
  transcoderPhoto.mockResolvedValue(succes)
})

afterEach(() => {
  vi.clearAllMocks()
})

function session(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc photo', currency: 'XAF' }],
  }
}

async function ouvrirLaModale() {
  const faux = installerFauxServeur()
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
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
              tenant: { id: 'loc-B7', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-B7',
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
      inspections: [],
      notifications: [],
    },
  })
  const user = userEvent.setup()
  await renderApp('/app/etats-des-lieux', { session: session() })
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: /établir un état des lieux/i }))
  return { user, faux }
}

async function choisir(user: ReturnType<typeof userEvent.setup>, fichier = FICHIER_ORIGINAL) {
  const entree = dialogue().querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(entree, fichier)
}

describe('les photos d’une réserve', () => {
  /**
   * L'APERÇU VIENT DU BLOB TRANSCODÉ, JAMAIS DE L'ORIGINAL.
   *
   * Un original de téléphone pèse quelques mégaoctets ; huit d'entre eux tenus
   * en vie pour afficher huit vignettes font tuer l'onglet par le système sur
   * un appareil d'entrée de gamme — et l'onglet tué emporte l'état des lieux
   * en cours de saisie, pas seulement les vignettes.
   *
   * Le cas ne compare pas des tailles « à peu près » : il exige l'IDENTITÉ du
   * blob rendu par le transcodage. Comparer des octets laisserait passer un
   * troisième blob de la bonne taille, et c'est le genre de garde qui rassure
   * sans rien tenir.
   */
  it('bâtit l’aperçu sur le blob transcodé, pas sur le fichier choisi', async () => {
    const { user } = await ouvrirLaModale()
    await choisir(user)

    await waitFor(() => expect(urlsCreees.length).toBe(1))
    expect(urlsCreees[0]).toBe(OCTETS_TRANSCODES)
    expect(urlsCreees[0]).not.toBe(FICHIER_ORIGINAL)
  })

  /** Retirer une photo LIBÈRE son URL : sans cela le blob reste vivant. */
  it('libère l’URL d’objet quand la photo est retirée', async () => {
    const { user } = await ouvrirLaModale()
    await choisir(user)
    await waitFor(() => expect(urlsCreees.length).toBe(1))

    await user.click(within(dialogue()).getByRole('button', { name: /retirer la photo 1/i }))

    expect(urlsRevoquees).toContain('blob:essai/1')
  })

  /**
   * LE REFUS HEIC DIT QUOI FAIRE.
   *
   * « Format non pris en charge » laisse l'utilisateur devant un appareil
   * qu'il ne sait pas régler, au milieu d'un logement vide. Le chemin exact du
   * réglage iOS le débloque en trente secondes — c'est la différence entre un
   * message et une aide.
   */
  it('dit comment régler l’iPhone quand la photo est en HEIC', async () => {
    transcoderPhoto.mockResolvedValue({ transcode: false, motif: 'heic' } satisfies Transcodage)
    const { user } = await ouvrirLaModale()
    await choisir(user)

    const message = await within(dialogue()).findByText(/HEIC/)
    expect(message).toHaveTextContent(/Réglages/)
    expect(message).toHaveTextContent(/Le plus compatible/)
    // Aucune vignette : rien n'a été transcodé, et prétendre le contraire
    // laisserait croire la photo jointe.
    expect(within(dialogue()).queryByRole('img')).not.toBeInTheDocument()
  })

  /**
   * UNE CONFIRMATION QUI ÉCHOUE NE SE TAIT PAS.
   *
   * C'est la jonction la plus coûteuse de la chaîne : les octets sont MONTÉS,
   * donc payés au gigaoctet-mois, et la réserve ne les porte pas. Fermer la
   * modale à ce moment perd les blobs et laisse l'objet orphelin.
   *
   * L'écran doit donc : garder la modale ouverte, écrire l'échec là où il
   * reste lisible, et offrir la reprise — pas un toast qui s'efface pendant
   * que la donnée disparaît.
   */
  it('dit l’échec de la confirmation, et garde la modale ouverte', async () => {
    const { user, faux } = await ouvrirLaModale()

    faux.quand('POST', `/parks/${PARC}/units/${U1}/inspections`, {
      status: 201,
      body: {
        inspection: {
          findings: [
            {
              id: 'reserve-1',
              room: 'Séjour',
              description: 'Mur défoncé sur un mètre.',
              severity: 'minor',
              costMinor: null,
            },
          ],
        },
      },
    })
    faux.quand('POST', `/parks/${PARC}/findings/reserve-1/photos`, {
      status: 201,
      body: {
        photo: { id: 'photo-1' },
        // Sans chaîne de requête : la double apparie le chemin tel quel.
        envoi: {
          url: '/api/parks/stockage-local/depot-de-test',
          methode: 'PUT',
          entetes: { 'Content-Type': 'image/jpeg' },
        },
      },
    })
    faux.quand('PUT', '/parks/stockage-local/depot-de-test', { status: 200, body: {} })
    faux.quand('POST', `/parks/${PARC}/photos/photo-1/confirmation`, {
      status: 500,
      body: { error: 'boom' },
    })

    await user.type(within(dialogue()).getByLabelText(/^pièce$/i), 'Séjour')
    await user.type(
      within(dialogue()).getByLabelText(/^constat$/i),
      'Mur défoncé sur un mètre.',
    )
    await choisir(user)
    await waitFor(() => expect(urlsCreees.length).toBe(1))
    await user.click(within(dialogue()).getByRole('button', { name: /^enregistrer$/i }))

    // Le motif couvre le singulier ET le pluriel : « n'a pas été confirmée »
    // comme « n'ont pas été confirmées ». Un cas qui n'irait qu'au pluriel
    // rougirait le jour où l'on envoie une seule photo, c'est-à-dire le cas le
    // plus courant.
    expect(await screen.findByText(/pas été confirmée/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // L'aperçu SURVIT : c'est lui qu'on reprend.
    expect(within(dialogue()).getByRole('img')).toBeInTheDocument()
    expect(
      within(dialogue()).getByRole('button', { name: /reprendre l’envoi des photos/i }),
    ).toBeInTheDocument()
  })
})
