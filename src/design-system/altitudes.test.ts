import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de l'ÉCHELLE DES ALTITUDES.
 *
 * Trois surfaces flottantes du produit portaient le même 50 écrit à la main :
 * les deux panneaux de `DatePicker` — calendrier et sélecteur de mois, tous
 * deux montés sur `document.body` par un portail — et le menu de compte de la
 * coquille. Or `Modal` vit à `var(--z-modal)`, c'est-à-dire 70. Le calendrier
 * se peignait donc SOUS la fenêtre qui venait de l'ouvrir : on cliquait le
 * champ de date d'un formulaire, et il ne se passait rien de visible.
 *
 * Le nombre n'était faux nulle part en particulier ; il était SEUL. Une
 * altitude écrite en clair ne dit pas contre quoi elle se compare, elle ne se
 * relit pas depuis la feuille de jetons, et rien ne signale qu'un autre lot
 * vient de poser une surface au-dessus. L'échelle existe pourtant, complète et
 * ordonnée, dans `tokens.css` — elle n'était simplement pas obligatoire.
 *
 * D'où une règle qui porte sur les SOURCES et non sur le DOM, pour la même
 * raison que `couches.test.ts` et `empilement.test.ts` : jsdom ne peint pas,
 * `var(--z-modal)` y reste une chaîne jamais résolue, et monter deux surfaces
 * pour interroger leur style rendu confirmerait le comportement de jsdom, pas
 * celui d'un navigateur. Le fichier est la source de vérité, c'est le fichier
 * qu'on interroge.
 *
 * DEUX FORMES sont refusées, parce que fermer la première seule aurait
 * simplement déplacé le nombre : la classe d'utilitaire, et le nombre nu dans
 * `style={{ zIndex: … }}`. La seconde est le chemin de contournement naturel
 * une fois la première interdite — et c'est exactement le tapis sous lequel on
 * glisse le prochain défaut.
 *
 * Et la règle ne suffirait pas seule : une altitude peut passer par un jeton
 * qui n'existe pas. `var(--z-popup)` ne rougit nulle part, ne se résout à rien,
 * et l'élément retombe à `auto` — le même défaut, sans le nombre. Les jetons
 * cités sont donc confrontés à la feuille, et l'ordre de l'échelle est vérifié
 * pour lui-même : c'est ce qui garde le correctif de ce lot, où l'on affirme
 * qu'un panneau ancré passe AU-DESSUS de la modale et SOUS le message.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/*
  Motifs assemblés par FRAGMENTS.

  Tailwind v4 lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair : un garde qui écrit
  l'altitude qu'il interdit la fabrique dans le CSS livré. Le piège a déjà coûté
  une classe fantôme, et `graisses.test.ts` le documente.
