import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { installerFauxServeur, type FauxServeur } from '@/test/api'

/**
 * Un jeton de la forme que le SERVEUR produit — `randomBytes(32)` en base64url,
 * quarante-trois caractères, majuscules et tirets compris.
 *
 * Il valait auparavant `DEMO_RESET_TOKEN`, seize caractères hexadécimaux, et
 * c'est ce qui a masqué le défaut : les cas client validaient une forme
 * inventée, les cas serveur frappaient la route avec un vrai jeton, chacun
 * était juste de son côté, et rien ne traversait la couture. Cet échantillon
 * est copié d'une sortie réelle pour que le fichier de test échoue le jour où
 * les deux côtés cesseraient de s'accorder.
 */
const JETON_DE_TEST = 'n8_JnTDL0lXhnNjlWVPjdGYs4Pl42h-m48bADguuBgE'
const AVEC_JETON = `/reinitialiser?jeton=${JETON_DE_TEST}`

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('POST', '/auth/reset', { status: 204 })
  serveur.quand('POST', '/auth/forgot', { status: 202, body: { ok: true } })
})

/**
 * Réinitialisation du mot de passe.
 *
 * L'écran manquait alors que la page « mot de passe oublié » en promettait le
 * lien. Ces tests gardent surtout le comportement du jeton : un lien absent ou
 * raturé doit mener à l'écran « expiré » et non à un formulaire qui échouerait
 * après que l'utilisateur a choisi et retapé un mot de passe.
 */
describe('jeton de réinitialisation', () => {
  it.each([
    ['/reinitialiser', 'absent'],
    ['/reinitialiser?jeton=', 'vide'],
    ['/reinitialiser?jeton=court', 'trop court'],
  ])('%s → écran « lien expiré » (%s)', async (route) => {
    await renderApp(route)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ce lien n’est plus valable')
    expect(screen.queryByLabelText(/nouveau mot de passe/i)).not.toBeInTheDocument()
  })

  it('propose d’en redemander un', async () => {
    await renderApp('/reinitialiser')
    expect(screen.getByRole('link', { name: /demander un nouveau lien/i })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    )
  })

  it('ouvre le formulaire pour un jeton de la forme que le serveur émet', async () => {
    await renderApp(AVEC_JETON)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Choisissez un nouveau mot de passe',
    )
  })
})

describe('formulaire de réinitialisation', () => {
  it('refuse un mot de passe trop court', async () => {
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'court')
    await user.type(screen.getByLabelText(/^Confirmez/), 'court')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('au moins 8 caractères')
  })

  it('refuse deux saisies différentes', async () => {
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('ne correspondent pas')
  })

  it('place le focus sur le premier champ fautif', async () => {
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))
    expect(screen.getByLabelText(/^Nouveau mot de passe/)).toHaveFocus()
  })

  it('confirme et renvoie vers la connexion', async () => {
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /Mot de passe modifié/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /se connecter/i })).toHaveAttribute('href', '/connexion')
  })

  /*
    CE CAS ÉPINGLAIT LA PHRASE, ET LA PHRASE ÉTAIT FAUSSE.

    Il exigeait « sessions ouvertes ont été déconnectées » au mot près. Deux
    défauts en un : il cassait à la moindre réécriture, et il a gardé pendant
    tout ce temps un texte qui parlait des « AUTRES sessions » — alors qu'aucune
    n'est courante ici, puisqu'on arrive depuis un courriel sans être connecté,
    et que le serveur les révoque TOUTES.

    Un cas qui vérifie une chaîne exacte ne garde pas un fait, il garde une
    rédaction. Ce qui doit tenir est déplacé dans « ce que l'écran annonce des
    sessions », plus bas : le mot « session » doit paraître, la formulation
    reste libre, et « les autres » est explicitement refusé.
  */
})

describe('ce que le serveur décide', () => {
  it('n’avoue plus un enregistrement qui n’est pas branché — il l’est', async () => {
    /**
     * LE DERNIER AVEU DE LA SIMULATION.
     *
     * Sous le bouton vivait un bandeau : « L'enregistrement n'est pas encore
     * branché : le formulaire valide la saisie, puis affiche l'écran de
     * confirmation. » Il était vrai quand un `setTimeout` tenait lieu d'appel,
     * et il a survécu au lot qui a branché la route. Un écran qui prévient que
     * son propre geste ne fait rien décourage exactement celui qui vient
     * réparer son accès — et le pire est qu'il disait faux.
     *
     * Cette phrase n'existe plus dans aucun dictionnaire. Le cas la nomme en
     * toutes lettres pour que sa réapparition, sous quelque forme que ce soit,
     * fasse rougir quelque chose.
     */
    await renderApp(AVEC_JETON)
    expect(screen.queryByText(/pas encore branché/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enregistrer le mot de passe/i })).toBeInTheDocument()
  })

  it('bascule sur « lien expiré » quand le serveur refuse le jeton', async () => {
    // Inconnu, périmé ou déjà servi : le serveur rend le même 400, et l'écran
    // n'en dit pas plus que lui. Le formulaire ne peut pas le savoir avant
    // d'avoir demandé — c'est précisément pourquoi il ne juge plus la forme.
    serveur.quand('POST', '/auth/reset', { status: 400, body: { error: 'reset_invalid' } })
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /plus valable/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /demander un nouveau lien/i })).toBeInTheDocument()
  })

  it('envoie le jeton de l’URL et le mot de passe choisi', async () => {
    const user = userEvent.setup()
    await renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))
    await screen.findByRole('heading', { level: 1, name: /Mot de passe modifié/ })

    // Le jeton part TEL QUEL. Un écran qui le normaliserait — casse, troncature
    // — casserait la seule chose que le serveur sait comparer.
    const appel = serveur.appels.find((a) => a.chemin === '/auth/reset')
    expect(appel?.corps).toEqual({ token: JETON_DE_TEST, password: 'Bonamoussadi2026!' })
  })
})

