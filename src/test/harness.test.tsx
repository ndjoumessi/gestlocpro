import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole } from './render'

/**
 * Vérifie le harnais lui-même : providers montés, routage en mémoire,
 * préférences lues au démarrage, bascule de profil opérante. Si ces cas
 * tombent, l'échec des autres suites ne veut rien dire.
 */
describe('harnais de test', () => {
  it('monte la landing avec ses providers', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/parc locatif/i)
  })

  it('honore la langue passée en préférence', () => {
    renderApp('/', { locale: 'en' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/rental portfolio/i)
  })

  it('honore la devise passée en préférence', () => {
    renderApp('/app', { currency: 'EUR' })
    // 1 397 000 : la somme des loyers des dix unités occupées. Ce test
    // attendait 1 415 000 — la valeur écrite à la main dans `KPIS`, qui ne se
    // recoupait avec rien. Le chiffre change parce qu'il devient vrai.
    expect(screen.getByText(/1 397 000/)).toBeInTheDocument()
  })

  it('bascule le profil actif', async () => {
    renderApp('/app')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vue consolidée du parc')

    await switchRole('tenant')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mon espace locataire')
  })
})
