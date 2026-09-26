import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '@/test/render'
import { useState } from 'react'
import { MonthPicker } from './DatePicker'

/**
 * LES MOIS FERMÉS DISAIENT « FERMÉ », JAMAIS « JUSQU'OÙ ».
 *
 * ═══ DEUX DÉFAUTS AU MÊME ENDROIT ═══
 *
 * 1. LE RACCOURCI TRAVERSAIT LES BORNES. La grille respecte `min`/`max` —
 *    douze mois grisés et `disabled` — et « Mois courant », en pied de panneau,
 *    appelait `choisir` sans les consulter : le panneau montrait des mois
 *    interdits ET un bouton qui menait à l'un d'eux. La valeur partait au
 *    formulaire, et le refus n'arrivait qu'après.
 *
 * 2. LA FENÊTRE AUTORISÉE N'ÉTAIT ÉCRITE NULLE PART. `disabled`, une opacité de
 *    45 % et un curseur barré disent QUE c'est fermé ; aucun ne dit jusqu'où.
 *    Il fallait cliquer les chevrons d'année en année pour trouver l'ouverture,
 *    et un lecteur d'écran annonçait « indisponible » douze fois de suite sans
 *    jamais donner la borne.
 *
 * Ce n'est pas un cas de laboratoire : la démonstration resserre `min` et `max`
 * sur UN mois, celui du dernier relevé. C'est la borne la plus étroite que le
 * produit pose, et le raccourci passait au travers.
 */

/** Un sélecteur borné à un seul mois — la contrainte de la démonstration. */
function SelecteurBorne({ min, max }: { min?: string; max?: string }) {
  const [valeur, setValeur] = useState('')
  return (
    <>
      <label htmlFor="periode">Période</label>
      <MonthPicker id="periode" name="periode" value={valeur} onChange={setValeur} min={min} max={max} />
    </>
  )
}

async function ouvrirLePanneau(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Période'))
  return await screen.findByRole('dialog')
}

describe('la plage du sélecteur de mois', () => {
  it('ferme le raccourci « Mois courant » quand il est hors bornes', async () => {
    const user = userEvent.setup()
    /* UNE FENÊTRE ANCIENNE ET FERMÉE : le mois courant en est forcément
       dehors, quelle que soit la date à laquelle ce cas tourne. */
    renderWithProviders(<SelecteurBorne min="2020-01" max="2020-03" />)

    const panneau = await ouvrirLePanneau(user)
    const raccourci = within(panneau).getByRole('button', { name: /ce mois-ci|this month/i })

    expect(
      raccourci,
      'le panneau offre une porte vers un mois que sa grille refuse',
    ).toBeDisabled()
  })

  it('le laisse ouvert quand le mois courant est dans la fenêtre', async () => {
    /* LE CONTREPOIDS : borné, mais largement — le raccourci garde son sens, et
       le fermer par excès de zèle retirerait le geste le plus courant. */
    const user = userEvent.setup()
    renderWithProviders(<SelecteurBorne min="2020-01" max="2099-12" />)

    const panneau = await ouvrirLePanneau(user)
    expect(
      within(panneau).getByRole('button', { name: /ce mois-ci|this month/i }),
    ).toBeEnabled()
  })

  it('écrit la fenêtre autorisée, et la rattache au panneau', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SelecteurBorne min="2020-01" max="2020-03" />)

    const panneau = await ouvrirLePanneau(user)
    const decrit = panneau.getAttribute('aria-describedby')
    expect(decrit, 'la plage ne décrit pas le panneau').toBeTruthy()

    const phrase = document.getElementById(decrit!)?.textContent ?? ''
    expect(phrase, 'la fenêtre autorisée n’est écrite nulle part').toMatch(/2020/)
  })

  it('ne dit rien quand rien n’est borné', async () => {
    /* LA MOITIÉ QU'ON OUBLIE : l'immense majorité des champs de date de ce
       produit n'a pas de bornes, et le panneau ne doit pas gagner une ligne
       pour annoncer une fenêtre qui est le calendrier entier. */
    const user = userEvent.setup()
    renderWithProviders(<SelecteurBorne />)

    const panneau = await ouvrirLePanneau(user)
    expect(panneau.getAttribute('aria-describedby')).toBeNull()
  })
})
