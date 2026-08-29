import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * L'INDICATIF NE SE COUPE PAS DANS SA BOÎTE.
 *
 * ═══ CE QUE LE CHAMP MONTRAIT ═══
 *
 * « Congo-Brazzaville · +242 » dans un contrôle de 176 px : l'indicatif — la
 * seule partie qui SERT — était rogné hors du champ. Vu en capture, sur le
 * pays proposé par défaut à qui vient du Congo.
 *
 * Le libellé peut aller bien plus loin : trois noms de pays et une ellipse
 * quand plusieurs partagent un indicatif — « Canada, États-Unis, Anguilla… ·
 * +1 ». Aucune largeur fixe ne tiendra jamais cela. Élargir encore n'était pas
 * une réponse : c'est la même course, perdue plus tard.
 *
 * ═══ POURQUOI AUCUNE GARDE NE LE VOYAIT ═══
 *
 * Un texte coupé DANS sa boîte ne déborde de rien : la page ne défile pas, le
 * conteneur ne grandit pas, et le DOM porte la chaîne entière. Les règles de
 * débordement mesurent ce qui SORT. C'est l'angle mort que `mesure-ui`
 * documente sous le nom de rognage — et un `<input>` en lecture, dont la valeur
 * est coupée sans ellipse, y échappe aussi.
 *
 * ═══ CE QUE LE CAS TIENT ═══
 *
 * Fermé, le contrôle montre l'INDICATIF, qui est ce qu'on préfixe au numéro et
 * ce qui ne peut pas s'allonger. Ouvert, la liste nomme les pays — c'est là
 * qu'on choisit, et là que la place existe.
 */
describe('l’indicatif téléphonique', () => {
  async function allerALIdentite() {
    const utilisateur = userEvent.setup()
    await renderApp('/inscription')
    await utilisateur.click(await screen.findByRole('radio', { name: /Propriétaire/ }))
    await utilisateur.click(screen.getByRole('button', { name: /Continuer/ }))
    return utilisateur
  }

  it('tient dans son champ, fermé', async () => {
    await allerALIdentite()

    const champ = await screen.findByRole('combobox', { name: /Indicatif/i })
    /* La valeur affichée est l'indicatif SEUL : elle fait cinq caractères au
       plus, quel que soit le pays, donc elle ne peut pas se couper. */
    expect((champ as HTMLInputElement).value).toMatch(/^\+\d{1,4}$/)
  })

  /**
   * ET LA LISTE NOMME LES PAYS.
   *
   * Le contrepoids, et il est essentiel : raccourcir l'affichage fermé en
   * raccourcissant aussi les OPTIONS rendrait le choix impossible — deux cent
   * cinquante indicatifs nus ne se choisissent pas.
   */
  it('nomme les pays dans sa liste', async () => {
    const utilisateur = await allerALIdentite()

    const champ = await screen.findByRole('combobox', { name: /Indicatif/i })
    await utilisateur.click(champ)

    const options = await screen.findAllByRole('option')
    expect(
      options.some((o) => /Cameroun|Cameroon/.test(o.textContent ?? '')),
      'la liste ne nomme plus les pays',
    ).toBe(true)
  })
})
