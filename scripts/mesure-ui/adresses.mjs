/**
 * LES ADRESSES BALAYÉES, LUES DANS LE PRODUIT ET JAMAIS RECOPIÉES.
 *
 * Une liste d'écrans écrite à la main vieillit en silence : l'écran ajouté
 * demain n'y serait pas, et la porte le déclarerait sain sans l'avoir ouvert.
 * Ces fonctions lisent donc le routeur comme un TEXTE, et le compte minimal
 * garde contre une lecture cassée — « aucune adresse morte parmi zéro »
 * s'écrit comme « tout va bien ».
 *
 * Module PUR : l'importer n'exécute rien.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RACINE } from './contexte.mjs'

/**
 * Les adresses sont LUES dans DEUX fichiers, jamais recopiées.
 *
 * Une liste recopiée se périme en silence : `appariements.test.ts` a surveillé
 * pendant des lots trois jetons de couleur que le graphe n'employait plus.
 * Ici, un écran neuf est mesuré le jour où sa route est écrite.
 *
 * DEUX FICHIERS, ET NON PLUS UN SEUL, depuis que la vitrine et l'application
 * ont cessé de partager un paquet. `src/App.tsx` ne monte plus `paiements`,
 * `parc` ou les quatorze autres écrans de gestion : il monte `/app/*` et
 * `/demo/*`, deux frontières paresseuses dont le détail vit dans
 * `src/app/EspaceApplicatif.tsx`. Ne lire que le premier ferait tomber le
 * compte de 23 à 8 — un silence que la garde du garde, plus bas, est justement
 * là pour crier au lieu de laisser passer.
 */
/**
 * CE QUI EST RÉSERVÉ À L'APPLICATION, déduit d'`EspaceApplicatif.tsx` —
 * jamais recopié.
 *
 * `EspaceApplicatif.tsx` importe déjà, une fois, chaque écran de gestion pour
 * les monter : c'est la source de vérité qu'`adressesDeLApplication` lit
 * juste au-dessus pour les ADRESSES, et c'est la même qu'on lit ici pour les
 * MODULES. Recopier les vingt noms d'écran dans ce fichier serait exactement
 * la panne qu'`appariements.test.ts` a déjà payée : une liste qui se périme
 * en silence dès le prochain écran ajouté ailleurs.
 *
 * TROIS FAMILLES, ET C'EST TOUT :
 *
 *  1. `@/features/dashboard/…` — vingt écrans et leurs modales, PAR PRÉFIXE
 *     et non par nom : un écran neuf porte cette adresse le jour de son
 *     import dans `EspaceApplicatif.tsx`, sans qu'il faille toucher ce
 *     fichier-ci.
 *  2. Les fichiers de FRONTIÈRE eux-mêmes — `AppShell.tsx`, qui porte toute
 *     la coque et sa barre latérale ; `PortfolioProvider.tsx`, qui pèse à lui
 *     seul plus que les vingt écrans réunis (voir `BUDGET_PREMIER_CHARGEMENT`
 *     plus bas) ; `RequireAuth.tsx`, la barrière d'accès ; `Demo.tsx`, qui
 *     rejoue la même coque sans compte ; `NotFoundInApp.tsx`, séparé de
 *     l'écran 404 public par ce lot pour cette raison précise — voir son
 *     en-tête.
 *  3. `EspaceApplicatif.tsx` LUI-MÊME : s'il apparaît un jour dans le paquet
 *     impatient, la frontière paresseuse a disparu, `React.lazy` en tête —
 *     c'est la panne la plus grave que cette règle puisse voir, et il n'y a
 *     personne d'autre pour la nommer.
 *
 * CE QUI N'Y FIGURE PAS, ET C'EST UN CHOIX MESURÉ, PAS UN OUBLI :
 * `Charts.tsx`. `EspaceApplicatif.tsx` ne l'importe pas — ce sont les écrans
 * qui l'importent — et il a une seconde raison d'être légitimement impatient :
 * `features/marketing/Hero.tsx`, sur la page de vente, l'utilise pour son
 * illustration. Mesuré : le forcer hors du paquet impatient romprait la
 * landing, pas une fuite. `data/portfolio.ts` et `data/kpis.ts` sont dans le
 * même cas, pour la même page. `@/api/SessionProvider`, qu'`EspaceApplicatif`
 * importe aussi (pour `useSession`), est logiquement PARTAGÉ : `Login.tsx` et
 * `SignUp.tsx`, publics, en dépendent pour la connexion elle-même — c'est
 * pourquoi seuls les préfixes ci-dessus sont retenus, pas « tout ce
 * qu'importe ce fichier ».
 */
