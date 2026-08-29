import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { captureDownloads } from '@/test/downloads'

/**
 * UNE CAUTION RESTITUÉE N'EST PLUS À RESTITUER.
 *
 * ═══ CE QUE L'ÉCRAN AFFIRMAIT ═══
 *
 * Sur la ligne de C3 : la pastille disait « Restituée », et la colonne d'à côté
 * « À restituer 250 000 FCFA ». La même ligne se contredisait à trois
 * centimètres d'écart.
 *
 * Et le total en haut les additionnait : « À RESTITUER · 1 063 000 FCFA », avec
 * en note « 1 déjà restituée ». L'écran SAVAIT — il compte les restitutions
 * pour écrire cette note — et les faisait quand même entrer dans le montant que
 * le bailleur se déclare devoir.
 *
 * ═══ POURQUOI C'EST GRAVE, ET PAS SEULEMENT FAUX ═══
 *
 * Une caution n'est pas de l'argent au bailleur : c'est celui du locataire,
 * détenu pour lui. Le total « à restituer » est donc une DETTE, et une dette
 * qu'on surestime de tout l'historique n'est pas une approximation — c'est un
 * chiffre qui grandit à chaque départ et ne redescend jamais. Sur un parc qui
 * tourne cinq ans, il n'aura plus aucun rapport avec ce qui est dû.
 *
 * `held − withheld` était juste tant qu'aucune caution n'était rendue. Le
 * troisième statut existe depuis l'origine ; la formule ne l'a jamais lu.
 */

/** Les montants du jeu de démonstration : C3 est la caution restituée. */
const RESTITUEE = 250_000
const CONSIGNE_TOTAL = 1_226_000
const RETENU_TOTAL = 163_000

describe('les cautions rendues', () => {
  it('ne comptent plus dans ce qu’il reste à restituer', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* Le total est la DETTE : ce qui est encore détenu, moins ce qui est retenu.
       Les 250 000 déjà rendus n'y sont plus. */
    const attendu = CONSIGNE_TOTAL - RESTITUEE - RETENU_TOTAL
    const principal = (screen.getByRole('main').textContent ?? '').replace(/[\s ]/g, ' ')

    expect(principal, 'le total inclut une caution déjà rendue').toContain(
      attendu.toLocaleString('fr-FR').replace(/[\s ]/g, ' '),
    )
    expect(principal, 'le total d’avant est encore là').not.toContain('1 063 000')
  })

  /**
   * ET LA LIGNE NE SE CONTREDIT PLUS.
   *
   * Le total pouvait être corrigé en laissant chaque ligne mentir : c'est la
   * moitié qu'on oublie, parce qu'elle ne se voit qu'en descendant le tableau.
   */
  it('n’annoncent plus un solde sur leur propre ligne', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const ligne = screen
      .getAllByRole('row')
      .find((r) => /Restituée|Returned/.test(r.textContent ?? ''))
    expect(ligne, 'aucune caution restituée dans le jeu de démonstration').toBeDefined()

    /* LE MONTANT APPARAISSAIT DEUX FOIS sur la même ligne : en « Consigné », ce
       qui est juste — la caution valait bien 250 000 —, et en « À restituer »,
       ce qui contredisait la pastille d'à côté. La colonne du solde reste,
       muette : une case vide se lirait comme une donnée manquante. */
    const occurrences = (ligne!.textContent ?? '')
      .replace(/[\s ]/g, ' ')
      .match(/250 000/g)
    expect(occurrences, 'le montant rendu est annoncé comme encore dû').toHaveLength(1)
    /* DEUX TIRETS sur cette ligne, et c'est juste : la retenue est nulle, le
       solde n'a plus d'objet. On compte plutôt que d'en désigner un — un
       `getByText` unique échouerait sur une ligne parfaitement correcte. */
    expect(within(ligne!).getAllByText('—').length, 'la colonne du solde est vide').toBe(2)
  })

  /**
   * LE CONTREPOIDS. Ce qui est encore détenu reste dû, retenue comprise.
   *
   * Un correctif qui aurait retiré du total tout ce qui n'est pas `held` —
   * l'arbitrage en cours, par exemple — aurait effacé une dette bien réelle :
   * une caution en cours d'arbitrage est retenue en partie, pas rendue.
   */
  it('gardent l’arbitrage en cours dans la dette', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* A3 : 230 000 consignés, 45 000 retenus, arbitrage en cours. Les 185 000
       restants sont dus au locataire, et doivent rester comptés. */
    const ligne = screen.getAllByRole('row').find((r) => /Serge Mbarga/.test(r.textContent ?? ''))
    expect(within(ligne!).getByText(/185 000|185 000/)).toBeInTheDocument()
  })
})

/**
 * L'ÉTAT DES CAUTIONS DIT LA MÊME DETTE QUE L'ÉCRAN DONT IL SORT.
 *
 * ═══ POURQUOI CE DOCUMENT EXISTE ═══
 *
 * Une caution n'est pas l'argent du bailleur : c'est celui du locataire, détenu
 * pour lui. C'est la seule ligne du produit qu'on doit pouvoir JUSTIFIER sur
 * demande, et son écran était le seul écran d'argent SANS export — quand les
 * paiements et les relevés en ont un depuis longtemps.
 *
 * ═══ CE QUE CE CAS TIENT ═══
 *
 * Le raccord, qui n'appartient à personne : l'écran calcule sa dette, le
 * document la recalcule, et rien ne les obligeait à tomber d'accord. C'est
 * exactement la divergence que ce lot vient de corriger sur l'écran — un
 * document qui aurait gardé l'ancienne formule aurait remis la caution rendue
 * dans la dette, sur le papier cette fois.
 */
describe('l’état des cautions', () => {
  it('exclut de la dette ce qui a été rendu, comme l’écran', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /état des cautions|deposits statement/i }))
      const [fichier] = await capture.settle()
      const feuille = new TextDecoder('latin1').decode(fichier.bytes)

      /* 813 000 : ce que le parc doit encore, la caution rendue déduite. Le
         NOMBRE, et pas seulement le titre — un document qui reprendrait
         l'ancienne formule porterait 1 063 000 sans que rien ne le dise. */
      expect(feuille, 'la dette du document diffère de celle de l’écran').toMatch(/813\s?000/)
      expect(feuille, 'la caution rendue est encore comptée').not.toMatch(/1\s?063\s?000/)
    } finally {
      capture.restore()
    }
  })

  it('range les cautions par obligation, la rendue comprise', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /état des cautions|deposits statement/i }))
      const [fichier] = await capture.settle()
      const feuille = new TextDecoder('latin1').decode(fichier.bytes)

      /* TROIS SECTIONS, TROIS OBLIGATIONS : dette entière, dette en litige,
         dette éteinte. Les mêler ferait un tableau exact et inutilisable. */
      for (const section of ['Consignée', 'En cours', 'Restituée'])
        expect(feuille, `la section « ${section} » manque`).toContain(section)

      /* ET LA RENDUE FIGURE QUAND MÊME, hors du total : la retirer ferait un
         document qui ne se recoupe pas avec l'écran, et l'on chercherait la
         caution manquante. */
      expect(feuille, 'la caution rendue a disparu du document').toMatch(/C3/)
    } finally {
      capture.restore()
    }
  })
})
