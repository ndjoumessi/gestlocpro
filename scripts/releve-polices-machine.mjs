/**
 * CE QUE LA MACHINE MET DERRIÈRE `system-ui` — et ce que ça coûte en pixels.
 *
 * CE N'EST PAS UNE PORTE. Rien ici ne refuse ; ce fichier MESURE et imprime, et
 * il est fait pour être lancé sur DEUX machines et comparé.
 *
 * ═══ LA QUESTION ═══
 *
 * `scripts/mesure-ui.mjs` a rougi sur un exécuteur Ubuntu là où la machine de
 * développement est verte : cinq signatures de débordement local, jusqu'à
 * +88 px, dont deux aggravations de tolérances existantes. Tout le reste de la
 * porte a passé — contraste, cibles, noms accessibles, surfaces.
 *
 * Cette dissymétrie est l'indice. Le contraste ne dépend pas de la LARGEUR d'un
 * texte ; le débordement local ne dépend que d'elle. Et `--font-sans` vaut
 * `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
 * sans-serif` — une pile dont le PREMIER terme désigne un dessin différent sur
 * chaque système.
 *
 * Le dépôt annonçait exactement ce moment sans pouvoir le vérifier : « la marge
 * de 4 px est une prudence NON MESURÉE ; sur cette machine deux exécutions
 * rendent des maxima identiques au pixel ; une autre machine, avec d'autres
 * métriques de police, n'a pas été essayée ».
 *
 * ═══ CE QU'ON MESURE, ET POURQUOI CES CHAÎNES-LÀ ═══
 *
 * Les libellés qui figurent NOMMÉMENT dans les cinq refus, plus deux témoins.
 * Mesurer une phrase quelconque dirait que les polices diffèrent ; mesurer
 * celles-ci dit de combien, là où ça déborde.
 *
 * ON MESURE AUSSI CHAQUE REPLI SÉPARÉMENT. Comparer la seule pile ne dit pas
 * QUEL dessin la machine a choisi ; comparer la pile à chacun de ses termes le
 * dit — celui dont la largeur coïncide est celui qui sert.
 *
 * ═══ CE QUE CE RELEVÉ NE DIT PAS ═══
 *
 * Si le produit est cassé. Une police plus large peut déborder d'une boîte sans
 * que personne ne le voie — c'est `mesure-ui` qui tranche cela, et il le fait
 * déjà. Ici on répond à une seule question : les deux machines rendent-elles le
 * même texte à la même largeur.
 */
import { chromium } from 'playwright'

/** Les chaînes nommées dans les refus, plus deux témoins. */
const CHAINES = [
  'Create my spaceSee the dashboard',
  'Créer mon espaceVoir le tableau de bord',
  '1 397 000 FCFA',
  'Reprenez votre parc en main',
  'ReturnedUndo arbitration',
  'Export as spreadsheet',
]

/** La pile du produit, puis chacun de ses termes isolé. */
const PILE = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const TERMES = [
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
  'DejaVu Sans',
  'Liberation Sans',
]

const navigateur = await chromium.launch()
const page = await (await navigateur.newContext()).newPage()
await page.setContent('<!doctype html><meta charset="utf-8"><body></body>')

const releve = await page.evaluate(
  ({ chaines, pile, termes }) => {
    const MOTS_CLES = new Set(['system-ui', '-apple-system', 'sans-serif', 'serif', 'monospace'])
    const mesure = (texte, famille, taille = 16) => {
      const boite = document.createElement('span')
      boite.style.cssText = `position:absolute;white-space:pre;font:${taille}px ${famille}`
      boite.textContent = texte
      document.body.append(boite)
      const largeur = boite.getBoundingClientRect().width
      boite.remove()
      return Math.round(largeur * 100) / 100
    }
    return {
      plateforme: navigator.platform,
      agent: navigator.userAgent.slice(0, 90),
      pile: chaines.map((texte) => ({ texte, largeur: mesure(texte, pile) })),
      /* Le même mot dans chaque famille : celle dont la largeur égale celle de
         la pile est celle que le système a choisie. */
      familles: termes.map((famille) => ({
        famille,
        /* LES MOTS-CLES NE SE GUILLEMETENT PAS. `system-ui`, `-apple-system` et
           `sans-serif` sont des MOTS-CLES CSS ; entre guillemets ils deviennent
           des noms de famille ordinaires, que rien ne resout, et la ligne rend
           la largeur du repli par defaut au lieu de celle qu'on interroge.
           Mesure : `"sans-serif"` rendait 114,61 px sur les deux machines, la
           meme valeur que toutes les familles absentes — un nombre qui ne dit
           rien. Seuls les noms propres portent des guillemets. */
        largeur: mesure('Créer mon espace', MOTS_CLES.has(famille) ? famille : `"${famille}"`),
      })),
      pileSurLeTemoin: mesure('Créer mon espace', pile),
    }
  },
  { chaines: CHAINES, pile: PILE, termes: TERMES },
)
await navigateur.close()

console.log(`\n=== RELEVÉ DES POLICES — ${releve.plateforme}`)
console.log(`    ${releve.agent}\n`)
console.log('  Largeur des chaînes qui figurent dans les refus, pile du produit, 16 px :')
for (const { texte, largeur } of releve.pile) {
  console.log(`    ${String(largeur).padStart(8)} px   « ${texte} »`)
}
console.log(`\n  « Créer mon espace » par famille — la pile rend ${releve.pileSurLeTemoin} px :`)
for (const { famille, largeur } of releve.familles) {
  const marque = Math.abs(largeur - releve.pileSurLeTemoin) < 0.01 ? '  ← c’est celle-ci' : ''
  console.log(`    ${String(largeur).padStart(8)} px   ${famille}${marque}`)
}
console.log()
