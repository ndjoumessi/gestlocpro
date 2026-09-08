import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp } from '@/test/render'

/**
 * SUR UN TÉLÉPHONE, UN INDICATEUR QUI REDIT LE TABLEAU DE BORD NE PARAÎT PAS.
 *
 * Deux écrans replient leurs cartes sous `lg`, et c'est une décision MESURÉE —
 * relevée le 2026-09-06 à 375 px, écrite en toutes lettres dans `Payments.tsx`
 * et `Tenants.tsx` :
 *
 *   /demo             « Encaissé ce mois 950 000 FCFA −24 % vs. 1 250 000 »
 *   /demo/paiements   « Payé             950 000 FCFA −24 % vs. 1 250 000 »
 *
 * Mot pour mot, à un onglet de distance dans la barre du bas, pour 130 px sur
 * les 940 qui séparaient le haut de l'écran de la première ligne de paiement.
 * Chez les locataires, c'est 421 px empilés pour deux cartes qui redisent
 * « Loyers attendus » et « Taux d'occupation ».
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * Parce que cette décision ne tenait QU'À CETTE PROSE. Aucun cas ne la gardait,
 * sur aucun des quatre écrans qui emploient `useAuDela(AU_DELA_LG)` — et une
 * règle de produit qui ne vit que dans un commentaire vieillit seule : le
 * prochain qui trouvera l'écran « vide » sur son téléphone remettra les cartes,
 * et toutes les portes resteront vertes.
 *
 * Le marché de ce produit est l'Android d'entrée de gamme. C'est la largeur qui
 * compte le plus, et c'était la seule que rien ne tenait.
 *
 * ═══ LES DEUX BOUTS, ET LE SECOND VAUT LE FICHIER ═══
 *
 * Un cas qui exigerait seulement l'absence sur téléphone serait satisfait par un
 * écran qui n'affiche JAMAIS ses indicateurs. On mesure donc aussi qu'au-dessus
 * de `lg` les trois reviennent : ce qui est replié doit être replié, pas perdu.
 *
 * ═══ CE QUI RESTE, ET POURQUOI CE N'EST PAS LA MÊME CHOSE ═══
 *
 * « En retard » demeure sur les paiements à toute largeur, et c'est exactement
 * la carte que le tableau de bord n'a PAS : il porte « Reste à percevoir », qui
 * compte aussi ce qui n'est pas encore échu. Trente-cinq mille francs les
 * séparent dans le jeu de démonstration, et c'est la question de cet écran.
 * Chez les locataires, les trois redisent ou chapeautent : aucune ne reste.
 */

/** Le texte de chaque carte d'indicateur montée, quelle que soit sa forme. */
function indicateurs(): string[] {
  return Array.from(document.querySelectorAll('[data-indicateur]')).map((carte) =>
    (carte.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
}

const TELEPHONE = 375
const BUREAU = 1280

describe('les indicateurs qui redisent le tableau de bord', () => {
  it('ne paraissent pas sur les paiements, à 375 px', async () => {
    await renderApp('/demo/paiements', { largeur: TELEPHONE })
    await attendreLeChargement()

    const vus = indicateurs()
    /* PAR LES CARTES, ET NON PAR LE TEXTE DE LA PAGE. « En retard » est aussi
       le libellé d'une pastille de filtre sur cet écran — chercher la chaîne
       mesurerait deux choses à la fois, et le dépôt a déjà payé cette
       confusion ailleurs. */
    expect(
      vus.join(' | '),
      '« Payé » redit le tableau de bord au franc près, à un onglet de distance',
    ).not.toMatch(/Payé/)
    expect(vus.join(' | '), '« Loyers attendus » y est aussi, avec ses baux actifs').not.toMatch(
      /Loyers attendus/,
    )
    expect(vus, 'le retard reste : c’est la seule que le tableau de bord n’a pas').toHaveLength(1)
    expect(vus[0]).toMatch(/En retard/)
  })

  it('reviennent sur les paiements au-dessus de lg', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER. Sans lui, un écran qui aurait PERDU ses
      indicateurs — et non replié — satisferait le cas précédent sans qu'un mot
      ne le dise.
    */
    await renderApp('/demo/paiements', { largeur: BUREAU })
    await attendreLeChargement()

    const vus = indicateurs()
    expect(vus, 'la rangée compte trois cartes sur un écran large').toHaveLength(3)
    expect(vus.join(' | ')).toMatch(/Payé/)
    expect(vus.join(' | ')).toMatch(/Loyers attendus/)
  })

  it('ne paraissent pas du tout chez les locataires, à 375 px', async () => {
    await renderApp('/demo/locataires', { largeur: TELEPHONE })
    await attendreLeChargement()

    expect(
      indicateurs(),
      '421 px empilés pour des nombres qui sont déjà à un clic',
    ).toHaveLength(0)
  })

  it('reviennent chez les locataires au-dessus de lg', async () => {
    await renderApp('/demo/locataires', { largeur: BUREAU })
    await attendreLeChargement()

    const vus = indicateurs()
    expect(vus, 'trois colonnes, une hauteur de carte, lues d’un regard').toHaveLength(3)
    expect(vus.join(' | ')).toMatch(/Baux actifs/)
    expect(vus.join(' | ')).toMatch(/Loyer mensuel/)
    expect(vus.join(' | ')).toMatch(/Pièces demandées/)
  })
})
