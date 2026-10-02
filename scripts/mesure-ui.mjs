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
 * `mesurerFuite` demande si un module réservé — à l'application, ou depuis ce
 * lot à sa propre frontière paresseuse comme `i18n/en.ts` — est présent dans
 * un paquet impatient : oui ou non, sans seuil, jamais relevée.
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
import { join } from 'node:path'
import { chromium } from 'playwright'

/*
  LA LISTE D'EXEMPTIONS EST IMPORTÉE, ET SON ABSENCE EST UNE PANNE.

  Un `import` manquant lève de lui-même, et c'est la bonne façon : une porte
  dont le fichier d'exemptions a disparu ne doit pas démarrer en croyant
  n'avoir rien à exempter. Elle rendrait alors « aucun défaut » sur un dépôt
  où l'écran connu comme non mesurable serait devenu invisible — la forme de
  mensonge exacte que ce lot ferme.
*/
import { EXEMPTIONS_DE_RENDU, MAXIMUM_D_EXEMPTIONS } from './exemptions-de-rendu.mjs'
import { imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
/* La sonde des gabarits est PARTAGÉE avec `espace-connecte` : une seule
   expression régulière pour la démonstration et pour l'espace connecté. */
import {
  DECALAGE_DE_CONTRAINTE,
  MESURER_CIBLES,
  MESURER_GABARITS,
  MESURER_MENUS_ISOLES,
  MESURER_SECTIONS_ALIGNEES,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
  SELECTEUR_DE_COMMANDE,
} from './sondes-de-rendu.mjs'

import { BASE, LARGEURS, PORT, RACINE } from './mesure-ui/contexte.mjs'
import { arbresEnMouvement, attendre, lenteurs, poserLArbre } from './mesure-ui/attentes.mjs'
import { adressesDeLApplication } from './mesure-ui/adresses.mjs'
import {
  DECLENCHEURS_ATTENDUS, SURFACES_ATTENDUES, SURFACES_INTERACTIVES, declencheursDePanneau,
} from './mesure-ui/surfaces.mjs'
import { ETAPES_INTERIEURES, ROLES_DE_L_INSCRIPTION, etapesDeLInscription } from './mesure-ui/inscription.mjs'
import {
  BUDGET_PREMIER_CHARGEMENT, RESSOURCES_EXTERNES_PESEES, mesurerFuite, mesurerPremierChargement,
} from './mesure-ui/premier-chargement.mjs'
import {
  BLANCS_IMPOSES_TOLERES, CIBLES_EXEMPTES, CONTRASTES_TOLERES, DEBORDS_LOCAUX_TOLERES,
  FIGER_LES_ANIMATIONS, MOTS_DEBORDANTS_TOLERES, TOLERES,
} from './mesure-ui/tolerances.mjs'
import {
  MESURER, MESURER_ACCROCHE, MESURER_BLANC_IMPOSE, MESURER_COLONNES, MESURER_COUPURES,
  MESURER_DEBORDEMENT_DE_MOT, MESURER_DEBORD_LOCAL, MESURER_DOUBLONS, MESURER_GESTES_ATTEIGNABLES,
  MESURER_JEU, MESURER_RENDU, MESURER_REPLI, MESURER_RYTHME, MESURER_TARIFS, MESURER_TRONCATURES,
  MESURER_VALEUR_ROGNEE,
} from './mesure-ui/mesures-navigateur.mjs'


/**
 * ─── OÙ PASSENT LES TROIS MINUTES ────────────────────────────────────────────
 *
 * POURQUOI CE CHRONOMÈTRE EXISTE. Le coût de la sonde de débordement local a
 * été mesuré — 1,0 s sur 195 — et la mesure a rendu une question plutôt qu'une
 * réponse : si cette passe-là ne pèse rien, où va le reste ? Une porte dont on
 * ignore la répartition ne se raccourcit pas, elle se désactive.
 *
 * L'HORLOGE MURALE NE PEUT PAS RÉPONDRE, et c'est déjà mesuré : deux exécutions
 * IDENTIQUES de ce fichier s'écartent de 3,7 secondes. Comparer un passage avec
 * une passe à un passage sans elle ne distinguerait rien sous ce bruit. On
 * chronomètre donc CHAQUE APPEL, à l'intérieur, et on additionne.
 *
 * LE RESTE EST RENDU, ET C'EST LA PARTIE HONNÊTE. Tout n'est pas instrumenté —
 * la fermeture des contextes, la lecture des fichiers, les calculs de ce script.
 * Le rapport imprime donc la somme des postes ET l'écart avec la durée totale,
 * sous le nom « non imputé ». Un décompte qui ne dirait pas ce qu'il ignore
 * laisserait croire qu'il explique tout. Relevé : 2,5 s sur 194, soit 1 %.
 *
 * ─── CE QUE LE PREMIER RELEVÉ A DIT ───────────────────────────────────────
 *
 *   78,0 s  40 %   contraste · navigation et attente        184 appels
 *   41,0 s  21 %   mise en page · navigation et attente     552
 *   40,6 s  21 %   cibles et noms · navigation et attente   506
 *   14,2 s   7 %   surfaces · navigation et attente          10
 *    6,6 s   3 %   colonnes d'entrée                          2
 *
 * TROIS LEVIERS TIRÉS DEPUIS, ET C'ÉTAIT TROIS FOIS LE MÊME : le nombre de
 * CHARGEMENTS, jamais le calcul. Colonnes d'entrée rechargeait à chaque
 * hauteur ; le contraste rechargeait à chaque thème ; les cibles rechargeaient
 * ce que la mise en page venait de charger. **194 s → 108**, et aucun compteur
 * de cette porte n'a changé de valeur.
 *
 * DÉCOMPOSÉ, `attendre` coûte 1 072 ms après un CHARGEMENT — dont 679 de
 * `networkidle` et 270 d'`aria-busy` — et 7 ms après un REDIMENSIONNEMENT. Voilà
 * pourquoi c'est toujours le même levier, et pourquoi il n'en reste plus : les
 * 46 chargements qui subsistent sont ceux qu'il faut bien faire une fois.
 *    …
 *
 * ET LE DÉCOMPTE A DÉJÀ SERVI. « Colonnes d'entrée » est tombé de 6,6 s à 2,3 :
 * la fonction rechargeait la page à chaque hauteur — six navigations par langue
 * pour mesurer deux rectangles — alors que les trois autres passes chargent une
 * fois puis redimensionnent. Vérifié avant de toucher : les deux méthodes
 * rendent des relevés STRICTEMENT identiques. C'est le premier gain de ce
 * chronomètre, et il ne se serait jamais vu sur l'horloge murale, dont le bruit
 * vaut 3,7 s.
 *    2,1 s   1 %   audit · cibles                           516
 *    1,1 s   1 %   sonde · débordement local                506
 *
 * QUATRE-VINGT-NEUF POUR CENT DE CETTE PORTE EST DE L'ATTENTE. Tout ce qu'elle
 * MESURE — les cinq sondes, les trois audits, les surfaces — tient dans huit
 * secondes sur cent quatre-vingt-quatorze. Le débat « cette sonde coûte-t-elle
 * trop cher » n'a donc pas lieu d'être : AUCUNE ne coûte cher, et en ajouter
 * une ne se voit pas. Ce qui coûte, c'est de charger une page.
 *
 * LE POSTE LE PLUS GROS ÉTAIT AUSSI LE PLUS SUSPECT, ET IL A CÉDÉ. La passe de
 * contraste payait 78 s pour 184 appels — 0,42 s l'un — quand la mise en page
 * paie 41 s pour 552 — 0,074 s l'un. L'écart n'était pas dans la mesure mais
 * dans le NOMBRE DE CHARGEMENTS : elle rechargeait chaque écran une fois PAR
 * THÈME. Le thème se bascule désormais à chaud, animations gelées — voir cette
 * passe. 78,4 s → 38,8, 184 appels → 92, et la porte entière de 189 s à 149.
 * 14 936 textes audités avant, 14 936 après : la mesure est intacte.
 *
 * LES DEUX POSTES QUI RESTENT — mise en page et cibles, 41 et 41 s — ne se
 * réduiront pas de la même façon : eux ne rechargent déjà qu'une fois par
 * écran, et leurs 552 et 506 appels sont des REDIMENSIONNEMENTS. Le prix y est
 * celui d'`attendre` sur onze largeurs, pas celui d'un aller-retour réseau.
 *
 * DEUX COMPTEURS POUR LA MÊME CHOSE : la sonde de débordement local est mesurée
 * ici ET par ses compteurs propres, qui la décomposent en parcours du DOM et
 * aller-retour. Les deux chiffres diffèrent d'un dixième de seconde — l'un
 * enveloppe l'autre — et c'est normal.
 */

const DEPART_DU_SCRIPT = performance.now()
const horloge = new Map()

async function chrono(poste, fn) {
  const debut = performance.now()
  try {
    return await fn()
  } finally {
    const vu = horloge.get(poste) ?? { ms: 0, appels: 0 }
    vu.ms += performance.now() - debut
    vu.appels += 1
    horloge.set(poste, vu)
  }
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
  ══ LES GARDES DU GARDE, RENDUES À LA PORTE ══════════════════════════════

  Elles vérifient que les constantes du balayage ont encore un sens, et elles
  SORTENT EN 1. Elles ont voyagé une heure dans `surfaces.mjs` et
  `premier-chargement.mjs` lors du découpage du 2026-10-02, et c'est une faute :
  un module qui s'arrête à l'IMPORT n'est pas un module, c'est un script. Ce
  dépôt a déjà payé cette confusion — un vérificateur de sceau qui reposait le
  sceau parce que l'importer l'exécutait.

  Elles reviennent donc ici, où vivent les verdicts. L'une d'elles lit
  `LARGEURS`, qui n'est jamais partie : elle n'aurait de toute façon pas pu
  rester ailleurs.
*/
{
  const trouves = declencheursDePanneau()
  const total = trouves.reduce((s, t) => s + t.n, 0)
  if (total !== DECLENCHEURS_ATTENDUS) {
    console.error(
      `\n✗ mesure-ui : ${total} déclencheur(s) \`aria-haspopup\` dans la source pour ${DECLENCHEURS_ATTENDUS} recensés.\n` +
        trouves.map((t) => `   ${t.fichier} × ${t.n}`).join('\n') +
        "\n   Une surface qui s'ouvre sans entrer dans `SURFACES_INTERACTIVES` ne serait mesurée\n" +
        '   par personne. Ajoutez-la au périmètre, ou écartez-la en écrivant pourquoi.\n',
    )
    process.exit(1)
  }
}

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

/**
 * LE THÈME DES PASSES DE GÉOMÉTRIE, fixé au lieu d'être hérité.
 *
 * Ni la boucle de géométrie ni la passe des cibles ne posaient `colorScheme` :
 * elles héritaient du défaut de Playwright, qui est le thème clair. La sortie
 * annonçait donc un thème sans l'avoir demandé — exact, mais CONSTANT, et donc
 * trompeur pour qui lit « thème clair » dans un refus et en déduit que le
 * sombre a été regardé lui aussi.
 *
 * ON LE FIXE PLUTÔT QUE DE BALAYER LES DEUX, et c'est une mesure qui l'a
 * décidé, pas une économie : la géométrie des cibles a été relevée aux deux
 * thèmes sur 69 points (23 routes × 3 largeurs), en comparant le nombre de
 * cibles visibles et leurs plus petites hauteur et largeur. ZÉRO point diffère.
 * Le thème change des couleurs, pas des boîtes — et c'est bien ce que le
 * contraste, lui, balaie déjà aux deux thèmes.
 *
 * Le jour où une variante sombre changera une hauteur — une bordure qui
 * n'existe qu'en sombre, une ombre portée qui pousse — cette constante devra
 * redevenir une boucle. Ce commentaire est le seul endroit où cette hypothèse
 * est écrite ; elle est fausse dès qu'un jeton de GÉOMÉTRIE devient
 * conditionnel au thème.
 */
const THEME_DE_GEOMETRIE = 'light'
const LARGEURS_CONTRASTE = [360, 1280]

/**
 * OÙ L'ON CONFRONTE NOTRE CALCUL DE NOM À UN VRAI.
 *
 * `scripts/noms-accessibles.js` approxime `accname`, et son en-tête écrit les
 * écarts qu'il connaît. Une liste d'angles morts écrite à la main vieillit
 * exactement comme la règle qu'elle accompagne : personne ne la relit, et elle
 * finit par décrire un fichier qui a changé.
 *
 * On la rend donc FALSIFIABLE. Playwright implémente accname pour de bon, et
 * `ariaSnapshot()` l'expose : une commande nommée s'y écrit `- button "Fermer"`,
 * une commande anonyme `- button` ou `- button:`. En un point par langue, on
 * compare les deux comptes. Un écart n'est pas forcément un défaut du produit —
 * c'est un défaut de notre approximation, et c'est bien pour cela qu'on veut
 * l'apprendre.
 *
 * UN SEUL POINT PAR LANGUE, et non tous : `ariaSnapshot` sérialise l'arbre
 * entier, là où la sonde ne fait que parcourir le DOM. Le payer 506 fois
 * achèterait la même information cinq cents fois.
 *
 * `/demo` à 1280 px porte l'écran le plus dense du produit — la coquille
 * complète, ses panneaux, ses tableaux. Si un point doit valoir pour tous,
 * c'est celui-là.
 */
const ADRESSE_D_ACCORD = '/demo'
const LARGEUR_D_ACCORD = 1280

/**
 * Une ligne d'`ariaSnapshot` pour une commande SANS nom.
 *
 * Le nom, quand il existe, suit le rôle entre guillemets. Le deux-points
 * facultatif introduit les enfants : `- link:` est un lien anonyme qui contient
 * quelque chose, pas un lien nommé « : ».
 */
const LIGNE_SANS_NOM =
  /^- (button|link|menuitem|menuitemcheckbox|menuitemradio|checkbox|radio|switch|combobox|listbox|tab|textbox|searchbox|spinbutton|option|slider)\s*:?\s*$/



/*
  DEUX SURFACES ÉCARTÉES, ET CE N'EST PAS UN OUBLI.

  Le premier jet les tenait pour acquises ; la mesure les a démenties, et c'est
  la garde du garde qui l'a dit plutôt qu'un vert silencieux. Relevé sur `/demo`
  aux deux largeurs : le SEUL déclencheur à panneau présent est celui des
  réglages. Ni `aria-haspopup="menu"` ni `aria-haspopup="listbox"` n'existent.

  — LE MENU DU COMPTE (`AppShell`, `aria-haspopup="menu"`) n'est pas rendu sous
    `/demo` : la démonstration n'a pas de compte réel. L'atteindre demanderait
    `/app` et donc une session, c'est-à-dire un état préalable — précisément ce
    que ce périmètre s'interdit. Il reste NON AUDITÉ, et c'est dit.

  — LE SÉLECTEUR DE DEVISE vit DANS le panneau des réglages, dont le nom le
    disait déjà (« Réglages : langue, devise et thème »). Il n'a donc pas de
    ligne à lui : le panneau des réglages, lui, est ouvert et audité, et la
    devise l'est avec. Une surface imbriquée n'est pas une surface de plus.
*/




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

/*
  `MESURER_CIBLES` A DÉMÉNAGÉ, pour la raison qui a déjà fait partir
  `MESURER_GABARITS` : `espace-connecte` exécute la MÊME sonde derrière une
  vraie session, et les cibles de l'espace connecté sont précisément celles
  que `/demo` ne peut pas rendre — la coquille du locataire sous une adhésion,
  le parc vide, le gestionnaire borné.

  Son commentaire — les deux angles morts de `cibles.test.ts`, les deux pièges
  d'`elementFromPoint`, la modale qui borne le balayage — est parti avec elle,
  dans `scripts/sondes-de-rendu.mjs`, avec `PLANCHER_CIBLE` et `RAYON_SONDAGE`.
*/


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
 * LES DEUX COLONNES DES ÉCRANS D'ENTRÉE — mesurées à plusieurs HAUTEURS.
 *
 * CE QU'ELLE ATTRAPE. Mesuré avant le lot, à 2000 × 1090 sur `/connexion` : la
 * carte du formulaire allait de 98 à 576 px et laissait 514 px de crème vide en
 * dessous, épinglée en haut ; en face, la colonne de marque collait son
 * argumentaire tout en bas de ses 1090 px. Deux colonnes déséquilibrées, chacune
 * dans le sens opposé de l'autre, qui se tournaient le dos.
 *
 * UN SEUL FAIT, ET C'EST DÉLIBÉRÉ. Une première version en gardait deux : elle
 * exigeait aussi que rien ne soit poussé AU-DESSUS du cadre, le défaut classique
 * du centrage par `align-items` sur une fenêtre courte. Cette règle-là a été
 * retirée après avoir essayé de la faire rougir : on ne peut pas. Le cadre est
 * un élément flexible, qui garde `min-height: auto` et ne descend donc jamais
 * sous son contenu ; la place libre n'est jamais négative, et le formulaire
 * commence à 98 px à 1440 × 620 quelle qu'en soit l'écriture — vérifié en
 * remplaçant `my-auto` par `items-center`, puis `min-h-dvh` par `h-dvh`.
 *
 * Une règle qu'aucune mutation ne fait rougir ne dit pas que le défaut est
 * absent : elle dit qu'on ne l'a pas cherché là où il vit. La garder aurait
 * donné à cette porte un deuxième feu vert gratuit, et c'est exactement ce que
 * le seuil de jeu de la barre reproche déjà à une porte « verte jusqu'à la
 * seconde où elle casse ».
 *
 * RESTE L'AXE, qui est ce que le lot corrige : quand la place existe, les deux
 * colonnes se centrent sur la même ligne. La tolérance de 24 px n'est pas un
 * seuil déguisé — les deux colonnes n'ont pas la même boîte de départ, l'une
 * commençant sous un logo et l'autre sous une rangée de réglages, et exiger
 * l'égalité au pixel reviendrait à interdire les deux en-têtes. Mesuré, l'écart
 * réel vaut 5 px.
 */
const ECART_D_AXE = 24


/**
 * Relève les deux colonnes sur les écrans d'entrée, à trois hauteurs.
 *
 * TROIS HAUTEURS ET NON UNE, et c'est tout l'intérêt : la fenêtre haute montre
 * l'axe, la fenêtre courte montre si le centrage tient. Une seule des deux ne
 * prouve que la moitié, et c'est la moitié confortable.
 */
const HAUTEURS_AUTH = [1090, 800, 620]

async function colonnesDesEcransDEntree(page) {
  const releves = []
  for (const adresse of ['/connexion', '/inscription']) {
    for (const [rang, hauteur] of HAUTEURS_AUTH.entries()) {
      await page.setViewportSize({ width: 1440, height: hauteur })
      /*
        ON CHARGE UNE FOIS, PUIS ON REDIMENSIONNE — la convention des trois
        autres passes de ce fichier, que celle-ci ignorait.

        Elle rechargeait la page à CHAQUE hauteur : six navigations complètes
        par langue là où deux suffisent. Le chronomètre l'a nommée cinquième
        poste de la porte — 6,6 s pour deux appels, trois fois plus que toutes
        les sondes réunies — alors qu'elle ne mesure que deux rectangles.

        MESURÉ AVANT DE TOUCHER, et c'est ce qui autorise le changement : les
        deux méthodes rendent des relevés STRICTEMENT IDENTIQUES — mêmes hauts,
        mêmes bas, mêmes axes, sur les six points d'une langue. 3,97 s contre
        1,16 s. Le rechargement ne mesurait rien de plus ; il attendait.

        Le redimensionnement seul suffit parce que ces écrans n'ont aucune
        décision de mise en page prise AU CHARGEMENT : leur centrage est du
        flux, il se recalcule au reflow. Le jour où l'un d'eux lirait sa hauteur
        en JavaScript au montage, ce raccourci deviendrait faux — et c'est le
        genre de chose qu'une capture ne dirait pas.
      */
      if (rang === 0) await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await attendre(page, `${adresse} (colonnes)`)
      const releve = await page.evaluate(MESURER_COLONNES)
      if (releve) releves.push({ adresse, hauteur, ...releve })
    }
  }
  return releves
}









/**
 * Ouvre le panneau au CLIC à 1440 px et rend ce qu'il rejoue de la barre.
 *
 * PASSE INDÉPENDANTE de `reglagesAtteignables`, alors que celle-ci ouvre déjà
 * le même panneau à la même largeur et qu'on pourrait mesurer dans sa foulée.
 * On ne le fait pas : la mesure ne s'exécuterait alors que si l'autre règle
 * réussit, et un échec là-bas rendrait celle-ci muette — une porte qui se tait
 * quand sa voisine tombe est une porte qu'on croit verte. Le coût est une
 * navigation par langue.
 *
 * AU CLIC et non à la tabulation : ce qui est éprouvé ici est le CONTENU du
 * panneau, pas le chemin qui y mène — `reglagesAtteignables` tient déjà ce
 * chemin, et le refaire ici doublerait sa fragilité sans rien ajouter.
 */
async function doublonsDuPanneau(page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await attendre(page, '/ (doublons)')

  const declencheur = page.locator('header [data-declencheur-reglages]')
  if ((await declencheur.count()) === 0) return null
  await declencheur.click()
  await page.waitForSelector('[data-testid="menu-mobile"]', { timeout: 5000 }).catch(() => {})
  return page.evaluate(MESURER_DOUBLONS)
}


/**
 * ─── LE DÉBORDEMENT LOCAL ────────────────────────────────────────────────────
 *
 * POURQUOI UNE SECONDE RÈGLE DE DÉBORDEMENT, ET CE QUE LA PREMIÈRE NE VOIT PAS.
 *
 * `MESURER` ne tient pour défaut que ce qui fait DÉFILER LA PAGE — il tente
 * `window.scrollTo(400, 0)` et lit `scrollX`. C'est un excellent critère, et il
 * a une frontière nette : un contenu qui sort de SON conteneur mais que le
 * rembourrage d'un ancêtre absorbe ne fait pas défiler la page, donc ne rougit
 * pas — même quand il se voit.
 *
 * MESURÉ, sur la rangée des preuves d'un état des lieux : `flex-wrap` retiré, la
 * rangée dépasse de 40 px (256 contre 216), la grille de 8, `main` avale le
 * reste. La page ne défile pas. La troisième vignette sort pourtant de la carte
 * et se fait couper par la fenêtre. Verdict de la porte : vert.
 *
 * Deux autres défauts VISIBLES vivaient dans le même angle mort, découverts en
 * posant cette règle : les libellés de la barre basse se chevauchent à 320 px
 * (« Signalements » demande 76 px dans 51), et le titre d'une alerte tombe à un
 * mot par ligne à 375 px pendant que « il y a 2 heures » garde sa place.
 *
 * ─── CE QUE LA RÈGLE MESURE, ET CE QU'ELLE ÉCARTE ────────────────────────────
 *
 * Pour chaque élément qui ne gère pas lui-même son débordement, on prend le
 * bord droit de SON CONTENU et on le compare au bord droit de sa boîte.
 *
 * LE CONTENU, C'EST LE TEXTE ET LES ENFANTS DANS LE FLUX — pas `scrollWidth`.
 * Trois raisons, chacune payée d'une mesure :
 *
 *  1. `scrollWidth` compte les descendants HORS FLUX. Une pastille de compteur
 *     posée en `absolute` sur le coin d'une icône faisait de son parent un
 *     coupable : 96 faux positifs sur 219, tous le même « 3 » de la barre
 *     basse. Un élément absolu sort de son conteneur PAR CONSTRUCTION.
 *  2. Le TEXTE, lui, doit compter. Une première version ne regardait que les
 *     enfants éléments : 31 trouvailles au lieu de 123, et elle laissait passer
 *     le chevauchement de la barre basse, qui est du texte débordant sa boîte.
 *     C'est le défaut le plus visible des trois.
 *  3. `clientWidth` vaut zéro sur un élément EN LIGNE : le comparer ferait de
 *     chaque `<span>` un coupable.
 *
 * MÊME CONVENTION QUE `MESURER` POUR LES ANCÊTRES : un contenu logé sous un
 * ancêtre qui défile ou qui rogne n'est pas un coupable — c'est le motif normal
 * des tableaux du dépôt. Ce que cette convention COÛTE, et il faut le dire :
 * `hidden` rogne, donc un contenu perdu sous un `overflow-hidden` passe pour
 * contenu. `MESURER` fait le même choix ; le changer est un autre sujet que
 * celui-ci.
 *
 * SEUL LE PLUS PROFOND EST NOMMÉ. Un parent déborde parce que son enfant
 * déborde : nommer la chaîne noierait le coupable sous ses quatre ancêtres.
 */
/*
  `MESURER_GABARITS` A DÉMÉNAGÉ, et ce n'est pas un rangement.

  `espace-connecte.mjs` exécute la MÊME sonde derrière une vraie session :
  cette porte-ci balaie la démonstration, l'autre balaie l'espace connecté, et
  ce sont les deux moitiés d'une seule règle. La recopier aurait laissé deux
  expressions régulières à faire vieillir ensemble.

  Son commentaire — les trois défauts de production qui l'ont fait naître, ce
  qu'elle ne peut pas confondre, ce qu'elle ne voit pas — est parti avec elle,
  dans `scripts/sondes-de-rendu.mjs`.
*/







/**
 * La police de base AGRANDIE sous laquelle le balayage repasse.
 *
 * 22 px, soit 137 % de la valeur par défaut. Ce n'est pas un extrême : c'est le
 * cran « très grand » des réglages de police d'Android et le milieu de la plage
 * de Safari. Un produit dont les points de rupture sont écrits en `rem` doit
 * tenir là.
 */
const RACINE_AGRANDIE = 22




/** La cause, en clair, pour qu'un refus se lise sans ouvrir le code. */
function causeDeNonRendu(r) {
  if (r.racineVide) return 'racine sans enfant — rien n’a été monté'
  if (r.titres === 0 && r.interactifs === 0) return 'aucun titre et aucun élément interactif'
  if (r.titres === 0) return 'aucun titre (h1–h3)'
  return 'aucun élément interactif'
}

const aRendu = (r) => !r.racineVide && r.titres > 0 && r.interactifs > 0


/** Construit le paquet : la garde mesure ce qui sera livré, pas les sources. */
function construire() {
  return new Promise((resolve, reject) => {
    const fils = spawn('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: RACINE })
    let erreur = ''
    fils.stderr.on('data', (d) => (erreur += d))
    fils.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build a échoué :\n${erreur}`)))) 
  })
}






const adresses = adressesDeLApplication()

/*
  LU AU DÉMARRAGE, avant le build : si le fichier a disparu ou n'est plus
  lisible, on veut l'apprendre en une seconde et non après trois minutes de
  balayage. `readFileSync` jette de lui-même, et c'est le comportement voulu.
*/
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')
const AUDIT_NOMS = readFileSync(join(RACINE, 'scripts/noms-accessibles.js'), 'utf8')

await chrono('paquet · vite build', () => construire())

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

/*
  GARDE DU GARDE, symétrique de celle juste au-dessus — mais pour l'AUTRE
  moitié de la liste. `moduleReserveALaLangueParesseuse` dérive son chemin du
  seul `import(...)` d'`I18nProvider.tsx` : si ce fichier perd sa frontière
  paresseuse — `en.ts` réimporté en statique, le seul `import(...)` disparu —
  la fonction rend `null` en silence, et la fuite qu'elle est censée nommer ne
  serait alors JAMAIS signalée par ce mécanisme-ci. C'est exactement la
  panne que `BUDGET_PREMIER_CHARGEMENT`, plus bas, rattrape par le poids —
  mais cette porte-ci doit nommer le module, pas seulement gonfler un total.
*/
if (!fuite.langue) {
  console.error(
    "\n✗ mesure-ui : aucun `import()` dynamique trouvé dans src/i18n/I18nProvider.tsx.\n" +
      "   La frontière paresseuse du dictionnaire anglais a disparu — ou changé de\n" +
      '   forme au point que cette garde ne la reconnaît plus.\n',
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

/*
  L'ADRESSE PESÉE EST CELLE QUI EST SERVIE, ou la garde refuse.

  `RESSOURCES_EXTERNES_PESEES` porte des octets relevés À LA MAIN, un jour donné,
  contre une adresse précise. Un nombre écrit ne se périme pas tout seul : il se
  périme en silence, et c'est le seul mode de panne d'un relevé qui vit dans un
  commentaire. Changer la plage de graisse, ajouter une famille, retirer le lien
  — chacun de ces gestes change l'adresse dans `index.html` et rendrait le nombre
  faux sans rien casser.

  On compare donc l'ENSEMBLE des adresses externes que le HTML construit porte à
  l'ensemble de celles qui ont été pesées. Toute différence, dans un sens comme
  dans l'autre, arrête la porte : soit une ressource tierce est arrivée sans être
  pesée, soit celle qui l'a été n'est plus servie.

  RETIRER LA POLICE TIERCE FAIT DONC ROUGIR CE BLOC, et c'est voulu : ce serait
  une excellente nouvelle, et elle mérite qu'on vienne effacer son entrée à la
  main plutôt qu'un vert qui ne dirait rien.
*/
{
  const servies = [...premierChargement.externes].sort()
  const pesees = Object.keys(RESSOURCES_EXTERNES_PESEES).sort()
  const manquantes = servies.filter((h) => !pesees.includes(h))
  const orphelines = pesees.filter((h) => !servies.includes(h))
  if (manquantes.length > 0 || orphelines.length > 0) {
    console.error(
      '\n✗ mesure-ui : les ressources externes servies ne sont plus celles qui ont été pesées.\n',
    )
    for (const h of manquantes) console.error(`   SERVIE, JAMAIS PESÉE  ${h}`)
    for (const h of orphelines) console.error(`   PESÉE, PLUS SERVIE    ${h}`)
    console.error(
      '\n   Le budget de premier chargement ne compte que ce que ce dépôt construit ; ce qu\'il\n' +
        "   EXCLUT doit rester chiffré, sinon l'exclusion redevient un silence. Pesez la\n" +
        '   nouvelle adresse — ou effacez celle qui ne sert plus — dans\n' +
        '   `RESSOURCES_EXTERNES_PESEES`, avec sa date et sa méthode.\n',
    )
    process.exit(1)
  }
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

const serveur = await chrono('serveur · vite preview', () =>
  servirLaPrevisualisation('mesure-ui', PORT),
)
const echecs = []
const reproches = []
const etroitesses = []
const inatteignables = []
const rejouements = []
/** Une entrée par (langue, largeur) où le bloc d'accroche a été mesuré. */
const accroches = []
/** Le rythme de la vitrine, relevé une fois par langue au-delà du repli. */
const rythmes = []
/** Les deux colonnes des écrans d'entrée, à trois hauteurs, par langue. */
const colonnes = []
/** La grille de tarifs, relevée au-delà du repli où les cartes sont côte à côte. */
const tarifs = []
/** Les rangées de fiches voisines, partout où une grille se déclare — voir la sonde. */
const sectionsAlignees = []
/** Les menus de débordement partis seuls à la ligne, et combien on en a regardé. */
const menusIsoles = []
let menusExamines = 0
/*
  ─── LE PARCOURS D'INSCRIPTION, ACCUMULATEURS SÉPARÉS ────────────────────

  Ils ne se déversent PAS dans ceux de la boucle principale, et c'est délibéré.
  Les tolérances de ce fichier sont indexées par ADRESSE (`TOLERES`) ou par
  SIGNATURE de classes (`DEBORDS_LOCAUX_TOLERES`) ; les étapes intérieures n'ont
  pas d'adresse, et leurs signatures sont celles des composants de formulaire
  qu'on retrouve partout ailleurs. Verser ici reviendrait à laisser un défaut de
  l'étape 3 s'abriter derrière une tolérance écrite pour un tout autre écran —
  ou, dans l'autre sens, à faire monter un maximum partagé et rougir un plafond
  qui ne parle pas de cette page.
*/
const valeursRogneesDeLInscription = []
const debordsDeLInscription = []
const debordsLocauxDeLInscription = []
/** Une marche que le fil d'étapes n'a pas confirmée : le parcours s'y arrête. */
const marchesRatees = []
let pointsDInscription = 0
let champsDInscription = 0
// Même raison qu'`ATTENDUES` et que `rangeesMesurees` : « le panneau ne rejoue
// rien » et « on n'a pas ouvert le panneau » s'écrivent pareil dans un journal.
// Compte les langues où la mesure a VRAIMENT eu lieu, panneau ouvert.
let panneauxMesures = 0
// Ce que la barre portait au moment de la mesure. Une barre vide rendrait la
// règle vacuement verte : sans rien à rejouer, rien ne peut être rejoué.
let barreLaPlusGarnie = 0
// Compte les rangées d'en-tête public RÉELLEMENT mesurées. Le marqueur retiré,
// `MESURER_JEU` rendrait `null` partout et la porte dirait « aucune barre trop
// serrée » sans en avoir regardé une seule — la panne qu'`ATTENDUES` surveille
// déjà pour la liste des adresses, et la garde du garde plus bas pour le seuil.
let rangeesMesurees = 0
const tolerancesUtilisees = new Set()

/**
 * Le débordement LOCAL — voir `MESURER_DEBORD_LOCAL`.
 *
 * `elementsSondes` compte ce que la sonde a REGARDÉ, et il est rendu dans la
 * ligne de succès. Sans ce nombre, une sonde qui cesserait de trouver des
 * éléments — un sélecteur cassé, une page vide — dirait « aucun débordement »
 * exactement comme un produit sain. C'est la panne que ce fichier reproche déjà
 * à `contrast-audit.js`.
 */
const debordsLocaux = []
const tolerancesLocalesUtilisees = new Set()
/**
 * Le BLANC IMPOSÉ — voir `MESURER_BLANC_IMPOSE`.
 *
 * `cellulesEtirees` compte ce que la sonde a regardé, pour la même raison que
 * `elementsSondes` juste au-dessus : sans lui, une sonde dont le sélecteur
 * cesserait de trouver des grilles rendrait « aucun creux » exactement comme un
 * produit sain. C'est le mode de défaillance que ce fichier refuse partout.
 */
const blancsImposes = new Map()
const tolerancesDeBlancUtilisees = new Set()
let cellulesEtirees = 0
/** Coupures de libellé laissant un orphelin — voir `MESURER_COUPURES`. */
const coupuresOrphelines = new Map()
let libellesMesures = 0
/** Intitulés d'indicateur rognés — voir `MESURER_TRONCATURES`. */
const troncatures = new Map()
let intitulesMesures = 0
/** Gestes hors de la fenêtre de défilement — voir `MESURER_GESTES_ATTEIGNABLES`. */
const valeursRognees = new Map()
let valeursMesurees = 0
const gestesHorsChamp = new Map()
const gestesNus = new Map()
let gestesMesures = 0
let commandesDeGeste = 0

/** Mots plus larges que leur boîte — voir `MESURER_DEBORDEMENT_DE_MOT`. */
const motsDebordants = new Map()
let feuillesMesurees = 0
/**
 * Le PIRE débordement RÉELLEMENT vu pour chaque signature, tolérée ou non.
 *
 * Relevé même quand la tolérance couvre : c'est ce chiffre, et non le plafond
 * inscrit, qui dit ce que le produit fait aujourd'hui. Sans lui, la seule façon
 * de connaître le vrai maximum d'une signature tolérée était d'abaisser son
 * plafond à 1 et de relancer dix minutes de navigateur — un rituel que personne
 * n'exécute, donc un chiffre que personne ne vérifie.
 */
const maximaLocaux = new Map()
/**
 * LES GABARITS QUI ONT SURVÉCU AU RENDU, et le compte des écrans relus.
 *
 * Le compteur est là pour la GARDE DU GARDE : une sonde qui ne tourne plus rend
 * une liste vide, exactement comme un produit sans défaut. Sans le nombre
 * d'écrans effectivement relus, « aucun gabarit survivant » et « la sonde n'a
 * jamais été appelée » s'écrivent de la même façon.
 */
const gabaritsSurvivants = []
let ecransRelusPourGabarits = 0
let elementsSondes = 0
/**
 * CE QUE LA SONDE COÛTE, relevé plutôt que supposé.
 *
 * Trois lots de suite ont fini sur l'aveu « je n'ai pas mesuré ce que la sonde
 * ajoute aux dix minutes de la porte ». Une porte dont on ignore le prix est
 * une porte qu'on finit par ne plus lancer, et c'est le seul défaut qu'aucune
 * garde ne rattrape.
 *
 * DEUX CHIFFRES, parce qu'ils ne se réduisent pas pareil : `tempsSonde` est le
 * temps vu de Node, aller-retour avec le navigateur compris ; `tempsDansLaPage`
 * est le seul parcours du DOM. L'écart entre les deux est le prix du protocole,
 * qu'aucune optimisation du parcours ne fera baisser.
 *
 * ─── LE RELEVÉ ────────────────────────────────────────────────────────────
 *
 * Deux exécutions, même paquet, même machine :
 *
 *   sonde        1,0 s sur 506 appels — 2,0 puis 2,1 ms l'un
 *   dont DOM     0,6 s pour 161 106 éléments, soit ~3,7 µs par élément
 *   dont trajet  0,4 s, c'est-à-dire ~0,8 ms par aller-retour
 *   porte        196,73 s puis 193,00 s
 *
 * Elle pèse donc UN VINGTIÈME DE POUR CENT du balayage — la porte attend le
 * navigateur, elle ne calcule pas.
 *
 * POURQUOI PAS D'A/B, et c'est le résultat le plus utile du relevé : deux
 * exécutions IDENTIQUES s'écartent de 3,7 secondes. Comparer un passage avec
 * sonde à un passage sans ne pourrait pas distinguer une seconde de ce bruit —
 * le chiffre qu'on en tirerait serait une fausse précision. Le chronomètre
 * interne est le seul instrument assez fin ici ; l'horloge murale sert
 * uniquement à dire qu'elle ne suffit pas.
 *
 * CE QUE CE CHIFFRE NE DIT PAS : ce qu'il deviendra. Il suit le NOMBRE
 * D'ÉLÉMENTS, pas le nombre d'écrans — 3,7 µs chacun. Un produit qui doublerait
 * son DOM paierait deux secondes, et ce serait encore négligeable ; c'est le
 * jour où le parcours cesserait d'être linéaire qu'il faudrait y revenir.
 */
let tempsSonde = 0
let tempsDansLaPage = 0
let appelsDeSonde = 0

/** Les points où la page n'a rien rendu, hors adresses exemptées. */
const nonRendus = []
/** Les adresses exemptées qui se sont mises à rendre — exemption périmée. */
const exemptionsQuiRendent = new Map()
/** Ce que chaque exemption a réellement couvert : une exemption qui ne couvre
 *  rien est aussi suspecte qu'une exemption périmée, dans l'autre sens. */
const exemptionsEmployees = new Map()
/** La marge du critère de rendu, pour la rendre falsifiable (voir plus bas). */
let plancherTitresObserve = Infinity
let plancherInteractifsObserve = Infinity
/** Compte les points où la question « a-t-elle rendu ? » a VRAIMENT été posée. */
let renduxExamines = 0
/** Les erreurs JS par (adresse, langue) : contexte d'un refus, jamais son motif. */
const erreursDePage = new Map()

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
/** Points (écran × largeur × langue) où la sonde de plancher s'est exécutée. */
let pointsDeCible = 0
/* Ce que les SURFACES ont apporté, compté à part de ce que la page nue donne.
   Fondu dans le total, un apport nul serait invisible : la porte dirait
   « 13 296 textes audités » avec ou sans les six surfaces, et le jour où les
   gestes cesseraient d'ouvrir quoi que ce soit, rien ne le signalerait. */
let surfacesOuvertes = 0
/* Les surfaces qui n'ont pas voulu s'ouvrir. Déclaré ICI, avec les compteurs
   qu'il accompagne : la première rédaction de cette passe poussait dans un
   tableau qui n'existait pas, et la faute ne se serait manifestée qu'au moment
   EXACT où la garde compte — quand une surface refuse de s'ouvrir. Une garde
   qui lève une `ReferenceError` au lieu de nommer le défaut ne garde rien. */
const plaintesDeSurface = []
let textesDeSurface = 0
let ciblesDeSurface = 0

/*
  ═══ LES NOMS ACCESSIBLES ═══

  Dédupliqué sur la FORME de la commande, comme le contraste l'est sur le couple
  encre/fond : le même bouton anonyme rapporté à onze largeurs et deux langues
  est UN correctif, et vingt-deux lignes de rapport cachent le second défaut.
*/
/**
 * LES COMMANDES QUI PORTENT LE MÊME NOM DANS UNE MÊME LISTE.
 *
 * Seconde règle de `noms-accessibles.js`, et elle existait en prose depuis deux
 * lots : « douze boutons "Corriger" à la suite ne disent pas lequel on active »
 * (`Meters`), « "A1" seul, dans une liste de dix liens, ne dit pas où l'on va »
 * (`Portfolio`). Écrite deux fois, appliquée à deux endroits, gardée nulle part —
 * et quatre écrans la violaient au moment où cette garde est née.
 */
const commandesHomonymes = new Map()
/** Combien de listes ont été regardées — voir la sonde, qui dit pourquoi. */
let listesExaminees = 0
/**
 * LES NOMS QUI NE CONTIENNENT PAS LEUR LIBELLÉ VISIBLE — WCAG 2.5.3.
 *
 * Troisième règle de la sonde des noms, et voir son en-tête pour ce qui l'a fait
 * écrire : le lot qui a renommé vingt-neuf gestes homonymes en a écrit deux de
 * travers, dont un — anglais — a été LIVRÉ, faute qu'aucun cas ne rende cet écran
 * en anglais. Cette porte parcourt les deux langues.
 */
const labelsDeTravers = new Map()
/** Combien de commandes portaient un `aria-label` ET un texte visible. */
let nommeesParLabel = 0
const commandesAnonymes = new Map()
let nomsExamines = 0
/** Points (écran × largeur × langue) où la sonde des noms s'est exécutée. */
let pointsDeNom = 0
let nomsDeSurface = 0
/* L'accord entre notre approximation et l'implémentation accname de Playwright,
   relevé en un point par langue. Voir la garde plus bas : c'est ce qui rend la
   liste d'angles morts de `noms-accessibles.js` VÉRIFIABLE et non déclarative. */
const accordsAccname = []

try {
  const navigateur = await chromium.launch()
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS[0], height: 900 },
      locale: langue,
      colorScheme: THEME_DE_GEOMETRIE,
    })
    await imposerLaPoliceLarge(contexte)
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    // Relevées pour ÉCLAIRER un refus, jamais pour en déclencher un : les 484
    // points sains en portent tous (voir l'en-tête de `MESURER_RENDU`).
    let adresseCourante = ''
    page.on('pageerror', (e) => {
      const cle = `${adresseCourante}|${langue}`
      if (!erreursDePage.has(cle)) erreursDePage.set(cle, [])
      const liste = erreursDePage.get(cle)
      if (liste.length < 4) liste.push(String(e.message).slice(0, 80))
    })
    for (const adresse of adresses) {
      adresseCourante = adresse
      // Le balayage DIT où il en est. Sans cela il reste muet une demi-heure,
      // et rien ne distingue « il travaille » de « il est bloqué » — l'état
      // dans lequel on désactive une porte plutôt que de la lire.
      const depart = Date.now()
      process.stdout.write(`   ${langue}  ${adresse} … `)
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
      await chrono('mise en page · navigation et attente', async () => {
        await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
        await attendre(page, adresse)
      })
      for (const largeur of LARGEURS) {
        await chrono('mise en page · navigation et attente', async () => {
          await page.setViewportSize({ width: largeur, height: 900 })
          await attendre(page, adresse)
          /* Onze des vingt décalages mesurés le 2026-09-08 étaient ici. */
          await poserLArbre(page, `mise en page · ${adresse} · ${langue} · ${largeur}px`)
        })
        if (largeur >= LARGEUR_SANS_REPLI) {
          const replis = await chrono('sonde · repli', () => page.evaluate(MESURER_REPLI))
          if (replis) for (const r of replis) reproches.push({ adresse, largeur, langue, ...r })

          // Au-delà de la bande, la largeur utile ne bouge plus : c'est là, et
          // là seulement, qu'un plancher en pixels veut dire quelque chose. En
          // dessous, la bande suit la fenêtre et le jeu doit pouvoir fondre.
          const place = await chrono('sonde · jeu de la barre', () => page.evaluate(MESURER_JEU))
          if (place) {
            rangeesMesurees++
            if (place.jeu < JEU_MINIMAL) etroitesses.push({ adresse, largeur, langue, ...place })
          }
        }

        // Le bloc d'accroche n'existe que sur l'accueil, et il s'y mesure à
        // toutes les largeurs : c'est justement d'une largeur à l'autre que son
        // écart variait.
        if (adresse === '/') {
          const accroche = await chrono('sonde · accroche', () => page.evaluate(MESURER_ACCROCHE))
          if (accroche) accroches.push({ largeur, langue, ...accroche })

          // Le rythme se lit là où l'échelle `lg` s'applique : en dessous, les
          // temps se rapprochent par construction et la variété qu'on mesure
          // serait celle du téléphone, où elle compte moins — un défilement
          // vertical ne se compare pas d'un bout à l'autre du pouce.
          if (largeur >= LARGEUR_SANS_REPLI) {
            const releve = await chrono('sonde · rythme', () => page.evaluate(MESURER_RYTHME))
            if (releve) rythmes.push({ largeur, langue, sections: releve })

            // Au-delà du repli seulement : c'est là que les trois cartes sont
            // côte à côte. Empilées, « elles finissent ensemble » n'a pas de
            // sens — chacune finit où commence la suivante.
            const grille = await chrono('sonde · tarifs', () => page.evaluate(MESURER_TARIFS))
            if (grille) tarifs.push({ largeur, langue, ...grille })
          }
        }

        /* LES SECTIONS DE FICHES VOISINES, à chaque point et sur tout écran : la
           grille se DÉCLARE, et c'est la sonde qui la trouve. À toutes les
           largeurs, parce que le décalage vit à une largeur précise — il est né
           à 1536 px, où trois gestes cessent de tenir sur une ligne, et nulle
           part ailleurs. */
        const alignement = await chrono('sonde · sections alignées', () =>
          page.evaluate(MESURER_SECTIONS_ALIGNEES, DECALAGE_DE_CONTRAINTE),
        )
        if (alignement) {
          for (const r of alignement) sectionsAlignees.push({ adresse, largeur, langue, ...r })
        }

        /* LES MENUS DE DÉBORDEMENT, à chaque point pour la même raison : un
           repli vit à une largeur précise — 414 ici, 900 là, 1536 sur une fiche. */
        const menus = await chrono('sonde · menus isolés', () => page.evaluate(MESURER_MENUS_ISOLES))
        menusExamines += menus.examines
        for (const m of menus.isoles) menusIsoles.push({ adresse, largeur, langue, ...m })

        /*
          POSÉE AVANT LA RÈGLE DU DÉBORDEMENT, et à chaque point.

          Avant : parce qu'une page qui n'a rien rendu ne déborde jamais, et que
          la lire d'abord par la règle du débordement revient à la déclarer
          saine. Après ce lot, l'ordre dit ce qu'on veut savoir en premier.

          À chaque point, et non une fois par écran : le refus doit pouvoir
          nommer une LARGEUR. Un écran qui rend à 320 px et meurt à 1440 est un
          défaut que « une fois par écran » ne saurait pas dire, et qui coûterait
          le même prix à l'utilisateur.
        */
        const rendu = await chrono('sonde · a-t-il rendu', () => page.evaluate(MESURER_RENDU))
        renduxExamines++
        const exemptee = EXEMPTIONS_DE_RENDU[adresse]
        if (aRendu(rendu)) {
          plancherTitresObserve = Math.min(plancherTitresObserve, rendu.titres)
          plancherInteractifsObserve = Math.min(plancherInteractifsObserve, rendu.interactifs)
          if (exemptee) {
            if (!exemptionsQuiRendent.has(adresse)) exemptionsQuiRendent.set(adresse, [])
            exemptionsQuiRendent.get(adresse).push({ langue, largeur, ...rendu })
          }
        } else if (exemptee) {
          exemptionsEmployees.set(adresse, (exemptionsEmployees.get(adresse) ?? 0) + 1)
        } else {
          nonRendus.push({
            adresse,
            langue,
            largeur,
            theme: rendu.theme,
            cause: causeDeNonRendu(rendu),
            titres: rendu.titres,
            interactifs: rendu.interactifs,
            elements: rendu.elements,
            erreurs: erreursDePage.get(`${adresse}|${langue}`) ?? [],
          })
        }

        /*
          LE DÉBORDEMENT LOCAL, mesuré DANS LA MÊME VISITE.

          Pas une passe de plus : la page est déjà chargée, déjà redimensionnée,
          déjà stabilisée. Une seconde boucle aurait payé 506 navigations pour
          regarder ce qui est sous les yeux.
        */
        /* DANS LA MÊME VISITE, pour la raison écrite juste au-dessus : la page
           est chargée, la sonde ne coûte qu'un aller-retour. */
        const gabarits = await chrono('sonde · gabarits', () => page.evaluate(MESURER_GABARITS))
        ecransRelusPourGabarits += 1
        for (const jeton of gabarits.jetons) {
          gabaritsSurvivants.push({ jeton, ou: `${adresse} ${largeur}px/${langue}` })
        }

        const avantSonde = performance.now()
        const local = await chrono('sonde · débordement local', () =>
          page.evaluate(MESURER_DEBORD_LOCAL),
        )
        tempsSonde += performance.now() - avantSonde
        tempsDansLaPage += local.ms
        appelsDeSonde += 1
        elementsSondes += local.sondes
        for (const coupable of local.coupables) {
          // Relevé d'abord, jugé ensuite : un débordement toléré compte dans le
          // maximum au même titre qu'un autre, sans quoi le plafond ne pourrait
          // être confronté à rien.
          const vu = maximaLocaux.get(coupable.signature)
          if (!vu || coupable.debord > vu.debord) {
            maximaLocaux.set(coupable.signature, {
              debord: coupable.debord,
              ou: `${adresse}@${largeur}/${langue}`,
            })
          }

          const toleree = DEBORDS_LOCAUX_TOLERES[coupable.signature]
          if (toleree) {
            tolerancesLocalesUtilisees.add(coupable.signature)
            // Le défaut CONNU passe ; le même défaut AGGRAVÉ ne passe pas.
            if (coupable.debord <= toleree.plafond) continue
          }
          debordsLocaux.push({
            adresse,
            largeur,
            langue,
            ...coupable,
            plafond: toleree ? toleree.plafond : null,
          })
        }

        /*
          LE BLANC IMPOSÉ, sur la même visite que le débordement local.

          Même raison : la page est chargée, dimensionnée, stabilisée. Une passe
          de plus coûterait 506 navigations pour regarder ce qui est déjà sous
          les yeux — et ce fichier a déjà refusé ce prix une fois.
        */
        const creux = await chrono('sonde · blanc imposé', () =>
          page.evaluate(MESURER_BLANC_IMPOSE),
        )
        tempsDansLaPage += creux.ms
        cellulesEtirees += creux.cellules
        for (const releve of creux.releves) {
          // Relevé d'abord, jugé ensuite — comme les débordements locaux : un
          // creux toléré doit compter dans le maximum, sans quoi le plafond ne
          // peut être confronté à rien.
          const vu = blancsImposes.get(releve.signature)
          if (!vu || releve.blanc > vu.blanc) {
            blancsImposes.set(releve.signature, {
              ...releve,
              ou: `${adresse}@${largeur}/${langue}`,
            })
          }
        }

        /*
          LE `continue` EST DEVENU UN `if`, ET CE N'EST PAS UN GOÛT D'ÉCRITURE.

          Il sautait la fin de l'itération quand la page NE DÉBORDAIT PAS —
          c'est-à-dire dans l'immense majorité des cas, et c'était sans
          conséquence tant que rien ne le suivait. Les cibles et les noms le
          suivent désormais : laissé tel quel, il les aurait sautés sur 484
          points sur 506, et les deux gardes auraient rendu « aucun défaut »
          après avoir regardé les vingt-deux écrans qui débordent.
        */
        const resultat = await chrono('sonde · débordement de page', () => page.evaluate(MESURER))
        if (resultat) {
          const cle = `${adresse}@${largeur}`
          if (TOLERES[cle]) tolerancesUtilisees.add(cle)
          else echecs.push({ adresse, largeur, langue, ...resultat })
        }

        /*
          ─── LES CIBLES ET LES NOMS, SUR LA PAGE DÉJÀ CHARGÉE ──────────────

          Ils vivaient dans une TROISIÈME PASSE, qui rechargeait les mêmes 46
          pages pour les balayer aux mêmes onze largeurs, dans les mêmes deux
          langues, avec le MÊME `colorScheme`. Deux passes, un seul axe.

          Le chronomètre a chiffré ce doublon : 41 s, dont 39 de navigation.
          Décomposé, `attendre` coûte 1 072 ms après un chargement et 7 ms
          après un redimensionnement — le prix n'était pas l'attente, c'était
          le chargement, comme pour les deux leviers précédents.

          CE QUI JUSTIFIAIT LA SÉPARATION N'EXISTE PLUS. La passe des cibles
          venait en dernier parce qu'elle est la seule à FAIRE DÉFILER la page
          — `elementFromPoint` ne répond que dans le cadre visible — et qu'on
          ne voulait pas qu'une mesure de couleur dépende d'une mesure de
          géométrie. Mais la passe de contraste crée son propre contexte et
          navigue elle-même sur chaque écran : un défilement laissé ici ne
          l'atteint pas. Le risque restant est INTERNE — la sonde défile puis
          remet à zéro, et les sondes de la largeur suivante travaillent après
          ce retour. Il a été mesuré plutôt que raisonné : tous les compteurs
          de la porte sont restés identiques au chiffre près.

          ELLES VIENNENT EN DERNIER DANS L'ITÉRATION, pour la même raison qui
          les mettait en dernier parmi les passes : ce sont elles qui touchent
          à l'état de la page, et rien ne doit mesurer après.
        */
        const coupures = await chrono('sonde · coupures de libellé', () =>
          page.evaluate(MESURER_COUPURES),
        )
        libellesMesures += coupures.mesures
        for (const d of coupures.defauts) {
          // Dédupliqué sur le LIBELLÉ : le même mot mal coupé sur vingt écrans
          // est un seul correctif, et vingt lignes cacheraient le second.
          const cle = `${d.texte}|${langue}`
          if (!coupuresOrphelines.has(cle)) {
            coupuresOrphelines.set(cle, { ...d, langue, ou: `${adresse} ${largeur}px` })
          }
        }

        /* AUCUN CHARGEMENT DE PLUS : la page est déjà là, à la bonne largeur,
           dans la bonne langue. C'est la règle de ce fichier depuis le lot qui a
           fusionné deux passes — ce qui coûte, ce sont les chargements, jamais le
           calcul. Un `page.evaluate` de plus, et tous les intitulés d'indicateur
           du produit sont mesurés à onze largeurs et deux langues. */
        /* DEUX PASSES, UNE SEULE PAGE : la taille de police racine est la
           seconde dimension du balayage, et elle ne coûte qu'un reflow. Voir
           l'en-tête de la sonde pour ce qu'elle a trouvé. */
        for (const racine of [null, RACINE_AGRANDIE]) {
          const rognages = await chrono(
            racine ? 'sonde · textes rognés (racine agrandie)' : 'sonde · textes rognés',
            () => page.evaluate(MESURER_TRONCATURES, { racine }),
          )
          intitulesMesures += rognages.mesures
          for (const d of rognages.defauts) {
            /* Dédupliqué sur le LIBELLÉ et la LANGUE : le même nom rogné à six
               largeurs est un seul correctif. On garde le PIRE manque et non le
               premier vu — c'est lui qui dit combien de place il faut trouver, et
               la première largeur balayée n'est pas la plus serrée. */
            const cle = `${d.texte}|${langue}`
            const vu = troncatures.get(cle)
            if (!vu || d.manque > vu.manque) {
              troncatures.set(cle, { ...d, langue, ou: `${adresse} ${largeur}px` })
            }
          }
        }

        /* ENCORE AUCUN CHARGEMENT : même page, même largeur, même langue. */
        const valeurs = await chrono('sonde · valeurs rognées', () =>
          page.evaluate(MESURER_VALEUR_ROGNEE),
        )
        valeursMesurees += valeurs.mesures
        for (const d of valeurs.defauts) {
          /* Dédupliqué sur le TEXTE et la LANGUE, et l'on garde le PIRE manque :
             le même champ trop étroit à onze largeurs est un seul correctif, et
             c'est la largeur la plus serrée qui dit combien il faut trouver. */
          const cle = `${d.texte}|${langue}`
          const vu = valeursRognees.get(cle)
          if (!vu || d.manque > vu.manque) {
            valeursRognees.set(cle, { ...d, langue, ou: `${adresse} ${largeur}px` })
          }
        }

        /* ENCORE AUCUN CHARGEMENT : les gestes hors champ se mesurent sur la
           même page, à la position de repos. Voir `MESURER_GESTES_ATTEIGNABLES`. */
        const gestes = await chrono('sonde · gestes atteignables', () =>
          page.evaluate(MESURER_GESTES_ATTEIGNABLES),
        )
        gestesMesures += gestes.mesures
        commandesDeGeste += gestes.commandes
        /* Dédupliqué sur le LIBELLÉ et la LANGUE : le même bouton nu à onze
           largeurs est un seul correctif, et son libellé suffit à le désigner —
           il n'y a pas de « pire cas » à retenir, un glyphe est là ou non. */
        for (const nu of gestes.nus) {
          const cle = `${nu}|${langue}`
          if (!gestesNus.has(cle)) gestesNus.set(cle, { nu, langue, ou: `${adresse} ${largeur}px` })
        }
        for (const d of gestes.defauts) {
          /* Dédupliqué sur le GESTE et la LANGUE, et l'on garde le pire : le
             même bouton hors champ à trois largeurs est un seul correctif, et
             c'est la plus serrée qui dit combien de place il manque. */
          const cle = `${d.geste}|${langue}`
          const vu = gestesHorsChamp.get(cle)
          if (!vu || d.cache > vu.cache) {
            gestesHorsChamp.set(cle, { ...d, langue, ou: `${adresse} ${largeur}px` })
          }
        }

        /* ENCORE AUCUN CHARGEMENT : même page, même largeur, même langue. La
           règle du mot débordant tient dans un `evaluate` de plus, et couvre du
           coup les 506 points du balayage plutôt que le seul écran où le défaut
           a été trouvé à l'œil. */
        const sorties = await chrono('sonde · mots débordants', () =>
          page.evaluate(MESURER_DEBORDEMENT_DE_MOT),
        )
        feuillesMesurees += sorties.mesures
        for (const d of sorties.defauts) {
          /* Dédupliqué sur le TEXTE et la LANGUE, et l'on garde le pire manque :
             le même mot trop long à six largeurs est un seul correctif, et c'est
             la largeur la plus serrée qui dit combien de place il faut trouver.
             Même raisonnement que les rognages, juste au-dessus. */
          const cle = `${d.texte}|${langue}`
          const vu = motsDebordants.get(cle)
          if (!vu || d.manque > vu.manque) {
            motsDebordants.set(cle, { ...d, langue, ou: `${adresse} ${largeur}px` })
          }
        }

        const releve = await chrono('audit · cibles', () =>
          page.evaluate(MESURER_CIBLES, {
            plancher: PLANCHER_CIBLE,
            rayon: RAYON_SONDAGE,
            selecteur: SELECTEUR_DE_COMMANDE,
          }),
        )
        ciblesSondees += releve.sondees
        pointsDeCible++
        for (const raison of releve.raisonsVues) raisonsEmployees.add(raison)

        /*
          LES NOMS VOYAGENT AVEC LES CIBLES, et l'axe est le bon.

          Un nom accessible ne dépend pas du THÈME — repeindre un bouton ne le
          renomme pas — mais il dépend de la LANGUE, puisqu'il sort des
          dictionnaires, et de la LARGEUR, qui décide quelles commandes existent :
          le tiroir n'a son bouton que sous `lg`, la barre de navigation n'a les
          siens qu'au-dessus. C'est mot pour mot l'axe de la passe des cibles.

          Elle ne coûte donc AUCUN chargement de page : la page est déjà là, à la
          bonne largeur, dans la bonne langue. Un `page.evaluate` de plus, et le
          balayage complet des noms est payé.
        */
        const noms = await chrono('audit · noms accessibles', () => page.evaluate(AUDIT_NOMS))
        if (!noms || typeof noms.examinees !== 'number') {
          throw new Error(
            "mesure-ui : `noms-accessibles.js` n'a pas rendu `{ anonymes, items, examinees }`. " +
              "Son expression doit rester une IIFE qui s'évalue en cet objet.",
          )
        }
        nomsExamines += noms.examinees
        pointsDeNom++
        /* LES HOMONYMES D'UNE MÊME LISTE — seconde règle de la même sonde, voir
           son en-tête. Retenus une fois par NOM et par groupe : le même défaut
           se rapporte sur douze largeurs et deux langues, et douze copies d'une
           plainte ne la rendent pas plus vraie. */
        listesExaminees += noms.groupes ?? 0
        for (const h of noms.homonymes ?? []) {
          const cle = `${h.groupe}|${h.nom}`
          if (!commandesHomonymes.has(cle)) {
            commandesHomonymes.set(cle, { ...h, ou: `${adresse} ${largeur}px ${langue}` })
          }
        }
        /* LE LIBELLÉ VISIBLE DANS LE NOM — troisième règle de la même sonde.
           Retenus par COUPLE (label, visible) : le même bouton se rapporte sur
           douze largeurs, et c'est une seule faute. */
        nommeesParLabel += noms.nommeesParLabel ?? 0
        for (const l of noms.labelsDeTravers ?? []) {
          const cle = `${l.label}|${l.visible}`
          if (!labelsDeTravers.has(cle)) {
            labelsDeTravers.set(cle, { ...l, ou: `${adresse} ${largeur}px ${langue}` })
          }
        }
        for (const item of noms.items) {
          const cle = `${item.balise}|${item.role}|${item.classes}`
          if (!commandesAnonymes.has(cle)) {
            commandesAnonymes.set(cle, { ...item, ou: `${adresse} ${largeur}px ${langue}` })
          }
        }

        if (adresse === ADRESSE_D_ACCORD && largeur === LARGEUR_D_ACCORD) {
          const arbre = await page.locator('body').ariaSnapshot()
          const selonPlaywright = arbre
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => LIGNE_SANS_NOM.test(l)).length
          accordsAccname.push({ langue, nous: noms.anonymes, playwright: selonPlaywright })
        }

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

    // Une fois par langue, et non par écran : la barre est la même partout, et
    // la tabulation coûte un aller-retour par touche.
    process.stdout.write(`   ${langue}  réglages au clavier à 1440 px … `)
    const manque = await chrono('clavier · réglages atteignables', () => reglagesAtteignables(page))
    process.stdout.write(manque ? 'ÉCHEC\n' : 'ok\n')
    if (manque) inatteignables.push({ langue, manque })

    process.stdout.write(`   ${langue}  panneau sans doublon à 1440 px … `)
    const doublons = await chrono('panneau · doublons', () => doublonsDuPanneau(page))
    if (doublons) {
      panneauxMesures++
      barreLaPlusGarnie = Math.max(barreLaPlusGarnie, doublons.barre.length)
      if (doublons.rejoues.length > 0) rejouements.push({ langue, ...doublons })
    }
    process.stdout.write(doublons?.rejoues.length ? 'ÉCHEC\n' : doublons ? 'ok\n' : 'NON MESURÉ\n')

    process.stdout.write(`   ${langue}  colonnes d'entrée à ${HAUTEURS_AUTH.join('/')} px … `)
    const releves = await chrono('colonnes d’entrée', () => colonnesDesEcransDEntree(page))
    colonnes.push(...releves.map((r) => ({ langue, ...r })))
    process.stdout.write(`${releves.length} relevés\n`)

    process.stdout.write(`   ${langue}  étapes intérieures de l'inscription … `)
    const parcours = await chrono("étapes de l'inscription", () => etapesDeLInscription(page))
    pointsDInscription += parcours.points
    champsDInscription += parcours.champsMesures
    for (const d of parcours.rognages) valeursRogneesDeLInscription.push({ langue, ...d })
    for (const d of parcours.debordsDePage) debordsDeLInscription.push({ langue, ...d })
    for (const d of parcours.debordsLocaux) debordsLocauxDeLInscription.push({ langue, ...d })
    for (const d of parcours.marchesRatees) marchesRatees.push({ langue, ...d })
    process.stdout.write(`${parcours.points} points, ${parcours.champsMesures} champs\n`)

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
  /*
    ─── LE THÈME SE BASCULE À CHAUD, IL NE SE RECHARGE PLUS ────────────────

    Cette passe portait DEUX contextes par langue, un par thème, et rechargeait
    donc chaque écran deux fois : 92 navigations complètes. Le chronomètre l'a
    désignée premier poste de la porte — 78 s, 40 % — et l'écart avec la passe
    de mise en page disait où : 0,42 s par appel contre 0,074, pour deux fois
    moins de largeurs. Ce n'était pas la mesure qui coûtait, c'était le
    chargement.

    UN SEUL CONTEXTE PAR LANGUE, et `emulateMedia` bascule
    `prefers-color-scheme` sur la page DÉJÀ CHARGÉE. C'est légitime parce que le
    thème de ce produit est du CSS PUR : `ThemeProvider` écrit lui-même qu'`auto`
    retire l'attribut et « laisse `prefers-color-scheme` décider », « sans qu'on
    ait à écouter quoi que ce soit ». Un contexte neuf n'a aucune préférence
    stockée : les deux méthodes partent du même état.

    ── LE GEL N'EST PAS UN DÉTAIL, C'EST LA CONDITION ──────────────────────

    Premier essai SANS geler les animations : 13 points sur 24 rendaient un
    relevé DIFFÉRENT, et pas un peu — l'audit inventait des fautes qui n'existent
    pas, encre claire sur fond clair, encre sombre sur surface sombre. Les
    couleurs de ce produit se transitionnent en 150 ms : juste après la bascule
    la page est dans un état MIXTE, le fond déjà changé et le texte pas encore.
    Une passe deux fois plus rapide qui aurait rapporté vingt fautes imaginaires
    par écran — le pire échange possible.

    Avec `FIGER_LES_ANIMATIONS` — la feuille que la passe des surfaces injecte
    déjà, pour la même raison — les 24 points redeviennent STRICTEMENT identiques
    à ceux du contexte par thème, et l'échantillon tombe de 11,8 s à 6,0.

    LE STYLE SE REPOSE APRÈS CHAQUE NAVIGATION : une feuille injectée meurt avec
    son document. Le redimensionnement, lui, la garde.
  */
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: LARGEURS_CONTRASTE[0], height: 900 },
      locale: langue,
    })
    await imposerLaPoliceLarge(contexte)
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    for (const adresse of adresses) {
      const depart = Date.now()
      process.stdout.write(`   ${langue}  contraste  ${adresse} … `)
      for (const largeur of LARGEURS_CONTRASTE) {
        await chrono('contraste · navigation et attente', async () => {
          await page.setViewportSize({ width: largeur, height: 900 })
          // On recharge à la première largeur seulement : le reste est un
          // redimensionnement, comme dans la passe de mise en page.
          if (largeur === LARGEURS_CONTRASTE[0]) {
            await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
            await attendre(page, adresse)
            await page.addStyleTag({ content: FIGER_LES_ANIMATIONS })
            return
          }
          await attendre(page, adresse)
          /* Neuf décalages mesurés ici, dont /demo/paiements à 1280 px :
             773 éléments lus là où l'écran posé en porte 602. */
          await poserLArbre(page, `contraste · ${adresse} · ${langue} · ${largeur}px`)
        })

        for (const theme of THEMES) {
          await chrono('contraste · bascule de thème', () =>
            page.emulateMedia({ colorScheme: theme }),
          )

          if (adresse === '/' && largeur === LARGEURS_CONTRASTE[0]) {
            fondsParTheme.set(
              theme,
              await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
            )
          }

          const audit = await chrono('audit · contraste', () => page.evaluate(AUDIT_CONTRASTE))
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
      }
      process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
    }
    await contexte.close()
  }


  /*
    ═══ LES SURFACES QUI N'EXISTENT QU'APRÈS UN GESTE ═══

    Quatrième passe, et son axe n'est celui d'aucune autre : deux thèmes, une
    langue, une largeur par surface — celle où la surface existe. Le tiroir de
    navigation n'est rendu que sous `lg`, le menu du compte qu'au-dessus ; les
    balayer aux deux largeurs mesurerait surtout leur absence.

    ELLE VIENT EN DERNIER, après la sonde des cibles, pour la même raison qui a
    mis celle-ci après le contraste : elle est la seule à CLIQUER, donc à laisser
    la page dans un état qu'elle n'a pas trouvé. Chaque surface reçoit un
    contexte neuf, ce qui rend l'ordre des surfaces sans effet sur le résultat —
    une surface ne peut pas en polluer une autre.

    LES DEUX SONDES SONT CELLES DES AUTRES PASSES, à l'identique : `AUDIT_CONTRASTE`
    lu depuis `contrast-audit.js`, et `MESURER_CIBLES`. Rien n'est réimplémenté —
    une seconde rédaction dériverait, et ce dépôt a déjà payé cela.
  */
  for (const surface of SURFACES_INTERACTIVES) {
    for (const theme of THEMES) {
      const nom = `${surface.nom}@${surface.largeur}/${theme}`
      process.stdout.write(`   surface  ${nom} … `)
      const contexte = await navigateur.newContext({
        ...SANS_AGENT_DE_SERVICE,
        viewport: { width: surface.largeur, height: 900 },
        locale: LANGUES[1],
        colorScheme: theme,
      })
      await imposerLaPoliceLarge(contexte)
      await neutraliserLApiLocale(contexte)
      const page = await contexte.newPage()
      await chrono('surfaces · navigation et attente', async () => {
        await page.goto(BASE + surface.adresse, { waitUntil: 'domcontentloaded' })
        await attendre(page, surface.adresse)
        await page.addStyleTag({ content: FIGER_LES_ANIMATIONS })
      })

      /*
        LA GARDE DU GARDE, et elle est le cœur de cette passe.

        Un sélecteur périmé, un composant déplacé, un libellé retraduit : le
        geste ne ferait plus rien, la surface ne s'ouvrirait pas, et les deux
        sondes rendraient « aucun défaut » sur la page NUE. Ce serait le pire
        des verts — celui qui affirme d'autant plus fort qu'il n'a rien
        regardé. On exige donc le TÉMOIN, et son absence fait rougir.
      */
      let ouverte = false
      try {
        await chrono('surfaces · geste d’ouverture', async () => {
          await surface.ouvrir(page)
          await page.locator(surface.temoin).first().waitFor({ state: 'visible' })
        })
        ouverte = true
      } catch (e) {
        /*
          ON NOMME L'ATTENTE QUI A EXPIRÉ, ET PLUS SEULEMENT LE TÉMOIN.

          Tant que le témoin était la SEULE attente d'une ouverture, l'accuser
          était juste. Depuis qu'un `ouvrir` peut en porter une seconde — celle
          de la DONNÉE, voir `prix-de-refacturation` —, cette phrase désignait
          le mauvais coupable : elle envoyait chercher `form#tarif`, présent,
          quand c'est la ligne d'historique qui manquait. Playwright met le
          sélecteur fautif dans son journal d'appel ; `split('\n')[0]` le jetait.
        */
        const lignes = String(e).split('\n')
        const attendu = lignes.find((l) => l.includes('waiting for'))?.trim()
        plaintesDeSurface.push(
          `${nom} : la surface ne s'est pas ouverte.\n` +
            `   ${lignes[0]}\n` +
            (attendu ? `   ${attendu}\n` : `   témoin attendu : « ${surface.temoin} »\n`) +
            "   Une surface non ouverte n'est pas une surface sans défaut : le geste qui\n" +
            '   l’ouvre a changé, et les deux sondes auraient mesuré la page nue.',
        )
      }

      if (ouverte) {
        surfacesOuvertes++

        const audit = await chrono('audit · contraste', () => page.evaluate(AUDIT_CONTRASTE))
        if (!audit || typeof audit.examines !== 'number') {
          throw new Error(
            `mesure-ui : \`contrast-audit.js\` n'a rien rendu sur la surface ${nom}.`,
          )
        }
        textesAudites += audit.examines
        textesDeSurface += audit.examines
        for (const item of audit.items) {
          const cle = `${item.text}|${item.color}|${item.bg}`
          if (!contrastes.has(cle)) contrastes.set(cle, { ...item, ou: `surface ${nom}` })
        }

        const releve = await chrono('audit · cibles', () =>
          page.evaluate(MESURER_CIBLES, {
            plancher: PLANCHER_CIBLE,
            rayon: RAYON_SONDAGE,
            selecteur: SELECTEUR_DE_COMMANDE,
          }),
        )
        ciblesSondees += releve.sondees
        ciblesDeSurface += releve.sondees
        /* `pointsDeCible` N'EST PAS incrémenté : il compte les points ADRESSE ×
           largeur × langue, et sa garde exige l'égalité exacte avec ce produit.
           Y verser les surfaces la ferait rougir pour une bonne nouvelle. Les
           surfaces ont leur propre compte, et leur propre garde. */
        for (const raison of releve.raisonsVues) raisonsEmployees.add(raison)
        for (const defaut of releve.defauts) {
          if (defaut.raison && CIBLES_EXEMPTES[defaut.raison]) continue
          const cle = `${defaut.balise}|${defaut.cible}|${defaut.classes}`
          if (!ciblesTrop_petites.has(cle)) {
            ciblesTrop_petites.set(cle, { ...defaut, ou: `surface ${nom}` })
          }
        }
        /*
          LA MÊME SONDE, sur ce qui ne s'ouvre qu'au clic.

          C'est ici qu'elle sert le plus : une commande de premier rendu se voit
          dans n'importe quelle capture, un déclencheur de panneau ne se voit
          nulle part tant que personne n'a cliqué. Le calendrier et le sélecteur
          de mois de la modale de paiement ne sont regardés QUE par cette ligne.
        */
        const noms = await chrono('audit · noms accessibles', () => page.evaluate(AUDIT_NOMS))
        if (!noms || typeof noms.examinees !== 'number') {
          throw new Error(
            `mesure-ui : \`noms-accessibles.js\` n'a rien rendu sur la surface ${nom}.`,
          )
        }
        nomsExamines += noms.examinees
        nomsDeSurface += noms.examinees
        listesExaminees += noms.groupes ?? 0
        for (const h of noms.homonymes ?? []) {
          const cle = `${nom}|${h.groupe}|${h.nom}`
          if (!commandesHomonymes.has(cle)) {
            commandesHomonymes.set(cle, { ...h, ou: `surface ${nom}` })
          }
        }
        nommeesParLabel += noms.nommeesParLabel ?? 0
        for (const l of noms.labelsDeTravers ?? []) {
          const cle = `${nom}|${l.label}|${l.visible}`
          if (!labelsDeTravers.has(cle)) {
            labelsDeTravers.set(cle, { ...l, ou: `surface ${nom}` })
          }
        }
        /* `pointsDeNom` N'EST PAS incrémenté : sa garde exige l'égalité exacte
           avec adresses × largeurs × langues, pour la même raison que
           `pointsDeCible`. Les surfaces ont leur propre compte. */
        for (const item of noms.items) {
          const cle = `${item.balise}|${item.role}|${item.classes}`
          if (!commandesAnonymes.has(cle)) {
            commandesAnonymes.set(cle, { ...item, ou: `surface ${nom}` })
          }
        }

        process.stdout.write(
          `${audit.examines} textes, ${releve.sondees} cibles, ${noms.examinees} noms\n`,
        )
      } else {
        process.stdout.write('NON OUVERTE\n')
      }

      await contexte.close()
    }
  }

  /*
    ═══ LE MORCEAU QUI N'ARRIVE PAS, REJOUÉ À CHAQUE PASSAGE ═══

    Sur un réseau mobile lent, une requête de morceau qui échoue est plus
    probable qu'une exception de rendu. Le lot qui a posé la frontière d'erreur
    l'a mesuré une fois — écran terminal aux trois conditions — puis plus
    jamais : une preuve unique n'est pas une garde, et rien n'aurait rougi le
    jour où quelqu'un aurait retiré la frontière.

    C'est rejouable ici, et c'est donc ici que ça vit : on bloque la requête du
    morceau paresseux et on exige un écran terminal — un titre ET une commande.
    Un écran vide, c'est la page blanche d'avant.

    GARDE DU GARDE : le blocage doit AVOIR EU LIEU. Si le nom du morceau change
    et que le motif n'attrape plus rien, la page se chargerait normalement et
    l'assertion passerait pour la pire des raisons — « aucune page blanche »
    parce qu'on n'a rien cassé. On compte donc les requêtes réellement bloquées.
  */
  {
    const morceauParesseux = Object.entries(JSON.parse(readFileSync(join(RACINE, '.carte-des-paquets.json'), 'utf8')))
      .find(([, info]) => info.isDynamicEntry && info.modules.some((m) => m.includes('EspaceApplicatif')))?.[0]
    if (!morceauParesseux) {
      console.error(
        '\n✗ mesure-ui : aucun morceau dynamique portant `EspaceApplicatif` dans la carte des paquets.\n' +
          "   La frontière paresseuse a disparu, ou la carte ne la décrit plus — dans les deux cas\n" +
          "   l'épreuve du morceau manquant ne mesure plus rien.\n",
      )
      process.exit(1)
    }

    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: 390, height: 844 },
      locale: LANGUES[1],
      colorScheme: THEME_DE_GEOMETRIE,
    })

    await imposerLaPoliceLarge(contexte)
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    let bloquees = 0
    await page.route('**/*', (route) => {
      if (route.request().url().includes(morceauParesseux)) {
        bloquees++
        return route.abort()
      }
      return route.continue()
    })
    process.stdout.write(`   morceau paresseux bloqué (${morceauParesseux}) … `)
    await page.goto(BASE + '/demo', { waitUntil: 'domcontentloaded' })
    await attendre(page, '/demo (morceau bloqué)')
    const repli = await page.evaluate(() => ({
      titres: document.querySelectorAll('h1, h2, h3').length,
      commandes: document.querySelectorAll('a[href], button').length,
      elements: document.querySelectorAll('#root *').length,
    }))
    await contexte.close()
    process.stdout.write(`${bloquees} requête(s) bloquée(s), ${repli.elements} élément(s)\n`)

    if (bloquees === 0) {
      console.error(
        `\n✗ mesure-ui : aucune requête bloquée pour « ${morceauParesseux} ».\n` +
          "   L'épreuve n'a rien cassé, donc son verdict ne vaut rien — ce n'est pas « aucune\n" +
          "   page blanche », c'est « je n'ai pas réussi à faire échouer le morceau ».\n",
      )
      process.exit(1)
    }
    if (repli.titres === 0 || repli.commandes === 0) {
      console.error(
        `\n✗ mesure-ui : le morceau bloqué ne rend PAS d'écran terminal — ` +
          `${repli.elements} élément(s), ${repli.titres} titre(s), ${repli.commandes} commande(s).\n` +
          "   Une requête de morceau qui échoue est, sur un réseau mobile lent, plus probable\n" +
          "   qu'une exception de rendu. Sans frontière, elle rend une page blanche.\n",
      )
      process.exit(1)
    }
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

/* ══════════════════════════════════════════════════════════════════════════
   LE RENDU — quatre refus, dans l'ordre où ils se lisent
   ══════════════════════════════════════════════════════════════════════════ */

/*
  GARDE DU GARDE nº 0 : la question a-t-elle été POSÉE ?

  Sans elle, retirer l'appel à `MESURER_RENDU` de la boucle rendrait « aucune
  page non rendue » sans en avoir regardé une seule — et ce serait exactement
  le silence que ce lot ferme, réinstallé un cran plus haut. Le compte doit
  valoir un point de mesure par écran, par largeur et par langue.
*/
const RENDUS_ATTENDUS = adresses.length * LARGEURS.length * LANGUES.length
if (renduxExamines < RENDUS_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${renduxExamines} points de rendu examinés, moins que les ${RENDUS_ATTENDUS} attendus.\n` +
      "   La question « la page a-t-elle rendu ? » n'a pas été posée partout — ce n'est pas\n" +
      '   une absence de défaut, c\'est une absence de mesure.\n',
  )
  process.exit(1)
}

/*
  GARDE DU GARDE nº 1 : la liste d'exemptions existe et n'est pas vide.

  Le fichier introuvable lève à l'import, bien plus haut. Reste la liste vidée
  de son contenu, qui se lirait « plus rien à exempter » alors qu'elle veut dire
  « quelqu'un a effacé la mémoire de ce qui n'est pas mesurable ».

  SI ELLE EST LÉGITIMEMENT VIDE — le jour où `/app` deviendra mesurable — ce
  n'est pas ce refus qu'il faut contourner, c'est le MÉCANISME qu'il faut
  retirer : ce fichier, son import, et ces quatre gardes. Voir l'en-tête de
  `scripts/exemptions-de-rendu.mjs`, qui porte l'argument complet.
*/
const adressesExemptees = Object.keys(EXEMPTIONS_DE_RENDU)
/*
  LES QUATRE PLAINTES S'ACCUMULENT AVANT DE SORTIR, et ce n'est pas du confort.

  Chacune sortait d'abord tout de suite. Or elles arrivent ensemble dans le cas
  qui compte : vider la liste d'exemptions rend la liste vide ET laisse `/app`
  non rendu. Sortir sur la première aurait dit « la liste est vide » sans jamais
  NOMMER l'écran que cette liste tenait — c'est-à-dire sans montrer ce qu'on
  vient de perdre. Et chaque aller-retour coûte huit minutes de balayage.
*/
const plaintesDeRendu = []

/*
  LE CLIQUET, et pas un refus sur liste vide.

  Une liste VIDE est un état légitime — c'est même l'état qu'on vise, le jour où
  `/app` sera mesurable. Ce qu'il faut surveiller est l'autre bout : la liste
  qui s'allonge. `MAXIMUM_D_EXEMPTIONS` vaut le nombre d'entrées du jour, donc
  en ajouter une exige de le relever, donc de le montrer dans un diff.
*/
if (adressesExemptees.length > MAXIMUM_D_EXEMPTIONS) {
  plaintesDeRendu.push(
    `${adressesExemptees.length} exemptions de rendu pour un maximum de ${MAXIMUM_D_EXEMPTIONS} :\n` +
      `   ${adressesExemptees.join(', ')}\n` +
      "   Relevez `MAXIMUM_D_EXEMPTIONS` dans `scripts/exemptions-de-rendu.mjs` si l'ajout est\n" +
      '   justifié — le cliquet n\'interdit pas, il oblige à ce que l\'ajout se voie.',
  )
}

/*
  REFUS nº 2 : une page n'a pas rendu, et elle n'est pas exemptée.

  Le message nomme ROUTE, LANGUE, THÈME, LARGEUR et CAUSE. Les erreurs JS
  suivent en contexte — elles n'ont jamais déclenché ce refus, et le dire ici
  évite qu'on les lise comme le motif.
*/
if (nonRendus.length > 0) {
  const ecrans = [...new Set(nonRendus.map((r) => r.adresse))]
  const lignes = nonRendus
    .slice(0, 24)
    .map(
      (r) =>
        `   ${r.adresse}  ${r.langue}  thème ${r.theme}  ${r.largeur} px  —  ${r.cause}\n` +
        `      ${r.elements} élément(s) sous la racine, ${r.titres} titre(s), ${r.interactifs} interactif(s)` +
        (r.erreurs.length ? `\n      erreurs JS (contexte, PAS le motif) : ${r.erreurs.join(' · ')}` : ''),
    )
  if (nonRendus.length > 24) lignes.push(`   … et ${nonRendus.length - 24} autre(s)`)
  plaintesDeRendu.push(
    `${nonRendus.length} point(s) de mesure où la page N'A PAS RENDU, sur ${ecrans.length} écran(s) :\n` +
      lignes.join('\n') +
      "\n\n   Un écran qui ne rend rien ne déborde pas, n'a aucune cible trop petite et aucun texte\n" +
      '   sous le seuil : il traversait donc toutes les règles de cette porte en VERT. Si son\n' +
      "   échec est connu et hors du champ d'un paquet statique, inscrivez-le — avec sa date et\n" +
      '   son motif — dans `scripts/exemptions-de-rendu.mjs`.',
  )
}

