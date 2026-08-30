import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, SESSION_ANONYME } from '@/test/render'
import { cleanup } from '@testing-library/react'
import { installerFauxServeur, type FauxServeur } from '@/test/api'
import { lireStockage, ecrireStockage } from '@/lib/stockage'

/**
 * « RESTER CONNECTÉ SUR CET APPAREIL » — LA VRAIE, CETTE FOIS.
 *
 * ═══ CE QUE LA PREMIÈRE VERSION PROMETTAIT SANS LE TENIR ═══
 *
 * Une case identique vivait ici et a été RETIRÉE : elle se cochait et rien ne
 * la lisait — ni état, ni `onChange`, et `connecter` ne prenait que l'adresse
 * et le mot de passe. `caseControlee.test.tsx` garde cette leçon-là et reste :
 * une case du formulaire doit être COMMANDÉE.
 *
 * ═══ POURQUOI ELLE RACCOURCIT AU LIEU D'ALLONGER ═══
 *
 * La session dure DÉJÀ trente jours pour tout le monde, glissante — voir
 * `DUREE_SESSION_MS`. Une case qui « allonge » n'aurait donc rien à allonger :
 * elle serait décorative une seconde fois. Ce qui manque au produit est
 * l'inverse — le moyen de dire « pas sur cette machine », sur un poste partagé
 * ou emprunté, où l'on laisse aujourd'hui un mois d'accès au parc derrière soi.
 *
 * ═══ CE QUE CES CAS GARDENT, ET CE QU'ILS NE PEUVENT PAS GARDER ═══
 *
 * Ils gardent que le CHOIX PART. Que le serveur en fasse une session courte est
 * l'autre moitié, gardée par `sessionDeCetAppareil.test.ts` côté serveur, seul
 * endroit où l'on peut lire le cookie posé et l'échéance écrite en base.
 */

const ADRESSE = 'proprietaire@exemple.cm'
const SECRET = 'un-mot-de-passe-assez-long'

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur({ authentifie: false })
  serveur.quand('POST', '/auth/login', { status: 200, body: { user: null } })
})

const connexions = (s: FauxServeur) =>
  s.appels.filter((a) => a.methode === 'POST' && a.chemin === '/auth/login')

async function seConnecter(decocher: boolean) {
  const utilisateur = userEvent.setup()
  await renderApp('/connexion', { session: SESSION_ANONYME })

  await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
  await utilisateur.type(screen.getByLabelText(/^mot de passe/i), SECRET)
  if (decocher) await utilisateur.click(screen.getByRole('checkbox'))
  await utilisateur.click(screen.getByRole('button', { name: /^se connecter$/i }))
}

describe('la case « rester connecté » de l’écran de connexion', () => {
  it('existe, et elle est cochée d’abord', async () => {
    await renderApp('/connexion', { session: SESSION_ANONYME })

    const boite = screen.getByRole('checkbox')
    /* COCHÉE PAR DÉFAUT, et c'est un choix qu'on assume : la session dure
       trente jours aujourd'hui pour tout le monde. Une case décochée d'office
       déconnecterait tout le parc installé à la fermeture du navigateur, sans
       que personne n'ait rien demandé ni ne sache pourquoi. La case ne fait
       que RETIRER de l'exposition, à la demande. */
    expect(boite, 'la case naît décochée : le produit raccourcit sans qu’on le lui demande').toBeChecked()
  })

  it('décochée, elle DIT au serveur de ne pas retenir cet appareil', async () => {
    await seConnecter(true)

    const demandes = connexions(serveur)
    expect(demandes, 'aucune connexion n’est partie').toHaveLength(1)
    expect(
      (demandes[0]!.corps as { persistent?: unknown }).persistent,
      'le choix de l’utilisateur ne quitte jamais l’écran',
    ).toBe(false)
  })

  it('cochée, elle le dit AUSSI, plutôt que de laisser le serveur deviner', async () => {
    /* Le serveur a un défaut, et il vaut « oui ». S'en remettre à lui ferait
       dépendre une propriété de sécurité d'une valeur écrite ailleurs : le jour
       où ce défaut changerait, l'écran continuerait d'afficher une case cochée
       en demandant l'inverse. On envoie donc les deux cas. */
    await seConnecter(false)

    const demandes = connexions(serveur)
    expect(demandes, 'aucune connexion n’est partie').toHaveLength(1)
    expect((demandes[0]!.corps as { persistent?: unknown }).persistent).toBe(true)
  })
})


