/**
 * MESURE AU NAVIGATEUR — ce qu'aucune garde de fichier ne peut voir.
 *
 * Les treize tests de `src/design-system/` lisent des FICHIERS, et chacun le
 * motive de la même façon : jsdom ne calcule ni `clamp()`, ni les couches en
 * cascade, ni `env()`, ni la moindre hauteur. C'est un choix juste, et c'est
 * aussi un plafond. Quatre défauts réels ont vécu sous ce plafond : un fanion
 * qui débordait à 320 px, un lien de 18 × 17 px qui était la seule entrée vers
 * l'écran d'un logement, un correctif qui coûtait 255 px de hauteur de tableau
 * en mobile pendant que son commentaire affirmait que « rien ne bouge », et le
 * débordement latéral que ce script garde aujourd'hui.
 *
 * Ce fichier ouvre donc un VRAI navigateur sur le VRAI paquet construit.
 *
 * SUJET DE CETTE GARDE : ce que la page fait VRAIMENT une fois peinte —
 * et, depuis ce lot, ce qu'elle a dû FAIRE ARRIVER pour en arriver là.
 *
 * Huit règles. Les deux premières regardent le RÉSEAU, avant même qu'un
 * navigateur ne s'ouvre — et elles ne posent PAS la même question.
 * `mesurerFuite` demande si un module réservé à l'application est présent
 * dans le paquet impatient : oui ou non, sans seuil, jamais relevée.
 * `mesurerPremierChargement` demande combien pèse ce paquet, sous un budget
 * dont la marge est motivée par la croissance MESURÉE des dictionnaires — la
 * dérive lente, pas l'accident, que la première règle tient déjà. Les trois
 * suivantes regardent l'USAGE — les réglages restent atteignables au clavier,
 * aucun texte ne passe sous le seuil WCAG AA, aucune cible ne se touche sous
 * 44 px. Les trois dernières regardent la MISE EN PAGE, du signal le plus tôt
 * au symptôme le plus tard — la barre de la vitrine garde du jeu, aucune
 * rangée d'en-tête ne se replie là où la place existe, aucun écran ne défile
 * latéralement.
 *
 * L'ordre est celui-là parce qu'une mesure de boîtes ne voit rien des trois
 * du milieu : une commande retirée fait de la place, un texte illisible occupe
 * la même boîte, et une cible se touche par autre chose que sa boîte — un
 * `::after` étendu la triple, un recouvrement l'annule. Une page parfaitement
 * rangée peut être inutilisable — et, désormais, jamais téléchargée par qui
 * n'en avait pas besoin peut coûter plus cher qu'elle ne le devrait.
 *
 * PIÈGES HONORÉS — chacun a été payé une fois :
 *
 *  1. Le débordement ne se mesure PAS par `documentElement.scrollWidth` : cette
 *     valeur compte la largeur de mise en page des descendants d'un conteneur à
 *     défilement, et signale donc un faux positif sur tout tableau large logé
 *     dans un `overflow-x-auto` — ce que le dépôt fait partout. Le seul critère
 *     fiable est de TENTER `window.scrollTo(400, 0)` et de vérifier que
 *     `window.scrollX` est resté à 0.
 *
 *  2. On attend la disparition d'`aria-busy`, JAMAIS un délai fixe. Un délai
 *     mesure les squelettes de chargement : un premier balayage l'a fait, a
 *     rendu « aucun défaut », et le second — en attendant la donnée — a trouvé
 *     159 formes dont le lien de 18 × 17 px.
 *
 *  3. Les deux langues, parce que le défaut fondateur de cette garde
 *     n'existait qu'en anglais : « Record a payment » est plus large que
 *     « Encaisser un paiement » ne l'est en hauteur de rangée.
 *
 *  4. On redimensionne au lieu de recharger : vingt chargements au lieu de
 *     deux cent vingt. Après chaque redimensionnement on réattend `aria-busy`,
 *     parce qu'un changement de largeur peut remonter une requête.
 *
 * COMMENT LE LIRE QUAND IL ROUGIT : il nomme l'écran, la largeur, la langue,
 * et les éléments dont le bord droit dépasse la fenêtre SANS qu'aucun ancêtre
 * ne défile — c'est-à-dire les vrais coupables, pas leurs parents.
 *
 * PRÉREQUIS D'INSTALLATION : `npx playwright install chromium` une fois par
 * machine. Le paquet `playwright` n'embarque pas le navigateur.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4183
const BASE = `http://127.0.0.1:${PORT}`

/**
 * Les largeurs mesurées.
 *
 * 320 est le plancher réel du marché visé. 700-900 est la bande qui a livré
 * les deux défauts fondateurs de cette garde, et c'est justement la bande que
 * personne ne regarde : ni téléphone, ni bureau. 1440 est le poste de travail
 * du gestionnaire.
 */
const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440]

/**
 * LES DEUX LANGUES, et aucune n'est « la large » partout.
 *
 * L'anglais l'est sur les écrans de l'application — le défaut fondateur de
 * cette garde n'existait qu'en anglais. Mais sur la barre de la vitrine c'est
 * l'inverse, mesuré : 12 px de jeu en français contre 123 en anglais, parce que
 * « Essayer gratuitement » coûte 172 px là où « Start free » en coûte 92. Un
 * balayage qui n'aurait regardé qu'une des deux aurait déclaré la barre saine.
 */