/*
  REFUS nº 3 : une exemption a survécu à sa raison d'être.

  Elle est plus grave qu'elle n'en a l'air. Une adresse exemptée qui se met à
  rendre n'est pas seulement une ligne à nettoyer : c'est un écran REVENU dans
  le champ du mesurable, et donc un écran que plus personne ne mesure alors
  qu'on le pourrait.
*/
if (exemptionsQuiRendent.size > 0) {
  const lignes = [...exemptionsQuiRendent].map(([adresse, points]) => {
    const p = points[0]
    return (
      `   ${adresse} — exemptée depuis ${EXEMPTIONS_DE_RENDU[adresse].depuis}, et elle REND :\n` +
      `      ${points.length} point(s) rendus, dont ${p.langue} thème ${p.theme} ${p.largeur} px ` +
      `(${p.elements} éléments, ${p.titres} titres, ${p.interactifs} interactifs)`
    )
  })
  plaintesDeRendu.push(
    `${exemptionsQuiRendent.size} exemption(s) de rendu PÉRIMÉE(S) :\n` +
      lignes.join('\n') +
      "\n\n   Retirez l'entrée de `scripts/exemptions-de-rendu.mjs` : l'écran est mesurable, et le\n" +
      "   laisser exempté le sortirait du champ sans que personne ne l'ait décidé.",
  )
}

