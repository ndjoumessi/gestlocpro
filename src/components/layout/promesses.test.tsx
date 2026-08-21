import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'

/**
 * Les promesses de la page d'inscription doivent être TENUES.
 *
 * Cette colonne annonçait « Relances automatiques » sur l'écran où l'on crée
 * son compte. Le produit n'a aucune relance — ni automatique, ni manuelle.
 *
 * C'est le pire endroit pour une promesse fausse : elle est lue au moment
 * précis où quelqu'un décide de s'engager, et la déception arrive quelques
 * minutes plus tard, dans un espace vide. Une fonctionnalité annoncée puis
 * introuvable coûte plus qu'une fonctionnalité absente.
 */
describe('promesses de la page d’inscription', () => {
  it('n’annonce pas de relances tant que le produit n’en fait pas', async () => {
    await renderApp('/inscription/proprietaire')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/relances/i)).not.toBeInTheDocument()
  })

  it('annonce quatre choses que le produit sait faire', async () => {
    await renderApp('/inscription/proprietaire')
    await screen.findByRole('heading', { level: 1 })
    for (const promesse of [
      /suivi des loyers/i,
      /eau et électricité/i,
      /cautions/i,
      /états des lieux/i,
    ]) {
      expect(screen.getByText(promesse), String(promesse)).toBeInTheDocument()
    }
  })
})
