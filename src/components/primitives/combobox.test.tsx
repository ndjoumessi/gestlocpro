import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { dialOptions } from '@/lib/countries'
import { Combobox, type OptionCombobox } from './Combobox'

/**
 * Un combobox refait à la main ce qu'un `<select>` natif donne gratuitement.
 *
 * C'est la raison pour laquelle on ne le sort qu'à contrecœur — et la raison
 * pour laquelle il faut l'éprouver au clavier. Un combobox à moitié fait sur un
 * champ OBLIGATOIRE bloque la création de compte à qui n'utilise pas la souris.
 */
const OPTIONS = [
  { value: '+237', label: 'Cameroun · +237', groupe: 'Zone franc CFA' },
  { value: '+221', label: 'Sénégal · +221', groupe: 'Zone franc CFA' },
  { value: '+33', label: 'France · +33', groupe: 'Autres pays' },
  { value: '+49', label: 'Allemagne · +49', groupe: 'Autres pays' },
]

/**
 * Le jeu RÉEL, celui du formulaire d'inscription.
 *
 * Deux cent quatre entrées après fusion des indicatifs partagés. On l'importe
 * plutôt que d'en fabriquer un équivalent : c'est cette liste-là qui se monte
 * au premier contact avec le produit, et une liste synthétique aurait garanti
 * que le test reste vrai pendant que le produit dérive.
 */
const MONDE: OptionCombobox[] = dialOptions('fr').map(({ dial, label, zone }) => ({
  value: dial,
  label,
  groupe: zone === 'cfa' ? 'Zone franc CFA' : 'Autres pays',
}))

function Champ({
  options = OPTIONS,
  initial = '+33',
}: {
  options?: OptionCombobox[]
  initial?: string
}) {
  const [valeur, setValeur] = useState(initial)
  return (
    <Combobox
      aria-label="Indicatif"
      autoComplete="tel-country-code"
      options={options}
      value={valeur}
      onChange={setValeur}
    />
  )
}

/** Ouvre la liste et rend le champ, pour ne pas répéter quatre lignes par test. */
async function ouvrir(user: ReturnType<typeof userEvent.setup>, champ: HTMLElement) {
  await user.click(champ)
  return screen.getAllByRole('option')
}

