import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUNE MODALE N'ÉCHAPPE AUX DEUX REGISTRES.
 *
 * ═══ POURQUOI CE FICHIER EST À PART ═══
 *
 * Les deux registres vivent ailleurs : le CLAVIER dans un cas sous jsdom
 * (`clavierDesModales.test.tsx`), la GÉOMÉTRIE dans un script Node
 * (`scripts/modales.mjs`). Les trois ne peuvent pas cohabiter — le premier
 * exige les types du DOM, le second ceux de Node, et
 * `testsQuiLisentLeDisque` documente le prix de ce partage.
 *
 * Ce fichier-ci lit donc les deux comme du TEXTE. C'est l'idiome du dépôt :
 * `decisions-nommees` lit `Decisions.tsx`, `notes-conditionnelles` lit les
 * sources, et `modales.mjs` lit désormais le registre du clavier. Un cas qui
 * IMPORTERAIT l'un des deux ferait dépendre une garde du chargement de l'autre.
 */

/**
 * ═══ LA COMPLÉTUDE, ET POURQUOI ELLE MANQUAIT ═══
 *
 * Ce registre est ÉCRIT À LA MAIN, et rien ne rougissait quand une modale neuve
 * l'oubliait. Le second registre du dépôt — celui de la GÉOMÉTRIE, dans
 * `scripts/modales.mjs` — a le même défaut. J'ai inscrit trois modales dans les
 * deux à la main le 2026-09-05 en le nommant chaque fois dans le commit, ce qui
 * est une façon polie de dire que la prochaine y échapperait.
 *
 * ET ELLE N'A PAS ATTENDU. Les cas ci-dessous, écrits ce jour-là, ont trouvé
 * NEUF modales du produit qu'aucun registre ne nommait — dont « Corriger la
 * fiche », « Ajouter un locataire », « Confier des immeubles » et « Relier à une
 * fiche », quatre gestes réels dont personne n'avait jamais mesuré ni le piège
 * de focus, ni la sortie par Échap, ni le retour du focus.
 *
 * ═══ LE CRITÈRE EST DÉRIVÉ, PAS RECOPIÉ ═══
 *
 * La population se LIT sur le disque : tout fichier de `src/features` ou
 * `src/routes` qui rend `<Modal` en porte une. Le compte par fichier doit
 * s'expliquer — autant d'entrées et de dispenses que de balises. Un registre qui
 * se compare à lui-même est d'accord avec lui-même ; celui-ci se compare au
 * code.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = join(RACINE, 'src')
const REGISTRE_CLAVIER = 'src/features/dashboard/clavierDesModales.test.tsx'

/**
 * Les modales que ce fichier NE JOUE PAS, et pourquoi.
 *
 * Une dispense sans motif a exactement l'effet d'un oubli, en ayant l'air d'une
 * décision — c'est la règle que `pointsDEntreeHorsChaine` applique déjà aux
 * scripts, et elle vaut ici.
 */
const HORS_CLAVIER: { fichier: string; quoi: string; motif: string }[] = [
  {
    fichier: 'features/dashboard/Portfolio.tsx',
    quoi: 'supprimer un immeuble',
    motif:
      'Elle ne s’ouvre que sur un immeuble VIDE, et le jeu de démonstration n’en porte ' +
      'aucun : les trois immeubles ont des logements. Il faudrait en CRÉER un d’abord, ' +
      'ce que ce fichier de cas ne sait pas faire — `modales.mjs` le dit déjà de son ' +
      'côté et la mesure ailleurs.',
  },
  {
    fichier: 'features/dashboard/Works.tsx',
    quoi: 'chiffrer un devis',
    motif:
      'Le geste appartient au GESTIONNAIRE et ne paraît que sur un chantier au bon ' +
      'statut — signalé, non chiffré. C’est une modale de plus à jouer sous un profil ' +
      'de plus, et je ne l’ai pas écrite : je la déclare plutôt que de la taire, et ' +
      'elle reste le premier candidat quand ce fichier grandira.',
  },
  {
    fichier: 'features/dashboard/Tenants.tsx',
    quoi: 'corriger une fiche locataire',
    motif:
      'Geste RÉEL et non couvert : le piège de focus, la sortie par Échap et le retour ' +
      'du focus au bouton n’ont jamais été mesurés dessus. Ce n’est pas un choix, c’est ' +
      'une dette que ces cas viennent de rendre visible — et la rendre visible est ' +
      'exactement ce qu’on leur demande.',
  },
  {
    fichier: 'features/dashboard/Tenants.tsx',
    quoi: 'ajouter un locataire',
    motif:
      'Même dette que la correction de fiche, sur le geste le plus fréquent de cet ' +
      'écran. Non mesurée au clavier depuis l’origine ; nommée ici pour la première ' +
      'fois, et elle ne repartira pas dans le silence.',
  },
  {
    fichier: 'features/dashboard/Access.tsx',
    quoi: 'délier une fiche de son compte',
    motif:
      'Confirmation destructrice, offerte sur la rangée d’un membre RELIÉ. La ' +
      'démonstration en porte, donc rien ne l’empêche techniquement : c’est une dette ' +
      'de couverture, pas un empêchement, et je la nomme au lieu de la laisser hors ' +
      'de tout registre.',
  },
  {
    fichier: 'features/dashboard/Access.tsx',
    quoi: 'confier des immeubles',
    motif:
      'Elle est MESURÉE EN GÉOMÉTRIE — `modales.mjs` la tient sous le nom ' +
      '`ConfierImmeubles`, avec ses plafonds relevés au CI — mais pas au clavier. Le ' +
      'trou est donc partiel, et c’est précisément ce qu’un registre par fichier permet ' +
      'de dire au lieu de le moyenner.',
  },
  {
    fichier: 'features/dashboard/Access.tsx',
    quoi: 'relier un membre à une fiche',
    motif:
      'Même cas que « confier des immeubles » : `notes-conditionnelles` ouvre cette ' +
      'modale pour y peindre `app.access.linkMismatch`, donc un navigateur la rend ' +
      'vraiment — mais son CLAVIER n’est mesuré nulle part. Une modale vue n’est pas ' +
      'une modale jouable.',
  },
  {
    fichier: 'features/dashboard/ReceiptModal.tsx',
    quoi: 'retirer un versement',
    motif:
      'Confirmation destructrice imbriquée DANS la modale de quittance — une modale ' +
      'dans une modale, ce que ce fichier ne sait pas jouer : le piège de focus s’y ' +
      'compose à deux niveaux et les quatre propriétés n’y ont pas le même sens. Elle ' +
      'appelle un cas écrit exprès, pas une ligne de plus dans ce registre.',
  },
  {
    fichier: 'routes/KitchenSink.tsx',
    quoi: 'la vitrine du système de dessin',
    motif:
      'Ce n’est pas un geste du produit : c’est l’échantillon de `Modal` sur la page ' +
      'qui montre les composants un par un. La jouer mesurerait la vitrine, pas ' +
      'l’application — et son bouton n’existe sur aucun écran de gestion.',
  },
]

