import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '@/test/render'
import { DatePicker } from './DatePicker'

/**
 * Un sélecteur de date maison refait à la main ce que le champ natif donnait
 * gratuitement : la navigation, la validité, et surtout le clavier.
 *
 * C'est la raison de ne le sortir qu'à contrecœur, et la raison de l'éprouver.
 * Le champ natif était remplacé pour une question d'APPARENCE — le calendrier
 * du navigateur s'ouvrait dans ses propres couleurs au milieu du produit. Un
 * remplacement qui coûterait l'accès au clavier échangerait un défaut visible
 * contre un défaut invisible, ce qui est le mauvais côté du marché.
 */
function Champ({ initiale = '' }: { initiale?: string }) {
  const [valeur, setValeur] = useState(initiale)
  return (
    <>
      <DatePicker aria-label="Début du bail" name="d" value={valeur} onChange={setValeur} />
      {/* Ce que le formulaire enverrait : c'est la seule chose qui compte au
          bout, et elle doit rester `AAAA-MM-JJ` quelle que soit la langue. */}
      <p data-testid="valeur">{valeur}</p>
    </>
  )
}

const champ = () => screen.getByRole('button', { name: /début du bail/i })
const valeur = () => screen.getByTestId('valeur').textContent
const calendrier = () => screen.getByRole('dialog', { name: /calendrier/i })

/** Ouvre le calendrier et se pose sur un mois connu, pour ne pas dépendre du jour. */
async function ouvrirEn(user: ReturnType<typeof userEvent.setup>, annee: number, mois: number) {
  await user.click(champ())
  await user.selectOptions(within(calendrier()).getByLabelText(/^mois$/i), String(mois))
  await user.selectOptions(within(calendrier()).getByLabelText(/^ann/i), String(annee))
}

/** Le bouton d'un jour, retrouvé par son libellé en toutes lettres. */
function jour(nombre: number, nomMois: RegExp) {
  return within(calendrier())
    .getAllByRole('button')
    .find((b) => {
      const l = b.getAttribute('aria-label') ?? ''
      return nomMois.test(l) && new RegExp(`(^|\\D)${nombre}(\\D|$)`).test(l)
    })!
}

describe('sélecteur de date', () => {
  it('rend la valeur machine, jamais la date affichée', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)

    await ouvrirEn(user, 2023, 3)
    await user.click(jour(1, /avril/i))

    // `AAAA-MM-JJ` : c'est ce que le serveur lit. Le champ, lui, affiche la
    // date au format du pays — les deux ne doivent pas se confondre.
    expect(valeur()).toBe('2023-04-01')
    expect(champ()).toHaveTextContent('01/04/2023')
  })

  it('se parcourt aux flèches sans rien choisir tant qu’on ne valide pas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ initiale="2023-04-10" />)

    await user.click(champ())
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}')

    // Trois déplacements, aucune valeur émise : une grille qui choisirait à
    // chaque flèche enverrait dix dates au formulaire pour un seul geste.
    expect(valeur()).toBe('2023-04-10')

    await user.keyboard('{Enter}')
    // 10 + 2 jours + 1 semaine.
    expect(valeur()).toBe('2023-04-19')
  })

  it('change de mois à la page, sans sortir de la grille', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ initiale="2023-04-10" />)

    await user.click(champ())
    await user.keyboard('{PageDown}{Enter}')

    expect(valeur()).toBe('2023-05-10')
  })

  it('referme sur échappement et rend le focus au champ', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ initiale="2023-04-10" />)

    await user.click(champ())
    expect(screen.queryByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Sans le retour du focus, la tabulation repartirait du début du document.
    expect(champ()).toHaveFocus()
    // Et rien n'a été choisi : échapper n'est pas valider.
    expect(valeur()).toBe('2023-04-10')
  })

  it('efface, et n’offre pas de l’effacer quand il n’y a rien', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ initiale="2023-04-10" />)

    await user.click(champ())
    await user.click(within(calendrier()).getByRole('button', { name: /effacer/i }))
    expect(valeur()).toBe('')

    // Une cible tactile de 44px pour une action sans objet occupe la place
    // d'une action utile.
    await user.click(champ())
    expect(within(calendrier()).queryByRole('button', { name: /effacer/i })).not.toBeInTheDocument()
  })

  it('marque le jour choisi pour les technologies d’assistance', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ initiale="2023-04-10" />)
    await user.click(champ())

    const cellules = within(calendrier()).getAllByRole('gridcell')
    const selectionnees = cellules.filter((c) => c.getAttribute('aria-selected') === 'true')
    // Exactement une : la couleur seule ne dit rien à qui ne voit pas l'écran.
    expect(selectionnees).toHaveLength(1)
    expect(within(selectionnees[0]).getByRole('button')).toHaveAccessibleName(/10 avril 2023/i)
  })
})
