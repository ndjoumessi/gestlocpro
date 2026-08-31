import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * UN LIEN POSÉ SUR LA MAUVAISE PERSONNE SE VOIT, ET SE DÉFAIT.
 *
 * ═══ L'INCIDENT, RELEVÉ EN CROISANT DEUX CAPTURES DE PRODUCTION ═══
 *
 * « Accès au parc » : ELOUNDOU CHARLES ne porte plus « Relier à une fiche »,
 * donc il EST relié ; BEKONO LANDRY le porte encore, donc il ne l'est pas.
 * « Locataires et baux » : la fiche « Bekono Landry · A1 » n'a PAS la pastille
 * « Sans compte », donc elle appartient à un compte — et le seul compte relié du
 * parc est celui de Charles.
 *
 * Charles détenait le bail, les quittances, les relevés et la caution de Landry.
 * Landry ouvrait un espace vide. C'est ce que les commentaires de ce dépôt
 * appellent depuis trois lots « la faute la plus grave que cet écran puisse
 * commettre, et elle est silencieuse ».
 *
 * ═══ DEUX MOITIÉS, ET LA PREMIÈRE EST LA PLUS IMPORTANTE ═══
 *
 * VOIR. Le registre disait « relié » par une ABSENCE de bouton, jamais à QUOI.
 * L'écart entre le nom du COMPTE et celui de la FICHE est le seul signe visible
 * de l'erreur ; sans lui, le seul symptôme est que la bonne personne n'a rien —
 * ce qui se lit comme un rattachement oublié, pas comme un vol de données.
 *
 * DÉFAIRE. `Tenant.userId` s'écrivait une fois pour toutes. Et la sortie
 * apparente était un piège : « retirer l'accès » ne touchait que l'adhésion, et
 * laissait la fiche captive d'un compte qui ne peut plus entrer.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const FICHE = 'loc-landry'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

/** Le registre de la production : Charles tient la fiche de Landry. */
const REGISTRE = {
  members: [
    {
      id: 'm-moi',
      role: 'owner',
      userId: 'u-proprio',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-08-17T09:00:00.000Z',
    },
    {
      id: 'm-charles',
      role: 'tenant',
      userId: 'u-charles',
      // IL DÉTIENT LA FICHE DE QUELQU'UN D'AUTRE — tout le sujet est là.
      tenantId: FICHE,
      tenantName: 'Bekono Landry',
      tenantUnitLabel: 'A1',
      fullName: 'Eloundou Charles',
      email: 'nelson@moneytrack.io',
      since: '2026-08-18T09:00:00.000Z',
    },
    {
      id: 'm-landry',
      role: 'tenant',
      userId: 'u-landry',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: 'Bekono Landry',
      email: 'romel.djoumessi@gmail.com',
      since: '2026-08-18T09:00:00.000Z',
    },
  ],
  invitations: [],
  /* LA SEULE FICHE LIBRE PORTE LE NOM D'UN TIERS. C'est le piège suivant, et il
     est exactement de la même forme que le premier : relier Landry ici lui
     donnerait le logement de Martial. */
  unlinkedTenants: [{ id: 'loc-martial', fullName: 'Djoumessi Martial', unitLabel: 'B1' }],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  serveur.quand('DELETE', `/parks/${PARC}/tenants/${FICHE}/compte`, { status: 204 })
})

async function ouvrirLesAcces(role: Role = 'owner') {
  await renderApp('/app/acces', { session: sessionDuRole(role) })
  await attendreLeChargement()
}

/** La rangée du membre qui porte ce nom. */
function rangeeDe(nom: string) {
  const ligne = screen.getByText(nom).closest('tr')
  expect(ligne, `aucune rangée pour ${nom}`).not.toBeNull()
  return ligne!
}

describe('voir à qui une fiche est reliée', () => {
  it('nomme la fiche que le compte détient, sur sa rangée', async () => {
    await ouvrirLesAcces()

    expect(
      within(rangeeDe('Eloundou Charles')).getByText(/Bekono Landry/),
      'la rangée ne dit pas quelle fiche ce compte détient : l’erreur reste muette',
    ).toBeInTheDocument()
    expect(within(rangeeDe('Eloundou Charles')).getByText(/A1/)).toBeInTheDocument()
  })

  it('ne dit rien sur un membre qui ne détient aucune fiche', async () => {
    // La moitié sans laquelle une mention posée sans condition satisferait le
    // cas précédent — et le propriétaire, lui, n'a jamais de fiche.
    await ouvrirLesAcces()
    expect(within(rangeeDe(COMPTE_FICTIF.fullName)).queryByText(/Détient la fiche/)).not.toBeInTheDocument()
  })
})

/**
 * LES NOMS QUI DIVERGENT SE SIGNALENT, AVANT ET APRÈS.
 *
 * ═══ CE QUE LE PRODUIT SAVAIT SANS LE DIRE ═══
 *
 * Le registre porte, côte à côte, le nom du COMPTE et celui de la FICHE qu'il
 * détient. « Eloundou Charles » détenant « Bekono Landry », l'anomalie est
 * lisible par une simple comparaison — et il existe même un second membre qui
 * porte exactement ce nom-là, sans fiche. Le produit avait tout pour poser la
 * question ; il affichait les deux noms sans jamais les rapprocher.
 *
 * ═══ ET LE PIÈGE SE REFERMAIT UNE SECONDE FOIS ═══
 *
 * La fiche de A1 étant captive, la seule LIBRE est celle d'un autre locataire.
 * « Relier à une fiche » sur Bekono Landry ne lui proposait donc que le
 * logement de Djoumessi Martial — le même geste, la même faute, sans un mot.
 *
 * ═══ UNE QUESTION, JAMAIS UN VERDICT ═══
 *
 * Deux noms peuvent légitimement différer : un nom d'épouse, une société qui
 * loue pour un salarié, un diminutif. La comparaison ne REFUSE donc rien — elle
 * demande de vérifier. Un refus se contournerait par un renommage ; une
 * question posée au bon moment coûte trois secondes et arrête la faute.
 */
