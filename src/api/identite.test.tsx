import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import type { EtatSession } from './SessionProvider'

/**
 * Aucune identité de démonstration ne doit apparaître dans un espace réel.
 *
 * Trois textes étaient écrits en dur dans la coquille : « Parc Arsène N. ·
 * Douala » sous le logo, « Arsène N. » dans le sélecteur de profil, « Douala »
 * dans le fil d'Ariane. Ils s'affichaient pour TOUT LE MONDE — un propriétaire
 * découvrait son espace au nom et à la ville d'un inconnu, et ne pouvait plus
 * le distinguer de la démonstration, puisque les deux annonçaient la même
 * identité. Le propriétaire du produit s'y est lui-même trompé.
 *
 * Le garde des identifiants techniques ne pouvait rien y voir : il cherche des
 * `uuid`, et « Arsène N. » n'en est pas un. Ce fichier tend une seconde maille,
 * plus fine — les NOMS du jeu de démonstration.
 */

/** Personnages du jeu de démonstration, qui n'ont rien à faire ailleurs. */
const PERSONNAGES = /Arsène N\.|Diane F\.|Charles N\.|Douala/

const PARC_DU_COMPTE = 'a1b2c3d4-0000-4000-8000-000000000002'

/**
 * Le parc du COMPTE, servi pour de bon.
 *
 * Sans cette route, la lecture du portefeuille échoue et l'écran finit sur
 * « Données indisponibles ». Les cas passaient quand même, et c'est le défaut :
 * ils visaient le titre « Vue consolidée du parc » que le SQUELETTE porte
 * pendant le chargement, donc un état TRANSITOIRE. Ils assertaient l'ordre
 * d'arrivée de deux chaînes parties ensemble — la résolution du module
 * paresseux et celle de la requête — exactement ce que `test/api.ts` décrit
 * sous « un test qui observe une attente doit la tenir, pas la parier ».
 *
 * Le jour où `renderApp` a cessé de rendre la main au milieu de cette fenêtre,
 * le titre visé était déjà remplacé. Rien n'avait changé à l'écran réel : la
 * requête échouait avant comme après, et ces cas n'avaient jamais vu la page
 * chargée qu'ils croyaient lire.
 *
 * Le parc est VIDE et c'est suffisant : ce fichier garde la COQUILLE — le nom
 * du parc, le sélecteur, le fil d'Ariane — et non le contenu du tableau.
 */
