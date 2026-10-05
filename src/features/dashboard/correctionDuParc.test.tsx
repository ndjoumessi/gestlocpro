import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within, cliquerAction } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * CORRIGER LE PARC : SON NOM, SON PAYS, SA DEVISE.
 *
 * Aucun écran ne le permettait. Un propriétaire dont le parc était né avec la
 * mauvaise devise l'était pour toujours, et chaque loyer qu'il saisissait était
 * relu dans une unité qui n'est pas la sienne.
 *
 * Le cas n'est pas théorique : « Parc Bastos » — un quartier de Yaoundé — est né
 * `FR`/`EUR` en production, parce que le pays du compte se déduisait de la
 * devise affichée sur la vitrine en prenant le premier pays de la liste qui la
 * porte, et que la France y est en tête. La route de correction existe depuis le
 * lot précédent ; il ne manquait que l'endroit où l'appeler.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

/** La session telle qu'elle est en production : un parc camerounais né français. */
function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [
      { parkId: PARC, role, parkName: 'Parc Bastos', currency: 'EUR', countryCode: 'FR' },
    ],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'b-1',
      name: 'Résidence Essoss',
      district: 'Bastos',
      units: [
        {
          id: 'u-a1',
          label: 'A1',
          type: 'apartment',
          surfaceSqm: 45,
          rentMinor: 185000,
          paidMinor: 185000,
          status: 'paid',
          leaseId: 'l-1',
          leaseStartsOn: '2026-01-01',
          overdueDays: null,
          tenant: { id: 't-1', fullName: COMPTE_FICTIF.fullName, phoneE164: '+237677214408' },
        },
      ],
    },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
})

/** Monte l'écran du parc et ouvre la modale de correction. */
async function ouvrirLaCorrection() {
  await renderApp('/app/parc', { session: sessionDuRole('owner') })
  /**
   * Le titre ne dit RIEN de l'état : `PortfolioSkeleton` rend le même
   * `PageHeader` que l'écran chargé. L'attendre laissait le clic qui suit
   * courir contre le `fetch`, et le bouton n'existe que chargé.
   */
  await attendreLeChargement()
  await cliquerAction('Corriger le parc')
  return screen.findByRole('dialog')
}

/**
 * Monte l'écran du parc et ouvre la modale des AUTOMATISMES.
 *
 * ═══ POURQUOI DEUX OUVREURS DANS CE FICHIER ═══
 *
 * Les sept réglages d'automatisme ont quitté la correction du parc le
 * 2026-10-05 : le registre des modales l'exigeait — « le prochain réglage qu'on
 * y ajoute devrait payer ce découpage plutôt qu'un plafond de plus » —, et
 * l'appel automatique des loyers était ce prochain réglage.
 *
 * DEUX CAS DE CE FICHIER PORTENT SUR LE CANAL DE LA RELANCE, qui a déménagé
 * avec les autres. Ils restent ici plutôt que de partir vers
 * `relancesReglables.test.tsx` : ils sont écrits contre le harnais de ce
 * fichier — son `serveur`, son `PORTEFEUILLE`, son `correctionsEnvoyees` — et
 * les déplacer serait un second sujet dans un lot qui en a déjà deux. Ce qu'ils
 * gardent ne change pas d'un mot ; seule la porte par laquelle on entre change.
 */
async function ouvrirLesAutomatismes() {
  await renderApp('/app/parc', { session: sessionDuRole('owner') })
  await attendreLeChargement()
  await cliquerAction('Automatismes du parc')
  return screen.findByRole('dialog')
}

/** Les appels de correction reçus par le serveur, dans l'ordre. */
function correctionsEnvoyees() {
  return serveur.appels.filter((a) => a.methode === 'PATCH' && a.chemin === `/parks/${PARC}`)
}