const LANGUES = ['en-US', 'fr-FR']

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
function modulesReservesALApplication() {
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

function adressesDeLApplication() {
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

  const adresses = [
    ...new Set([...publiques, '/app', '/demo', ...internes, ADRESSE_404]),
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

/**
 * LE CONTRASTE SE MESURE ICI PARCE QUE C'EST ICI QUE LE NAVIGATEUR EST OUVERT.
 *
 * `scripts/contrast-audit.js` sait trouver un texte sous le seuil WCAG AA
 * depuis des lots. Aucune porte ne le lançait : c'était un outil de console,
 * qu'il fallait penser à coller. Le commentaire de `TOLERES`, plus bas, le cite
 * déjà comme LA démonstration du dépôt qu'une garde hors de `check` ne
 * s'exécute jamais. Il avait raison, et il se citait lui-même : au premier
 * passage automatique, l'audit a trouvé le fanion « Démonstration » à 3,93 pour
 * 4,5 requis — une encre dont `tokens.css` certifiait « 4.98 sur --paper », et
 * que le fanion posait sur un tout autre fond.
 *
 * ON LIT LE FICHIER, ON NE LE RECOPIE PAS. Une copie dériverait en silence de
 * l'outil que la console emploie encore, et les deux se contrediraient sans que
 * personne l'apprenne. La forme du retour est le contrat, écrit là-bas.
 *
 * POURQUOI DEUX THÈMES. La moitié des jetons ne vivent qu'en sombre — `warn`
 * y vaut #e0b877 sur #54421f, aucun de ces deux-là n'existant en clair. Ne
 * mesurer qu'un thème, c'est ne mesurer qu'une palette sur deux.
 *
 * POURQUOI DEUX LARGEURS ET PAS ONZE. Le contraste ne dépend pas de la
 * géométrie : entre 360 et 375, aucune couleur ne change, et onze largeurs
 * porteraient la porte à un quart d'heure pour redire onze fois la même chose.
 * Mais il n'en faut pas qu'UNE : à 1280 la barre basse de l'espace connecté,
 * le panneau du menu et les variantes compactes ne sont pas rendus du tout, et
 * ce qui n'est pas rendu n'est pas mesuré. Une largeur de poche, une de bureau.
 */
const THEMES = ['light', 'dark']
const LARGEURS_CONTRASTE = [360, 1280]

/**
 * LE PLANCHER DES CIBLES TACTILES, mesuré par CE QUE LE DOIGT TOUCHE.
 *
 * `cibles.test.ts` tient déjà cette règle, et il la tient bien — mais il lit
 * les SOURCES, et il écrit lui-même pourquoi : « jsdom ne calcule aucune
 * hauteur ». Deux angles morts en découlent, tous deux payés ici :
 *
 *  1. UNE CLASSE N'EST PAS UNE MESURE. Les liens du pied portaient `min-h-11`,
 *     ce que le contrôle de sources lit comme « plancher honoré ». Leur LARGEUR
 *     restait celle du libellé traduit : « Tarifs » faisait 35 px. Un plancher
 *     de hauteur ne dit rien d'une largeur, et aucune lecture de fichier ne
 *     pouvait le voir.
 *
 *  2. UNE BOÎTE N'EST PAS UNE CIBLE. L'inverse est vrai aussi, et cette garde a
 *     failli le rater : le lien vers le dossier d'un logement mesure 18 × 17 px
 *     — c'est LE défaut fondateur du dépôt — et il est pourtant correct depuis
 *     des lots. Son `::after` étendu porte la cible réelle à 72 × 68, celle de
 *     la cellule. Une première version de cette règle mesurait
 *     `getBoundingClientRect` et le dénonçait : elle aurait fait défaire un
 *     correctif juste.
 *
 * D'OÙ `elementFromPoint`, ET RIEN D'AUTRE. On part du centre de l'élément et
 * on s'écarte tant que le point touché lui appartient encore. Ce que ça mesure
 * est ce qui compte : la surface réellement cliquable, pseudo-éléments,
 * rembourrages et recouvrements compris. Une boîte se calcule ; une cible se
 * touche.
 *
 * DEUX PIÈGES, chacun payé une fois pendant l'écriture :
 *
 *  - `elementFromPoint` ne répond QUE dans le cadre visible et rend `null`
 *    ailleurs. Sans `scrollIntoView` préalable, il déclarait le lien du parc
 *    intouchable — on mesurait la position de la fenêtre, pas la cible.
 *  - Le point touché est souvent un DESCENDANT (l'icône dans le bouton), jamais
 *    l'élément lui-même. Comparer par identité seule rate presque tout ; il
 *    faut `el.contains(touche)`.
 */
const PLANCHER_CIBLE = 44

/**
 * Le rayon de sondage autour du centre.
 *
 * 22 de part et d'autre rendent 45 px atteignables, un de plus que le plancher.
 * On ne cherche pas la taille exacte d'une grande cible — seulement à savoir si
 * elle atteint 44 — donc s'arrêter juste au-dessus évite des milliers de
 * sondages inutiles sur les cibles déjà confortables.
 */
const RAYON_SONDAGE = 22

/**
 * Les exemptions, DÉCLARÉES AU SITE et motivées ici.
 *
 * Elles ne vivent pas dans une liste de chemins de fichiers, contrairement aux
 * `EXEMPTIONS` de `cibles.test.ts`, et pour deux raisons. D'abord une liste de
 * chemins se périme au premier déplacement de fichier, en silence. Ensuite un
 * motif de classe écrit ici serait GÉNÉRÉ : Tailwind v4 balaie ce dépôt, et une
 * garde qui cite une classe en littéral la fait exister dans le CSS livré.
 *
 * Chaque élément exempté porte donc `data-cible="<raison>"` là où il est écrit,
 * avec son argument en commentaire. Ici ne vit que la liste des raisons
 * admises — et la garde du garde plus bas fait rougir une raison qui ne couvre
 * plus rien, comme une raison employée sans être déclarée.
 */
const CIBLES_EXEMPTES = {
  donnee:
    "la largeur d'une colonne de graphe est celle que la donnée et la fenêtre lui laissent " +
    "(douze mois dans 360 px), et la colonne n'agit pas : elle appelle une infobulle. WCAG 2.5.8, « essentiel ».",
  'dans-une-phrase':
    'un lien porté par une ligne de texte a la hauteur de cette ligne ; ' +
    "l'agrandir casserait l'interligne du paragraphe. WCAG 2.5.8, « en ligne ».",
}

/**
 * Contrastes TOLÉRÉS, même doctrine que `TOLERES` : nommés, motivés, mortels.
 *
 * Clé : le texte relevé, tronqué comme l'audit le tronque. AUCUNE ENTRÉE, et
 * c'est le but — la garde du garde plus bas fait rougir celle qui ne couvre
 * plus rien, donc aucune ne peut survivre au défaut qu'elle couvrait.
 */
const CONTRASTES_TOLERES = {
}

/**
 * Débordements TOLÉRÉS, avec leur raison écrite.
 *
 * Sur le modèle des `EXEMPTIONS` de `cibles.test.ts` : une dérogation se nomme,
 * se motive, et meurt avec le défaut qu'elle couvrait — la garde du garde plus
 * bas fait rougir toute entrée devenue orpheline.
 *
 * Clé : `adresse@largeur`, indépendante de la langue — un débordement qui
 * n'existe qu'en anglais reste le même défaut de mise en page.
 *
 * AUCUNE ENTRÉE, et c'est le but. Une dette datée s'écrit ici avec sa mesure et
 * le lot qui la lèvera ; il n'en reste plus. Chacune porte sa mesure
 * et le lot qui la lèvera ; la garde du garde plus bas fait rougir celle qui ne
 * couvre plus rien, donc aucune ne peut survivre à sa réparation. Elles sont
 * ici parce qu'une garde hors de `check` ne s'exécute jamais — l'audit en fait
 * la démonstration avec `contrast-audit.js`, qui savait trouver un contraste
 * sous le seuil et ne l'a jamais trouvé faute d'être lancé.
 */
const TOLERES = {
}

/**
 * Les attentes, et ce qu'elles coûtent quand elles échouent.
 *
 * Chaque `.catch(() => {})` avale un dépassement de délai : c'est voulu — un
 * écran qui ne se stabilise pas doit être MESURÉ tel quel, pas faire échouer le
 * balayage. Mais avalé en silence, un dépassement de quinze secondes se paie
 * douze fois par langue sur le même écran, et le balayage entier passe de
 * quelques minutes à une demi-heure sans qu'on sache pourquoi.
 *
 * On compte donc les dépassements et on les rend à la fin. Un écran dont
 * l'`aria-busy` ne s'éteint jamais est d'ailleurs un DÉFAUT en soi, que ce
 * compteur nomme au lieu de le laisser peser sur l'horloge.
 */
const lenteurs = new Map()

const attendre = async (page, ou) => {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => marquer(ou, 'réseau'))
  // `waitForFunction(fonction, ARGUMENT, options)` : le deuxième paramètre est
  // l'argument passé à la fonction, PAS les options. Écrit en deuxième position,
  // `{ timeout }` partait donc à une fonction qui n'attend rien, et le délai par
  // défaut de trente secondes s'appliquait — douze attentes par écran, six
  // minutes sur toute page qui ne se stabilise pas. Trois pages s'y sont
  // arrêtées au dixième de seconde près, ce qui a trahi le plafond ; sans le
  // `null`, ces délais ne sont pas des délais, ce sont des commentaires.
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 5000,
    })
    .catch(() => marquer(ou, 'chargement'))
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => marquer(ou, 'polices'))
}

function marquer(ou, quoi) {
  const cle = `${ou} — ${quoi}`
  lenteurs.set(cle, (lenteurs.get(cle) ?? 0) + 1)
}

/**
 * La largeur À PARTIR DE LAQUELLE une barre d'en-tête ne doit plus se replier.
 *
 * 1280 px : c'est le plafond de la bande (`max-w-7xl`), donc la largeur au-delà
 * de laquelle élargir la fenêtre ne donne plus un pixel de plus au contenu. Si
 * la barre se replie là, elle se repliera à toutes les largeurs supérieures.
 */
const LARGEUR_SANS_REPLI = 1280

