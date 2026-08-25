import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUN BUDGET D'HORLOGE DANS LE HARNAIS, LÀ OÙ UNE PROMESSE EST DISPONIBLE.
 *
 * ── Le défaut, et sa forme exacte ──────────────────────────────────────────
 *
 * `renderApp` attendait la DISPARITION du repli de chargement par
 * `waitForElementToBeRemoved`, dont le budget par défaut vaut mille
 * millisecondes. Ce n'est pas une attente, c'est une COURSE entre la machine
 * et une horloge : elle tient au repos et tombe sous charge — deux portes de
 * front, une intégration continue, un portable qui compile.
 *
 * Mesuré, sans aucune charge, en ramenant simplement le budget à 1 ms sur le
 * fichier d'avant ce lot : 27 tests sur 31 échouent — 9/10 dans
 * `clavierDesModales`, 16/16 dans `origineDesTravaux`, 1/5 dans
 * `documentTitle`. Un budget se prouve en le rétrécissant, pas en ralentissant
 * la machine ; c'est la même transformation que la RETENUE de réponse du lot
 * `registreDesAcces` — rendre déterministe ce qui était probabiliste — mais
 * appliquée au temps plutôt qu'à la réponse.
 *
 * ── Pourquoi une règle de source, et pas seulement le correctif ────────────
 *
 * Le correctif d'un site ne protège pas la classe, et ce harnais avait déjà la
 * bonne technique SOUS LES YEUX : `attendreLaLangue`, vingt lignes plus bas,
 * attend la promesse partagée `chargerAnglais()` depuis toujours. Les deux
 * frontières paresseuses du produit étaient traitées différemment dans le même
 * fichier, et c'est la mauvaise des deux qui servait de modèle. Le prochain
 * ajout au harnais copiera le voisin le plus proche : il faut donc que le
 * mauvais voisin cesse d'être écrivable.
 *
 * ── Ce que cette règle NE VOIT PAS, dit plutôt que tu ──────────────────────
 *
 * 1. Elle ne lit que le HARNAIS — `src/test/*.ts(x)` hors fichiers de cas. Les
 *    quelque 120 fichiers de cas emploient `waitFor` légitimement, et le leur
 *    interdire reviendrait à interdire d'observer un écran qui change.
 * 2. Elle ne sait pas si une promesse partagée EXISTE pour un point donné.
 *    C'est un jugement humain : la règle exige qu'un budget soit motivé par
 *    écrit, elle ne peut pas dire que le motif est bon.
 * 3. Elle lit le texte, pas le comportement. Un budget bâti à l'exécution —
 *    une constante calculée, une option passée depuis un appelant — lui
 *    échappe. On ne l'a pas cherché : il aurait fallu suivre les appels, donc
 *    deviner l'intention, et un contrôle qui devine accuse à tort.
 */

const ICI = dirname(fileURLToPath(import.meta.url))

/**
 * Les budgets TOLÉRÉS — par FICHIER, par MOTIF, et par NOMBRE.
 *
 * Sur le modèle des `EXEMPTIONS` de `cibles.test.ts` : une dérogation se nomme,
 * se motive, et meurt avec le défaut qu'elle couvrait — la garde du garde plus
 * bas fait rougir toute entrée devenue orpheline.
 *
 * LA GRANULARITÉ EST LE FOND, et elle a été trouvée par le témoin de ce lot.
 * Une première rédaction exemptait le FICHIER : `render.tsx` portant un budget
 * motivé, tout autre budget du même fichier passait avec lui. Rejouée sur le
 * `render.tsx` D'AVANT ce lot, cette garde restait VERTE devant le défaut même
 * qu'elle est censée interdire — une garde qui absout ce qu'elle poursuit.
 * L'exemption porte donc sur un motif ET un compte : un `waitForElementToBeRemoved`
 * ne s'abrite pas derrière un `timeout:` motivé, et un SECOND `timeout:` ne
 * s'abrite pas derrière le premier.
 */
const BUDGETS_MOTIVES: Record<string, Record<string, { nombre: number; raison: string }>> = {
  'render.tsx': {
    'timeout:': {
      nombre: 1,
      raison: [
        "`attendreLeChargement` guette `aria-busy`, que lève la RETENUE DÉLIBÉRÉE de",
        'la démonstration — `ATTENTE_DEMO_MS`, 900 ms, une décision produit écrite dans',
        "`PortfolioProvider` pour que les squelettes soient observables sans compte. Ce",
        'budget-ci court donc après un minuteur du PRODUIT, pas après une promesse : il',
        "n'existe aucune promesse partagée à attendre à sa place tant que la retenue",
        'reste un `setTimeout`. Neutraliser la retenue depuis le harnais est possible et',
        "se discute — le prix serait que les tests cessent d'exercer le chemin du",
        'squelette, que plusieurs gardes de ce dépôt vérifient. Non tranché ici.',
      ].join(' '),
    },
  },
}

