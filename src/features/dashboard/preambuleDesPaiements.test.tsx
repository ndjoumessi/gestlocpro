import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * L'ÉCRAN DES PAIEMENTS GARDE SON CHIFFRE, ET REND LES DEUX AUTRES.
 *
 * ═══ CE QU'IL FAISAIT, MESURÉ À 375 px ═══
 *
 * La première ligne de paiement apparaissait à 940 px — un écran et seize
 * centièmes de préambule :
 *
 *     223 px   en-tête, titre, sous-titre, boutons
 *     362 px   trois cartes d'indicateur
 *      96 px   les filtres — Tous 10, À jour 6, Partiel 1, En retard 3
 *      37 px   la légende des cellules de mois
 *
 * ═══ DEUX DES TROIS CARTES SONT LE TABLEAU DE BORD, MOT POUR MOT ═══
 *
 * Relevé le 2026-09-06, `/demo` contre `/demo/paiements` :
 *
 *     « Encaissé ce mois 950 000 FCFA −24 % vs. 1 250 000 FCFA le mois dernier »
 *     « Payé            950 000 FCFA −24 % vs. 1 250 000 FCFA le mois dernier »
 *
 *     « Loyers attendus 1 397 000 FCFA · 10 baux actifs »
 *     « Loyers attendus 1 397 000 FCFA »
 *
 * Le même nombre, le même écart, la même comparaison — à un onglet de distance
 * dans la barre du bas.
 *
 * ═══ « EN RETARD » RESTE, ET CE N'EST PAS UN COMPROMIS ═══
 *
 * 412 000 FCFA, et le tableau de bord n'a pas ce nombre : il porte « Reste à
 * percevoir 447 000 FCFA », qui compte AUSSI ce qui n'est pas encore échu. Trente
 * -cinq mille francs les séparent, et c'est exactement la question de cet
 * écran-ci. On ne retire pas le chiffre d'un écran de son écran.
 *
 * La rangée de filtres juste en dessous dit « En retard 3 » — un COMPTE de
 * locataires, pas une somme. Les deux ne se remplacent pas.
 *
 * ═══ LE BUREAU NE BOUGE PAS ═══
 *
 * Au-dessus de `lg` la grille a plusieurs colonnes : la rangée coûte une hauteur
 * de carte, et les trois se lisent d'un regard.
 */
describe('les paiements sur un téléphone', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements', { largeur: 360 })
    await attendreLeChargement()
  }

  it('ne garde QUE la carte propre à cet écran', async () => {
    await ouvrir()
    const cartes = Array.from(document.querySelectorAll<HTMLElement>('[data-indicateur]'))
    expect(cartes.length, 'les deux cartes du tableau de bord sont encore là').toBe(1)
    expect(cartes[0]!.textContent).toMatch(/En retard/)
  })

  it('ne redit PLUS ce que le tableau de bord porte déjà', async () => {
    /* Le nombre lui-même, et non le libellé : c'est lui qui est en double. */
    await ouvrir()
    const cartes = Array.from(document.querySelectorAll<HTMLElement>('[data-indicateur]'))
      .map((e) => e.textContent ?? '')
      .join(' ')
    expect(cartes).not.toMatch(/1 397 000/)
    expect(cartes).not.toMatch(/le mois dernier/)
  })

  it('GARDE ses filtres et sa légende', async () => {
    /* Ni l'un ni l'autre ne se trouve ailleurs : le compte par état est propre à
       cet écran, et la légende explique ses cellules de mois. Alléger un
       préambule ne veut pas dire le vider. */
    await ouvrir()
    expect(screen.getByRole('group', { name: /État|Statut/i })).toBeInTheDocument()
    expect(screen.getByText(/loyer · eau · électricité/i)).toBeInTheDocument()
  })
})

describe('les paiements sur un écran large', () => {
  it('gardent leurs TROIS cartes', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements', { largeur: 1280 })
    await attendreLeChargement()
    expect(document.querySelectorAll('[data-indicateur]').length).toBe(3)
  })
})
