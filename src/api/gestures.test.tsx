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
