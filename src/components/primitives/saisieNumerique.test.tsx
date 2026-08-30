import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Input } from './Input'

/**
 * UN CHAMP NUMÉRIQUE NE PREND PAS DE LETTRES.
 *
 * ═══ LE DÉFAUT ═══
 *
 * Onze champs du produit portent `inputMode="numeric"`, `"decimal"` ou `"tel"`
 * — loyer, caution, devis, surface, nombre de pièces, index de compteur, prix
 * de refacturation, téléphone. `inputMode` ne change QUE le clavier tactile :
 * il ne filtre rien, et sur un clavier physique tout passe. Le champ acceptait
 * donc « 1o3 » sans broncher.
 *
 * LA MOITIÉ DANGEREUSE EST DÉJÀ FERMÉE AILLEURS : `parseMoney` gommait les
 * lettres et rendait 13 pour « 1o3 », c'est-à-dire un montant plausible que
 * rien ne signalait. Il refuse désormais. Ce fichier-ci ferme l'autre moitié —
 * la lettre n'arrive plus jusqu'au parseur, donc l'utilisateur n'a pas à lire
 * un message d'erreur pour une touche qui n'aurait jamais dû s'inscrire.
 *
 * ═══ POURQUOI DANS `Input` ET NON DANS UN COMPOSANT DE PLUS ═══
 *
 * Un `NumericInput` séparé serait un composant qu'il faut PENSER à employer, et
 * les onze champs existants sont précisément la preuve qu'on n'y pense pas. Le
 * filtre suit donc l'attribut que ces champs portent DÉJÀ : poser
 * `inputMode="numeric"` suffit, et un douzième champ écrit demain est correct
 * sans que personne ait rien à savoir.
 *
 * ═══ CE QUE LE FILTRE LAISSE PASSER, ET POURQUOI ═══
 *
 * Chiffres, espaces, virgule, point, signe — parce qu'un montant s'écrit
 * « 145 000 » ou « 900,50 » selon la langue, et que `parseMoney` sait lire les
 * deux. Pour `tel`, le plus et les parenthèses en plus : un indicatif s'écrit
 * « +237 ».
 *
 * ═══ CE QUE ÇA COÛTE, ET C'EST DIT ═══
 *
 * Coller « 145 000 FCFA » depuis l'écran est désormais REFUSÉ EN BLOC — le
 * champ ne bouge pas. `parseMoney` accepte pourtant cette chaîne, exprès, pour
 * qu'un montant affiché se resaisisse tel quel. On perd donc le collage du
 * symbole, on garde la frappe du nombre. Refuser en bloc plutôt que filtrer
 * caractère par caractère est délibéré : un collage à moitié absorbé laisserait
 * un nombre AUTRE dans le champ, ce qui est le défaut qu'on vient de fermer
 * dans le parseur, déplacé d'un cran.
 *
 * QUE PERSONNE NE CONTOURNE LA PRIMITIVE est gardé AILLEURS —
 * `src/design-system/saisieNumeriqueParLaPrimitive.test.ts`. Ce contrôle-là lit
 * des FICHIERS, et un test `.tsx` ne peut pas importer `node:fs` sous la
 * configuration de l'application : la porte l'a refusé, et c'est bien pour cela
 * que les gardes de source de ce dépôt vivent toutes dans `design-system/`.
 */
function ChampControle({ mode }: { mode: 'numeric' | 'decimal' | 'tel' }) {
  const [valeur, setValeur] = useState('')
  return (
    <Input
      aria-label="essai"
      inputMode={mode}
      value={valeur}
      onChange={(e) => setValeur(e.target.value)}
    />
  )
}

describe('un champ numérique refuse les lettres', () => {
  it('n’inscrit pas une lettre tapée entre deux chiffres', async () => {
    renderWithProviders(<ChampControle mode="numeric" />)
    const champ = screen.getByLabelText('essai')
    await userEvent.type(champ, '1o3')
    expect(champ).toHaveValue('13')
  })

  it('laisse passer ce qu’un montant contient vraiment', async () => {
    renderWithProviders(<ChampControle mode="numeric" />)
    const champ = screen.getByLabelText('essai')
    await userEvent.type(champ, '145 000')
    expect(champ).toHaveValue('145 000')
  })

  it('accepte la virgule décimale', async () => {
    renderWithProviders(<ChampControle mode="decimal" />)
    const champ = screen.getByLabelText('essai')
    await userEvent.type(champ, '900,50')
    expect(champ).toHaveValue('900,50')
  })

  it('accepte le plus d’un indicatif, sur un champ téléphonique', async () => {
    renderWithProviders(<ChampControle mode="tel" />)
    const champ = screen.getByLabelText('essai')
    await userEvent.type(champ, '+237 6 99')
    expect(champ).toHaveValue('+237 6 99')
  })

  it('ne touche pas un champ qui ne se déclare pas numérique', async () => {
    /* La contrepartie du choix ci-dessus : le filtre suit `inputMode`, donc un
       champ de texte ordinaire doit rester intact. Sans ce cas, élargir le
       filtre par mégarde à tous les champs passerait inaperçu. */
    renderWithProviders(<ChampControle mode={'text' as 'numeric'} />)
    const champ = screen.getByLabelText('essai')
    await userEvent.type(champ, 'Bonamoussadi')
    expect(champ).toHaveValue('Bonamoussadi')
  })
})
