import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * CE QU'UN `role="menu"` PROMET, ET CE QU'IL EFFACE.
 *
 * ═══ LA RÈGLE EST DÉJÀ ÉCRITE DANS CE DÉPÔT ═══
 *
 * `MenuDeDebordement` la pose en toutes lettres : « un `menu` n'admet que des
 * `menuitem` parmi ses descendants signifiants, et il annonce "2 sur 3" […] un
 * `<Button>` posé là porterait `role="button"` et casserait le décompte ». Le
 * même fichier arbitre aussi les FLÈCHES, et décide de ne pas les tenir : la
 * tabulation boucle déjà dans le panneau. Ce n'est donc pas le rôle qu'il faut
 * corriger sur le menu du compte — c'est ce qu'on a mis dedans.
 *
 * ═══ CE QUE LE MENU DU COMPTE EFFAÇAIT ═══
 *
 * Son en-tête dit pourquoi il existe : « l'avatar doit d'abord dire QUI est
 * connecté — c'est la question qu'on se pose sur un poste partagé avant de se
 * déconnecter, et l'application en a déjà fait les frais ». Le nom et l'adresse
 * vivaient pourtant DANS le `role="menu"`, dans un `div` ordinaire. Un
 * conteneur `menu` n'expose que ses `menuitem` : à un lecteur d'écran, ce
 * panneau annonçait « menu, 2 éléments » et rien d'autre. La seule information
 * qui justifie son existence était invisible à ceux qui ne voient pas l'écran —
 * exactement le public pour qui « qui est connecté ? » est le plus difficile à
 * répondre autrement.
 *
 * Le filet de séparation, ajouté au lot précédent, tombait sous la même règle :
 * un `div` nu entre deux entrées.
 *
 * ═══ CE QUE CETTE GARDE TIENT ═══
 *
 *   1. l'identité n'est pas perdue : elle sort du `menu` et reste à l'écran ;
 *   2. et elle est RENDUE AU MENU par son nom accessible, sans quoi la sortir
 *      l'aurait seulement déplacée hors de portée.
 *
 * QUE LE `menu` NE CONTIENNE QUE DES ENTRÉES est tenu AILLEURS, et mieux :
 * `primitives/menusLicites.test.tsx` pose la règle pour les huit menus du
 * produit — ce fichier n'en garderait qu'un, et avec un prédicat plus faible.
 * Ce qui reste ici est ce qui n'appartient qu'au menu du compte : l'identité.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

async function ouvrirLeMenu(): Promise<HTMLElement> {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
  await renderApp('/app', { session: sessionProprietaire() })
  await attendreLeChargement()
  await userEvent.setup().click(screen.getByRole('button', { name: /compte/i }))
  return screen.getByRole('menu')
}

describe('le menu du compte', () => {
  it('garde l’identité à l’écran, hors du menu', async () => {
    const menu = await ouvrirLeMenu()

    expect(
      within(menu).queryByText(COMPTE_FICTIF.email),
      'l’adresse est dans le menu, donc effacée pour un lecteur d’écran',
    ).toBeNull()
    expect(screen.getByText(COMPTE_FICTIF.email), 'l’adresse a disparu').toBeVisible()
    expect(screen.getByText(COMPTE_FICTIF.fullName), 'le nom a disparu').toBeVisible()
  })

  it('rend l’identité au menu par son nom accessible', async () => {
    const menu = await ouvrirLeMenu()

    expect(
      menu.getAttribute('aria-label') ?? '',
      'le menu ne nomme pas le titulaire du compte',
    ).toContain(COMPTE_FICTIF.fullName)
  })
})