/*
  GARDE DU GARDE : le seuil doit tomber dans les largeurs balayées.

  Porté au-delà de la plus large, il viderait la règle sans que rien ne
  rougisse — la porte dirait « aucun en-tête replié » en n'ayant regardé aucune
  largeur. C'est la panne qu'`ATTENDUES` surveille déjà pour la liste des
  adresses, et pour la même raison : une absence de défaut et une absence de
  mesure se ressemblent trop dans un journal.
*/
if (!LARGEURS.some((l) => l >= LARGEUR_SANS_REPLI)) {
  console.error(
    `\n✗ mesure-ui : aucune largeur balayée n'atteint ${LARGEUR_SANS_REPLI} px.\n` +
      "   La règle du repli ne s'exécuterait jamais — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/**
 * LE JEU MINIMAL que la rangée de l'en-tête public doit garder.
 *
 * POURQUOI UN SEUIL, alors que deux règles gardent déjà cette rangée. Les deux
 * ne rougissent qu'une fois le défaut ARRIVÉ : le débordement quand la page
 * défile de côté, le repli quand la barre s'empile. Mesuré juste avant ce lot,
 * la rangée passait les deux au vert avec DOUZE pixels de jeu en français —
 * 1204 px occupés pour 1216 disponibles. Elle tenait parce que la porte l'y
 * obligeait, pas parce qu'elle avait de la place, et le prochain libellé
 * traduit un peu long la faisait basculer. Une porte verte jusqu'à la seconde
 * où elle casse ne dit rien de l'état du système ; elle dit seulement qu'on
 * n'a pas encore payé.
 *
 * D'OÙ VIENT 120. Après le retrait des trois sélecteurs, la mesure donne 498 px
 * de jeu en anglais et 362 en français — le français est la langue serrée ici,
 * ses deux boutons d'inscription coûtant 297 px contre 174 à l'anglais. Le plus
 * étroit des éléments que la barre porte encore est le bouton « Se connecter »,
 * 117 px. Le seuil dit donc : la barre garde toujours de quoi accueillir un
 * élément de la taille du plus petit qu'elle porte déjà. En dessous, elle est à
 * une traduction près du repli — l'état exact d'où ce lot la sort.
 *
 * SA CONTREPARTIE, et elle est réelle : un ajout LÉGITIME qui coûterait plus de
 * 242 px en français (362 − 120) fera rougir cette porte alors que rien ne se
 * replie. Un troisième bouton de la taille d'« Essayer gratuitement » (172 px
 * plus 12 de gouttière) passe encore, avec 178 px de reste ; deux ne passent
 * pas. Le seuil n'interdit pas d'ajouter : il interdit d'ajouter EN SILENCE. Le
 * relever se fait ici, avec la mesure du jour et la raison écrite — ce qui est
 * précisément la décision qui n'a jamais été prise quand la barre est descendue
 * à douze pixels.
 */
const JEU_MINIMAL = 120

/*
  GARDE DU GARDE : un seuil nul ou négatif est un seuil qui ne sert à rien.

  À zéro, la règle ne rougit qu'une fois la somme des enfants passée au-delà de
  la bande — c'est-à-dire au moment même où `MESURER_REPLI` rougit déjà. Elle
  aurait l'air d'une anticipation et n'en serait pas une : deux formulations du
  même constat tardif, dont l'une donne l'impression d'être couverte en amont.

  Le haut n'a pas besoin de garde symétrique : un seuil démesuré rend la porte
  PLUS stricte, il fait rougir immédiatement et bruyamment, et se corrige de
  lui-même. C'est le bas qui sait se taire, et c'est le silence qu'on garde.
*/
if (JEU_MINIMAL <= 0) {
  console.error(
    `\n✗ mesure-ui : le jeu minimal vaut ${JEU_MINIMAL}.\n` +
      "   À zéro ou moins, la règle ne devance plus le repli — elle le double.\n",
  )
  process.exit(1)
}

/**
 * Exécuté DANS la page : rend les cibles dont la surface touchable reste
 * sous le plancher, avec la raison d'exemption qu'elles déclarent.
 *
 * Le sélecteur ratisse ce qu'un doigt peut viser : les commandes natives, les
 * rôles ARIA qui en tiennent lieu, et tout ce qui est tabulable. Il exclut ce
 * qui n'est pas visé — masqué, hors flux, neutralisé par `inert`, ou réservé
 * aux lecteurs d'écran.
 */
const MESURER_CIBLES = (config) => {
  const { plancher, rayon } = config
  const SELECTEUR = [
    'a[href]',
    'button',
    'input:not([type=hidden])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[role="tab"]',
    '[role="switch"]',
    '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const defauts = []
  const raisonsVues = []
  let sondees = 0

  for (const el of document.querySelectorAll(SELECTEUR)) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (el.classList.contains('sr-only')) continue
    if (el.closest('[inert]')) continue

    let boite = el.getBoundingClientRect()
    if (boite.width === 0 || boite.height === 0) continue
    sondees++

    const raison = el.getAttribute('data-cible')
    if (raison) raisonsVues.push(raison)

    // La boîte suffit à conclure quand elle passe : une cible ne peut que
    // GRANDIR en s'écartant du centre, jamais rétrécir.
    if (boite.width >= plancher && boite.height >= plancher) continue

    el.scrollIntoView({ block: 'center', inline: 'center' })
    boite = el.getBoundingClientRect()
    const cx = Math.round(boite.left + boite.width / 2)
    const cy = Math.round(boite.top + boite.height / 2)
    const touche = (x, y) => {
      const cible = document.elementFromPoint(x, y)
      return !!cible && (cible === el || el.contains(cible))
    }

    let largeurUtile = 0
    let hauteurUtile = 0
    if (touche(cx, cy)) {
      let gauche = 0
      let droite = 0
      let haut = 0
      let bas = 0
      while (gauche < rayon && touche(cx - gauche - 1, cy)) gauche++
      while (droite < rayon && touche(cx + droite + 1, cy)) droite++
      while (haut < rayon && touche(cx, cy - haut - 1)) haut++
      while (bas < rayon && touche(cx, cy + bas + 1)) bas++
      largeurUtile = gauche + droite + 1
      hauteurUtile = haut + bas + 1
    }
    if (largeurUtile >= plancher && hauteurUtile >= plancher) continue

    defauts.push({
      balise: el.tagName.toLowerCase(),
      boite: `${Math.round(boite.width)}x${Math.round(boite.height)}`,
      cible: `${largeurUtile}x${hauteurUtile}`,
      raison,
      texte:
        (el.textContent || '').trim().slice(0, 34) ||
        (el.getAttribute('aria-label') || '').slice(0, 34),
      classes: typeof el.className === 'string' ? el.className.slice(0, 70) : '',
    })
  }

  // Le défilement a bougé : le rendre, sinon la mesure suivante hérite d'une
  // page à mi-hauteur — et l'en-tête collant y a déjà changé de fond.
  window.scrollTo(0, 0)
  return { defauts, raisonsVues, sondees }
}

/**
 * Exécuté DANS la page : rend le jeu restant sur la rangée de l'en-tête public.
 *
 * LA RANGÉE SE DÉSIGNE, elle ne se devine pas. Un plancher en pixels n'a de
 * sens que sur une rangée BORNÉE PAR UNE BANDE — ici `max-w-7xl`, qui fige la
 * largeur utile à 1216 px dès 1280, donc le jeu y est une constante par langue.
 * Les rangées d'en-tête des écrans d'authentification, elles, sont en
 * `ml-auto … justify-end` : elles épousent leur contenu, et leur jeu vaut zéro
 * par construction — vérifié sur les 21 écrans qui les portent. Balayer « toute
 * rangée d'en-tête » ferait donc rougir vingt-et-un écrans qui n'ont jamais eu
 * de place à perdre. D'où le marqueur, posé dans `PublicHeader.tsx`.
 *
 * Rend `null` sur les écrans sans en-tête public : ce n'est pas un manque, la
 * plupart des adresses balayées sont des écrans de l'application. C'est le
 * compteur plus bas qui distingue « absent ici » de « disparu partout ».
 */
const MESURER_JEU = () => {
  const rangee = document.querySelector('[data-mesure="rangee-entete-vitrine"]')
  if (!rangee) return null

  const style = getComputedStyle(rangee)
  const boite = rangee.getBoundingClientRect()
  const dispo = boite.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
  const gouttiere = parseFloat(style.columnGap) || 0

  const enfants = [...rangee.children]
    .filter((e) => getComputedStyle(e).display !== 'none')
    .map((e) => ({
      largeur: Math.round(e.getBoundingClientRect().width),
      nom: e.tagName.toLowerCase(),
    }))
    .filter((e) => e.largeur > 0)
  if (enfants.length === 0) return null

  const occupe = enfants.reduce((a, e) => a + e.largeur, 0) + gouttiere * (enfants.length - 1)
  return {
    jeu: Math.round(dispo - occupe),
    dispo: Math.round(dispo),
    gouttieres: Math.round(gouttiere * (enfants.length - 1)),
    enfants,
  }
}

/**
 * Exécuté DANS la page : les réglages sont-ils atteignables AU CLAVIER ?
 *
 * C'est la dette que contracte le retrait des sélecteurs de la barre. Les
 * confier au menu n'est une simplification que tant que le menu s'ouvre ; le
 * bouton qui l'ouvre portait `xl:hidden`, et le laisser tel quel aurait rendu
 * langue et thème INATTEIGNABLES au-delà de 1280 px. Ce n'aurait pas été une
 * barre allégée, ç'aurait été des réglages perdus — et aucune des trois autres
 * règles de ce fichier ne sait voir une commande absente.
 *
 * AU CLAVIER et non par sélecteur CSS : `display: none` se lit dans le DOM,
 * mais un bouton visible qu'aucune tabulation n'atteint est le même défaut pour
 * qui n'a pas de souris. On part donc du début du document et on tabule.
 */
const PLAFOND_TABULATIONS = 24

/**
 * Rend le grief, ou `null` si les réglages sont atteints.
 *
 * ON NE DÉSIGNE PAS LE BOUTON DU MENU, on cherche ce qui OUVRE LES RÉGLAGES —
 * et la nuance a été payée. Une première version prenait le premier élément
 * focalisable de l'en-tête portant `aria-expanded` : elle est tombée sur le
 * sélecteur de devise, qui en porte un lui aussi, a déplié sa liste, et a
 * rapporté que le panneau des réglages n'existait pas. Un grief exact sur un
 * fait faux — le pire genre, celui qu'on croit.
 *
 * On essaie donc CHAQUE déclencheur rencontré et on retient celui qui rend les
 * réglages visibles, en refermant les autres derrière soi. C'est exactement ce
 * que fait quelqu'un qui cherche où régler sa langue.
 */
async function reglagesAtteignables(page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await attendre(page, '/ (clavier)')
  // Repartir du tout début : sans cela la tabulation continue d'où le
  // chargement a laissé le focus, et le compte de tabulations ne veut rien dire.
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )

  const ETAT = () => {
    const actif = document.activeElement
    const bloc = document.querySelector('[data-mesure="reglages-vitrine"]')
    const boite = bloc?.getBoundingClientRect()
    return {
      declencheur: !!(actif && actif.closest('header') && actif.hasAttribute('aria-expanded')),
      ouverts: !!(boite && boite.width > 0 && boite.height > 0),
      commandes: bloc ? bloc.querySelectorAll('button, select, a[href]').length : 0,
    }
  }

  let essayes = 0
  let etat = null
  for (let i = 0; i < PLAFOND_TABULATIONS; i++) {
    await page.keyboard.press('Tab')
    etat = await page.evaluate(ETAT)
    if (!etat.declencheur) continue

    essayes++
    await page.keyboard.press('Enter')
    etat = await page.evaluate(ETAT)
    if (etat.ouverts) break
    // Refermer ce qui vient de s'ouvrir — une liste déroulante laissée
    // dépliée capte les tabulations suivantes et fausse la suite du parcours.
    await page.keyboard.press('Escape')
    etat = null
  }

  if (!etat?.ouverts) {
    return (
      `réglages non ouverts après ${PLAFOND_TABULATIONS} tabulations depuis le début du document ` +
      `(${essayes} déclencheur(s) essayé(s))`
    )
  }
  if (etat.commandes < 3) {
    return `le bloc des réglages ne porte que ${etat.commandes} commande(s) sur les 3 attendues`
  }

  // Visible ne suffit pas : une commande qu'aucune tabulation n'atteint est
  // absente pour qui n'a pas de souris, et c'est tout le sujet de ce contrôle.
  let dedans = false
  for (let i = 0; i < PLAFOND_TABULATIONS && !dedans; i++) {
    await page.keyboard.press('Tab')
    dedans = await page.evaluate(
      () => !!document.activeElement?.closest('[data-mesure="reglages-vitrine"]'),
    )
  }
  if (!dedans) {
    return `réglages ouverts mais aucune de leurs commandes atteinte en ${PLAFOND_TABULATIONS} tabulations`
  }
  return null
}

