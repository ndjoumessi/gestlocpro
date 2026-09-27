import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'

/**
 * CE QUE L'ENTRÉE COURANTE MONTRE, ET CE QUE LE CLIC REND.
 *
 * ═══ DEUX DÉFAUTS, ET LE SECOND NE SE VOYAIT QUE REPLIÉ ═══
 *
 * 1. AUCUN RETOUR AU CLIC. Les six variantes de `Button` portent
 *    `active:translate-y-px`, et `IconButton` avec elles. Les douze entrées de
 *    navigation — les commandes les plus activées de toute l'application — ne
 *    rendaient rien sous le doigt. On cliquait, et rien ne bougeait jusqu'à ce
 *    que l'écran suivant se peigne : sur une route qui charge, c'est le temps
 *    qu'il faut pour croire qu'on a manqué le lien et cliquer une seconde fois.
 *
 * 2. REPLIÉE, L'ENTRÉE COURANTE NE SE DISTINGUAIT QUE PAR LA COULEUR. Le lavis
 *    d'accent, l'encre d'accent et le filet de 2 px sont trois signaux — et les
 *    trois sont de la TEINTE. La graisse, elle, ne s'applique qu'au libellé, et
 *    le rail replié n'en a pas. `couleur-non-seule` refuse ce motif partout
 *    ailleurs dans ce produit ; il vivait ici.
 *
 * ═══ POURQUOI CES CAS ET PAS LA PORTE ═══
 *
 * `mesure-ui` mesure ce qui est PEINT au repos. Un état `:active` n'existe que
 * pendant que le bouton de la souris est enfoncé, et aucune porte de ce dépôt ne
 * tient un doigt appuyé. La classe est donc le seul endroit où ce contrat
 * s'écrit, et c'est assumé : on interroge ici ce que le navigateur appliquera,
 * pas ce qu'il a appliqué.
 */

/** Une entrée de la barre latérale, par son nom accessible. */
async function entree(nom: RegExp) {
  await attendreLeChargement()
  const liens = screen.getAllByRole('link', { name: nom })
  const dansLaBarre = liens.find((l) => l.closest('[data-zone]'))
  if (!dansLaBarre) throw new Error(`aucune entrée de barre pour ${nom}`)
  return dansLaBarre
}

describe('l’état des entrées de navigation', () => {
  it('rend l’enfoncement au clic, comme tous les autres contrôles', async () => {
    await renderApp('/demo')
    const lien = await entree(/tableau de bord/i)

    /* LE MÊME IDIOME QUE `Button` ET `IconButton`, et c'est le point : un geste
       identique doit rendre la même chose partout. Un `scale` ou une ombre
       inventés ici auraient fait deux vocabulaires d'enfoncement dans le même
       produit. */
    expect(lien.className, 'l’entrée ne s’enfonce pas au clic').toMatch(/active:translate-y-px/)
  })

  it('cadence cet enfoncement, au lieu de le faire claquer', async () => {
    await renderApp('/demo')
    const lien = await entree(/tableau de bord/i)

    /* `transition-colors` NE CADENCE PAS `transform`. Le dépôt l'a déjà payé sur
       `IconButton` — « l'enfoncement claquait ici et se déroulait là, pour un
       geste identique ». La propriété doit être NOMMÉE. */
    expect(
      lien.className,
      'la transition ne nomme pas `transform` : l’enfoncement claquera',
    ).toMatch(/transition-\[[^\]]*transform[^\]]*\]/)
  })

  it('ne distingue pas l’entrée courante par la seule couleur', async () => {
    await renderApp('/demo')
    const lien = await entree(/tableau de bord/i)

    /* `NavLink` pose `aria-current` tout seul : c'est lui qui dit « ici » aux
       technologies d'assistance, et c'est par lui qu'on reconnaît l'entrée
       courante sans lire une classe. */
    expect(lien.getAttribute('aria-current'), 'l’entrée courante n’est pas annoncée').toBe('page')

    /* LE REPÈRE EST UN NŒUD, donc une FORME — un signal qui ne tient pas à la
       teinte. C'est ce qui manquait au rail replié, où il n'y a pas de libellé à
       mettre en gras. */
    const repere = lien.querySelector('[aria-hidden="true"][class*="rounded-full"]')
    expect(repere, 'l’entrée courante n’a pas de repère de forme').not.toBeNull()
  })

  it('ne pose ce repère que sur l’entrée courante', async () => {
    await renderApp('/demo')
    const autre = await entree(/locataires/i)

    /* LE CONTREPOIDS, et il vaut le cas : un repère posé partout ne repère
       rien. */
    expect(autre.getAttribute('aria-current')).toBeNull()
    expect(
      autre.querySelector('[aria-hidden="true"][class*="rounded-full"]'),
      'une entrée qui n’est pas la courante porte le repère',
    ).toBeNull()
  })
})
