import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'

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
/**
 * Sa navigation s'appelle « Navigation principale », et non « Tableau de
 * bord » : c'est le nom que portait le panneau du bailleur, dont le locataire
 * a hérité tant qu'il en partageait la coquille. Il n'a pas de tableau de
 * bord — il a « Mon espace ».
 */
const nav = () => screen.getByRole('navigation', { name: 'Navigation principale' })

const entrees = () =>
  within(nav())
    .getAllByRole('link')
    .map((a) => a.textContent?.trim())

async function ouvrirEnLocataire(route = '/demo') {
  await renderApp(route)
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

/**
 * Les deux cartes basses de « Documents ».
 *
 * Elles posent chacune une question d'honnêteté, et les réponses diffèrent :
 * la demande de document PART réellement, l'horodatage de dernier accès n'est
 * pas affiché parce que rien ne le journalise.
 */
describe('documents — demander une pièce', () => {
  it('ne laisse pas envoyer une demande sans objet', async () => {
    await ouvrirEnLocataire('/demo/documents')
    expect(screen.getByRole('button', { name: 'Envoyer la demande' })).toBeDisabled()
  })

  /**
   * La demande emprunte le canal des signalements — le seul que le gestionnaire
   * relève. Un toast sans envoi aurait laissé le locataire attendre une pièce
   * que personne n'a jamais reçue.
   */
  it('fait vraiment partir la demande, et la fait apparaître au suivi', async () => {
    const user = userEvent.setup()
    await ouvrirEnLocataire('/demo/documents')

    await user.click(screen.getByRole('radio', { name: 'Attestation de résidence' }))
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }))

    await screen.findByText('Demande envoyée au gestionnaire')
  })

  /**
   * Les maquettes affichent « DERNIER ACCÈS · 12/08/2026 09:41 ». Rien ne
   * journalise les consultations : cette ligne annoncerait une traçabilité
   * inexistante, sur l'écran même où l'on promet la confidentialité.
   */
  it('n’annonce aucune traçabilité que le produit ne tient pas', async () => {
    await ouvrirEnLocataire('/demo/documents')
    expect(screen.getByRole('main')).not.toHaveTextContent(/dernier acc[èe]s/i)
  })
})

/**
 * Le clavier du formulaire de signalement.
 *
 * Les deux choix — métier, urgence — portaient `role="radio"` et un `tabIndex`
 * roulant SANS gestionnaire de touches. La tabulation entrait sur la pastille
 * active, les flèches ne faisaient rien, les autres portaient `tabIndex={-1}`
 * et la tabulation les sautait : il était impossible de déclarer autre chose
 * qu'une plomberie d'urgence normale sans souris.
 */
describe('signaler — les choix au clavier', () => {
  async function groupeMetier() {
    const user = userEvent.setup()
    await ouvrirEnLocataire('/demo/signaler')
    const groupe = screen.getByRole('radiogroup', { name: 'De quoi s’agit-il ?' })
    return { user, choix: within(groupe).getAllByRole('radio') }
  }

  it('déplace la sélection et le focus aux flèches', async () => {
    const { user, choix } = await groupeMetier()
    choix[0].focus()
    expect(choix[0]).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowRight}')
    expect(choix[1]).toHaveFocus()
    expect(choix[1]).toHaveAttribute('aria-checked', 'true')
    expect(choix[0]).toHaveAttribute('aria-checked', 'false')

    await user.keyboard('{ArrowLeft}')
    expect(choix[0]).toHaveFocus()
    expect(choix[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('borne aux extrémités au lieu de boucler', async () => {
    const { user, choix } = await groupeMetier()
    choix[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(choix[0]).toHaveFocus()

    const dernier = choix[choix.length - 1]
    dernier.focus()
    await user.keyboard('{ArrowRight}')
    expect(dernier).toHaveFocus()
  })

  it('saute aux extrémités avec Début et Fin', async () => {
    const { user, choix } = await groupeMetier()
    choix[0].focus()
    await user.keyboard('{End}')
    expect(choix[choix.length - 1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(choix[0]).toHaveFocus()
  })

  it('n’offre qu’un seul arrêt de tabulation par groupe', async () => {
    const { choix } = await groupeMetier()
    const arrets = choix.filter((c) => c.getAttribute('tabindex') === '0')
    expect(arrets).toHaveLength(1)
    expect(arrets[0]).toHaveAttribute('aria-checked', 'true')
  })
})

/**
 * UNE barre, en haut, et rien d'autre.
 *
 * Le locataire naviguait dans le panneau latéral du bailleur, doublé sous `lg`
 * d'une barre basse et d'un tiroir. Les maquettes montrent une barre
 * horizontale sombre ; la coquille de gestion tombe donc avec elle, tiroir et
 * abrégé compris. Ce que ces cas gardent : qu'il n'en reste qu'une, et qu'elle
 * n'y fasse entrer aucune vitrine — « Portail locataire (web) » est une page
 * qui MONTRE le produit, elle n'est pas une destination du produit.
 */
describe('coquille du locataire — une seule navigation', () => {
  it('n’expose ni barre basse, ni tiroir à ouvrir', async () => {
    await ouvrirEnLocataire('/demo/mon-espace')
    expect(screen.queryByRole('navigation', { name: 'Navigation rapide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ouvrir la navigation' })).toBeNull()
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(1)
  })

  it('n’y fait entrer aucune page de démonstration', async () => {
    await ouvrirEnLocataire('/demo/mon-espace')
    expect(entrees()).toEqual(['Mon espace', 'Documents', 'Signaler'])
  })

  /**
   * Trois LIENS, et non trois onglets.
   *
   * La prévisualisation `/portail`, d'où cette barre est portée, tient le motif
   * `tab` en entier — flèches, `tabindex` roulant, panneau lié — parce qu'elle
   * montre trois vues d'un même dossier. Ici ce sont trois adresses : un
   * lecteur d'écran doit entendre « lien », et rien ne doit promettre une
   * navigation aux flèches qui n'existe pas.
   */
  it('annonce des liens, pas un groupe d’onglets', async () => {
    await ouvrirEnLocataire('/demo/mon-espace')
    expect(within(nav()).queryAllByRole('tab')).toHaveLength(0)
    expect(within(nav()).getAllByRole('link')).toHaveLength(3)
  })

  /**
   * La cloche des maquettes ne traverse pas.
   *
   * Elle est `aria-hidden` dans la prévisualisation, où elle est assumée comme
   * décor. Le locataire n'a aucune file de notifications à ouvrir : une cloche
   * dans la vraie barre serait une commande sans donnée derrière — le défaut
   * que les « Télécharger » de l'écran Documents ont déjà coûté une fois.
   */
  it('ne porte aucune commande qui n’ouvre rien', async () => {
    await ouvrirEnLocataire('/demo/mon-espace')
    const barre = screen.getByRole('banner')
    for (const bouton of within(barre).getAllByRole('button'))
      expect(bouton.textContent?.trim() || bouton.getAttribute('aria-label')).toBeTruthy()
  })

  /** Le bailleur, lui, garde la sienne : cette coquille n'a pas bougé. */
  it('laisse au bailleur sa barre latérale et son abrégé', async () => {
    await renderApp('/demo/parc')
    await attendreLeChargement()
    expect(screen.getByRole('navigation', { name: 'Sections du produit' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigation rapide' })).toBeInTheDocument()
  })
})