/**
 * Exécuté DANS la page : rend la rangée d'en-tête repliée, ou `null`.
 *
 * POURQUOI UNE SECONDE MESURE. Celle du débordement ne pouvait pas voir ce
 * défaut-là, et l'a même masqué : `flex-wrap` a été posé sur la barre de la
 * vitrine pour supprimer un débordement à 1280, ce qu'il a fait — en empilant
 * la barre sur deux rangées. La porte est passée au vert pendant que l'en-tête
 * doublait de hauteur sur un portable ordinaire, mesuré à 131 px.
 *
 * Le repli reste le bon filet : il vaut mieux deux rangées qu'une page qui
 * défile de côté. Ce qu'on interdit, c'est qu'il se déclenche là où la place
 * existe, c'est-à-dire qu'on s'en serve pour ne pas faire entrer le contenu.
 *
 * Le nombre de rangées se lit par les BOÎTES, jamais par `flexWrap` : la classe
 * dit ce qui est permis, pas ce qui arrive. Un enfant dont le haut atteint le
 * bas d'un autre commence une rangée nouvelle — la tolérance d'un pixel écarte
 * les arrondis, et `items-center` suffit à décaler des enfants de hauteurs
 * différentes sans qu'ils changent de rangée pour autant.
 */
const MESURER_REPLI = () => {
  const replies = []
  for (const entete of document.querySelectorAll('header')) {
    for (const rangee of entete.querySelectorAll('*')) {
      const style = getComputedStyle(rangee)
      if (style.display !== 'flex' || style.flexWrap !== 'wrap') continue

      const boites = [...rangee.children]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0)
      if (boites.length < 2) continue

      const empile = boites.some((a) => boites.some((b) => a.top >= b.bottom - 1))
      if (!empile) continue

      replies.push({
        classes: typeof rangee.className === 'string' ? rangee.className.slice(0, 110) : '',
        hauteur: Math.round(entete.getBoundingClientRect().height),
        enfants: boites.map((b) => Math.round(b.width)),
      })
    }
  }
  return replies.length > 0 ? replies : null
}

/** Exécuté DANS la page : rend les coupables, ou `null` si rien ne déborde. */
const MESURER = () => {
  const avant = window.scrollX
  window.scrollTo(400, 0)
  const decalage = window.scrollX
  window.scrollTo(avant, 0)
  if (!decalage) return null

  const largeurVue = document.documentElement.clientWidth
  const coupables = []
  for (const el of document.querySelectorAll('*')) {
    const boite = el.getBoundingClientRect()
    if (boite.width === 0) continue
    if (boite.right <= largeurVue + 1) continue

    // Un élément large À L'INTÉRIEUR d'un conteneur qui défile n'est pas un
    // coupable : c'est le motif normal des tableaux du dépôt.
    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const debordement = getComputedStyle(ancetre).overflowX
      if (debordement === 'auto' || debordement === 'scroll' || debordement === 'hidden') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    coupables.push({
      balise: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className.slice(0, 110) : '',
      largeur: Math.round(boite.width),
      bordDroit: Math.round(boite.right),
      texte: (el.textContent || '').trim().slice(0, 44),
    })
  }
  return { decalage, largeurVue, coupables: coupables.slice(0, 6) }
}