/** Tout fichier qui rend une modale, et combien il en rend. */
function modalesDuDisque(): Map<string, number> {
  const trouvees = new Map<string, number>()
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(SRC, dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) {
        parcourir(chemin)
      } else if (/\.tsx$/.test(entree.name) && !entree.name.includes('.test.')) {
        const combien = (
          readFileSync(join(SRC, chemin), 'utf8').match(/<Modal[\s\n]/g) ?? []
        ).length
        if (combien > 0) trouvees.set(chemin, combien)
      }
    }
  }
  for (const racine of ['features', 'routes']) parcourir(racine)
  return trouvees
}

/**
 * Les fichiers que le registre du CLAVIER déclare jouer, lus dans son tableau.
 *
 * BORNÉ AU TABLEAU `MODALES` : le fichier porte aussi `HORS_CLAVIER` juste
 * au-dessus, dont les entrées ont le même champ. Balayer le fichier entier
 * compterait les DISPENSES comme des couvertures — une garde qui s'appuie sur
 * la liste de ce qu'elle ne couvre pas pour affirmer qu'elle couvre tout. Le
 * défaut est réel : `modales.mjs` l'a commis au premier essai du même remède,
 * et rendait 23 fichiers joués pour 19.
 */
function fichiersJouesAuClavier(): string[] {
  const source = readFileSync(join(RACINE, REGISTRE_CLAVIER), 'utf8')
  const debut = source.indexOf('const MODALES: Modale[] = [')
  const fin = source.indexOf('\n]', debut)
  if (debut === -1 || fin === -1) return []
  return [...source.slice(debut, fin).matchAll(/fichier: '([^']+)'/g)].map((m) => m[1]!)
}

describe('les modales du produit', () => {
  it('ont un registre de clavier LISIBLE — sans quoi tout le reste ment', () => {
    /* Un tableau renommé rendrait « aucune couverture » là où il y en a vingt,
       et la garde du dessous accuserait vingt fichiers innocents. */
    expect(fichiersJouesAuClavier().length).toBeGreaterThanOrEqual(15)
  })

  it('sont bien TROUVÉES — sans quoi cette garde ne garderait rien', () => {
    /* Un motif rompu rendrait une carte vide, et « aucun oubli » se lirait comme
       « rien à couvrir ». Vingt-deux fichiers au jour de l’écriture. */
    expect(modalesDuDisque().size).toBeGreaterThanOrEqual(20)
  })

  it('sont TOUTES jouées au clavier, ou DÉCLARÉES avec leur motif', () => {
    const joues = fichiersJouesAuClavier()
    const orphelines = [...modalesDuDisque()]
      .map(([fichier, combien]) => ({
        fichier,
        combien,
        couvertes:
          joues.filter((f) => f === fichier).length +
          HORS_CLAVIER.filter((h) => h.fichier === fichier).length,
      }))
      .filter((f) => f.couvertes < f.combien)
      .map((f) => `${f.fichier} — ${f.combien} modale(s), ${f.couvertes} déclarée(s)`)

    expect(
      orphelines,
      'ces modales n’entrent dans AUCUN registre : ni clavier, ni géométrie. ' +
        'Personne n’a mesuré leur piège de focus, leur sortie par Échap ni le retour ' +
        `du focus. Jouez-les, ou inscrivez-les dans \`HORS_CLAVIER\` :\n  ${orphelines.join('\n  ')}`,
    ).toEqual([])
  })

  it('ne laissent AUCUNE déclaration morte', () => {
    /* Une entrée qui nomme un fichier sans modale décrit un écran disparu avec
       l’autorité d’un registre — les deux sens, comme partout ici. */
    const surLeDisque = modalesDuDisque()
    const mortes = [...fichiersJouesAuClavier(), ...HORS_CLAVIER.map((h) => h.fichier)].filter(
      (f) => !surLeDisque.has(f),
    )
    expect(mortes, `ces fichiers ne rendent plus aucune modale :\n  ${mortes.join('\n  ')}`).toEqual(
      [],
    )
  })

  it('donnent un MOTIF, et pas un renvoi', () => {
    const creuses = HORS_CLAVIER.filter((h) => h.motif.trim().length < 120).map((h) => h.quoi)
    expect(creuses, 's’inscrire est un geste ; le motif est ce qui le rend relisible').toEqual([])
  })
})