describe('les noms qui divergent', () => {
  it('signale la rangée où le compte et la fiche ne portent pas le même nom', async () => {
    await ouvrirLesAcces()

    expect(
      within(rangeeDe('Eloundou Charles')).getByText(/ne correspond pas/i),
      'le registre montre les deux noms sans jamais les rapprocher',
    ).toBeInTheDocument()
  })

  it('ne signale rien quand ils se correspondent', async () => {
    // La moitié sans laquelle avertir partout satisferait le cas précédent.
    serveur.quand('GET', `/parks/${PARC}/access`, {
      status: 200,
      body: {
        ...REGISTRE,
        members: REGISTRE.members.map((m) =>
          m.id === 'm-charles' ? { ...m, tenantName: 'Eloundou Charles' } : m,
        ),
      },
    })
    await ouvrirLesAcces()

    expect(within(rangeeDe('Eloundou Charles')).queryByText(/ne correspond pas/i)).not.toBeInTheDocument()
  })

  it('avertit AVANT de relier, quand la fiche choisie porte un autre nom', async () => {
    await ouvrirLesAcces()
    const utilisateur = userEvent.setup()
    await utilisateur.click(
      within(rangeeDe('Bekono Landry')).getByRole('button', { name: /Relier à une fiche/ }),
    )

    const dialogue = await screen.findByRole('dialog')
    /* La note nomme LES DEUX personnes : c'est le rapprochement qui informe,
       pas l'avertissement seul. */
    const avertissement = within(dialogue).getByText(/pas le même nom/i)
    expect(
      avertissement,
      'la seule fiche libre porte le nom d’un tiers, et rien ne le dit',
    ).toBeInTheDocument()
    expect(avertissement).toHaveTextContent(/Bekono Landry/)
    expect(avertissement).toHaveTextContent(/Djoumessi Martial/)
  })
})

describe('défaire un lien', () => {
  it('offre le geste au propriétaire, sur la rangée reliée', async () => {
    await ouvrirLesAcces()
    expect(
      within(rangeeDe('Eloundou Charles')).getByRole('button', { name: /Délier la fiche/ }),
    ).toBeInTheDocument()
  })

  it('ne l’offre pas sur une rangée sans fiche', async () => {
    await ouvrirLesAcces()
    expect(
      within(rangeeDe('Bekono Landry')).queryByRole('button', { name: /Délier la fiche/ }),
    ).not.toBeInTheDocument()
  })

  it('demande confirmation, en nommant ce qui va être retiré', async () => {
    await ouvrirLesAcces()
    const utilisateur = userEvent.setup()
    await utilisateur.click(
      within(rangeeDe('Eloundou Charles')).getByRole('button', { name: /Délier la fiche/ }),
    )

    const dialogue = await screen.findByRole('alertdialog')
    /* Un effet qui frappe un TIERS se confirme, même quand il se répare : à la
       seconde, l'intéressé perd bail, quittances et relevés. */
    expect(within(dialogue).getByText(/Bekono Landry/)).toBeInTheDocument()
    expect(within(dialogue).getByText(/quittances/i)).toBeInTheDocument()
  })

  it('appelle le serveur sur la fiche, pas sur l’adhésion', async () => {
    await ouvrirLesAcces()
    const utilisateur = userEvent.setup()
    await utilisateur.click(
      within(rangeeDe('Eloundou Charles')).getByRole('button', { name: /Délier la fiche/ }),
    )
    const dialogue = await screen.findByRole('alertdialog')
    await utilisateur.click(within(dialogue).getByRole('button', { name: /Délier la fiche/ }))

    await waitFor(() =>
      expect(
        serveur.appels.some(
          (a) => a.methode === 'DELETE' && a.chemin === `/parks/${PARC}/tenants/${FICHE}/compte`,
        ),
        'la déliaison ne part pas, ou part sur la mauvaise ressource',
      ).toBe(true),
    )
  })

  it('le refuse au gestionnaire', async () => {
    /**
     * CE CAS NE GARDE PAS UNE CONDITION PROPRE AU DÉLIEMENT, et la mutation l'a
     * établi : posée d'abord sur le bouton, `estProprietaire` était MORTE — le
     * rendu de la cellule d'action sort en `null` pour quiconque n'est pas
     * propriétaire, bien avant d'arriver là. La retirer ne changeait aucun
     * verdict, et le cas restait vert.
     *
     * Il garde donc le partage de l'ÉCRAN, qui est pré-existant, appliqué à un
     * geste neuf. C'est une couverture, pas une garde neuve, et le dire vaut
     * mieux que de laisser croire l'inverse : retirer à quelqu'un l'accès à ses
     * propres données est une décision, et le jour où cette cellule s'ouvrirait
     * au gestionnaire, ce cas est ce qui rappellerait de trancher.
     */
    await ouvrirLesAcces('manager')
    expect(screen.queryByRole('button', { name: /Délier la fiche/ })).not.toBeInTheDocument()
  })
})
