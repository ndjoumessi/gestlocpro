import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'

/**
 * La coquille du LOCATAIRE — trois entrées, et trois vraies adresses.
 *
 * Sa navigation était celle du bailleur passée au filtre des rôles : huit
 * entrées rangées sous « Pilotage », « Opérations » et « Administration ».
 * Ces trois titres nomment le métier de qui gère un parc ; un locataire
 * n'exploite rien, il habite.
 *
 * Ce que ces tests fixent, et que le filtrage par rôle ne fixait pas : le
 * NOMBRE d'entrées et leur identité. Tant que la navigation se déduisait d'un
 * filtre, ajouter un écran ouvert à tous l'allongeait sans que rien ne s'en
 * aperçoive.
 */
const nav = () => screen.getByRole('navigation', { name: 'Tableau de bord' })

const entrees = () =>
  within(nav())
    .getAllByRole('link')
    .map((a) => a.textContent?.trim())

async function ouvrirEnLocataire(route = '/demo') {
  renderApp(route)
  await switchRole('tenant')
  await attendreLeChargement()
}

describe('coquille du locataire — navigation', () => {
  it('n’expose que ses trois entrées', async () => {
    await ouvrirEnLocataire()
    expect(entrees()).toEqual(['Mon espace', 'Documents', 'Signaler'])
  })

  /**
   * Les écrans de gestion ouverts au locataire — relevés, cautions, paiements,
   * travaux, états des lieux — ne sont pas FERMÉS, ils quittent la navigation.
   * Leur contenu remonte dans les trois entrées, et `tenantIsolation` garde
   * qu'ils restent atteignables et cloisonnés.
   */
  it('retire de la navigation les écrans dont le contenu est replié', async () => {
    await ouvrirEnLocataire()
    for (const parti of ['Relevés', 'Cautions', 'Paiements', 'Travaux', 'États des lieux'])
      expect(entrees(), parti).not.toContain(parti)
  })
})

describe('coquille du locataire — adresses', () => {
  /**
   * « Mon espace » est une VRAIE route et non l'index.
   *
   * Il vivait sous l'index, partagé par les trois rôles : le locataire ne
   * pouvait ni mettre son espace en favori, ni en partager l'adresse, et sa
   * propre navigation pointait vers une page qui sert d'abord quelqu'un d'autre.
   */
  it('conduit l’index du locataire vers sa propre adresse', async () => {
    // Le rendu de test monte un routeur EN MÉMOIRE : `window.location` n'y
    // bouge pas. L'entrée marquée courante prouve la même chose — elle ne
    // s'allume que si l'adresse est bien devenue celle de « Mon espace ».
    await ouvrirEnLocataire('/demo')
    const courante = within(nav()).getByRole('link', { current: 'page' })
    expect(courante).toHaveTextContent('Mon espace')
  })

  it('ouvre « Documents » sur ses quittances', async () => {
    await ouvrirEnLocataire('/demo/documents')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/pièces et quittances/i)
    // Six quittances au jeu de démonstration, chacune téléchargeable.
    expect(screen.getAllByRole('button', { name: 'Télécharger' }).length).toBeGreaterThan(0)
  })

  /**
   * Le dossier contractuel dit la case VIDE plutôt que d'offrir un
   * téléchargement : le produit ne sait ni recevoir un fichier déposé, ni
   * fabriquer un PDF opposable. C'est la règle que le portail a déjà payée une
   * fois, et elle vaut ici pour la même raison.
   */
  it('annonce le bail non déposé au lieu d’un bouton qui ne peut rien produire', async () => {
    await ouvrirEnLocataire('/demo/documents')
    const ligne = screen.getByText('Contrat de bail signé').closest('li')!
    expect(within(ligne).queryByRole('button')).toBeNull()
    expect(ligne).toHaveTextContent('Aucun document déposé')
  })
})
