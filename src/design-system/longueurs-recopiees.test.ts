import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde contre la LONGUEUR RECOPIÉE : un pixel écrit en dur dans une classe.
 *
 * Le panneau du menu de la vitrine s'ouvrait sous `top-[65px]`. Soixante-cinq
 * pixels relevés à la main sur la hauteur de l'en-tête, dans un autre bloc du
 * même fichier — et le commentaire qui les accompagnait avouait déjà le
 * couplage. Il avait cessé d'être juste : mesuré au navigateur, l'en-tête vaut
 * 75 px sur un portable et 131 quand la barre se replie. Trop petit, le
 * panneau remonte SOUS la barre et masque le bouton qui le ferme.
 *
 * Rien ne pouvait le voir. Ce n'est ni une faute de type, ni un débordement,
 * ni un contraste : c'est un nombre juste un jour, faux ensuite, que personne
 * ne relit parce qu'il a l'air d'un réglage.
 *
 * CE QUI EST INTERDIT N'EST PAS LE PIXEL, mais le pixel QU'UN AUTRE ÉLÉMENT
 * DÉTERMINE. Le dépôt a déjà le remède et l'applique ailleurs : une propriété
 * CSS que le propriétaire de la mesure publie et que le lecteur lit —
 * `--h-barre-basse` pour la barre basse, `--h-entete-vitrine` désormais pour
 * l'en-tête. La règle ci-dessous rend ce choix obligatoire au lieu de le
 * laisser à la mémoire de qui écrit.
 *
 * Une valeur de repli DANS un `var()` reste permise : `var(--x, 0px)` ne
 * recopie rien, il déclare ce qui vaut tant que la propriété n'existe pas.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/*
  Motif assemblé par FRAGMENTS.

  Tailwind lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair. Le piège a déjà coûté
  une classe fantôme dans le CSS livré, et `graisses.test.ts` le documente.
*/
/*
  SEULS LES DÉCALAGES, et non toute longueur arbitraire.

  La première rédaction couvrait aussi `w-`, `h-`, `p-` et `m-`. Elle accusait
  `AppShell` pour `w-[72px]`, la largeur du rail replié — une dimension PROPRE,
  que rien d'autre ne détermine, et dont ce contrôle n'a rien à dire. Une règle
  qui déborde son propre énoncé finit désactivée, et ce dépôt le refuse par
  écrit ailleurs. Ce qu'un autre élément détermine, c'est OÙ l'on se place.
*/
const DECALAGES = ['top', 'bottom', 'left', 'right', 'inset']
const ARBITRAIRE = new RegExp(`\\b(?:${DECALAGES.join('|')})(?:-x|-y)?-\\[([^\\]]*)\\]`, 'g')

/** Un `px` qui n'est pas le repli d'un `var()`. */
const PX_NU = new RegExp(`\\d${'px'}\\b`)

/** Fichiers examinés : le JSX livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx$/.test(entree)) return []
    if (/\.test\.tsx$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Les commentaires sont BLANCHIS sur place, pour garder les numéros de ligne.
 *
 * Ce n'est pas un confort : la source qui EXPLIQUE le correctif cite forcément
 * la valeur fautive, et une garde qui lit les commentaires accuse les fichiers
 * les mieux documentés. `rognage.test.ts` a payé cette leçon avant nous.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

/**
 * Le contenu d'un `var()` retiré : ce qui reste est ce qu'on a écrit soi-même.
 *
 * `var(--h, 0px)` ne recopie rien. `calc(65px + env(...))` recopie.
 */
function horsVar(valeur: string): string {
  let precedent = ''
  let courant = valeur
  while (courant !== precedent) {
    precedent = courant
    courant = courant.replace(/var\([^()]*\)/g, ' ')
  }
  return courant
}

/** Les longueurs recopiées d'une source, en `fichier:ligne`. */
export function longueursRecopiees(relatif: string, brut: string): string[] {
  return sansCommentaires(brut)
    .split('\n')
    .flatMap((ligne, i) =>
      [...ligne.matchAll(ARBITRAIRE)].some(([, valeur]) => PX_NU.test(horsVar(valeur)))
        ? [`${relatif}:${i + 1}`]
        : [],
    )
}

/**
 * Les longueurs TOLÉRÉES, nommées et motivées.
 *
 * Aucune aujourd'hui, et c'est le but. La garde du garde plus bas fait rougir
 * une entrée devenue sans objet : une liste d'exceptions qu'on n'élague pas
 * devient le tapis sous lequel on glisse le prochain défaut.
 */
const TOLERES: { fichier: string; ligne: number; raison: string }[] = []

describe('une longueur qu’un autre élément détermine', () => {
  it('n’est jamais recopiée en dur dans une classe', () => {
    const fautives = fichiersSources(SRC).flatMap((chemin) => {
      const relatif = chemin.slice(SRC.length + 1)
      return longueursRecopiees(relatif, readFileSync(chemin, 'utf8')).filter(
        (site) => !TOLERES.some((e) => `${e.fichier}:${e.ligne}` === site),
      )
    })

    expect(fautives).toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel le précédent ne garde rien.
   *
   * Un contrôle qui n'affirme qu'une absence ne distingue pas un dépôt sain
   * d'un détecteur cassé — ce dépôt l'a payé plusieurs fois cette semaine. La
   * règle exercée ici est CELLE du contrôle ci-dessus, jamais une paraphrase.
   */
  it('reconnaît la longueur recopiée, et elle seule', () => {
    const haut = 'top'
    // Le défaut, dans sa forme exacte d'origine.
    expect(longueursRecopiees('t.tsx', `<div className="${haut}-[65px]" />`)).toEqual(['t.tsx:1'])
    // La même enveloppée d'un calcul : recopier reste recopier.
    expect(
      longueursRecopiees('t.tsx', `<div className="${haut}-[calc(65px+env(safe-area-inset-top))]" />`),
    ).toEqual(['t.tsx:1'])
    // Le remède : une propriété que le propriétaire de la mesure publie.
    expect(longueursRecopiees('t.tsx', `<div className="${haut}-[var(--h-entete)]" />`)).toEqual([])
    // Un repli DANS le `var()` ne recopie rien : il dit ce qui vaut sans lui.
    expect(longueursRecopiees('t.tsx', `<div className="${haut}-[var(--h-entete,0px)]" />`)).toEqual([])
    // Une valeur qui ne dépend d'aucun autre élément : l'échelle d'espacement.
    expect(longueursRecopiees('t.tsx', `<div className="${haut}-4" />`)).toEqual([])
    // Une longueur relative n'est pas un pixel relevé à la main.
    expect(longueursRecopiees('t.tsx', `<div className="${haut}-[1.25rem]" />`)).toEqual([])
    // Et dans un commentaire, jamais : c'est le faux positif qui condamnerait
    // la source expliquant le correctif.
    expect(longueursRecopiees('t.tsx', `/* ${haut}-[65px] */\n<div />`)).toEqual([])
  })

  /** Une tolérance qui ne couvre plus rien est une tolérance qui ment. */
  it('ne garde aucune tolérance devenue sans objet', () => {
    const orphelines = TOLERES.filter((e) => {
      const sites = longueursRecopiees(e.fichier, readFileSync(join(SRC, e.fichier), 'utf8'))
      return !sites.includes(`${e.fichier}:${e.ligne}`)
    }).map((e) => `${e.fichier}:${e.ligne}`)

    expect(orphelines).toEqual([])
  })
})