/*
  LE SEUIL DE MARGE A ÉTÉ RETIRÉ, et c'est un aveu autant qu'une correction.

  Il valait 3, inventé sous un minimum observé de 9. Le premier écran sobre du
  produit — un titre, « Réessayer », « Retour à l'accueil » — l'a fait rougir, et
  je l'ai abaissé à 2. Le repli de la frontière d'erreur en rend deux aussi. Le
  prochain écran légitime à un seul geste l'aurait fait descendre à 1, où il
  aurait été IDENTIQUE au critère et n'aurait plus rien gardé.

  Un seuil qui recule à chaque rencontre avec le réel ne mesure pas le réel : il
  le suit. Et ce qu'il prétendait protéger, le critère catégorique le protège
  déjà — un squelette de chargement rend 0 titre ET 0 élément interactif, un
  écran de produit en rend au moins un de chaque, et cette séparation ne
  s'érode pas quand un écran passe de neuf gestes à deux.

  Ce qui reste est le CHIFFRE, rendu à chaque exécution, sans porte. Une
  distribution qu'on lit vaut mieux qu'un seuil qu'on abaisse.
*/
console.log(
  `   critère de rendu : le plus dégarni des écrans rendus porte ` +
    `${plancherTitresObserve} titre(s) et ${plancherInteractifsObserve} élément(s) interactif(s).`,
)