describe('la demande de lien', () => {
  it('part vraiment, et l’écran ne bascule qu’ensuite', async () => {
    const user = userEvent.setup()
    await renderApp('/mot-de-passe-oublie')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }))
    await screen.findByRole('heading', { level: 1, name: /Vérifiez votre boîte mail/ })

    // Un `setTimeout` tenait ce rôle : l'écran annonçait un envoi qui n'avait
    // jamais lieu, faute de route pour le porter.
    expect(serveur.appels.find((a) => a.chemin === '/auth/forgot')?.corps).toEqual({
      email: 'sarah@example.com',
    })
  })

  it('ne prétend rien quand la demande ne part pas', async () => {
    serveur.quand('POST', '/auth/forgot', { status: 500, body: { error: 'internal_error' } })
    const user = userEvent.setup()
    await renderApp('/mot-de-passe-oublie')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    /**
     * Seul l'échec de TRANSPORT se dit. Le serveur rend le même 202 que
     * l'adresse existe ou non, si bien qu'aucune réponse normale ne peut
     * trahir un compte — mais une requête qui ne part pas ne renseigne sur
     * personne, et laisser croire à un envoi serait reprendre le mensonge.
     */
    expect(await screen.findByText(/Action impossible pour l’instant/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Vérifiez votre boîte mail/ })).not.toBeInTheDocument()
  })
})

/**
 * L'ÉCRAN DOIT DIRE QUE LES SESSIONS TOMBENT.
 *
 * `POST /auth/reset` révoque toutes les sessions du compte et n'en rouvre
 * aucune — le serveur le garde par son cas « éjecte les sessions ouvertes, y
 * compris celle de l'intrus ». L'écran, lui, promettait l'inverse : « Il
 * remplacera l'ancien sur tous vos appareils connectés », qui laisse croire que
 * les appareils restent connectés. Et l'écran de succès parlait des « AUTRES
 * sessions », alors qu'aucune n'est courante ici : on arrive depuis un
 * courriel, sans être connecté.
 *
 * ═══ CE QUE CES DEUX CAS GARDENT, ET CE QU'ILS NE GARDENT PAS ═══
 *
 * Ils gardent le FAIT — que la fermeture des sessions soit dite —, jamais la
 * formulation : on ne cherche pas une phrase, on cherche que le mot « session »
 * apparaisse là où l'utilisateur décide et là où on lui rend compte. Récrire la
 * phrase reste libre ; la vider ne l'est pas.
 *
 * Ils ne gardent PAS que la phrase soit vraie. Rien ici ne parle au serveur, et
 * une prose peut être présente et fausse — c'était précisément le cas d'avant.
 * C'est le cas serveur cité plus haut qui tient la vérité ; celui-ci tient
 * seulement qu'on ne la taise pas.
 */
describe('ce que l’écran annonce des sessions', () => {
  it('prévient AVANT, sur le formulaire', async () => {
    await renderApp(AVEC_JETON)
    const soustitre = screen.getByRole('heading', { level: 1 }).parentElement!
    expect(soustitre.textContent).toMatch(/session/i)
  })

  it('le redit APRÈS, sur la confirmation', async () => {
    const utilisateur = userEvent.setup()
    await renderApp(AVEC_JETON)

    await utilisateur.type(screen.getByLabelText(/nouveau mot de passe/i), 'un-mot-de-passe-long')
    await utilisateur.type(screen.getByLabelText(/confirmez/i), 'un-mot-de-passe-long')
    await utilisateur.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    const titre = await screen.findByRole('heading', { level: 1, name: /mot de passe modifié/i })
    expect(titre.parentElement!.textContent).toMatch(/session/i)
    /* Et surtout PAS « les autres » : il n'y a pas de session courante dont
       celles-ci seraient les autres. C'est l'erreur exacte qui vivait ici. */
    expect(titre.parentElement!.textContent).not.toMatch(/autres sessions/i)
  })
})
