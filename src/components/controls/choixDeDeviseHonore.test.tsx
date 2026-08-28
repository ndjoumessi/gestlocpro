import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN CHOIX DE DEVISE EST HONORÉ, OU SON REFUS EST DIT.
 *
 * ═══ CE QUI EST ARRIVÉ ═══
 *
 * Le lot de la conversion a laissé passer le cas où elle est IMPOSSIBLE. Sans
 * cours — l'API injoignable, le flux tombé —, la devise demandée est
 * inatteignable : le choix était enregistré, l'écran restait dans la monnaie du
 * parc, et rien ne l'expliquait. On choisissait le dollar canadien, il ne se
 * passait rien.
 *
 * Pire, les deux moitiés du contrôle se contredisaient à quinze pixels d'écart :
 * la liste montrait « Dollar canadien » coché, le bouton affichait « FCFA ». Il
 * lisait la devise RENDUE là où la liste lisait la devise DEMANDÉE.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Les deux moitiés d'une même règle. Quand les cours sont là, le choix se voit
 * dans les montants. Quand ils manquent, il se voit dans un AVIS — parce qu'un
 * contrôle qui enregistre sans obéir et sans le dire a l'air cassé, ce qui est
 * pire qu'un contrôle absent.
 */

/** Ouvre les réglages, puis la liste des devises, et choisit une ligne. */
async function choisirLaDevise(nom: RegExp) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Réglages|Settings/ }))
  await user.click(screen.getByRole('button', { name: /^Devise|^Currency/ }))
  await user.click(screen.getByRole('option', { name: nom }))
}

/**
 * Le bloc des réglages, où vit l'avis de conversion.
 *
 * NOMMÉ, ET NON REMONTÉ DEPUIS LE BOUTON. Ce repère était `closest('div')
 * .parentElement` à partir du sélecteur de devise : il désignait le panneau par
 * la FORME du DOM, si bien qu'unifier les quatre panneaux derrière un même
 * composant l'a fait pointer ailleurs. Un cas qui décrit une hiérarchie de
 * `div` mesure la mise en page, pas la règle.
 */
const panneau = () => document.querySelector<HTMLElement>('[data-reglages]')!

describe('le choix d’une devise', () => {
  it('convertit les montants quand les cours sont là', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()

    await choisirLaDevise(/Euro/)

    /* 447 000 francs valent 681 € à la parité légale. Le montant, et pas
       seulement le symbole : un ré-étiquetage garderait 447 000. */
    const principal = screen.getByRole('main').textContent?.replace(/[\s ]/g, ' ') ?? ''
    expect(principal).toMatch(/681/)
    expect(principal, 'les francs sont restés sous un autre symbole').not.toMatch(/447 000/)
  })

  /**
   * LE CAS DU DÉFAUT. Le faux serveur refuse les cours, comme une API absente.
   *
   * `quand` écrase la réponse par défaut : c'est la seule façon de reproduire un
   * poste où le client tourne sans son API, qui est précisément la situation où
   * le sélecteur paraissait cassé.
   */
  it('dit qu’il ne peut pas, plutôt que de ne rien faire', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    await renderApp('/demo')
    await attendreLeChargement()

    await choisirLaDevise(/Dollar canadien/)

    // Les montants restent ceux du parc — on n'invente pas de cours.
    expect(screen.getByRole('main').textContent).toMatch(/FCFA/)
    // Et l'écran le DIT, en nommant la devise qu'il affiche à la place.
    expect(within(panneau()).getByText(/Cours indisponibles/)).toHaveTextContent(/FCFA/)
  })

  /**
   * LE BOUTON ET LA LISTE DISENT LA MÊME CHOSE.
   *
   * C'est la moitié du défaut qui ne dépendait d'aucun cours : deux états dans
   * un seul contrôle, l'un montrant le choix et l'autre son échec.
   */
  it('porte sur son bouton la devise que la liste montre cochée', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    await renderApp('/demo')
    await attendreLeChargement()

    await choisirLaDevise(/Dollar canadien/)

    const declencheur = screen.getByRole('button', { name: /^Devise|^Currency/ })
    expect(declencheur, 'le bouton affiche autre chose que le choix').toHaveTextContent(/CAD/)
  })
})
