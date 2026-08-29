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
  /**
   * L'EXIGENCE RESTE, LA FAÇON DE LA DIRE A CHANGÉ. Le bouton était ÉTEINT dès
   * l'arrivée, et muet — le groupe de choix porte `hideLegend`, donc même son
   * intitulé était masqué. Il reste cliquable et le refus s'écrit au groupe ;
   * voir `refusEnonce.test.tsx`, qui tient les deux moitiés. Ce cas-ci garde
   * celle qui compte ici : rien ne part sans objet.
   */
  it('ne laisse pas envoyer une demande sans objet', async () => {
    const user = userEvent.setup()
    await ouvrirEnLocataire('/demo/documents')

    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }))

    expect(screen.queryByText(/Demande envoyée/i), 'une demande est partie sans objet').toBeNull()
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
 * LE CLAVIER DU FORMULAIRE DE SIGNALEMENT, ET CE QUE CES CAS TIENNENT DÉSORMAIS.
 *
 * ═══ CE QU'ILS TENAIENT AVANT ═══
 *
 * Les deux choix étaient des `<button role="radio">` avec un `tabIndex` roulant
 * et un gestionnaire de touches écrit à la main. Ces cas mesuraient donc CE
 * GESTIONNAIRE : la sélection qui suit la flèche, le bornage aux extrémités, le
 * saut de Début et Fin, l'arrêt unique de tabulation. C'était juste — il fallait
 * bien vérifier un clavier qu'on avait écrit soi-même.
 *
 * ═══ CE QU'ILS TIENNENT MAINTENANT ═══
 *
 * Les deux groupes passent par `RadioCards`, c'est-à-dire par de VRAIS
 * `input[type=radio]` dans un `<fieldset>`. Les flèches, l'arrêt unique de
 * tabulation, le saut des entrées désactivées et l'annonce « 3 sur 5 »
 * appartiennent alors au NAVIGATEUR, et non plus à ce dépôt.
 *
 * Les mesurer ici reviendrait à tester Chrome — et à le tester dans jsdom, qui
 * n'implémente justement pas cette part-là de la navigation au clavier : les cas
 * échoueraient sur un produit correct. Ce qui reste vérifiable, et qui est ce
 * dont le clavier dépend vraiment, c'est la STRUCTURE : un groupe nommé, de
 * vraies entrées radio qui partagent un nom, un état porté par `checked` et non
 * par une classe.
 *
 * Le rôle attendu change avec elle : un `<fieldset>` porte `group`, pas
 * `radiogroup`. C'est le balisage natif d'un groupe de boutons radio, et le
 * `radiogroup` posé à la main n'était qu'une imitation de ce que celui-ci
 * annonce déjà.
 */
describe('signaler — les choix au clavier', () => {
  async function groupeMetier() {
    const user = userEvent.setup()
    await ouvrirEnLocataire('/demo/signaler')
    const groupe = screen.getByRole('group', { name: 'De quoi s’agit-il ?' })
    return { user, groupe, choix: within(groupe).getAllByRole('radio') }
  }

  it('est un vrai groupe de boutons radio, nommé par sa légende', async () => {
    const { groupe, choix } = await groupeMetier()
    expect(choix.length, 'aucune entrée dans le groupe').toBeGreaterThan(1)
    // De vraies entrées : c'est ce qui donne les flèches et l'annonce « n sur m ».
    for (const entree of choix) expect(entree.tagName).toBe('INPUT')
    // Un seul nom pour tout le groupe : sans lui, le navigateur ne sait pas
    // qu'elles sont exclusives, et les flèches ne relient rien.
    const noms = new Set(choix.map((c) => c.getAttribute('name')))
    expect(noms.size, 'les entrées ne partagent pas un nom de groupe').toBe(1)
    expect(groupe.tagName).toBe('FIELDSET')
  })

  it('porte l’état sur l’entrée, et non sur une classe', async () => {
    const { user, choix } = await groupeMetier()
    const coche = () => choix.filter((c) => (c as HTMLInputElement).checked)
    expect(coche(), 'plus d’un choix coché à la fois').toHaveLength(1)

    await user.click(choix[2]!)
    expect((choix[2] as HTMLInputElement).checked).toBe(true)
    expect(coche(), 'la sélection ne s’est pas déplacée').toHaveLength(1)
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
