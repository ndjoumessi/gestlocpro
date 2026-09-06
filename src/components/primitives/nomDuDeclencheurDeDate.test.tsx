import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { Field } from './Field'
import { DatePicker, MonthPicker } from './DatePicker'

/**
 * LE DÉCLENCHEUR DU CALENDRIER DIT LA DATE CHOISIE, PAS SEULEMENT SON LIBELLÉ.
 *
 * Dans un `Field`, le déclencheur est un `<button id>` nommé par le `<label>`.
 * Un bouton est un élément étiquetable : son nom accessible vient du label, et
 * la date visible dedans n'en fait pas partie. Un lecteur d'écran posé sur
 * « Date du versement » entendait « Date du versement, bouton » — sans savoir
 * si une date était choisie, ni laquelle. La valeur est désormais rattachée
 * par `aria-describedby`, comme l'indice et l'erreur le sont déjà.
 */

describe('le déclencheur de date dans un Field', () => {
  it('porte la date choisie dans sa description', () => {
    renderWithProviders(
      <Field label="Date du versement" hint="Quand l’argent a été reçu.">
        {(props) => (
          <DatePicker
            id={props.id}
            aria-describedby={props['aria-describedby']}
            name="d"
            value="2023-04-10"
            onChange={() => {}}
          />
        )}
      </Field>,
    )
    const bouton = screen.getByRole('button', { name: /Date du versement/ })
    expect(bouton).toHaveAccessibleDescription(/10\/04\/2023|10 avril 2023/)
    // L'indice du Field reste rattaché : la valeur s'ajoute, elle ne remplace pas.
    expect(bouton).toHaveAccessibleDescription(/reçu/)
  })

  it('même chose pour le mois', () => {
    renderWithProviders(
      <Field label="Période couverte">
        {(props) => (
          <MonthPicker
            id={props.id}
            aria-describedby={props['aria-describedby']}
            name="m"
            value="2023-04"
            onChange={() => {}}
          />
        )}
      </Field>,
    )
    expect(screen.getByRole('button', { name: /Période couverte/ })).toHaveAccessibleDescription(
      /04\/2023|avril 2023/i,
    )
  })
})
