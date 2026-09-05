import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN RAPPORT ÉCRIT NE SE COMPARE PAS À L'ŒIL.
 *
 * ═══ CE QUE LES TUILES DONNAIENT À LIRE ═══
 *
 * Quatre tuiles en rangée, et trois d'entre elles portaient un rapport à
 * dénominateur DIFFÉRENT : « 5/5 », « 3/4 », « 2/3 ». Pour savoir lequel des
 * trois immeubles est le plus troué, il fallait poser trois divisions de tête —
 * et l'ordre affiché n'est pas l'ordre de tension : 100, 75, 67. Le classement
 * que la rangée existe pour donner était le seul qu'elle ne donnait pas.
 *
 * Une barre le rend sans un calcul : même origine, même longueur d'une tuile à
 * l'autre, donc les trois se lisent en travers.
 *
 * ═══ LA BARRE NE JUGE PAS, ET C'EST LA MOITIÉ DE LA GARDE ═══
 *
 * `occupationSansVerdict` a déjà tranché pour la carte du tableau de bord : un
 * ratio d'occupation n'est ni `ok`, ni `warn`, ni `danger`, sous peine d'une
 * alerte permanente que personne ne lit plus au bout d'une semaine. La barre
 * posée ici est du MÊME ordre — une forme, pas un verdict — et le troisième cas
 * l'exige explicitement, sans quoi le prochain lot qui la peindrait au seuil
 * rouvrirait par la porte des tuiles ce que l'autre garde a fermé.
 *
 * ═══ ET LE CHIFFRE NE S'ÉCRIT PLUS DEUX FOIS ═══
 *
 * La note redisait le rapport que la valeur venait de donner — « 5/5 », puis
 * « Bonamoussadi · 5/5 occupées » quinze pixels plus bas — et elle occupait
 * exactement la ligne où la barre devait aller. Le second cas tient cette
 * ligne : la place a été rendue, elle ne se reprend pas.
 */

/** Les trois immeubles de la démonstration, et leur taux attendu. */
const IMMEUBLES = [
  { nom: 'Résidence Bonamoussadi', quartier: 'Bonamoussadi', rapport: '5/5', taux: 100 },
  { nom: 'Immeuble Akwa Nord', quartier: 'Akwa', rapport: '3/4', taux: 75 },
  { nom: 'Villa Deïdo', quartier: 'Deïdo', rapport: '2/3', taux: 67 },
]

/**
 * La carte d'indicateur qui porte cet intitulé, barre comprise.
 *
 * PAR `data-intitule` ET NON PAR `getByText` : un nom d'immeuble apparaît trois
 * fois sur cet écran — la tuile, le bouton de filtre, et chaque ligne du
 * tableau. `getByText('Résidence Bonamoussadi')` échoue donc sur « plusieurs
 * éléments », et le premier jet de ce cas rougissait pour cette raison-là, pas
 * pour la sienne.
 */
function tuile(intitule: string) {
  const carte = Array.from(document.querySelectorAll('[data-indicateur]')).find(
    (c) => c.querySelector('[data-intitule]')?.textContent?.trim() === intitule,
  )
  if (!carte) throw new Error(`Aucune carte d'indicateur pour « ${intitule} »`)
  return carte as HTMLElement
}

describe('les tuiles d’occupation du parc', () => {
  it('porte une barre dont le remplissage est le taux de l’immeuble', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    for (const immeuble of IMMEUBLES) {
      const carte = tuile(immeuble.nom)

      /*
        GARDE DU GARDE — la tuile doit bien être celle qu'on croit.

        Sans cette ligne, une carte vide passerait les deux assertions suivantes
        pour la seule raison qu'elle ne contient rien du tout.
      */
      expect(within(carte).getByText(immeuble.rapport)).toBeInTheDocument()

      const barre = within(carte).getByRole('progressbar')
      expect(barre, `barre de ${immeuble.nom}`).toHaveAttribute(
        'aria-valuenow',
        String(immeuble.taux),
      )
    }
  })

  it('porte la barre sur le taux du parc entier, comme sur ses parties', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    // 10 occupées sur 12 : le même nombre que la valeur de la carte, et c'est
    // le point — la barre lit la donnée, elle ne s'invente pas une échelle.
    const barre = within(tuile('Taux d’occupation')).getByRole('progressbar')
    expect(barre).toHaveAttribute('aria-valuenow', '83')
  })

  it('ne redit pas le rapport sous le rapport', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    for (const immeuble of IMMEUBLES) {
      const carte = tuile(immeuble.nom)
      /*
        LE COMPTE SE FAIT SUR LE TEXTE DE LA CARTE, et non par `getAllByText`.

        `getAllByText('5/5')` compare le texte ENTIER d'un élément : il ne
        trouve pas « 5/5 » dans « Bonamoussadi · 5/5 occupées », donc il rendait
        1 sur le code fautif comme sur le code corrigé — un cas qui ne peut pas
        rougir. Passer une expression régulière ne sauve rien : elle apparie
        alors aussi les PARENTS, dont la carte elle-même, et le compte devient
        fonction de la profondeur du balisage.
      */
      const occurrences = (carte.textContent?.match(new RegExp(immeuble.rapport, 'g')) ?? []).length
      expect(occurrences, `« ${immeuble.rapport} » écrit une seule fois dans la tuile`).toBe(1)

      /*
        LE QUARTIER RESTE — c'est la seconde moitié du correctif, et sans elle
        « ne redit pas le rapport » serait satisfait par une note SUPPRIMÉE.

        Chaîne exacte et non expression régulière : « Bonamoussadi » est un
        MORCEAU de « Résidence Bonamoussadi », donc une regex apparie aussi
        l'intitulé de la carte et le cas échouait sur « plusieurs éléments ».
        L'appariement exact ne retient que la note, qui porte le quartier seul.
      */
      expect(within(carte).getByText(immeuble.quartier)).toBeInTheDocument()
    }
  })

  it('ne peint aucun verdict sur une occupation', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    /*
      LE MÊME INTERDIT QUE `occupationSansVerdict`, porté aux tuiles du Parc.

      Un immeuble PLEIN et un immeuble TROUÉ sont dans le jeu : si la barre se
      peignait au seuil, les deux cartes divergeraient ici. C'est le couple qui
      fait le cas — sur trois immeubles pleins, l'assertion passerait au vert
      sur un code fautif.
    */
    for (const immeuble of IMMEUBLES) {
      const carte = tuile(immeuble.nom)
      expect(carte.getAttribute('data-etat'), `état de ${immeuble.nom}`).toBeNull()
    }
  })
})
