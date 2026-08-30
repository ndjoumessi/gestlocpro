import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { formatMoney } from './currencies'

/**
 * UN CENTIME NE DISPARAÎT PAS PARCE QU'UNE OPTION S'APPELLE « ROND ».
 *
 * ═══ LE DÉFAUT, ET POURQUOI IL ÉTAIT INVISIBLE ═══
 *
 * `compact: true` forçait zéro décimale. L'option est appelée à SOIXANTE-TREIZE
 * endroits — c'est-à-dire partout où le produit montre un montant. Personne ne
 * l'a jamais choisie contre les centimes : en franc CFA, `decimals: 0` rend
 * l'option SANS EFFET, et l'idiome s'est répandu sous une monnaie où il ne
 * coûtait rien. La première conversion en euros l'a rendu visible d'un coup :
 * 681 € là où 681,45 € étaient dus.
 *
 * ═══ CE QUE CELA CASSAIT, ET PAS SEULEMENT L'ŒIL ═══
 *
 * Le tableau des cautions affiche `held`, `withheld` et leur DIFFÉRENCE, chacun
 * arrondi séparément. En euros, la soustraction cesse de tomber juste sous les
 * yeux du lecteur : 710 − 200 = 509. Un montant tronqué n'est pas une question
 * de goût typographique quand il est posé à côté de ses termes.
 *
 * ═══ LA RÈGLE RETENUE ═══
 *
 * L'intention d'origine — ne pas encombrer un chiffre-clé — est juste, et elle
 * survit : on cache les décimales quand elles sont NULLES. « 4 € » plutôt que
 * « 4,00 € », mais « 681,45 € » plutôt que « 681 € ». C'est déjà la règle que
 * la page des tarifs appliquait à la main (`estRondEnUniteDUsage`) ; elle cesse
 * d'être une exception locale.
 *
 * En franc CFA, rien ne change : le reste de la division par 1 est toujours nul.
 */

/** `formatMoney` compose avec des insécables — fine entre les tranches, pleine
 *  devant le symbole. On les ramène à l'espace ordinaire pour que l'attendu se
 *  relise, plutôt que d'écrire des points de code dans une chaîne. */
const lisible = (montant: string) => montant.replace(/[\s\u202f\u00a0]/g, ' ')

describe('un montant compact', () => {
  /* LE CONTREPOIDS, et il est vert avant le correctif : l'option inconnue est
     ignorée, donc les décimales sortent. Son rôle est de le rester après —
     sinon « compact » ne serait qu'un autre nom pour le rognage. */
  it('garde ses centimes quand ils ne sont pas nuls', () => {
    expect(lisible(formatMoney(68_145, 'EUR', { compact: true }))).toBe('681,45 €')
  })

  it('ne montre pas des décimales nulles', () => {
    expect(lisible(formatMoney(68_100, 'EUR', { compact: true }))).toBe('681 €')
    expect(lisible(formatMoney(447_000, 'CFA', { compact: true }))).toBe('447 000 FCFA')
  })
})

/**
 * LA MÊME RÈGLE, VUE DE L'ÉCRAN.
 *
 * Le cas unitaire au-dessus mesure la fonction ; celui-ci mesure qu'elle est
 * bien celle que les écrans appellent. Sans lui, renommer l'option sans changer
 * un seul appelant laisserait les deux cas verts et l'écran inchangé.
 */
describe('le tableau de bord en euros', () => {
  it('affiche les centimes d’un montant converti', async () => {
    installerFauxServeur()
    await renderApp('/demo', { currency: 'EUR' })
    await attendreLeChargement()

    /* 447 000 francs valent 681,45 € à la parité légale. C'est le « reste à
       percevoir » : un montant qu'on encaisse, pas une décoration. */
    const principal = screen.getByRole('main').textContent?.replace(/[\s ]/g, ' ') ?? ''
    expect(principal, 'les centimes ont été rognés à l’affichage').toMatch(/681,45/)
  })
})
