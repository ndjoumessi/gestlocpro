import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '@/test/render'
import { Modal } from './Modal'
import { Button } from './Button'

/**
 * DEUX MODALES L'UNE SUR L'AUTRE, ET LE CLAVIER NE PARLE QU'À CELLE DU DESSUS.
 *
 * La quittance ouvre une confirmation par-dessus elle (`ReceiptModal`), et
 * c'est voulu : annuler doit rendre la quittance telle qu'on l'avait. Mais les
 * deux pièges de focus écoutaient `document` : Échap dans la confirmation
 * fermait AUSSI la quittance — `stopPropagation` n'arrête pas un écouteur frère
 * sur le même nœud —, et Tab dans la confirmation était d'abord tiré vers le
 * premier champ de la quittance, puis ramené. Et `Modal` posait à ses deux
 * titres le même identifiant, `modal-title` : la confirmation portait le nom
 * de la quittance.
 *
 * `clavierDesModales.test.tsx` joue vingt-six modales, une à la fois. Aucune
 * n'était jouée par-dessus une autre : c'est ce que cette garde ajoute.
 */

function DeuxModales() {
  const [quittance, setQuittance] = useState(true)
  const [confirmation, setConfirmation] = useState(false)
  if (!quittance) return <p>quittance fermée</p>
  return (
    <>
      <Modal
        open
        onClose={() => setQuittance(false)}
        title="Quittance de septembre"
        footer={<Button onClick={() => setConfirmation(true)}>Retirer</Button>}
      >
        <p>Loyer 145 000 FCFA</p>
      </Modal>
      {confirmation && (
        <Modal
          open
          onClose={() => setConfirmation(false)}
          role="alertdialog"
          size="sm"
          title="Retirer la ligne ?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmation(false)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => setConfirmation(false)}>
                Retirer
              </Button>
            </>
          }
        >
          <p>Le versement sera retiré.</p>
        </Modal>
      )}
    </>
  )
}

async function ouvrirLesDeux() {
  const user = userEvent.setup()
  renderWithProviders(<DeuxModales />)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer' }))
  return user
}

describe('deux modales imbriquées', () => {
  it('chacune porte son propre titre pour nom', async () => {
    await ouvrirLesDeux()
    expect(screen.getByRole('dialog', { name: 'Quittance de septembre' })).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Retirer la ligne ?' })).toBeInTheDocument()
  })

  it('Échap ne ferme que celle du dessus', async () => {
    const user = await ouvrirLesDeux()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Quittance de septembre' })).toBeInTheDocument()
  })

  it('Tab tourne dans celle du dessus, jamais dans celle du dessous', async () => {
    const user = await ouvrirLesDeux()
    const confirmation = screen.getByRole('alertdialog')
    /*
      DEUX CHOSES, et la seconde est celle qui rougissait sur le code d'avant :
      le focus reste dans la confirmation, ET il AVANCE. Avec les deux pièges
      sur `document`, celui du dessous tirait le focus vers la quittance, puis
      celui du dessus le ramenait à son premier bouton — à chaque Tab. Le focus
      « restait dedans » et n'allait nulle part.
    */
    const visites = new Set<Element | null>()
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(confirmation.contains(document.activeElement), `Tab n° ${i + 1}`).toBe(true)
      visites.add(document.activeElement)
    }
    expect(visites.size, 'Tab doit parcourir fermer, Annuler et Retirer').toBeGreaterThanOrEqual(3)
    await user.tab({ shift: true })
    expect(confirmation.contains(document.activeElement)).toBe(true)
  })
})
