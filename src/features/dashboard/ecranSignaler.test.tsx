import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'

/**
 * L'écran « Signaler », que la maquette du portail décrit.
 *
 * Le formulaire existait, en MODALE posée sur l'écran des travaux. La maquette
 * en fait un écran, et pour une raison qui n'est pas cosmétique : elle y adosse
 * « Mes signalements ». Un locataire qui déclare veut d'abord savoir si le
 * précédent a été traité — sans cette liste, il redéclare ce qui est en cours.
 */
describe('écran Signaler', () => {
  it('est proposé au locataire, et liste SES signalements', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/signaler/i)
    // Le formulaire est POSÉ À PLAT, il n'est plus derrière un bouton qui
    // ouvre une modale : c'est le point des maquettes, et la raison n'est pas
    // cosmétique — la modale masquait « Mes signalements » à l'instant précis
    // où elle sert, et le locataire redéclarait ce qui était en cours.
    expect(screen.getByRole('button', { name: /envoyer le signalement/i })).toBeInTheDocument()
    // Les deux choix exclusifs sont des `radiogroup` et non des rangées de
    // boutons : l'exclusivité est portée par la sémantique, et un lecteur
    // d'écran annonce « 3 sur 5 » plutôt que cinq boutons sans lien.
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
    expect(screen.getByRole('main')).toHaveTextContent(/mes signalements/i)
  })

  it('n’expose jamais le montant des travaux', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    /**
     * « Le coût des travaux n'est jamais exposé au locataire », dit la maquette
     * en pied de page. Le devis regarde le bailleur ; ce qui intéresse le
     * locataire est où en est SA demande.
     */
    expect(screen.getByRole('main').textContent).not.toMatch(/FCFA|€/)
  })

  it('ne liste QUE les siens', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    /**
     * L'invariante de cloisonnement ne suffisait pas ici : elle traque les NOMS
     * des autres locataires, et une intervention n'en porte pas. Sans ce cas,
     * retirer le filtre ne faisait rien tomber — le locataire aurait vu les
     * pannes de tout l'immeuble sans qu'un test s'en aperçoive.
     *
     * « Fuite sous l'évier de la cuisine » appartient à A3 ; le locataire de la
     * démonstration occupe A1.
     */
    expect(screen.getByRole('main').textContent).not.toMatch(/évier de la cuisine/i)
  })

  /**
   * Ce cas SURVIT à l'ouverture de la création au bailleur, et c'est délibéré.
   *
   * Le bailleur peut désormais ouvrir un chantier — mais depuis l'écran des
   * TRAVAUX, sur un logement qu'il choisit. Pas depuis celui-ci. « Signaler »
   * reste ce qu'il est : l'écran de qui habite et constate, adossé à ses
   * propres signalements. Le bailleur ne constate pas une fuite chez quelqu'un
   * d'autre, il la reçoit — et cette phrase-là n'a pas vieilli.
   *
   * Deux gestes, deux écrans, deux verbes. Les fondre aurait donné au bailleur
   * un formulaire dont chaque mot s'adresse au locataire : « votre gestionnaire
   * et votre bailleur le reçoivent immédiatement ».
   */
  it('n’offre pas de déclarer au bailleur, qui reçoit au lieu de signaler', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /envoyer le signalement/i })).not.toBeInTheDocument()
  })
})

/**
 * La description est OBLIGATOIRE, et le formulaire le vérifie.
 *
 * Le champ portait l'astérisque du champ obligatoire, mais rien ne le
 * contrôlait : soumis à vide, il annonçait « signalement envoyé » pour un
 * message sans contenu. Le locataire croyait avoir alerté, personne n'avait
 * rien reçu.
 *
 * Ces deux cas vivaient dans `screens.test.tsx`, sur la COPIE que la
 * prévisualisation du portail entretenait. Ils étaient les seuls gardiens de
 * cette règle dans tout le dépôt — et ils la gardaient sur un formulaire qui
 * n'est pas celui du produit. Ils visent désormais le vrai écran.
 */
describe('écran Signaler — la description est obligatoire', () => {
  async function ouvrir() {
    const user = userEvent.setup()
    renderApp('/demo/signaler')
    await switchRole('tenant')
    await attendreLeChargement()
    return { user }
  }

  it('refuse un envoi sans description', async () => {
    const { user } = await ouvrir()
    await user.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))

    expect(screen.getByText(/Décrivez le problème en quelques mots/)).toBeInTheDocument()
    expect(screen.queryByText(/Signalement envoyé/)).not.toBeInTheDocument()
  })

  it('envoie une fois le problème décrit', async () => {
    const { user } = await ouvrir()
    await user.type(
      screen.getByRole('textbox', { name: /Que se passe-t-il/ }),
      'Le robinet de la cuisine goutte sans arrêt depuis lundi.',
    )
    await user.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))

    expect(await screen.findByText(/Signalement envoyé/)).toBeInTheDocument()
  })
})
