import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * UNE EXCEPTION DE RENDU NE DOIT PAS BLANCHIR L'APPLICATION.
 *
 * MESURÉ sur le paquet construit, avant la frontière, en injectant une
 * exception à deux endroits — un composant de route, et un composant imbriqué
 * dans un écran par ailleurs sain. Les deux donnaient le même résultat :
 * `#root` vide, 0 élément, 0 titre, 0 sortie. La page entière, pas le panneau.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX GARDES DU GARDE, et le second ferme un trou que le lot précédent avait
 * NOMMÉ sans le combler.
 *
 *  1. Si le harnais ne parvient plus à FAIRE LEVER l'exception — un remaniement
 *     a déplacé le composant, changé son nom, cessé de le monter — les cas
 *     suivants passeraient au vert sans avoir rien cassé. Le premier cas exige
 *     donc de voir le repli, et dit que c'est le harnais qui est en cause.
 *
 *  2. Un cas SAIN asserte que la coquille arrive. Sans lui, une frontière qui
 *     afficherait son repli EN PERMANENCE — parce qu'un `getDerivedStateFrom…`
 *     mal écrit ne l'efface jamais — rendrait tous les cas terminaux verts pour
 *     la pire des raisons. C'est exactement le trou que j'ai nommé au lot 3 et
 *     laissé ouvert : « si un remaniement faisait que l'écran d'erreur s'affiche
 *     toujours, tous mes cas terminaux passeraient au vert ».
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COMMENT ON FAIT LEVER. On casse un composant réel du produit par une
 * substitution de module, plutôt qu'en montant un composant piégé écrit pour le
 * test : ce qu'on veut prouver est qu'une exception VENUE DU PRODUIT est
 * attrapée là où elle survient, sous les fournisseurs et dans les routes.
 */

vi.mock('@/features/dashboard/Deposits', async (original) => {
  const vrai = await original<typeof import('@/features/dashboard/Deposits')>()
  return {
    ...vrai,
    Deposits: () => {
      if (CASSER.actif) throw new ExceptionDeCanari('canari de frontière')
      return vrai.Deposits()
    },
  }
})

/** Interrupteur lu au RENDU : `vi.mock` est hissé, une constante ne suffirait pas. */
const CASSER = { actif: false }

/**
 * jsdom REPORTE l'exception même quand une frontière l'attrape.
 *
 * React la relance sur `window` pour que les outils de développement la voient ;
 * jsdom l'écrit alors sur sa console virtuelle, hors de portée d'un espion posé
 * sur `console.error`. Mesuré : douze traces de pile dans la sortie d'un
 * `npm run check` VERT. Une porte verte bruyante apprend à ne plus lire sa
 * sortie — et c'est là qu'on cesse de voir la treizième, qui compte.
 *
 * On n'étouffe QUE le canari, nommément. Toute autre exception continue de
 * s'écrire : ce filet n'est pas un tapis.
 */
class ExceptionDeCanari extends Error {}

/**
 * ON FILTRE PAR UN TYPE, PLUS PAR LE CONTENU DU MESSAGE.
 *
 * La première version cherchait « canari de frontière » dans le texte. Deux
 * défauts : renommer le canari faisait revenir les douze traces sans que rien
 * ne rougisse, et surtout un filtre par contenu TAIT AUSSI CE QUI RESSEMBLE —
 * une vraie exception dont le message aurait cité le canari serait passée sous
 * le tapis. Le drapeau est posé par le test et par personne d'autre.
 */
function tairLeCanari(evenement: ErrorEvent) {
  if (evenement.error instanceof ExceptionDeCanari) evenement.preventDefault()
}

beforeEach(() => {
  CASSER.actif = false
  window.addEventListener('error', tairLeCanari)
})

afterEach(() => {
  window.removeEventListener('error', tairLeCanari)
  vi.restoreAllMocks()
})

