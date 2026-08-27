import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LE FAVICON ET LA MARQUE SONT LE MÊME SIGNE, DANS DEUX FICHIERS.
 *
 * `public/logo.svg` est servi comme une ressource STATIQUE : il ne passe pas par
 * la feuille de style et ne peut donc pas lire `--color-accent`. Ses couleurs
 * sont écrites en clair, et c'est le seul endroit du dépôt où c'est justifié.
 *
 * Le prix est une TRIPLICATION : le signe vit dans `Logo.tsx`, ses couleurs dans
 * `tokens.css`, et le favicon recopie les deux. Rien ne les relie, rien ne
 * rougit si l'un bouge — c'est exactement la forme du défaut que ce fichier
 * remplace : le favicon peignait encore l'or `#C58E3E` plusieurs teintes après
 * son retrait, et il était le DERNIER endroit du dépôt où cet or existait
 * ailleurs que dans un commentaire.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * Que les couleurs du favicon soient celles des jetons, et que son signe soit
 * celui du composant — quatre carrés, mêmes opacités, dans le même ordre. Ce
 * sont les deux façons dont ces fichiers peuvent diverger sans que rien ne se
 * casse : une marque redessinée d'un côté, un accent déplacé de l'autre.
 *
 * ═══ CE QU'ILS NE TIENNENT PAS ═══
 *
 * La géométrie. Que les carrés soient à la bonne place et à la bonne taille se
 * lit à l'œil, pas ici : comparer des nombres entre deux systèmes de coordonnées
 * — 24 unités dans le composant, 32 dans le favicon — reviendrait à réécrire la
 * conversion dans le test, donc à la vérifier contre elle-même.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', '..')

const favicon = readFileSync(join(RACINE, 'public', 'logo.svg'), 'utf8')
const marque = readFileSync(join(RACINE, 'src', 'components', 'primitives', 'Logo.tsx'), 'utf8')
const jetons = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/** Les commentaires ont le droit de citer les couleurs qu'ils racontent. */
const sansCommentaires = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

/** La valeur d'un jeton, lue dans le bloc clair — le premier du fichier. */
function jeton(nom: string): string {
  const trouve = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{3,8})`).exec(jetons)
  expect(trouve, `le jeton --color-${nom} est introuvable`).not.toBeNull()
  return trouve![1]!.toLowerCase()
}

/**
 * Les opacités des carrés, dans l'ordre du document — `1` quand l'attribut est
 * absent, ce qui est sa valeur par défaut.
 *
 * ON EXTRAIT LA BALISE D'ABORD, L'ATTRIBUT ENSUITE, et une garde du garde l'a
 * imposé. La première rédaction cherchait les deux d'un coup —
 * `/<rect[^>]*?(?:opacity="([^"]*)")?[^>]*\/>/` — dont le groupe OPTIONNEL est
 * précédé d'un quantificateur paresseux : le moteur le saute systématiquement et
 * laisse `[^>]*` avaler l'attribut. Toutes les opacités rendaient `1`, les deux
 * premiers cas comparaient une liste uniforme à une autre et passaient au vert.
 * C'est le troisième cas, qui exige que les valeurs DIFFÈRENT, qui l'a dit.
 */
function opacites(source: string): string[] {
  return [...sansCommentaires(source).matchAll(/<rect\b[^>]*>/g)].map((balise) => {
    const trouve = /opacity="([^"]*)"/.exec(balise[0])
    return trouve ? trouve[1]! : '1'
  })
}

describe('le favicon', () => {
  it('peint l’accent des jetons, et rien d’autre', () => {
    const propre = sansCommentaires(favicon)
    const couleurs = [...propre.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) =>
      m[1]!.toLowerCase(),
    )

    expect(couleurs, 'le favicon ne peint plus rien').not.toHaveLength(0)
    expect(new Set(couleurs)).toEqual(new Set([jeton('accent'), jeton('on-accent')]))
  })

  it('porte le même signe que la marque de l’application', () => {
    /* Le fond du favicon est un `<rect>` de plus : le composant, lui, tient ce
       fond dans une classe. On compare donc les QUATRE derniers. */
    const duFavicon = opacites(favicon).slice(-4)
    const duComposant = opacites(marque).slice(-4)

    expect(duComposant, 'la marque du composant ne rend plus quatre carrés').toHaveLength(4)
    expect(duFavicon, 'le favicon ne rend plus quatre carrés').toHaveLength(4)
    expect(duFavicon).toEqual(duComposant)
  })

  /*
    GARDE DU GARDE — les opacités doivent DIRE quelque chose.

    Si les quatre valaient 1, les deux cas ci-dessus passeraient au vert en
    comparant une liste uniforme à une autre. Or c'est la décroissance qui porte
    la moitié du sens du signe — « états différents ». Un signe qui ne dit plus
    que « plusieurs logements » n'est pas celui qui a été retenu.
  */
  it('garde des états distincts, sans quoi la comparaison ne compare rien', () => {
    expect(new Set(opacites(favicon).slice(-4)).size).toBeGreaterThan(1)
  })
})