describe('corriger le parc', () => {
  it('n’est proposé qu’au propriétaire', async () => {
    await renderApp('/app/parc', { session: sessionDuRole('manager') })
    await attendreLeChargement()

    /**
     * La devise n'est pas un réglage d'affichage : c'est l'unité de tout ce qui
     * se compte dans le parc. Le serveur refuse déjà le gestionnaire ; l'écran
     * ne le lui propose pas — même partage que la validation d'un devis.
     */
    expect(screen.queryByRole('button', { name: 'Corriger le parc' })).not.toBeInTheDocument()
  })

  it('montre le pays et la devise que le parc porte vraiment', async () => {
    const dialogue = await ouvrirLaCorrection()

    /**
     * Sans ce cas, la modale pourrait s'ouvrir sur des champs vides ou sur des
     * valeurs par défaut : le propriétaire corrigerait à l'aveugle ce qu'il n'a
     * pas pu lire, et poserait « France » une seconde fois sans le savoir.
     */
    expect(within(dialogue).getByLabelText(/Nom du parc/)).toHaveValue('Parc Bastos')
    /**
     * LE PAYS SE LIT EN TOUTES LETTRES, et le code voyage à côté.
     *
     * Le champ était un `<select>` et portait « FR » ; c'est un champ CHERCHABLE
     * depuis que deux cent quarante-deux pays y tiennent, et il affiche donc le
     * nom. Le cas s'en trouve plus juste que ce qu'il vérifiait avant : ce que
     * ce test veut prouver, c'est que le propriétaire LIT le pays de son parc,
     * et « FR » n'était pas ce qu'il lisait. Le code ISO, lui, reste ce qui part
     * au serveur — l'entrée cachée le porte, et le cas suivant l'envoie.
     */
    expect(within(dialogue).getByLabelText(/Pays/)).toHaveValue('France')
    expect(dialogue.querySelector('input[name="countryCode"]')).toHaveValue('FR')
    expect(within(dialogue).getByLabelText(/Devise/)).toHaveValue('EUR')
  })

  it('n’envoie que ce qui a changé', async () => {
    const dialogue = await ouvrirLaCorrection()
    serveur.quand('PATCH', `/parks/${PARC}`, {
      status: 200,
      body: { park: { id: PARC, name: 'Parc Bastos II', countryCode: 'FR', currency: 'EUR' } },
    })

    const user = userEvent.setup()
    const nom = within(dialogue).getByLabelText(/Nom du parc/)
    await user.clear(nom)
    await user.type(nom, 'Parc Bastos II')
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Parc corrigé')

    /**
     * Le corps ne porte QUE le champ touché. Envoyer les trois à chaque fois
     * réécrirait le pays et la devise avec ce que l'écran croyait savoir —
     * y compris une valeur devenue périmée entre l'ouverture et le clic.
     */
    expect(correctionsEnvoyees()).toHaveLength(1)
    expect(correctionsEnvoyees()[0]?.corps).toEqual({ name: 'Parc Bastos II' })
  })

  it('n’appelle rien quand rien n’a changé', async () => {
    const dialogue = await ouvrirLaCorrection()
    await userEvent.setup().click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    // Le serveur rend 422 sur un corps vide — « Rien à corriger ». L'écran n'a
    // pas à aller chercher ce refus pour l'apprendre.
    expect(correctionsEnvoyees()).toHaveLength(0)
    expect(await screen.findByText(/Rien n’a changé/)).toBeInTheDocument()
  })

  it('AVERTIT AVANT LE CHOIX que WhatsApp exige un modèle approuvé', async () => {
    const dialogue = await ouvrirLesAutomatismes()
    const user = userEvent.setup()

    /* RIEN TANT QU'ON N'A PAS CHOISI. Un avertissement permanent sous un canal
       qu'on n'a pas pris se lirait comme un défaut du produit, et on
       apprendrait à ne plus le voir. */
    expect(
      within(dialogue).queryByText(/modèle de message approuvé/),
    ).not.toBeInTheDocument()

    await user.selectOptions(
      within(dialogue).getByLabelText(/Canal de la relance/),
      'whatsapp',
    )

    /**
     * MAINTENANT, ET AVANT LE CLIC.
     *
     * Meta n'autorise un message WhatsApp sortant hors d'une fenêtre de 24 h
     * après le dernier message du destinataire que s'il suit un MODÈLE qu'elle
     * a approuvé ; une relance de loyer est par nature non sollicitée. Sans ce
     * modèle, la couture rend `false` et la relance reste dans le produit.
     *
     * La découverte naturelle de cette règle est un parc dont plus aucune
     * relance ne part, sans rien à l'écran pour l'expliquer. C'est exactement
     * la forme de panne que ce dépôt refuse ailleurs : un réglage qui a l'air
     * de marcher et n'envoie rien.
     */
    expect(within(dialogue).getByText(/modèle de message approuvé/)).toBeInTheDocument()
  })

  it('n’envoie le canal que s’il a changé', async () => {
    const dialogue = await ouvrirLesAutomatismes()
    serveur.quand('PATCH', `/parks/${PARC}`, {
      status: 200,
      body: { park: { id: PARC, name: 'Parc Bastos', countryCode: 'FR', currency: 'EUR' } },
    })
    const user = userEvent.setup()

    await user.selectOptions(
      within(dialogue).getByLabelText(/Canal de la relance/),
      'whatsapp',
    )
    await user.click(within(dialogue).getByRole('button', { name: /Enregistrer/ }))

    /* LE CANAL SEUL, et rien d'autre : la correction ne porte que ce qui a
       bougé, comme partout dans cette boîte. */
    expect(correctionsEnvoyees()).toHaveLength(1)
    expect(correctionsEnvoyees()[0]!.corps).toEqual({ reminderChannel: 'whatsapp' })
  })

  it('avertit que changer la devise ne convertit rien, et nomme le geste', async () => {
    const dialogue = await ouvrirLaCorrection()
    serveur.quand('PATCH', `/parks/${PARC}`, {
      status: 200,
      body: { park: { id: PARC, name: 'Parc Bastos', countryCode: 'FR', currency: 'XAF' } },
    })

    const user = userEvent.setup()
    await user.selectOptions(within(dialogue).getByLabelText(/Devise/), 'XAF')

    /**
     * Les montants sont stockés en unités mineures, sans devise attachée : un
     * loyer de 180 000 relu en euros reste 180 000, soit six cent cinquante-six
     * fois sa valeur. Le geste n'est pas interdit — le cas qui l'appelle est le
     * parc jeune qu'on resaisit — mais il doit se dire AVANT le clic.
     */
    expect(within(dialogue).getByText(/ne seront pas convertis/)).toBeInTheDocument()

    /**
     * Et le bouton CESSE de s'appeler « Enregistrer ».
     *
     * C'est là qu'est la confirmation : on ne clique pas par habitude sur un
     * geste qui change l'unité de tous les montants du parc. Un premier clic
     * sans effet visible se serait lu comme une panne ; un bouton qui nomme le
     * geste oblige à le lire.
     */
    expect(
      within(dialogue).queryByRole('button', { name: 'Enregistrer' }),
    ).not.toBeInTheDocument()

    await user.click(within(dialogue).getByRole('button', { name: 'Changer la devise' }))
    await screen.findByText('Parc corrigé')
    expect(correctionsEnvoyees()[0]?.corps).toEqual({ currency: 'XAF' })
  })
})