/** Construit le paquet : la garde mesure ce qui sera livré, pas les sources. */
function construire() {
  return new Promise((resolve, reject) => {
    const fils = spawn('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: RACINE })
    let erreur = ''
    fils.stderr.on('data', (d) => (erreur += d))
    fils.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build a échoué :\n${erreur}`)))) 
  })
}

/** Sert le paquet, et rend de quoi l'arrêter quoi qu'il arrive ensuite. */
async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let essai = 0; essai < 60; essai++) {
    try {
      const reponse = await fetch(BASE + '/')
      if (reponse.ok) return fils
    } catch {
      /* Le serveur n'écoute pas encore. */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error(`mesure-ui : le serveur de prévisualisation n'a pas répondu sur ${BASE}`)
}

/**
 * LA FUITE — exacte, sans seuil, jamais relevée.
 *
 * Le lot qui a posé le budget d'octets (85e12e0) confondait deux questions :
 * « le mauvais module est-il présent ? » et « le paquet est-il trop lourd ? ».
 * La première se répond par oui ou non ; en faire un seuil en octets voulait
 * dire qu'un import oublié de 200 o pouvait rester invisible tant que la
 * marge tenait, et que la marge, elle, devait rester assez SERRÉE pour
 * l'attraper — au prix de rougir bientôt pour une raison parfaitement
 * légitime : les dictionnaires i18n grossissent d'eux-mêmes, un peu à chaque
 * lot qui ajoute une chaîne visible.
 *
 * ICI ON NE PÈSE RIEN. On lit `.carte-des-paquets.json`, que
 * `vite.config.ts` écrit à chaque build (voir son plugin `carte-des-paquets`
 * pour pourquoi CE moment et pourquoi hors de `dist/`), et on demande une
 * seule chose : aucun des modules réservés à l'application n'apparaît dans un
 * paquet qui N'EST PAS une entrée dynamique. Peu importe qu'il pèse 200 o ou
 * 70 Ko — la question n'est pas combien, c'est présent ou absent.
 */
function mesurerFuite() {
  const chemin = join(RACINE, '.carte-des-paquets.json')
  const carte = JSON.parse(readFileSync(chemin, 'utf8'))
  const reserves = modulesReservesALApplication()

  const fautifs = []
  for (const [nomPaquet, info] of Object.entries(carte)) {
    if (info.isDynamicEntry) continue // C'est là qu'ils ONT LE DROIT d'être.
    for (const module of info.modules) {
      if (reserves.includes(module)) fautifs.push({ module, paquet: nomPaquet })
    }
  }
  return { fautifs, reserves }
}

/**
 * LE BUDGET DU PREMIER CHARGEMENT — ce qu'un prospect télécharge avant de lire
 * la première phrase de vente.
 *
 * SUJET DIFFÉRENT des six règles plus bas, et c'est pour cela qu'il est
 * mesuré à PART : elles regardent ce qu'une page affiche une fois peinte,
 * celui-ci regarde ce qui a dû ARRIVER par le réseau pour qu'elle le soit.
 * Marché visé : Afrique de l'Ouest, réseau mobile, appareils d'entrée de
 * gamme — l'octet compte plus ici qu'un plancher de contraste ne le laisse
 * deviner.
 *
 * MESURÉ avant ce lot : un seul paquet, 176 Ko compressés de JavaScript, pour
 * TOUTE adresse. `vite build` le disait déjà à chaque passage
 * (« chunks larger than 500 kB ») et rien n'écoutait, parce qu'un avertissement
 * qui ne fait pas rougir n'est pas une garde.
 *
 * `React.lazy` (voir `src/App.tsx`) scinde désormais la vitrine — `/`,
 * `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser` — de
 * l'espace applicatif — tout ce qui vit sous `/app` et `/demo`. UNE frontière,
 * pas vingt : un gestionnaire qui passe d'un écran de gestion à l'autre ne la
 * retraverse jamais, et un découpage par écran lui aurait fait payer un
 * aller-retour réseau à chaque clic dans la barre latérale pour économiser un
 * octet qu'un visiteur de la vitrine ne télécharge de toute façon jamais.
 *
 * `PortfolioProvider` a suivi l'espace applicatif et non la vitrine, alors que
 * rien ne l'imposait par la seule forme des routes : mesuré, il pèse À LUI
 * SEUL 70 Ko compressés, plus que les vingt écrans de gestion réunis (39 Ko),
 * et `usePortfolio` n'a AUCUN consommateur public. Le laisser envelopper
 * `<App/>` dans `main.tsx`, comme avant ce lot, aurait rendu le découpage des
 * routes presque cosmétique : la vitrine aurait continué de le télécharger en
 * entier.
 *
 * CE QUI RESTE DANS LA VITRINE ET N'A PAS BOUGÉ, mesuré et volontairement hors
 * du champ de ce lot : le dictionnaire de traduction (`src/i18n/fr.ts` +
 * `en.ts`), chargé pour les deux langues à la fois parce qu'`I18nProvider`
 * l'importe tel quel. Le scinder par écran est un AUTRE sujet, avec ses
 * propres risques — la forme de `useT()`, l'hypothèse qu'une clé existe
 * toujours, `scripts/check-i18n.mjs` — et UN LOT reste UN SUJET. Ce qui EST du
 * ressort de ce fichier, en revanche, c'est de ne pas confondre SA croissance
 * normale avec un accident : voir `BUDGET_PREMIER_CHARGEMENT`, plus bas, et
 * `mesurerFuite`, plus haut, qui se partagent désormais la question que ce
 * seul nombre essayait de couvrir seul.
 */
function mesurerPremierChargement() {
  const html = readFileSync(join(RACINE, 'dist/index.html'), 'utf8')

  /*
    LES ACTIFS SE LISENT DANS `index.html`, jamais recopiés par leur nom.

    Un nom de fichier construit porte un hachage de contenu — `index-C9xSCgIn.js`
    — qui change à chaque build. Le lire ailleurs que dans le HTML que Vite
    vient d'écrire se périmerait au build suivant. `index.html` liste
    exactement, et seulement, ce qu'un navigateur télécharge SANS ATTENDRE :
    le `<script type="module">` d'entrée et sa feuille de style. Le paquet
    paresseux n'y figure PAS — c'est tout le sujet de ce lot — donc le lire
    ainsi mesure le premier chargement par construction, sans avoir à savoir
    quel fichier est « le bon ».
  */
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])

  // Locaux seulement : la police Google Fonts est un lien externe, déjà
  // mesurée et tranchée ailleurs — `index.html` porte l'argumentaire complet
  // de ce choix. Ce budget porte sur ce que CE dépôt construit et sert.
  const locaux = [...scripts, ...styles].filter((href) => href.startsWith('/'))

  const detail = locaux.map((href) => {
    const octets = gzipSync(readFileSync(join(RACINE, 'dist', href.replace(/^\//, '')))).length
    return { href, octets }
  })
  return { octets: detail.reduce((a, d) => a + d.octets, 0), detail }
}

/**
 * Le plafond — un seuil de DÉRIVE, plus un seuil d'ACCIDENT.
 *
 * `mesurerFuite`, plus haut, tient désormais l'accident : un import oublié
 * rougit EXACTEMENT, quel que soit son poids. Ce budget-ci n'a donc plus
 * besoin d'être serré au point de confondre les deux — ce que le lot 85e12e0
 * faisait, à 2 821 o de marge, en écrivant lui-même sa propre condamnation :
 * les dictionnaires i18n pèsent 34 Ko DANS ce paquet, chaque chaîne visible
 * ajoutée en ajoute deux (fr et en), et une marge de 3 Ko se dépasse par la
 * croissance la plus ordinaire qui soit.
 *
 * MESURÉ, la croissance ordinaire : gzip de `src/i18n/fr.ts` + `en.ts`,
 * séparément, sur les quinze derniers commits qui les ont touchés (20 août
 * 17h06 → 21 août 11h39) —
 *
 *   moyenne   156 o / commit
 *   médiane    99 o / commit
 *   plus gros bond isolé   665 o  (« l'écran des accès dit ce qu'il sait… »)
 *
 * Gzipper le dictionnaire à part plutôt que dans le paquet entier majore
 * légèrement ce chiffre — le flux combiné compresse au moins aussi bien,
 * jamais moins bien — ce qui va dans le sens PRUDENT : la marge ci-dessous ne
 * sous-estime pas la croissance réelle.
 *
 * BASE MESURÉE APRÈS CE LOT : 145 010 o (132 991 de JavaScript, 12 019 de
 * CSS). MARGE : 3 990 o, soit environ VINGT-CINQ lots à la moyenne mesurée, ou
 * SIX au rythme du plus gros bond observé — de quoi laisser la vitrine
 * grossir un moment sans qu'on y pense, pas indéfiniment.
 *
 * LA CONTREPARTIE, ÉCRITE, parce qu'une marge plus large est aussi une marge
 * plus lente à dire « il est temps de scinder le dictionnaire » : passé ce
 * nombre de lots, la porte rougira pour une raison entièrement légitime, et
 * ce sera le signal — pas un accident à corriger, un sujet à ouvrir (voir la
 * note plus haut sur pourquoi ce lot n'y touche pas). Relever ce chiffre sans
 * remesurer la croissance resterait la même faute que celle qu'il corrige.
 */
const BUDGET_PREMIER_CHARGEMENT = 149_000

/*
  GARDE DU GARDE : un budget hors de toute plage plausible ne défend rien.

  À zéro ou en dessous, la porte rougirait sur CHAQUE build, y compris un
  premier chargement vide — elle cesserait de distinguer un dépassement d'une
  absence de mesure. Au-delà d'un mégaoctet, elle ne rougirait plus JAMAIS :
  le premier chargement entier de ce dépôt, vitrine ET application réunies,
  ne l'atteint pas avant ce lot (176 Ko). La même asymétrie que pour
  `JEU_MINIMAL` : un seuil trop haut se corrige de lui-même en restant
  muet, c'est le silence qu'on interdit ici.
*/
if (BUDGET_PREMIER_CHARGEMENT <= 0 || BUDGET_PREMIER_CHARGEMENT > 1_000_000) {
  console.error(
    `\n✗ mesure-ui : le budget du premier chargement vaut ${BUDGET_PREMIER_CHARGEMENT} o.\n` +
      "   Hors de [1, 1 000 000], il ne peut plus jouer son rôle de plafond.\n",
  )
  process.exit(1)
}

const adresses = adressesDeLApplication()

/*
  LU AU DÉMARRAGE, avant le build : si le fichier a disparu ou n'est plus
  lisible, on veut l'apprendre en une seconde et non après trois minutes de
  balayage. `readFileSync` jette de lui-même, et c'est le comportement voulu.
*/
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')

await construire()

/*
  LA FUITE SE VÉRIFIE AVANT LE POIDS — la question binaire avant la question
  de degré. Un module réservé qui a fui EST un défaut quel que soit son poids ;
  le savoir tout de suite évite de lire un dépassement de budget comme
  « il faut relever le nombre » alors que la vraie réponse est « il faut
  retirer cet import ». Ni l'un ni l'autre n'a besoin d'un serveur ou d'un
  navigateur — même raison qu'ailleurs dans ce fichier : inutile de passer
  huit minutes à ouvrir vingt-trois écrans pour confirmer ce qu'on sait déjà.
*/
const fuite = mesurerFuite()

/*
  GARDE DU GARDE : la liste des modules réservés doit avoir trouvé quelque
  chose. `EspaceApplicatif.tsx` sans un seul import correspondant aux préfixes
  attendus — un renommage de dossier, une réécriture qui change de forme —
  viderait `reserves`, et la règle dirait « aucune fuite » en n'ayant rien à
  vérifier. La même panne que partout ailleurs dans ce fichier.
*/
if (fuite.reserves.length === 0) {
  console.error(
    `\n✗ mesure-ui : aucun module réservé à l'application déduit d'EspaceApplicatif.tsx.\n` +
      "   La règle de fuite ne vérifie plus rien — ce n'est pas une absence de fuite.\n",
  )
  process.exit(1)
}

if (fuite.fautifs.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${fuite.fautifs.length} module(s) réservé(s) à l'application présent(s) ` +
      `dans un paquet impatient.\n`,
  )
  for (const f of fuite.fautifs) console.error(`   ${f.module}  →  ${f.paquet}`)
  console.error(
    '\n   Peu importe son poids : ce module ne devrait être atteignable QUE derrière\n' +
      "   `React.lazy` — voir `src/App.tsx` et `src/app/EspaceApplicatif.tsx`.\n",
  )
  process.exit(1)
}

/*
  MESURÉ TOUT DE SUITE APRÈS LE BUILD, avant même de lancer un serveur ou un
  navigateur — cette règle n'a besoin ni de l'un ni de l'autre. Un dépassement
  ici dit « le mauvais code est déjà arrivé sur le disque », ce qui vaut la
  peine de le savoir avant de passer huit minutes à ouvrir vingt-trois écrans.
*/
const premierChargement = mesurerPremierChargement()

/*
  VÉRIFIÉ ICI, PAS PLUS BAS — c'est ce qui rend vraie la phrase juste
  au-dessus : « inutile de passer huit minutes ». Calculer `premierChargement`
  puis vérifier son seuil seulement dans le rapport final, après le balayage
  complet des vingt-trois écrans, aurait mesuré tôt et échoué tard — la même
  panne, en somme, que celle que ce fichier reproche à `contrast-audit.js`
  d'avoir vécue avant d'être lancé : une mesure qui existe ne sert à rien tant
  que rien ne la LIT au bon moment.
*/
if (premierChargement.detail.length === 0) {
  console.error(
    `\n✗ mesure-ui : aucun actif du premier chargement trouvé dans dist/index.html.\n` +
      "   La lecture ne regarde plus rien — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

if (premierChargement.octets > BUDGET_PREMIER_CHARGEMENT) {
  console.error(
    `\n✗ mesure-ui : premier chargement de la vitrine à ${premierChargement.octets} o compressés, ` +
      `au-delà du budget de ${BUDGET_PREMIER_CHARGEMENT} o.\n`,
  )
  for (const d of premierChargement.detail) console.error(`   ${d.octets} o  ${d.href}`)
  console.error(
    "\n   Ce n'est PAS une fuite — `mesurerFuite`, juste au-dessus, vient de le confirmer.\n" +
      "   C'est une dérive : la vitrine a grossi au-delà de la marge que ce fichier lui\n" +
      '   accorde. Remesure la croissance des dictionnaires (voir `BUDGET_PREMIER_CHARGEMENT`)\n' +
      "   avant de relever ce nombre — le relever sans remesurer ne garde plus rien.\n",
  )
  process.exit(1)
}

const serveur = await servir()
const echecs = []
const reproches = []
const etroitesses = []
const inatteignables = []
// Compte les rangées d'en-tête public RÉELLEMENT mesurées. Le marqueur retiré,
// `MESURER_JEU` rendrait `null` partout et la porte dirait « aucune barre trop
// serrée » sans en avoir regardé une seule — la panne qu'`ATTENDUES` surveille
// déjà pour la liste des adresses, et la garde du garde plus bas pour le seuil.
let rangeesMesurees = 0
const tolerancesUtilisees = new Set()

const contrastes = new Map()
const contrastesTolerancesUtilisees = new Set()
// Même raison qu'`ATTENDUES` et que `rangeesMesurees` : « aucun texte sous le
// seuil » et « aucun texte regardé » s'écrivent pareil dans un journal.
let textesAudites = 0
// Le fond du corps par thème. Si les deux thèmes rendent la même chose, la
// moitié sombre du balayage n'est qu'un décor — voir la garde du garde.
const fondsParTheme = new Map()

const ciblesTrop_petites = new Map()
const raisonsEmployees = new Set()
let ciblesSondees = 0

try {
  const navigateur = await chromium.launch()
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEURS[0], height: 900 },
      locale: langue,
    })
    const page = await contexte.newPage()
    for (const adresse of adresses) {
      // Le balayage DIT où il en est. Sans cela il reste muet une demi-heure,
      // et rien ne distingue « il travaille » de « il est bloqué » — l'état
      // dans lequel on désactive une porte plutôt que de la lire.
      const depart = Date.now()
      process.stdout.write(`   ${langue}  ${adresse} … `)
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await attendre(page, adresse)
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await attendre(page, adresse)
        if (largeur >= LARGEUR_SANS_REPLI) {
          const replis = await page.evaluate(MESURER_REPLI)
          if (replis) for (const r of replis) reproches.push({ adresse, largeur, langue, ...r })

          // Au-delà de la bande, la largeur utile ne bouge plus : c'est là, et
          // là seulement, qu'un plancher en pixels veut dire quelque chose. En
          // dessous, la bande suit la fenêtre et le jeu doit pouvoir fondre.
          const place = await page.evaluate(MESURER_JEU)
          if (place) {
            rangeesMesurees++
            if (place.jeu < JEU_MINIMAL) etroitesses.push({ adresse, largeur, langue, ...place })
          }
        }

        const resultat = await page.evaluate(MESURER)
        if (!resultat) continue
        const cle = `${adresse}@${largeur}`
        if (TOLERES[cle]) {
          tolerancesUtilisees.add(cle)
          continue
        }
        echecs.push({ adresse, largeur, langue, ...resultat })
      }
      process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
    }

    // Une fois par langue, et non par écran : la barre est la même partout, et
    // la tabulation coûte un aller-retour par touche.
    process.stdout.write(`   ${langue}  réglages au clavier à 1440 px … `)
    const manque = await reglagesAtteignables(page)
    process.stdout.write(manque ? 'ÉCHEC\n' : 'ok\n')
    if (manque) inatteignables.push({ langue, manque })

    await contexte.close()
  }

  /*
    PASSE SÉPARÉE, et non une règle de plus dans la boucle ci-dessus.

    Les deux passes n'ont pas les mêmes axes : la mise en page balaie onze
    largeurs et ignore le thème (les boîtes ne changent pas de taille selon la
    couleur) ; le contraste balaie deux thèmes et se contente de deux largeurs.
    Les fondre donnerait le produit des deux — 506 arrêts au lieu de 322 — pour
    mesurer partout des choses qui ne varient que quelque part.

    Ce qu'elles PARTAGENT est ce qui coûte cher, et c'est déjà mutualisé : un
    seul `vite build`, un seul serveur, un seul navigateur.
  */
  for (const langue of LANGUES) {
    for (const theme of THEMES) {
      const contexte = await navigateur.newContext({
        viewport: { width: LARGEURS_CONTRASTE[0], height: 900 },
        locale: langue,
        colorScheme: theme,
      })
      const page = await contexte.newPage()
      for (const adresse of adresses) {
        const depart = Date.now()
        process.stdout.write(`   ${langue}  ${theme}  ${adresse} … `)
        for (const largeur of LARGEURS_CONTRASTE) {
          await page.setViewportSize({ width: largeur, height: 900 })
          // On recharge à la première largeur seulement : le reste est un
          // redimensionnement, comme dans la passe de mise en page.
          if (largeur === LARGEURS_CONTRASTE[0]) {
            await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
          }
          await attendre(page, adresse)

          if (adresse === '/' && largeur === LARGEURS_CONTRASTE[0]) {
            fondsParTheme.set(
              theme,
              await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
            )
          }

          const audit = await page.evaluate(AUDIT_CONTRASTE)
          if (!audit || typeof audit.examines !== 'number') {
            throw new Error(
              "mesure-ui : `contrast-audit.js` n'a pas rendu `{ failures, items, examines }`. " +
                "Son expression doit rester une IIFE qui s'évalue en cet objet.",
            )
          }
          textesAudites += audit.examines

          for (const item of audit.items) {
            // Dédupliqué sur la FORME du défaut, pas sur l'endroit : le même
            // couple encre/fond rapporté vingt fois est un seul correctif, et
            // vingt lignes de rapport cachent le deuxième défaut.
            const cle = `${item.text}|${item.color}|${item.bg}`
            if (!contrastes.has(cle)) contrastes.set(cle, { ...item, ou: `${adresse} ${largeur}px ${langue} ${theme}` })
          }
        }
        process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
      }
      await contexte.close()
    }
  }


  /*
    TROISIÈME PASSE, et son axe n'est ni celui des deux autres.

    Une cible ne dépend pas du THÈME — repeindre un bouton ne le déplace pas —
    mais elle dépend de la LANGUE, « Tarifs » n'ayant pas la largeur de
    « Pricing », et de la largeur de fenêtre, qui redistribue les colonnes. Un
    thème, deux langues, deux largeurs.

    Elle vient EN DERNIER parce qu'elle est la seule à faire défiler la page :
    `elementFromPoint` ne répond que dans le cadre visible. La sonde remet le
    défilement à zéro en sortant, mais la passer avant le contraste ferait
    dépendre une mesure de couleur du travail d'une mesure de géométrie —
    l'en-tête collant change de fond dès le neuvième pixel de défilement.
  */
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEURS_CONTRASTE[0], height: 900 },
      locale: langue,
    })
    const page = await contexte.newPage()
    for (const adresse of adresses) {
      const depart = Date.now()
      process.stdout.write(`   ${langue}  cibles  ${adresse} … `)
      for (const largeur of LARGEURS_CONTRASTE) {
        await page.setViewportSize({ width: largeur, height: 900 })
        if (largeur === LARGEURS_CONTRASTE[0]) {
          await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
        }
        await attendre(page, adresse)

        const releve = await page.evaluate(MESURER_CIBLES, {
          plancher: PLANCHER_CIBLE,
          rayon: RAYON_SONDAGE,
        })
        ciblesSondees += releve.sondees
        for (const raison of releve.raisonsVues) raisonsEmployees.add(raison)

        for (const defaut of releve.defauts) {
          // Une raison DÉCLARÉE mais inconnue n'exempte rien : elle serait une
          // dérogation que personne n'a motivée, exactement ce que la doctrine
          // des `TOLERES` interdit. On la laisse donc tomber dans les défauts,
          // et la garde du garde plus bas la nommera.
          if (defaut.raison && CIBLES_EXEMPTES[defaut.raison]) continue
          const cle = `${defaut.balise}|${defaut.cible}|${defaut.classes}`
          if (!ciblesTrop_petites.has(cle)) {
            ciblesTrop_petites.set(cle, { ...defaut, ou: `${adresse} ${largeur}px ${langue}` })
          }
        }
      }
      process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
    }
    await contexte.close()
  }

  await navigateur.close()
} finally {
  serveur.kill()
}

