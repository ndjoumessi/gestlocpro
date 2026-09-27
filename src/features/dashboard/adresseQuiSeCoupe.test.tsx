import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * L'ADRESSE D'UN MEMBRE SE COUPAIT EN PLEIN DOMAINE.
 *
 * « arsene@example.co » puis « m » seul sur la ligne suivante, sur deux des
 * quatre membres de la démonstration. `overflow-wrap` n'autorise la coupe QUE
 * parce que le mot ne tient pas, et il coupe alors au dernier caractère qui
 * entre — au milieu du domaine de premier niveau.
 *
 * NI TRONCATURE NI TRAIT D'UNION, et les deux refus sont motivés sur place :
 * l'adresse IDENTIFIE le compte (c'est sur elle que le retrait de son propre
 * accès se refuse), donc « charles@exam… » ne vaut rien ; et `U+00AD` DESSINE un
 * tiret au point de coupe, ce qui fabriquerait une autre adresse — « exam-ple.com »
 * se recopie fausse.
 *
 * `<wbr>` ne rend aucun glyphe, coupure ou pas. Ces cas tiennent les DEUX
 * moitiés du contrat : des points de coupe existent, et l'adresse reste exacte.
 */

/** La fiche de membre qui porte ce nom. */
async function fiche(nom: RegExp) {
  await attendreLeChargement()
  const titre = await screen.findByText(nom)
  const carte = titre.closest('[data-fiche-membre]')
  if (!carte) throw new Error(`aucune fiche de membre pour ${nom}`)
  return carte as HTMLElement
}

describe('l’adresse d’un membre', () => {
  it('offre des points de coupe aux frontières de l’adresse', async () => {
    await renderApp('/demo/acces')
    const carte = await fiche(/Arsène Nkolo/)

    const ligne = within(carte).getByText(/arsene@example\.com/)
    /* APRÈS `@` ET APRÈS CHAQUE POINT — les seules frontières qu'une adresse
       possède. « arsene@example.com » en a donc deux. */
    expect(
      ligne.querySelectorAll('wbr').length,
      'aucun point de coupe : l’adresse se coupera au milieu d’un mot',
    ).toBe(2)
  })

  it('n’altère pas un seul caractère de l’adresse', async () => {
    await renderApp('/demo/acces')
    const carte = await fiche(/Arsène Nkolo/)

    /*
      LA MOITIÉ QUI COMPTE LE PLUS. Un remède qui insérerait un caractère —
      trait d'union conditionnel, espace de largeur nulle — passerait le cas
      ci-dessus et casserait la copie, la recherche du navigateur, et la
      comparaison que cet écran fait entre cette adresse et celle de la session
      pour refuser l'auto-retrait.

      `<wbr>` n'a pas de contenu : `textContent` traverse sans rien ramasser.
    */
    const ligne = within(carte).getByText(/arsene@example\.com/)
    expect(ligne.textContent, 'l’adresse affichée n’est plus l’adresse').toBe(
      'arsene@example.com',
    )
  })

  /*
    UN TROISIÈME CAS A ÉTÉ ÉCRIT PUIS RETIRÉ, et c'est plus utile que de le
    garder : il devait montrer que la fiche de la personne CONNECTÉE n'offre pas
    de retirer son propre accès — la comparaison d'adresses que le cas ci-dessus
    protège. La démonstration ne peut pas le montrer : personne n'y est connecté
    sous l'une de ces quatre adresses, donc les quatre fiches portent le bouton.

    Ce que j'avais écrit à la place passait toujours (`toBeGreaterThanOrEqual(0)`)
    et ne gardait rien. Un cas qui ne peut pas rougir n'est pas un cas ; le
    scénario demande une session dont l'adresse est celle d'un membre, ce qui est
    un montage de serveur, pas une ligne.
  */
})
