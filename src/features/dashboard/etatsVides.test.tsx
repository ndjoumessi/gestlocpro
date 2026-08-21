import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Ce que disent les trois écrans quand ils n'ont rien à montrer.
 *
 * Travaux, signalements et états des lieux appelaient `EmptyState` avec une
 * icône et un titre, rien d'autre. Un titre seul répond « il n'y a rien » à
 * quelqu'un qui voit déjà qu'il n'y a rien : la question réelle est « est-ce
 * que ça marche, et qu'est-ce qui apparaîtra ici ». Ce sont en outre les trois
 * écrans du parcours locataire — celui qui les rencontre est celui qui connaît
 * le moins le produit.
 *
 * Deux des trois titres étaient de surcroît écrits pour le locataire (« votre
 * logement ») et servis tels quels au propriétaire, qui regarde tout le parc.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const SESSION_LOCATAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
}

/**
 * Un parc réel, mais sans le moindre travail, état des lieux ni notification.
 *
 * C'est l'état EXACT d'un compte qui vient de déclarer son premier immeuble, et
 * il dure : rien ne se signale le premier jour. Le jeu de démonstration, lui,
 * porte cinq interventions et six états des lieux — il ne montre jamais ces
 * écrans vides à personne.
 */
function parcSansRien() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'bbbbbbbb-2222-4333-8444-555555555555',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: {
                id: 'dddddddd-2222-4333-8444-555555555555',
                fullName: 'Charles Ngassa',
                phoneE164: '+237677214408',
              },
              status: 'paid',
              paidMinor: 145000,
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
  return serveur
}

describe('les travaux, quand il n’y en a aucun', () => {
  it('dit au bailleur d’où viennent les interventions, dans SES termes', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/aucune intervention sur le parc/i)).toBeInTheDocument()
    // Le corps nomme les DEUX origines au lieu de paraphraser le titre. Il n'en
    // nommait qu'une — « naît d'un signalement de locataire » — et cette phrase
    // est devenue fausse le jour où le bailleur a pu en ouvrir une lui-même.
    expect(screen.getByText(/vous ouvrez ce que vous décidez/i)).toBeInTheDocument()
    // Et surtout, plus le texte du locataire : le propriétaire n'a pas « son »
    // logement, il a un parc.
    expect(screen.queryByText(/sur votre logement/i)).not.toBeInTheDocument()
  })

  /**
   * Ce cas disait l'inverse, et il avait raison à sa date.
   *
   * Il s'intitulait « n'offre au bailleur aucun bouton : rien ne crée une
   * intervention ici », et sa prémisse était exacte du point de vue de
   * l'interface : aucun écran n'ouvrait d'intervention, un bouton aurait mené
   * au vide. Il annonçait lui-même sa péremption — « il tombera le jour où
   * quelqu'un croira bien faire en fabriquant l'action ».
   *
   * Il n'est pas tombé, et c'est ce qu'il faut retenir. Le geste construit
   * s'appelle « Ouvrir un chantier », qui ne contient ni « ajouter », ni
   * « nouveau », ni « créer » : l'assertion continuait de passer sur une
   * prémisse morte. Un cas qui garde une FORMULATION plutôt qu'une intention
   * ne se signale pas quand le monde change autour de lui — il faut aller le
   * chercher.
   *
   * La prémisse elle-même n'était vraie qu'à moitié : la route serveur
   * acceptait les trois rôles depuis l'origine. Le bouton n'aurait pas ouvert
   * sur rien, il aurait ouvert sur une capacité que personne n'exposait.
   *
   * Ce qui SURVIT du garde est la moitié qui reste vraie — celle du locataire,
   * juste en dessous.
   */
  it('offre le geste au bailleur, une fois la fonction construite', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_PROPRIETAIRE })

    await screen.findByText(/aucune intervention sur le parc/i)
    // Dans l'état vide ET dans l'en-tête : c'est précisément le parc où le
    // bailleur cherche par où commencer.
    expect(screen.getAllByRole('button', { name: /ouvrir un chantier/i }).length).toBeGreaterThan(0)
  })

  it('ne l’offre pas au locataire, qui signale mais n’ouvre pas', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_LOCATAIRE })

    await screen.findByText(/aucune intervention/i)
    expect(screen.queryByRole('button', { name: /ouvrir un chantier/i })).toBeNull()
  })

  it('ramène le locataire là où ses données vivent', async () => {
    parcSansRien()
    // L'adhésion de cette session dit déjà « locataire » : le rôle en découle,
    // il n'y a plus rien à basculer.
    renderApp('/app/travaux', { session: SESSION_LOCATAIRE })

    expect(await screen.findByText(/aucune intervention en cours/i)).toBeInTheDocument()
    expect(screen.getByText(/dès que votre gestionnaire enregistre/i)).toBeInTheDocument()
    // Une action réelle, et la seule honnête : le locataire n'ouvre pas
    // d'intervention lui-même, mais il n'a rien à faire sur cette page.
    expect(screen.getByRole('link', { name: /retour à mon espace/i })).toBeInTheDocument()
  })
})