export function modulesReservesALApplication() {
  const source = readFileSync(join(RACINE, 'src/app/EspaceApplicatif.tsx'), 'utf8')

  // `import type` est erasé à la compilation — aucun octet, aucun module dans
  // le paquet construit. Le compter comme une fuite possible ferait rougir la
  // porte sur une ligne qui ne pèse rien.
  const specificateurs = [...source.matchAll(/^import (?!type )[^;]*?from '([^']+)'/gm)].map((m) => m[1])

  const PREFIXES_RESERVES = ['@/features/dashboard/']
  const FICHIERS_RESERVES = [
    '@/components/layout/AppShell',
    '@/data/PortfolioProvider',
    '@/api/RequireAuth',
    '@/routes/Demo',
    '@/routes/NotFoundInApp',
  ]

  const reserves = specificateurs.filter(
    (s) => PREFIXES_RESERVES.some((p) => s.startsWith(p)) || FICHIERS_RESERVES.includes(s),
  )

  // `EspaceApplicatif.tsx` ne s'importe pas lui-même : sa propre présence
  // éventuelle dans le paquet impatient se vérifie à part, en ajoutant son
  // propre chemin à la liste.
  reserves.push('@/app/EspaceApplicatif')

  // `@/X` -> `X.tsx`, le format des chemins que Rollup rapporte dans la carte
  // des paquets. `.ts` existe aussi dans ce dépôt (voir `data/kpis.ts`), mais
  // aucun des chemins réservés ci-dessus n'en a besoin aujourd'hui — et le
  // garder en `.tsx` seul est délibéré : un faux négatif se verrait au premier
  // écran `.ts` ajouté à `EspaceApplicatif.tsx`, ce que la garde du garde plus
  // bas transforme en échec explicite plutôt qu'en trou silencieux.
  return reserves.map((s) => s.replace(/^@\//, '') + '.tsx')
}

/**
 * LE DICTIONNAIRE ANGLAIS, réservé à son propre chargement paresseux — un
 * SECOND sujet, distinct de `modulesReservesALApplication` ci-dessus.
 *
 * Celui-là dérive la liste des vingt écrans de gestion depuis
 * `EspaceApplicatif.tsx`, la frontière `/app` et `/demo`. Les DEUX moitiés
 * anglaises n'ont rien à voir avec cette frontière-là : elles sont paresseuses
 * jusque sur `/`, la vitrine elle-même — voir `src/i18n/I18nProvider.tsx`, qui porte
 * l'argumentaire complet de l'échange. Le fondre dans la liste ci-dessus
 * aurait forcé l'extension `.tsx` codée en dur sur des fichiers qui sont
 * `i18n/en.ts` et `i18n/en-app.ts`, pas `.tsx` — et aurait mélangé deux raisons de rester hors du
 * paquet impatient qui n'ont rien en commun.
 *
 * DÉRIVÉ, et non recopié : les chemins lus dans CHAQUE `import(...)` de
 * `I18nProvider.tsx` — même raison que ci-dessus, une chaîne recopiée se
 * périme le jour où quelqu'un renomme le fichier sans penser à cette garde.
 */
export function modulesReservesALaLangueParesseuse() {
  const source = readFileSync(join(RACINE, 'src/i18n/I18nProvider.tsx'), 'utf8')
  /*
    TOUS LES `import()`, ET NON LE PREMIER.

    Cette fonction était au SINGULIER et lisait `source.match(…)` sans `/g` —
    donc le premier appel dynamique rencontré, et lui seul. C'était juste tant
    que l'anglais tenait en un fichier. Depuis la scission du 2026-10-10 il y en
    a deux, `./en` et `./en-app`, et la version singulière aurait rendu `en`
    seul : un import statique d'`en-app` dans le paquet d'entrée serait passé
    INAPERÇU, alors que c'est exactement la fuite que `mesurerFuite` existe pour
    refuser.

    Toujours DÉRIVÉ, jamais recopié — une chaîne écrite ici se périmerait au
    premier renommage.
  */
  return [...source.matchAll(/import\(['"]([^'"]+)['"]\)/g)]
    .map((m) => 'i18n/' + m[1].replace(/^\.\//, '') + '.ts')
    .filter((chemin, rang, tous) => tous.indexOf(chemin) === rang)
}

export function adressesDeLApplication() {
  const extraireChemins = (relatif) =>
    [...readFileSync(join(RACINE, relatif), 'utf8').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

  const cheminsPublics = extraireChemins('src/App.tsx')
  // `/app/*` et `/demo/*` : la syntaxe qu'exige une frontière paresseuse
  // (« routes descendantes » de React Router) et non des adresses qu'on
  // visite telles quelles — `/app` et `/demo` sont ajoutés plus bas, à la
  // main, pour la même raison que l'écran 404 l'est : ce sont eux qu'un
  // navigateur atteint réellement.
  const publiques = cheminsPublics.filter(
    (c) => c.startsWith('/') && !c.includes(':') && c !== '*' && !c.endsWith('/*'),
  )
  // Les écrans de l'application sont montés sous deux adresses ; `/demo` est
  // celle qui sert un parc complet sans authentification, donc la seule
  // mesurable ici. `index` n'apparaît pas comme `path` : c'est `/demo` nu.
  const internes = extraireChemins('src/app/EspaceApplicatif.tsx')
    .filter((c) => !c.startsWith('/') && !c.includes(':') && c !== '*')
    .map((c) => `/demo/${c}`)

  /*
    `KitchenSink` est écarté, et le dépôt a déjà rendu cet arbitrage.

    `scripts/check-i18n.mjs` l'exempte nommément — « ses libellés décrivent les
    composants eux-mêmes et ne sont pas du produit ». Le même raisonnement vaut
    ici : une page qui aligne tous les composants côte à côte n'a pas de mise en
    page à défendre, et personne ne l'ouvre. Elle déborde à toutes les largeurs,
    ce qui n'apprend rien, et le seul fait de dresser la liste de ses coupables
    coûtait six minutes sur les huit du balayage — pour garder ce que nul
    n'utilise.

    Une exclusion, pas une tolérance : `TOLERES` couvre un débordement de
    PRODUIT qu'on assume, et il meurt avec lui. Ici l'écran entier sort du
    champ, et c'est autre chose.
  */
  const HORS_PRODUIT = ['/kitchen-sink']

  /*
    L'ÉCRAN 404 EST AJOUTÉ À LA MAIN, et c'est la seule adresse qui ne se lit pas
    dans `App.tsx`.

    Sa route est `*`, écartée plus haut avec les chemins à paramètre — pour une
    bonne raison, `*` n'étant pas une adresse qu'on puisse visiter. Mais l'écran
    qu'elle rend, lui, se visite : il suffit de se tromper de lien. Il portait la
    même rangée de sélecteurs que les écrans d'authentification, le même
    débordement de 38 px à 320, et il l'a gardé plus longtemps qu'eux
    précisément parce que rien ne le regardait.

    N'importe quelle adresse inexistante le rend ; celle-ci le dit en toutes
    lettres, pour que le rapport d'échec se lise sans avoir à deviner.
  */
  const ADRESSE_404 = '/adresse-qui-n-existe-pas'

  /*
    LE DOSSIER D'UN LOGEMENT, AJOUTÉ À LA MAIN — SECONDE ADRESSE À L'ÊTRE.

    Les chemins À PARAMÈTRE sont écartés du balayage, et pour une bonne raison :
    `/demo/parc/:unite` n'est pas une adresse qu'on visite. Mais l'ÉCRAN qu'elle
    rend, lui, se visite — c'est le dossier qu'on ouvre depuis chaque ligne du
    parc, et il n'était mesuré par RIEN.

    Ce qu'il cachait, relevé à l'ouverture : 217 px de blanc imposé sous la carte
    « Occupation », 149 sous « Travaux du logement ». Les deux rangées étirent
    leurs cellules à la hauteur de la plus haute, et cet écran-là n'avait aucune
    sonde pour le dire. C'est exactement le raisonnement qui a fait ajouter le
    404 quelques lignes plus haut : « il portait le même débordement de 38 px à
    320, et il l'a gardé plus longtemps que les autres précisément parce que rien
    ne le regardait ».

    `A1` est le premier logement du jeu de démonstration : occupé, avec un bail,
    un historique de quittances, un chantier et une caution. C'est le dossier le
    plus FOURNI, donc celui qui met le plus de choses sous la sonde.
  */
  const DOSSIER_D_UN_LOGEMENT = '/demo/parc/A1'

  const adresses = [
    ...new Set([...publiques, '/app', '/demo', ...internes, DOSSIER_D_UN_LOGEMENT, ADRESSE_404]),
  ].filter((c) => !HORS_PRODUIT.includes(c))

  /*
    Garde du garde, et le plancher COLLE au réel plutôt que de flotter loin
    dessous.

    Il valait 20 pour 22 écrans : il n'attrapait qu'une lecture d'`App.tsx`
    entièrement cassée, et laissait retirer deux écrans du balayage en silence.
    Or c'est exactement ce qui a maintenu le 404 hors de toute mesure pendant
    des lots — un écran qu'aucun défaut ne pouvait plus atteindre parce que
    personne ne le regardait.

    Serré, il ne peut rougir que dans un sens : ajouter une route fait monter le
    compte et ne dérange personne, en retirer une le fait tomber et arrête tout.
    C'est la seule asymétrie qu'on veuille ici.
  */
  const ATTENDUES = 23

  if (adresses.length < ATTENDUES) {
    throw new Error(
      `mesure-ui : ${adresses.length} adresses balayées, moins que les ${ATTENDUES} attendues. ` +
        `Un écran est sorti du champ de la mesure — ce n'est pas une absence de défaut.`,
    )
  }
  return adresses
}
