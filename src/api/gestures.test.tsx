import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { PARK, SESSION_AVEC_PARC, U2, portefeuille } from './noTechnicalIds.test'


/**
 * Choisit une date dans le calendrier maison.
 *
 * Le champ natif se remplissait à la frappe ; il a été remplacé pour cesser
 * d'ouvrir un calendrier système au milieu du produit. Ces cas passent donc par
 * les gestes réels — ouvrir, choisir le mois et l'année, cliquer le jour — ce
 * qui est de toute façon ce qu'on veut vérifier : que la date affichée est bien
 * celle qui part au serveur.
 *
 * Le jour se retrouve par son libellé complet, et non par son seul chiffre : la
 * grille montre aussi les jours des mois voisins, où « 1 » apparaît deux fois.
 */
/**
 * Choisit un mois dans le sélecteur maison.
 *
 * Pendant de `choisirLaDate` : « période couverte » gardait un
 * `<input type="month">`, oublié par la passe qui n'avait remplacé que les
 * `type="date"`. Il ouvrait donc le panneau du navigateur dans la modale même
 * où le calendrier maison venait de le remplacer, deux champs plus bas.
 */
async function choisirLeMois(
  user: ReturnType<typeof userEvent.setup>,
  champ: RegExp,
  iso: string,
) {
  const [annee, mois] = iso.split('-').map(Number)
  await user.click(screen.getByLabelText(champ))
  const panneau = screen.getByRole('dialog', { name: /choix du mois/i })
  // Libellé EXACT : le panneau porte aussi « Année précédente » et « Année
  // suivante » sur ses deux flèches.
  await user.click(within(panneau).getByLabelText('Année'))
  while (within(panneau).queryByRole('button', { name: String(annee) }) === null) {
    await user.click(within(panneau).getByLabelText(/années précédentes/i))
  }
  await user.click(within(panneau).getByRole('button', { name: String(annee) }))
  // Les douze cases portent l'abréviation du mois dans la langue courante :
  // on prend la n-ième plutôt que de recomposer le libellé ici.
  const cases = within(panneau)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') !== null)
  await user.click(cases[mois - 1])
}

async function choisirLaDate(
  user: ReturnType<typeof userEvent.setup>,
  champ: RegExp,
  iso: string,
) {
  const [annee, mois, jour] = iso.split('-').map(Number)
  await user.click(screen.getByLabelText(champ))

  const calendrier = screen.getByRole('dialog', { name: /calendrier/i })

  // La remontée du panneau : année, puis mois, puis jour. Les menus natifs ont
  // disparu — celui des années dépliait quarante et une entrées rendues par le
  // système, en travers de l'écran.
  await user.click(within(calendrier).getByLabelText('Année'))
  while (within(calendrier).queryByRole('button', { name: String(annee) }) === null) {
    await user.click(within(calendrier).getByLabelText(/années précédentes/i))
  }
  await user.click(within(calendrier).getByRole('button', { name: String(annee) }))

  // Les douze mois portent l'abréviation dans la langue courante : on prend le
  // n-ième plutôt que de recomposer le libellé ici.
  const casesMois = within(calendrier)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') !== null)
  const nomMois = casesMois[mois - 1]?.textContent ?? ''
  await user.click(casesMois[mois - 1])
  const cible = within(calendrier)
    .getAllByRole('button')
    .find((b) => {
      const libelle = b.getAttribute('aria-label') ?? ''
      return (
        libelle.includes(nomMois) &&
        libelle.includes(String(annee)) &&
        new RegExp(`(^|\\D)${jour}(\\D|$)`).test(libelle)
      )
    })
  if (!cible) throw new Error(`jour introuvable dans le calendrier : ${iso}`)
  await user.click(cible)
}

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

