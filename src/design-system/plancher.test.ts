import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du plancher typographique.
 *
 * `tokens.css` annonçait 12px comme plancher, puis définissait trois lignes
 * plus bas `--text-caps: 0.6875rem`, soit 11. Le jeton n'était pas un
 * cas isolé : il portait les en-têtes de colonne de `DataTable`, les pastilles
 * de statut compactes, les compteurs de `Badge` et tous les surtitres — une
 * centaine d'emplois, c'est-à-dire l'essentiel des libellés d'exploitation.
 * Le plancher annoncé ne tenait donc nulle part où il comptait vraiment.
 *
 * Un commentaire ne défend pas une règle : celui-ci était juste, et le
 * démenti vivait dans son champ de vision immédiat sans que personne le voie.
 * Ce qui défend la règle, c'est un test qui relit le fichier.
 *
 * Le contrôle porte sur les SOURCES et non sur le DOM. jsdom ne résout ni
 * `clamp()` ni les couches en cascade ; monter un composant et interroger sa
 * taille rendue mesurerait jsdom, pas le produit. Le fichier est la source de
 * vérité, c'est le fichier qu'on interroge.
 *
 * Deux fuites possibles, donc deux gardes :
 *  1. le jeton lui-même, qu'on abaisse « juste pour ce cas » ;
 *  2. la taille arbitraire — `text-[10px]` — qui contourne les jetons sans
 *     jamais toucher à `tokens.css`. C'est par là que le 11px était revenu
 *     dans `Logo.tsx`, sur la légende du parc affichée dans la barre latérale.
 */

const DESIGN_SYSTEM = dirname(fileURLToPath(import.meta.url))
const SRC = join(DESIGN_SYSTEM, '..')
const TOKENS = join(DESIGN_SYSTEM, 'tokens.css')

/** 12px : sous cette taille, un libellé en capitales ne se lit plus au soleil. */
const PLANCHER_PX = 12

/** Convertit une longueur CSS en pixels. `null` si l'unité n'est pas absolue. */
function enPixels(longueur: string): number | null {
  const rem = /^(-?[\d.]+)rem$/.exec(longueur.trim())
  if (rem) return Number(rem[1]) * 16
  const px = /^(-?[\d.]+)px$/.exec(longueur.trim())
  if (px) return Number(px[1])
  return null
}

/**
 * Taille MINIMALE que peut rendre une valeur de jeton.
 *
 * Pour `clamp(a, b, c)`, c'est `a` — jamais `b`, qui n'est que la pente et
 * peut légitimement descendre plus bas sans jamais s'afficher. Retenir le plus
 * petit nombre de l'expression condamnerait des échelles fluides parfaitement
 * saines.
 */
function plancherDeLaValeur(valeur: string): number | null {
  const clamp = /^clamp\(([^,]+),/.exec(valeur.trim())
  return enPixels(clamp ? clamp[1] : valeur)
}

/** Fichiers de source examinés : le code livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.(tsx?|css)$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

describe('plancher typographique', () => {
  it('n’est franchi par aucun jeton `--text-*` de tokens.css', () => {
    const css = readFileSync(TOKENS, 'utf8')
    const fautifs: string[] = []

    for (const [, nom, valeur] of css.matchAll(/(--text-[a-z0-9-]+):\s*([^;]+);/g)) {
      // `--text-display-xl--line-height` et `--letter-spacing` accompagnent un
      // jeton sans être des tailles : leurs valeurs se lisent en ratios et en
      // `em`, que ce plancher ne concerne pas.
      if (nom.slice('--text-'.length).includes('--')) continue

      const taille = plancherDeLaValeur(valeur)
      if (taille !== null && taille < PLANCHER_PX) {
        fautifs.push(`${nom}: ${valeur.trim()} → ${taille}px`)
      }
    }

    expect(fautifs).toEqual([])
  })

  it('n’est contourné par aucune taille arbitraire dans les sources', () => {
    const fautifs: string[] = []

    for (const chemin of fichiersSources(SRC)) {
      const code = readFileSync(chemin, 'utf8')
      // `text-[10px]` et ses variantes (`sm:text-[0.6rem]`, `text-[11px]/1.2`).
      for (const [, longueur] of code.matchAll(/\btext-\[(-?[\d.]+(?:px|rem))\]/g)) {
        const taille = enPixels(longueur)
        if (taille !== null && taille < PLANCHER_PX) {
          fautifs.push(`${chemin.slice(SRC.length + 1)} → text-[${longueur}]`)
        }
      }
    }

    expect(fautifs).toEqual([])
  })
})
