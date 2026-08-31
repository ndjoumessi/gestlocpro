import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent, within } from '@/test/render'

/**
 * L'écran « Signaler », que la maquette du portail décrit.
 *
 * Le formulaire existait, en MODALE posée sur l'écran des travaux. La maquette
 * en fait un écran, et pour une raison qui n'est pas cosmétique : elle y adosse
 * « Mes signalements ». Un locataire qui déclare veut d'abord savoir si le
 * précédent a été traité — sans cette liste, il redéclare ce qui est en cours.
 */
/**
 * LE SIGNALEMENT A UN FIL, et il n'en avait aucun.
 *
 * ═══ LE MÊME DÉFAUT QUE CELUI DU MATIN, DANS L'AUTRE SENS ═══
 *
 * Le lot précédent a fait remonter le signalement jusqu'au bailleur : l'écran
 * le promettait — « votre gestionnaire et votre bailleur le reçoivent
 * immédiatement » — et personne ne recevait rien.
 *
 * Le retour souffrait de la moitié symétrique. `workReply` EXISTE côté serveur
 * depuis longtemps : quand le gestionnaire répond, une notification part vers
 * le compte du locataire, avec le texte et le `workId` qui la rattache au
 * signalement. Son propre commentaire dit pourquoi : « sans lui, les réponses
 * s'empileraient dans une liste sans dire de quoi elles parlent ».
 *
 * Cette liste-là ne les affichait NULLE PART. Le locataire déclarait, lisait
 * « Signalé », et n'avait plus aucune nouvelle — la réponse écrite pour lui
 * restait dans une donnée que son écran ne lisait pas.
 *
 * ═══ ET L'ABSENCE DE RÉPONSE SE DIT AUSSI ═══
 *
 * Un signalement muet et un signalement sans réponse se ressemblaient. « Pas
 * encore de réponse » n'est pas une politesse : c'est ce qui distingue « on ne
 * m'a pas répondu » de « la réponse ne s'affiche pas », et le locataire n'a
 * aucun autre moyen de faire cette différence.
 */
describe('le fil d’un signalement', () => {
  it('montre au locataire la réponse de son gestionnaire', async () => {
    await renderApp('/demo/signaler')
    await switchRole('tenant')
    await attendreLeChargement()

    const mienne = screen.getByText(/Groupe de sécurité/i).closest('li')!
    expect(
      within(mienne).getByText(/vanne remplacée/i),
      'la réponse écrite pour le locataire ne lui est montrée nulle part',
    ).toBeInTheDocument()
  })

  /**
   * IL VOIT CE QU'IL A ÉCRIT.
   *
   * La liste ne portait que le TITRE — « Manque de courant » — et jamais les
   * détails saisis sous « Depuis quand, à quel moment, ce que vous avez déjà
   * tenté ». Le locataire écrit trois lignes, les envoie, et son écran ne lui
   * en rend rien : il ne peut ni vérifier ce qu'il a transmis, ni s'y référer
   * au téléphone, ni savoir s'il a oublié l'essentiel.
   *
   * Le champ voyageait pourtant jusqu'au serveur, qui le RANGE et le RELIT dans
   * son portefeuille. Seule la projection du client le laissait tomber.
   */
  it('lui rend les détails qu’il a saisis', async () => {
    await renderApp('/demo/signaler')
    await switchRole('tenant')
    await attendreLeChargement()

    const mienne = screen.getByText(/Serrure de la porte/i).closest('li')!
    expect(
      within(mienne).getByText(/depuis mardi/i),
      'il ne peut pas relire ce qu’il a transmis',
    ).toBeInTheDocument()
  })

  it('dit quand il n’y a pas encore de réponse', async () => {
    await renderApp('/demo/signaler')
    await switchRole('tenant')
    await attendreLeChargement()

    /* La moitié sans laquelle n'afficher que les réponses laisserait le
       locataire incapable de distinguer « on ne m'a pas répondu » de « la
       réponse ne s'affiche pas ». */
    const sansReponse = screen
      .getAllByRole('listitem')
      .find((li) => !/vanne remplacée/i.test(li.textContent ?? ''))
    expect(sansReponse).toBeDefined()
    expect(within(sansReponse!).getByText(/pas encore de réponse/i)).toBeInTheDocument()
  })
})

describe('écran Signaler', () => {
  it('est proposé au locataire, et liste SES signalements', async () => {
    await renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/signaler/i)
    // Le formulaire est POSÉ À PLAT, il n'est plus derrière un bouton qui
    // ouvre une modale : c'est le point des maquettes, et la raison n'est pas
    // cosmétique — la modale masquait « Mes signalements » à l'instant précis
    // où elle sert, et le locataire redéclarait ce qui était en cours.
    expect(screen.getByRole('button', { name: /envoyer le signalement/i })).toBeInTheDocument()
    /*
      LES DEUX CHOIX EXCLUSIFS SONT DE VRAIS GROUPES DE BOUTONS RADIO, et non
      des rangées de boutons : l'exclusivité est portée par la sémantique, et un
      lecteur d'écran annonce « 3 sur 5 » plutôt que cinq boutons sans lien.

      DÉSIGNÉS PAR LEUR NOM, et non comptés. Ils étaient des `radiogroup` posés à
      la main ; ce sont maintenant des `<fieldset>`, dont le rôle implicite est
      `group` — le balisage natif, celui que le `radiogroup` imitait. Or `group`
      est aussi le rôle d'autres choses de la page, et compter « deux » y
      mélangeait des objets qui n'ont rien à voir. On nomme donc les deux qu'on
      veut, ce qui dit en plus qu'ils portent bien leur légende.
    */
    expect(screen.getByRole('group', { name: /de quoi s’agit-il/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /à quel point est-ce urgent/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/mes signalements/i)
  })

  it('n’expose jamais le montant des travaux', async () => {
    await renderApp('/demo/signaler')
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
    await renderApp('/demo/signaler')
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
    await renderApp('/demo/signaler')
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
    await renderApp('/demo/signaler')
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
