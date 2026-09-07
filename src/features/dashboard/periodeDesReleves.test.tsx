import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * L'ÉCRAN DES RELEVÉS NOMMAIT DEUX PÉRIODES QU'IL NE PORTAIT PAS.
 *
 * Son sous-titre promet « la quittance du mois », sa note dit « pour la
 * période ». Aucune des deux n'était vraie : le serveur retenait « la dernière
 * période relevée » sans qu'on la lui demande — `?mois=` ne bornait QUE les
 * échéances — et le client jetait `periodStart` en construisant ses lignes.
 * L'écran ne savait donc même pas ce qu'il affichait.
 *
 * ═══ POURQUOI CE SÉLECTEUR-CI MARCHE EN DÉMONSTRATION ═══
 *
 * Celui du parc y est VERROUILLÉ, et son fichier dit pourquoi : changer le mois
 * du parc exige une relecture du serveur, qu'une démonstration sans compte ne
 * peut pas faire. Les index des relevés, eux, sont tous déjà côté client —
 * c'est la série que l'espace du locataire dessine. Ce qui se calcule sans
 * réseau se propose sans réseau, et c'est ce qui permet aux quinze portes, qui
 * ne mesurent que `/demo`, de voir ce sélecteur BASCULER.
 */

const lignes = () => within(screen.getByRole('main')).getAllByRole('row').length - 1

describe('la période des relevés', () => {
  it('nomme la période qu’elle affiche, et non le mois d’aujourd’hui', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()

    /* La démonstration relève AOÛT 2026 ; nous sommes en septembre. Un
       sélecteur qui afficherait le mois courant mentirait sur les dix lignes
       qu'il surplombe — une tournée peut avoir un mois de retard, et c'est
       précisément ce que cet écran doit pouvoir dire. */
    const champ = document.querySelector<HTMLInputElement>('main input[name="mois"]')
    expect(champ, 'aucun sélecteur de période').not.toBeNull()
    expect(champ!.value).toBe('2026-08')
  })

  it('ouvre sur la période que porte l’adresse, et la calcule sans réseau', async () => {
    await renderApp('/demo/releves?mois=2026-07')
    await attendreLeChargement()

    const champ = document.querySelector<HTMLInputElement>('main input[name="mois"]')
    expect(champ!.value).toBe('2026-07')
    expect(lignes(), 'juillet porte les mêmes dix logements').toBe(10)

    /* JUILLET EST ENTIÈREMENT RELEVÉ, là où août a deux trous : c'est la
       PREUVE que la période change la donnée et pas seulement le libellé. La
       barre de tri disparaît donc — un seul état présent n'offre aucun choix —
       et la note bascule sur sa branche « complet », qu'aucune porte n'avait
       jamais rendue. */
    expect(
      within(screen.getByRole('main')).queryByRole('group', { name: /relevé|reading/i }),
      'juillet ne porte qu’un seul état, la barre de tri n’a rien à offrir',
    ).toBeNull()
  })

  it('retombe sur la période du fournisseur quand l’adresse en demande une autre', async () => {
    /* Une adresse partagée vieillit, et `?mois=2030-01` rendrait dix lignes
       « Relevé manquant » — ce qui se lit comme un parc en panne plutôt que
       comme un mois qui n'existe pas. Même règle que les sept tris. */
    await renderApp('/demo/releves?mois=2030-01')
    await attendreLeChargement()

    const champ = document.querySelector<HTMLInputElement>('main input[name="mois"]')
    expect(champ!.value).toBe('2026-08')
  })

  it('dérive juillet de l’historique, sans lui inventer de seconde source', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER. L'index courant de juillet DOIT être l'index
      antérieur d'août : c'est la même série, lue deux fois. Écrire un second
      tableau pour juillet aurait laissé les deux diverger, et le tableau se
      serait mis à contredire la courbe du même produit.

      A1 en août : eau 342 → 358. En juillet : 324 → 342. Le cas cherche donc
      **324**, l'antérieur de juillet, qui n'apparaît NULLE PART dans la vue
      d'août — sans quoi il passerait au vert sur un écran qui ignore la
      période, `342` y figurant déjà comme antérieur. C'est la première
      rédaction que le témoin a reprise.
    */
    await renderApp('/demo/releves?mois=2026-07')
    await attendreLeChargement()

    const rangee = within(screen.getByRole('main'))
      .getAllByRole('row')
      .find((r) => r.querySelector('td span')?.textContent?.trim() === 'A1')
    expect(rangee, 'A1 doit figurer en juillet').toBeDefined()
    expect(rangee!.textContent).toContain('324')
    expect(rangee!.textContent).toContain('342')
  })
})
