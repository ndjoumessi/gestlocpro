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
 * TOUT IMMEUBLE PORTE LE GESTE QUI LE REMPLIT — vide ou peuplé.
 *
 * Relevé en production : quatre résidences sans logement, chacune sur une rangée
 * pleine, disant trois fois la même absence — « aucun logement », un loyer de
 * zéro, un rapport de zéro sur zéro — et n'offrant aucun moyen d'y remédier. Le
 * seul chemin rouvrait la liste des immeubles sur le PREMIER du parc.
 *
 * CE FICHIER A GARDÉ L'INVERSE JUSQU'AU 2026-10-09 : « un immeuble peuplé n'a
 * pas à se faire remplir ». La phrase décrivait un immeuble qu'on vient de
 * créer, pas un parc qu'on exploite — Nelson l'a nommé en montrant son écran :
 * remplir un immeuble qui a déjà trois logements repassait par le bouton de
 * page, qui rouvre la liste sur le PREMIER immeuble du parc. L'immeuble vide
 * garde son bouton PLEIN, qui tient la place du loyer et du rapport absents ;
 * l'immeuble peuplé reçoit une icône, qui n'en prend aucune.
 *
 * La démonstration n'a que des immeubles peuplés : la moitié « vide » de ces cas
 * n'est rendue par aucune porte au navigateur, et ce fichier est le seul endroit
 * qui la mesure.
 */
describe('le geste qui remplit un immeuble', () => {
  it('est offert par le vide ET par le peuplé, sous le même nom', async () => {
    await ouvrir()

    /* LE NOM ACCESSIBLE PORTE L'IMMEUBLE : sept immeubles, c'est sept boutons au
       même texte visible — ou sans texte du tout, celui du peuplé étant une
       icône — qu'un lecteur d'écran doit pouvoir distinguer. */
    expect(
      within(enTete('Résidence Neuve')).getByRole('button', {
        name: 'Ajouter un logement à Résidence Neuve',
      }),
    ).toBeInTheDocument()
    /* DANS LA CARTE, PAS DANS L'EN-TÊTE. Au-dessus de `lg`, l'immeuble peuplé
       porte son geste au bout du RAIL de ses fiches — l'en-tête n'en a plus
       depuis que l'icône « + » en est partie. L'immeuble vide, lui, n'a pas de
       rail : son bouton reste dans l'en-tête, et c'est pourquoi les deux
       assertions ne visent pas la même boîte. */
    expect(
      within(enTete('Résidence Pleine').parentElement as HTMLElement).getByRole('button', {
        name: 'Ajouter un logement à Résidence Pleine',
      }),
      'un immeuble peuplé n’offre pas d’y ajouter un logement',
    ).toBeInTheDocument()

    /* « 0/0 » ÉTAIT EXACT ET MUET, et il part avec le loyer de zéro. Le plein,
       lui, garde son rapport — c'est la mesure de cet écran. */
    expect(within(enTete('Résidence Neuve')).queryByText('0/0')).toBeNull()
    expect(within(enTete('Résidence Pleine')).getByText('2/2')).toBeInTheDocument()
  })

  /**
   * LA CASE AU BOUT DU RAIL, ET CE QU'ELLE NE DOIT PAS ÊTRE.
   *
   * Elle vit DANS le `<ul>` du rail — c'est ce qui lui donne une colonne plutôt
   * qu'une rangée sous la carte, donc zéro hauteur de page — et tout ce qui
   * entre dans ce `<ul>` par `children` devient une FICHE : une clé que l'ordre
   * réconcilie, que le menu « Déplacer » promène et que le glissement permute.
   * Elle passe donc par `queue`, et ce cas garde la distinction : le rail montre
   * une tuile de plus et compte toujours DEUX fiches.
   */
  it('pose une case d’ajout au bout du rail, qui n’est pas une fiche', async () => {
    await ouvrir()

    /* La carte de l'immeuble : son en-tête ET son rail. Les deux gestes y
       vivent, et c'est leur COUPLE que ce cas garde — l'un atteignable, l'autre
       visible. */
    const carte = enTete('Résidence Pleine').parentElement as HTMLElement
    /* UNE SEULE, ET C'EST LE POINT. L'en-tête a porté une icône « + » à côté de
       la case pendant un lot ; Nelson l'a retirée le 2026-10-09 — « le bouton +
       n'est pas nécessaire ». Deux commandes pour un même geste, à quelques
       centimètres l'une de l'autre, n'apprennent rien de plus qu'une seule.

       Elle SURVIT sous `lg`, où il n'y a pas de rail où poser une case : c'est
       `enTeteDImmeuble` qui le dit, et ce cas rend à 1 280 px. */
    expect(
      within(carte).getAllByRole('button', { name: 'Ajouter un logement à Résidence Pleine' })
        .length,
      'le geste est offert deux fois dans la même carte, ou plus du tout',
    ).toBe(1)

    /* ET ELLE NE COMPTE NI COMME FICHE NI COMME ÉLÉMENT DE LISTE. Le rail porte
       deux logements ; `role="presentation"` est ce qui empêche la case de
       devenir un troisième — dans le compte du lecteur d'écran comme dans les
       deux contrats que `parcEnFiches` et `railDesLogements` tiennent sur les
       éléments de cette liste. */
    const rail = within(carte).getByRole('list', { name: 'Résidence Pleine' })
    expect(
      within(rail).getAllByRole('listitem').length,
      'la case d’ajout s’est fait compter comme un logement',
    ).toBe(2)
    expect(rail.querySelectorAll('[data-fiche-logement]').length).toBe(2)
  })

  /**
   * ET LES DEUX OUVRENT SUR L'IMMEUBLE QU'ON A MONTRÉ.
   *
   * C'est TOUT ce que le lot achète : sans la préselection, ces deux boutons ne
   * valent pas mieux que celui de la page, qui rouvre la liste sur le PREMIER
   * immeuble du parc. La fixture déclare « Résidence Neuve » EN PREMIER — donc
   * un code qui ignorerait l'immeuble transmis choisirait `b-vide`, et ce cas
   * rougirait. C'est le même montage que le cas de l'immeuble vide, retourné.
   */
  it('ouvre la modale sur l’immeuble peuplé, et non sur le premier du parc', async () => {
    await ouvrir()
    const carte = enTete('Résidence Pleine').parentElement as HTMLElement
    await userEvent
      .setup()
      .click(
        within(carte).getByRole('button', { name: 'Ajouter un logement à Résidence Pleine' }),
      )

    const modale = await screen.findByRole('dialog')
    const immeuble = within(modale).getByRole('combobox', {
      name: /Immeuble/,
    }) as HTMLSelectElement
    /* La fixture déclare « Résidence Neuve » EN PREMIER : un code qui ignorerait
       l'immeuble transmis choisirait `b-vide`, et ce cas rougirait. */
    expect(immeuble.value, 'la case du rail n’ouvre pas sur son propre immeuble').toBe('b-plein')
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

