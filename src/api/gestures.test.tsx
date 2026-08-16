import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { PARK, SESSION_AVEC_PARC, U2, portefeuille } from './noTechnicalIds.test'

/**
 * Les gestes, de bout en bout.
 *
 * La chaîne complète — clic, appel, réponse, écran — n'était vérifiée nulle
 * part. Les tests serveur éprouvent les mutations contre une vraie base, avec
 * leurs droits et leurs refus ; les tests client vérifiaient le rendu d'un état
 * déjà posé. Entre les deux, personne ne regardait le moment où l'un devient
 * l'autre.
 *
 * Ce qui compte ici n'est pas qu'un clic « marche » : c'est **l'ordre**. Le
 * fournisseur écrit d'abord au serveur, puis rejoue sa réponse. L'inverse —
 * poser l'état localement puis appeler — donnerait une interface qui affiche un
 * devis validé que le serveur a refusé. Le refus existe vraiment : c'est le
 * droit du seul propriétaire, et il est vérifié là-bas.
 *
 * Le troisième cas est donc le seul qui compte vraiment. Les deux premiers ne
 * font que rendre son échec interprétable.
 */

const DEVIS = 'ffffffff-2222-4333-8444-555555555555'
const CAUTION = '99999999-2222-4333-8444-555555555555'

function serveurAvecParc() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
  return serveur
}

describe('valider un devis', () => {
  it('appelle le serveur, à la bonne adresse', async () => {
    const serveur = serveurAvecParc()
    serveur.quand('PATCH', `/parks/${PARK}/works/${DEVIS}/approve`, {
      status: 200,
      body: { work: { id: DEVIS, status: 'approved' } },
    })

    const user = userEvent.setup()
    renderApp('/app/travaux', { session: SESSION_AVEC_PARC })
    // On attend la charge du SERVEUR avant de cliquer : sans cela le geste
    // porte sur le jeu de démonstration encore affiché, et vise un autre devis.
    await screen.findByText(/SIG-2026-001/)
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    const appel = serveur.appels.find((a) => a.chemin.includes('/approve'))
    expect(appel?.methode).toBe('PATCH')
    // L'identifiant TECHNIQUE part au serveur — c'est le seul endroit où il a
    // sa place, et le pendant exact de la règle qui l'interdit à l'écran.
    expect(appel?.chemin).toBe(`/parks/${PARK}/works/${DEVIS}/approve`)
  })

  it('affiche l’état rendu par le serveur, et non un état deviné', async () => {
    const serveur = serveurAvecParc()
    serveur.quand('PATCH', `/parks/${PARK}/works/${DEVIS}/approve`, {
      status: 200,
      body: { work: { id: DEVIS, status: 'approved' } },
    })

    const user = userEvent.setup()
    renderApp('/app/travaux', { session: SESSION_AVEC_PARC })
    // On attend la charge du SERVEUR avant de cliquer : sans cela le geste
    // porte sur le jeu de démonstration encore affiché, et vise un autre devis.
    await screen.findByText(/SIG-2026-001/)
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    // Le bouton disparaît parce que le STATUT a changé, pas parce qu'on l'a
    // masqué : c'est la même règle qui le fait apparaître.
    expect(await screen.findByText('Validé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /valider le devis/i })).not.toBeInTheDocument()
  })

  it('n’affiche PAS un devis validé que le serveur a refusé', async () => {
    /**
     * LE cas qui justifie ce fichier.
     *
     * Le refus est réel : valider un devis engage une dépense, et c'est le
     * droit du seul propriétaire — le serveur le revérifie même quand la
     * requête ne vient pas de l'interface. Une interface optimiste afficherait
     * « Approuvé » et laisserait l'utilisateur repartir en croyant avoir
     * décidé.
     */
    const serveur = serveurAvecParc()
    serveur.quand('PATCH', `/parks/${PARK}/works/${DEVIS}/approve`, {
      status: 403,
      body: { error: 'forbidden' },
    })

    const user = userEvent.setup()
    renderApp('/app/travaux', { session: SESSION_AVEC_PARC })
    // On attend la charge du SERVEUR avant de cliquer : sans cela le geste
    // porte sur le jeu de démonstration encore affiché, et vise un autre devis.
    await screen.findByText(/SIG-2026-001/)
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    // ET on le DIT. Le test précédent se contentait de vérifier que l'écran ne
    // mentait pas ; il ne vérifiait pas qu'il parlait. La promesse rejetée
    // partait sans capture : le gestionnaire cliquait, et rien — ni succès, ni
    // refus. Un geste sans réponse se répète, puis se conclut par « le bouton
    // ne fait rien ».
    expect(await screen.findByText(/le serveur a refusé cette action/i)).toBeInTheDocument()

    // Le devis reste à arbitrer, et le bouton reste offert.
    expect(await screen.findByText('Devis proposé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /valider le devis/i })).toBeInTheDocument()
    expect(screen.queryByText('Validé')).not.toBeInTheDocument()
  })
})

describe('arbitrer une caution', () => {
  it('transmet la retenue ET sa justification', async () => {
    // « Un décompte sans motif est indéfendable » : le texte était exigé par la
    // modale et jeté par la mutation. C'est le seul qui défendrait la décision
    // devant un locataire, et le serveur l'exige désormais aussi.
    const charge = portefeuille()
    charge.deposits[0]!.status = 'settling'
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: charge })
    serveur.quand('PATCH', `/parks/${PARK}/deposits/${CAUTION}/settle`, {
      status: 200,
      body: { deposit: { id: CAUTION, status: 'returned' } },
    })

    const user = userEvent.setup()
    renderApp('/app/cautions', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /^arbitrer$/i }))

    await user.type(screen.getByLabelText(/montant retenu/i), '45000')
    await user.type(screen.getByLabelText(/justification/i), 'Reprise de la peinture')
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    const appel = serveur.appels.find((a) => a.chemin.includes('/settle'))
    expect(appel?.methode).toBe('PATCH')
    expect(appel?.corps).toEqual({
      withheldMinor: 45000,
      reason: 'Reprise de la peinture',
    })
  })
})