/** Les fichiers du HARNAIS : `src/test/*.ts(x)` qui ne sont pas des cas. */
function fichiersDuHarnais(): string[] {
  return readdirSync(ICI)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.includes('.test.'))
}

/**
 * Le texte débarrassé de ses commentaires.
 *
 * Sans quoi cette garde accuserait la DOCUMENTATION du défaut qu'elle protège :
 * `render.tsx` nomme `waitForElementToBeRemoved` deux fois pour expliquer
 * pourquoi il ne l'emploie plus.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/**
 * Ce qui fait dépendre une attente de l'horloge plutôt que d'un signal.
 *
 * `setTimeout(…, 0)` N'EN EST PAS UN, et la distinction est le cœur de la
 * règle : un budget est un délai qui peut EXPIRER, donc échouer. Un `0` ne
 * mesure rien — il cède le tour de boucle et revient toujours. `downloads.ts`
 * en emploie un pour laisser passer une révocation différée, et l'accuser
 * aurait été le premier faux positif de cette garde : une règle qui accuse à
 * tort est une règle qu'on désactive.
 */
const MOTIFS: { nom: string; motif: RegExp }[] = [
  { nom: 'timeout:', motif: /\btimeout\s*:/ },
  { nom: 'waitForElementToBeRemoved', motif: /\bwaitForElementToBeRemoved\s*\(/ },
  /* L'espace vit DANS la négation : écrit `,\s*(?!0…)`, le moteur ramène `\s*`
     à zéro caractère, la négation examine « ␣0) » au lieu de « 0) » et réussit
     toujours. La règle accusait alors le `setTimeout(resolve, 0)` qu'elle est
     précisément censée absoudre. */
  /* Borné à `[^()\n]` et non à `[^;]` : le dépôt s'écrit SANS point-virgule,
     donc une classe qui n'exclut que lui court sur tout le reste du fichier et
     finit par trouver, plus bas, une virgule sans `0` derrière. La première
     rédaction accusait ainsi `downloads.ts` en avalant quatre lignes. */
  { nom: 'setTimeout non nul', motif: /\bsetTimeout\s*\([^()\n]*,(?!\s*0\s*\))[^()\n]*\)/ },
]

describe("budgets d'horloge dans le harnais", () => {
  it('aucun, hors ceux qui portent une raison écrite', () => {
    const fichiers = fichiersDuHarnais()

    /*
      GARDE DU GARDE. Un balayage qui ne lit aucun fichier rend « aucun budget »
      — le même silence qu'un harnais sain. C'est la panne que `contrast-audit`
      s'est vu reprocher, et que `mesure-ui` referme par un plancher.
    */
    expect(fichiers.length).toBeGreaterThanOrEqual(4)

    const fautifs: string[] = []
    for (const fichier of fichiers) {
      const source = sansCommentaires(readFileSync(join(ICI, fichier), 'utf8'))
      for (const { nom, motif } of MOTIFS) {
        const trouves = [...source.matchAll(new RegExp(motif, 'g'))].length
        const permis = BUDGETS_MOTIVES[fichier]?.[nom]?.nombre ?? 0
        if (trouves > permis) {
          fautifs.push(`${fichier} — ${nom} × ${trouves}, ${permis} motivé(s)`)
        }
      }
    }

    expect(
      fautifs,
      "Un budget d'horloge dans le harnais est une COURSE avec la machine, pas une\n" +
        "attente. Attendez la promesse que la frontière expose — voir `chargerAnglais`\n" +
        'et `chargerEspaceApplicatif`. Si aucune promesse ne peut convenir, motivez le\n' +
        'budget par écrit dans `BUDGETS_MOTIVES`.',
    ).toEqual([])
  })

  it('aucune raison écrite ne couvre plus rien', () => {
    const orphelines: string[] = []
    for (const [fichier, parMotif] of Object.entries(BUDGETS_MOTIVES)) {
      const source = sansCommentaires(readFileSync(join(ICI, fichier), 'utf8'))
      for (const [nom, { nombre }] of Object.entries(parMotif)) {
        const motif = MOTIFS.find((m) => m.nom === nom)?.motif
        const trouves = motif ? [...source.matchAll(new RegExp(motif, 'g'))].length : 0
        /* STRICTEMENT moins : une dérogation pour deux budgets dont il ne reste
           qu'un couvre désormais du vide pour moitié, et ce vide se remplirait
           en silence au prochain ajout. */
        if (trouves < nombre) orphelines.push(`${fichier} — ${nom} : ${nombre} motivé(s), ${trouves} trouvé(s)`)
      }
    }

    expect(
      orphelines,
      'Une dérogation qui ne couvre plus rien doit mourir avec le défaut qu’elle\n' +
        'couvrait, sans quoi elle rouvre la porte en silence.',
    ).toEqual([])
  })
})