/*
  LE RAPPORT DE LENTEUR SORT EN PREMIER, avant tout `process.exit`.

  Écrit après les blocs d'échec, il ne s'imprimait jamais le jour où il compte :
  celui où la porte rougit. Or c'est précisément là qu'on veut savoir si le
  balayage a duré huit minutes parce qu'un écran ne se stabilise pas.
*/
if (lenteurs.size > 0) {
  console.warn(`\n⚠ ${lenteurs.size} attente(s) dépassée(s) — un écran qui ne se stabilise pas :`)
  for (const [cle, n] of [...lenteurs].sort((a, b) => b[1] - a[1])) console.warn(`   ${n}× ${cle}`)
}

// Garde du garde : une tolérance qui ne couvre plus rien doit mourir, sinon
// la liste devient un cimetière qui blanchit des défauts à venir.
const orphelines = Object.keys(TOLERES).filter((cle) => !tolerancesUtilisees.has(cle))
if (orphelines.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${orphelines.length} tolérance(s) ne couvrent plus aucun débordement.\n` +
      orphelines.map((cle) => `   ${cle} — à retirer de TOLERES`).join('\n'),
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : le marqueur de la rangée doit avoir été TROUVÉ.

  `MESURER_JEU` rend `null` sur les écrans sans en-tête public, ce qui est
  normal — la plupart des adresses balayées sont des écrans de l'application.
  Mais il rend aussi `null` si le marqueur disparaît de `PublicHeader.tsx`, et
  la porte dirait alors « aucune barre trop serrée » en n'en ayant regardé
  aucune. Compter les rangées vues sépare les deux : c'est le même raisonnement
  qu'`ATTENDUES` pour les adresses, et il s'est déjà payé une fois.
*/
if (rangeesMesurees === 0) {
  console.error(
    "\n✗ mesure-ui : la rangée de l'en-tête public n'a été mesurée nulle part.\n" +
      '   Le marqueur `data-mesure="rangee-entete-vitrine"` a disparu — la règle du jeu\n' +
      "   minimal ne s'exécuterait jamais, et ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : l'audit doit avoir REGARDÉ quelque chose.

  Zéro texte examiné se lit « aucun contraste sous le seuil » dans le journal
  final — c'est la panne exacte que ce fichier reproche déjà à `contrast-audit`
  d'avoir subie pendant des lots, à ceci près qu'elle serait désormais SILENCIEUSE
  au lieu d'être seulement oubliée. Le seuil est volontairement grossier : on
  n'estime pas le bon nombre de textes du produit, on distingue « il a travaillé »
  de « il n'a rien vu ».
*/
const TEXTES_ATTENDUS = 500

if (textesAudites < TEXTES_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${textesAudites} textes audités en contraste, moins que les ${TEXTES_ATTENDUS} attendus.\n` +
      "   L'audit ne regarde plus rien — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : les deux thèmes doivent rendre DEUX choses.

  `colorScheme` ne force pas un thème, il pose `prefers-color-scheme` — et
  l'application est libre de ne pas le suivre. Le jour où elle cesse de le
  suivre, ou le jour où `THEMES` se retrouve à deux entrées identiques, la
  moitié sombre du balayage devient un décor : même palette mesurée deux fois,
  rapportée comme deux thèmes vérifiés. Or c'est précisément en sombre que
  vivent les jetons qu'aucun oeil ne relit.

  Le fond du corps de la page d'accueil suffit à trancher : il vaut #efebe2 en
  clair et #100e0b en sombre.
*/
const fondsDistincts = new Set(fondsParTheme.values())
if (fondsDistincts.size < THEMES.length) {
  console.error(
    `\n✗ mesure-ui : les ${THEMES.length} thèmes balayés rendent ${fondsDistincts.size} fond(s) distinct(s).\n` +
      "   Une palette mesurée deux fois n'est pas deux palettes vérifiées.\n",
  )
  for (const [theme, fond] of fondsParTheme) console.error(`   ${theme} → ${fond}`)
  console.error('')
  process.exit(1)
}

/*
  GARDE DU GARDE : la sonde des cibles doit avoir SONDÉ.

  Même panne, même remède qu'ailleurs dans ce fichier : un sélecteur qui ne
  rend plus rien écrit « aucune cible sous le plancher » dans le journal final.
  Le seuil est grossier à dessein — on distingue « il a travaillé » de « il n'a
  rien vu », on n'estime pas le bon nombre de commandes du produit.
*/
const CIBLES_ATTENDUES = 500

if (ciblesSondees < CIBLES_ATTENDUES) {
  console.error(
    `\n✗ mesure-ui : ${ciblesSondees} cibles sondées, moins que les ${CIBLES_ATTENDUES} attendues.\n` +
      "   La sonde ne regarde plus rien — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE, DANS LES DEUX SENS : les raisons déclarées et les raisons
  admises doivent se recouvrir exactement.

  Une raison ADMISE que plus aucun élément ne porte est une dérogation
  orpheline — le cimetière qui blanchit le prochain défaut, comme pour
  `TOLERES`. Une raison PORTÉE que rien n'admet est pire : c'est une exemption
  que personne n'a motivée, obtenue en écrivant un attribut. La première fait
  rougir ici ; la seconde fait rougir plus bas, parce que l'élément retombe
  dans les défauts ordinaires et s'y voit nommer.
*/
const raisonsOrphelines = Object.keys(CIBLES_EXEMPTES).filter((r) => !raisonsEmployees.has(r))
if (raisonsOrphelines.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${raisonsOrphelines.length} raison(s) d'exemption de cible ne couvrent plus rien.\n` +
      raisonsOrphelines.map((r) => `   data-cible="${r}" — à retirer de CIBLES_EXEMPTES`).join('\n') +
      '\n',
  )
  process.exit(1)
}

const raisonsNonMotivees = [...raisonsEmployees].filter((r) => !CIBLES_EXEMPTES[r])
if (raisonsNonMotivees.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${raisonsNonMotivees.length} raison(s) d'exemption portée(s) sans être motivée(s).\n` +
      "   Une exemption s'obtient en l'argumentant dans CIBLES_EXEMPTES, pas en écrivant un attribut.\n" +
      raisonsNonMotivees.map((r) => `   data-cible="${r}"`).join('\n') +
      '\n',
  )
  process.exit(1)
}

/*
  LES RÉGLAGES SORTENT AVANT TOUT LE RESTE : une commande qu'on ne peut plus
  atteindre est pire qu'une barre serrée. Les trois autres règles de ce fichier
  regardent des pixels ; celle-ci regarde une absence, et aucune des trois ne
  sait la voir — retirer un bouton fait toujours de la place.
*/
if (inatteignables.length > 0) {
  console.error(
    `\n✗ mesure-ui : les réglages de la vitrine ne sont plus atteignables au clavier à 1440 px.\n` +
      "   La barre les a confiés au menu ; le menu doit donc s'ouvrir à TOUTE largeur.\n",
  )
  for (const i of inatteignables) console.error(`   ${i.langue}  →  ${i.manque}`)
  console.error('')
  process.exit(1)
}

/*
  PUIS LE CONTRASTE : après ce qu'on ne peut pas atteindre, ce qu'on ne peut pas
  lire. Les trois règles qui suivent regardent la mise en page ; ces deux-ci
  regardent l'usage, et une barre parfaitement rangée dont le texte est
  illisible n'est pas une barre qui va bien.
*/
const contrastesOrphelins = Object.keys(CONTRASTES_TOLERES).filter(
  (cle) => !contrastesTolerancesUtilisees.has(cle),
)
if (contrastesOrphelins.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${contrastesOrphelins.length} tolérance(s) de contraste ne couvrent plus rien.\n` +
      contrastesOrphelins.map((cle) => `   ${cle} — à retirer de CONTRASTES_TOLERES`).join('\n') +
      '\n',
  )
  process.exit(1)
}

const sousLeSeuil = [...contrastes.values()]
  .filter((c) => {
    if (!CONTRASTES_TOLERES[c.text]) return true
    contrastesTolerancesUtilisees.add(c.text)
    return false
  })
  .sort((a, b) => a.ratio - b.ratio)

if (sousLeSeuil.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${sousLeSeuil.length} forme(s) de texte sous le seuil WCAG AA, sur ${textesAudites} audités.\n` +
      '   Le ratio requis vaut 3 pour du grand texte, 4,5 sinon.\n',
  )
  for (const c of sousLeSeuil) {
    console.error(`   ${c.ratio} / ${c.required}   ${c.fontSize}px poids ${c.weight}   ${JSON.stringify(c.text)}`)
    console.error(`      ${c.color} sur ${c.bg}   vu à ${c.ou}`)
  }
  console.error('')
  process.exit(1)
}

