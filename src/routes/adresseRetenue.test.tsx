import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderApp, screen, userEvent, SESSION_ANONYME } from '@/test/render'
import { installerFauxServeur, type FauxServeur } from '@/test/api'
import { COMPTE_FICTIF } from '@/test/api'
import { lireStockage } from '@/lib/stockage'

/**
 * L'ADRESSE REVIENT QUAND LA MACHINE EST À SOI, ET SEULEMENT ALORS.
 *
 * ═══ CE QUE LE LOT PRÉCÉDENT A REFUSÉ, ET POURQUOI IL AVAIT TORT ═══
 *
 * « Retenir l'identifiant sur la machine qu'on vient de déclarer partagée le
 * dirait au suivant. » L'argument est juste — et il ne vaut QUE dans le cas
 * décoché. Cochée, la case dit l'inverse : cet appareil est à moi, retiens-moi
 * dessus. Refuser de retenir l'adresse dans ce cas-là, c'est offrir une case
 * qui promet la continuité et ne la donne pas — le défaut même que ce dépôt a
 * passé trois lots à retirer de cet écran.
 *
 * ═══ LE CONTRAT, EN DEUX MOITIÉS INDISSOCIABLES ═══
 *
 * COCHÉE : l'adresse est retenue, et elle revient. Jamais le mot de passe —
 * c'est le travail du gestionnaire du navigateur, sous le contrôle de son
 * propriétaire, et un secret rangé par nous dans `localStorage` serait à la
 * portée de la première injection de script.
 *
 * DÉCOCHÉE : l'adresse est EFFACÉE sur-le-champ, sans attendre une connexion.
 * C'est la moitié qui compte : sans elle, quelqu'un qui décoche par prudence
 * laisserait quand même son identifiant derrière lui, et la case mentirait dans
 * la direction la plus grave.
 *
 * ═══ QUAND ON ÉCRIT ═══
 *
 * À la connexion RÉUSSIE, pas à la frappe. Une adresse retenue avant d'être
 * éprouvée serait une faute de frappe conservée pour toujours, resservie à
 * chaque visite — et l'écran reprocherait alors un identifiant qu'il a
 * lui-même proposé.
 */

const ADRESSE = 'proprietaire@exemple.cm'
const SECRET = 'un-mot-de-passe-assez-long'
const CLE = 'gestlocpro.session.adresse'

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur({ authentifie: false })
  serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
  serveur.quand('GET', '/auth/me', { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } })
})

async function seConnecter(decocher: boolean) {
  const utilisateur = userEvent.setup()
  await renderApp('/connexion', { session: SESSION_ANONYME })
  await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
  await utilisateur.type(screen.getByLabelText(/^mot de passe/i), SECRET)
  if (decocher) await utilisateur.click(screen.getByRole('checkbox'))
  await utilisateur.click(screen.getByRole('button', { name: /^se connecter$/i }))
  return utilisateur
}

describe('l’adresse retenue sur un appareil que l’on garde', () => {
  it('revient pré-remplie à la visite suivante', async () => {
    await seConnecter(false)

    cleanup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    expect(
      screen.getByLabelText(/adresse e-mail/i),
      'l’adresse ne revient pas : la case promet une continuité qu’elle ne donne pas',
    ).toHaveValue(ADRESSE)
  })

  it('n’est retenue qu’une fois la connexion RÉUSSIE', async () => {
    /* Une adresse rangée à la frappe serait une faute de frappe conservée pour
       toujours, et resservie à chaque visite par l'écran qui la reprochera. */
    const utilisateur = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), 'faute-de-frappe@')

    expect(lireStockage('local', CLE), 'une adresse jamais éprouvée est déjà retenue').toBeNull()
  })
})

describe('l’adresse sur un appareil que l’on ne garde pas', () => {
  it('n’est PAS retenue quand la case est décochée', async () => {
    await seConnecter(true)
    expect(
      lireStockage('local', CLE),
      'l’identifiant reste sur une machine déclarée partagée',
    ).toBeNull()
  })

  it('est EFFACÉE dès qu’on décoche, sans attendre quoi que ce soit', async () => {
    /* LA MOITIÉ QUI COMPTE. Décocher n'est pas seulement « ne plus retenir à
       l'avenir » : c'est un geste de retrait, et il doit retirer ce qui est
       déjà là. Sans ce cas, quelqu'un qui décoche par prudence laisserait son
       identifiant derrière lui — la case mentirait dans la direction la plus
       grave qui soit. */
    await seConnecter(false)
    expect(lireStockage('local', CLE)).toBe(ADRESSE)

    cleanup()
    const utilisateur = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await utilisateur.click(screen.getByRole('checkbox'))

    expect(lireStockage('local', CLE), 'décocher ne retire pas la trace déjà posée').toBeNull()
  })

  it('ne laisse JAMAIS le mot de passe derrière elle, dans aucun des deux cas', async () => {
    /* La garde du garde : ce lot pourrait « retenir l'identifiant » en rangeant
       le formulaire entier, et les cas ci-dessus resteraient verts. On relit
       donc TOUT ce que l'écran a laissé sur la machine. */
    await seConnecter(false)
    const tout = Object.keys(window.localStorage)
      .map((c) => `${c}=${lireStockage('local', c) ?? ''}`)
      .join(' | ')
    expect(tout, 'le mot de passe est rangé dans le stockage du navigateur').not.toContain(SECRET)
  })
})
