import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from './render'

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
    // Trois occurrences, et c'est voulu : la tuile « loyers attendus », la
    // ligne d'objectif du graphique, et la ligne de réconciliation du
    // recouvrement portent le même montant EXACT. La tuile affichait « 1,4 M »
    // — le même chiffre arrondi, à côté du chiffre juste, ce qui invitait à les
    // comparer et faisait douter du second.
    //
    // La troisième est venue APRÈS, et pour la raison inverse de ce que ce
    // compte pourrait laisser croire : l'anneau du recouvrement décompose
    // exactement ce total sans le nommer nulle part. Répéter le montant sous
    // son propre intitulé est ce qui permet de lire les parts comme une
    // addition — la répétition coûte moins que le rapprochement de tête.
    expect(screen.getAllByText(/1 397 000/).length).toBe(3)
  })

  /**
   * Le sélecteur s'éprouve là où il vit : la DÉMONSTRATION.
   *
   * Il n'a jamais été un contrôle d'accès — il change le point de vue de la
   * page, pas ce que le serveur accorde — et il ne s'affiche plus sur un vrai
   * compte, où le rôle vient de l'adhésion. Le monter sous `/app` éprouverait
   * donc un contrôle que l'utilisateur n'y trouve pas.
   */
  it('bascule le profil actif, dans la démonstration', async () => {
    renderApp('/demo')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vue consolidée du parc')

    await switchRole('tenant')

    await attendreLeChargement()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mon espace locataire')
  })
})
