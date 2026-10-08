import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, within } from '@/test/render'

/**
 * LA NAVIGATION DU MANUEL MÈNE LÀ OÙ ELLE LE DIT — dans ses DEUX formes.
 *
 * ═══ LE DÉFAUT QUE CES CAS EMPÊCHENT A DÉJÀ EU LIEU ICI ═══
 *
 * Le pied de page public a porté cinq entrées dont les ancres RÉSOLVAIENT — la
 * page défilait bel et bien — vers des sections qui ne tenaient pas le libellé
 * qui y menait : « Contact » déposait sur la FAQ, qui ne porte aucun canal de
 * contact. Voir l'en-tête de `PublicFooter.tsx`, où le relevé est écrit entrée
 * par entrée. Ce n'est donc pas la destination qui manque dans cette classe de
 * défaut, c'est la promesse qu'elle tienne le nom qu'on a lu avant de cliquer.
 *
 * Une navigation d'ancres se vérifie donc sur QUATRE points, et le premier seul
 * ne suffit jamais :
 *
 *  1. L'ANCRE EXISTE. Un `href="#manuel-parc-x"` sans cible ne défile nulle
 *     part et ne rougit nulle part : le navigateur reste où il est, et le
 *     lecteur croit que la page est cassée.
 *  2. ELLE EST UNIQUE DANS LE DOCUMENT. La carte « ce que font les autres
 *     rôles » rend les MÊMES gestes que « vos gestes » pour un propriétaire et
 *     son gestionnaire. Deux `id` identiques feraient atterrir le lecteur sur
 *     la section d'un rôle qui n'est pas le sien, et `getElementById` rendrait
 *     le premier des deux sans se plaindre.
 *  3. DEUX ENTRÉES NE PORTENT PAS LE MÊME NOM. Le registre est rangé dans
 *     l'ordre du MOIS : « Parc immobilier » y revient TROIS fois — on monte le
 *     parc, on y vit le bail, on en sort. C'est juste, et c'est tout le propos
 *     de la page ; mais trois entrées portant le même mot forcent à les essayer
 *     l'une après l'autre, c'est-à-dire à refaire le défilement qu'on
 *     prétendait supprimer.
 *  4. L'ENTRÉE TIENT SON LIBELLÉ : le titre où l'on atterrit nomme le même
 *     écran qu'elle.
 *
 * ═══ POURQUOI LES DEUX FORMES SONT ÉPROUVÉES SÉPARÉMENT ═══
 *
 * `Manuel.tsx` en rend UNE SEULE à la fois, choisie par `useAuDela` : le rail
 * collant au-delà de 64 rem, le sommaire en grille en deçà. Un cas qui ne
 * visiterait que la largeur par défaut de `renderApp` — 1280, donc le rail —
 * laisserait la grille entièrement non gardée, et réciproquement. Les deux
 * descriptions ci-dessous passent la MÊME batterie, à deux largeurs.
 *
 * ═══ LE PLANCHER, AVANT TOUT LE RESTE ═══
 *
 * Une navigation VIDE satisfait « aucune ancre morte », « aucun doublon » et
 * « chaque libellé tenu » — trois verts sur zéro entrée. C'est
 * [[cas-negatif-vert-a-vide]] appliqué à une navigation, et le premier cas de
 * chaque batterie est là pour que les suivants comparent quelque chose.
 */