function serveurAvecLeParcDuCompte() {
  const serveur = installerFauxServeur({ authentifie: true })
  serveur.quand('GET', `/parks/${PARC_DU_COMPTE}/portfolio`, {
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
  return serveur
}

const SESSION_REELLE: EtatSession = {
  statut: 'connecte',
  compte: {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    email: 'nelson@example.com',
    fullName: 'Nelson Djoumessi',
    locale: 'fr',
    countryCode: 'CM',
    phoneE164: null,
  },
  adhesions: [
    { parkId: 'a1b2c3d4-0000-4000-8000-000000000002', role: 'owner', parkName: 'Résidence Makepe', currency: 'XAF' },
  ],
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('identité affichée dans la coquille', () => {
  it('porte le nom du parc du compte, et non celui d’un personnage', async () => {
    serveurAvecLeParcDuCompte()
    await renderApp('/app', { session: SESSION_REELLE })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    expect(screen.getAllByText(/Résidence Makepe/).length).toBeGreaterThan(0)
  })

  it('ne laisse AUCUN nom de démonstration à l’écran d’un compte réel', async () => {
    // Le filet. Il ne dit pas ce qui doit s'afficher — il dit ce qui ne le doit
    // jamais.
    serveurAvecLeParcDuCompte()
    await renderApp('/app', { session: SESSION_REELLE })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    const texte = document.body.textContent ?? ''
    const trouves = texte.match(new RegExp(PERSONNAGES, 'g')) ?? []
    expect(trouves, 'identité de démonstration visible dans un espace réel').toEqual([])
  })

  /**
   * Ce cas disait l'inverse, et il avait raison à sa date.
   *
   * Le sélecteur affichait « Propriétaire · Arsène N. » sur un vrai compte ; on
   * lui avait fait porter le nom du titulaire, ce qui retirait bien l'identité
   * d'emprunt. Restait une incohérence que ce correctif-là ne pouvait pas voir :
   * il donnait alors à l'utilisateur TROIS profils à son propre nom, dont deux
   * rôles qu'il n'a pas. Nommer correctement une chose qui n'a pas lieu d'être
   * ne la justifie pas.
   *
   * Le sélecteur n'a jamais été un contrôle d'accès — le serveur décide, lui —
   * mais un point de vue de démonstration. Il y reste ; ici, le rôle vient de
   * l'adhésion.
   */
  it('n’offre aucun sélecteur de profil sur un compte réel', async () => {
    serveurAvecLeParcDuCompte()
    await renderApp('/app', { session: SESSION_REELLE })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    expect(screen.queryByText('Profil actif')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0)

    // Le nom du titulaire reste affiché là où il situe l'espace — le parc dans
    // la barre latérale, le compte dans l'en-tête — sans passer par un choix de
    // rôle. Sans cette assertion, vider la coquille satisferait le cas.
    expect(screen.getAllByText(/Résidence Makepe/).length).toBeGreaterThan(0)
  })

  it('annonce « Parc de démonstration » en visite, et garde ses personnages', async () => {
    // En démonstration les trois personnages sont le propos : ils restent.
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo', { session: { statut: 'demo' } })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    expect(screen.getAllByText(/Parc de démonstration/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Résidence Makepe/)).not.toBeInTheDocument()
  })
})

describe('parc vide, tableau de bord d’un compte neuf', () => {
  it('n’offre PAS d’exporter un relevé ni d’enregistrer un paiement', async () => {
    /**
     * L'état exact d'un compte qui vient d'être créé.
     *
     * L'écran proposait « Exporter le relevé » et « Enregistrer un paiement » —
     * deux gestes impossibles : il n'y a ni relevé à sortir, ni bail sur lequel
     * imputer quoi que ce soit. Un écran vide qui offre deux actions
     * impraticables décourage plus qu'un écran vide qui n'en offre aucune.
     */
    const serveur = serveurAvecLeParcDuCompte()
    serveur.quand('GET', `/parks/${SESSION_REELLE.statut === 'connecte' ? SESSION_REELLE.adhesions[0]!.parkId : ''}/portfolio`, {
      status: 200,
      body: { collections: [], buildings: [], works: [], deposits: [], readings: [], inspections: [], notifications: [] },
    })

    await renderApp('/app', { session: SESSION_REELLE })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    expect(await screen.findByText(/votre parc est encore vide/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exporter le relevé/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enregistrer un paiement/i })).not.toBeInTheDocument()
  })

  it('renvoie vers le geste qui constitue le parc', async () => {
    // Ce test disait l'inverse il y a une heure : « ne promet pas un geste que
    // le produit ne permet pas ». Le geste existe désormais — écran du parc,
    // modale, route serveur — et l'état vide doit y conduire. Un test qui garde
    // l'ancienne vérité empêcherait la nouvelle.
    const serveur = serveurAvecLeParcDuCompte()
    serveur.quand('GET', `/parks/${SESSION_REELLE.statut === 'connecte' ? SESSION_REELLE.adhesions[0]!.parkId : ''}/portfolio`, {
      status: 200,
      body: { collections: [], buildings: [], works: [], deposits: [], readings: [], inspections: [], notifications: [] },
    })

    await renderApp('/app', { session: SESSION_REELLE })
    await screen.findByText(/votre parc est encore vide/i)
    const lien = await screen.findByRole('link', { name: /ajouter un immeuble/i })
    expect(lien).toHaveAttribute('href', '/app/parc')
  })
})