/*
  PUIS LES CIBLES : après ce qu'on ne peut pas atteindre et ce qu'on ne peut pas
  lire, ce qu'on ne peut pas viser. Les trois se rapportent avant la mise en
  page pour la même raison — aucune mesure de boîte ne les voit.
*/
if (ciblesTrop_petites.size > 0) {
  const liste = [...ciblesTrop_petites.values()]
  console.error(
    `\n✗ mesure-ui : ${liste.length} forme(s) de cible sous ${PLANCHER_CIBLE} px, sur ${ciblesSondees} sondées.\n` +
      '   La taille rendue est celle que le doigt TOUCHE, pseudo-éléments compris — pas celle de la boîte.\n',
  )
  for (const c of liste) {
    console.error(`   cible ${c.cible}  (boîte ${c.boite})  <${c.balise}> ${JSON.stringify(c.texte)}`)
    console.error(`      vu à ${c.ou}   class="${c.classes}"`)
    if (c.raison) console.error(`      data-cible="${c.raison}" — raison NON MOTIVÉE dans CIBLES_EXEMPTES`)
  }
  console.error('')
  process.exit(1)
}

/*
  L'ORDRE DES TROIS RÈGLES VA DU SIGNAL LE PLUS TÔT AU SYMPTÔME LE PLUS TARD :
  jeu trop faible, puis repli, puis débordement.

  C'est le même raisonnement que celui qui met déjà le repli avant le
  débordement, poussé d'un cran. Le jeu nomme la CAUSE — il rend la largeur de
  chaque enfant, donc où les pixels sont partis. Le repli ne dit que « la barre
  a doublé de hauteur », le débordement que « la page défile ». Quand les trois
  rougissent ensemble, c'est le premier qu'on veut lire.
*/
if (etroitesses.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${etroitesses.length} mesure(s) où la barre de la vitrine garde moins de ${JEU_MINIMAL} px de jeu.\n` +
      "   Rien ne se replie encore : c'est justement l'état d'avant, celui qu'on veut voir.\n",
  )
  for (const e of etroitesses) {
    console.error(`   ${e.adresse}  ${e.largeur}px  ${e.langue}  →  jeu=${e.jeu}px (seuil ${JEU_MINIMAL})`)
    console.error(
      `      bande=${e.dispo}  enfants=${e.enfants.map((x) => `${x.nom}:${x.largeur}`).join(' + ')}  gouttières=${e.gouttieres}`,
    )
  }
  console.error('')
  process.exit(1)
}

/*
  LE REPLI SORT AVANT LE DÉBORDEMENT, et ce n'est pas un détail d'ordre.

  Poser `flex-wrap` supprime un débordement en créant un repli. Rapporter le
  repli en premier évite de refaire l'échange qui a produit ce défaut : lire
  « débordement », poser un repli, voir le vert, et livrer une barre deux fois
  plus haute.
*/
if (reproches.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${reproches.length} rangée(s) d'en-tête repliée(s) à ${LARGEUR_SANS_REPLI} px ou plus.\n` +
      "   La place existe : c'est le contenu qui doit entrer, pas la barre qui doit s'empiler.\n",
  )
  for (const r of reproches) {
    console.error(`   ${r.adresse}  ${r.largeur}px  ${r.langue}  →  en-tête de ${r.hauteur}px`)
    console.error(`      enfants=${r.enfants.join(' + ')}  class="${r.classes}"`)
  }
  console.error('')
  process.exit(1)
}