describe('rattacher un locataire', () => {
  it('envoie l’unité, le nom et le numéro au format international', async () => {
    const charge = portefeuille()
    // Une unité vacante, sans quoi l'écran refuse le geste — à juste titre.
    charge.buildings[0]!.units[1]!.tenant = null
    charge.buildings[0]!.units[1]!.status = 'vacant'
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: charge })
    serveur.quand('POST', `/parks/${PARK}/tenants`, {
      status: 201,
      body: { lease: { id: 'bail', unitId: U2, status: 'pending' } },
    })

    const user = userEvent.setup()
    renderApp('/app/locataires', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /créer une fiche locataire/i }))

    await user.type(screen.getByLabelText(/nom complet/i), 'Awa Diallo')
    await user.type(screen.getByLabelText(/^téléphone/i), '688401277')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const appel = serveur.appels.find((a) => a.chemin.endsWith('/tenants'))
    expect(appel?.methode).toBe('POST')
    expect(appel?.corps).toEqual({
      // L'identifiant technique de l'unité, et non son libellé : c'est le
      // serveur qui lit ce champ.
      unitId: U2,
      fullName: 'Awa Diallo',
      // Indicatif et numéro recomposés en E.164, sans espace : la forme que le
      // serveur exige, et la seule qui se compose sans ambiguïté.
      phoneE164: '+237688401277',
    })
  })
})

