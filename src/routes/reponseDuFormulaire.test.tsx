import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { installerFauxServeur, type FauxServeur } from '@/test/api'

/**
 * LA RÉPONSE À UN FORMULAIRE N'ÉTAIT ANNONCÉE À PERSONNE.
 *
 * ═══ CE QUI SE PASSAIT, ET OÙ LE CURSEUR ATTERRISSAIT ═══
 *
 * Trois pages de ce parcours REMPLACENT leur formulaire par leur réponse :
 * « Vérifiez votre boîte mail » après une demande de lien, « Mot de passe
 * changé » après sa réinitialisation, « Compte créé » au bout de l'inscription.
 * Le bouton qu'on vient de presser part avec le formulaire, et rien ne prend sa
 * place : le focus retombe sur `body`, c'est-à-dire en TÊTE DE DOCUMENT. Il faut
 * alors retraverser l'en-tête, le retour à l'accueil et les trois réglages pour
 * atteindre la réponse — et rien n'est annoncé au passage, puisque le bandeau
 * paraît avec son texte déjà dedans.
 *
 * L'ASSISTANT D'INSCRIPTION A LE MÊME DÉFAUT, SOUS UNE AUTRE FORME. Son bouton
 * « Continuer » SURVIT au changement d'étape : le focus ne tombe donc pas, il
 * reste au BAS d'un formulaire entièrement neuf, dont tous les champs sont
 * au-dessus de lui. `window.scrollTo({ top: 0 })` déplace la page ; le curseur
 * reste où il était.
 *
 * ═══ POURQUOI LE TITRE, ET NON UNE RÉGION VIVANTE ═══
 *
 * Parce que `EcranSysteme` a déjà tranché cette question, dans les mêmes termes,
 * pour les quatre écrans système : une région vivante annonce les CHANGEMENTS
 * d'une région déjà présente ; insérée avec son texte déjà dedans, le
 * comportement dépend du lecteur d'écran. Le focus sur le titre est uniforme, et
 * répare la seconde moitié du défaut — la position du clavier — par la même
 * occasion.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * `document.activeElement`, que jsdom calcule pour de vrai. Ce qu'ils ne
 * tiennent pas : ce qu'un lecteur d'écran prononce, qui n'appartient à aucun
 * test automatique.
 */

const ADRESSE = 'proprietaire@exemple.cm'

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('POST', '/auth/forgot', { status: 202, body: { ok: true } })
})

describe('la réponse d’un formulaire d’authentification', () => {
  it('ne prend pas le focus à l’arrivée sur la page', async () => {
    await renderApp('/mot-de-passe-oublie')

    /* PERSONNE N'A RIEN DEMANDÉ. Voler le curseur au chargement empêcherait la
       première tabulation d'atteindre l'en-tête — le retour à l'accueil et les
       trois réglages sont au-dessus du titre. C'est le contrepoids du cas
       suivant, et il est la raison pour laquelle l'effet regarde le CHANGEMENT
       de titre et non le montage. */
    expect(
      document.activeElement,
      'le titre prend le focus alors que rien n’a changé',
    ).toBe(document.body)
  })

  it('porte le focus sur le titre de sa réponse', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/mot-de-passe-oublie')

    await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
    await utilisateur.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    const titre = await screen.findByRole('heading', { level: 1, name: /vérifiez votre boîte/i })

    expect(
      document.activeElement,
      'le curseur est retombé en tête de document, sous l’en-tête et les réglages',
    ).toBe(titre)
  })

  it('remet le clavier en tête de la nouvelle étape de l’inscription', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/inscription')

    /* LE BOUTON SURVIT AU CHANGEMENT D'ÉTAPE, donc le focus ne TOMBE pas : il
       reste sur « Continuer », au bas d'un formulaire entièrement neuf dont
       tous les champs sont au-dessus de lui. C'est la variante silencieuse du
       même défaut — rien ne se casse, et le clavier travaille à l'envers. */
    const cartes = await screen.findAllByRole('radio')
    await utilisateur.click(cartes[0])
    const continuer = screen.getByRole('button', { name: /Continuer/ })
    await utilisateur.click(continuer)

    const titre = await screen.findByRole('heading', { level: 1, name: /votre identité/i })
    expect(document.activeElement, 'le curseur est resté au bas de l’étape précédente').toBe(titre)
  })

  it('fait du titre une cible du programme, jamais de la tabulation', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/mot-de-passe-oublie')

    await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
    await utilisateur.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    const titre = await screen.findByRole('heading', { level: 1, name: /vérifiez votre boîte/i })

    /* `-1` ET NON `0` : un titre n'est pas un arrêt de tabulation. À `0` il
       s'insérerait dans l'ordre du clavier de TOUTES les pages de ce parcours,
       et chaque utilisateur paierait une tabulation de plus sur un élément qui
       n'agit pas. */
    expect(titre.getAttribute('tabindex'), 'le titre est entré dans l’ordre de tabulation').toBe(
      '-1',
    )
  })
})
