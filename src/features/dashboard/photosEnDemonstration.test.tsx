import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/render'
import type { Transcodage } from '@/lib/transcoderPhoto'

/*
  LE TRANSCODAGE EST DOUBLÉ, comme dans `photosDeReserve.test.tsx` : il passe
  par `canvas` et `createImageBitmap`, que jsdom n'a pas. Sans cette doublure la
  vignette ne naît jamais et le cas mesurerait l'absence de décor plutôt que le
  comportement de la démonstration.
*/
const { transcoderPhoto } = vi.hoisted(() => ({ transcoderPhoto: vi.fn() }))
vi.mock('@/lib/transcoderPhoto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/transcoderPhoto')>()),
  transcoderPhoto,
}))

const TRANSCODEE: Transcodage = {
  transcode: true,
  octets: new Blob([new Uint8Array(1234)], { type: 'image/jpeg' }),
  largeur: 900,
  hauteur: 1600,
  typeMime: 'image/jpeg',
}

beforeEach(() => {
  transcoderPhoto.mockResolvedValue(TRANSCODEE)
  URL.createObjectURL = vi.fn(() => 'blob:demo')
  URL.revokeObjectURL = vi.fn()
})

/**
 * LA DÉMONSTRATION ANNONCE UN ÉCHEC D'ENVOI, PUIS UN SUCCÈS — ET NI L'UN NI
 * L'AUTRE N'A EU LIEU.
 *
 * Troisième prise de la même famille, après `callRent` et `remindRent`. Elle
 * vient de l'inventaire du lot précédent, où je l'avais NOTÉE SANS LA
 * CORRIGER : « `envoyerPhotos` rend zéro sans parc, mais la démonstration n'a
 * rien à monter et l'état des lieux y reste local : aucune donnée réelle n'est
 * en jeu. »
 *
 * ═══ MA NOTE VISAIT LE MAUVAIS MÉCANISME ═══
 *
 * Le repli `!parkId` d'`envoyerPhotos` n'est jamais atteint avec des photos :
 * `addInspection` rend un tableau VIDE en démonstration — et son commentaire
 * explique pourquoi, « en fabriquer un ferait croire à l'écran qu'il peut
 * envoyer des photos ». Les photos tombent donc dans `nonApparies`, un compteur
 * d'échecs, et jamais dans `envois`.
 *
 * ═══ CE QUE LE VISITEUR VOIT, ET C'EST UNE SUITE DE DEUX MENSONGES ═══
 *
 *   1. « L'envoi de N photos a ÉCHOUÉ. […] RÉESSAYEZ sans fermer cette
 *      fenêtre. » — rien n'a été tenté, il n'y a pas de serveur à joindre.
 *   2. On réessaie : `reprise.envois` est vide, `envoyerPhotos` ne fait rien,
 *      rend zéro, et l'écran conclut « État des lieux enregistré » du ton du
 *      succès. Les photos ont disparu sans qu'une seule phrase le dise.
 *
 * Le second est le plus coûteux des deux, et c'est le même motif que les deux
 * lots précédents : un zéro qui vaut « rien à faire » pris pour « tout va
 * bien ».
 *
 * ═══ POURQUOI CELA COMPTE MALGRÉ DES DONNÉES FICTIVES ═══
 *
 * Ce n'est pas la donnée qui est en jeu, c'est la PROMESSE. La démonstration
 * est ce que voit quelqu'un qui n'a pas encore de parc, et les photos d'un
 * état des lieux ne sont pas décoratives — ce sont les pièces qu'on oppose
 * pour retenir une somme sur une caution. Une démonstration qui les perd en
 * annonçant un succès enseigne le produit à l'envers.
 *
 * Et la règle du dépôt est déjà écrite, chez `recordReading` : « la
 * démonstration n'écrit rien, et le DIRE vaut mieux qu'un bouton qui s'enfonce
 * sans effet ».
 */

const PHOTO = new File([new Uint8Array(50_000)], 'reserve.jpg', { type: 'image/jpeg' })

async function ouvrirEtatDesLieuxAvecPhoto() {
  const user = userEvent.setup()
  await renderApp('/demo/etats-des-lieux')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: /établir un état des lieux/i }))

  const modale = screen.getByRole('dialog')
  await user.type(within(modale).getByLabelText(/^pièce$/i), 'Séjour')
  await user.type(within(modale).getByLabelText(/^constat$/i), 'Mur défoncé sur un mètre.')
  const entree = modale.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(entree, PHOTO)
  /* La vignette naît d'une lecture asynchrone : sans cette attente, on
     enregistrerait une réserve dont la photo n'est pas encore retenue. */
  await waitFor(() =>
    expect(modale.querySelectorAll('img').length, 'la vignette de la photo').toBeGreaterThan(0),
  )
  await user.click(within(modale).getByRole('button', { name: /^enregistrer$/i }))
  return user
}

describe('les photos d’un état des lieux en démonstration', () => {
  it('n’annonce pas un échec d’envoi là où rien n’a été tenté', async () => {
    await ouvrirEtatDesLieuxAvecPhoto()

    expect(
      screen.queryByText(/a échoué|failed/i),
      'aucun envoi n’a été tenté : la démonstration n’a pas de serveur à joindre',
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /réessayer|retry/i }),
      'proposer une reprise qui ne peut pas aboutir est un bouton qui s’enfonce sans effet',
    ).toBeNull()
  })

  it('dit que les photos ne sont pas conservées, plutôt que de les perdre en silence', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER. Sans lui, le correctif pourrait se contenter
      de retirer le message d'échec — et la démonstration perdrait alors les
      photos sans un mot, ce qui est le défaut d'origine débarrassé de son
      symptôme.
    */
    await ouvrirEtatDesLieuxAvecPhoto()

    expect(
      await screen.findByText(/démonstration ne conserve pas|demo does not keep/i),
      'la démonstration doit dire ce qu’elle ne fait pas',
    ).toBeInTheDocument()
  })
})
