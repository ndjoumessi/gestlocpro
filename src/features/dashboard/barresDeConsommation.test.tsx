import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LA CONSOMMATION SE COMPARE, ET C'EST POUR ÇA QU'ON OUVRE CET ÉCRAN.
 *
 * Les relevés sont la seule donnée de ce produit qu'on parcourt sans chercher
 * une ligne précise : on descend la colonne pour voir si un logement sort du
 * lot — une fuite, un chauffe-eau resté allumé, un index mal recopié. Dix
 * nombres alignés ne donnent pas cette réponse ; un filet proportionnel sous
 * chacun la donne d'un balayage.
 *
 * ═══ CE QUE CE FICHIER TIENT, ET QUI NE SE TIENT PAS AU NAVIGATEUR ═══
 *
 * L'ÉCHELLE. `couleur-non-seule` vérifie qu'aucun sens ne repose sur la seule
 * teinte, `plafond-hauteurs` que le filet ne coûte pas un pixel de document ;
 * ni l'une ni l'autre ne sait si la barre la plus longue est celle du plus gros
 * relevé. C'est pourtant la seule chose qui rend la colonne lisible : une barre
 * dont la longueur ne suit pas son nombre est un mensonge tracé.
 *
 * ET SURTOUT, L'ÉCHELLE SUIT CE QUI EST AFFICHÉ. Filtrer sur « Relevé saisi »
 * retire des lignes, donc peut retirer le maximum : une échelle figée sur le
 * parc entier laisserait, après filtrage, une colonne dont aucune barre
 * n'atteint le bout — mesurée contre un repère invisible.
 */

/** La part rendue par un filet, en pourcentage — c'est sa largeur en ligne. */
function partDuFilet(cellule: HTMLElement): number | null {
  const filet = cellule.querySelector<HTMLElement>('[aria-hidden="true"][style*="width"]')
  if (!filet) return null
  const lu = /([\d.]+)%/.exec(filet.style.width)
  return lu ? Number(lu[1]) : null
}

/**
 * Les cellules d'une colonne, par son rang — et le nombre qu'elles portent.
 *
 * Le rang plutôt que le nom : l'en-tête porte son unité entre parenthèses
 * (« Eau (m³) »), et la chaîne dépend de la langue comme de l'unité.
 */
function colonne(rang: number) {
  const main = screen.getByRole('main')
  return within(main)
    .getAllByRole('row')
    .slice(1)
    .map((ligne) => {
      const cellules = within(ligne).getAllByRole('cell')
      return cellules[rang]
    })
    .filter((cellule): cellule is HTMLElement => Boolean(cellule))
}

/** Le premier nombre d'une cellule — la consommation, avant la plage d'index. */
function consommation(cellule: HTMLElement): number | null {
  const lu = /^\s*([\d  ,.]+)/.exec(cellule.textContent ?? '')
  if (!lu) return null
  const nombre = Number(lu[1].replace(/[  ,.]/g, ''))
  return Number.isFinite(nombre) ? nombre : null
}

/** Les couples (consommation, part du filet) d'une colonne, lignes muettes ôtées. */
function mesures(rang: number) {
  return colonne(rang)
    .map((cellule) => ({ valeur: consommation(cellule), part: partDuFilet(cellule) }))
    .filter((m): m is { valeur: number; part: number } => m.valeur !== null && m.part !== null)
}

/* L'eau puis l'électricité : unité, locataire, eau, électricité. */
const EAU = 2
const ELECTRICITE = 3

describe('les barres de consommation', () => {
  it('donne au plus gros relevé de la colonne toute la largeur', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()

    for (const rang of [EAU, ELECTRICITE]) {
      const relevees = mesures(rang)
      expect(relevees.length, 'aucune consommation n’est mesurée').toBeGreaterThan(2)

      const plusForte = relevees.reduce((a, b) => (b.valeur > a.valeur ? b : a))
      expect(plusForte.part, 'le plus gros relevé n’atteint pas le bout de sa cellule').toBe(100)
    }
  })

  it('range les filets dans l’ordre des nombres qu’ils qualifient', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()

    for (const rang of [EAU, ELECTRICITE]) {
      const relevees = mesures(rang)
      /* PAS UNE TOLÉRANCE, UNE COMPARAISON : deux à deux, un nombre plus grand
         ne peut pas porter un filet plus court. C'est tout ce qu'une échelle
         proportionnelle promet, et c'est exactement ce que l'œil y lit. */
      for (const a of relevees) {
        for (const b of relevees) {
          if (a.valeur > b.valeur) {
            expect(
              a.part,
              `${a.valeur} porte un filet plus court que ${b.valeur}`,
            ).toBeGreaterThanOrEqual(b.part)
          }
        }
      }
    }
  })

  it('recalcule l’échelle sur les seules lignes affichées', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const user = userEvent.setup()

    const avant = mesures(EAU)
    const groupe = within(screen.getByRole('main')).getByRole('group', { name: /relevé|reading/i })
    const saisis = within(groupe)
      .getAllByRole('button')
      .find((bouton) => /saisi|captured/i.test(bouton.textContent ?? ''))
    expect(saisis, 'la pastille des relevés saisis a disparu').toBeDefined()

    await user.click(saisis!)

    const apres = mesures(EAU)
    expect(apres.length, 'le filtre ne rend plus aucune consommation').toBeGreaterThan(0)
    /* LE MAXIMUM REMPLIT TOUJOURS SA CELLULE, quelle que soit la liste : c'est
       la propriété qu'une échelle figée sur le parc entier perdrait. */
    expect(apres.reduce((a, b) => (b.valeur > a.valeur ? b : a)).part).toBe(100)
    expect(avant.length, 'le lot de départ était déjà vide').toBeGreaterThan(0)
  })
})