describe('une exception de rendu ne blanchit pas l’application', () => {
  it('GARDE DU GARDE nº 1 — le harnais sait encore FAIRE LEVER une exception', async () => {
    // React écrit la pile sur la console quand une frontière attrape : attendu,
    // et tu, sans quoi la sortie du test devient illisible.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    CASSER.actif = true

    await renderApp('/demo/cautions')

    expect(
      screen.queryByRole('heading', { name: /s’est interrompu/i }),
      'le harnais ne parvient plus à faire lever d’exception — les cas suivants ne mesurent rien',
    ).toBeInTheDocument()
  })

  it('GARDE DU GARDE nº 2 — un écran SAIN rend sa coquille, pas le repli', async () => {
    /*
      Sans ce cas, un repli affiché en permanence rendrait tout le fichier vert.
      Il asserte les deux moitiés : la coquille EST là, le repli N'EST PAS là.
    */
    await renderApp('/demo/cautions')

    /*
      On asserte la COQUILLE par ce qu'elle a de non ambigu : le titre propre de
      l'écran, et un volume de commandes qu'un repli à deux boutons ne peut pas
      imiter. Viser le nom accessible d'une navigation aurait lié ce cas à la
      largeur de la fenêtre de test — la barre latérale et la barre basse ne
      sont pas montées aux mêmes tailles, et le cas aurait rougi pour une raison
      qui n'est pas la sienne.
    */
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/s’est interrompu/i)
    expect(screen.queryByRole('heading', { name: /s’est interrompu/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(5)
  })

  it('rend un écran terminal AVEC une sortie, au lieu de rien', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    CASSER.actif = true

    await renderApp('/demo/cautions')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/s’est interrompu/i)
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /retour à l’accueil/i })).toBeInTheDocument()
    // Et surtout : l'application n'est pas vide.
    expect(document.querySelector('#root, body > div')?.textContent ?? '').not.toBe('')
  })

  it('n’avale pas : le message de l’exception reste consultable', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    CASSER.actif = true

    await renderApp('/demo/cautions')

    // À l'écran, sous un dépliant — recopiable par qui veut dire ce qui s'est passé.
    expect(screen.getByText(/canari de frontière/)).toBeInTheDocument()
    // Et dans la console, avec la pile de composants.
    expect(journal.mock.calls.some((c) => String(c[0]).includes('[frontière]'))).toBe(true)
  })

  it('s’efface au changement d’adresse : la sortie SORT vraiment', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    CASSER.actif = true

    await renderApp('/demo/cautions')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/s’est interrompu/i)

    // Le composant guérit, puis l'utilisateur s'en va par le lien de sortie.
    CASSER.actif = false
    await userEvent.click(screen.getByRole('link', { name: /retour à l’accueil/i }))

    /*
      LE PIÈGE QUE CE CAS SURVEILLE : une frontière qui ne s'efface pas garde son
      repli affiché après la navigation, et le bouton censé libérer ne libère
      rien. Le défaut ne se voit qu'en essayant de sortir.
    */
    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
      /s’est interrompu/i,
    )
  })

  it('la reprise ne boucle pas : elle rend une fois, puis s’arrête', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    CASSER.actif = true

    await renderApp('/demo/cautions')
    const avant = journal.mock.calls.filter((c) => String(c[0]).includes('[frontière]')).length

    // Le sous-arbre est TOUJOURS cassé : on reprend quand même.
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }))

    // Le repli est de retour — et la frontière n'a attrapé qu'une fois de plus,
    // pas en boucle.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/s’est interrompu/i)
    /*
      UNE ÉGALITÉ, PLUS UNE BORNE. `toBeLessThanOrEqual(2)` acceptait deux
      captures là où React en produit UNE : le cas serait resté vert si le
      nombre montait à deux pour une mauvaise raison — une frontière qui
      attrape, se réinitialise et rattrape. Une égalité oblige qui verra ce
      nombre changer à le relever dans un diff et à le justifier, même règle
      que `MAXIMUM_D_EXEMPTIONS`.
    */
    const apres = journal.mock.calls.filter((c) => String(c[0]).includes('[frontière]')).length
    expect(apres - avant).toBe(1)
  })
})
