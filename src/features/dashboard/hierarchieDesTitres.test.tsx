import { describe, expect, it } from 'vitest'
import { renderApp, screen, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { sautsDeNiveau } from '@/test/titres'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Le sommaire des écrans qui n'ont rien à montrer.
 *
 * `EmptyState` rendait un `<h3>` de niveau FIGÉ. Sous un `CardHeader level={2}`
 * — son usage majoritaire — c'était la marche juste ; servi EN PLEINE PAGE,
 * juste sous le `<h1>` de `PageHeader`, il ouvrait un trou de niveau 2 sur
 * quatorze écrans. Le plus visible d'entre eux est le premier que rencontre un
 * compte neuf : un tableau de bord dont le parc est encore vide.
 *
 * Ces écrans-là ne se rencontrent PAS avec le jeu de démonstration, qui porte
 * un parc complet. C'est pourquoi la hiérarchie a pu se trouer sans que rien
 * ne le signale : le défaut n'existe que là où il n'y a rien.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function session(role: 'owner' | 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/**
 * Un parc DÉCLARÉ et parfaitement vide — pas un parc en cours de chargement.
 *
 * Le serveur répond, et il répond « rien » : c'est l'état d'un compte le jour
 * de sa création, et c'est celui où chaque écran bascule sur son état vide.
 */
function parcSansAucunLogement() {
  const serveur = installerFauxServeur()
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
  return serveur
}

/**
 * La page n'est complète qu'une fois son état vide rendu.
 *
 * Tant que le parc n'est pas arrivé, il n'y a que le titre de l'en-tête : la
 * garde passerait au vert sur une page à demi montée, ce qui est la manière la
 * plus discrète pour un test de ne rien vérifier du tout.
 */
async function attendreLeSecondTitre() {
  await waitFor(() => {
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(1)
  })
}

const ECRANS_DU_BAILLEUR = [
  '/app',
  '/app/parc',
  '/app/parc/99999999-2222-4333-8444-555555555555',
  '/app/paiements',
  '/app/travaux',
  '/app/signalements',
  '/app/etats-des-lieux',
  '/app/cautions',
]

const ECRANS_DU_LOCATAIRE = [
  '/app/mon-espace',
  '/app/documents',
  '/app/signaler',
  '/app/parc',
  '/app/travaux',
  '/app/signalements',
  '/app/etats-des-lieux',
  '/app/cautions',
]

describe('la hiérarchie des titres, sur un parc qui n’a rien à montrer', () => {
  it.each(ECRANS_DU_BAILLEUR)('ne saute aucune marche sur %s', async (route) => {
    parcSansAucunLogement()
    await renderApp(route, { session: session('owner') })
    await attendreLeSecondTitre()

    expect(sautsDeNiveau()).toEqual([])
  })

  it.each(ECRANS_DU_LOCATAIRE)('ne saute aucune marche sur %s, côté locataire', async (route) => {
    parcSansAucunLogement()
    await renderApp(route, { session: session('tenant') })
    await attendreLeSecondTitre()

    expect(sautsDeNiveau()).toEqual([])
  })
})

describe('le niveau que porte un état vide', () => {
  it('suit le titre de la page quand il la remplit tout entière', async () => {
    parcSansAucunLogement()
    await renderApp('/app', { session: session('owner') })

    // Le seul `<h1>` reste celui de l'en-tête : l'état vide ne se hisse pas à
    // la place du titre de page, il prend la marche d'en dessous.
    expect(await screen.findByRole('heading', { level: 2, name: /parc est encore vide/i }))
      .toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /**
   * Le défaut n'a pas bougé, et c'est la moitié qui compte.
   *
   * Le tort n'était pas le niveau 3 — il était son immuabilité. Servi sous le
   * `CardHeader level={2}` de « Mes signalements », un état vide de niveau 3
   * est exactement la marche suivante ; le remonter à 2 aurait déplacé le trou
   * au lieu de le combler.
   */
  it('reste d’un cran sous l’en-tête de la carte qui le contient', async () => {
    parcSansAucunLogement()
    await renderApp('/app/signaler', { session: session('tenant') })

    expect(await screen.findByRole('heading', { level: 3, name: /aucun signalement/i }))
      .toBeInTheDocument()
  })
})