describe('les notifications, quand il n’y en a aucune', () => {
  it('énumère au bailleur ce que le produit dépose ici', async () => {
    parcSansRien()
    renderApp('/app/signalements', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/rien à signaler sur le parc/i)).toBeInTheDocument()
    expect(screen.getByText(/loyers en retard.*devis à arbitrer/i)).toBeInTheDocument()
  })
})

describe('les états des lieux, quand il n’y en a aucun', () => {
  it('explique à quoi ils servent plutôt que de répéter qu’il n’y en a pas', async () => {
    parcSansRien()
    renderApp('/app/etats-des-lieux', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/aucun état des lieux enregistré$/i)).toBeInTheDocument()
    expect(screen.getByText(/c’est leur comparaison qui justifie/i)).toBeInTheDocument()
  })

  /**
   * Ce cas disait l'inverse, et il avait raison à sa date.
   *
   * Il s'intitulait « ne fabrique aucune action : le produit ne sait pas en
   * établir un », et sa prémisse était exacte : aucune route d'état des lieux
   * n'existait côté serveur. Un bouton aurait mené au vide.
   *
   * La fonction ayant été construite, la prémisse est tombée — et le cas avec
   * elle, comme il devait. Ce qui SURVIT du garde est la moitié qui reste
   * vraie : le locataire n'établit pas un état des lieux, il le signe.
   */
  it('offre le geste au bailleur, une fois la fonction construite', async () => {
    parcSansRien()
    renderApp('/app/etats-des-lieux', { session: SESSION_PROPRIETAIRE })

    await screen.findByText(/aucun état des lieux enregistré$/i)
    expect(screen.getByRole('button', { name: /établir un état des lieux/i })).toBeInTheDocument()
  })

  it('ne l’offre pas au locataire, qui signe mais n’établit pas', async () => {
    parcSansRien()
    renderApp('/app/etats-des-lieux', { session: SESSION_LOCATAIRE })

    await screen.findByText(/aucun état des lieux/i)
    expect(screen.queryByRole('button', { name: /établir un état des lieux/i })).toBeNull()
  })
})

describe('les cautions, quand il n’y en a aucune', () => {
  it('dit d’où elles viennent, au lieu d’en-têtes au-dessus du vide', async () => {
    /**
     * L'écran servait des en-têtes de colonnes et rien en dessous : ni ligne,
     * ni message, ni indication de ce qui manque. Un tableau nu se lit comme
     * une panne — et il n'y en avait pas : ce parc n'a simplement pas encore de
     * caution.
     *
     * Le corps répond à la question réelle, « où est-ce que ça se saisit ? ».
     */
    parcSansRien()
    renderApp('/app/cautions', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/aucune caution consignée/i)).toBeInTheDocument()
    expect(screen.getByText(/création de la fiche locataire/i)).toBeInTheDocument()
  })

  /**
   * Le cas « texte propre au locataire » N'EST PAS ici : il n'y a pas de
   * locataire sur cet écran. « Cautions » est réservé au propriétaire et au
   * gestionnaire, et un second texte aurait été du code mort ajouté en croyant
   * bien faire — écrit, puis retiré quand le test a rendu « Accès restreint ».
   */

  /**
   * L'ÉCHÉANCIER DIT QU'IL EST VIDE, sur l'état NORMAL d'un parc bien tenu.
   *
   * C'était la seule des trois cartes de sa rangée sans état vide : elle se
   * réduisait à un titre au-dessus d'une zone blanche dès que tous les loyers
   * étaient encaissés. Un gestionnaire qui a bien travaillé voyait un silence là
   * où il attendait une confirmation, et rien ne distinguait « rien à faire » de
   * « rien ne s'est chargé ».
   *
   * Le cas passe par le tableau de bord, seul écran que ce jeu ne visitait pas.
   */
  it('dit à l’échéancier qu’il n’a rien à appeler', async () => {
    parcSansRien()
    renderApp('/app', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText('Aucune échéance en attente')).toBeInTheDocument()
    // Et il dit COMMENT la liste se remplira : sans cela, un compte neuf croit
    // à une panne de saisie.
    expect(screen.getByText(/se remplit d’elle-même/)).toBeInTheDocument()
  })
})