/*
  Une exemption qui ne couvre RIEN est l'autre panne, symétrique de la
  périmée : l'adresse a disparu du balayage, et son entrée blanchit désormais
  un écran qui n'existe plus.
*/
/*
  « SANS OBJET » ET « PÉRIMÉE » SONT DEUX PANNES, ET ELLES SE CONFONDAIENT.

  La première version comptait comme sans objet toute exemption n'ayant couvert
  aucun point — or une exemption dont l'adresse s'est mise à RENDRE ne couvre
  aucun point non plus, par construction. La mutation M3 a donc rendu les deux
  plaintes à la fois, dont une fausse : elle affirmait que `/app` « n'est plus
  balayée » alors qu'elle venait d'être balayée vingt-deux fois.

  Sans objet veut dire une seule chose : l'adresse n'est plus dans le champ du
  balayage. Les adresses qui rendent sont donc retirées d'ici — leur cas est
  déjà nommé, correctement, par le refus des exemptions périmées.
*/
const exemptionsSansObjet = adressesExemptees.filter(
  (a) => !exemptionsEmployees.has(a) && !exemptionsQuiRendent.has(a),
)
if (exemptionsSansObjet.length > 0) {
  plaintesDeRendu.push(
    `${exemptionsSansObjet.length} exemption(s) de rendu ne couvrent AUCUN point :\n` +
      exemptionsSansObjet.map((a) => `   ${a} — l'adresse n'est plus balayée, ou n'existe plus`).join('\n') +
      '\n   Retirez-la, ou remettez son adresse dans le champ de la mesure.',
  )
}

