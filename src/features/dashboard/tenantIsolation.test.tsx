import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole } from '@/test/render'
import { CURRENT_TENANT_UNIT, UNITS } from '@/data/portfolio'

/**
 * Cloisonnement du rôle locataire.
 *
 * C'est l'invariante la plus sensible du produit : un locataire ne doit jamais
 * voir les données d'un autre. Elle a été mise en place après coup — la
 * navigation était filtrée, le contenu ne l'était pas, et le tableau de bord
 * affichait les impayés de quatre autres locataires sous un libellé « Ses
 * propres données uniquement ».
 *
 * Ces tests n'énumèrent pas ce que le locataire doit voir : ils vérifient
 * qu'aucun nom d'autre locataire n'apparaît nulle part. Formulée en négatif, la
 * règle continue de tenir quand on ajoute un écran, alors qu'une liste blanche
 * serait muette sur les écrans futurs.
 */

/** Tous les locataires du parc sauf celui qui est connecté. */
const AUTRES_LOCATAIRES = UNITS.filter(
  (unit) => unit.tenant !== null && unit.id !== CURRENT_TENANT_UNIT,
).map((unit) => unit.tenant as string)

/** Écrans que la barre latérale propose au locataire. */
const ECRANS_AUTORISES = [
  ['/app', 'espace locataire'],
  ['/app/paiements', 'paiements'],
  ['/app/etats-des-lieux', 'états des lieux'],
  ['/app/travaux', 'travaux'],
  ['/app/signalements', 'signalements'],
] as const

/** Écrans de gestion, retirés de sa navigation et interdits d'accès direct. */
const ECRANS_INTERDITS = [
  ['/app/parc', 'parc immobilier'],
  ['/app/releves', 'relevés'],
  ['/app/cautions', 'cautions'],
  ['/app/locataires', 'locataires'],
  ['/app/onboarding', 'onboarding'],
] as const

describe('cloisonnement du locataire', () => {
  it('connaît d’autres locataires à masquer', () => {
    // Garde-fou du test lui-même : si le jeu de démonstration se vidait, les
    // assertions ci-dessous passeraient sans rien prouver.
    expect(AUTRES_LOCATAIRES.length).toBeGreaterThan(3)
  })

  describe.each(ECRANS_AUTORISES)('écran %s', (route) => {
    it('ne cite aucun autre locataire', async () => {
      renderApp(route)
      await switchRole('tenant')

      const main = screen.getByRole('main')
      for (const nom of AUTRES_LOCATAIRES) {
        expect(main).not.toHaveTextContent(nom)
      }
    })
  })

  describe.each(ECRANS_INTERDITS)('écran de gestion %s', (route) => {
    it('refuse l’accès direct et l’explique', async () => {
      renderApp(route)
      await switchRole('tenant')

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accès restreint')

      const main = screen.getByRole('main')
      for (const nom of AUTRES_LOCATAIRES) {
        expect(main).not.toHaveTextContent(nom)
      }
    })
  })

  it('n’expose pas les indicateurs de parc sur son tableau de bord', async () => {
    renderApp('/app')
    await switchRole('tenant')

    const main = screen.getByRole('main')
    // Loyers attendus consolidés et taux d'occupation appartiennent au bailleur.
    expect(main).not.toHaveTextContent('1 415 000')
    expect(main).not.toHaveTextContent(/taux d’occupation/i)
    // En revanche il voit bien son propre loyer.
    expect(main).toHaveTextContent('145 000')
  })

  it('ne liste que son propre bail sur l’écran des paiements', async () => {
    renderApp('/app/paiements')
    await switchRole('tenant')

    const lignes = screen.getAllByRole('row')
    // Une ligne d'en-tête plus une seule ligne de données.
    expect(lignes).toHaveLength(2)
    expect(lignes[1]).toHaveTextContent(CURRENT_TENANT_UNIT)
  })

  it('laisse le propriétaire et le gestionnaire voir tout le parc', async () => {
    renderApp('/app/paiements')

    for (const role of ['owner', 'manager'] as const) {
      await switchRole(role)
      const main = screen.getByRole('main')
      for (const nom of AUTRES_LOCATAIRES) {
        expect(main).toHaveTextContent(nom)
      }
    }
  })
})
