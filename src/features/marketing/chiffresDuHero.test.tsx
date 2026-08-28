import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { computeKpis } from '@/data/kpis'
import { READINGS, UNITS } from '@/data/portfolio'
import { formatMoney } from '@/currency/currencies'

/**
 * La vitrine dit ce que le produit dirait, sur le même jeu.
 *
 * La carte du hero portait quatre chiffres écrits à la main, hérités de la
 * constante `KPIS` que le dépôt a retirée de partout ailleurs. Ils démentaient
 * la démonstration à un clic de là — 1 040 000 encaissés contre 950 000,
 * 375 000 d'impayé contre 447 000, trois locataires débiteurs contre quatre —
 * et le commentaire du fichier promettait pourtant « les mêmes encaissements
 * que le tableau de bord », promesse tenue pour les seules barres.
 *
 * Deux familles de garde, parce qu'il y a deux façons de récidiver.
 *
 * La PREMIÈRE relit les sources : un montant réécrit à la main n'a pas besoin
 * d'être faux pour être un défaut, il suffit qu'il cesse de suivre la donnée.
 * Le seuil des trois chiffres laisse passer ce qui est de la mise en page — un
 * `slice(0, 4)`, une taille d'icône — et attrape ce qui est de l'argent.
 *
 * La SECONDE monte la page et compare le rendu au calcul. Elle seule verrait un
 * chiffre dérivé de la mauvaise donnée : `UNITS` filtré, un autre parc, une
 * somme prise sur les vacants. `InternationalSection` tient déjà ses trois
 * nombres de la longueur de ses tables ; c'est le même contrat, appliqué aux
 * montants.
 */

/**
 * Les sources de la vitrine, lues par Vite et non par `node:fs`.
 *
 * Ce fichier rend aussi des composants : il appartient donc au projet
 * TypeScript du navigateur, où `process` n'a pas cours — c'est ce qui range
 * les gardes de `design-system` dans le projet Node, et les prive du rendu.
 */
const SOURCES = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Les commentaires ont le droit de citer les chiffres qu'ils proscrivent. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function litterauxLongs(source: string): string[] {
  return [...sansCommentaires(source).matchAll(/\d{4,}/g)].map((trouve) => trouve[0])
}

describe('la vitrine n’écrit aucun chiffre à la main', () => {
  it('attrape le littéral qui vient d’être retiré, et pas le récit qui l’entoure', () => {
    // Le témoin est la ligne exacte d'avant le correctif : sans lui, une garde
    // qui ne trouve plus rien ne prouve pas qu'elle regarde encore.
    expect(litterauxLongs('  <p>{money(1040000, { compact: true })}</p>')).toEqual(['1040000'])
    expect(litterauxLongs('  // money(1040000) valait 1 040 000\n  <p>{money(x)}</p>')).toEqual([])
    expect(litterauxLongs('  {/* money(1040000) */}\n  <p>{money(x)}</p>')).toEqual([])
    // Ce qui relève de la mise en page passe : un `slice(0, 4)`, une taille.
    expect(litterauxLongs('<Icon size={14} />')).toEqual([])
  })

  /**
   * Une variation ne se démasque pas au rendu : « −8 pts » s'affiche aussi bien
   * qu'un chiffre juste. Ce qui la rend fausse est ailleurs — aucun champ de
   * `Kpis` ne porte d'écart mois à mois, faute d'historique — donc c'est
   * l'EMPLOI du composant qu'on interdit à la vitrine, tant que la donnée
   * n'existe pas. Le tableau de bord, lui, n'en a jamais affiché.
   */
  it('n’annonce aucune variation, que rien dans le produit ne saurait recalculer', () => {
    const fautifs = Object.entries(SOURCES)
      .filter(([chemin]) => !/\.test\.tsx$/.test(chemin))
      .filter(([, source]) => /DeltaBadge/.test(sansCommentaires(source)))
      .map(([chemin]) => chemin)

    expect(fautifs).toEqual([])
  })

  it('ne laisse aucun littéral de plus de trois chiffres dans les vues', () => {
    const fautifs: string[] = []
    for (const [chemin, source] of Object.entries(SOURCES)) {
      if (/\.test\.tsx$/.test(chemin)) continue
      for (const litteral of litterauxLongs(source)) fautifs.push(`${chemin} · ${litteral}`)
    }
    expect(fautifs).toEqual([])
  })
})

/**
 * `formatMoney` compose avec des espaces insécables — fine entre les tranches,
 * pleine devant le symbole. Le DOM interrogé par `getByText` est normalisé sur
 * l'espace ordinaire ; l'attendu doit l'être aussi, sans quoi la comparaison
 * échoue sur deux chaînes qui s'affichent à l'identique.
 */
const commeALEcran = (texte: string) => texte.replace(/\s+/g, ' ')

describe('les chiffres du hero sortent du même calcul que le produit', () => {
  const kpis = computeKpis(UNITS, READINGS)
  const doivent = UNITS.filter((u) => u.status === 'overdue' || u.status === 'partial')

  it('affiche l’encaissé et l’impayé que le calcul rend sur le jeu de démonstration', async () => {
    await renderApp('/')

    expect(
      screen.getByText(commeALEcran(formatMoney(kpis.collected, 'CFA', { compact: true }))),
    ).toBeInTheDocument()
    expect(
      screen.getByText(commeALEcran(formatMoney(kpis.outstanding, 'CFA', { compact: true }))),
    ).toBeInTheDocument()

    // Les deux valeurs de l'ancienne constante, qui ne se recoupaient avec rien.
    expect(
      screen.queryByText(commeALEcran(formatMoney(1040000, 'CFA', { compact: true }))),
    ).toBeNull()
    expect(
      screen.queryByText(commeALEcran(formatMoney(375000, 'CFA', { compact: true }))),
    ).toBeNull()
  })

  it('compte les locataires qui doivent, partiels compris', async () => {
    await renderApp('/')

    // Quatre doivent — trois retards et un règlement partiel — et le montant
    // au-dessus totalise les deux. La note en annonçait trois, exactement le
    // défaut que le tableau de bord déclare avoir corrigé chez lui.
    expect(doivent).toHaveLength(4)
    expect(screen.getByText(`${doivent.length} locataires`)).toBeInTheDocument()
    expect(screen.queryByText('3 locataires')).toBeNull()
  })

  it('tient le taux d’occupation de la donnée, et sa typographie de la langue', async () => {
    await renderApp('/')
    expect(screen.getByText(`${kpis.occupancy} %`)).toBeInTheDocument()
    expect(screen.getByText(`${kpis.occupied} / ${UNITS.length}`)).toBeInTheDocument()
  })

  it('écrit le pourcentage sans espace en anglais, où l’espace française passait telle quelle', async () => {
    await renderApp('/', { locale: 'en' })
    expect(screen.getByText(`${kpis.occupancy}%`)).toBeInTheDocument()
    expect(screen.queryByText(`${kpis.occupancy} %`)).toBeNull()
  })

  it('nomme le parc dont ces chiffres viennent', async () => {
    await renderApp('/')
    // La mention existait au dictionnaire et n'était rendue nulle part.
    expect(screen.getByText(/parc d’exemple de 12 unités/)).toBeInTheDocument()
  })
})
