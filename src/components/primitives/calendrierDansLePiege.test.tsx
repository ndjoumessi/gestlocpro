import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Modal } from './Modal'
import { Field } from './Field'
import { DatePicker } from './DatePicker'
import { Input } from './Input'

/**
 * LE CALENDRIER D'UNE MODALE RESTE ACCESSIBLE AU CLAVIER, TOUT ENTIER.
 *
 * Le panneau du calendrier vit sur `document.body` (portail), hors du
 * conteneur de la modale. Le piège de la modale, à chaque Tab, lisait
 * « le focus est dehors » et le ramenait au premier champ : depuis une cellule
 * de jour, Tab n'atteignait jamais « mois précédent », « Aujourd'hui » ni
 * « Effacer ». Cinq modales portent un calendrier, et aucune ne pouvait le
 * parcourir au clavier.
 *
 * `echapDansUneModale.test.tsx` garde l'Échap ; cette garde tient le Tab : un
 * portail dont le propriétaire vit dans la modale compte comme dedans, et le
 * cycle de Tab s'y referme.
 */

function ModaleAvecDate() {
  const [ouverte, setOuverte] = useState(true)
  const [valeur, setValeur] = useState('2023-04-10')
  const [note, setNote] = useState('')
  return ouverte ? (
    <Modal open onClose={() => setOuverte(false)} title="Nouveau bail">
      <Field label="Note">
        {(props) => <Input {...props} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <Field label="Début du bail">
        {(props) => (
          <DatePicker
            id={props.id}
            aria-describedby={props['aria-describedby']}
            name="d"
            value={valeur}
            onChange={setValeur}
          />
        )}
      </Field>
    </Modal>
  ) : null
}

describe('le calendrier dans une modale', () => {
  it('Tab parcourt le panneau et y reste', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModaleAvecDate />)
    await user.click(screen.getByRole('button', { name: /Début du bail/ }))
    const panneau = screen.getByRole('dialog', { name: 'Calendrier' })
    // On part de la cellule qui porte le curseur, comme un clavier y arriverait.
    const cellule = panneau.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')
    expect(cellule, 'la cellule du curseur').not.toBeNull()
    cellule!.focus()
    expect(panneau.contains(document.activeElement)).toBe(true)

    const visites = new Set<Element | null>()
    for (let i = 0; i < 10; i++) {
      await user.tab()
      expect(panneau.contains(document.activeElement), `Tab n° ${i + 1}`).toBe(true)
      visites.add(document.activeElement)
    }
    // Le tour complet passe par les commandes du panneau, pas seulement la grille.
    const noms = [...visites].map((el) => el?.getAttribute('aria-label') ?? el?.textContent ?? '')
    expect(noms.join(' | ')).toMatch(/Aujourd|Effacer/)
  })
})
