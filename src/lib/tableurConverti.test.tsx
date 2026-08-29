import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { captureDownloads } from '@/test/downloads'

/**
 * UN EXPORT TABLEUR DIT CE QUE LA PAGE DIT.
 *
 * ═══ LE DÉFAUT, ET IL EST DE MOI ═══
 *
 * `useCsvMoney.amount` divisait par les décimales de la devise DEMANDÉE sans
 * jamais convertir. Un parc de Douala lu en euros exportait donc
 * « Refacturé (Euro (€)) · 259,42 » pour 25 942 FCFA — qui valent 39,55 €. Un
 * facteur 6,5, sous un en-tête qui annonce des euros.
 *
 * Le lot de la conversion a fait suivre la devise choisie aux écrans, puis aux
 * documents. Les EXPORTS sont restés en arrière, et personne ne les a regardés :
 * la démonstration tourne en franc CFA, où `10 ** 0` vaut un et où diviser par
 * la mauvaise devise ne change rien. Exactement l'angle mort qui a produit tous
 * les défauts de cette campagne.
 *
 * ═══ POURQUOI C'EST PIRE QU'À L'ÉCRAN ═══
 *
 * Le commentaire de `useCsvMoney` le dit déjà, contre un autre défaut : « un
 * fichier qui contredit la page dont il est l'export fausse toute somme qu'on
 * en tire ». Un chiffre à l'écran se relit dans son contexte ; un tableur se
 * somme, se recoupe et se transmet.
 */

describe('l’export tableur', () => {
  it('convertit ses montants, comme la page', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves', { currency: 'EUR' })
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getAllByRole('button', { name: /Exporter|Export/ })[0])
      const [fichier] = await capture.settle()
      const tableur = new TextDecoder().decode(fichier.bytes)

      /* 25 942 francs valent 39,55 € à la parité légale. Le NOMBRE : un
         ré-étiquetage garderait 259,42 sous un en-tête en euros. */
      expect(tableur, 'le tableur n’a pas converti').toContain('39,55')
      expect(tableur, 'le montant d’avant est encore là').not.toContain('259,42')
      /* Et l'en-tête porte la devise, comme avant — c'est elle qui donne son
         unité à toute la colonne. */
      expect(tableur).toMatch(/Refacturé \(Euro/)
    } finally {
      capture.restore()
    }
  })

  /**
   * LE CONTREPOIDS. En franc CFA, rien ne bouge.
   *
   * C'est la devise du marché visé et celle de la démonstration : un correctif
   * qui l'aurait déplacée d'un centime serait passé inaperçu ici et aurait
   * faussé tous les exports réels.
   */
  it('laisse le parc dans sa propre monnaie intact', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getAllByRole('button', { name: /Exporter|Export/ })[0])
      const [fichier] = await capture.settle()
      const tableur = new TextDecoder().decode(fichier.bytes)

      expect(tableur, 'le montant du parc a bougé').toContain('25942')
      expect(tableur).toMatch(/Refacturé \(FCFA\)/)
    } finally {
      capture.restore()
    }
  })
})
