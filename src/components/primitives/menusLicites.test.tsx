import { describe, expect, it } from 'vitest'
import {
  renderApp,
  screen,
  attendreLeChargement,
  switchRole,
  userEvent,
  SESSION_CONNECTEE,
} from '@/test/render'

/**
 * UN `role="menu"` NE CONTIENT QUE DES ENTRÉES DE MENU.
 *
 * ═══ LA RÈGLE, ET POURQUOI ELLE NE PEUT PAS ÊTRE TENUE PAR LE COMPOSANT ═══
 *
 * `MenuDeDebordement` l'énonce : « un `menu` n'admet que des `menuitem` parmi
 * ses descendants signifiants, et il annonce "2 sur 3" […] un `<Button>` posé
 * là porterait `role="button"` et casserait le décompte ». Il ajoute qu'il la
 * garantit par `MenuElement` — et c'est vrai de ce qu'il OFFRE, pas de ce qu'il
 * REÇOIT : ses enfants viennent des appelants, et rien dans le typage de
 * `ReactNode` n'interdit un intitulé, un filet ou un bouton nu.
 *
 * CE N'EST PAS UNE CRAINTE, C'EST UN FAIT MESURÉ. Le menu du compte de la
 * coquille — l'autre `role="menu"` du produit — portait exactement cela :
 * l'identité du titulaire dans un `div` nu, et un filet de séparation que j'y ai
 * moi-même posé au lot précédent. Un lecteur d'écran n'expose d'un conteneur
 * `menu` que ses entrées : tout le reste est effacé, sans avertissement, sans
 * qu'aucune garde de mise en page ni aucun typage ne s'en émeuve.
 *
 * ═══ CE QUE CETTE GARDE REGARDE ═══
 *
 * Tous les menus ouvrables des écrans balayés, sur les sept appelants du
 * produit. Deux formes d'intrus, parce qu'il y en a deux :
 *
 *   — un ÉLÉMENT hors d'une entrée et qui ne déclare ni `menuitem` ni
 *     `separator` — le `div` d'identité, le filet, un `<Button>` ;
 *   — un TEXTE NU posé directement dans le menu, qui n'a pas d'élément pour
 *     porter un rôle et qu'aucune requête sur les rôles ne trouverait.
 *
 * Le second cas n'existe nulle part aujourd'hui. Il est gardé quand même : il
 * s'écrit `{titre}` au milieu d'une liste d'entrées, c'est la faute la plus
 * facile à commettre, et c'est la seule que la première règle laisserait passer.
 *
 * ═══ TROIS RÔLES D'ENTRÉE, ET NON UN SEUL (2026-09-01) ═══
 *
 * Cette garde n'admettait que `menuitem`, et ARIA en admet trois : une entrée
 * peut porter un ÉTAT (`menuitemcheckbox`) ou appartenir à un choix exclusif
 * (`menuitemradio`). L'écart n'était pas une décision — le produit n'avait
 * jamais eu d'entrée à état, et la liste avait été écrite sur ce qui existait.
 *
 * Le motif d'origine n'est pas entamé : ce que la règle chasse, ce sont les
 * éléments qui ne sont PAS des entrées — un `div` d'identité, un filet, un
 * `<Button>` — parce qu'un lecteur d'écran les efface sans avertir. Et le
 * décompte « 2 sur 3 » vient du navigateur, qui compte les trois rôles :
 * l'élargir ne le désaccorde pas.
 */

/**
 * Les rôles qu'un `menu` admet comme ENTRÉES, au sens d'ARIA.
 *
 * Écrits ici et non en ligne parce que la liste sert DEUX fois — pour reconnaître
 * une entrée, et pour reconnaître ce qui vit DEDANS : l'icône d'une entrée à
 * état est un `<svg>` sans rôle, et sans la seconde lecture elle serait comptée
 * comme un intrus posé dans le menu.
 */
const ENTREES_LICITES = ['menuitem', 'menuitemcheckbox', 'menuitemradio']

/**
 * Les écrans qui portent un menu, et ce qu'il faut pour les atteindre.
 *
 * LE DERNIER N'EST PAS UN ÉCRAN DE DÉMONSTRATION, et c'est délibéré : `/app`
 * avec une session ouverte est le seul endroit où vit le menu du compte de la
 * coquille — l'autre `role="menu"` du produit, et celui qui portait le défaut
 * qui a fait écrire ce fichier. La démonstration n'a pas de compte, donc pas de
 * menu de compte, donc aucune des lignes au-dessus ne le regarde.
 */
const ECRANS = [
  { adresse: '/demo/locataires', role: null, session: false },
  { adresse: '/demo/travaux', role: null, session: false },
  { adresse: '/demo/releves', role: null, session: false },
  { adresse: '/demo/paiements', role: null, session: false },
  { adresse: '/demo/parc', role: null, session: false },
  { adresse: '/demo/parc/A1', role: null, session: false },
  { adresse: '/demo/documents', role: 'tenant' as const, session: false },
  { adresse: '/app', role: null, session: true },
]

/** Ce qu'un menu ne devrait pas contenir, dit en clair pour le rapport. */
function intrus(menu: HTMLElement): string[] {
  const fautes: string[] = []

  for (const el of Array.from(menu.querySelectorAll('*'))) {
    if (el.closest(ENTREES_LICITES.map((r) => `[role="${r}"]`).join(','))) continue
    const role = el.getAttribute('role')
    if (ENTREES_LICITES.includes(role ?? '') || role === 'separator') continue
    fautes.push(`<${el.tagName.toLowerCase()} role=${role ?? '—'}> « ${(el.textContent ?? '').trim().slice(0, 40)} »`)
  }

  for (const noeud of Array.from(menu.childNodes)) {
    if (noeud.nodeType === 3 && (noeud.textContent ?? '').trim()) {
      fautes.push(`texte nu « ${noeud.textContent!.trim().slice(0, 40)} »`)
    }
  }

  return fautes
}

describe('les menus du produit', () => {
  for (const ecran of ECRANS) {
    it(`n’admettent que des entrées sur ${ecran.adresse}`, async () => {
      const user = userEvent.setup()
      await renderApp(ecran.adresse, ecran.session ? { session: SESSION_CONNECTEE } : undefined)
      await attendreLeChargement()
      if (ecran.role) await switchRole(ecran.role)

      const declencheurs = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]'),
      )
      /* GARDE DU GARDE. « Aucun intrus » et « aucun menu » s'écrivent pareil
         dans un rapport vert. Un écran retiré de la liste, un menu replié
         derrière une condition de rôle, et cette garde regarderait le vide. */
      expect(declencheurs.length, 'aucun menu à ouvrir sur cet écran').toBeGreaterThan(0)

      const fautes: string[] = []
      for (const declencheur of declencheurs) {
        await user.click(declencheur)
        for (const menu of screen.queryAllByRole('menu')) {
          fautes.push(...intrus(menu).map((f) => `${ecran.adresse} · ${f}`))
        }
        await user.keyboard('{Escape}')
      }

      expect(fautes, 'un menu contient autre chose que des entrées').toEqual([])
    })
  }
})
