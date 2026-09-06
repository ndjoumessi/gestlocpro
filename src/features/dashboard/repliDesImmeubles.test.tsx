import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN IMMEUBLE SE REPLIE, ET CE QU'IL EMPORTE EST EXACTEMENT SES LIGNES.
 *
 * ═══ CE QUE LE REPLI NE DOIT PAS EMPORTER ═══
 *
 * L'en-tête de groupe est, depuis que les cartes sont parties, le SEUL endroit
 * d'où l'on corrige et retire un immeuble. Un repli qui l'emporterait rendrait
 * l'immeuble injoignable dès qu'on range la liste — le défaut que `ordre` existe
 * pour empêcher, et que ce dépôt s'est déjà payé deux fois : une fois du côté
 * des cartes (« un parc d'un immeuble SANS logement perdait sa carte, et avec
 * elle le seul bouton qui permette de le retirer »), une fois du côté des fiches
 * (« DeleteBuilding@360 : le bouton qui l'ouvre est introuvable »).
 *
 * Le troisième cas tient donc la moitié qui compte : replié, l'immeuble garde
 * son rapport, sa barre et ses deux gestes.
 *
 * ═══ UN IMMEUBLE VIDE NE PORTE PAS DE CHEVRON ═══
 *
 * Il n'a aucune ligne à replier. Un chevron qui ne plie rien est une commande
 * qui ment, et elle ment sur la seule rangée de la liste où l'utilisateur a
 * quelque chose à faire — celle d'un immeuble qu'il vient de créer et n'a pas
 * encore rempli. Sa place reste TENUE, pour que la colonne de chevrons garde son
 * axe : c'est ce que le second cas mesure, en comparant les décalages.
 *
 * ═══ POURQUOI CE FICHIER SERT SON PROPRE PARC ═══
 *
 * La démonstration n'a aucun immeuble à `0/0` — trois immeubles, cinq, quatre et
 * trois logements. Or `mesure-ui` ne visite que `/demo` : sans ce jeu-ci, la
 * bande de pied et l'absence de chevron ne seraient mesurées par AUCUNE porte.
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

describe('le repli d’un immeuble', () => {
  it('retire ses logements, et les rend', async () => {
    await ouvrir()
    const utilisateur = userEvent.setup()

    expect(screen.getByText('A1')).toBeInTheDocument()

    const plier = screen.getByRole('button', { name: 'Replier Résidence Pleine' })
    expect(plier, 'ouvert au premier rendu').toHaveAttribute('aria-expanded', 'true')

    await utilisateur.click(plier)
    expect(screen.queryByText('A1'), 'les logements sont repliés').not.toBeInTheDocument()

    /* LE MÊME BOUTON, RENOMMÉ. Il ne se contente pas de changer d'attribut :
       son nom accessible dit désormais le geste OPPOSÉ, sans quoi une synthèse
       vocale annoncerait « Replier » sur une liste déjà repliée. */
    const deplier = screen.getByRole('button', { name: 'Déplier Résidence Pleine' })
    expect(deplier).toHaveAttribute('aria-expanded', 'false')

    /* ET IL DÉSIGNE CE QU'IL COMMANDE. `aria-expanded` seul dit un état sans
       dire de quoi : un lecteur d'écran annonce « réduit » sans savoir ce qui
       l'est. La cible doit exister dans le document — un `aria-controls` qui
       pointe vers rien est pire que pas d'attribut, il promet un lien mort. */
    const vise = deplier.getAttribute('aria-controls')
    expect(vise, 'le bouton doit désigner le bloc de rangées qu’il replie').toBeTruthy()
    expect(document.getElementById(vise!), 'la cible d’aria-controls doit exister').not.toBeNull()

    await utilisateur.click(deplier)
    expect(screen.getByText('A1'), 'et les rend').toBeInTheDocument()
  })

  it('garde le rapport, la barre et les deux gestes quand il est replié', async () => {
    await ouvrir()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Replier Résidence Pleine' }))

    /*
      LA MOITIÉ QUI COMPTE. L'en-tête est le seul endroit d'où cet immeuble se
      corrige et se retire depuis que les cartes sont parties : un repli qui
      l'emporterait le rendrait injoignable.
    */
    const bloc = enTete('Résidence Pleine')
    expect(within(bloc).getByText('2/2'), 'le rapport survit au repli').toBeInTheDocument()
    expect(within(bloc).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(
      within(bloc).getByRole('button', { name: /Corriger l’immeuble Résidence Pleine/ }),
    ).toBeInTheDocument()
    expect(
      within(bloc).getByRole('button', { name: /Suppression impossible/ }),
    ).toBeInTheDocument()
  })

  it('ne met aucun chevron sur un immeuble qui n’a rien à replier', async () => {
    await ouvrir()

    /* GARDE DU GARDE — les deux situations doivent être dans le jeu, sinon
       « aucun chevron » serait satisfait par un écran qui n'en a nulle part. */
    expect(screen.getByRole('button', { name: 'Replier Résidence Pleine' })).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /Replier Résidence Neuve/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Déplier Résidence Neuve/ })).toBeNull()
  })

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
