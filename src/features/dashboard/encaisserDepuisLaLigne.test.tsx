import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'

/**
 * LA LIGNE EN RETARD PORTE LE GESTE QU'ELLE APPELLE.
 *
 * ═══ LE GESTE LE PLUS FRÉQUENT DE L'ÉCRAN VIVAIT EN HAUT DE PAGE ═══
 *
 * « Suivi des paiements par période » existe pour une raison : descendre la
 * colonne des retards et les solder un par un. Ses lignes offraient « Mettre en
 * demeure » — le geste le plus LOURD du produit — et « Quittance » — celui qui
 * atteste ce qui est déjà payé. Encaisser, le geste ordinaire, vivait dans un
 * bouton d'en-tête où il fallait rechoisir le logement dans une liste de douze.
 *
 * Trois retardataires, trois allers-retours, et à chaque fois la même recherche
 * du nom qu'on venait de lire.
 *
 * ═══ POURQUOI SEULEMENT SUR CE QUI EST DÛ ═══
 *
 * Un locataire à jour n'a rien à encaisser, et lui offrir le geste ferait de
 * cette colonne une rangée de boutons identiques où l'œil ne trouve plus les
 * trois qui comptent. C'est la même règle que « Mettre en demeure », qui ne
 * paraît que sur un retard — et le troisième cas la tient.
 */

async function ouvrirLesPaiements() {
  await renderApp('/demo/paiements')
  await attendreLeChargement()
}

/** La rangée dont l'en-tête de ligne porte ce numéro. */
function rangee(label: string): HTMLElement {
  const main = screen.getByRole('main')
  const trouvees = within(main)
    .getAllByRole('row')
    .filter((l) => (l.textContent ?? '').trimStart().startsWith(label))
  if (trouvees.length !== 1) throw new Error(`${trouvees.length} rangée(s) pour ${label}`)
  return trouvees[0]!
}

/** Les noms accessibles des commandes d'une rangée. */
function gestes(label: string): string[] {
  return within(rangee(label))
    .queryAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
}

describe('encaisser depuis la ligne', () => {
  it('offre le geste sur un logement en retard', async () => {
    await ouvrirLesPaiements()
    /* A3 — Serge Mbarga, 24 jours de retard, le seul cas franc du jeu. */
    expect(
      gestes('A3').join(' | '),
      'la ligne en retard n’offre que la mise en demeure et la quittance : encaisser demande de remonter en tête d’écran et d’y rechoisir le logement',
    ).toMatch(/encaisser/i)
  })

  it('ouvre la saisie SUR CE LOGEMENT', async () => {
    const user = userEvent.setup()
    await ouvrirLesPaiements()
    const bouton = within(rangee('A3'))
      .getAllByRole('button')
      .find((b) => /encaisser/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))
    expect(bouton, 'aucun geste d’encaissement à activer').toBeDefined()
    await user.click(bouton!)

    const modale = await screen.findByRole('dialog')
    /*
      LA VALEUR AFFICHÉE, et non un champ caché : ce `Combobox`-ci ne porte pas
      de `name` — contrairement à celui des relevés —, donc rien n'est masqué
      dans le formulaire. Ce qu'on lit est exactement ce que l'utilisateur lit.
    */
    expect(
      within(modale).queryByDisplayValue(/A3/),
      'la modale s’ouvre sur le premier logement de la liste, pas sur celui qu’on a désigné',
    ).not.toBeNull()
  })

  it('ne l’offre pas à un locataire à jour', async () => {
    /*
      LA GARDE DU GARDE. Sans elle, un bouton inconditionnel passerait les deux
      cas précédents — et la colonne deviendrait une rangée de dix commandes
      identiques où l'œil ne trouve plus les trois qui comptent.
    */
    await ouvrirLesPaiements()
    expect(
      gestes('A2').join(' | '),
      'un locataire à jour se voit proposer d’encaisser : il n’y a rien à recevoir',
    ).not.toMatch(/encaisser/i)
  })
})