describe('saisir les termes du bail', () => {
  it('transmet la vraie date de début et le loyer du contrat', async () => {
    /**
     * Le cas de tout nouveau compte : déclarer des locataires DÉJÀ EN PLACE.
     *
     * La création posait systématiquement « aujourd'hui » et le loyer de
     * référence du logement. L'ancienneté du bail et les impayés cumulés en
     * découlaient donc faux dès la saisie — silencieusement, et pour toujours.
     */
    const charge = portefeuille()
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
    await choisirLaDate(user, /début du bail/i, '2023-04-01')
    await user.type(screen.getByLabelText(/loyer du bail/i), '120000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const appel = serveur.appels.find((a) => a.chemin.endsWith('/tenants'))
    expect(appel?.corps).toEqual({
      unitId: U2,
      fullName: 'Awa Diallo',
      phoneE164: '+237688401277',
      // `AAAA-MM-JJ` : le serveur le lit en UTC, sinon la colonne `date`
      // ramènerait le bail à la veille pour tout fuseau à l'est de Greenwich.
      startsOn: '2023-04-01',
      rentMinor: 120000,
    })
  })

  it('n’envoie ni date ni loyer quand rien n’est saisi', async () => {
    // Un vrai emménagement du jour n'a rien à renseigner : les champs restent
    // facultatifs, et le serveur garde ses valeurs par défaut.
    const charge = portefeuille()
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

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/tenants'))?.corps as Record<
      string,
      unknown
    >
    expect('startsOn' in corps).toBe(false)
    expect('rentMinor' in corps).toBe(false)
  })
})

describe('enregistrer un encaissement', () => {
  it('écrit vraiment au serveur, au lieu d’annoncer un succès vide', async () => {
    /**
     * La modale affichait « Paiement enregistré · quittance envoyée » et
     * n'écrivait NULLE PART. C'est le mensonge le plus coûteux d'un logiciel de
     * gestion : le gestionnaire repart en croyant l'argent tracé, et l'impayé
     * réapparaît le mois suivant sans qu'on puisse dire si le locataire a payé.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/payments`, {
      status: 201,
      body: { payment: { id: 'p1', amountMinor: 115000, method: 'mobile', paidOn: '2026-08-16' } },
    })

    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /enregistrer un paiement/i }))
    await user.type(screen.getByLabelText(/montant/i), '115000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const appel = serveur.appels.find((a) => a.chemin.endsWith('/payments'))
    expect(appel?.methode).toBe('POST')
    const corps = appel?.corps as Record<string, unknown>
    expect(corps.amountMinor).toBe(115000)
    // La période est le premier jour d'un mois : c'est ce que le serveur exige,
    // et ce qui évite qu'un versement crée une échéance à cheval.
    expect(String(corps.periodStart)).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('impute sur le mois CHOISI, et non sur celui du versement', async () => {
    /**
     * Le cas qui justifie le champ : un versement reçu en août qui règle
     * juillet. Sans lui, juillet restait impayé et août apparaissait soldé d'un
     * loyer qu'il n'avait pas reçu — deux mois faux pour un seul versement.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/payments`, {
      status: 201,
      body: { payment: { id: 'p1', amountMinor: 115000, method: 'mobile', paidOn: '2026-08-16' } },
    })

    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /enregistrer un paiement/i }))

    await choisirLeMois(user, /période couverte/i, '2026-07')
    await user.type(screen.getByLabelText(/montant/i), '115000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/payments'))?.corps as Record<
      string,
      unknown
    >
    expect(corps.periodStart).toBe('2026-07-01')
  })

  it('distingue la date du versement du mois qu’il règle', async () => {
    /**
     * Deux dates, deux rôles. La période dit ce que le versement RÈGLE ; la
     * date dit QUAND il est arrivé. Les confondre en perd une — et c'est la
     * date de réception qui fait foi devant un locataire qui conteste un
     * retard.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/payments`, {
      status: 201,
      body: { payment: { id: 'p1', amountMinor: 115000, method: 'mobile', paidOn: '2026-08-02' } },
    })

    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /enregistrer un paiement/i }))

    await choisirLeMois(user, /période couverte/i, '2026-07')
    await choisirLaDate(user, /date du versement/i, '2026-08-02')
    await user.type(screen.getByLabelText(/montant/i), '115000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/payments'))?.corps as Record<
      string,
      unknown
    >
    // Juillet est réglé, le 2 août.
    expect(corps.periodStart).toBe('2026-07-01')
    expect(corps.paidOn).toBe('2026-08-02')
  })

  it('transmet la référence quand elle est saisie, et l’omet sinon', async () => {
    /**
     * Facultative, et elle doit le rester : un versement en espèces n'en a pas,
     * et l'exiger empêcherait d'enregistrer le cas le plus courant du marché
     * visé. Mais c'est par elle qu'un versement se retrouve sur un relevé
     * bancaire — sans elle, le rapprochement se fait ligne à ligne, à la main.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/payments`, {
      status: 201,
      body: { payment: { id: 'p1', amountMinor: 115000, method: 'mobile', paidOn: '2026-08-16' } },
    })

    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /enregistrer un paiement/i }))
    await user.type(screen.getByLabelText(/montant/i), '115000')
    await user.type(screen.getByLabelText(/référence de la transaction/i), 'MP260816.1432.A98765')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/payments'))?.corps as Record<
      string,
      unknown
    >
    expect(corps.reference).toBe('MP260816.1432.A98765')
  })

  it('n’envoie pas de référence vide pour un versement en espèces', async () => {
    // Une chaîne vide n'est pas « pas de référence » : elle occuperait le champ
    // et ferait croire à un rapprochement possible.
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/payments`, {
      status: 201,
      body: { payment: { id: 'p1', amountMinor: 50000, method: 'cash', paidOn: '2026-08-16' } },
    })

    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /enregistrer un paiement/i }))
    await user.type(screen.getByLabelText(/montant/i), '50000')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/payments'))?.corps as Record<
      string,
      unknown
    >
    expect('reference' in corps).toBe(false)
  })
})

describe('émettre une quittance', () => {
  /**
   * Attend que le parc du SERVEUR ait remplacé le jeu de démonstration.
   *
   * Sans cette attente, le clic porte sur un logement de démonstration — le
   * fournisseur en sert dix tant que la réponse n'est pas arrivée — dont
   * l'identifiant n'existe pas côté serveur. La modale s'ouvre alors sur un
   * document introuvable, et l'échec ressemble à un défaut du produit.
   *
   * La leçon était déjà écrite plus haut dans ce fichier, pour la validation
   * d'un devis. Je ne l'ai pas appliquée ici, et cela a coûté cinq
   * investigations qui accusaient tour à tour `Button`, `DataTable`, `Modal` et
   * le contexte — tous innocents.
   *
   * Le compte de boutons est le bon discriminant : le jeu local en rend dix,
   * la charge de test deux.
   */
  const attendreLeParcDuServeur = async () => {
    const { waitFor } = await import('@testing-library/react')
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^quittance$/i })).toHaveLength(2),
    )
  }

  const doc = (kind: 'quittance' | 'recu', paid: number, balance: number) => ({
    kind,
    periodStart: '2026-08-01',
    tenant: 'Charles Ngassa',
    unit: 'A1',
    building: 'Résidence Bonamoussadi',
    district: 'Bonamoussadi',
    rentMinor: 145000,
    waterMinor: 0,
    powerMinor: 0,
    dueMinor: 145000,
    paidMinor: paid,
    balanceMinor: balance,
    payments: [{ amountMinor: paid, method: 'mobile', paidOn: '2026-08-05', reference: 'MP123' }],
  })

  it('affiche le document rendu par le serveur, sans recalculer', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/receipts`, {
      status: 201,
      body: { document: doc('quittance', 145000, 0) },
    })

    const user = userEvent.setup()
    renderApp('/app/paiements', { session: SESSION_AVEC_PARC })
    await attendreLeParcDuServeur()
    await user.click(screen.getAllByRole('button', { name: /^quittance$/i })[0]!)

    // Deux occurrences, et c'est voulu : le titre de la modale et l'en-tête du
    // document portent le même mot. C'est ce mot qui atteste — le répéter là où
    // le regard se pose est un service, pas une redondance.
    expect(await screen.findAllByText(/quittance de loyer/i)).toHaveLength(2)
    // Le locataire figure aussi dans la ligne du tableau, derrière la modale :
    // on vérifie qu'il est présent, pas qu'il est unique.
    expect(screen.getAllByText('Charles Ngassa').length).toBeGreaterThan(1)
    // La référence, elle, n'existe que sur le document.
    expect(screen.getByText(/MP123/)).toBeInTheDocument()
  })

  it('n’écrit JAMAIS « quittance » quand le serveur rend un reçu', async () => {
    /**
     * Le mot n'est pas choisi par l'écran.
     *
     * Une quittance vaut preuve et ne se reprend pas : la dire sur un mois non
     * soldé ferait signer au bailleur un paiement qu'il n'a pas reçu. Seul le
     * serveur sait si la période est soldée, et c'est lui qui nomme.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/receipts`, {
      status: 201,
      body: { document: doc('recu', 60000, 85000) },
    })

    const user = userEvent.setup()
    renderApp('/app/paiements', { session: SESSION_AVEC_PARC })
    await attendreLeParcDuServeur()
    await user.click(screen.getAllByRole('button', { name: /^quittance$/i })[0]!)

    expect(await screen.findAllByText(/reçu de paiement/i)).toHaveLength(2)
    // Le mot « quittance » n'apparaît NULLE PART : ni au titre, ni dans le
    // document. Le serveur a dit « reçu », l'écran ne surenchérit pas.
    expect(screen.queryByText(/quittance de loyer/i)).not.toBeInTheDocument()
  })

  it('dit qu’il n’y a rien à attester plutôt que d’afficher un document vide', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/receipts`, { status: 404, body: { error: 'not_found' } })

    const user = userEvent.setup()
    renderApp('/app/paiements', { session: SESSION_AVEC_PARC })
    await attendreLeParcDuServeur()
    await user.click(screen.getAllByRole('button', { name: /^quittance$/i })[0]!)

    expect(await screen.findByText(/rien à attester/i)).toBeInTheDocument()
  })
})

describe('inviter à rejoindre le parc', () => {
  it('émet le code et l’affiche, en disant qu’il ne sera plus lisible', async () => {
    /**
     * Le code n'est lisible QU'UNE FOIS : seule son empreinte est conservée
     * côté serveur, et personne — pas même le propriétaire — ne peut le relire.
     * Laisser croire qu'on le retrouvera dans une liste ferait perdre l'accès à
     * un locataire qui n'aurait pas noté.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/invitations`, {
      status: 201,
      body: {
        invitation: { id: 'i1', role: 'tenant', codeHint: '92CD' },
        code: 'LOC-4A7B-92CD',
        // Aucun fournisseur configuré : le serveur le dit, l'écran doit le
        // répéter au lieu d'annoncer un envoi.
        envoye: false,
      },
    })

    const user = userEvent.setup()
    renderApp('/app/locataires', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /inviter par code/i }))
    await user.click(screen.getByRole('button', { name: /émettre le code/i }))

    expect(await screen.findByText('LOC-4A7B-92CD')).toBeInTheDocument()
    expect(screen.getByText(/n’est plus lisible ensuite/i)).toBeInTheDocument()
    // Et surtout : l'écran n'annonce PAS un envoi qui n'a pas eu lieu.
    expect(screen.getByText(/transmettez le code vous-même/i)).toBeInTheDocument()
    expect(screen.queryByText(/envoyé par sms/i)).not.toBeInTheDocument()
  })

  it('annonce l’envoi seulement quand le serveur le confirme', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/invitations`, {
      status: 201,
      body: {
        invitation: { id: 'i3', role: 'tenant', codeHint: '92CD' },
        code: 'LOC-4A7B-92CD',
        envoye: true,
      },
    })

    const user = userEvent.setup()
    renderApp('/app/locataires', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /inviter par code/i }))
    await user.click(screen.getByRole('button', { name: /émettre le code/i }))

    expect(await screen.findByText(/envoyé par sms/i)).toBeInTheDocument()
    expect(screen.queryByText(/transmettez le code vous-même/i)).not.toBeInTheDocument()
  })

  it('n’attache pas de logement à une invitation de gestionnaire', async () => {
    // Un gestionnaire opère tout le parc : lui attacher une unité laisserait
    // croire à un périmètre qui n'existe pas.
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/invitations`, {
      status: 201,
      body: { invitation: { id: 'i2', role: 'manager', codeHint: 'ZZZZ' }, code: 'GES-AAAA-ZZZZ' },
    })

    const user = userEvent.setup()
    renderApp('/app/locataires', { session: SESSION_AVEC_PARC })
    await user.click(await screen.findByRole('button', { name: /inviter par code/i }))
    await user.selectOptions(screen.getByLabelText(/rôle invité/i), 'manager')
    await user.click(screen.getByRole('button', { name: /émettre le code/i }))

    const corps = serveur.appels.find((a) => a.chemin.endsWith('/invitations'))?.corps as Record<
      string,
      unknown
    >
    expect(corps.role).toBe('manager')
    expect('unitId' in corps).toBe(false)
  })
})
