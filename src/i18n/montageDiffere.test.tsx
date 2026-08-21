import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useT } from '@/i18n/I18nProvider'

/**
 * GARDE de ce lot : une chaîne vide n'est pas une absence.
 *
 * Un lot précédent laissait `t()` rendre `''` pendant que le dictionnaire
 * paresseux chargeait, en gardant le sous-arbre monté. MESURÉ (voir
 * I18nProvider.tsx), ça posait trois défauts que `mesure-ui` ne voit jamais —
 * il mesure l'état stable, après résolution : jusqu'à 6 `aria-label`/`alt`
 * vides simultanés, 0,147 de CLS au moment où le texte arrive, et un titre
 * d'onglet réduit à « — ». Ce fichier garde les deux premiers ; `useDocumentTitle`
 * ci-dessous prouve le troisième par un mécanisme différent (aucun `getByRole`
 * ne peut interroger `document.title`).
 */

/** Tout `[aria-label=""]` ou `[alt=""]` sous `racine`, nommé pour le rapport. */
function nomsAccessiblesVides(racine: ParentNode): string[] {
  const trouvailles: string[] = []
  racine.querySelectorAll('[aria-label]').forEach((el) => {
    if (el.getAttribute('aria-label') === '') trouvailles.push(`${el.tagName.toLowerCase()}[aria-label=""]`)
  })
  racine.querySelectorAll('img[alt], [role="img"][alt]').forEach((el) => {
    if (el.getAttribute('alt') === '') trouvailles.push(`${el.tagName.toLowerCase()}[alt=""]`)
  })
  return trouvailles
}

describe('la garde détecte vraiment un nom accessible vide', () => {
  it('ne rend pas « aucun trouvé » par construction — sinon elle ne garde rien', () => {
    // GARDE DU GARDE : preuve que `nomsAccessiblesVides` INSPECTE, plutôt que
    // de rendre silencieusement un tableau vide quel que soit son entrée —
    // la panne que ce test empêcherait de voir s'il manquait. Éprouvé sur un
    // fixture délibérément fautif, indépendant de tout composant réel.
    const { container } = render(
      <div>
        <button type="button" aria-label="">
          x
        </button>
        <img alt="" src="x.png" />
        <button type="button" aria-label="Fermer">
          x
        </button>
      </div>,
    )
    const trouvailles = nomsAccessiblesVides(container)
    expect(trouvailles).toEqual(
      expect.arrayContaining(['button[aria-label=""]', 'img[alt=""]']),
    )
    expect(trouvailles).toHaveLength(2)
  })
})

describe("sous l'anglais, avant résolution : aucun nom accessible vide, aucun titre vide", () => {
  it("ne monte aucun élément à nom accessible vide pendant l'attente", async () => {
    renderWithProviders(<PublicHeader />, { locale: 'en' })

    // `PublicHeader` porte deux `aria-label={t('nav.primaryNav')}` (barre
    // large et menu mobile) et le sélecteur de langue en porte un troisième.
    // Lu IMMÉDIATEMENT après le rendu : si le sous-arbre était monté quand
    // même, ces trois-là seraient vides à cet instant précis.
    expect(nomsAccessiblesVides(document.body)).toEqual([])

    // Résolu ensuite : les MÊMES `aria-label` existent maintenant, avec une
    // vraie valeur — la garde ne passe pas parce que rien n'a de nom, mais
    // parce que rien n'est monté tant que la valeur n'est pas prête.
    await waitFor(() => expect(screen.getAllByLabelText('Main navigation')).not.toHaveLength(0))
    expect(nomsAccessiblesVides(document.body)).toEqual([])
  })

  it('ne pose pas de titre de document pendant l’attente — ni vide, ni tronqué en tiret nu', async () => {
    const SENTINELLE = 'SENTINELLE-TITRE-DE-TEST'

    function SondeTitre() {
      const t = useT()
      useDocumentTitle(`${t('brand.name')} — ${t('brand.tagline')}`, { withBrand: false })
      return <p data-testid="texte">{t('common.close')}</p>
    }

    document.title = SENTINELLE
    renderWithProviders(<SondeTitre />, { locale: 'en' })

    // Le sous-arbre qui porte `useDocumentTitle` n'est pas monté : son effet
    // n'a pas pu s'exécuter, donc le titre n'a pas bougé — ni vidé, ni réduit
    // au tiret nu que produisait `${''} — ${''}`.
    expect(document.title).toBe(SENTINELLE)

    await waitFor(() =>
      expect(document.title).toBe('GestLocPro — Rental management, held like an estate'),
    )
  })
})

describe('sous le français : aucune attente, aucun montage différé', () => {
  it('monte immédiatement, sans la moindre attente, avec des noms accessibles déjà remplis', () => {
    // PAS de `waitFor` : c'est la mutation-preuve que la langue impatiente ne
    // traverse jamais le montage différé de ce lot.
    renderWithProviders(<PublicHeader />, { locale: 'fr' })
    expect(screen.getAllByLabelText('Navigation principale').length).toBeGreaterThan(0)
    expect(nomsAccessiblesVides(document.body)).toEqual([])
  })
})
