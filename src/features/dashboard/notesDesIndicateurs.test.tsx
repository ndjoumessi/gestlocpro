import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * UNE NOTE D'INDICATEUR COMPTE CE QUE SON MONTANT TOTALISE.
 *
 * ═══ POURQUOI CE CAS EXISTE ═══
 *
 * « En retard · 412 000 FCFA » ne dit pas combien de baux le composent ni
 * depuis quand, et c'est la carte de l'écran qui porte la relance et la mise en
 * demeure : trois loyers oubliés hier et un impayé de deux mois y rendaient le
 * même nombre. La note le dit désormais.
 *
 * Le risque qu'elle apporte est celui de tout compte affiché à côté d'un autre :
 * la pastille « En retard » de la barre de tri compte les mêmes baux, trente
 * pixels plus bas. Deux comptes du même fait, calculés par deux chemins, sont
 * une contradiction en attente — et le dépôt l'a déjà payée une fois, sur le
 * tableau de bord : « Le compte porte sur TOUS les locataires qui doivent
 * encore quelque chose — partiels compris —, puisque c'est ce que totalise le
 * montant au-dessus. Il ne retenait que les retards : quatre locataires
 * devaient, la note en annonçait trois. »
 *
 * ═══ ET LA NOTE DES BAUX ACTIFS ═══
 *
 * « 1 397 000 FCFA » sans son compte ne se rapporte à rien : c'est un loyer
 * appelé SUR quelque chose. Le tableau de bord le dit depuis toujours de la
 * même carte ; cet écran-ci ne le disait pas.
 */

/** La carte d'indicateur dont l'intitulé correspond — son texte entier. */
function carte(intitule: RegExp): string {
  const main = screen.getByRole('main')
  const trouvee = within(main)
    .getAllByText(intitule)
    .map((noeud) => noeud.closest('[data-indicateur]'))
    .find((boite): boite is HTMLElement => boite !== null)
  expect(trouvee, `aucune carte intitulée ${intitule}`).toBeTruthy()
  return trouvee!.textContent ?? ''
}

/** Le compte porté par une pastille de tri — « En retard3 » rend 3. */
function comptePastille(nom: RegExp): number {
  const groupe = within(screen.getByRole('main')).getByRole('group', { name: /statut|status/i })
  const bouton = within(groupe)
    .getAllByRole('button')
    .find((b) => nom.test(b.textContent ?? ''))
  expect(bouton, `aucune pastille ${nom}`).toBeTruthy()
  const chiffres = /(\d+)\s*$/.exec(bouton!.textContent ?? '')
  expect(chiffres, 'la pastille ne porte pas de compte').not.toBeNull()
  return Number(chiffres![1])
}

describe('les notes des indicateurs d’encaissement', () => {
  it('compte les mêmes baux en retard que la pastille de tri', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const note = carte(/^En retard$/)
    const attendu = comptePastille(/en retard/i)
    expect(attendu, 'le jeu de démonstration n’a aucun retard à compter').toBeGreaterThan(0)
    expect(note, 'la note ne compte pas les baux que son montant totalise').toContain(
      `${attendu} locataire`,
    )
  })

  it('dit le plus grand retard, celui qui distingue la relance de la mise en demeure', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    /* LE PLUS GRAND RETARD DE LA GRILLE, lu sur les lignes elles-mêmes : la
       note l'annonce, et rien d'autre ne vérifierait qu'elle prend le maximum
       plutôt que le premier venu. */
    const jours = Array.from(
      (screen.getByRole('main').textContent ?? '').matchAll(/\+(\d+)\s*j/g),
      (trouve) => Number(trouve[1]),
    )
    expect(jours.length, 'aucune ligne ne porte de retard en jours').toBeGreaterThan(1)

    expect(carte(/^En retard$/)).toContain(`${Math.max(...jours)} jours`)
  })

  it('rapporte le loyer attendu au nombre de baux sur lesquels il est appelé', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const total = comptePastille(/^tous|^all/i)
    expect(carte(/^Loyers attendus$/), 'le montant ne se rapporte à rien').toContain(
      `${total} baux`,
    )
  })
})
