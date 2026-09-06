import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN RAPPORT ÉCRIT NE SE COMPARE PAS À L'ŒIL.
 *
 * ═══ CE QUE CE CAS GARDAIT, ET OÙ IL LE GARDE MAINTENANT ═══
 *
 * Il visait les CARTES d'immeuble : quatre tuiles en rangée dont trois
 * portaient un rapport à dénominateur différent — « 5/5 », « 3/4 », « 2/3 » —
 * qu'il fallait diviser de tête pour classer, l'ordre affiché n'étant pas
 * l'ordre de tension (100, 75, 67).
 *
 * Les cartes sont parties : elles énuméraient les immeubles une deuxième fois,
 * à côté des pastilles de filtre et de la colonne « Immeuble ». La barre, elle,
 * n'est pas partie — elle a suivi le nom dans l'EN-TÊTE DE GROUPE, qui est
 * désormais le seul endroit où un immeuble est nommé.
 *
 * Ce qu'elle y fait a changé de nature, et il faut le dire : alignées dans une
 * grille, les barres COMPARAIENT ; empilées en en-têtes séparés par leurs
 * lignes, elles SITUENT l'immeuble qu'on est en train de lire. Le classement
 * d'un coup d'œil est perdu avec la grille. Ce qui reste — une mesure là où on
 * la lit — est ce que ce fichier garde.
 *
 * ═══ LA BARRE NE JUGE PAS, ET C'EST LA MOITIÉ DE LA GARDE ═══
 *
 * `occupationSansVerdict` a tranché pour la carte du tableau de bord : un ratio
 * d'occupation n'est ni `ok`, ni `warn`, ni `danger`, sous peine d'une alerte
 * permanente que personne ne lit plus au bout d'une semaine. Le dernier cas
 * porte cet interdit aux en-têtes du parc, sur un jeu qui contient un immeuble
 * PLEIN et deux TROUÉS — sans ce couple, l'assertion passerait au vert sur un
 * code fautif.
 */

/** Les trois immeubles de la démonstration, et leur taux attendu. */
const IMMEUBLES = [
  { nom: 'Résidence Bonamoussadi', quartier: 'Bonamoussadi', rapport: '5/5', taux: 100 },
  { nom: 'Immeuble Akwa Nord', quartier: 'Akwa', rapport: '3/4', taux: 75 },
  { nom: 'Villa Deïdo', quartier: 'Deïdo', rapport: '2/3', taux: 67 },
]

/**
 * L'en-tête de groupe qui porte ce nom d'immeuble.
 *
 * PAR `data-groupe` ET NON PAR `getByText` : `role="group"` désignait déjà
 * d'autres choses sur cet écran, et le nom d'un immeuble apparaît aussi dans les
 * modales de correction. Même idiome que `data-indicateur` sur `StatCard`.
 */
function enTete(nom: string) {
  const bloc = Array.from(document.querySelectorAll('[data-groupe]')).find(
    (e) => e.querySelector('h3')?.textContent?.trim() === nom,
  )
  if (!bloc) throw new Error(`Aucun en-tête de groupe pour « ${nom} »`)
  return bloc as HTMLElement
}

async function ouvrirLeParc() {
  installerFauxServeur()
  await renderApp('/demo/parc', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
}

describe('l’occupation d’un immeuble, en tête de son bloc', () => {
  it('porte une barre dont le remplissage est le taux de l’immeuble', async () => {
    await ouvrirLeParc()

    for (const immeuble of IMMEUBLES) {
      const bloc = enTete(immeuble.nom)

      /* GARDE DU GARDE — le bloc doit bien être celui qu'on croit. Sans cette
         ligne, un en-tête vide passerait l'assertion suivante pour la seule
         raison qu'il ne contient rien. */
      expect(within(bloc).getByText(immeuble.rapport)).toBeInTheDocument()

      const barre = within(bloc).getByRole('progressbar')
      expect(barre, `barre de ${immeuble.nom}`).toHaveAttribute(
        'aria-valuenow',
        String(immeuble.taux),
      )
    }
  })

  it('porte la barre du parc entier dans son bandeau, sur la même échelle', async () => {
    await ouvrirLeParc()

    /* 10 occupées sur 12. L'agrégat a quitté la grille des immeubles — un tout
       rangé parmi ses parties se lit comme une partie de plus — mais il garde
       la MÊME barre qu'eux : une échelle commune, ou aucune lecture commune. */
    const bandeau = document.querySelector('[data-indicateur]')
    expect(bandeau, 'le bandeau d’occupation du parc').not.toBeNull()
    expect(within(bandeau as HTMLElement).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '83',
    )
  })

  it('ne redit pas le rapport sous le rapport', async () => {
    await ouvrirLeParc()

    for (const immeuble of IMMEUBLES) {
      const bloc = enTete(immeuble.nom)
      /*
        LE COMPTE SE FAIT SUR LE TEXTE DU BLOC, et non par `getAllByText`.

        `getAllByText('5/5')` compare le texte ENTIER d'un élément : il ne
        trouve pas « 5/5 » dans « Bonamoussadi · 5/5 occupées », donc il rendrait
        1 sur le code fautif comme sur le code corrigé — un cas qui ne peut pas
        rougir. Passer une expression régulière ne sauve rien : elle apparie
        alors aussi les PARENTS, et le compte devient fonction de la profondeur
        du balisage.
      */
      const occurrences = (bloc.textContent?.match(new RegExp(immeuble.rapport, 'g')) ?? []).length
      expect(occurrences, `« ${immeuble.rapport} » écrit une seule fois`).toBe(1)

      /* LE QUARTIER RESTE — sans lui, « ne redit pas le rapport » serait
         satisfait par un en-tête AMPUTÉ. Chaîne exacte et non regex :
         « Bonamoussadi » est un morceau de « Résidence Bonamoussadi », donc une
         regex apparierait aussi le titre. */
      expect(within(bloc).getByText(immeuble.quartier)).toBeInTheDocument()
    }
  })

  it('ne peint aucun verdict sur une occupation', async () => {
    await ouvrirLeParc()

    /* LE MÊME INTERDIT QUE `occupationSansVerdict`, porté aux en-têtes du Parc.
       Un immeuble PLEIN et deux TROUÉS sont dans le jeu : si la barre se
       peignait au seuil, les blocs divergeraient ici. C'est le couple qui fait
       le cas — sur trois immeubles pleins, l'assertion passerait au vert sur un
       code fautif. */
    for (const immeuble of IMMEUBLES) {
      const bloc = enTete(immeuble.nom)
      const tons = Array.from(bloc.querySelectorAll('[data-ton]')).map((p) =>
        p.getAttribute('data-ton'),
      )
      expect(tons, `verdict dans l’en-tête de ${immeuble.nom}`).not.toContain('ok')
      expect(tons).not.toContain('warn')
      expect(tons).not.toContain('danger')
    }
  })
})