if (plaintesDeRendu.length > 0) {
  console.error(`\n✗ mesure-ui : ${plaintesDeRendu.length} plainte(s) sur le RENDU des pages.\n`)
  for (const plainte of plaintesDeRendu) console.error('  ▸ ' + plainte + '\n')
  process.exit(1)
}

/*
  DIRE LA LISTE VIDE EN TOUTES LETTRES.

  Elle s'imprimait comme une ligne vide après deux-points — ce qui se lit
  « quelque chose a manqué » aussi bien que « il n'y a rien ». Or l'absence
  d'exemption est le meilleur état possible de cette porte : c'est celui où
  aucun écran n'est sorti du champ. Il mérite une phrase, pas un blanc.
*/
console.log(
  adressesExemptees.length === 0
    ? '   exemptions de rendu : AUCUNE — tous les écrans sont mesurés.'
    : `   exemptions de rendu employées : ` +
        adressesExemptees
          .map((a) => `${a} (depuis ${EXEMPTIONS_DE_RENDU[a].depuis}, ${exemptionsEmployees.get(a)} points)`)
          .join(', '),
)

/*
  ─── LE DÉBORDEMENT LOCAL, SON VERDICT ─────────────────────────────────────

  Regroupé PAR SIGNATURE et non par point : un même défaut se répète sur des
  dizaines d'écrans, et l'imprimer autant de fois donnerait un rapport que
  personne ne lit — donc une porte qu'on désactive.

  Chaque groupe rend ce qu'il faut pour AGIR : le pire dépassement mesuré, le
  nombre de points touchés, et deux exemples avec leur adresse et leur largeur.
  Le pire dépassement est aussi ce qu'on recopie en `plafond` si l'on décide de
  tolérer.
*/
if (debordsLocaux.length > 0) {
  const parSignature = new Map()
  for (const d of debordsLocaux) {
    if (!parSignature.has(d.signature)) parSignature.set(d.signature, [])
    parSignature.get(d.signature).push(d)
  }
  const groupes = [...parSignature.entries()].sort(
    (a, b) => Math.max(...b[1].map((d) => d.debord)) - Math.max(...a[1].map((d) => d.debord)),
  )

  console.error(
    `\n✗ mesure-ui : ${parSignature.size} forme(s) débordent LOCALEMENT de leur conteneur,` +
      ` sur ${debordsLocaux.length} occurrence(s) et ${elementsSondes} éléments sondés.\n` +
      "   Un contenu qui sort de sa boîte sans faire défiler la page se voit, et ne fait rougir\n" +
      "   aucune autre règle — c'est l'angle mort que celle-ci couvre.\n",
  )
  for (const [signature, liste] of groupes) {
    const pire = Math.max(...liste.map((d) => d.debord))
    const plafond = liste[0].plafond
    const exemples = liste
      .slice(0, 2)
      .map((d) => `${d.adresse}@${d.largeur}/${d.langue} « ${d.texte} »`)
      .join(' · ')
    console.error(
      `   +${pire}px  ${signature}\n` +
        (plafond === null
          ? ''
          : `      TOLÉRÉ jusqu'à ${plafond}px — le défaut s'est AGGRAVÉ, la tolérance ne le couvre plus.\n`) +
        `      ${liste.length} occurrence(s) · ex. ${exemples}\n`,
    )
  }
  console.error(
    '   Si le débordement est assumé, inscrivez la SIGNATURE dans `DEBORDS_LOCAUX_TOLERES`\n' +
      '   avec son plafond mesuré et son motif. Une tolérance sans plafond est un blanc-seing.',
  )
  process.exit(1)
}

if (coupuresOrphelines.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${coupuresOrphelines.size} libellé(s) se coupent en laissant un orphelin` +
      ` de moins de 3 caractères, sur ${libellesMesures} mesurés.\n` +
      "   Un fragment d'un ou deux caractères sous le reste du mot se lit comme une coquille,\n" +
      '   pas comme une césure. Rien ne déborde : aucune autre règle ne peut le voir.\n',
  )
  for (const d of coupuresOrphelines.values()) {
    console.error(
      `   « ${d.decoupe} »  →  orphelin « ${d.orphelin} »\n` +
        `      ${d.texte} · ${d.langue} · ${d.ou}\n`,
    )
  }
  console.error(
    "   Remède : un TRAIT D'UNION CONDITIONNEL (`\\u00AD`) dans le dictionnaire de la langue\n" +
      "   concernée, au point de césure correct — c'est exactement ce que le dictionnaire du\n" +
      '   navigateur pose tout seul là où il en a un.',
  )
  process.exit(1)
}

/*
  GARDE DU GARDE — LA SONDE DES COUPURES DOIT AVOIR TROUVÉ DES LIBELLÉS.

  Le marqueur retiré, renommé, ou la barre basse qui cesse d'être rendue sous
  `lg` : la sonde rendrait zéro défaut sur zéro libellé, et le rapport dirait
  « aucune coupure fautive » sans en avoir regardé une seule. C'est la panne que
  ce fichier reproche déjà à `contrast-audit.js`, et elle vaut ici comme ailleurs.
*/
if (libellesMesures === 0) {
  console.error(
    "\n✗ mesure-ui : aucun libellé de barre basse mesuré.\n" +
      "   Le marqueur `data-mesure=\"libelle-barre-basse\"` a-t-il disparu d'`AppShell` ?\n" +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

if (troncatures.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${troncatures.size} texte(s) du produit sont ROGNÉS,` +
      ` sur ${intitulesMesures} mesurés.\n` +
      "   Un texte rogné ne déborde de rien — il est coupé DANS sa boîte, par un\n" +
      '   `overflow: hidden` posé exprès. Aucune règle de débordement ne peut le voir, et le\n' +
      "   DOM porte la chaîne entière : un cas de rendu la trouve et passe au vert.\n",
  )
  for (const d of troncatures.values()) {
    console.error(
      `   −${d.manque}px en ${d.axe}  « ${d.texte} »\n` +
        `      ${d.offert}px offerts · ${d.langue} · racine ${d.racine}px · vu au pire à ${d.ou}\n`,
    )
  }
  console.error(
    "   Remède : rendre la place, pas raccourcir le texte. Un nom d'immeuble est une\n" +
      "   DONNÉE — l'abréger dans le dictionnaire ne ferait que déplacer le mensonge du\n" +
      '   rendu vers la source. Une donnée, elle, se DÉCLARE : `data-donnee` sur la boîte\n' +
      "   qui rogne ou sur un ancêtre. Le vocabulaire du produit, jamais.",
  )
  process.exit(1)
}

if (gestesHorsChamp.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${gestesHorsChamp.size} geste(s) sont HORS CHAMP au repos,` +
      ` sur ${gestesMesures} mesurés.\n` +
      "   Le bouton est peint, à la bonne taille, dans une boîte qui défile — mais en dehors\n" +
      '   de ce que la fenêtre montre, et rien ne dit qu’il existe. Aucune règle de\n' +
      '   débordement, de rognage ou de cible ne peut le voir : elles mesurent ce qui SORT,\n' +
      "   celle-ci mesure ce qui n’entre jamais.\n",
  )
  for (const d of gestesHorsChamp.values()) {
    console.error(
      `   ${d.cache}px hors champ  « ${d.geste} »\n` +
        `      table ${d.largeurTable}px dans ${d.largeurVue}px · ${d.langue} · vu au pire à ${d.ou}\n`,
    )
  }
  console.error(
    '   Remède : rendre le geste atteignable sans découvrir un défilement — une colonne\n' +
      '   COLLANTE satisfait la règle par construction, une table qui rétrécit aussi.',
  )
  process.exit(1)
}

if (valeursRognees.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${valeursRognees.size} valeur(s) COUPÉE(S) dans leur champ,` +
      ` sur ${valeursMesurees} mesurée(s).\n` +
      '   Un texte coupé DANS sa boîte ne déborde de rien : la page ne défile pas, le\n' +
      '   conteneur ne grandit pas, et le DOM porte la chaîne entière. Les règles voisines\n' +
      "   mesurent ce qui SORT ; celle-ci mesure ce qui n'entre pas.\n",
  )
  for (const d of valeursRognees.values()) {
    console.error(
      `   −${d.manque}px  « ${d.texte} »\n` +
        `      ${d.offert}px offerts · ${d.langue} · vu au pire à ${d.ou}\n`,
    )
  }
  console.error(
    '   Remèdes : élargir le champ ; raccourcir ce qu’il MONTRE une fois fermé, en gardant\n' +
      '   la forme longue dans sa liste (`OptionCombobox.resume`) ; raccourcir un gabarit.',
  )
  process.exit(1)
}

/*
  GARDE DU GARDE — LA SONDE DES VALEURS DOIT AVOIR VU DES CHAMPS.

  Ses trois exclusions sont des `continue` : resserrer l'une d'elles par
  inadvertance viderait la boucle sans rien casser, et le rapport écrirait
  « aucune valeur coupée » après n'avoir mesuré personne.
*/
if (valeursMesurees === 0) {
  console.error(
    '\n✗ mesure-ui : aucune valeur de champ mesurée au ROGNAGE.\n' +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

/*
  ═══ LE PARCOURS D'INSCRIPTION ═══

  L'ORDRE COMPTE : les marches ratées d'abord, les défauts ensuite. Un parcours
  qui n'a pas avancé n'a pas mesuré les écrans qu'il nomme, et ses relevés — même
  vides — ne disent rien. Les lire en premier serait lire un verdict rendu sur
  une autre page que celle du titre.
*/
if (marchesRatees.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${marchesRatees.length} marche(s) de l'inscription non franchie(s).\n` +
      "   Le fil d'étapes n'a pas confirmé le rang qu'on croyait mesurer. Les écrans qui\n" +
      "   suivaient cette marche N'ONT PAS ÉTÉ MESURÉS : ce n'est pas une absence de défaut.\n",
  )
  for (const m of marchesRatees) {
    console.error(`   ${m.adresse}  ·  ${m.langue}  ·  attendu ${m.attendu}, lu ${m.lu}\n`)
  }
  console.error(
    '   Causes probables : un champ renommé (le parcours remplit `name`, `email`, `phone`,\n' +
      '   `password`, puis le champ propre au rôle), une règle de validation nouvelle, ou le\n' +
      '   bouton de progression qui a changé de forme.',
  )
  process.exit(1)
}

if (valeursRogneesDeLInscription.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${valeursRogneesDeLInscription.length} valeur(s) COUPÉE(S) dans les étapes\n` +
      `   intérieures de l'inscription, sur ${champsDInscription} champ(s) mesuré(s).\n` +
      "   Ces trois écrans n'ont pas d'adresse : le balayage ne les voit pas, et c'est\n" +
      '   ce parcours qui les lui montre.\n',
  )
  for (const d of valeursRogneesDeLInscription) {
    console.error(
      `   −${d.manque}px  « ${d.texte} »  ·  ${d.offert}px offerts  ·  ${d.langue} ${d.ou}\n`,
    )
  }
  process.exit(1)
}

if (debordsDeLInscription.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${debordsDeLInscription.length} débordement(s) de page dans les étapes\n` +
      "   intérieures de l'inscription.\n",
  )
  for (const d of debordsDeLInscription) {
    console.error(
      `   ${d.langue} ${d.ou}  ·  ${d.decalage}px hors de ${d.largeurVue}px\n` +
        d.coupables
          .map((c) => `      ${c.balise}.${c.classes} — ${c.largeur}px, bord ${c.bordDroit}\n`)
          .join(''),
    )
  }
  process.exit(1)
}

if (debordsLocauxDeLInscription.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${debordsLocauxDeLInscription.length} débordement(s) local/locaux dans les\n` +
      "   étapes intérieures de l'inscription.\n",
  )
  for (const d of debordsLocauxDeLInscription) {
    console.error(`   +${d.debord}px  ${d.signature}  ·  ${d.langue} ${d.ou}\n`)
  }
  process.exit(1)
}

/*
  GARDE DU GARDE — LE PARCOURS DOIT AVOIR EU LIEU EN ENTIER.

  C'est la garde qui compte le plus de ce lot, parce que le parcours est la
  seule sonde de ce fichier dont la COUVERTURE dépend d'une suite de gestes.
  Toutes les autres visitent une adresse : si elle disparaît, `ATTENDUES` le
  dit. Celle-ci remplit quatre champs, clique deux fois et lit un fil ; chacune
  de ces cinq choses peut cesser de fonctionner sans que rien ne casse, et le
  rapport écrirait alors « aucun défaut » sur des écrans qu'il n'a pas ouverts.

  Le compte est EXACT et non un plancher : 3 rôles × 3 étapes × 11 largeurs × 2
  langues. Un parcours interrompu rend moins, un rôle ajouté rend plus, et les
  deux méritent qu'on relise ce bloc.
*/
const POINTS_D_INSCRIPTION_ATTENDUS =
  ROLES_DE_L_INSCRIPTION.length * ETAPES_INTERIEURES.length * LARGEURS.length * LANGUES.length
