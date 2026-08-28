import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from './render'
import { installerFauxServeur } from './api'

/**
 * Vérifie le harnais lui-même : providers montés, routage en mémoire,
 * préférences lues au démarrage, bascule de profil opérante. Si ces cas
 * tombent, l'échec des autres suites ne veut rien dire.
 */
describe('harnais de test', () => {
  it('monte la landing avec ses providers', async () => {
    await renderApp('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/parc locatif/i)
  })

  it('honore la langue passée en préférence', async () => {
    await renderApp('/', { locale: 'en' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/rental portfolio/i)
  })

  it('honore la devise passée en préférence', async () => {
    await renderApp('/app', { currency: 'EUR' })
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
    /*
      LE MONTANT EST CONVERTI, et c'est le sujet depuis que le produit sait le
      faire : 1 397 000 francs au taux légal de 655,957 font 2 130 €. Le cas
      mesure que la préférence de devise est honorée par le harnais, et il
      mesure désormais aussi qu'elle l'est POUR DE BON — la somme qu'il vérifie
      reste celle des dix unités occupées, dite dans une autre monnaie.

      Les cours viennent du faux serveur, figés : un cas dont le résultat
      dépendrait du cours du jour échouerait demain sans qu'une ligne ait bougé.
    */
    expect(screen.getAllByText(/2\s?130/).length).toBe(3)
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
    await renderApp('/demo')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vue consolidée du parc')

    await switchRole('tenant')

    await attendreLeChargement()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Résidence Bonamoussadi — A1')
  })
})

/**
 * LA RETENUE DU FAUX SERVEUR.
 *
 * POURQUOI CETTE GARDE EXISTE. `retenir` est ce qui permet à un test
 * d'observer une attente au lieu de la parier — voir le commentaire de
 * `barrages` dans `api.ts` pour les mesures qui l'ont rendue nécessaire. Or
 * elle a une manière PARTICULIÈREMENT discrète de cesser de fonctionner :
 * qu'elle réponde tout de suite. Personne ne verrait rien. Les cas qui
 * l'emploient redeviendraient des tirages au sort, verts la plupart du temps,
 * et le prochain à se demander pourquoi la porte clignote repartirait de zéro.
 *
 * C'EST LE MÉCANISME QU'ON ÉPROUVE, pas un écran : la retenue tient, ou elle
 * ne tient pas. Le cas ci-dessous est donc DÉTERMINISTE, sans horloge et sans
 * rendu — il n'aurait aucun sens qu'un contrôle de la course soit lui-même
 * couru.
 *
 * ON N'EMPLOIE PAS DE `setTimeout` POUR « LAISSER LE TEMPS ». On épuise les
 * microtâches par des `await` successifs, puis on laisse passer un tour de
 * boucle : si la retenue ne retenait pas, la promesse du `fetch` — qui n'a
 * besoin que de microtâches pour aboutir — serait résolue au terme de cette
 * séquence. C'est ce que la sonde a montré : sans retenue, la réponse arrive
 * en quelques microtâches, ce qui est exactement plus vite qu'un rendu React.
 */
describe('retenue du faux serveur', () => {
  it('ne répond pas tant qu’on ne la relâche pas, puis répond', async () => {
    const serveur = installerFauxServeur()
    const relacher = serveur.retenir('GET', '/sonde', { status: 200, body: { ok: true } })

    let resolue = false
    const enVol = fetch('/api/sonde').then(() => {
      resolue = true
    })

    for (let i = 0; i < 10; i++) await Promise.resolve()
    await new Promise((suite) => setTimeout(suite, 0))

    // La requête est PARTIE — le faux serveur l'a enregistrée — et elle n'a
    // pas abouti. Les deux moitiés comptent : une retenue qui empêcherait la
    // requête de partir ne tiendrait pas l'écran dans son état d'attente, elle
    // l'empêcherait d'y entrer.
    expect(serveur.appels.some((a) => a.chemin === '/sonde')).toBe(true)
    expect(resolue).toBe(false)

    relacher()
    await enVol
    expect(resolue).toBe(true)
  })
})
