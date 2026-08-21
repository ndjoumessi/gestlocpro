import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'

/**
 * Les vitrines n'appartiennent pas à l'espace d'un vrai compte.
 *
 * « Portail locataire (web) » est la MAQUETTE de ce que verra un locataire — le
 * produit n'existe pas, l'adresse qu'elle affiche est factice. « États du
 * système » est la démonstration des états que l'interface sait rendre :
 * chargement, vide, erreur, hors ligne.
 *
 * Les deux figuraient pourtant dans la barre latérale d'un propriétaire, parce
 * que leur groupe était le SEUL à ne déclarer aucune condition d'affichage
 * quand tous les autres déclarent leurs rôles. Une omission, pas une décision.
 *
 * Le coût n'était pas que du bruit. « États du système » porte « Repartir du
 * jeu de démonstration », qui remplace à l'écran le parc de l'utilisateur par
 * celui de la démonstration. Rien ne part au serveur et un rechargement rend
 * les vraies données — mais d'ici là un propriétaire lit le parc d'un autre, et
 * toute action qu'il tenterait viserait des objets que le serveur ignore.
 *
 * Deux gardes et non un : l'ENTRÉE retirée de la navigation, et la ROUTE
 * fermée. Le fichier des routes pose lui-même la règle à propos des écrans de
 * gestion — « la même liste de rôles que dans la barre latérale, pour que
 * navigation et accès ne divergent pas ». Retirer le lien en laissant l'adresse
 * ouverte n'aurait caché la vitrine qu'à celui qui ne l'avait jamais visitée.
 */

const VITRINES = [
  ['systeme', 'États du système'],
  ['portail', 'Portail locataire (web)'],
] as const

describe('vitrines, dans la démonstration seulement', () => {
  describe.each(VITRINES)('« %s »', (chemin, libelle) => {
    /**
     * On cherche le LIEN, pas le texte d'un conteneur.
     *
     * Première version de ce garde : elle interrogeait le contenu du `<nav>`
     * intitulé « Tableau de bord ». Les trois cas passaient — et ne prouvaient
     * rien, parce que ces deux entrées n'ont jamais été DANS ce `<nav>` : elles
     * vivent dans un pied qui lui est frère. Le cas négatif était donc vrai
     * avant le correctif comme après.
     *
     * C'est le cas POSITIF — « présente en démonstration » — qui l'a révélé, en
     * échouant là où il aurait dû réussir. Une assertion en négatif ne se
     * vérifie pas toute seule : il lui faut son pendant.
     */
    const liens = () => screen.queryAllByRole('link', { name: libelle })

    it('ne figure pas dans la navigation d’un compte réel', async () => {
      await renderApp('/app')
      expect(liens()).toHaveLength(0)
    })

    it('reste proposée dans la démonstration, dont elle est le propos', async () => {
      await renderApp('/demo')
      await attendreLeChargement()
      expect(liens().length).toBeGreaterThan(0)
    })

    it('rend « écran introuvable » sur l’adresse directe d’un compte réel', async () => {
      await renderApp(`/app/${chemin}`)

      // Un 404 et non une redirection : sous un vrai compte cette adresse
      // n'existe pas, et c'est ce qu'un 404 dit. Rediriger vers le tableau de
      // bord ferait passer une page absente pour une page déplacée.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Écran introuvable')
    })
  })

  it('sert bien la vitrine des états sous la démonstration', async () => {
    // Le pendant positif des trois cas ci-dessus : sans lui, un garde qui
    // fermerait la route PARTOUT les satisferait tous.
    await renderApp('/demo/systeme')
    await attendreLeChargement()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('États du système')
  })

  it('ne laisse aucun filet de séparation sans rien à séparer', async () => {
    // Le groupe de pied devient vide sur un compte réel : son trait supérieur
    // flotterait alors au bas de la barre, à séparer le vide du vide.
    await renderApp('/app')

    const laterale = screen.getByRole('navigation', { name: 'Sections du produit' })
    const pied = laterale.parentElement?.querySelector('.mt-auto')
    expect(pied, 'le conteneur de pied a disparu : ce garde ne vérifie plus rien').not.toBeNull()
    expect(pied?.className).not.toMatch(/border-t/)
  })
})