describe('constituer son parc', () => {
  it('envoie le nom et le quartier au serveur, et affiche ce qu’il rend', async () => {
    /**
     * Le geste qui manquait au produit.
     *
     * Un propriétaire pouvait créer son compte et n'en rien faire : tous les
     * écrans opéraient sur un parc qu'aucune route ne permettait de constituer.
     * La démonstration en montrait un rempli ; le produit ne savait pas le
     * remplir.
     */
    // Le parc est chargé AVANT le geste, et on l'attend explicitement.
    // Sans cette attente, la réponse du portefeuille se résolvait après la
    // création et écrasait l'immeuble tout juste ajouté — un défaut d'ordre,
    // pas de code, et invisible tant que le test ne le fixait pas.
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/buildings`, {
      status: 201,
      body: { building: { id: 'aaaa1111-2222-4333-8444-555555555555', name: 'Résidence Makepe', district: 'Makepe' } },
    })

    const user = userEvent.setup()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    // Le parc du serveur est à l'écran : sa carte de quartier le prouve.
    await screen.findAllByText('Bonamoussadi')

    await user.click(await screen.findByRole('button', { name: /ajouter un immeuble/i }))
    await user.type(screen.getByLabelText(/nom de l’immeuble/i), 'Résidence Makepe')
    await user.type(screen.getByLabelText(/^quartier/i), 'Makepe')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const appel = serveur.appels.find((a) => a.chemin.endsWith('/buildings'))
    expect(appel?.methode).toBe('POST')
    expect(appel?.corps).toEqual({ name: 'Résidence Makepe', district: 'Makepe' })

    /**
     * L'immeuble rendu par le SERVEUR apparaît à l'écran.
     *
     * On cherche le QUARTIER et non le nom : les cartes de cet écran portent
     * `district`, et un immeuble neuf n'a encore aucun logement, donc aucune
     * ligne de tableau où son nom figurerait. On crée « Résidence Makepe » et
     * l'écran affiche « Makepe » — c'est un vrai manque, noté et à traiter,
     * mais ce test décrit ce que le produit fait aujourd'hui plutôt que ce
     * qu'on aimerait qu'il fasse.
     */
    // Deux occurrences : la carte de quartier et la puce de filtre — l'écran
    // sait donc à la fois le compter et le proposer au filtrage.
    expect(await screen.findAllByText('Makepe')).toHaveLength(2)
  })

  it('n’envoie rien quand le nom est trop court, et le dit', async () => {
    const vide = portefeuille()
    vide.buildings = []
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: vide })

    const user = userEvent.setup()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /ajouter un immeuble/i }))

    await user.type(screen.getByLabelText(/nom de l’immeuble/i), 'A')
    await user.type(screen.getByLabelText(/^quartier/i), 'Makepe')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    expect(await screen.findByText(/au moins 2 caractères/i)).toBeInTheDocument()
    expect(serveur.appels.find((a) => a.chemin.endsWith('/buildings'))).toBeUndefined()
  })
})

describe('saisir un logement', () => {
  const IMMEUBLE = 'aaaaaaaa-2222-4333-8444-555555555555'

  it('envoie le logement à son immeuble, et l’affiche vacant', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/buildings/${IMMEUBLE}/units`, {
      status: 201,
      body: { unit: { id: 'bbbb2222-2222-4333-8444-555555555555' } },
    })

    const user = userEvent.setup()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    await screen.findAllByText('Bonamoussadi')

    await user.click(screen.getByRole('button', { name: /ajouter un logement/i }))
    await user.type(screen.getByLabelText(/numéro du logement/i), 'B7')
    await user.type(screen.getByLabelText(/surface/i), '64')
    await user.type(screen.getByLabelText(/loyer mensuel/i), '130000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const appel = serveur.appels.find((a) => a.chemin.endsWith('/units'))
    expect(appel?.methode).toBe('POST')
    expect(appel?.corps).toEqual({
      label: 'B7',
      type: 'T2',
      surfaceSqm: 64,
      // Le loyer part en unités mineures entières : c'est la seule forme qui
      // se somme juste sur douze mois.
      baseRentMinor: 130000,
    })

    // Et il apparaît à l'écran, VACANT — aucun bail n'existe encore.
    expect(await screen.findByText('B7')).toBeInTheDocument()
    expect(screen.getAllByText(/vacant/i).length).toBeGreaterThan(0)
  })

  it('refuse un numéro déjà pris dans le même immeuble, sans appeler le serveur', async () => {
    // « A1 » existe déjà dans Bonamoussadi. Deux lignes indiscernables feraient
    // encaisser sur le mauvais logement — et la correction doit se faire sans
    // aller-retour, même si le serveur le refuse aussi en 409.
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })

    const user = userEvent.setup()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    await screen.findAllByText('Bonamoussadi')

    await user.click(screen.getByRole('button', { name: /ajouter un logement/i }))
    await user.type(screen.getByLabelText(/numéro du logement/i), 'a1')
    await user.type(screen.getByLabelText(/surface/i), '50')
    await user.type(screen.getByLabelText(/loyer mensuel/i), '90000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    expect(await screen.findByText(/ce numéro existe déjà/i)).toBeInTheDocument()
    expect(serveur.appels.find((a) => a.chemin.endsWith('/units'))).toBeUndefined()
  })
})