if (pointsDInscription !== POINTS_D_INSCRIPTION_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${pointsDInscription} point(s) relevé(s) dans les étapes intérieures de\n` +
      `   l'inscription, pour ${POINTS_D_INSCRIPTION_ATTENDUS} attendus ` +
      `(${ROLES_DE_L_INSCRIPTION.length} rôles × ${ETAPES_INTERIEURES.length} étapes × ` +
      `${LARGEURS.length} largeurs × ${LANGUES.length} langues).\n` +
      "   Un parcours qui s'arrête en chemin ne mesure pas les écrans qu'il annonce.",
  )
  process.exit(1)
}

/*
  ET LES CHAMPS AVEC. Les 198 points pourraient tous être relevés sur un écran
  qui ne rend AUCUN champ — le récapitulatif n'en a aucun, et c'est normal ; les
  deux autres étapes en portent quatre et cinq. Zéro champ sur tout le parcours
  voudrait dire que la sonde du rognage n'a rien eu à mesurer, donc que son
  verdict est vide.
*/
if (champsDInscription === 0) {
  console.error(
    "\n✗ mesure-ui : aucun champ mesuré au rognage dans les étapes de l'inscription.\n" +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

if (gestesNus.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${gestesNus.size} commande(s) de tableau SANS GLYPHE,` +
      ` sur ${commandesDeGeste} mesurée(s).\n` +
      "   Une colonne de geste n’a pas d’intitulé — « son bouton porte le sien » — donc rien\n" +
      '   au-dessus ne prévient qu’on entre dans des commandes. Un bouton fantôme nu, entre un\n' +
      '   nom et une date, se lit comme une donnée de plus : le survol devient le premier\n' +
      '   moment où l’on apprend que c’en est une, et un doigt n’a pas de survol.\n',
  )
  for (const d of gestesNus.values()) {
    console.error(`   « ${d.nu} »  ·  ${d.langue}  ·  vu à ${d.ou}\n`)
  }
  console.error(
    '   Remède : une `icon` sur le bouton, comme les autres colonnes de geste du produit.',
  )
  process.exit(1)
}

/*
  GARDE DU GARDE — LA SONDE DES GESTES DOIT AVOIR TROUVÉ DES GESTES.

  `data-colonne-tenue` retiré de `DataTable`, `data-defilant` renommé, ou les écrans à
  tableau sortis du balayage : la sonde rendrait zéro défaut sur zéro geste et
  le rapport écrirait « aucun geste hors champ » sans en avoir regardé un seul.
*/
if (gestesMesures === 0 || commandesDeGeste === 0) {
  console.error(
    '\n✗ mesure-ui : aucun geste de tableau mesuré.\n' +
      '   Les marqueurs `data-colonne-tenue` et `data-defilant` sont-ils toujours sur `DataTable` ?\n' +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

/*
  GARDE DU GARDE — LA SONDE DES ROGNAGES DOIT AVOIR TROUVÉ DES TEXTES.

  Un `truncate` disparu du produit, `data-donnee` posé trop haut, ou la sonde
  détournée : elle rendrait zéro défaut sur zéro texte, et le rapport écrirait
  « aucun texte rogné » sans en avoir regardé un seul. C'est la même panne que
  celle que la sonde des coupures se refuse déjà, et elle ne devient pas
  acceptable parce qu'elle est ailleurs.

  LE PLANCHER SUIT LE RÉEL. Mesuré sur ce dépôt : le balayage voit plusieurs
  centaines de textes rognables par passe. Zéro ne peut donc venir que d'une
  sonde cassée.
*/
if (intitulesMesures === 0) {
  console.error(
    '\n✗ mesure-ui : aucun texte rognable mesuré.\n' +
      '   La sonde cherche `text-overflow: ellipsis` et `-webkit-line-clamp` sur toute la page ;\n' +
      "   `data-donnee` a-t-il été posé sur un ancêtre trop haut ?\n" +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

/*
  LA TOLÉRANCE S'APPLIQUE ICI, PAS DANS LA SONDE, et c'est délibéré : la sonde
  doit rendre TOUT ce qu'elle voit pour que `maximaVus` connaisse le vrai pire,
  y compris sous une ligne tolérée. Filtrer au relevé rendrait le plafond
  invérifiable autrement qu'en le baissant à 1 et en relançant le navigateur.
*/
const maximaVus = new Map()
for (const d of motsDebordants.values()) {
  const vu = maximaVus.get(d.texte)
  if (vu === undefined || d.manque > vu) maximaVus.set(d.texte, d.manque)
}
const nonCouverts = []
for (const d of motsDebordants.values()) {
  const dispense = MOTS_DEBORDANTS_TOLERES.find((x) => x.texte === d.texte)
  if (!dispense || d.manque > dispense.plafond) nonCouverts.push({ ...d, dispense })
}

/*
  GARDE DU GARDE — UNE TOLÉRANCE QUI NE COUVRE PLUS RIEN DOIT MOURIR.

  Un libellé réparé, un écran retiré du balayage, un montant qui rétrécit : la
  ligne resterait, et couvrirait le jour où le défaut revient — sans que personne
  ne l'ait décidé. Une dispense doit être RÉCLAMÉE à chaque passage.
*/
const dispensesInutiles = MOTS_DEBORDANTS_TOLERES.filter((x) => !maximaVus.has(x.texte))
if (dispensesInutiles.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${dispensesInutiles.length} tolérance(s) de mot débordant ne couvrent plus rien.\n` +
      '   Le défaut a été réparé, ou le texte a changé. Retirez la ligne de\n' +
      '   `MOTS_DEBORDANTS_TOLERES` : une dispense qui ne sert plus finira par servir.\n',
  )
  for (const x of dispensesInutiles) console.error(`   « ${x.texte} »  (${x.ou})\n`)
  process.exit(1)
}

/*
  GARDE DU GARDE — UN PLAFOND PLUS HAUT QUE LE MESURÉ EST DU MOU.

  Une tolérance inscrite à 18 px pour un défaut qui n'en fait plus que 3 laisse
  quinze pixels de dérive gratuite. Le plafond doit valoir le mesuré.
*/
const plafondsTropHauts = MOTS_DEBORDANTS_TOLERES.filter(
  (x) => maximaVus.has(x.texte) && maximaVus.get(x.texte) < x.plafond,
)
if (plafondsTropHauts.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${plafondsTropHauts.length} plafond(s) de mot débordant dépassent le mesuré.\n`,
  )
  for (const x of plafondsTropHauts) {
    console.error(`   « ${x.texte} » : plafond ${x.plafond}, mesuré ${maximaVus.get(x.texte)}\n`)
  }
  process.exit(1)
}

if (nonCouverts.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${nonCouverts.length} mot(s) plus large(s) que leur boîte,` +
      ` sur ${feuillesMesurees} feuilles de texte mesurées.\n` +
      "   Un mot qu'aucune espace ne coupe sort de sa colonne et passe SOUS son voisin. La\n" +
      '   page, elle, ne déborde pas : la boîte voisine absorbe la sortie. Ni la règle de\n' +
      "   page ni celle du rognage ne peuvent le voir — voir `MESURER_DEBORDEMENT_DE_MOT`.\n",
  )
  for (const d of nonCouverts) {
    console.error(
      `   −${d.manque}px  « ${d.texte} »\n` +
        `      ${d.offert}px offerts · ${d.langue} · vu au pire à ${d.ou}\n`,
    )
  }
  console.error(
    '   Remèdes, du plus honnête au moins : rendre la place ; annuler un interlettrage\n' +
      "   hérité d'un jeton de capitales (`tracking-normal`) ; autoriser la CÉSURE\n" +
      '   (`hyphens-auto`), qui coupe selon la langue du document. Jamais `break-words` sur\n' +
      "   un montant ou une donnée : il coupe n'importe où, y compris dans un nombre.",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE — LA SONDE DES MOTS DÉBORDANTS DOIT AVOIR VU DU TEXTE.

  Ses quatre exclusions sont des `continue` : resserrer l'une d'elles par
  inadvertance — un `display` qui bascule, un `overflow` posé plus haut dans la
  coquille — viderait la boucle sans rien casser d'autre, et le rapport écrirait
  « aucun mot débordant » après n'avoir mesuré personne. Même panne que celle
  que la sonde des rognages se refuse juste au-dessus.

  Le seuil est CATÉGORIQUE et non numérique : rien contre quelque chose. Un
  minimum chiffré serait un nombre que le premier écran légitimement sobre ferait
  relever par réflexe.
*/
if (feuillesMesurees === 0) {
  console.error(
    '\n✗ mesure-ui : aucune feuille de texte mesurée au DÉBORDEMENT DE MOT.\n' +
      "   Les exclusions de `MESURER_DEBORDEMENT_DE_MOT` ont-elles avalé toute la page ?\n" +
      '   Une sonde qui ne trouve rien ne prouve rien.',
  )
  process.exit(1)
}

/*
  ─── GARDE DU GARDE — UN PLAFOND QUI DÉPASSE LA RÉALITÉ EST UN MENSONGE ────

  L'autre garde du garde, juste en dessous, fait mourir une tolérance qui ne
  couvre PLUS RIEN. Celle-ci s'occupe du cas d'à côté, qui s'est produit deux
  fois dans la même journée et que rien ne signalait : une tolérance qui couvre
  ENCORE quelque chose, mais BEAUCOUP PLUS QU'IL NE FAUT.

  MESURÉ, deux fois :

   — la carte d'alerte réparée a fait tomber `div.flex flex-wrap items-center
     gap-2` de 121 px sur 74 occurrences à 81 sur 11. La signature est PARTAGÉE
     avec la carte de chantier, donc l'entrée survivait — en blanchissant
     désormais 40 px de régression que plus rien ne justifiait ;
   — le montant de KPI réparé a fait tomber son entrée de 30 px sur 28
     occurrences à 7 sur 8, et la porte est restée VERTE.

  Dans les deux cas il a fallu abaisser le plafond à 1 et relancer dix minutes
  de navigateur pour apprendre le vrai chiffre. Un rituel qu'aucune garde ne
  réclame est un rituel que personne n'exécute.

  LA MARGE EST DE QUATRE PIXELS, ET C'EST UNE PRUDENCE NON MESURÉE. Sur cette
  machine, deux exécutions du même paquet rendent des maxima IDENTIQUES au
  pixel — le rendu du texte y est déterministe. Ce que je n'ai pas mesuré, c'est
  une AUTRE machine : des métriques de police différentes déplaceraient chaque
  maximum de quelques pixels, et une marge nulle ferait rougir la porte partout
  ailleurs pour un non-défaut. Quatre pixels absorbent ce que je suppose être
  cette dérive. Le jour où on la mesure, ce paragraphe se remplace par un
  chiffre.

  CE QU'ELLE NE PEUT PAS FAIRE : corriger le plafond toute seule. Le nombre est
  écrit à la main, avec son motif, parce que le baisser est une DÉCISION —
  celle de dire « voilà où en est le produit aujourd'hui ». Une garde qui
  réécrirait le fichier ferait disparaître la décision en même temps que
  l'écart.
*/
const MARGE_DE_PLAFOND = 4

const plafondsMenteurs = Object.entries(DEBORDS_LOCAUX_TOLERES)
  .filter(([cle]) => tolerancesLocalesUtilisees.has(cle))
  .map(([cle, { plafond }]) => ({ cle, plafond, reel: maximaLocaux.get(cle)?.debord ?? 0 }))
  .filter(({ plafond, reel }) => plafond - reel > MARGE_DE_PLAFOND)

if (plafondsMenteurs.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${plafondsMenteurs.length} plafond(s) local(aux) dépassent la réalité mesurée.\n` +
      "   Un plafond plus haut que le défaut qu'il couvre blanchit d'avance l'écart entre les deux.\n",
  )
  for (const { cle, plafond, reel } of plafondsMenteurs) {
    const ou = maximaLocaux.get(cle)?.ou ?? '—'
    console.error(
      `   ${cle}\n` +
        `      inscrit ${plafond}px, mesuré ${reel}px — ${plafond - reel}px blanchis pour rien (pire cas : ${ou})\n` +
        `      Abaissez le plafond à ${reel} et dites dans le motif ce qui a changé.\n`,
    )
  }
  process.exit(1)
}

/* ─── LE BLANC IMPOSÉ ─────────────────────────────────────────────────────── */

/*
  GARDE DU GARDE, AVANT LE VERDICT. Une sonde qui ne regarderait plus une seule
  cellule étirée rendrait « aucun creux » avec la même sérénité qu'un produit
  sain. Le seuil est bas et volontairement grossier : il ne dit pas que la mesure
  est juste, il dit qu'elle a EU LIEU.
*/
if (cellulesEtirees < 50) {
  console.error(
    `\n✗ mesure-ui : la sonde du blanc imposé n’a regardé que ${cellulesEtirees} cellule(s) étirée(s).\n` +
      '   Un produit qui n’en aurait plus n’existe pas ; c’est le sélecteur qui a cessé de trouver.\n' +
      '   Vérifiez `MESURER_BLANC_IMPOSE` avant de croire à son verdict.\n',
  )
  process.exit(1)
}

const creuxFautifs = [...blancsImposes.entries()]
  .map(([signature, releve]) => ({ signature, ...releve, toleree: BLANCS_IMPOSES_TOLERES[signature] }))
  .filter(({ blanc, toleree }) => {
    if (!toleree) return true
    return blanc > toleree.plafond
  })

for (const { signature, toleree } of [...blancsImposes.keys()].map((s) => ({
  signature: s,
  toleree: BLANCS_IMPOSES_TOLERES[s],
}))) {
  if (toleree) tolerancesDeBlancUtilisees.add(signature)
}

if (creuxFautifs.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${creuxFautifs.length} cellule(s) portent un BLANC IMPOSÉ non toléré.\n` +
      '   Une voisine plus haute les étire, et le vide se paie en bas de la boîte. Le défaut ne\n' +
      '   déborde de rien, ne coûte aucune requête et tient tous les seuils : aucune autre règle\n' +
      '   de cette porte ne peut le voir.\n' +
      '   LE REMÈDE N’EST PAS DE RÉDUIRE LA VOISINE. C’est, au choix : donner à la cellule de\n' +
      '   quoi occuper sa hauteur, la sortir de la rangée, ou déclarer qu’elle distribue son\n' +
      '   espace — un pied poussé en `mt-auto`, un contenu centré — auquel cas le vide devient\n' +
      '   une décision et cesse d’être subi.\n',
  )
  for (const { signature, blanc, hauteur, part, ou, texte, toleree, parite: releveParite } of creuxFautifs) {
    console.error(
      `   ${blanc}px de vide sur ${hauteur}px (${part} %) — ${ou}\n` +
        `      ${signature}\n` +
        `      « ${texte} » · parité de rangée ${releveParite}%` +
        (toleree ? `\n      plafond inscrit : ${toleree.plafond}px — DÉPASSÉ` : '') +
        '\n',
    )
  }
  process.exit(1)
}

/*
  GARDE DU GARDE — une tolérance de creux qui ne couvre plus rien doit mourir.
  Même raison que pour les débordements : la signature d'un défaut réparé
  continuerait à blanchir tout ce qui reprendrait le même jeu de classes.
*/
const creuxOrphelins = Object.keys(BLANCS_IMPOSES_TOLERES).filter(
  (cle) => !tolerancesDeBlancUtilisees.has(cle),
)
if (creuxOrphelins.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${creuxOrphelins.length} tolérance(s) de blanc ne couvrent plus aucun creux.\n` +
      creuxOrphelins.map((cle) => `   ${cle} — à retirer de BLANCS_IMPOSES_TOLERES`).join('\n'),
  )
  process.exit(1)
}

const blancsMenteurs = Object.entries(BLANCS_IMPOSES_TOLERES)
  .filter(([cle]) => tolerancesDeBlancUtilisees.has(cle))
  .map(([cle, { plafond }]) => ({ cle, plafond, reel: blancsImposes.get(cle)?.blanc ?? 0 }))
  .filter(({ plafond, reel }) => plafond - reel > MARGE_DE_PLAFOND)

if (blancsMenteurs.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${blancsMenteurs.length} plafond(s) de blanc dépassent la réalité mesurée.\n`,
  )
  for (const { cle, plafond, reel } of blancsMenteurs) {
    console.error(`   ${cle}\n      inscrit ${plafond}px, mesuré ${reel}px — abaissez-le.\n`)
  }
  process.exit(1)
}

console.log(
  `✓ mesure-ui : ${cellulesEtirees} cellule(s) étirée(s) mesurée(s) au BLANC IMPOSÉ, ` +
    `${blancsImposes.size} creux relevé(s), ${Object.keys(BLANCS_IMPOSES_TOLERES).length} toléré(s).\n` +
    '  Les rangées de PAIRS en sont exclues : leur blanc est le prix de l’alignement, pas du gâchis.',
)

/*
  GARDE DU GARDE — une tolérance locale qui ne couvre plus rien doit mourir.

  Même doctrine que pour `TOLERES`, et même raison : la signature d'un défaut
  réparé continuerait à blanchir tout ce qui reprendrait le même jeu de classes.
*/
const localesOrphelines = Object.keys(DEBORDS_LOCAUX_TOLERES).filter(
  (cle) => !tolerancesLocalesUtilisees.has(cle),
)
if (localesOrphelines.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${localesOrphelines.length} tolérance(s) locale(s) ne couvrent plus aucun débordement.\n` +
      localesOrphelines.map((cle) => `   ${cle} — à retirer de DEBORDS_LOCAUX_TOLERES`).join('\n'),
  )
  process.exit(1)
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
/*
  GARDE DU GARDE : la sonde de plancher doit s'être exécutée À CHAQUE POINT.

  Même forme que celle du rendu, et pour la même raison. La sonde ne couvrait
  que deux largeurs sur onze — 92 points sur 506 — pendant que le rapport final
  annonçait « 23 écrans × 11 largeurs × 2 langues ». Le rapport ne mentait pas
  sur ce qu'il avait balayé, il mentait par voisinage : la phrase couvrait la
  page entière, la règle couvrait un cinquième.

  Restreindre à nouveau le balayage — par distraction ou pour gagner trois
  secondes — doit désormais ARRÊTER la porte, jamais rendre « aucune cible sous
  le plancher ». C'est ce que ce compte fait, et rien d'autre.
*/
const POINTS_DE_CIBLE_ATTENDUS = adresses.length * LARGEURS.length * LANGUES.length
if (pointsDeCible !== POINTS_DE_CIBLE_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : la sonde de plancher s'est exécutée ${pointsDeCible} fois, ` +
      `pour ${POINTS_DE_CIBLE_ATTENDUS} points attendus ` +
      `(${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues).\n` +
      "   Une règle qui ne couvre pas ce que le rapport annonce rend « aucune cible sous le\n" +
      "   plancher » sur des points qu'elle n'a jamais regardés.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : les surfaces doivent s'être OUVERTES.

  Le compte, et non un booléen : six surfaces dont une seule s'ouvre est un
  état parfaitement possible — un libellé retraduit, un composant déplacé — et
  qui rendrait « aucun défaut sur les surfaces interactives » avec cinq
  surfaces jamais vues. Chaque échec d'ouverture a déjà déposé sa plainte plus
  haut ; ce compte est la seconde maille, celle qui attrape le cas où la table
  elle-même aurait été vidée.

  Et le compte des TEXTES avec, car une surface peut s'ouvrir sur du vide : le
  témoin apparaît, l'audit ne trouve rien à peser, et le silence repasse pour un
  acquittement. Le plancher est grossier à dessein — on distingue « il a
  regardé » de « il n'a rien vu ».
*/
if (plaintesDeSurface.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${plaintesDeSurface.length} surface(s) interactive(s) ne se sont pas ouvertes.\n`,
  )
  for (const p of plaintesDeSurface) console.error('  ▸ ' + p + '\n')
  process.exit(1)
}

if (surfacesOuvertes !== SURFACES_ATTENDUES) {
  console.error(
    `\n✗ mesure-ui : ${surfacesOuvertes} surface(s) interactive(s) ouverte(s) pour ${SURFACES_ATTENDUES} attendues.\n` +
      "   Une surface qu'on n'ouvre pas n'est pas une surface sans défaut. Le geste qui\n" +
      "   l'ouvre a changé, ou la table les décrivant a été vidée.\n",
  )
  process.exit(1)
}

const TEXTES_DE_SURFACE_ATTENDUS = 60
if (textesDeSurface < TEXTES_DE_SURFACE_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${textesDeSurface} textes audités dans les surfaces, moins que les ${TEXTES_DE_SURFACE_ATTENDUS} attendus.\n` +
      "   Les surfaces se sont ouvertes sur du vide, ou l'audit ne les lit pas.\n",
  )
  process.exit(1)
}

