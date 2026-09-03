import { describe, expect, it } from 'vitest'
// @ts-expect-error — script Node en JavaScript, hors du projet TypeScript.
import { inventaireDesRoutes, ROUTES_ATTENDUES } from '../../scripts/inventaire/routes.mjs'

/**
 * LE PLANCHER DES ROUTES NE DOIT PAS FLOTTER SOUS LE RÉEL.
 *
 * ═══ CE QU'IL EST, ET POURQUOI IL EST ASYMÉTRIQUE ═══
 *
 * `ROUTES_ATTENDUES` garde l'inventaire des écrans : si le lecteur de routes en
 * rend MOINS, il lève. Son commentaire explique l'asymétrie — « ajouter une
 * route fait monter le compte et ne dérange personne ; en retirer une le fait
 * tomber et arrête tout » — et elle est juste : un écran sorti du champ de la
 * mesure se lit « aucun défaut » alors qu'il veut dire « pas regardé ».
 *
 * ═══ CE QUE L'ASYMÉTRIE COÛTE, ET QUI A ÉTÉ PAYÉ ═══
 *
 * Un plancher qu'on n'a pas à monter n'est jamais monté. Le 2026-09-03, il
 * valait 23 pour 24 écrans réels : il flottait UN CRAN SOUS LE RÉEL, et un écran
 * pouvait donc disparaître sans que rien ne tombe. Personne ne l'a su pendant
 * des semaines — il n'y a pas d'alarme pour « ce plancher a vieilli ». Il a été
 * trouvé par accident, en cherchant pourquoi `releve-refonte` refusait son
 * propre relevé.
 *
 * ═══ CE QU'ELLE FAIT, ET CE QU'ELLE NE TOUCHE PAS ═══
 *
 * Elle exige l'ÉGALITÉ, ici, dans une suite qui dure une seconde. Le contrôle
 * d'EXÉCUTION du lecteur de routes reste une inégalité : ajouter une route ne
 * fait donc toujours pas tomber une porte au navigateur en plein passage. Les
 * deux cohabitent, et c'est tout le dessin — l'asymétrie protège les portes
 * longues, l'égalité empêche le plancher de pourrir.
 *
 * Ajouter un écran fera rougir CE cas, avec le nombre à écrire. C'est le motif
 * des registres à la main de ce dépôt : toucher la ligne oblige à voir le diff,
 * donc à répondre du compte.
 *
 * ═══ POURQUOI CÔTÉ SERVEUR ═══
 *
 * Écrite dans `src/`, elle échouait : `scripts/inventaire/routes.mjs` résout ses
 * chemins depuis `import.meta.url`, que la transformation de vitest préfixe de
 * `/@fs/`. Le module cherchait alors `/@fs/…/src/features/auth/signupState.ts`
 * et ne le trouvait pas. En environnement Node, l'URL est un vrai chemin.
 * Mesuré, pas supposé — `variablesDAvis.test.ts` vit ici pour une raison
 * voisine.
 */
const routes = (): { adresse: string }[] =>
  (inventaireDesRoutes as () => { adresse: string }[])()

describe('le plancher des routes', () => {
  it('lit bien des routes — sans quoi cette garde ne garderait rien', () => {
    /* Un lecteur cassé rendrait zéro, et l'égalité ci-dessous ne comparerait
       plus que deux façons de ne rien savoir. */
    expect(routes().length).toBeGreaterThanOrEqual(10)
  })

  it('vaut EXACTEMENT le nombre d’écrans, jamais un de moins', () => {
    const reelles = routes().length
    expect(
      ROUTES_ATTENDUES as number,
      `le plancher flotte sous le réel : ${reelles} écrans existent, il en exige ` +
        `${ROUTES_ATTENDUES}. Autant d'écrans peuvent sortir du champ de la mesure sans ` +
        "que rien ne tombe. Écrivez le nombre dans `scripts/inventaire/routes.mjs`.",
    ).toBe(reelles)
  })
})
