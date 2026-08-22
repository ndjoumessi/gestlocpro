import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * QUI OBSERVE UNE ATTENTE DOIT LA TENIR.
 *
 * ── Le défaut, et pourquoi il n'était pas visible ──────────────────────────
 *
 * `renderApp` est devenue asynchrone au découpage paresseux (`85e12e0`) : elle
 * attend la résolution de la frontière `Suspense` de `/app`, c'est-à-dire
 * l'instant EXACT où l'écran se monte et lance son `fetch`. Un cas qui assertait
 * ensuite « le squelette est là » n'assertait plus une propriété de l'écran mais
 * l'ORDRE D'ARRIVÉE de deux chaînes asynchrones parties ensemble.
 *
 * Mesuré : 3 échecs sur 40 passages du fichier seul, 3 sur 20 de la suite
 * complète, zéro sur 40 au commit d'avant le découpage.
 *
 * ── Pourquoi une règle de SOURCE, et pourquoi celle-ci ─────────────────────
 *
 * Le correctif d'un site ne protège pas la classe. Le prochain écran qui
 * annoncera son attente aura son cas écrit sur le modèle du plus proche, et si
 * ce modèle parie, le pari se propage. Un défaut intermittent ne s'attrape pas
 * par une exécution : il faut le rendre IMPOSSIBLE À ÉCRIRE, ce qui est le
 * terrain d'un contrôle de source — le même parti que `couches.test.ts` ou
 * `zonesSures.test.ts`, qui lisent les fichiers plutôt que le DOM.
 *
 * ON N'INTERDIT PAS D'OBSERVER L'ATTENTE — c'est une propriété d'accessibilité
 * qui mérite d'être tenue, et trois écrans la tiennent. On exige que le cas qui
 * l'observe MAÎTRISE le moment : soit en retenant la réponse (`retenir`, sans
 * horloge), soit en la ralentissant (`ralentir…`, qui parie sur une horloge —
 * accepté ici parce qu'il contrôle bel et bien l'ordre, et signalé comme le
 * plus faible des deux dans le commentaire de `barrages`).
 *
 * ── Ce que la règle NE PEUT PAS voir, dit plutôt que tu ────────────────────
 *
 * Elle raisonne sur un cas entier, délimité par `it(`. Une observation d'attente
 * cachée dans une fonction utilitaire appelée par le cas lui échapperait. On
 * n'a pas cherché à la rattraper : il aurait fallu suivre les appels, donc
 * deviner l'intention, et un contrôle qui devine accuse à tort — ce que ce
 * dépôt reproche déjà à une première rédaction trop large de `check-orphelins`.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

function fichiersDeTest(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersDeTest(chemin)
    return /\.test\.tsx?$/.test(entree) ? [chemin] : []
  })
}

/**
 * Les cas d'un fichier, découpés sur `it(`.
 *
 * Le découpage est grossier À DESSEIN : il suffit à rattacher une assertion au
 * cas qui la porte, et n'importe quoi de plus fin — analyser la syntaxe — ferait
 * dépendre une garde de test d'un analyseur qu'il faudrait garder à son tour.
 */
function cas(source: string): { titre: string; corps: string }[] {
  const morceaux = source.split(/\bit\(/).slice(1)
  return morceaux.map((corps) => ({
    titre: /^\s*[`'"](.*?)[`'"]/.exec(corps)?.[1] ?? '(sans titre)',
    corps,
  }))
}

/**
 * Le cas assure-t-il qu'une région d'attente est PRÉSENTE ?
 *
 * Les deux formes employées dans le dépôt, et elles seules : le sélecteur
 * `[aria-busy="true"]` qu'on exige non nul, et l'attribut `aria-busy` qu'on
 * exige à `true` sur une région. L'assertion INVERSE — la région a disparu —
 * n'est pas concernée : attendre une disparition est ce que `waitFor` et
 * `attendreLeChargement` savent faire sans rien parier.
 */
const OBSERVE_UNE_ATTENTE =
  /aria-busy="true"\]'\)\s*\)\s*\.not\.toBeNull|toHaveAttribute\(\s*'aria-busy',\s*'true'\s*\)/

/** Les deux façons de MAÎTRISER le moment. Voir l'en-tête. */
const MAITRISE = /\.retenir\(|ralentir[A-ZÀ-Ý]/

describe('les attentes observées sont tenues, jamais pariées', () => {
  const fichiers = fichiersDeTest(SRC)

  const observations = fichiers.flatMap((chemin) =>
    cas(readFileSync(chemin, 'utf8'))
      .filter((c) => OBSERVE_UNE_ATTENTE.test(c.corps))
      .map((c) => ({ fichier: chemin.slice(SRC.length + 1), ...c })),
  )

  it('le motif trouve bien des observations d’attente à examiner', () => {
    /*
      GARDE DU GARDE. Une règle qui ne trouve rien valide tout : si la façon
      d'asserter une attente changeait — un utilitaire dédié, un autre attribut
      — `OBSERVE_UNE_ATTENTE` cesserait de reconnaître quoi que ce soit et cette
      porte passerait au vert en n'ayant lu aucun cas. Trois écrans annoncent
      aujourd'hui leur attente ; on en exige deux, pour ne pas rougir le jour où
      l'un d'eux disparaît légitimement.
    */
    expect(observations.length).toBeGreaterThanOrEqual(2)
  })

  it('chaque cas qui observe une attente en maîtrise le moment', () => {
    const paris = observations
      .filter((o) => !MAITRISE.test(o.corps))
      .map((o) => `${o.fichier} · « ${o.titre} »`)

    expect(
      paris,
      'cas qui assertent la présence d’une attente sans retenir ni ralentir la réponse',
    ).toEqual([])
  })
})