/*
  ═══════════ TOUTE COMMANDE VISIBLE PORTE UN NOM ═══════════

  WCAG 4.1.2. Un bouton sans nom s'annonce « bouton », et rien d'autre : la
  commande existe pour l'oreille sans exister pour la compréhension.

  LA RÈGLE VISE LA CLASSE, pas un endroit. Elle s'exécute sur les premiers
  rendus — 23 écrans, 11 largeurs, 2 langues — ET dans les surfaces qui ne
  s'ouvrent qu'au clic. C'est cette seconde moitié qui manquait : le calendrier
  et le sélecteur de mois de la modale de paiement ne sont regardés par rien
  d'autre, puisqu'aucune capture ne les contient.
*/
/*
  ═══ DEUX COMMANDES D'UNE MÊME LISTE NE PORTENT PAS LE MÊME NOM ═══

  La règle est écrite dans `noms-accessibles.js`, avec son seuil et ses limites.
  Ce qu'il faut savoir ici : elle refuse à partir de TROIS, parce qu'une paire de
  gestes symétriques est ordinaire et qu'une colonne de gestes ne l'est pas.

  ELLE REFUSE, ELLE NE PRÉVIENT PAS, et c'est la leçon de ses deux prédécesseurs :
  la même règle vivait en prose dans `Meters` et dans `Portfolio` depuis des lots,
  appliquée là et nulle part ailleurs. Quatre écrans la violaient quand cette
  garde est née — dont les deux gestes les plus lourds du produit, la mise en
  demeure et le retrait d'un accès.
*/
if (commandesHomonymes.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${commandesHomonymes.size} nom(s) accessible(s) porté(s) par TROIS commandes ` +
      `ou plus dans une même liste.\n` +
      "   On les atteint l'une après l'autre à la tabulation, et rien n'est prononcé\n" +
      '   entre elles : le nom doit porter ce qui les distingue — le logement, la\n' +
      "   personne, la période. Le libellé VISIBLE, lui, garde son mot court : c'est\n" +
      "   `aria-label` qui reçoit le complément.\n",
  )
  for (const c of commandesHomonymes.values()) {
    console.error(`  ▸ ${c.ou} — « ${c.nom} » ${c.fois} fois dans un <${c.groupe}>`)
    console.error(`     ${c.html}\n`)
  }
  process.exit(1)
}

/*
  ═══ LE NOM ACCESSIBLE CONTIENT LE LIBELLÉ VISIBLE — WCAG 2.5.3 ═══

  Le pendant de la règle ci-dessus, et sa dette : renommer un geste pour le
  distinguer de ses homonymes consiste à AJOUTER une donnée au libellé visible.
  L'ajouter mal casse la commande vocale, qui cherche dans le nom accessible ce
  que l'utilisateur LIT à l'écran.

  ELLE EST NÉE D'UNE FAUTE LIVRÉE, la sienne : le lot qui a posé vingt-neuf de ces
  noms en a écrit un — anglais — qui ne contient pas son libellé, « Remove Diane's
  access » pour un bouton qui affiche « Remove access ». Son jumeau français a été
  pris le jour même par un cas qui rend l'écran en français ; celui-là est passé,
  parce qu'aucun cas ne rend cet écran en anglais. Cette porte-ci parcourt les deux
  langues, ce qui est exactement ce qui manquait.

  ET ELLE A ÉTÉ TROUVÉE PAR HASARD, ce qui vaut d'être écrit : `modales` a signalé
  « le bouton qui l'ouvre est introuvable ». Un nom que la voix n'atteint pas est
  un nom que l'automatisation n'atteint pas — même chaîne, même recherche. La
  porte des modales l'a donc vu sans savoir ce qu'elle voyait ; celle-ci le nomme.
*/
if (labelsDeTravers.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${labelsDeTravers.size} nom(s) accessible(s) qui ne contiennent pas ` +
      `le libellé visible de leur commande, sur ${nommeesParLabel} examinée(s).\n` +
      "   Qui commande à la voix dit ce qu'il LIT : « cliquer sur Retirer l'accès ».\n" +
      '   Si le nom ne contient pas cette chaîne, le bouton est à l’écran, lisible,\n' +
      '   et inatteignable (WCAG 2.5.3). Le complément s’AJOUTE au libellé — «\n' +
      '   Retirer l’accès — Diane Fotso » —, il ne le reformule pas.\n',
  )
  for (const l of labelsDeTravers.values()) {
    console.error(`  ▸ ${l.ou} — nom « ${l.label} » pour le libellé « ${l.visible} »`)
    console.error(`     ${l.html}\n`)
  }
  process.exit(1)
}

if (commandesAnonymes.size > 0) {
  console.error(
    `\n✗ mesure-ui : ${commandesAnonymes.size} forme(s) de commande sans nom accessible, ` +
      `sur ${nomsExamines} commandes examinées.\n` +
      "   Un lecteur d'écran annonce « bouton » sans dire lequel (WCAG 4.1.2).\n" +
      '   Le nom vient d’`aria-label`, d’`aria-labelledby`, d’un `label[for]`, ou du\n' +
      '   contenu textuel — et il passe par les DEUX dictionnaires, jamais en dur.\n',
  )
  for (const c of commandesAnonymes.values()) {
    console.error(`  ▸ ${c.ou} — <${c.balise}> rôle ${c.role || '(implicite)'}`)
    if (c.haspopup) console.error(`     aria-haspopup="${c.haspopup}"`)
    console.error(`     ${c.html}\n`)
  }
  process.exit(1)
}

