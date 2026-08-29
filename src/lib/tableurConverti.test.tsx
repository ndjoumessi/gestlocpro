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
      expect(tableur).toMatch(/Refacturé \(Euro\)/)
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
 * LE TABLEUR DIT SUR QUOI IL A CONVERTI — EN BAS, pas dans chaque en-tête.
 *
 * ═══ CE QUE LA PREMIÈRE RÉDACTION A DONNÉ ═══
 *
 * J'avais écrit qu'un CSV n'a pas de bas de feuille, et posé la mention dans
 * l'en-tête de CHAQUE colonne d'argent. Ouvert dans un tableur, l'état des
 * cautions rendait ceci :
 *
 *   Consigné (CAD ($), converti du FCFA au taux du 28/08/2026) │ Retenu (CAD…
 *
 * Trois fois la même phrase, deux cents caractères de ligne d'en-tête, et un
 * tableau qui ne tient plus dans une fenêtre. La mention était juste et sa
 * place ne l'était pas.
 *
 * ═══ UN CSV A UN BAS DE FEUILLE ═══
 *
 * L'affirmation était fausse. Une ligne VIDE puis une note, après les données,
 * ne touchent pas la table : les tableurs les affichent sous elle, `SUM` ignore
 * une cellule de texte, et un analyseur qui lit ligne à ligne rencontre une
 * ligne vide — la fin naturelle d'un enregistrement.
 *
 * Ce qui reste dans l'en-tête est l'UNITÉ, courte : « Consigné (CAD) ». C'est ce
 * qu'une colonne doit porter, et rien de plus.
 *
 * ═══ POURQUOI LA MENTION EXISTE QUAND MÊME ═══
 *
 * Les cautions ont été versées en FRANCS. Les 713,11 $ sont une conversion, pas
 * ce qui a été reçu : un fichier qui l'oublie affirme un encaissement qui n'a
 * pas eu lieu. Un tableur se somme, se recoupe et se TRANSMET — il arrive chez
 * un comptable, et personne ne se souvient alors des réglages de l'écran d'où
 * il sort.
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
      const lignes = new TextDecoder().decode(fichier.bytes).split('\r\n')
      const entete = lignes[0] ?? ''
      const pied = lignes.slice(-3).join(' ')

      /* L'EN-TÊTE NE PORTE QUE L'UNITÉ. Une colonne dit ce qu'elle mesure ; la
         provenance des chiffres vaut pour le fichier entier. */
      expect(entete, 'l’en-tête reprend la mention').not.toMatch(/converti|converted/i)
      expect(entete).toContain('Consigné (CAD)')

      /* Le dollar canadien FLOTTE : son cours se publie, et le fichier doit
         dire de quel jour il date. Le faux serveur le fige au 28/08/2026. */
      expect(pied, 'la devise d’origine n’est pas nommée').toContain('FCFA')
      expect(pied, 'le cours n’est pas daté').toContain('28/08/2026')

      /* UNE LIGNE VIDE SÉPARE LA NOTE DES DONNÉES : sans elle, la mention est
         une ligne du tableau, et elle entre dans ce qu'on somme. */
      expect(lignes[lignes.length - 3], 'la note colle aux données').toBe('')
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
      const fichierTexte = new TextDecoder().decode(fichier.bytes)

      /* Le franc et l'euro sont liés par traité : 655,957, sans date. Dater une
         parité inventerait une péremption — même règle que les documents. */
      expect(fichierTexte).toMatch(/parité légale|legal parity/)
      expect(fichierTexte, 'une date a été inventée pour une parité').not.toContain('28/08/2026')
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
      const fichierTexte = new TextDecoder().decode(fichier.bytes)

      expect(fichierTexte).toContain('Consigné (FCFA)')
      expect(fichierTexte, 'un fichier exact s’explique').not.toMatch(/converti|converted/i)
      /* ET AUCUNE LIGNE VIDE EN QUEUE : sans conversion, il n'y a pas de note,
         donc pas de séparateur qui la précède. */
      expect(fichierTexte.trimEnd().split('\r\n').at(-1), 'un pied vide a été posé').toMatch(
        /^C3;/,
      )
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