describe('combobox', () => {
  it('filtre à la frappe, sur le nom comme sur l’indicatif', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    await user.type(champ, 'cam')
    expect(screen.getByRole('option', { name: /Cameroun/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /France/ })).not.toBeInTheDocument()

    await user.clear(champ)
    // Le libellé porte le nom ET l'indicatif : chercher « 237 » doit marcher.
    await user.type(champ, '237')
    expect(screen.getByRole('option', { name: /Cameroun/ })).toBeInTheDocument()
  })

  it('se pilote entièrement au clavier', async () => {
    /**
     * Le test qui justifie ce composant.
     *
     * Flèches pour parcourir, Entrée pour choisir. Sans cela, un champ
     * obligatoire devient infranchissable sans souris — et l'on aurait remplacé
     * un `<select>` parfaitement accessible par une régression.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    // Le focus ouvre déjà la liste : la première flèche DÉPLACE, elle n'ouvre
    // pas. C'est le comportement attendu — arriver au clavier sur un champ
    // cherchable et ne rien voir obligerait à une frappe pour rien.
    await user.keyboard('{ArrowDown}{Enter}')
    // Deuxième option de la liste non filtrée : le Sénégal.
    expect(champ).toHaveValue('Sénégal · +221')
  })

  it('annonce l’option active aux technologies d’assistance', async () => {
    // `aria-activedescendant` est ce qui fait LIRE l'option parcourue : sans
    // lui, la navigation aux flèches est silencieuse.
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    await user.keyboard('{ArrowDown}')
    expect(champ.getAttribute('aria-expanded')).toBe('true')
    expect(champ.getAttribute('aria-activedescendant')).toBeTruthy()
  })

  it('referme sur Échap sans rien changer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    await user.type(champ, 'cam')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // Le choix d'origine est intact : chercher n'est pas choisir.
    expect(champ).toHaveValue('France · +33')
  })

  it('montre le choix courant plutôt qu’un champ vide', () => {
    renderWithProviders(<Champ />)
    // Un champ vide ferait croire qu'aucun choix n'est fait.
    expect(screen.getByRole('combobox', { name: 'Indicatif' })).toHaveValue('France · +33')
  })

  it('garde le jeton de remplissage automatique', () => {
    // Le jeton s'était déjà perdu une fois en passant du `<select>` au champ
    // cherchable. Il se reperdra à la prochaine réécriture si rien ne le tient.
    renderWithProviders(<Champ />)
    expect(
      screen.getByRole('combobox', { name: 'Indicatif' }).getAttribute('autocomplete'),
    ).toBe('tel-country-code')
  })
})

/**
 * Ce qui est MONTÉ, et non ce qui est connu.
 *
 * Deux cent quatre options rendues d'un coup à l'ouverture, sur le formulaire
 * d'inscription, sur un Android d'entrée de gamme : c'est le premier geste que
 * fait un bailleur de Douala avec le produit, et il l'attend. La liste se
 * filtre en trois frappes — monter la totalité pour la remplacer aussitôt est
 * un coût payé pour rien.
 *
 * Le bornage se paie de deux régressions, que ces tests tiennent : le choix
 * courant peut tomber hors de la fenêtre, et la navigation aux flèches peut
 * heurter un mur invisible dont `aria-activedescendant` ne revient pas.
 */
describe('combobox · fenêtre de rendu', () => {
  it('ne monte qu’une fenêtre d’options, pas la liste entière', async () => {
    const user = userEvent.setup()
    // Garde du garde : un jeu court ne prouverait rien d'un bornage à 50.
    expect(MONDE.length).toBeGreaterThan(150)

    renderWithProviders(<Champ options={MONDE} initial="+237" />)
    const options = await ouvrir(user, screen.getByRole('combobox', { name: 'Indicatif' }))

    expect(options).toHaveLength(50)
  })

  it('montre le choix courant même s’il est en fin de liste', async () => {
    /**
     * Le Zimbabwe est la deux-cent-quatrième entrée.
     *
     * Une fenêtre prise bêtement en tête ouvrirait, pour un bailleur de Harare,
     * une liste où son propre choix n'apparaît nulle part — le champ affiche
     * « Zimbabwe », la liste dit le contraire.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ options={MONDE} initial="+263" />)
    const options = await ouvrir(user, screen.getByRole('combobox', { name: 'Indicatif' }))

    expect(options).toHaveLength(50)
    expect(options[0]).toHaveTextContent('Zimbabwe')
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('borne la navigation au clavier sur ce qui est réellement rendu', async () => {
    /**
     * `aria-activedescendant` désigne un id du DOM.
     *
     * Si les flèches parcourent 204 entrées quand 50 sont montées, l'attribut
     * pointe un élément qui n'existe pas : le lecteur d'écran n'annonce plus
     * rien, et « Entrée » valide un pays que personne n'a vu passer. Ce serait
     * une régression pire que le coût qu'on cherche à éviter.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ options={MONDE} initial="+237" />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    await user.keyboard('{End}')
    // Une flèche de plus au-delà du bout : le bornage ne doit pas céder d'un cran.
    await user.keyboard('{ArrowDown}')

    const actif = champ.getAttribute('aria-activedescendant')
    expect(actif).toBeTruthy()
    const options = screen.getAllByRole('option')
    const dernier = options[options.length - 1]
    expect(document.getElementById(actif!)).toBe(dernier)

    const libelle = dernier?.textContent ?? ''
    await user.keyboard('{Enter}')
    // On ne choisit que ce qui a été montré.
    expect(champ).toHaveValue(libelle)
  })

  it('mène toujours au Cameroun en tapant « cam »', async () => {
    /**
     * Le choix courant remonte à l'ouverture — il ne doit pas pour autant
     * s'inviter dans un résultat qui ne le contient pas. Le Zimbabwe au milieu
     * des réponses à « cam » ferait douter du filtre entier.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ options={MONDE} initial="+263" />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    await user.type(champ, 'cam')

    expect(screen.getByRole('option', { name: /Cameroun/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Zimbabwe/ })).not.toBeInTheDocument()
  })

  it('trouve un pays situé bien au-delà de la fenêtre', async () => {
    /**
     * Le filtre porte sur TOUT, le plafond ne s'applique qu'après.
     *
     * Borner les options avant de filtrer serait la faute la plus coûteuse :
     * le champ répondrait « rien » pour un pays qui existe, et le bailleur en
     * conclurait que le produit ne le sert pas.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ options={MONDE} initial="+237" />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    await user.type(champ, 'zimb')

    expect(screen.getByRole('option', { name: /Zimbabwe/ })).toBeInTheDocument()
  })

  it('dit que la liste est raccourcie plutôt que de la couper en silence', async () => {
    // Une liste coupée sans un mot laisse croire que le pays n'existe pas.
    const user = userEvent.setup()
    renderWithProviders(<Champ options={MONDE} initial="+237" />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    expect(screen.getByText(/affinez votre recherche/i)).toBeInTheDocument()

    // Le mot est aussi rattaché au champ : sans écran, une liste qui s'arrête
    // au cinquantième élément ne dit rien d'elle-même.
    const decrit = champ.getAttribute('aria-describedby')?.split(' ') ?? []
    const mention = decrit.map((id) => document.getElementById(id)).find(Boolean)
    expect(mention).toHaveTextContent(/affinez votre recherche/i)
  })

  it('n’admet que des options sous la liste', async () => {
    /**
     * La structure, et pas seulement les rôles pris un à un.
     *
     * `listbox` n'accepte comme descendants signifiants que des `option`
     * (éventuellement regroupées). Un intermédiaire resté signifiant — un
     * `<li>` nu autour de l'option, l'intitulé de groupe, la mention de
     * troncature — casse la relation : le lecteur d'écran ne compte plus les
     * options et n'annonce plus « 2 sur 4 ».
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    const liste = screen.getByRole('listbox')

    for (const enfant of Array.from(liste.children)) {
      const role = enfant.getAttribute('role')
      expect(['option', 'presentation']).toContain(role)
    }

    // Et les options SONT ces enfants directs, pas des boîtes enfouies dedans.
    for (const option of screen.getAllByRole('option')) {
      expect(option.parentElement).toBe(liste)
    }
  })

  it('se tait quand la liste tient tout entière', async () => {
    // Quatre options : annoncer une troncature inexistante serait du bruit.
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    expect(screen.queryByText(/affinez votre recherche/i)).not.toBeInTheDocument()
    expect(champ.getAttribute('aria-describedby')).toBeNull()
  })
})