/*
  GARDE DU GARDE : la sonde doit être passée PARTOUT où on la croit passée.

  Égalité exacte, comme pour `pointsDeCible`, et pour la même asymétrie : une
  sonde qui saute un écran fait tomber le compte et arrête tout ; un écran de
  plus le fait monter et ne dérange personne.
*/
const POINTS_DE_NOM_ATTENDUS = adresses.length * LARGEURS.length * LANGUES.length
if (pointsDeNom !== POINTS_DE_NOM_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : la sonde des noms s'est exécutée en ${pointsDeNom} points ` +
      `pour ${POINTS_DE_NOM_ATTENDUS} attendus ` +
      `(${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues).\n` +
      "   Une commande non regardée n'est pas une commande nommée.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : elle doit avoir REGARDÉ des commandes, et dans les surfaces
  aussi.

  « Zéro commande anonyme » et « zéro commande examinée » s'écrivent pareil dans
  un journal — c'est la panne exacte que ce dépôt reproche à `contrast-audit.js`
  d'avoir subie pendant des lots. Le second plancher est celui qui compte : un
  sélecteur périmé dans `SURFACES_INTERACTIVES` ferait tomber les surfaces à
  zéro sans faire bouger le total de plus de 1 %.

  Les deux planchers sont GROSSIERS à dessein. On ne devine pas le bon nombre de
  commandes du produit ; on distingue « elle a travaillé » de « elle n'a rien vu ».
*/
const NOMS_ATTENDUS = 4000
const NOMS_DE_SURFACE_ATTENDUS = 150

if (nomsExamines < NOMS_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${nomsExamines} commandes examinées pour les noms, ` +
      `moins que les ${NOMS_ATTENDUS} attendues.\n` +
      "   La sonde ne regarde plus rien — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

if (nomsDeSurface < NOMS_DE_SURFACE_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${nomsDeSurface} commandes examinées DANS LES SURFACES, ` +
      `moins que les ${NOMS_DE_SURFACE_ATTENDUS} attendues.\n` +
      '   Les déclencheurs de panneau sont exactement ce que cette règle devait couvrir :\n' +
      "   ils n'apparaissent dans aucun premier rendu.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE, ET C'EST LA PLUS INTÉRESSANTE : notre approximation doit
  encore tomber d'accord avec un VRAI calcul de nom accessible.

  `noms-accessibles.js` n'implémente pas `accname` ; il en tient la part qui
  décide ici, et son en-tête liste ses écarts connus. Une telle liste vieillit
  comme la règle qu'elle accompagne : personne ne la relit, et elle finit par
  décrire un fichier qui a changé. On la confronte donc à `ariaSnapshot()` de
  Playwright, qui, lui, implémente accname.

  Un désaccord ne dit PAS que le produit a un défaut. Il dit que notre
  approximation en a un — le seul défaut qu'une garde ne peut pas trouver
  seule, puisqu'elle est l'instrument.

  Mesuré au moment d'écrire ces lignes : 92 points confrontés, 0 désaccord.
*/
if (accordsAccname.length !== LANGUES.length) {
  console.error(
    `\n✗ mesure-ui : l'accord avec accname a été relevé ${accordsAccname.length} fois ` +
      `pour ${LANGUES.length} langues.\n` +
      `   Le point de confrontation (${ADRESSE_D_ACCORD} à ${LARGEUR_D_ACCORD} px) n'existe plus.\n` +
      "   Sans lui, la liste d'angles morts de `noms-accessibles.js` n'est plus qu'une promesse.\n",
  )
  process.exit(1)
}

const desaccords = accordsAccname.filter((a) => a.nous !== a.playwright)
if (desaccords.length > 0) {
  console.error(
    `\n✗ mesure-ui : notre calcul de nom accessible et celui de Playwright ne s'accordent plus.\n` +
      "   Ce n'est pas un défaut du produit : c'est un défaut de la sonde.\n" +
      "   Relire les écarts déclarés dans l'en-tête de `scripts/noms-accessibles.js` —\n" +
      "   l'un d'eux vient de cesser d'être vrai.\n",
  )
  for (const a of desaccords) {
    console.error(
      `  ▸ ${ADRESSE_D_ACCORD} ${LARGEUR_D_ACCORD}px ${a.langue} : ` +
        `nous ${a.nous} anonyme(s), playwright ${a.playwright}`,
    )
  }
  console.error('')
  process.exit(1)
}

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
  GARDE DU GARDE, en deux moitiés, parce que cette règle a deux façons de se
  taire.

  LA PREMIÈRE : le panneau ne s'ouvre pas. Le marqueur du déclencheur renommé,
  `doublonsDuPanneau` rend `null`, et la porte dirait « aucun doublon » sans
  avoir ouvert un seul panneau.

  LA SECONDE, plus insidieuse : le panneau s'ouvre mais la BARRE est vide. Rien
  n'y étant rendu, rien ne peut y être rejoué, et la règle passe au vert en
  n'ayant comparé le panneau à rien. C'est l'état qu'aurait produit une barre
  qui déléguerait TOUT au menu — précisément la régression que ce lot corrige,
  vue de l'autre bord. Six est le compte du jour à 1440 px : quatre liens de
  section et deux boutons d'inscription. On n'exige pas six, on exige que la
  barre porte de quoi être rejouée.
*/
if (panneauxMesures < LANGUES.length) {
  console.error(
    `\n✗ mesure-ui : panneau de la vitrine ouvert dans ${panneauxMesures} langue(s) sur ${LANGUES.length}.\n` +
      "   Le déclencheur porte-t-il encore `data-declencheur-reglages` ?\n" +
      "   Une règle qui n'a rien regardé ne dit pas qu'il n'y a rien à voir.\n",
  )
  process.exit(1)
}
if (barreLaPlusGarnie < 2) {
  console.error(
    `\n✗ mesure-ui : la barre de la vitrine ne portait que ${barreLaPlusGarnie} commande(s) à 1440 px.\n` +
      "   La règle du doublon compare le panneau à la barre : une barre vide la rend vacue.\n",
  )
  process.exit(1)
}

/*
  PUIS LE DOUBLON, juste après l'absence : ce sont les deux défauts que les
  règles de pixels ne savent pas voir. L'une regarde une commande qui a disparu,
  l'autre une commande rendue deux fois — et retirer comme redoubler laissent
  les débordements, les replis et le jeu de la barre parfaitement verts.
*/
if (rejouements.length > 0) {
  console.error(
    `\n✗ mesure-ui : le panneau de la vitrine rejoue à 1440 px des commandes que la barre montre déjà.\n` +
      "   Deux navigations identiques côte à côte : le regard doit choisir, et rien ne l'aide.\n",
  )
  for (const r of rejouements) {
    console.error(`   ${r.langue}  →  ${r.rejoues.length} rejouée(s) : ${r.rejoues.join(' · ')}`)
    console.error(`      la barre porte : ${r.barre.join(' · ')}`)
  }
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
  PUIS L'AXE DE L'ACCROCHE. Il vient avant les règles de pixels pour la même
  raison que les deux précédentes : elles regardent ce qui DÉBORDE, celle-ci
  regarde ce qui manque — un vide de 111 px qu'aucun débordement, aucun repli et
  aucun jeu de barre ne pouvait signaler, puisque rien n'était de trop.
*/
const GARDE_ACCROCHE = (() => {
  // Garde du garde, en deux moitiés — les marqueurs, puis la portée.
  if (accroches.length === 0) {
    return (
      'aucune mesure du bloc d’accroche.\n' +
      '   Les marqueurs `accroche-titre`, `accroche-lecture` et `accroche-illustration`\n' +
      '   sont-ils encore posés ? Une règle qui n’a rien regardé ne dit rien.'
    )
  }
  /*
    La règle compare l'écart d'une largeur à l'autre : elle est VACUE si toutes
    les largeurs mesurées sont du même côté du point de rupture. C'est
    exactement l'état d'où vient le défaut — il ne se voyait qu'en comparant une
    grille à une colonne à une grille à deux.
  */
  const empilees = accroches.filter((a) => !a.cote_a_cote).length
  const cote = accroches.filter((a) => a.cote_a_cote).length
  if (empilees === 0 || cote === 0) {
    return (
      `les ${accroches.length} mesures sont toutes du même côté du point de rupture ` +
      `(${empilees} empilées, ${cote} côte à côte).\n` +
      '   La règle compare les deux dispositions : sans les deux, elle ne compare rien.'
    )
  }

  const ecarts = [...new Set(accroches.map((a) => a.ecart))]
  if (ecarts.length > 1) {
    const parEcart = new Map()
    for (const a of accroches) {
      if (!parEcart.has(a.ecart)) parEcart.set(a.ecart, [])
      parEcart.get(a.ecart).push(`${a.largeur}px ${a.langue}`)
    }
    return (
      `le vide entre le titre et la première ligne de lecture prend ${ecarts.length} valeurs :\n` +
      [...parEcart.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([e, ou]) => `      ${String(e).padStart(4)} px  →  ${ou.join(', ')}`)
        .join('\n') +
      '\n   Le même bloc ne peut pas se lire autrement selon la largeur sans que rien ne l’ait décidé.'
    )
  }

  // Le second fait, et il ne vaut que là où les colonnes sont côte à côte.
  const decroche = accroches.filter((a) => a.cote_a_cote && Math.abs(a.decalage) > 1)
  if (decroche.length > 0) {
    return (
      `${decroche.length} mesure(s) où l’illustration ne part pas du haut de la lecture :\n` +
      decroche
        .map((a) => `      ${a.largeur}px ${a.langue}  →  décalage de ${a.decalage} px`)
        .join('\n') +
      '\n   L’axe appartient à la colonne qui porte la lecture, pas à celle qui illustre.'
    )
  }
  return null
})()

if (GARDE_ACCROCHE) {
  console.error(`\n✗ mesure-ui : ${GARDE_ACCROCHE}\n`)
  process.exit(1)
}

/*
  PUIS LE RYTHME, et il vient juste après l'axe pour la même raison : deux
  défauts d'ABSENCE, que ni le débordement ni le repli ne savent voir. Un
  métronome ne déborde jamais.
*/
const GARDE_RYTHME = (() => {
  // Garde du garde : les marqueurs `data-rythme` doivent avoir été trouvés.
  if (rythmes.length === 0) {
    return (
      'aucun relevé du rythme de la vitrine.\n' +
      '   Les sections portent-elles encore `data-rythme` ? Une page qu’on n’a pas\n' +
      '   regardée et une page bien rythmée s’écrivent pareil dans un journal.'
    )
  }

  for (const { largeur, langue, sections } of rythmes) {
    // Seconde moitié de la garde du garde : une page d'une ou deux sections
    // rendrait la variété triviale. Sept sont attendues, on en exige cinq.
    if (sections.length < 5) {
      return (
        `${sections.length} section(s) rythmée(s) seulement à ${largeur}px ${langue}.\n` +
        '   La règle mesure la VARIÉTÉ d’une page : sur trois sections, elle ne mesure rien.'
      )
    }

    const pads = new Set(sections.map((s) => s.pad))
    if (pads.size < 3) {
      return (
        `la page n’emploie que ${pads.size} rembourrage(s) distinct(s) à ${largeur}px ${langue} :\n` +
        sections.map((s) => `      ${s.id.padEnd(16)} ${s.temps.padEnd(8)} ${s.pad}`).join('\n') +
        '\n   Une page à un seul temps est un métronome : rien n’y dit ce qui compte le plus.'
      )
    }

    // LE FAIT QUI PORTE : deux mots du vocabulaire ne peuvent pas vouloir dire
    // la même chose. Sans lui, quatre noms sur une seule valeur passeraient.
    const parTemps = new Map()
    for (const s of sections) {
      if (!parTemps.has(s.temps)) parTemps.set(s.temps, new Set())
      parTemps.get(s.temps).add(s.pad)
    }
    for (const [tempsA, padsA] of parTemps) {
      for (const [tempsB, padsB] of parTemps) {
        if (tempsA >= tempsB) continue
        const commun = [...padsA].filter((p) => padsB.has(p))
        if (commun.length > 0) {
          return (
            `les temps « ${tempsA} » et « ${tempsB} » rendent le même rembourrage ` +
            `(${commun.join(', ')}) à ${largeur}px ${langue}.\n` +
            '   Un vocabulaire dont deux mots veulent dire la même chose n’est pas un\n' +
            '   vocabulaire : c’est un métronome sur lequel on a écrit quatre noms.'
          )
        }
      }
    }

    const amples = sections.filter((s) => s.temps === 'ample')
    if (amples.length !== 1) {
      return (
        `${amples.length} section(s) « ample » à ${largeur}px ${langue} ` +
        `(${amples.map((s) => s.id).join(', ') || 'aucune'}).\n` +
        '   Un point culminant est unique : une page qui en a deux n’en a aucun.'
      )
    }
  }
  return null
})()

if (GARDE_RYTHME) {
  console.error(`\n✗ mesure-ui : ${GARDE_RYTHME}\n`)
  process.exit(1)
}

/*
  PUIS LES COLONNES D'ENTRÉE. Le débordement qu'elles peuvent produire n'est pas
  celui que `MESURER` sait voir : celui-là défile de côté, celui-ci sort par le
  HAUT, où il n'y a rien à défiler. C'est pourquoi il lui faut sa propre règle.
*/
const GARDE_COLONNES = (() => {
  if (colonnes.length === 0) {
    return (
      'aucun relevé des colonnes des écrans d’entrée.\n' +
      '   Les marqueurs `auth-cadre` et `auth-formulaire` sont-ils encore posés ?'
    )
  }

  /*
    Garde du garde : la règle ne porte QUE sur les relevés au large, et elle
    serait vide s'il n'y en avait aucun. Trois hauteurs sont balayées ; il faut
    qu'au moins une laisse de la place, sinon la porte dirait « aucun
    décrochage » sans avoir regardé une seule fenêtre où l'axe existe.

    Le régime étroit est balayé lui aussi, et il n'est pas décoratif pour
    autant : il sert de témoin, et c'est en l'ajoutant qu'on a découvert que la
    règle du dépassement retirée plus haut ne pouvait pas rougir.
  */
  const large = colonnes.filter((c) => c.auLarge).length
  if (large === 0) {
    return (
      `aucun des ${colonnes.length} relevés ne laisse de place à répartir.\n` +
      '   L’axe ne se mesure qu’au large : à l’étroit, les colonnes repartent de leur haut,\n' +
      '   ce qui est voulu. Les hauteurs balayées sont-elles encore assez hautes ?'
    )
  }

  // L'axe, là seulement où la place existe pour qu'il veuille dire quelque chose.
  const decroches = colonnes.filter((c) => c.auLarge && c.axe !== null && Math.abs(c.axe) > ECART_D_AXE)
  if (decroches.length > 0) {
    return (
      `${decroches.length} relevé(s) où les deux colonnes ne partagent aucun axe :\n` +
      decroches
        .map(
          (c) =>
            `      ${c.adresse} 1440×${c.hauteur} ${c.langue}  →  ${c.axe} px d’écart entre les milieux ` +
            `(tolérance ${ECART_D_AXE})`,
        )
        .join('\n') +
      '\n   L’argumentaire et le formulaire se lisent ensemble ou ne se lisent pas.'
    )
  }
  return null
})()

if (GARDE_COLONNES) {
  console.error(`\n✗ mesure-ui : ${GARDE_COLONNES}\n`)
  process.exit(1)
}

/*
  PUIS LA GRILLE DE TARIFS. Elle ferme la série des règles qui regardent ce que
  les pixels ne disent pas : après une commande absente, une commande en double,
  un vide subi et deux colonnes qui se tournent le dos — un signe de trop.
*/
const GARDE_TARIFS = (() => {
  if (tarifs.length === 0) {
    return (
      'aucun relevé de la grille de tarifs.\n' +
      '   Le marqueur `tarifs-grille` est-il encore posé, et la grille est-elle\n' +
      '   encore rendue au-delà du point de rupture ?'
    )
  }

  for (const relevé of tarifs) {
    const { largeur, langue, cartes, exclues, raturees } = relevé

    // Garde du garde, première moitié : trois paliers sont attendus, et « ils
    // finissent ensemble » est trivialement vrai s'il n'y en a qu'un.
    if (cartes.length < 2) {
      return (
        `${cartes.length} carte(s) de tarif à ${largeur}px ${langue}.\n` +
        '   « Les cartes finissent ensemble » ne veut rien dire sur une seule carte.'
      )
    }

    // Garde du garde, seconde moitié : sans ligne exclue à l'écran, « aucune
    // rature » est un constat sur l'ensemble vide. C'est la panne exacte que la
    // règle du doublon surveille de son côté avec la barre vide.
    if (exclues === 0) {
      return (
        `aucune ligne exclue rendue dans la grille de tarifs à ${largeur}px ${langue}.\n` +
        '   « Un seul signe pour l’exclusion » ne se vérifie que s’il y a une exclusion.'
      )
    }

    if (raturees > 0) {
      return (
        `${raturees} ligne(s) exclue(s) sur ${exclues} portent une RATURE en plus de leur croix, ` +
        `à ${largeur}px ${langue}.\n` +
        '   Deux signes pour un message, dont un qui en dit un autre : une croix dit\n' +
        '   « non inclus », une rature dit « supprimé ». La grille vend la montée en gamme.'
      )
    }

    const bas = new Set(cartes.map((c) => c.bas))
    if (bas.size > 1) {
      return (
        `les cartes de tarif ne finissent pas ensemble à ${largeur}px ${langue} :\n` +
        cartes.map((c) => `      ${c.nom.padEnd(14)} bas = ${c.bas}`).join('\n') +
        '\n   Un tableau comparatif se compare par ses lignes, et celle des boutons est\n' +
        '   la dernière et la plus décisive.'
      )
    }
  }
  return null
})()

if (GARDE_TARIFS) {
  console.error(`\n✗ mesure-ui : ${GARDE_TARIFS}\n`)
  process.exit(1)
}

/*
  LES SECTIONS DE FICHES VOISINES — même famille que la grille de tarifs : rien
  ne déborde, rien ne se coupe, et pourtant la grille ne se compare plus.

  LA TOLÉRANCE EST DE UN PIXEL, pour la même raison que les tarifs : les hauts
  sont arrondis, pas approchés. Deux sections voisines commencent ensemble, ou
  non.

  DEUX GARDES DU GARDE, parce que cette règle peut être verte sur rien. Aucune
  rangée mesurée : le marqueur a disparu, ou les fiches ne sont plus rendues. Et
  une contrainte qui n'a pas PORTÉ : « aligné sous contrainte » ne dit rien si la
  section grossie n'a rien poussé.
*/
const GARDE_SECTIONS = (() => {
  if (sectionsAlignees.length === 0) {
    return (
      'aucune rangée de fiches voisines mesurée.\n' +
      '   Le marqueur `sections-alignees` est-il encore posé sur la grille des fiches de\n' +
      '   locataire, et ses fiches portent-elles encore leurs `data-section` ?'
    )
  }
  const plaintes = new Set()
  for (const r of sectionsAlignees) {
    const ou = `${r.adresse} à ${r.largeur}px ${r.langue}`
    if (r.deplacement < DECALAGE_DE_CONTRAINTE - 1) {
      return (
        `${ou} : la contrainte de ${DECALAGE_DE_CONTRAINTE} px n'a déplacé la section suivante ` +
        `que de ${r.deplacement} px.\n` +
        '   « Aligné sous contrainte » ne se conclut pas d’une contrainte qui n’a rien poussé.'
      )
    }
    for (const e of r.naturel) {
      /* UNE FACULTATIVE NE DOIT NI ÊTRE PARTOUT NI ÊTRE PLEINE — elle doit
         COMMENCER au même endroit chez celles qui la portent. Elle vit dans une
         rangée partagée avec d'autres contenus, et ne réserve donc rien. */
      if (e.facultative) {
        if (e.ecart > 1) {
          plaintes.add(
            `${ou} : « ${e.nom} », facultative, commence à ${e.ecart} px d'écart entre les fiches qui la portent`,
          )
        }
      } else if (e.presentes < r.fiches) {
        plaintes.add(`${ou} : « ${e.nom} » manque à ${r.fiches - e.presentes} fiche(s) sur ${r.fiches}`)
      } else if (e.vides > 0 && e.vides < r.fiches) {
        /* LE BLANC RÉSERVÉ. Une rangée partagée qu'une seule sorte de fiche
           occupe, ses voisines la réservent — et le vide tombe au MILIEU de la
           fiche, où il se lit comme une donnée manquante. Vide PARTOUT, elle ne
           réserve rien : c'est une section qui n'a rien à dire ce jour-là. */
        plaintes.add(
          `${ou} : « ${e.nom} » est vide sur ${e.vides} fiche(s) de ${r.fiches} — ` +
            'du blanc réservé au milieu de celles-là',
        )
      } else if (e.ecart > 1) {
        plaintes.add(`${ou} : « ${e.nom} » commence à ${e.ecart} px d'écart entre fiches voisines`)
      }
    }
    for (const e of r.contraint) {
      if ((e.facultative || e.presentes === r.fiches) && e.ecart > 1) {
        plaintes.add(
          `${ou}, une identité grossie de ${DECALAGE_DE_CONTRAINTE} px : « ${e.nom} » ` +
            `décalée de ${e.ecart} px — les fiches ne partagent plus leurs rangées`,
        )
      }
    }
  }
  if (plaintes.size === 0) return null
  const liste = [...plaintes]
  return (
    `${liste.length} décalage(s) entre sections de fiches voisines :\n` +
    liste.slice(0, 12).map((p) => `      ${p}`).join('\n') +
    (liste.length > 12 ? `\n      … et ${liste.length - 12} autre(s)` : '') +
    '\n   Une grille de fiches se compare par ses lignes : « Loyer » en face de « Loyer » ;\n' +
    '   et une section qu\'une fiche laisse vide pendant qu\'une voisine la remplit creuse\n' +
    '   un trou au milieu de la première.'
  )
})()

if (GARDE_SECTIONS) {
  console.error(`\n✗ mesure-ui : ${GARDE_SECTIONS}\n`)
  process.exit(1)
}

/*
  LE MENU DE DÉBORDEMENT SEUL SUR SA LIGNE. Le plancher d'abord : zéro
  déclencheur examiné ne peut venir que d'une sonde qui ne trouve plus
  `aria-haspopup="menu"` — le balayage en voit plusieurs centaines.
*/
if (menusExamines === 0) {
  console.error(
    '\n✗ mesure-ui : aucun menu de débordement examiné.\n' +
      '   `MenuDeDebordement` porte-t-il encore `aria-haspopup="menu"` ?\n' +
      '   Une sonde qui ne trouve rien ne prouve rien.\n',
  )
  process.exit(1)
}
if (menusIsoles.length > 0) {
  const lignes = [...new Set(menusIsoles.map((m) => `${m.adresse} à ${m.largeur}px ${m.langue} : « ${m.nom} »`))]
  console.error(
    `\n✗ mesure-ui : ${lignes.length} menu(s) de débordement parti(s) SEUL(S) à la ligne :\n` +
      lignes.slice(0, 16).map((l) => `      ${l}`).join('\n') +
      (lignes.length > 16 ? `\n      … et ${lignes.length - 16} autre(s)` : '') +
      '\n   Les trois points ferment une rangée de gestes ; seuls sous elle, ils ne se\n' +
      '   rattachent plus à rien. Sur téléphone, leur place est le coin haut-droit de\n' +
      '   leur en-tête ou de leur carte (voir `PageHeader`) ; au-delà, le bout de la rangée.\n',
  )
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

/**
 * AUCUN GABARIT NE SURVIT AU RENDU — voir `MESURER_GABARITS` pour le récit.
 *
 * DEUX REFUS, et le second est la garde du garde. Un jeton à l'écran est un
 * défaut ; une sonde qui n'a relu AUCUN écran rend une liste vide, exactement
 * comme un produit sans défaut, et ce silence-là doit rougir aussi.
 */
const RELECTURES_ATTENDUES = adresses.length * LARGEURS.length * LANGUES.length
if (gabaritsSurvivants.length > 0) {
  console.error('\n✗ mesure-ui : un gabarit non interprété est à l’écran.\n')
  console.error('  `{count}`, `{unit}`, `{reference}` — le message s’affiche tel quel,')
  console.error('  accolades comprises. Vérifiez la convention d’accord du dépôt — `x` et')
  console.error('  `x_one`, l’ICU n’est pas lu — et que le serveur pose bien le paramètre')
  console.error('  dans `params`, que la carte lit, et non dans la seule colonne.\n')
  for (const g of gabaritsSurvivants) console.error(`   ${g.ou}  →  ${g.jeton}`)
  console.error('')
  process.exit(1)
}
if (ecransRelusPourGabarits !== RELECTURES_ATTENDUES) {
  console.error(
    `\n✗ mesure-ui : ${ecransRelusPourGabarits} relecture(s) de gabarit pour ${RELECTURES_ATTENDUES} attendue(s).\n` +
      '   La sonde n’a pas vu tous les écrans : « aucun gabarit survivant » ne\n' +
      '   voudrait alors rien dire.\n',
  )
  process.exit(1)
}

/**
 * AUCUN POINT N'A ÉTÉ MESURÉ SUR UN ARBRE EN MOUVEMENT.
 *
 * Vingt tours de deux trames, et l'empreinte bouge encore : l'écran n'a pas fini
 * de se poser après le redimensionnement. Toutes les sondes qui suivent — texte
 * rogné, débordement, repli, contraste — rendent alors un verdict sur un arbre
 * qui n'est plus celui qu'elles annoncent.
 *
 * Cela ROUGIT plutôt que de se compter en silence. Un balayage instable qui
 * passe la plupart du temps et rougit au hasard est exactement le défaut que
 * `POSER_L_ARBRE` vient de refermer ; le laisser revenir sans un mot serait le
 * rouvrir.
 */
if (arbresEnMouvement.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${arbresEnMouvement.length} point(s) mesuré(s) sur un arbre encore en mouvement.\n` +
      '   Vingt tours de deux trames n’ont pas suffi à le voir se poser après le\n' +
      '   redimensionnement — les mesures prises là valent moins que ce qu’elles\n' +
      '   annoncent.\n',
  )
  for (const ou of arbresEnMouvement.slice(0, 15)) console.error(`   ${ou}`)
  console.error('')
  process.exit(1)
}

console.log(
  `\n✓ mesure-ui : ${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues, aucun débordement latéral ni en-tête replié.\n` +
    `  ${elementsSondes} éléments sondés pour le DÉBORDEMENT LOCAL — un contenu qui sort de sa boîte\n` +
    `  sans faire défiler la page — aucun hors des ${Object.keys(DEBORDS_LOCAUX_TOLERES).length} signatures tolérées et motivées.\n` +
    `  ${libellesMesures} libellés de barre basse mesurés à la COUPURE, aucun orphelin sous 3 caractères.\n` +
    `  ${valeursMesurees} valeur(s) de champ mesurée(s) au ROGNAGE — une valeur ou un gabarit\n` +
    `  coupé dans sa boîte ne déborde de rien, et aucune autre règle ne le voit.\n` +
    `  ${pointsDInscription} points relevés dans les TROIS ÉTAPES INTÉRIEURES de l'inscription\n` +
    `  (${champsDInscription} champs) — trois écrans sans adresse, qu'aucune porte ne regardait.\n` +
    `  ${gestesMesures} gestes de tableau mesurés, tous ATTEIGNABLES sans découvrir un défilement,\n` +
    `  et ${commandesDeGeste} commande(s) de geste, toutes porteuses d'un GLYPHE — une colonne sans\n` +
    `  intitulé n'a que lui pour dire, au repos, qu'on entre dans des commandes.\n` +
    `  ${intitulesMesures} textes rognables mesurés au ROGNAGE, en largeur comme en hauteur,\n` +
    `  à ${16}px de police racine ET à ${RACINE_AGRANDIE}px — la seconde dimension du balayage.\n` +
    `  ${feuillesMesurees} feuilles de texte mesurées au DÉBORDEMENT DE MOT, ${motsDebordants.size} débordement(s) relevé(s), ${MOTS_DEBORDANTS_TOLERES.length} toléré(s) et chiffré(s).\n` +
    `  Elle coûte ${(tempsSonde / 1000).toFixed(1)} s sur ${appelsDeSonde} appels — ${(tempsSonde / appelsDeSonde).toFixed(1)} ms l'un —, ` +
    `dont ${(tempsDansLaPage / 1000).toFixed(1)} s de parcours du DOM et ${((tempsSonde - tempsDansLaPage) / 1000).toFixed(1)} s d'aller-retour.\n` +
    /*
      OÙ PASSE LE TEMPS — voir l'en-tête de `chrono`.

      Trié par coût, et le RESTE est nommé : la somme des postes ne fait pas la
      durée totale, et l'écart s'appelle « non imputé » plutôt que de se dissoudre
      dans l'arrondi du dernier poste.
    */
    (() => {
      const total = performance.now() - DEPART_DU_SCRIPT
      const postes = [...horloge.entries()].sort((a, b) => b[1].ms - a[1].ms)
      const impute = postes.reduce((somme, [, v]) => somme + v.ms, 0)
      const ligne = (nom, ms, appels) =>
        `    ${(ms / 1000).toFixed(1).padStart(6)} s  ${String(Math.round((ms / total) * 100)).padStart(3)} %  ` +
        `${appels === null ? '        ' : String(appels).padStart(5) + ' ×'}  ${nom}\n`
      return (
        `  OÙ PASSENT LES ${(total / 1000).toFixed(0)} SECONDES — chaque appel chronométré, le reste avoué :\n` +
        postes.map(([nom, v]) => ligne(nom, v.ms, v.appels)).join('') +
        ligne('non imputé (fermetures, lectures, calculs de ce script)', total - impute, null)
      )
    })() +
    /*
      LE CHIFFRE RÉEL EST IMPRIMÉ À CHAQUE PASSAGE, à côté du plafond inscrit.

      C'est ce qui remplace le rituel — abaisser un plafond à 1, relancer dix
      minutes de navigateur, lire, remettre — par lequel il fallait passer pour
      savoir ce qu'une tolérance couvrait vraiment. Un écart de un à quatre
      pixels se lit ici ; au-delà, la garde du plafond menteur arrête tout.
    */
    Object.keys(DEBORDS_LOCAUX_TOLERES)
      .map((cle) => {
        const reel = maximaLocaux.get(cle)?.debord ?? 0
        const ecart = DEBORDS_LOCAUX_TOLERES[cle].plafond - reel
        return `    ${String(reel).padStart(3)} px mesurés / ${String(DEBORDS_LOCAUX_TOLERES[cle].plafond).padStart(3)} tolérés${ecart ? ` (${ecart} d'écart)` : ''}  ${cle.slice(0, 58)}\n`
      })
      .join('') +
    `  ${fuite.reserves.length} modules réservés à l'application, aucun dans un paquet impatient.\n` +
    `  Premier chargement de la vitrine : ${premierChargement.octets} o compressés, sous le budget de ${BUDGET_PREMIER_CHARGEMENT} o.\n` +
    `  Ressources tierces servies au premier chargement : ${premierChargement.externes.length} — la police vit dans le produit depuis le 2026-09-07,\n` +
    `  voir \`RESSOURCES_EXTERNES_PESEES\` (vide, et gardée : une origine qui reviendrait rougirait).\n` +
    `  ${rangeesMesurees} mesures de la barre de la vitrine, toutes au-dessus de ${JEU_MINIMAL} px de jeu ; réglages atteints au clavier à 1440 px dans les deux langues.\n` +
    `  Panneau ouvert à 1440 px dans ${panneauxMesures} langues face à une barre de ${barreLaPlusGarnie} commandes, aucune rejouée.\n` +
    `  Bloc d'accroche : ${accroches.length} mesures, un seul écart titre–lecture (${accroches[0]?.ecart} px) des deux côtés du point de rupture.\n` +
    `  Rythme de la vitrine : ${rythmes[0]?.sections.length} sections sur ` +
    `${new Set(rythmes[0]?.sections.map((s) => s.pad)).size} rembourrages distincts, un seul temps ample.\n` +
    `  Colonnes d'entrée : ${colonnes.length} relevés à ${HAUTEURS_AUTH.join('/')} px, axes partagés à ${ECART_D_AXE} px près.\n` +
    `  Grille de tarifs : ${tarifs[0]?.cartes.length} cartes finissant ensemble, ` +
    `${tarifs[0]?.exclues} lignes exclues, aucune raturée.\n` +
    `  Sections de fiches voisines : ${sectionsAlignees.length} rangées comparées ` +
    `(${[...new Set(sectionsAlignees.map((r) => r.largeur))].join('/')} px), alignées au naturel ` +
    `et sous ${DECALAGE_DE_CONTRAINTE} px de contrainte.\n` +
    `  Menus de débordement : ${menusExamines} déclencheurs examinés, aucun seul sur sa ligne.\n` +
    `  ${textesAudites} textes audités en contraste (${THEMES.join(' + ')}, ${LARGEURS_CONTRASTE.join(' et ')} px), aucun sous le seuil WCAG AA.\n` +
    `  ${surfacesOuvertes} surfaces interactives OUVERTES puis auditées (${THEMES.join(' + ')}) : ` +
    `${textesDeSurface} textes, ${ciblesDeSurface} cibles et ${nomsDeSurface} commandes ` +
    `qu'aucun premier rendu ne montre.\n` +
    '  Les modales ne sont pas des surfaces : `modales.mjs` tient leur géométrie, leur\n' +
    '  contraste et leurs cibles depuis qu’il porte les deux sondes partagées.\n' +
    `  ${nomsExamines} commandes examinées pour leur NOM ACCESSIBLE sur ${pointsDeNom} points ` +
    `plus les surfaces, aucune anonyme (WCAG 4.1.2) ;\n` +
    `  accord avec accname de Playwright vérifié en ${accordsAccname.length} points, ` +
    `écarts de la sonde déclarés dans \`scripts/noms-accessibles.js\`.\n` +
    `  ${listesExaminees} liste(s) et tableau(x) examinés pour l'HOMONYMIE de leurs gestes, ` +
    `aucun nom porté\n  par trois commandes ou plus — on les atteint l'un après l'autre à la tabulation.\n` +
    `  ${nommeesParLabel} commande(s) nommée(s) par \`aria-label\` PAR-DESSUS un texte visible, ` +
    `toutes\n  contenant ce texte (WCAG 2.5.3) — dans les deux langues.\n` +
    `  ${ciblesSondees} cibles sondées au point de contact sur ${pointsDeCible} points ` +
      `(${LARGEURS.length} largeurs × ${LANGUES.length} langues, thème ${THEME_DE_GEOMETRIE}), ` +
      `aucune sous ${PLANCHER_CIBLE} px hors les ${Object.keys(CIBLES_EXEMPTES).length} exemptions motivées.`,
)