/**
 * LE CHOIX SURVIT À L'APPAREIL, SINON IL NE SERT À RIEN.
 *
 * ═══ LE DÉFAUT, SIGNALÉ SUR L'ÉCRAN DE PRODUCTION ═══
 *
 * La case naissait `useState(true)`, donc COCHÉE À CHAQUE MONTAGE. Décochée, on
 * se déconnecte, on recharge : elle revient cochée. Le formulaire est par
 * ailleurs vide — pas d'adresse retenue —, si bien que l'écran affiche un état
 * que personne n'a demandé, à côté de champs qui, eux, n'ont rien gardé.
 *
 * ═══ POURQUOI C'EST GRAVE ICI PLUS QU'AILLEURS ═══
 *
 * Cette case n'existe QUE pour le poste partagé. C'est exactement la machine où
 * le choix doit tenir : celui qui a décoché hier ne recommence pas la
 * vérification chaque matin, et surtout, le suivant n'hérite pas d'une case
 * cochée sur un poste qui a déjà été déclaré partagé.
 *
 * Une préférence qu'il faut redire à chaque visite n'est pas une préférence.
 *
 * ═══ CE QU'ON NE RETIENT PAS, ET C'EST VOULU ═══
 *
 * L'ADRESSE. Retenir l'identifiant sur la machine qu'on vient de déclarer
 * partagée dirait au suivant qui s'y connecte — c'est le contraire exact de ce
 * que la case demande. Le gestionnaire de mots de passe du navigateur le fait
 * déjà, sous le contrôle de son propriétaire, et c'est sa place.
 */
describe('le choix « rester connecté » sur cet appareil', () => {
  it('décoché, il TIENT au rechargement suivant', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await utilisateur.click(screen.getByRole('checkbox'))

    // Le rechargement : on démonte tout et on remonte, stockage intact.
    cleanup()
    await renderApp('/connexion', { session: SESSION_ANONYME })

    expect(
      screen.getByRole('checkbox'),
      'la case revient cochée sur une machine déclarée partagée',
    ).not.toBeChecked()
  })

  it('et le serveur reçoit bien ce choix-là, pas le défaut', async () => {
    /* Sans ce cas, l'écran pourrait AFFICHER une case décochée en demandant
       trente jours : la mémoire serait cosmétique, ce qui est exactement le
       reproche fait à la toute première version de cette case. */
    ecrireStockage('local', 'gestlocpro.session.persistante', 'non')
    await seConnecter(false)

    const demandes = connexions(serveur)
    expect(demandes).toHaveLength(1)
    expect((demandes[0]!.corps as { persistent?: unknown }).persistent).toBe(false)
  })

  it('recoché, il redevient un appareil que l’on retient', async () => {
    /* L'aller sans le retour laisserait une machine condamnée aux douze heures
       sans moyen d'en sortir autrement qu'en vidant le stockage du navigateur. */
    ecrireStockage('local', 'gestlocpro.session.persistante', 'non')
    const utilisateur = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await utilisateur.click(screen.getByRole('checkbox'))

    cleanup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('n’écrit RIEN d’identifiant à côté du choix', async () => {
    /* La garde du garde de la règle ci-dessus : ce lot pourrait « retenir
       l'appareil » en retenant aussi l'adresse, et le cas de la case resterait
       vert. On regarde donc tout ce que l'écran a laissé sur la machine. */
    const utilisateur = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
    await utilisateur.click(screen.getByRole('checkbox'))

    const tout = Object.keys(window.localStorage)
      .map((c) => `${c}=${lireStockage('local', c) ?? ''}`)
      .join(' | ')
    expect(tout, 'l’adresse est retenue sur une machine déclarée partagée').not.toContain(ADRESSE)
    expect(tout).not.toContain(SECRET)
  })
})
