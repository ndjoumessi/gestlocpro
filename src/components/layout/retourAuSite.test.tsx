import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, switchRole, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * ON PEUT RESSORTIR DE L'APPLICATION.
 *
 * LE DÉFAUT. La coquille n'offrait AUCUN chemin vers la vitrine. Le logo mène
 * au tableau de bord — comme la première entrée de la navigation, qui le dit
 * déjà —, le menu du compte ne proposait que « Se déconnecter », et le panneau
 * des réglages ne parle que de langue, devise et thème. Qui arrive de la page
 * d'accueil, entre dans la démonstration et veut relire les tarifs n'a que le
 * bouton « Précédent » du navigateur, qui ne marche que si l'on est venu de là.
 *
 * SE DÉCONNECTER N'EST PAS UN CHEMIN. C'est ce qui rendait le manque coûteux :
 * la seule sortie offerte détruisait la session. Et en démonstration il n'y a
 * pas de session : la sortie n'existait tout simplement pas.
 *
 * ═══ DEUX CONTEXTES, UNE SEULE COMMANDE À LA FOIS ═══
 *
 * `MenuCompte` ne rend rien tant qu'aucun compte n'est connecté — c'est écrit
 * dans la coquille, et c'est juste : en démonstration il n'y a personne à
 * déconnecter. Les deux états sont EXCLUSIFS (`statut === 'connecte'` contre
 * `statut === 'demo'`), et cette garde tient les deux :
 *
 *   — connecté : la commande vit DANS le menu du compte, à côté de la sortie,
 *     parce qu'aller voir le site public est un geste rare et délibéré ;
 *   — démonstration : elle prend la place que l'avatar laisse vide dans la
 *     barre, à la vue, parce que quitter une démonstration est au contraire le
 *     geste le plus attendu de tous.
 *
 * Jamais les deux ensemble : c'est ce que le troisième cas vérifie, et c'est la
 * règle que ce dépôt applique déjà à la barre de la vitrine — « deux
 * navigations identiques côte à côte sont un défaut de produit ».
 *
 * LA COQUILLE DU LOCATAIRE COMPTE AUTANT. Elle n'a pas de barre latérale : si
 * la commande n'y était que dans la barre latérale, un locataire n'aurait
 * aucune sortie. C'est le quatrième cas.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
}

/**
 * Le lien de sortie, où qu'il soit rendu — et son rôle change avec l'endroit.
 *
 * Dans la barre, c'est un LIEN. Dans le menu du compte, c'est un `menuitem` :
 * `role="menu"` n'admet que des `menuitem` parmi ses descendants signifiants,
 * règle que ce dépôt tient déjà pour les menus de carte. Le rôle explicite
 * REMPLACE le rôle natif de l'ancre, donc une requête sur « lien » seule ne
 * trouverait jamais l'entrée du menu — et la garde passerait au vert dans le
 * cas où elle vient d'échouer.
 *
 * L'élément reste une ancre dans les deux cas : c'est pourquoi `href` est
 * vérifié ensuite, des deux côtés.
 */
function sortie(): HTMLElement | null {
  return (
    screen.queryByRole('link', { name: /retour au site/i }) ??
    screen.queryByRole('menuitem', { name: /retour au site/i })
  )
}

describe('la sortie vers la vitrine', () => {
  it('est offerte à la vue en démonstration, où il n’y a pas de menu de compte', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    const lien = sortie()
    expect(lien, 'aucune sortie vers la vitrine depuis la démonstration').not.toBeNull()
    expect(lien).toHaveAttribute('href', '/')
  })

  it('vit dans le menu du compte lorsqu’un compte est connecté', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    await renderApp('/app', { session: sessionProprietaire() })
    await attendreLeChargement()

    /* FERMÉ, RIEN NE DOIT PARAÎTRE : c'est la moitié de la règle. Une commande
       rendue à la fois dans la barre et dans le menu serait le doublon qu'on
       refuse ailleurs. */
    expect(sortie(), 'la sortie est rendue deux fois').toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: /compte/i }))
    const lien = sortie()
    expect(lien, 'le menu du compte n’offre pas de sortie').not.toBeNull()
    expect(lien).toHaveAttribute('href', '/')
  })

  it('reste offerte au locataire, qui n’a pas de barre latérale', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    await switchRole('tenant')

    const lien = sortie()
    expect(lien, 'la barre du locataire n’offre aucune sortie').not.toBeNull()
    expect(lien).toHaveAttribute('href', '/')
  })
})
