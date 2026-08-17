import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'

/**
 * L'issue d'une notification.
 *
 * L'écran des signalements ne portait QU'UNE action — « tout marquer comme
 * lu » — et les cartes elles-mêmes aucune. On lisait « loyer en retard de
 * 24 jours » et il fallait retrouver soi-même l'écran des paiements, puis la
 * ligne. Une notification qui n'ouvre sur rien fait porter à l'utilisateur le
 * travail de navigation que le produit connaît déjà.
 *
 * Ce n'est PAS une action au sens du produit : rien n'est décidé ici, on se
 * déplace. Le commentaire de l'état vide reste vrai — « une notification est
 * produite par le produit, personne n'en crée ».
 */

describe('issue des notifications', () => {
  it('mène chaque nature à l’écran qui la traite', async () => {
    renderApp('/demo/signalements')
    await attendreLeChargement()

    const liens = screen.getAllByRole('link', { name: /ouvrir/i })
    expect(liens.length, 'aucune notification dans le jeu de démonstration').toBeGreaterThan(0)

    /**
     * Les destinations sont VÉRIFIÉES, pas seulement comptées.
     *
     * Un lien qui renverrait toutes les natures au tableau de bord passerait un
     * test qui se contenterait de compter — et serait pire que pas de lien : il
     * ferait perdre le clic en plus de la recherche.
     */
    const cibles = new Set(liens.map((l) => l.getAttribute('href')))
    for (const cible of cibles) {
      expect(cible).toMatch(/\/demo\/(paiements|travaux|releves|cautions)$/)
    }
    // Le jeu porte plusieurs natures : un seul écran cible signalerait que la
    // correspondance est constante.
    expect(cibles.size).toBeGreaterThan(1)
  })

  it('reste dans l’espace où l’on se trouve', async () => {
    renderApp('/demo/signalements')
    await attendreLeChargement()

    // Sous `/demo`, les liens ne doivent pas renvoyer vers `/app` : le visiteur
    // se retrouverait devant l'écran de connexion, sans comprendre pourquoi.
    for (const lien of screen.getAllByRole('link', { name: /ouvrir/i })) {
      expect(lien.getAttribute('href')).toMatch(/^\/demo\//)
    }
  })

  it('donne une issue à chaque carte, pas seulement à la première', async () => {
    renderApp('/demo/signalements')
    await attendreLeChargement()

    const titres = screen.getAllByRole('heading', { level: 2 })
    expect(screen.getAllByRole('link', { name: /ouvrir/i })).toHaveLength(titres.length)
  })
})

