import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * ON SAIT QUI L'ON EST DÈS LA PREMIÈRE SECONDE.
 *
 * ═══ DEUX INTERFACES QUE RIEN NE SÉPARAIT ═══
 *
 * Le propriétaire et le gestionnaire partagent la même coquille, la même barre
 * latérale, presque les mêmes écrans — deux entrées les distinguent, et elles
 * sont en bas de liste. Demandé par l'usage, après une session passée à ne pas
 * savoir sous quel compte on se trouvait : « serait-il intéressant pour le
 * propriétaire et le gestionnaire d'avoir un truc qui les différencie après le
 * login, car leur interface est similaire ».
 *
 * Ce n'est pas qu'un confort. Les deux rôles n'ont pas les mêmes DROITS — le
 * gestionnaire propose, le propriétaire arbitre — et se tromper de compte fait
 * chercher un bouton qui n'existe pas, ou pire, croire qu'un geste a échoué.
 *
 * ═══ DANS LE FIL D'EN-TÊTE, À CÔTÉ DU PARC ═══
 *
 * C'est le seul endroit déjà présent sur TOUS les écrans, et il porte déjà
 * l'autre moitié de la réponse : QUEL parc. « Quel parc, à quel titre » se lit
 * d'un bloc. Le mettre dans le menu du compte l'aurait caché derrière un clic,
 * c'est-à-dire au moment où l'on se pose la question, pas avant.
 */
const PARC = '11111111-2222-4333-8444-555555555555'

function session(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

beforeEach(() => {
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
      leaseCharges: [],
    },
  })
})

describe('le fil d’en-tête', () => {
  it('dit PROPRIÉTAIRE quand on l’est', async () => {
    await renderApp('/app', { session: session('owner') })
    expect(document.body.textContent ?? '').toMatch(/Parc Bastos.*Propriétaire/s)
  })

  it('dit GESTIONNAIRE quand on l’est, et ce n’est pas le même mot', async () => {
    /* Les deux cas séparés, et non un seul paramétré : c'est la DIFFÉRENCE qui
       est le sujet. Un libellé unique passerait les deux. */
    await renderApp('/app', { session: session('manager') })
    const page = document.body.textContent ?? ''
    expect(page).toMatch(/Parc Bastos.*Gestionnaire/s)
    expect(page, 'le gestionnaire est présenté comme propriétaire').not.toMatch(/· Propriétaire/)
  })

  it('ne dit rien de tel en DÉMONSTRATION, où le profil se choisit', async () => {
    /* La démonstration a son propre sélecteur de profil, qui affiche déjà les
       trois rôles et leurs droits. Y ajouter un rôle figé dirait le contraire
       de ce que ce sélecteur propose. */
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo')
    expect(document.body.textContent ?? '').not.toMatch(/Parc de démonstration · /)
  })
})
