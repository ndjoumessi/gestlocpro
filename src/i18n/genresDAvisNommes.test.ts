import { describe, expect, it } from 'vitest'
import { fr } from './fr'
import { en } from './en'

/**
 * CHAQUE GENRE D'AVIS PORTE UN LIBELLÉ, DANS LES DEUX LANGUES.
 *
 * ═══ CE QUE SON ABSENCE DONNAIT À LIRE ═══
 *
 * `Alerts.tsx` compose sa puce par `t(\`app.alerts.kind.\${alert.kind}\`)`. Une
 * clé absente n'est pas une erreur : le dictionnaire rend la CLÉ, et l'écran
 * affiche « app.alerts.kind.announcement » en toutes lettres, sur une carte,
 * en production.
 *
 * `announcement` manquait dans les DEUX dictionnaires. Les journaux de test le
 * disaient — « [i18n] clé manquante : app.alerts.kind.announcement » — en
 * avertissement que rien ne lisait et qui ne faisait rougir personne. Découvert
 * en ajoutant `access`, c'est-à-dire en étant sur le point de refaire la même
 * chose.
 *
 * ═══ LA LISTE EST ÉCRITE À LA MAIN, ET C'EST LE POINT ═══
 *
 * `Alert['kind']` est un type : il s'efface à la compilation, et aucune garde ne
 * peut le parcourir. La recopier ici est le prix d'un compte tenu — ajouter un
 * genre oblige à toucher cette ligne, donc à voir le diff, donc à répondre du
 * libellé manquant. Une liste dérivée du dictionnaire serait d'accord avec
 * elle-même : elle passerait sur zéro genre comme sur six.
 */
const GENRES = ['payment', 'work', 'meter', 'lease', 'announcement', 'access'] as const

describe('les genres d’avis', () => {
  it.each(['fr', 'en'])('sont tous nommés en %s', (langue) => {
    const dico = (langue === 'fr' ? fr : en).app.alerts.kind as Record<string, string>
    const absents = GENRES.filter((g) => !dico[g])
    expect(
      absents,
      `l’écran afficherait « app.alerts.kind.${absents[0] ?? '…'} » sur une carte, en toutes lettres`,
    ).toEqual([])
  })

  it('n’en nomment aucun qui n’existe plus', () => {
    /* Le sens inverse : un libellé qui survit à son genre est du texte mort que
       personne ne voit jamais, et qui se traduit à chaque relecture. */
    const morts = Object.keys(fr.app.alerts.kind).filter(
      (cle) => !(GENRES as readonly string[]).includes(cle),
    )
    expect(morts).toEqual([])
  })
})