if (echecs.length > 0) {
  console.error(`\n✗ mesure-ui : ${echecs.length} débordement(s) latéral(aux).\n`)
  for (const e of echecs) {
    console.error(`   ${e.adresse}  ${e.largeur}px  ${e.langue}  →  scrollX=${e.decalage}`)
    for (const c of e.coupables) {
      console.error(`      <${c.balise}> largeur=${c.largeur} bordDroit=${c.bordDroit} (fenêtre ${e.largeurVue})`)
      console.error(`         class="${c.classes}"`)
      if (c.texte) console.error(`         texte=${JSON.stringify(c.texte)}`)
    }
  }
  console.error('')
  process.exit(1)
}

console.log(
  `\n✓ mesure-ui : ${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues, aucun débordement latéral ni en-tête replié.\n` +
    `  ${fuite.reserves.length} modules réservés à l'application, aucun dans un paquet impatient.\n` +
    `  Premier chargement de la vitrine : ${premierChargement.octets} o compressés, sous le budget de ${BUDGET_PREMIER_CHARGEMENT} o.\n` +
    `  ${rangeesMesurees} mesures de la barre de la vitrine, toutes au-dessus de ${JEU_MINIMAL} px de jeu ; réglages atteints au clavier à 1440 px dans les deux langues.\n` +
    `  ${textesAudites} textes audités en contraste (${THEMES.join(' + ')}, ${LARGEURS_CONTRASTE.join(' et ')} px), aucun sous le seuil WCAG AA.\n` +
    `  ${ciblesSondees} cibles sondées au point de contact, aucune sous ${PLANCHER_CIBLE} px hors les ${Object.keys(CIBLES_EXEMPTES).length} exemptions motivées.`,
)
