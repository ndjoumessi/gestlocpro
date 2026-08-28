import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { statutDuTarif } from './TariffsModal'

/**
 * L'HISTORIQUE DES PRIX DOIT DIRE LEQUEL S'APPLIQUE.
 *
 * ═══ CE QUE LA MODALE ANNONÇAIT SANS LE MONTRER ═══
 *
 * Sa propre description dit : « un prix ne vaut pas pour le passé : les relevés
 * antérieurs gardent celui qui ÉTAIT EN VIGUEUR ». La notion est donc posée en
 * toutes lettres — et l'historique la taisait. Une liste plate de « eau · date ·
 * montant » ne dit pas lequel de ces prix s'applique AUJOURD'HUI, alors que
 * c'est la seule question qu'on se pose avant d'en poser un nouveau.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Qu'un prix, et un seul PAR FLUIDE, soit marqué en vigueur. Le pluriel est le
 * piège : deux prix d'eau marqués ensemble, ou le prix d'électricité marqué
 * parce qu'il est le plus récent tous fluides confondus, sont deux façons de se
 * tromper qu'une capture d'écran ne distingue pas.
 *
 * ═══ POURQUOI LA RÈGLE EST ÉPROUVÉE HORS DE L'ÉCRAN ═══
 *
 * La démonstration ne porte que DEUX prix — un par fluide, à la même date. Deux
 * mutations franches passaient au vert contre l'écran : « tous en vigueur » y
 * est indistinguable du juste, et « le plus récent tous fluides confondus »
 * laisse simplement un fluide sans marque, ce qu'un compte par fluide ne voit
 * pas s'il ne compte que les fluides déjà marqués.
 *
 * On ne fabrique pas un jeu de données pour faire passer un test. La RÈGLE est
 * donc éprouvée sur des cas construits — c'est là qu'elle vit — et l'écran garde
 * le sien : que la marque paraisse.
 */

async function ouvrirLesPrix(utilisateur: ReturnType<typeof userEvent.setup>) {
  await renderApp('/demo/releves')
  await utilisateur.click(
    await screen.findByRole('button', { name: /prix de refacturation/i }),
  )
  return await screen.findByRole('dialog')
}

describe('l’historique des prix', () => {
  it('marque un prix en vigueur, et un seul par fluide', async () => {
    const utilisateur = userEvent.setup()
    const modale = await ouvrirLesPrix(utilisateur)

    const lignes = Array.from(modale.querySelectorAll('li'))
    expect(lignes.length, 'aucun prix posé dans la démonstration').toBeGreaterThan(0)

    const enVigueur = lignes.filter((l) => /en vigueur/i.test(l.textContent ?? ''))
    expect(enVigueur.length, 'aucun prix n’est marqué en vigueur').toBeGreaterThan(0)

    /* UN SEUL PAR FLUIDE. Le compte global ne suffirait pas : deux marques
       pourraient tomber sur le même fluide et le laisser croire correct. */
    const parFluide = new Map<string, number>()
    for (const ligne of enVigueur) {
      const texte = ligne.textContent ?? ''
      const fluide = /eau/i.test(texte) ? 'eau' : 'electricite'
      parFluide.set(fluide, (parFluide.get(fluide) ?? 0) + 1)
    }
    for (const [fluide, compte] of parFluide) {
      expect(compte, `${fluide} porte ${compte} prix en vigueur`).toBe(1)
    }
  })

  it('n’ouvre plus le calendrier du navigateur', async () => {
    const utilisateur = userEvent.setup()
    const modale = await ouvrirLesPrix(utilisateur)

    /* Le champ de date existe toujours — c'est le SÉLECTEUR qui change. Un test
       qui vérifierait seulement l'absence du champ passerait au vert si on le
       retirait tout à fait. */
    const champ = within(modale).getByLabelText(/à partir du|effective/i)
    expect(champ, 'le champ de date a disparu').toBeInTheDocument()
    expect(champ).not.toHaveAttribute('type', 'date')
  })
})

/** Trois prix d'eau et deux d'électricité, dont un daté du futur. */
const PRIX = [
  { id: 'eau-vieux', utility: 'water' as const, unitPriceMinor: 400, effectiveFrom: '2024-01-01' },
  { id: 'eau-actuel', utility: 'water' as const, unitPriceMinor: 520, effectiveFrom: '2025-06-01' },
  { id: 'eau-futur', utility: 'water' as const, unitPriceMinor: 600, effectiveFrom: '2099-01-01' },
  { id: 'elec-vieux', utility: 'power' as const, unitPriceMinor: 80, effectiveFrom: '2023-01-01' },
  { id: 'elec-actuel', utility: 'power' as const, unitPriceMinor: 99, effectiveFrom: '2024-03-01' },
]

describe('la règle du prix en vigueur', () => {
  const statut = (id: string) => statutDuTarif(PRIX.find((p) => p.id === id)!, PRIX)

  it('retient le plus récent DÉJÀ pris effet, fluide par fluide', () => {
    expect(statut('eau-actuel')).toBe('vigueur')
    expect(statut('elec-actuel')).toBe('vigueur')
    /* Le point qui compte : l'eau a un prix PLUS RÉCENT que celui de
       l'électricité, et cela ne retire rien à l'électricité. Un tri global
       marquerait l'eau seule et laisserait l'autre fluide sans prix courant. */
    expect(statut('elec-vieux')).toBe('passe')
    expect(statut('eau-vieux')).toBe('passe')
  })

  it('distingue un prix déjà posé qui n’a pas encore pris effet', () => {
    /* Sans cela on croirait avoir changé un tarif qui ne bougera que plus tard,
       et le prix RÉELLEMENT appliqué passerait pour périmé. */
    expect(statut('eau-futur')).toBe('aVenir')
    expect(statut('eau-actuel'), 'le prix à venir a volé la vigueur').toBe('vigueur')
  })

  it('marque exactement un prix par fluide', () => {
    const enVigueur = PRIX.filter((p) => statutDuTarif(p, PRIX) === 'vigueur')
    expect(enVigueur.map((p) => p.utility).sort()).toEqual(['power', 'water'])
  })
})
