import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN LIBELLÉ DE BARRE BASSE EST UN SEUL MOT COURT, QUI NE SE COUPE JAMAIS.
 *
 * Cinq cases sur 360 px : 68 px chacune, dont le rembourrage. « Tableau de
 * bord » y passait sur deux lignes, « Signalements » se coupait avec un trait
 * d'union — « Signa-lements » —, mesuré le 2026-09-06 à 360 et 375 px. Une
 * étiquette de navigation qu'on lit en deux temps n'est plus une étiquette :
 * on la devine. La barre latérale garde les libellés longs, qui ont la place ;
 * la barre basse prend des libellés courts qui lui sont propres.
 *
 * SEPT SIGNES, SANS ESPACE — et c'est une mesure, pas un raisonnement. La
 * première forme de cette garde admettait neuf, calculés sur 68 px à 360 px ;
 * `mesure-ui` a répondu à 320 px : « Paiemen / ts ». Huit ensuite, et la porte
 * a encore répondu : « Payment / s », « Propert / y ». Sept — « Accueil »,
 * « Alertes », « Reports » — passent. `MESURER_COUPURES` mesure ensuite la
 * coupure réelle dans Chromium ; cette garde tient la règle qui la rend
 * inutile.
 */

const PARC = '17171717-4646-4757-8a4a-616161616161'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}
const PLAFOND = 7

describe('la barre basse', () => {
  it.each(['fr', 'en'] as const)('ne porte que des libellés d’un mot court — %s', async (locale) => {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [],
        works: [],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
      },
    })
    await renderApp('/app', { session: SESSION, locale, largeur: 360 })
    await attendreLeChargement()
    const barre = screen.getByRole('navigation', { name: /rapide|quick/i })
    const libelles = Array.from(
      barre.querySelectorAll<HTMLElement>('[data-mesure="libelle-barre-basse"]'),
      /*
        LE TRAIT D'UNION CONDITIONNEL NE COMPTE PAS POUR UN SIGNE.

        `U+00AD` est INVISIBLE et de largeur nulle tant que la ligne ne casse pas
        à son endroit ; quand elle y casse, il devient un tiret en FIN de ligne,
        jamais un caractère de plus dans le mot. Le plafond ci-dessous parle de ce
        qu'on LIT dans une gélule de barre basse — sept signes —, pas du nombre de
        points de code que la chaîne transporte.

        Sans ce retrait, « Re\u00ADports » comptait pour huit et ce cas refusait
        la césure que `mesure-ui` venait d'exiger : deux portes du même dépôt qui
        se contredisent sur le même libellé, chacune ayant raison de son côté.
      */
    ).map((el) => (el.textContent ?? '').replaceAll('\u00AD', '').trim())
    expect(libelles.length).toBeGreaterThan(0)
    for (const libelle of libelles) {
      expect(libelle, `« ${libelle} » porte une espace`).not.toMatch(/\s/)
      expect(libelle.length, `« ${libelle} » dépasse ${PLAFOND} signes`).toBeLessThanOrEqual(PLAFOND)
    }
  })
})
