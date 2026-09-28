import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'

/**
 * LA BOÎTE AUX LETTRES REND L'ORDRE QU'ELLE ANNONCE.
 *
 * ═══ CE QUE L'ÉCRAN PROMET, ET CE QU'IL RENDAIT ═══
 *
 * Son sous-titre dit « du plus récent au plus ancien ». Mesuré sur la
 * démonstration au 28 septembre 2026, il rendait : 2 h, 6 h, hier, hier,
 * 40 MINUTES, 5 h, hier, avant-hier, 3 j, 5 j, 6 j. Le signalement le plus
 * récent du parc — une fuite qui coule depuis quarante minutes — était en
 * CINQUIÈME position, sous trois avis de la veille.
 *
 * ═══ D'OÙ VENAIT L'ORDRE ═══
 *
 * De nulle part. `ALERTS` est un tableau écrit à la main, et l'écran rendait
 * son ordre de DÉCLARATION. Le serveur, lui, trie bien — `orderBy createdAt
 * desc` —, si bien que le défaut ne se voyait que sur la démonstration, c'est-
 * à-dire sur l'écran que tout visiteur regarde en premier.
 *
 * ═══ POURQUOI TRIER DANS L'ÉCRAN ET NON RANGER LE TABLEAU ═══
 *
 * Ranger le tableau à la main le laisse se dérégler au prochain avis ajouté,
 * en silence. L'écran qui PROMET un ordre est celui qui doit l'établir — et il
 * le doit d'autant plus qu'il replie les séries de relances, ce qui déplace
 * des cartes après coup.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * Le tri des unités longues — semaine, mois, année. `relatif()` n'en émet
 * aucune aujourd'hui, mais le type les autorise : elles se gardent à part,
 * dans `ancienneteDesAvis.test.ts`.
 */

/** Les cartes de la liste, dans l'ordre du DOM. */
function cartes(): HTMLElement[] {
  const liste = screen.getByRole('list', { name: /signalements|notifications/i })
  return within(liste).getAllByRole('listitem')
}

/** Le rang de la première carte qui porte ce texte, ou −1. */
function rangDe(extrait: RegExp): number {
  return cartes().findIndex((c) => extrait.test(c.textContent ?? ''))
}

describe('l’ordre des avis', () => {
  it('met le plus récent en tête', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    /* SIG-2026-044 a QUARANTE MINUTES. C'est le plus récent avis du jeu, et le
       seul qui se mesure en minutes — aucun autre ne peut lui disputer la
       première place par arrondi. */
    expect(
      cartes()[0]?.textContent ?? '',
      'la tête de liste n’est pas l’avis le plus récent, alors que le sous-titre promet cet ordre',
    ).toMatch(/SIG-2026-044/)
  })

  it('range les heures entre elles, et avant les jours', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    /*
      QUATRE RANGS, ET CHACUN DIT UNE CHOSE DIFFÉRENTE.

      40 min < 2 h éprouve la conversion entre DEUX UNITÉS — c'est le rang que
      l'ordre de déclaration cassait le plus visiblement. 2 h < 5 h < 6 h
      éprouve le tri à unité ÉGALE. Et le dernier, 6 h < 1 j, éprouve que la
      carte repliée des relances garde la date de sa plus récente, celle qui la
      porte : la série entière descendrait sinon au 13 du mois.
    */
    const fuite = rangDe(/SIG-2026-044/)
    const retard = rangDe(/Loyer A3/)
    const devis = rangDe(/Devis à arbitrer/)
    const rappel = rangDe(/Rappel de loyer/)
    const reponse = rangDe(/Réponse de Charles Ngassa/)

    for (const [nom, rang] of [
      ['la fuite (40 min)', fuite],
      ['le retard (2 h)', retard],
      ['le devis (5 h)', devis],
      ['le rappel (6 h)', rappel],
      ['la réponse (1 j)', reponse],
    ] as const) {
      expect(rang, `${nom} est absent de la liste : le cas ne garde rien`).toBeGreaterThanOrEqual(0)
    }

    expect(retard, 'un avis de 2 h passe avant un de 40 minutes').toBeGreaterThan(fuite)
    expect(devis, 'un avis de 5 h passe avant un de 2 h').toBeGreaterThan(retard)
    expect(rappel, 'un avis de 6 h passe avant un de 5 h').toBeGreaterThan(devis)
    expect(reponse, 'un avis d’un jour passe avant un de 6 h').toBeGreaterThan(rappel)
  })
})
