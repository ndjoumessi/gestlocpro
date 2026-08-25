import { describe, expect, it } from 'vitest'
import { StockageLocal } from './local.js'
import { choisirLeStockage, leStockage, remplacerStockage } from './stockage.js'
import {
  typeDesOctets,
  type AdresseDeLecture,
  type Confirmation,
  type Reservation,
  type Stockage,
} from './contrat.js'

/**
 * LA COUTURE elle-même : la sélection et la substitution.
 *
 * Ce qui est gardé ici n'est pas le comportement d'un dépôt, mais les deux
 * décisions qui décident lequel tourne — et elles se prennent toutes les deux
 * une seule fois, au démarrage, là où personne ne regarde.
 */
function faux(nom: string): Stockage {
  const jamais = () => {
    throw new Error(`Le dépôt « ${nom} » ne devait pas être appelé.`)
  }
  return {
    reserver: jamais as () => Promise<Reservation>,
    confirmer: jamais as () => Promise<Confirmation>,
    lire: jamais as () => Promise<AdresseDeLecture>,
    supprimer: jamais as () => Promise<void>,
    toString: () => nom,
  } as Stockage
}

describe('le choix de l’implémentation', () => {
  it('retombe sur le dépôt local quand rien n’est configuré', () => {
    const local = faux('local')

    expect(choisirLeStockage('production', () => local)).toBe(local)
  })

  /**
   * LA CLAUSE QUI COMPTE.
   *
   * Une suite de tests écrit, confirme et EFFACE. Lancée sur une machine où
   * traînent les variables du dépôt réel — celle d'un développeur qui vient de
   * déployer —, elle le ferait sur le seau de production, sans qu'aucune ligne
   * de test ne dise quel dépôt elle vise.
   */
  it('refuse le dépôt distant en test, même quand il est configuré', () => {
    const local = faux('local')
    const distant = faux('distant')

    expect(choisirLeStockage('test', () => local, () => distant)).toBe(local)
  })

  it('prend le dépôt distant hors test, quand il est configuré', () => {
    const local = faux('local')
    const distant = faux('distant')

    expect(choisirLeStockage('production', () => local, () => distant)).toBe(distant)
  })

  it('sert le dépôt local à la suite de tests', () => {
    expect(leStockage()).toBeInstanceOf(StockageLocal)
  })
})

describe('la substitution pour les tests', () => {
  /**
   * LA RESTAURATION EST LA MOITIÉ DU MOTIF.
   *
   * Un remplaçant qui survit à son cas transforme les suivants en spectateurs
   * d'un dépôt qu'ils n'ont pas choisi — et l'échec tombe alors sur un autre
   * fichier que celui qui l'a causé.
   */
  it('rend la fonction qui restaure, et elle restaure vraiment', () => {
    const initial = leStockage()
    const remplacant = faux('remplaçant')

    const restaurer = remplacerStockage(remplacant)
    expect(leStockage()).toBe(remplacant)

    restaurer()
    expect(leStockage()).toBe(initial)
  })

  it('restaure par empilement, et non vers un état supposé', () => {
    const initial = leStockage()
    const premier = faux('premier')
    const second = faux('second')

    const defaire1 = remplacerStockage(premier)
    const defaire2 = remplacerStockage(second)

    defaire2()
    expect(leStockage()).toBe(premier)
    defaire1()
    expect(leStockage()).toBe(initial)
  })
})

describe('la lecture du type dans les octets', () => {
  it('ne reconnaît pas le HEIC, et c’est délibéré', () => {
    const heic = new Uint8Array(16)
    heic.set([...'ftypheic'].map((c) => c.charCodeAt(0)), 4)

    expect(typeDesOctets(heic)).toBeNull()
  })

  it('ne se laisse pas prendre par une entête tronquée', () => {
    expect(typeDesOctets(new Uint8Array([0xff, 0xd8]))).toBeNull()
    expect(typeDesOctets(new Uint8Array(0))).toBeNull()
  })
})
