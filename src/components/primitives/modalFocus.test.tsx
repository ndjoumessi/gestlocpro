import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Modal } from './Modal'

/**
 * Une modale ne doit pas voler le focus à chaque frappe.
 *
 * L'effet d'ouverture du `Modal` — masquer le défilement, placer le focus,
 * le rendre au nettoyage — avait `onClose` dans ses dépendances. Un appelant
 * qui passe une fonction écrite EN LIGNE en recrée l'identité à chaque rendu :
 * l'effet se rejouait donc à chaque rendu, et son nettoyage rendait le focus au
 * bouton d'ouverture.
 *
 * Conséquence, coûteuse à diagnostiquer : un champ CONTRÔLÉ n'acceptait qu'un
 * seul caractère. La première frappe changeait l'état, le rendu recréait
 * `onClose`, le focus repartait. Un champ non contrôlé, lui, ne déclenchait
 * aucun rendu et fonctionnait parfaitement — c'est ce contraste qui a fini par
 * désigner le coupable.
 *
 * Une modale du produit y échappait par chance, son `onClose` venant d'un
 * parent qui ne se rend pas pendant la saisie. Corriger l'appelant n'aurait
 * donc protégé que lui.
 */
function ModaleAvecChampControle() {
  const [valeur, setValeur] = useState('')
  const [ouverte, setOuverte] = useState(false)
  /**
   * La modale s'ouvre par un CLIC, et non montée déjà ouverte.
   *
   * C'est indispensable pour reproduire : le `Modal` retient l'élément actif au
   * moment de l'ouverture pour lui rendre le focus ensuite. Sans bouton
   * déclencheur, il ne retient rien, le nettoyage ne rend le focus à personne,
   * et le défaut reste invisible. Une première version de ce test passait sans
   * la correction — donc ne gardait rien.
   */
  return (
    <>
    <button type="button" onClick={() => setOuverte(true)}>
      ouvrir
    </button>
    {ouverte && (
    <Modal
      open={ouverte}
      // Écrite EN LIGNE, délibérément : c'est le cas qui échouait, et c'est la
      // façon la plus naturelle d'appeler ce composant.
      onClose={() => setOuverte(false)}
      title="Titre"
      footer={<span />}
    >
      <input aria-label="champ contrôlé" value={valeur} onChange={(e) => setValeur(e.target.value)} />
    </Modal>
    )}
    </>
  )
}

/** Une confirmation : un titre, une phrase, deux boutons. Aucun champ. */
function ModaleSansChamp() {
  return (
    <Modal open title="Retirer cet accès ?" onClose={() => undefined} role="alertdialog">
      <p>Cette personne perdra l’accès au parc.</p>
    </Modal>
  )
}

describe('focus dans une modale', () => {
  /**
   * LE REPLI ANNONCÉ N'AVAIT JAMAIS ÉTÉ ÉCRIT.
   *
   * Le commentaire du composant disait « le premier champ, à défaut le
   * CONTENEUR : jamais le bouton fermer », et le code retombait sur le premier
   * focalisable — c'est-à-dire la croix. Dans toute modale sans champ, et les
   * confirmations n'en ont aucun, le focus se posait donc sur le geste
   * d'abandon : on ouvre « Retirer cet accès ? » et le doigt du clavier est
   * déjà sur « Fermer ».
   *
   * Aucun test ne montait une modale sans champ. C'est ce qui a laissé le
   * commentaire et le code diverger.
   */
  it('pose le focus sur le dialogue, jamais sur le bouton fermer', async () => {
    renderWithProviders(<ModaleSansChamp />)

    const dialogue = await screen.findByRole('alertdialog')
    await new Promise((r) => setTimeout(r, 0))

    expect(dialogue).toHaveFocus()
    // Les DEUX « Fermer » — le voile et la croix — et non l'un des deux : le
    // repli fautif prenait le premier focalisable, et lequel des deux vient en
    // premier dans l'arbre n'est pas une garantie qu'on veuille dépendre.
    for (const bouton of screen.getAllByRole('button', { name: /fermer/i })) {
      expect(bouton).not.toHaveFocus()
    }
  })

  it('laisse un champ contrôlé recevoir plus d’un caractère', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModaleAvecChampControle />)
    await user.click(screen.getByRole('button', { name: 'ouvrir' }))

    await user.type(screen.getByLabelText('champ contrôlé'), 'Résidence Makepe')

    expect((screen.getByLabelText('champ contrôlé') as HTMLInputElement).value).toBe(
      'Résidence Makepe',
    )
  })
})
