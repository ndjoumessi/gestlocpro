import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LA POLICE DES TITRES VIENT DU PRODUIT, PAS D'UN TIERS AVANT LA PREMIÈRE PEINTURE.
 *
 * `index.html` chargeait Plus Jakarta Sans par une feuille de style de
 * `fonts.googleapis.com` : DNS, TLS et CSS d'une autre origine AVANT que le
 * navigateur ne sache quel woff2 demander — puis un second aller-retour vers
 * `fonts.gstatic.com`. Sur le réseau du marché visé, chaque aller-retour tiers
 * avant la première peinture se paie, et l'agent de service ne rangeait rien de
 * tout cela : hors ligne, les titres retombaient sur le repli.
 *
 * Le fichier vit désormais dans `public/polices/`, un seul sous-ensemble (latin,
 * 27 Ko), préchargé depuis `index.html`, déclaré dans `tokens.css` avec
 * `font-display: swap`, et doublé d'une face de REPLI ajustée : `size-adjust`
 * mesuré au canvas (Plus Jakarta Sans est 1,7 % plus large qu'Arial et
 * Helvetica Neue), pour que le texte ne saute pas quand la vraie police arrive.
 *
 * Nelson a accepté le 2026-09-07 que `poids-ecrans` compte ces 27 Ko : ils
 * étaient déjà payés depuis Google, seulement pas comptés.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', '..')
const PAGE = readFileSync(join(RACINE, 'index.html'), 'utf8')
// Sans ses commentaires : la prose d'`index.html` a le droit de nommer l'origine
// qu'elle explique avoir quittée ; c'est le balisage qui ne doit plus la servir.
const BALISAGE = PAGE.replace(/<!--[\s\S]*?-->/g, '')
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const AGENT = readFileSync(join(RACINE, 'public', 'sw.js'), 'utf8')

const PRELOAD = /<link[^>]*rel="preload"[^>]*href="(\/polices\/[^"]+\.woff2)"[^>]*>/.exec(BALISAGE)
const FICHIER = PRELOAD?.[1] ?? ''

describe('la police des titres', () => {
  it('n’est plus demandée à Google, ni en feuille de style ni en préconnexion', () => {
    expect(BALISAGE).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
  })

  it('est préchargée depuis le produit, et le fichier existe', () => {
    expect(PRELOAD, 'un <link rel="preload" as="font"> vers /polices/').not.toBeNull()
    expect(PRELOAD![0]).toMatch(/as="font"/)
    expect(PRELOAD![0]).toMatch(/type="font\/woff2"/)
    // `crossorigin` même en première partie : sans lui, le préchargement et la
    // requête de la police n'ont pas le même mode, et le fichier part deux fois.
    expect(PRELOAD![0]).toMatch(/\bcrossorigin\b/)
    const chemin = join(RACINE, 'public', FICHIER)
    expect(existsSync(chemin), `${FICHIER} manque dans public/`).toBe(true)
    expect(statSync(chemin).size).toBeGreaterThan(10_000)
    expect(readFileSync(chemin).subarray(0, 4).toString('latin1')).toBe('wOF2')
  })

  it('porte sa version dans son nom, parce que le serveur la déclare immuable', () => {
    /* `server/src/app.ts` sert `/polices/` avec `immutable` et un an de cache :
       le navigateur ne redemande JAMAIS un nom qu'il a déjà. Un fichier
       resubdivisé sous le même nom resterait périmé un an chez qui l'a vu.
       Née verte — le nom portait déjà `v12` — ; elle attrape le renommage. */
    expect(FICHIER).toMatch(/-v\d+-/)
  })

  it('est déclarée dans tokens.css sur ce même fichier, avec swap et sa plage de graisses', () => {
    const face = /@font-face\s*\{[^}]*font-family:\s*'Plus Jakarta Sans'[^}]*\}/.exec(CSS)?.[0] ?? ''
    expect(face, '@font-face de Plus Jakarta Sans').not.toBe('')
    expect(face).toContain(`url('${FICHIER}')`)
    expect(face).toMatch(/font-display:\s*swap/)
    expect(face).toMatch(/font-weight:\s*600 800/)
  })

  it('a un repli ajusté, mesuré, dans la pile avant le système', () => {
    const repli = /@font-face\s*\{[^}]*font-family:\s*'Plus Jakarta Sans Repli'[^}]*\}/.exec(CSS)?.[0] ?? ''
    expect(repli, 'la face de repli').not.toBe('')
    expect(repli).toMatch(/size-adjust:\s*\d+(\.\d+)?%/)
    expect(repli).toMatch(/local\(/)
    expect(CSS).toMatch(/--font-display:\s*\n?\s*'Plus Jakarta Sans',\s*'Plus Jakarta Sans Repli'/)
  })

  it('est rangée par l’agent de service, comme un actif', () => {
    expect(AGENT).toMatch(/\/polices\//)
  })
})