*/
const CLASSE_ALTITUDE = new RegExp(`(?<![-\\w])${'z'}-\\d+(?![-\\w])`, 'g')
const NOMBRE_NU = /zIndex:\s*['"`]?\d/g
const JETON_CITE = new RegExp(`var\\(${['--z', '[\\w-]+'].join('-')}\\)`, 'g')
const DECLARATION = new RegExp(`${['--z', '([\\w-]+)'].join('-')}:\\s*(\\d+)`, 'g')

/**
 * L'UNIQUE exemption, nommée et motivée.
 *
 * Le graphique ordonne ses propres pièces entre elles — le repère d'objectif
 * par-dessus les barres qu'il traverse — et cet ordre-là ne dit rien du
 * produit : rien de tout cela ne se compare à une modale ni à un message. Le
 * ranger sur l'échelle demanderait un barreau sous le plus bas, inventé pour
 * un trait de carte.
 *
 * Elle est vérifiée VIVANTE et non comptée. Une exemption qui ne désigne plus
 * rien couvrira un jour une surface que personne n'a examinée — c'est la leçon
 * de `cibles.test.ts` — mais un compte exact, lui, rougirait au premier
 * remaniement interne du graphique, qui n'a rien à voir avec les couches. On
 * exige donc qu'elle serve encore, pas qu'elle serve toujours autant.
 *
 * RÉSERVE ÉCRITE, parce qu'elle vaut mieux qu'un silence : rien entre la zone
 * de tracé et la racine ne crée de contexte d'empilement. Une altitude interne
 * qui atteindrait la valeur d'un barreau concourrait donc pour de bon avec
 * lui, et l'ordre du document trancherait — le défaut qu'`empilement.test.ts`
 * a payé sur le bord bas. Isoler la zone de tracé refermerait la question ;
 * cela se mesure au navigateur, sur un graphique réel, et c'est un autre lot.
 */
const EXEMPTION = {
  fichier: 'components/primitives/Charts.tsx',
  raison:
    'Les pièces d’une même carte s’ordonnent entre elles. L’échelle nomme les ' +
    'SURFACES du produit ; elle n’a pas de barreau pour l’intérieur d’un ' +
    'graphique.',
}

/** Fichiers examinés : le code livré, pas les tests ni les types. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx?$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Commentaires BLANCHIS, et non retirés.
 *
 * Les retirer écraserait un bloc de vingt lignes en une seule, et tout numéro
 * rapporté ensuite désignerait la mauvaise ligne — dans un dépôt qui commente
 * autant, le décalage est systématique et trompe au moment précis où l'on s'y
 * fie. C'est aussi ce qui laisse les commentaires de `tokens.css` et de
 * `DatePicker` NOMMER le 50 qu'ils viennent de corriger sans faire rougir le
 * garde qui les en a débarrassés.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

interface Ecrite {
  fichier: string
  ligne: number
  texte: string
}

/**
 * Les altitudes écrites à la main, sous leurs deux formes.
 *
 * Séparé du parcours de l'arbre pour être exerçable sur une source TÉMOIN : un
 * contrôle qui n'affirme qu'une absence ne distingue pas un dépôt sain d'un
 * détecteur cassé, et `cibles.test.ts` a déjà vu un motif trop large faire
 * passer le produit entier en silence.
 */
function altitudesEcrites(relatif: string, brut: string): Ecrite[] {
  const source = sansCommentaires(brut)
  return source.split('\n').flatMap((ligne, i) =>
    [...ligne.matchAll(CLASSE_ALTITUDE), ...ligne.matchAll(NOMBRE_NU)].map((trouve) => ({
      fichier: relatif,
      ligne: i + 1,
      texte: trouve[0],
    })),
  )
}

const SOURCES = fichiersSources(SRC).map((chemin) => ({
  fichier: chemin.slice(SRC.length + 1),
  brut: readFileSync(chemin, 'utf8'),
}))

const ECRITES = SOURCES.flatMap(({ fichier, brut }) => altitudesEcrites(fichier, brut))

/** L'échelle telle que la feuille la déclare, dans son ordre d'écriture. */
const ECHELLE = [...readFileSync(join(ICI, 'tokens.css'), 'utf8').matchAll(DECLARATION)].map(
  ([, nom, valeur]) => ({ nom: nom!, valeur: Number(valeur) }),
)

describe('altitudes', () => {
  it('n’en laisse aucune écrite à la main dans les sources', () => {
    const coupables = ECRITES.filter((e) => e.fichier !== EXEMPTION.fichier).map(
      (e) => `${e.fichier}:${e.ligne} — ${e.texte}`,
    )

    expect(coupables, 'altitudes hors de l’échelle').toEqual([])
  })

  it('tient son exemption vivante', () => {
    // Garde du garde, et double emploi : un analyseur qui ne trouve rien valide
    // n'importe quoi, et une exemption qui ne désigne plus rien doit partir.
    expect(
      ECRITES.filter((e) => e.fichier === EXEMPTION.fichier).length,
      EXEMPTION.raison,
    ).toBeGreaterThan(0)
  })

  it('ne cite que des jetons que la feuille déclare', () => {
    const declares = new Set(ECHELLE.map((rang) => rang.nom))
    const fantomes = SOURCES.flatMap(({ fichier, brut }) =>
      [...sansCommentaires(brut).matchAll(JETON_CITE)]
        .map((trouve) => trouve[0])
        .filter((cite) => !declares.has(cite.slice('var(--z-'.length, -1)))
        .map((cite) => `${fichier} — ${cite}`),
    )

    // Un jeton absent ne rougit nulle part et ne se résout à rien : l'élément
    // retombe à `auto`, c'est-à-dire au même défaut sans le nombre.
    expect(fantomes, 'jetons d’altitude jamais déclarés').toEqual([])
  })

  it('range le panneau flottant au-dessus de la modale et sous le message', () => {
    const rang = (nom: string) => ECHELLE.find((r) => r.nom === nom)?.valeur

    // C'est LE correctif de ce lot, et il ne vit que dans la feuille : un
    // panneau ancré à un champ doit couvrir la fenêtre qui l'a ouvert, sans
    // couvrir le message qui annonce ce qui vient de se passer.
    expect(rang('modal')!).toBeLessThan(rang('popover')!)
    expect(rang('popover')!).toBeLessThan(rang('toast')!)
  })

  it('garde l’échelle strictement croissante', () => {
    // Deux barreaux à la même hauteur ne se départagent plus par la cascade
    // mais par l'ordre du document — c'est le défaut que `empilement.test.ts`
    // a payé sur le bord bas de l'écran, et il ne se voit qu'au navigateur.
    const valeurs = ECHELLE.map((rang) => rang.valeur)
    expect(valeurs).toEqual([...new Set(valeurs)].sort((a, b) => a - b))
  })

  it('reconnaît les deux formes sur une source témoin', () => {
    const classe = ['z', '50'].join('-')
    const temoin = [
      `<div className="fixed ${classe} rounded-lg" />`,
      `<div style={{ zIndex: ${20} }} />`,
      `<div style={{ zIndex: 'var(${['--z', 'popover'].join('-')})' }} />`,
    ].join('\n')

    // La troisième ligne est la forme ATTENDUE : un témoin qui ne montrerait
    // que des fautes ne dirait pas si le garde sait s'arrêter.
    expect(altitudesEcrites('temoin.tsx', temoin).map((e) => e.ligne)).toEqual([1, 2])
  })
})
