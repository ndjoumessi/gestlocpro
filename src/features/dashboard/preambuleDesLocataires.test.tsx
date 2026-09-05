import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * L'ÉCRAN DES LOCATAIRES COMMENCE PAR LES LOCATAIRES.
 *
 * ═══ CE QU'IL FAISAIT, MESURÉ AU NAVIGATEUR ═══
 *
 * À 375 px, le premier nom apparaissait à 1 223 px — UN ÉCRAN ET DEMI de
 * préambule sur l'écran dont le geste est « trouver quelqu'un ». Quatre blocs
 * empilés avant lui :
 *
 *     193 px   en-tête, titre, deux boutons
 *     165 px   une note : « 1 locataire n'a pas de compte »
 *     421 px   trois cartes d'indicateur
 *     204 px   la carte des demandes de documents
 *
 * ═══ DEUX DES TROIS CARTES REDISENT LE TABLEAU DE BORD ═══
 *
 * Relevé sur `/demo` : « Loyers attendus 1 397 000 FCFA · 10 baux actifs » et
 * « Taux d'occupation 83 % · 2 unités vacantes ». Les cartes de cet écran-ci
 * disent « Baux actifs 10 · 2 logements vacants » et « Loyer mensuel
 * 1 397 000 FCFA ». Les mêmes nombres, à un clic de distance.
 *
 * La troisième — « Pièces demandées 1 » — chapeaute la carte qui la SUIT
 * immédiatement et qui liste cette pièce avec son titre, son locataire et sa
 * date. Un compte au-dessus de la liste qu'il compte.
 *
 * Sous `lg`, où la grille n'a qu'UNE colonne et où ces 421 px se paient en
 * défilement, elles partent donc. Aucune information ne quitte le produit : deux
 * sont sur le tableau de bord, la troisième est le titre de son propre détail.
 *
 * ═══ LA NOTE RESTE, PARCE QU'ELLE AGIT ═══
 *
 * « 1 locataire n'a pas de compte » est un AVERTISSEMENT avec un geste — relier
 * la fiche. La fiche d'Éric Ndongo porte déjà la marque « Sans compte », donc le
 * FAIT est sur sa ligne ; ce que la note ajoute est l'action, et elle ne se
 * répète nulle part. On ne retire pas une action pour gagner des pixels.
 *
 * ═══ LE BUREAU NE BOUGE PAS ═══
 *
 * À 1280 la grille a trois colonnes, le tableau tient en deux écrans, et les
 * cartes ne coûtent qu'une rangée. Rien de ce lot ne s'y applique.
 */
const avant = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('les locataires sur un téléphone', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/locataires', { largeur: 360 })
    await attendreLeChargement()
  }

  it('n’empile plus les trois cartes d’indicateur', async () => {
    /* 421 px, dont deux cartes qui redisent le tableau de bord et une qui
       chapeaute la carte suivante. */
    await ouvrir()
    expect(document.querySelectorAll('[data-indicateur]').length).toBe(0)
  })

  it('met la LISTE avant la file des demandes de documents', async () => {
    /* Une file de pièces à fournir est la corvée du propriétaire, pas la
       question de l'écran. Elle reste entière — elle passe derrière. */
    await ouvrir()
    const liste = document.querySelector('[data-fiche]')
    const demandes = screen.getByRole('heading', { name: /Demandes de documents/ })
    expect(liste, 'aucune fiche rendue').not.toBeNull()
    expect(
      avant(liste!, demandes),
      'la file des demandes passe encore avant les locataires',
    ).toBe(true)
  })

  it('GARDE la note du locataire sans compte, et son geste', async () => {
    /* Elle porte une ACTION qui ne se répète nulle part. Gagner des pixels en
       retirant un avertissement serait déplacer le défaut, pas le régler. */
    await ouvrir()
    expect(screen.getByText(/n’a pas de compte/)).toBeInTheDocument()
  })

  it('GARDE la marque « Sans compte » sur la fiche concernée', async () => {
    /* Le fait vit sur la ligne qu'il concerne — c'est ce qui rend la note
       supportable en bas plutôt qu'en haut. */
    await ouvrir()
    const fiches = Array.from(document.querySelectorAll<HTMLElement>('[data-fiche]'))
    expect(fiches.filter((f) => /Sans compte/.test(f.textContent ?? '')).length).toBe(1)
  })
})

describe('les locataires sur un écran large', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/locataires', { largeur: 1280 })
    await attendreLeChargement()
  }

  it('garde ses trois cartes d’indicateur', async () => {
    await ouvrir()
    expect(document.querySelectorAll('[data-indicateur]').length).toBe(3)
  })

  it('garde la file des demandes AVANT le tableau', async () => {
    /* La grille a trois colonnes et le tableau tient en deux écrans : l'ordre
       d'origine n'y coûte rien, et le changer serait déplacer un défaut qui
       n'existe pas là. */
    await ouvrir()
    const tableau = document.querySelector('table')
    const demandes = screen.getByRole('heading', { name: /Demandes de documents/ })
    expect(tableau).not.toBeNull()
    expect(avant(demandes, tableau!)).toBe(true)
  })
})
