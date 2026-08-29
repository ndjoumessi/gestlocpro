import { describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  screen,
  userEvent,
  SESSION_CONNECTEE,
} from '@/test/render'

/**
 * LES DEUX PANNEAUX DE LA BARRE S'UTILISENT AU CLAVIER.
 *
 * Ce fichier existe parce que le lot précédent a déplacé langue, devise et
 * thème derrière un panneau sur les 23 écrans SANS vérifier la poignée. Mesuré
 * ensuite au navigateur : quatre tabulations sur dix sortaient du panneau
 * ouvert, et à la fermeture le focus restait où il avait erré — sur un bouton
 * de légende de graphique, à l'autre bout de la page. `MenuCompte` portait le
 * même motif incomplet, sans aucune couverture, et il ouvre le SEUL chemin vers
 * la déconnexion : sur un poste partagé, cas courant du marché visé, un focus
 * qui s'échappe laisse la session ouverte au suivant.
 *
 * QUATRE PROPRIÉTÉS, ET IL LES FAUT TOUTES. Ouvrir depuis le clavier, ne pas
 * pouvoir en sortir à la tabulation, fermer à Échap, retrouver le focus sur le
 * bouton qui a ouvert. Trois sur quatre ne font pas un panneau utilisable :
 * c'est exactement l'état d'avant, qui n'avait qu'Échap.
 *
 * LE PIÈGE PORTE SUR L'ENVELOPPE, déclencheur compris, et non sur le seul
 * panneau. C'est ce qui permet à Maj+Tab depuis la première commande de revenir
 * au bouton d'ouverture plutôt que de sauter derrière lui.
 */

/**
 * Le conteneur qui doit retenir le focus : l'enveloppe du panneau.
 *
 * ELLE SE PREND DEPUIS LE DÉCLENCHEUR, et non depuis le panneau.
 *
 * Elle se lisait `panneau.parentElement`, ce qui supposait le panneau à un seul
 * niveau sous l'enveloppe. La supposition a tenu jusqu'au jour où le menu du
 * compte a séparé sa boîte flottante du `role="menu"` qu'elle contient : le
 * parent du menu devenait la boîte, qui ne contient PAS le déclencheur, et
 * revenir au bouton d'ouverture à Maj+Tab — le comportement que ce fichier
 * exige nommément deux paragraphes plus haut — se lisait comme une évasion.
 *
 * Le déclencheur, lui, est l'enfant direct de l'enveloppe dans les deux
 * composants : c'est le conteneur que `usePiegeDeFocus` reçoit en référence.
 * Partir de lui décrit l'invariant au lieu d'une profondeur.
 */
function enveloppe(bouton: HTMLElement): HTMLElement {
  const env = bouton.parentElement
  expect(env, 'déclencheur sans enveloppe').not.toBeNull()
  expect(
    env!.querySelector('[role="dialog"],[role="menu"]'),
    'panneau introuvable — rien à mesurer',
  ).not.toBeNull()
  return env!
}

/**
 * Le parcours complet, joué sur n'importe quel bouton qui ouvre un panneau.
 *
 * Rendu commun aux deux panneaux : ce sont deux appels du même crochet, donc
 * deux cas identiques prouveraient deux fois la même chose s'ils étaient
 * écrits deux fois à la main — et divergeraient au premier ajustement.
 */
async function parcoursComplet(nomDuBouton: RegExp) {
  const user = userEvent.setup()
  const bouton = screen.getByRole('button', { name: nomDuBouton })

  bouton.focus()
  expect(document.activeElement).toBe(bouton)

  await user.keyboard('{Enter}')
  const env = enveloppe(bouton)

  /* LE PIÈGE. Douze tabulations : plus que le panneau n'a de commandes, donc
     le tour est bouclé au moins une fois. Une seule évasion suffit à casser
     l'invariant — on les compte toutes plutôt que de s'arrêter à la première,
     pour que l'échec dise COMBIEN. */
  const evasions: string[] = []
  for (let i = 0; i < 12; i++) {
    await user.tab()
    if (!env.contains(document.activeElement)) {
      evasions.push((document.activeElement as HTMLElement)?.textContent?.trim().slice(0, 30) ?? '?')
    }
  }
  expect(evasions, 'le focus est sorti du panneau ouvert').toEqual([])

  await user.keyboard('{Escape}')
  expect(document.querySelector('[role="dialog"],[role="menu"]')).toBeNull()
  expect(document.activeElement, 'le focus n’est pas revenu au bouton d’ouverture').toBe(bouton)
}

describe('le panneau des réglages', () => {
  it('a un nom accessible qui dit ce qu’il contient', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    const bouton = screen.getByRole('button', { name: /Réglages/ })
    /* Le nom NOMME les trois réglages : « Réglages » seul ne dirait pas que la
       langue est derrière, et c'est la commande la plus demandée sur ce
       marché. */
    expect(bouton).toHaveAccessibleName(/langue/i)
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: /Réglages/ })).toBeInTheDocument()
  })

  it('s’ouvre, piège le focus, se ferme à Échap et le rend au bouton', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    await parcoursComplet(/Réglages/)
  })

  it('montre les trois réglages d’un coup, sans seconde porte', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    await userEvent.click(screen.getByRole('button', { name: /Réglages/ }))
    const panneau = screen.getByRole('dialog', { name: /Réglages/ })
    /* Aucun ne disparaît : c'est la contrainte que le lot de la coquille
       s'était donnée en les déplaçant, et elle se vérifie ici. */
    expect(panneau.textContent).toMatch(/Langue/i)
    expect(panneau.textContent).toMatch(/Devise/i)
    expect(panneau.textContent).toMatch(/Thème/i)
  })
})

describe('le menu de compte', () => {
  it('s’ouvre, piège le focus, se ferme à Échap et le rend au bouton', async () => {
    await renderApp('/app', { session: SESSION_CONNECTEE })
    await attendreLeChargement()
    await parcoursComplet(/Compte de/)
  })
})
