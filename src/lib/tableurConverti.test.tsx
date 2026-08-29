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

/**
 * LE TABLEUR DIT SUR QUOI IL A CONVERTI — dans son EN-TÊTE.
 *
 * ═══ UN CSV N'A AUCUNE PLACE POUR DE LA PROSE ═══
 *
 * Les documents portent leur mention en bas de feuille, en petit. Un tableur
 * n'a pas de bas de feuille : une ligne ajoutée avant l'en-tête casse tout
 * analyseur qui suppose que la première ligne nomme les colonnes, et une ligne
 * ajoutée après les données entre dans les colonnes qu'on somme.
 *
 * Le seul endroit à la fois SÛR et attaché à ce qu'il qualifie est l'en-tête de
 * colonne. Il portait déjà la devise — « Loyer (FCFA) » —, et c'est la même
 * phrase qu'il faut prolonger : cette colonne est en euros, convertis de telle
 * monnaie à telle date.
 *
 * ═══ POURQUOI CELA COMPTE PLUS ICI QU'AILLEURS ═══
 *
 * Un tableur se somme, se recoupe et se TRANSMET. Il quitte le produit, arrive
 * chez un comptable ou dans un dossier, et personne ne se souvient alors des
 * réglages de l'écran d'où il sort. La colonne doit se suffire.
 */
describe('la mention de conversion dans le tableur', () => {
  it('nomme la devise d’origine et date le cours', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions', { currency: 'CAD' })
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /tableur|spreadsheet/i }))
      const [fichier] = await capture.settle()
      const entete = new TextDecoder().decode(fichier.bytes).split('\r\n')[0] ?? ''

      /* Le dollar canadien FLOTTE : son cours se publie, et la colonne doit
         dire de quel jour il date. Le faux serveur le fige au 28/08/2026. */
      expect(entete, 'la devise d’origine n’est pas nommée').toContain('FCFA')
      expect(entete, 'le cours n’est pas daté').toContain('28/08/2026')
    } finally {
      capture.restore()
    }
  })

  it('nomme la parité quand elle n’a pas de date', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions', { currency: 'EUR' })
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /tableur|spreadsheet/i }))
      const [fichier] = await capture.settle()
      const entete = new TextDecoder().decode(fichier.bytes).split('\r\n')[0] ?? ''

      /* Le franc et l'euro sont liés par traité : 655,957, sans date. Dater une
         parité inventerait une péremption — même règle que les documents. */
      expect(entete).toMatch(/parité légale|legal parity/)
      expect(entete, 'une date a été inventée pour une parité').not.toContain('28/08/2026')
    } finally {
      capture.restore()
    }
  })

  /**
   * LE CONTREPOIDS. Sans conversion, l'en-tête ne s'allonge pas.
   *
   * Une mention sur un fichier exact jetterait un doute sur des montants qui
   * n'en méritent pas — et allongerait chaque en-tête de colonne d'argent du
   * produit, sur le chemin le plus courant.
   */
  it('garde l’en-tête court quand rien n’est converti', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /tableur|spreadsheet/i }))
      const [fichier] = await capture.settle()
      const entete = new TextDecoder().decode(fichier.bytes).split('\r\n')[0] ?? ''

      expect(entete).toContain('Consigné (FCFA)')
      expect(entete, 'un fichier exact s’explique').not.toMatch(/converti|converted/i)
    } finally {
      capture.restore()
    }
  })

  /**
   * ET LE NOM DU FICHIER PORTE LA DEVISE.
   *
   * Deux exports du même parc lus dans deux monnaies rendaient deux fichiers de
   * MÊME NOM : le second écrase le premier dans le dossier des téléchargements,
   * sans un mot. C'est la réserve du lot précédent, et elle se ferme ici parce
   * que c'est la même question — un fichier qui quitte le produit doit se
   * suffire, nom compris.
   */
  it('distingue deux exports de devises différentes', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions', { currency: 'CAD' })
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /tableur|spreadsheet/i }))
      const [fichier] = await capture.settle()
      expect(fichier.name, 'le nom ne dit pas dans quelle monnaie il est').toMatch(/cad/i)
    } finally {
      capture.restore()
    }
  })
})
