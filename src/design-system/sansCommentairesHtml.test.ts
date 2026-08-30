import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sansCommentairesHtml } from '../../scripts/sansCommentairesHtml.mjs'

/**
 * LA PROSE D'`index.html` RESTE DANS LA SOURCE, ELLE NE PART PAS SUR LE FIL.
 *
 * Le raisonnement complet — et les octets — vivent dans l'en-tête de
 * `scripts/sansCommentairesHtml.mjs`. Ce fichier-ci garde les deux propriétés
 * qu'un retrait de commentaires peut casser, et une seule d'entre elles est
 * évidente.
 *
 * ═══ LA SECONDE EST CELLE QUI COMPTE ═══
 *
 * Un `-->` écrit dans une chaîne de caractères, à l'intérieur d'un `<script>`,
 * n'est pas la fin d'un commentaire. Un retrait naïf coupe alors le script en
 * deux et emporte du code — silencieusement, puisque la page se charge quand
 * même et que seul le comportement manque. Aucun bloc en ligne d'`index.html`
 * n'en porte AUJOURD'HUI ; ce cas existe pour que ce soit encore vrai demain.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('le retrait des commentaires HTML', () => {
  it('retire la prose', () => {
    const rendu = sansCommentairesHtml('<p>a</p><!-- un commentaire --><p>b</p>')
    expect(rendu).toBe('<p>a</p><p>b</p>')
  })

  it('ne touche pas à ce qui vit dans un script', () => {
    const source = `<script>const s = "-->"; /* <!-- */ const t = 1</script>`
    expect(sansCommentairesHtml(source)).toBe(source)
  })

  it('ne touche pas à ce qui vit dans une feuille de style', () => {
    const source = `<style>.a::after { content: "<!-- -->" }</style>`
    expect(sansCommentairesHtml(source)).toBe(source)
  })

  it('préserve un commentaire conditionnel, qui est une instruction', () => {
    const source = '<!--[if IE]><p>vieux</p><![endif]-->'
    expect(sansCommentairesHtml(source)).toBe(source)
  })

  /**
   * LA GARDE DU GARDE, et elle a une raison précise : ce greffon ne s'applique
   * qu'à la CONSTRUCTION. Une suite qui ne vérifierait que la fonction pourrait
   * rester verte pendant que `vite.config.ts` a cessé de l'appeler — le retrait
   * marcherait parfaitement, et ne servirait plus.
   */
  it('est bien branché dans la construction', () => {
    const config = readFileSync(join(RACINE, 'vite.config.ts'), 'utf8')
    expect(config, '`vite.config.ts` n’importe plus le greffon').toContain(
      'retirerLesCommentairesHtml',
    )
    expect(
      /plugins:\s*\[[^\]]*retirerLesCommentairesHtml\(\)/.test(config),
      'le greffon est importé mais absent de la liste `plugins`',
    ).toBe(true)
  })

  /**
   * CE QUE ÇA REND, SUR LE VRAI FICHIER — et pourquoi c'est mesuré ici plutôt
   * qu'écrit dans un commentaire.
   *
   * Un nombre gravé dans une prose se périme sans bruit. Celui-ci se recalcule à
   * chaque exécution sur `index.html` tel qu'il est, et le plancher refuse le
   * jour où quelqu'un viderait le fichier de sa prose en croyant l'alléger : la
   * prose est ce qu'on garde, c'est son VOYAGE qu'on supprime.
   */
  it('rend plus de la moitié du fichier', () => {
    const page = readFileSync(join(RACINE, 'index.html'), 'utf8')
    const rendu = sansCommentairesHtml(page)
    const part = 1 - rendu.length / page.length
    expect(part, `les commentaires ne pèsent que ${Math.round(part * 100)} % du fichier`).
      toBeGreaterThan(0.5)
  })
})