/** Les entrées, dans l'ordre du document : leur libellé et l'ancre qu'elles visent. */
function entreesDe(nav: HTMLElement): { libelle: string; ancre: string }[] {
  return within(nav)
    .getAllByRole('link')
    .map((a) => ({
      libelle: (a.textContent ?? '').trim(),
      ancre: (a.getAttribute('href') ?? '').replace(/^#/, ''),
    }))
}

/**
 * LA MÊME BATTERIE, POSÉE SUR UNE FORME ET SUR UNE LARGEUR.
 *
 * Une fonction plutôt que deux copies : c'est la DIVERGENCE qu'on garde ici.
 * Deux séries recopiées auraient dérivé au premier ajout, et la forme la moins
 * regardée — la grille, que la largeur par défaut ne rend pas — est précisément
 * celle qui aurait perdu un cas sans que rien ne le dise.
 */
function battitDesAncres(forme: string, nom: RegExp, largeur: number) {
  describe(`la navigation du manuel — ${forme}`, () => {
    const ouvrir = async (): Promise<HTMLElement> => {
      await renderApp('/demo/manuel', { largeur })
      return screen.getByRole('navigation', { name: nom })
    }

    it('a des entrées — sinon tout ce qui suit est vrai par vacuité', async () => {
      /* DIX AU MINIMUM : le registre rend treize suites d'écran au
         propriétaire, et une navigation qui en perdrait le quart aurait été
         vidée par accident. */
      expect(entreesDe(await ouvrir()).length).toBeGreaterThanOrEqual(10)
    })

    it('ne vise aucune ancre absente du document', async () => {
      const mortes = entreesDe(await ouvrir())
        .filter(({ ancre }) => !ancre || !document.getElementById(ancre))
        .map(({ libelle, ancre }) => `${libelle} → #${ancre}`)

      expect(mortes, 'le navigateur ne défilera nulle part').toEqual([])
    })

    it('ne vise aucune ancre que le document porte deux fois', async () => {
      const doublons = entreesDe(await ouvrir())
        .filter(({ ancre }) => document.querySelectorAll(`[id="${CSS.escape(ancre)}"]`).length > 1)
        .map(({ ancre }) => ancre)

      expect(doublons, 'le lecteur atterrirait sur la section d’un autre rôle').toEqual([])
    })

    it('n’écrit pas deux fois le même libellé', async () => {
      const vus = new Set<string>()
      const repetes = entreesDe(await ouvrir())
        .map(({ libelle }) => libelle)
        .filter((libelle) => !vus.add(libelle))

      expect(repetes, 'il faudrait les essayer l’une après l’autre').toEqual([])
    })

    it('atterrit sur un titre qui nomme l’écran annoncé', async () => {
      /* Le libellé peut porter un complément après un tiret cadratin — c'est ce
         qui distingue les trois passages par le parc. L'ÉCRAN est ce qui
         précède, et c'est lui que le titre d'arrivée doit nommer. */
      const trahies = entreesDe(await ouvrir())
        .map(({ libelle, ancre }) => {
          const ecran = libelle.split('—')[0]!.trim()
          const arrivee = document.getElementById(ancre)?.textContent ?? ''
          return arrivee.includes(ecran) ? null : `${libelle} → « ${arrivee} »`
        })
        .filter((plainte): plainte is string => plainte !== null)

      expect(trahies, 'l’entrée promet un écran et en montre un autre').toEqual([])
    })
  })
}

/* `renderApp` répond à `matchMedia` par la largeur qu'on lui donne : 1280
   franchit les 64 rem du rail, 390 ne les franchit pas. Ce sont les deux
   branches de `Manuel.tsx`, pas deux décors. */
battitDesAncres('le rail collant, au-delà de 64 rem', /sur cette page/i, 1280)
battitDesAncres('le sommaire en grille, en deçà', /sommaire/i, 390)

describe('une seule navigation à la fois', () => {
  /**
   * LES DEUX FORMES NE COHABITENT JAMAIS, et c'est la raison pour laquelle
   * `Manuel.tsx` choisit par `useAuDela` plutôt que par `hidden lg:block`.
   *
   * Les classes de Tailwind auraient laissé les DEUX dans le document : treize
   * ancres en double, un lecteur d'écran qui annonce deux fois la même liste,
   * et le cas « aucune ancre portée deux fois » ci-dessus qui reste vert
   * puisqu'il compte les CIBLES, pas les liens. Ce qui est caché à l'œil ne
   * l'est pas à l'arbre.
   */
  it('le rail exclut la grille, au-delà de 64 rem', async () => {
    await renderApp('/demo/manuel', { largeur: 1280 })

    expect(screen.getByRole('navigation', { name: /sur cette page/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: /sommaire/i }),
      'les deux listes seraient annoncées l’une après l’autre',
    ).toBeNull()
  })

  it('la grille exclut le rail, en deçà', async () => {
    await renderApp('/demo/manuel', { largeur: 390 })

    expect(screen.getByRole('navigation', { name: /sommaire/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: /sur cette page/i }),
      'un rail de 28 px de cible, sur un écran tactile',
    ).toBeNull()
  })
})

describe('le seuil sous lequel aucune navigation ne paraît', () => {
  /**
   * UN LOCATAIRE N'A QUE TROIS SUITES — son espace, ses documents, son
   * signalement —, et sa carte « vos gestes » mesure 753 px à 1280 contre
   * 3 220 pour un propriétaire. Trois entrées y coûteraient environ 160 px pour
   * épargner, au mieux, les 590 qui les suivent : une table des matières plus
   * longue à lire que ce qu'elle indexe, ce que `SommaireDesRubriques` refuse
   * déjà aux mentions légales pour la même raison.
   *
   * CE CAS N'EST PAS NÉ VERT : éprouvé par mutation le 2026-10-08, le seuil
   * remplacé par `true` — le sommaire paraissait bel et bien au locataire, avec
   * ses trois entrées.
   */
  it('ni rail ni grille pour le locataire, dont la section tient sous les yeux', async () => {
    await renderApp('/demo/manuel')
    await switchRole('tenant')

    expect(
      screen.queryByRole('navigation', { name: /sur cette page|sommaire/i }),
      'trois entrées pour une carte de 753 px',
    ).toBeNull()
  })
})
