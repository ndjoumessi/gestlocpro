import { fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * `en.ts` est paresseux (voir I18nProvider.tsx). Ce dont ce fichier s'assure,
 * à deux moments qui se protègent chacun d'une façon DIFFÉRENTE :
 *
 *  - le PREMIER rendu, quand la langue stockée est déjà l'anglais : le
 *    sous-arbre porteur de texte ne se MONTE pas tant que le dictionnaire
 *    n'est pas résolu — ni avec le français, ni avec des chaînes vides (voir
 *    `montageDiffere.test.tsx` pour la garde sur les noms accessibles et le
 *    titre, que ce choix protège).
 *  - une BASCULE en cours de page, via `setLocale` : rien ne se démonte.
 *    `chargement.test.tsx` l'interdit pour une autre raison (rouvrir un état
 *    de chargement sur des données déjà valides est une régression), et la
 *    même contrainte vaut ici — démonter reproduirait le défaut de ce lot,
 *    juste déplacé de l'ouverture à la bascule. Le français reste donc
 *    affiché, intact, jusqu'à ce que l'anglais soit prêt à le remplacer d'un
 *    coup — jamais entre les deux.
 */
function Sonde() {
  const { setLocale, t } = useI18n()
  return (
    <div>
      <p data-testid="texte">{t('common.close')}</p>
      <button type="button" onClick={() => setLocale('en')}>
        basculer
      </button>
    </div>
  )
}

describe('premier rendu — la langue demandée, jamais une autre', () => {
  it("ne monte pas le sous-arbre — ni français ni texte vide — quand l'anglais est demandé dès le montage", async () => {
    renderWithProviders(<Sonde />, { locale: 'en' })

    // Lu IMMÉDIATEMENT après le rendu, avant tout flush de promesse : c'est
    // l'instant que les deux lots précédents remplissaient tour à tour de
    // français puis d'une chaîne vide. `chargerAnglais` rend toujours sa
    // promesse via `.then` — même déjà résolue, `.then` ne s'exécute jamais
    // dans la même tâche synchrone que `render()` — donc cet instant existe
    // à coup sûr et cette assertion l'observe vraiment.
    expect(screen.queryByTestId('texte')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('texte')).toHaveTextContent('Close'))
  })

  it('affiche le français immédiatement, sans la moindre attente, quand le français est demandé', () => {
    // PAS de `waitFor` ici, et c'est la preuve : si la langue impatiente
    // traversait un montage différé, cet élément manquerait au moment de
    // l'assertion et ce test — synchrone — rougirait.
    renderWithProviders(<Sonde />, { locale: 'fr' })
    expect(screen.getByTestId('texte')).toHaveTextContent('Fermer')
  })
})

describe('bascule de langue en cours de page', () => {
  it('garde le français affiché, intact, tant que l’anglais charge — puis bascule en un seul mouvement', async () => {
    renderWithProviders(<Sonde />, { locale: 'fr' })
    expect(screen.getByTestId('texte')).toHaveTextContent('Fermer')

    // `fireEvent`, PAS `userEvent` : `userEvent.click` enchaîne plusieurs
    // `await` internes (pointerdown, pointerup…), largement assez pour
    // qu'une promesse déjà résolue — `en.ts` a pu être chargé par un test
    // précédent du même fichier — ait le temps de poser son état avant que ce
    // test ne regarde. `fireEvent.click` est synchrone : l'assertion qui suit
    // observe l'instant qui suit IMMÉDIATEMENT le clic, avant tout flush de
    // promesse.
    fireEvent.click(screen.getByRole('button', { name: 'basculer' }))

    // Le clic vient de poser `demandee = 'en'` — mais `locale`, lui, n'a pas
    // bougé : le dictionnaire anglais n'a pas encore eu le temps d'arriver.
    // Le sous-arbre reste monté, avec le MÊME texte français qu'avant le
    // clic — ni démonté, ni vidé.
    expect(screen.getByTestId('texte')).toHaveTextContent('Fermer')

    await waitFor(() => expect(screen.getByTestId('texte')).toHaveTextContent('Close'))
  })
})
