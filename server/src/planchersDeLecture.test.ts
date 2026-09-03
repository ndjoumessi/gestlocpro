import { describe, expect, it } from 'vitest'
// @ts-expect-error — script Node en JavaScript, hors du projet TypeScript.
import { releverLesSources, PLANCHERS_DE_LECTURE } from '../../scripts/inventaire/lecture-sources.mjs'

/**
 * UN PLANCHER DE LECTURE NE FLOTTE PAS LOIN SOUS LE RÉEL.
 *
 * ═══ CE QU'ILS SONT, ET POURQUOI ILS POURRISSENT ═══
 *
 * `lecture-sources` lit le dépôt et compte ce qu'il trouve — fichiers, balises,
 * composants, sites interactifs. Chaque compteur a un plancher : passer dessous
 * arrête tout, parce qu'« un motif de lecture qui cesse de trouver » et « ce
 * dépôt n'a rien » s'écrivent pareil dans un rapport.
 *
 * Ces contrôles ne parlent QUE lorsqu'on passe dessous. Au-dessus, silence. Et
 * un plancher qu'on n'a pas à monter n'est jamais monté : mesuré le 2026-09-03,
 * ils flottaient de 29 % à 68 % sous le réel. Le relevé des titres pouvait
 * perdre LES DEUX TIERS de ce qu'il lit — 435 lus, plancher à 140 — sans qu'une
 * seule plainte sorte.
 *
 * ═══ CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE TOUCHE PAS ═══
 *
 * Elle refuse un écart de plus de VINGT POUR CENT. Le contrôle d'exécution reste
 * une inégalité franche : ajouter des fichiers ne fait toujours pas rougir une
 * porte au navigateur en plein passage. C'est ici, dans une suite qui dure une
 * seconde, que la mise à jour se réclame — avec le nombre à écrire.
 *
 * C'est le même dessin que `plancherDesRoutes.test.ts`, à un détail près qui
 * compte : LÀ-BAS L'ÉGALITÉ, ICI UNE MARGE. Le compte des routes bouge quand on
 * ajoute un écran, geste rare et délibéré ; ces compteurs-ci bougent à chaque
 * commit. Exiger l'égalité les rendrait insupportables, et une garde qu'on
 * désactive ne garde rien.
 *
 * ═══ POURQUOI VINGT ═══
 *
 * Les planchers sont posés à ~90 % du réel : il faut donc environ 12 % de
 * croissance pour atteindre 20 % d'écart. Un tour de clé par trimestre, pas par
 * commit. Le nombre est CHOISI, pas mesuré — je n'ai pas de série historique de
 * croissance de ce dépôt, et je préfère l'écrire que de l'habiller.
 */
const ECART_MAXIMAL = 0.2

type Releve = {
  perimetre: { fichiersScannes: number; balisesLues: number; composantsIndexes: number; testsEcartes: number }
  anneauDeFocus: { sitesInteractifs: number }
  libelles: { champsTrouves: number }
  titres: { titresTrouves: number }
}

/** Le réel, compteur par compteur, sous les mêmes noms que les planchers. */
function reels(): Record<string, number> {
  const r = (releverLesSources as () => Releve)()
  return {
    'fichiers scannés': r.perimetre.fichiersScannes,
    'balises JSX lues': r.perimetre.balisesLues,
    'composants indexés': r.perimetre.composantsIndexes,
    'sites interactifs': r.anneauDeFocus.sitesInteractifs,
    'champs de formulaire': r.libelles.champsTrouves,
    'titres composés': r.titres.titresTrouves,
    'fichiers de test écartés': r.perimetre.testsEcartes,
  }
}

const planchers = () => PLANCHERS_DE_LECTURE as Record<string, number>

describe('les planchers de lecture', () => {
  it('lisent bien quelque chose — sans quoi cette garde ne garderait rien', () => {
    /* Un relevé cassé rendrait des zéros, et « l'écart » ci-dessous vaudrait
       100 % partout — ou rien du tout si la table était vide. */
    const mesures = Object.values(reels())
    expect(mesures.length).toBeGreaterThanOrEqual(7)
    for (const v of mesures) expect(v).toBeGreaterThan(0)
  })

  it('couvrent CHAQUE compteur, sans oubli ni orphelin', () => {
    /* Un plancher sans compteur ne garde rien ; un compteur sans plancher n'est
       gardé par rien. Les deux se lisent pareil : silence. */
    expect(Object.keys(planchers()).sort()).toEqual(Object.keys(reels()).sort())
  })

  it('ne flottent pas à plus de 20 % sous le réel', () => {
    const derives = Object.entries(reels())
      .map(([quoi, reel]) => ({ quoi, reel, plancher: planchers()[quoi]!, ecart: 1 - planchers()[quoi]! / reel }))
      .filter((d) => d.ecart > ECART_MAXIMAL)
      .map(
        (d) =>
          `${d.quoi} : ${d.reel} lus, plancher à ${d.plancher} — ` +
          `${Math.round(d.ecart * 100)} % perdables. Écrivez ${Math.floor(d.reel * 0.9)}.`,
      )

    expect(
      derives,
      'ces relevés peuvent rétrécir sans qu’une plainte sorte, et un motif de lecture ' +
        'qui ne trouve plus rien se lit « aucun défaut » :\n  ' + derives.join('\n  '),
    ).toEqual([])
  })
})
