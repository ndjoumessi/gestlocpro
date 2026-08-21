import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Modal } from './Modal'
import { Combobox } from './Combobox'
import { DatePicker, MonthPicker } from './DatePicker'

const OPTIONS = [
  { value: '+237', label: 'Cameroun · +237' },
  { value: '+33', label: 'France · +33' },
]

function ModaleAvecCombobox() {
  const [ouverte, setOuverte] = useState(true)
  const [valeur, setValeur] = useState('+33')
  return ouverte ? (
    <Modal open onClose={() => setOuverte(false)} title="Nouveau bail">
      <Combobox aria-label="Indicatif" options={OPTIONS} value={valeur} onChange={setValeur} />
    </Modal>
  ) : null
}

function ModaleAvecDate() {
  const [ouverte, setOuverte] = useState(true)
  const [valeur, setValeur] = useState('2023-04-10')
  return ouverte ? (
    <Modal open onClose={() => setOuverte(false)} title="Nouveau bail">
      <DatePicker aria-label="Début du bail" name="d" value={valeur} onChange={setValeur} />
    </Modal>
  ) : null
}

function ModaleAvecMois() {
  const [ouverte, setOuverte] = useState(true)
  const [valeur, setValeur] = useState('2023-04')
  return ouverte ? (
    <Modal open onClose={() => setOuverte(false)} title="Nouveau bail">
      <MonthPicker aria-label="Période couverte" name="m" value={valeur} onChange={setValeur} />
    </Modal>
  ) : null
}

const modale = () => screen.queryByRole('dialog', { name: 'Nouveau bail' })

describe('Échap dans une modale', () => {
  it('combobox : ferme la liste, pas la modale', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModaleAvecCombobox />)
    await user.click(screen.getByLabelText('Indicatif'))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(modale()).toBeInTheDocument()
  })

  it('calendrier : ferme le panneau, pas la modale', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModaleAvecDate />)
    await user.click(screen.getByRole('button', { name: /début du bail/i }))
    expect(screen.getByRole('dialog', { name: /calendrier/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: /calendrier/i })).not.toBeInTheDocument()
    expect(modale()).toBeInTheDocument()
  })

  it('sélecteur de mois : ferme le panneau, pas la modale', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModaleAvecMois />)
    await user.click(screen.getByRole('button', { name: /période couverte/i }))
    expect(screen.getByRole('dialog', { name: /mois/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: /mois/i })).not.toBeInTheDocument()
    expect(modale()).toBeInTheDocument()
  })
})
