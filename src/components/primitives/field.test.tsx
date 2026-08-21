import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { Field } from './Field'
import { Checkbox } from './Choice'
import { Input } from './Input'

/**
 * Le contrat des champs, tenu plutôt qu'affiché.
 *
 * `Field` porte en tête de fichier quatre règles qu'il s'engage à appliquer :
 * label visible associé, AIDE PERSISTANTE, erreur sous le champ, et annonce par
 * `role="alert"`. La deuxième n'était pas tenue — l'aide s'effaçait dès qu'une
 * erreur paraissait, c'est-à-dire au moment précis où elle sert.
 *
 * Et le champ continuait de la CITER : `aria-describedby` désignait un
 * identifiant absent du DOM. Selon qu'un lecteur d'écran abandonne la liste ou
 * la poursuit, l'utilisateur n'entendait ni l'aide, ni parfois l'erreur.
 *
 * Aucun test ne montait ce composant. C'est ce qui a permis à un commentaire
 * juste de cohabiter des mois avec un code qui le dément, dans le même fichier
 * et à quarante lignes d'écart.
 *
 * CE QUI EST VÉRIFIÉ ICI N'EST PAS LE TEXTE, mais le LIEN : que chaque
 * identifiant cité existe. Un test qui se contenterait de chercher les deux
 * paragraphes passerait alors même que le champ pointe dans le vide.
 */

/** Les identifiants cités par un champ, et ceux qui existent vraiment. */
function description(champ: HTMLElement) {
  const cites = (champ.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  return {
    cites,
    absents: cites.filter((id) => document.getElementById(id) === null),
  }
}

describe('le contrat d’un champ', () => {
  it('garde l’aide quand l’erreur paraît, et cite les deux', () => {
    renderWithProviders(
      <Field label="Montant" hint="Dû ce mois : 145 000" error="Montant illisible">
        {(props) => <Input {...props} name="amount" readOnly value="" />}
      </Field>,
    )

    // Les deux se lisent : l'aide dit ce qu'on attend, l'erreur ce qu'on a fait.
    expect(screen.getByText('Dû ce mois : 145 000')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Montant illisible')

    const { cites, absents } = description(screen.getByRole('textbox'))
    expect(cites).toHaveLength(2)
    // LE POINT DU CAS : citer un identifiant absent ne se voit pas à l'écran.
    expect(absents).toEqual([])
  })

  /**
   * Le cas positif, sans lequel le précédent ne garde rien : un champ qui
   * citerait TOUJOURS deux identifiants le satisferait aussi.
   */
  it('ne cite que l’aide quand il n’y a pas d’erreur', () => {
    renderWithProviders(
      <Field label="Téléphone" hint="Indicatif compris">
        {(props) => <Input {...props} name="phone" readOnly value="" />}
      </Field>,
    )

    const { cites, absents } = description(screen.getByRole('textbox'))
    expect(cites).toHaveLength(1)
    expect(absents).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rattache l’erreur d’une case à la case elle-même', () => {
    renderWithProviders(<Checkbox label="J’accepte les conditions" error="À accepter pour continuer" />)

    const alerte = screen.getByRole('alert')
    expect(alerte).toHaveTextContent('À accepter pour continuer')

    const { cites, absents } = description(screen.getByRole('checkbox'))
    // Le refus portait `role="alert"` sans identifiant : il était annoncé au
    // moment où il paraît, puis introuvable pour qui revient sur la case.
    expect(cites).toContain(alerte.id)
    expect(absents).toEqual([])
  })
})
