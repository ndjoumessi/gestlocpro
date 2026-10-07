import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { enumerationDesLogements } from './Meters'

/**
 * UNE LIGNE QU'ON NE PEUT PAS NOMMER LE DIT.
 *
 * ═══ CE QUE LA PRODUCTION MONTRAIT, MESURÉ LE 2026-10-07 ═══
 *
 * `/demo/releves`, dix lignes, et les DEUX premières cellules de chacune à la
 * chaîne vide — unité et locataire. Un tableau dont aucune ligne ne peut être
 * nommée, sur l'écran dont le geste est « aller relever le compteur du logement
 * X ». Et la note d'alerte rendait littéralement :
 *
 *     « La facturation du mois restera incomplète tant qu'ils ne sont pas
 *       saisis. —  et »
 *
 * une énumération dont les deux termes sont des chaînes vides.
 *
 * ═══ LA DÉCISION ÉTAIT ÉCRITE, ET SA PRÉMISSE EST FAUSSE ═══
 *
 * `unitLabel` disait : « Aucun repli sur l'identifiant : une unité introuvable
 * laisse la cellule vide, ET LE MANQUE SE VOIT. » Le refus de l'uuid reste juste
 * — il est gardé. C'est la seconde moitié qui tombe : un vide se voit parmi des
 * noms, il ne se voit pas parmi des vides. Dix cellules vides se lisent comme
 * une colonne qui n'existe pas, pas comme dix manques.
 *
 * ═══ L'EXPORT DISAIT DÉJÀ LA VÉRITÉ ═══
 *
 * Le tableur du même écran écrit `?? t('app.portfolio.noTenant')` sur la même
 * donnée. Deux surfaces, une seule honnête — et c'est celle qu'on ne regarde
 * pas qui l'était.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * LA CAUSE. Pourquoi ces relevés désignent des logements absents de `units` ne
 * se décide pas depuis le client : `setReadings` et `setUnits` viennent de la
 * MÊME réponse, posées ensemble. C'est signalé à part, et ces cas gardent ce
 * que l'écran DIT, pas d'où vient son contenu.
 *
 * LA DÉMONSTRATION NE REPRODUIT PAS L'ÉTAT : tous ses relevés désignent des
 * unités connues. Les cas d'écran ci-dessous sont donc des TÉMOINS — ils
 * gardent contre une régression, pas contre le défaut de production — et la
 * logique, elle, est éprouvée directement.
 */
describe('ce qu’une note peut énumérer', () => {
  it('REND LES NOMS QU’ELLE A, quand elle les a tous', () => {
    expect(enumerationDesLogements(['A5', 'C2'])).toEqual({ nommes: ['A5', 'C2'], anonymes: 0 })
  })

  it('COMPTE CEUX QU’ELLE N’A PAS, au lieu de les énumérer à vide', () => {
    expect(enumerationDesLogements(['A5', '', 'C2', ''])).toEqual({
      nommes: ['A5', 'C2'],
      anonymes: 2,
    })
  })

  it('NE REND AUCUN NOM quand elle n’en a aucun — le cas de la production', () => {
    /* C'est l'état mesuré : deux relevés manquants, deux libellés vides, et une
       phrase qui se terminait par « — et ». */
    expect(enumerationDesLogements(['', ''])).toEqual({ nommes: [], anonymes: 2 })
  })

  it('TIENT L’ESPACE POUR DU VIDE : un libellé blanc ne nomme rien', () => {
    expect(enumerationDesLogements(['  ', 'B1'])).toEqual({ nommes: ['B1'], anonymes: 1 })
  })
})

describe('ce que la colonne d’identité montre', () => {
  it('NE LAISSE AUCUNE LIGNE SANS UNITÉ NI SANS LOCATAIRE', async () => {
    /*
      TÉMOIN, et il le dit : la démonstration ne porte que des relevés dont
      l'unité est connue, donc ce cas ne peut pas voir le défaut de production.
      Il garde la propriété qui, elle, vaut toujours — AUCUNE cellule
      d'identité n'est vide — et c'est elle qui rougirait si quelqu'un
      réintroduisait un repli silencieux.
    */
    await renderApp('/demo/releves', { largeur: 1280 })
    await attendreLeChargement()

    const table = document.querySelector('table')!
    const entetes = Array.from(table.querySelectorAll('thead th')).map((e) => e.textContent ?? '')
    const rangUnite = entetes.findIndex((e) => /^unité$/i.test(e.trim()))
    const rangLocataire = entetes.findIndex((e) => /^locataire$/i.test(e.trim()))
    expect(rangUnite, 'aucune colonne d’unité').toBeGreaterThanOrEqual(0)
    expect(rangLocataire, 'aucune colonne de locataire').toBeGreaterThanOrEqual(0)

    const lignes = Array.from(table.querySelectorAll('tbody tr')).filter(
      (tr) => tr.children.length > 1,
    )
    expect(lignes.length, 'aucun relevé à nommer').toBeGreaterThan(1)

    for (const tr of lignes) {
      expect(
        (tr.children[rangUnite]?.textContent ?? '').trim(),
        'une ligne ne nomme pas son logement',
      ).not.toBe('')
      expect(
        (tr.children[rangLocataire]?.textContent ?? '').trim(),
        'une ligne ne dit rien de son locataire — pas même qu’il n’y en a pas',
      ).not.toBe('')
    }
  })

  it('N’ÉNUMÈRE JAMAIS UNE SUITE DE RIEN DANS SA NOTE', async () => {
    await renderApp('/demo/releves', { largeur: 1280 })
    await attendreLeChargement()

    const main = within(screen.getByRole('main'))
    const note = main.getByText(/facturation du mois restera incomplète/i)
    const texte = (note.textContent ?? '').replace(/ /g, ' ')

    /* LA FORME EXACTE DU DÉFAUT : « saisis. —  et », deux termes vides joints
       par la conjonction. On refuse la conjonction suspendue plutôt qu'une
       liste particulière — les noms changent avec la démonstration, la
       grammaire non. */
    expect(texte, 'la note énumère des noms qui n’existent pas').not.toMatch(
      /—\s*(et|and)\s*$/i,
    )
    expect(texte, 'la note joint deux termes vides').not.toMatch(/—\s{2,}(et|and)\s/i)
  })
})
