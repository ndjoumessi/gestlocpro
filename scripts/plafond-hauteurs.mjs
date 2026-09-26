#!/usr/bin/env node
/**
 * CE QUE L'ÉCRAN EMPILE — LA HAUTEUR DE DOCUMENT, ÉCRAN PAR ÉCRAN.
 *
 * ═══ LE TROU QUE CETTE PORTE FERME, ET IL ÉTAIT ÉCRIT ═══
 *
 * `381570f`, le 2026-08-22, annonçait dans son propre message : « Hauteur de
 * document : −159 à −232 px par écran applicatif. » Ce gain venait de la
 * coquille, qui passait de 325 px avant le premier pixel de contenu à 122.
 * `plafond-coquille.mjs` garde cette coquille depuis. Mais le nombre ANNONCÉ —
 * la hauteur de document elle-même — n'était mesuré par aucune porte : la seule
 * qui en gardait une était `plafond-vitrine.mjs`, et elle ne regarde que
 * l'accueil public. Vingt-deux écrans sur vingt-trois pouvaient donc grandir
 * sans qu'une ligne rougisse, tant que la coquille, elle, ne bougeait pas.
 *
 * Écrit le 2026-09-09, en ouvrant `plafond-vitrine.mjs` là où le manque était
 * déjà noté ; c'est ce fichier-ci qui le comble.
 *
 * ═══ CE QU'IL MESURE ═══
 *
 * `document.documentElement.scrollHeight` — toute la hauteur que le document
 * occupe, coquille comprise —, sur les 22 écrans du routeur qu'aucune autre
 * porte ne garde de cette façon, à DEUX largeurs : 360, l'appareil de
 * référence, et 1280, le poste de bureau. Quarante-quatre points.
 *
 * ET CE QUE LE CORPS PEINT, au même instant, sur les mêmes points : un document
 * qui se déroule plus loin que son corps est du défilement sur du vide. Voir
 * plus bas — c'est cette seconde mesure qui a trouvé un défaut que la première
 * ne pouvait qu'entériner.
 *
 * LA COQUILLE EST DEDANS, ET C'EST VOULU. Ce que `plafond-coquille` garde est
 * le premier terme d'une somme ; celle-ci garde la somme. Les deux se
 * recoupent : une coquille stable sous un document qui grossit désigne le
 * contenu, un document stable sous une coquille qui grossit désigne un contenu
 * qui a maigri d'autant. Deux plafonds sur deux termes disent lequel a bougé ;
 * un seul ne le dirait pas.
 *
 * ═══ LE PIÈGE QUI REND CETTE MESURE FAUSSE, ET IL A ÉTÉ MESURÉ ═══
 *
 * `PortfolioProvider` retient la démonstration 900 ms — `ATTENTE_DEMO_MS`, une
 * décision produit, pour que les squelettes soient observables sans compte. Une
 * sonde qui lit la hauteur après `networkidle` et 300 ms de politesse lit donc
 * LE SQUELETTE, pas l'écran. Relevé le 2026-09-09, à 360 px :
 *
 *     /demo/parc        1049 px  →  4232 px      (quatre fois trop petit)
 *     /demo/locataires   900 px  →  3931 px
 *     /demo/releves      1252 px  →  3724 px
 *
 * C'est la forme la plus coûteuse de vert : un plafond inscrit sur ces
 * nombres-là aurait gardé la hauteur d'un écran vide, et l'écran plein aurait
 * pu doubler sans rien réveiller. Cette porte attend donc que l'attente
 * annoncée soit LEVÉE, puis que l'arbre se pose, avant de lire quoi que ce soit
 * — et elle COMPTE les écrans qui n'ont jamais annoncé d'attente, faute de quoi
 * l'attente serait vide sans qu'on le sache.
 *
 * Les quarante-quatre points sont reproductibles au pixel : trois passages
 * complets le 2026-09-09, zéro point oscillant. Sans la chaîne d'attente, le
 * même relevé rendait 2077 px puis 2078 sur `/demo/systeme`.
 *
 * ═══ DOUZE POINTS VALENT LA HAUTEUR DE LA FENÊTRE, ET CE N'EST PAS RIEN ═══
 *
 * `scrollHeight` ne descend pas sous la fenêtre : un écran plus court qu'elle
 * rend 900, la hauteur de vue employée ici. Douze des quarante-quatre points
 * sont dans ce cas, et leur plafond ne dit donc RIEN du contenu en dessous —
 * il dit exactement une chose, qui vaut la peine : « cet écran ne devient pas
 * défilant ». Le jour où son contenu franchit le pli, la hauteur dépasse 900 et
 * la porte refuse.
 *
 * CE N'EST PAS UNE SUPPOSITION : la même mesure prise dans une fenêtre de
 * 200 px de haut rend 878 px sur `/demo/cautions` et 888 sur `/demo/decisions`
 * — la hauteur réelle de ce qu'ils empilent, que le plancher de la fenêtre
 * masque. On garde le plancher plutôt que la fenêtre courte : 200 px de haut
 * n'est l'écran de personne, et un plafond posé sur une mise en page que
 * personne ne voit garderait une fiction.
 *
 * ═══ CE QU'IL NE REGARDE PAS ═══
 *
 * L'ACCUEIL PUBLIC. `plafond-vitrine.mjs` le garde déjà, aux mêmes largeurs et
 * dans DEUX langues. Un second plafond sur le même nombre serait deux vérités
 * pour une mesure, et c'est la façon la plus sûre d'en avoir zéro.
 *
 * `/app`, qui ne rend pas d'écran à une porte sans session — voir le même
 * constat, mesuré, dans `plafond-coquille.mjs`.
 *
 * LA LARGEUR DE 320 px. La coquille y est gardée par `plafond-coquille`, le
 * débordement par `mesure-ui`. La hauteur, non : si un écran ne se replie mal
 * qu'à 320, cette porte ne le verra pas, et c'est écrit ici.
 *
 * L'ANGLAIS. Les quarante-quatre points sont mesurés en français. Une chaîne
 * anglaise plus longue qui ferait grandir un écran passerait — `plafond-vitrine`
 * garde les deux langues sur l'accueil, celle-ci n'en garde qu'une.
 *
 * CE QUE CETTE HAUTEUR CONTIENT. Remplacez un tableau par une image de même
 * hauteur : vert. Elle garde un nombre, comme ses deux sœurs.
 *
 * ═══ CE QUE LES TÉMOINS ONT MONTRÉ, LE 2026-09-09 ═══
 *
 * Cette porte naît VERTE — ses plafonds sont ses propres mesures. Une garde
 * née verte ne vaut rien tant qu'on ne l'a pas vue refuser, donc :
 *
 * 1. +160 px de rembourrage sur la coquille applicative : 33 plaintes sur les
 *    34 points de démonstration. Le seul muet est `/demo/signaler@1280`, dont
 *    le contenu reste sous la fenêtre même grossi de 160 px — c'est le plancher
 *    décrit plus haut, et il fait exactement ce qui est écrit de lui.
 *
 *    LA MÊME MUTATION EN RENDAIT 32 AVANT LE CORRECTIF DU PORTAIL : ses deux
 *    points ne bougeaient pas d'un pixel, parce que sa hauteur de document
 *    n'était pas fixée par la boîte de `<main>` mais par un élément qui s'en
 *    échappait. Ce n'était pas un trou de la porte ; c'était le défaut que la
 *    section suivante raconte.
 * 2. L'attente de la région occupée retirée : 26 plaintes de MOU, entre 1 686
 *    et 2 400 px. La porte refuse donc de mesurer un squelette, et c'est la
 *    règle du mou qui l'attrape — le sens qu'on ajoute d'habitude « au cas où »
 *    est ici celui qui garde le plus.
 * 3. Une entrée retirée de la table : « cet écran n'a pas de plafond », et
 *    43 points pour 44 attendus. Le compte ne s'accorde pas avec lui-même.
 *
 * LE TÉMOIN 2 DIT AUSSI CE QUE `POSER_L_ARBRE` NE FAIT PAS. L'arbre était posé
 * sur ces 26 points : pendant les 900 ms de retenue, il ne bouge pas du tout.
 * « Posé » et « fini » sont deux choses, et il faut les deux attentes.
 *
 * ═══ LA SECONDE MESURE : ON NE DÉROULE PAS PLUS QU'ON NE PEINT ═══
 *
 * Cette porte relève DEUX nombres par point : ce que le document déroule, et ce
 * que le corps peint. Sur un écran sain ils sont égaux au pixel — le corps
 * s'étire avec son contenu, la racine se déroule d'autant. Un écart ne peut
 * donc venir que d'un contenu qui échappe à ce qui devait le borner.
 *
 * CETTE GARDE EST NÉE ROUGE, le 2026-09-09, sur deux points et deux seulement :
 * `/demo/portail` peignait 1 163 px et se déroulait jusqu'à 3 361 à 360 px de
 * large — 2 198 px de fond vide sous la dernière ligne —, et 1 029 pour 1 504 à
 * 1280 px. Les quarante-deux autres points étaient sains.
 *
 * LA CAUSE, trouvée en cherchant les éléments positionnés sous le corps : la
 * description accessible de `MiniBarChart` est un `sr-only`, donc un élément
 * absolu, et aucun ancêtre positionné ne se trouvait entre lui et `<main>`. Le
 * panneau du portail se borne pourtant à 70 % de la fenêtre : son découpage ne
 * s'appliquait pas à un élément dont le bloc conteneur était ailleurs, et
 * l'élément tirait la racine jusqu'à sa position statique, deux graphes plus
 * bas. Le correctif tient en un mot — la figure porte son propre bloc conteneur
 * — et les deux machines rendent ensuite le MÊME nombre, à la même baisse près.
 *
 * ELLE GARDE UNE CLASSE, PAS UN CAS. Elle ne connaît pas `/demo/portail` : elle
 * connaît la règle. N'importe quel écran qui laisserait un descendant échapper
 * au bornage de son conteneur défilant rougira ici, y compris ceux qui
 * n'existent pas encore.
 *
 * ═══ DEUX COLONNES, ET CHACUNE APPARTIENT À UNE MACHINE ═══
 *
 * `plafond` est mesuré sur la machine de développement (macOS), police du
 * système, le 2026-09-09. `plafondLarge` est mesuré sur l'exécuteur de
 * l'intégration continue (Ubuntu) sous `MESURER_EN_POLICE_LARGE`, par le relevé
 * à la demande du travail `polices` — parce que les deux ne se ressemblent pas :
 * la même page d'accueil rend 10530 px ici sous police large et 10197 là-bas.
 * Une colonne large posée sur des relevés locaux serait fausse de plusieurs
 * centaines de pixels, et c'est la mesure qui le dit, pas la prudence. Sur les
 * écrans applicatifs l'écart est plus modeste — treize points sur quarante-
 * quatre, de −67 à +21 px — mais treize rouges restent treize rouges.
 *
 * LE MOU EST REFUSÉ AUTANT QUE LE DÉPASSEMENT, et seulement sur la colonne que
 * la machine qui tourne possède — même règle que `plafond-vitrine`, pour la
 * même raison : une garde qui ne refuse que dans un sens laisse dériver
 * l'autre, et c'est par là que 327 px de mou étaient entrés là-bas.
 *
 *   node scripts/plafond-hauteurs.mjs              · mesure et refuse
 *   node scripts/plafond-hauteurs.mjs --relever    · imprime la table, ne refuse rien
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { argv, exit } from 'node:process'
import { inventaireDesRoutes, exigerUnInventairePlein } from './inventaire/routes.mjs'
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
/* LA MÊME SONDE QUE `espace-connecte`, ET C'EST TOUT L'INTÉRÊT : la règle du
   défilement fantôme est ÉCRITE UNE FOIS. Recopiée, elle vieillirait des deux
   côtés à des vitesses différentes — la facture que `sondes-de-rendu.mjs` a été
   créé pour ne plus payer. */
import {
  MESURER_DEROULEMENT,
  POSER_L_ARBRE,
  RELEVER_LES_CLOTURES_PERMEABLES,
  RELEVER_LES_EVADES,
} from './sondes-de-rendu.mjs'

/*
  4198, ET SURTOUT PAS 4190 — LE PORT SUIVANT DANS LA SÉRIE.

  Mesuré le 2026-09-09 : `vite preview` écoute bel et bien sur 4190, `curl` lui
  répond 200, et la boucle d'attente de cette porte échoue vingt-cinq secondes
  durant. La cause n'est ni le serveur ni le réseau — c'est `fetch` : la liste
  des PORTS INTERDITS du standard en contient 4190 (ManageSieve), et undici
  refuse la requête sans jamais l'émettre. Le message est « bad port », et il
  n'apparaît que si l'on inspecte `e.cause`.

  Une porte qui sonde avec `fetch` ne peut donc pas employer ce port-là. Les
  onze autres portes de ce dépôt l'évitent déjà, sans que personne l'ait écrit.
*/
const PORT = 4198
const BASE = `http://127.0.0.1:${PORT}`
const LARGEURS = [360, 1280]
const HAUTEUR_DE_VUE = 900
const RELEVER = argv.includes('--relever')

/**
 * LES DEUX ADRESSES QUE CETTE PORTE NE MESURE PAS, ET POURQUOI CHACUNE.
 *
 * Écrites plutôt que déduites : une adresse sautée par accident se lit
 * exactement comme une adresse sans défaut, et le compte des sautées ci-dessous
 * refuse dès que cette liste se périme dans un sens ou dans l'autre.
 */
const HORS_PORTEE = {
  '/': 'gardée par plafond-vitrine, aux mêmes largeurs et dans deux langues',
  '/app': "ne rend pas d'écran à une porte sans session — voir plafond-coquille",
}

/**
 * LES PLAFONDS, POINT PAR POINT — ET LE PLAFOND EST LE MESURÉ, SANS MARGE.
 *
 * Une marge est un mou, et un mou finit par être dépensé : `plafond-vitrine` en
 * avait accumulé 327 px de cette façon, un lot à la fois, avant que la règle du
 * mou ne les rende visibles. Faire monter un nombre d'ici demande donc d'écrire
 * à côté ce qu'il achète, comme `poids-ecrans` l'exige pour ses octets.
 *
 * ═══ CE QUE LES PLAFONDS DE `/demo/locataires` ONT ACHETÉ, LE 2026-09-11 ═══
 *
 * +433 px à 360, +241 px à 1280 : 3931 → 4364 et 2245 → 2486.
 *
 * Ils paient les fiches des LOGEMENTS VACANTS. Avant, l'écran finissait sur
 * « 3 unités vacantes : A3, B2 et A1 » — une phrase grise, sous le vide laissé
 * par deux fiches dans une grille qui en tient six. Ces logements sont ce que
 * l'écran a de plus coûteux : aucun loyer n'y est appelé, et le seul endroit du
 * produit où l'on pouvait y remédier était l'écran du parc.
 *
 * Chaque logement vacant porte donc sa fiche et son geste — `assignTenant`, la
 * clé du parc elle-même, pour que le nom accessible soit identique des deux
 * côtés. Les quatre autres portes n'ont pas bougé d'un pixel : ni débordement,
 * ni contraste, ni cible sous le plancher, ni octet de plus. La hauteur est le
 * seul prix, et il est écrit ici.
 *
 * ═══ ET CE QUE LES FICHES DE LOCATAIRE ONT RENDU, LE MÊME JOUR ═══
 *
 * −36 px à 1280 dans les DEUX colonnes : 2486 → 2450 ici, 2465 → 2429 sous la
 * police large (exécution 34581776324, les 43 autres points identiques au
 * relevé précédent). La pastille de paiement a quitté la rangée du nom
 * pour rejoindre « Sans compte » sous l'identité, et les quatre sections de
 * chaque fiche s'alignent sur celles de ses voisines par `subgrid`. Le gain
 * vient des fiches qui portaient une rangée « Sans compte » à elles seules : la
 * rangée d'états existe désormais partout, et la ligne de fiches ne paie plus
 * que la plus haute. À 360, `DataTable` rend ses propres fiches : rien n'y bouge.
 *
 * ═══ LE MENU DE DÉBORDEMENT DANS LE COIN, LE MÊME JOUR ═══
 *
 * Sur téléphone, les trois points quittent la rangée des gestes pour le coin
 * haut-droit : la ligne du titre dans l'en-tête commun, le coin d'une carte de
 * chantier. Ils partaient SEULS à la ligne sous les boutons, sur sept écrans —
 * voir `MESURER_MENUS_ISOLES`.
 *
 * −117 px sur `/demo/travaux@360`, 3236 → 3119 : les cartes de chantier dont le
 * menu passait à la ligne ont rendu cette ligne.
 *
 * +29 px sur `/demo@360` et `/demo/releves@360`, 3425 → 3454 et 3724 → 3753 :
 * c'est le PRIX, et il est choisi. Le titre cède 48 px au menu posé à sa droite ;
 * « Vue consolidée du parc » et « Relevé des compteurs » passent sur deux lignes.
 * Un titre replié se lit ; un menu seul sous des boutons ne se rattache à rien,
 * et coûtait 52 px ailleurs. Le rond se pose au même endroit sur chaque écran,
 * y compris ceux où il n'était pas encore isolé — c'est ce qui en fait une
 * place, et non un repli de circonstance.
 *
 * Sous la police large (exécution 34636760180), les trois mêmes points et eux
 * seuls : +30, −118, +29 — 3425 → 3455, 3215 → 3097, 3724 → 3753. Les 41
 * autres sont identiques au relevé précédent.
 *
 * ═══ ET CE QUE LES FICHES DU PARC ONT ACHETÉ, LE MÊME JOUR ═══
 *
 * +56 px sur `/demo/parc@1280`, 2166 → 2222 : L'ALIGNEMENT DES FICHES VOISINES.
 * Elles partagent désormais leurs neuf rangées, et une section absente garde sa
 * place. Le prix est exactement celui de la promesse : dans une rangée qui porte
 * un partiel, les fiches voisines réservent la hauteur de sa barre ; à côté
 * d'un logement vide, la sienne réserve celle de la date d'entrée. Avant, le
 * loyer d'une fiche occupée commençait 25 px plus bas que celui d'un logement
 * vide voisin — relevé par `MESURER_SECTIONS_ALIGNEES` —, et une grille de
 * fiches se compare par ses lignes. À 360 px, le parc est un tableau : rien n'y
 * bouge. Même prix sous la police large (exécution 34643605816), 2166 → 2222 ;
 * les 43 autres points identiques.
 *
 * −14 px LE MÊME JOUR, 2222 → 2208 : LE BLANC SOUS LE LOYER, RENDU. La barre d'un
 * partiel avait sa rangée ; ses voisines la réservaient toutes. Elle vit
 * désormais sur la ligne des jauges, à droite des pastilles, sans la grandir.
 * Même gain sous la police large (exécution 34649470982), 2222 → 2208.
 *
 * −99 px ENCORE, 2208 → 2109 : LA DATE D'ENTRÉE SUR LA LIGNE DU TYPE. Elle avait
 * sa rangée, qu'une fiche de logement VIDE — qui n'en a pas — faisait réserver
 * par toutes ses voisines. « T3 · 78 m² · depuis juin 2024 » tient sur une ligne
 * aux quatre largeurs où ces fiches existent, dans les deux langues, mesuré. La
 * page du parc est donc plus courte qu'AVANT l'alignement (2166) : douze rangées
 * de moins, et aucune réservée. Même gain sous la police large (exécution
 * 34655076952), 2208 → 2109.
 *
 * −51 px ENCORE, 2109 → 2058 : LES TROIS DERNIÈRES RANGÉES RÉSERVÉES, FONDUES EN
 * UNE. Les jauges, les faits et le geste d'un logement vide existent sur une
 * fiche et pas sur l'autre : chacune avait sa rangée, que les voisines
 * réservaient — jusqu'à 196 px sur une seule rangée de fiches. Elles tiennent
 * ensemble dans une queue NON déclarée : ce qui reste de place tombe en bas de la
 * fiche, sous le contenu, et non en son milieu. Relevé sur la rangée C1-C2-C3 :
 * 274 px de fiche avant, 223 après. Même gain sous la police large (exécution
 * 34660193788), 2109 → 2058.
 * Reste la réserve de la date d'entrée, à côté d'un logement vide : c'est une
 * ligne de texte, que la fiche vide n'a pas.
 *
 * ═══ ET CE QUE LES MENTIONS LÉGALES ONT ACHETÉ, LE 2026-09-12 ═══
 *
 * 900 → 1486 px à 360, 900 → 1180 à 1280 : LES MENTIONS QUE LA LOI EXIGE. La page
 * tenait sous le plancher de la fenêtre avec cinq lignes sur l'éditeur ; elle en
 * porte huit, plus l'hébergeur — nom, forme juridique, SIREN, directeur de la
 * publication, et les quatre coordonnées de Railway. Aucune n'est un ornement :
 * chacune est une obligation de l'article 6-III de la LCEN, et leur absence était
 * le défaut. Restaient le téléphone et l'adresse électronique de l'éditeur, que
 * Nelson avait laissés manquants : voir plus bas, le 2026-09-14. Sous la
 * police large (exécution 34717868028) : 1460 à 360, 1180 à 1280 ; les 44 autres
 * points identiques.
 *
 * 1486 → 1554 à 360, 1180 → 1227 à 1280, le 2026-09-13 : LA LIGNE DE TVA. Une
 * entreprise en franchise en base n'a pas de numéro à afficher ; la page le dit
 * (« Non applicable, article 293 B du CGI ») plutôt que de laisser le visiteur
 * se demander si on l'a oublié. Une ligne de `<dl>` : deux lignes de texte
 * empilées sur téléphone, une seule à côté de son terme sur ordinateur. Sous la
 * police large (exécution 34727561716) : 1528 et 1227, les 44 autres points
 * identiques.
 *
 * 1554 → 1836 à 360, 1227 → 1426 à 1280, le 2026-09-14 : L'ÉDITEUR JOIGNABLE.
 * Quatre lignes — SIRET du siège, code APE, téléphone, courriel —, que Nelson a
 * données. Le téléphone et le courriel sont exigés par la LCEN et manquaient
 * depuis la première version ; le SIRET et le code APE figuraient déjà sur
 * l'attestation. Et `/confidentialite` +36 aux deux largeurs : une ligne pour
 * le courriel du responsable, le moyen électronique que la CNIL recommande.
 * Sous la police large (exécution 34901748670) : 1811 et 1426, 3297 et 2349,
 * les 44 autres points identiques.
 *
 * `/confidentialite@1280` 2392 → 2414, le 2026-09-15 : LE RETRAIT DE LA LETTRE.
 * La phrase dit désormais OÙ retirer son consentement — le menu du compte —, et
 * passe sur deux lignes. Mesuré au navigateur : c'est elle, et elle seule (43 px
 * pour 22). Deux formulations plus courtes essayées rendaient la même hauteur.
 * La ligne des connexions, qui ne cite plus l'adresse IP, tient sur une. Sous
 * la police large (exécution 34907460952) : 2349 → 2371, les 47 autres points
 * identiques.
 *
 * ═══ ET CE QUE LA POLITIQUE DE CONFIDENTIALITÉ EST, LE 2026-09-13 ═══
 *
 * 3347 px à 360, 2356 à 1280 : UN DOCUMENT, PAS UN ÉCRAN. Neuf rubriques : ce
 * que les articles 13 et 14 du RGPD exigent d'une information complète —
 * responsable, rôles, données, finalités et bases légales, destinataires,
 * transferts, conservation, droits —, plus le cookie et le stockage du
 * navigateur, qui relèvent de la loi Informatique et libertés (article 82).
 * Ce plafond ne se discute pas rubrique par
 * rubrique : il garde que la page ne GRANDISSE pas sans qu'un diff le dise.
 * Sous la police large (exécution 34771718248) : 3261 et 2313, les 46 autres
 * points identiques.
 *
 * ═══ ET CE QUE `/demo/acces@360` A ACHETÉ, LE 2026-09-11 ═══
 *
 * +22 px, 2226 → 2248 : L'EXPIRATION D'UN CODE, VISIBLE SUR TÉLÉPHONE. La
 * colonne était `hideOnMobile` — sur le marché visé, rien ne disait qu'un code
 * allait cesser d'ouvrir quoi que ce soit. Elle dit désormais le temps RESTANT
 * (« dans 9 jours », « demain »), la date dessous. À 1280 elle existait déjà et
 * tient dans la hauteur de sa rangée : rien n'y bouge.
 *
 * `plafond` : machine de développement, macOS, police du système, 2026-09-09.
 * `plafondLarge` : exécuteur Ubuntu de l'intégration continue, sous
 * `MESURER_EN_POLICE_LARGE`, relevé le 2026-09-09 par le travail `polices`
 * (exécution 34340394917), 44 points, zéro arbre en mouvement.
 *
 * TREIZE DES QUARANTE-QUATRE POINTS DIFFÈRENT entre les deux colonnes, de −67 à
 * +21 px. Ce sont ces treize-là qui auraient fait rougir l'intégration continue
 * si la colonne large avait été recopiée d'ici.
 */
/*
  +135 px (360) ET +94 px (1280), LE 2026-09-17 : LE NOM COMMERCIAL ET LE RÉGIME.

  Deux lignes de plus dans la liste de l'éditeur. Nelson a donné « GestLocPro »
  comme nom commercial et « micro-entreprise » comme régime — ce dernier n'étant
  pas une forme juridique, il vit sur sa propre ligne plutôt que de remplacer
  « Entrepreneur individuel », que le registre inscrit.

  Deux lignes pour deux faits : les fondre aurait fait tenir la page à l'ancien
  plafond en écrivant une chose fausse.

  COLONNE LARGE RELEVÉE SUR LE CI (exécution 35239036485, travail `polices`) :
  1945 et 1520. Les 48 autres points n'ont pas bougé d'un pixel.

  DEUX POINTS DE PLUS LE 2026-09-18 : `/conditions-generales`, la troisième page
  juridique. 4778 px à 360 et 3336 px à 1280 sur la machine de développement ;
  4679 et 3250 sur le CI (exécution 35286501059, branche `mesure-conditions`),
  soit UNE COLONNE LARGE PLUS BASSE QUE LA LOCALE — DejaVu compose ce texte plus
  serré que la police de ce portable, et c'est pourquoi la colonne large ne se
  déduit jamais de l'autre.

  LA VITRINE N'A PAS BOUGÉ, et c'était la question : le pied de page public a
  gagné un TROISIÈME lien, et la rangée déborde déjà à 360 px. Les 50 points
  d'avant sont identiques au pixel, dans les deux colonnes — le libellé le plus
  court des trois (« Conditions », « Terms ») tient sur la ligne déjà repliée.
*/
const PLAFONDS = [
  /* 360 px — 23 écrans */
  { adresse: '/inscription', largeur: 360, plafond: 1371, plafondLarge: 1371 },
  { adresse: '/connexion', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/mot-de-passe-oublie', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/reinitialiser', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/mentions-legales', largeur: 360, plafond: 1971, plafondLarge: 1945 },
  { adresse: '/confidentialite', largeur: 360, plafond: 3383, plafondLarge: 3297 },
  { adresse: '/conditions-generales', largeur: 360, plafond: 4778, plafondLarge: 4679 },
  { adresse: '/demo', largeur: 360, plafond: 3454, plafondLarge: 3455 },
  { adresse: '/demo/paiements', largeur: 360, plafond: 3343, plafondLarge: 3343 },
  { adresse: '/demo/etats-des-lieux', largeur: 360, plafond: 2746, plafondLarge: 2746 },
  { adresse: '/demo/travaux', largeur: 360, plafond: 3119, plafondLarge: 3097 },
  { adresse: '/demo/signalements', largeur: 360, plafond: 2961, plafondLarge: 2982 },
  { adresse: '/demo/mon-espace', largeur: 360, plafond: 3249, plafondLarge: 3198 },
  { adresse: '/demo/documents', largeur: 360, plafond: 2244, plafondLarge: 2244 },
  { adresse: '/demo/signaler', largeur: 360, plafond: 1227, plafondLarge: 1205 },
  { adresse: '/demo/parc', largeur: 360, plafond: 4232, plafondLarge: 4232 },
  { adresse: '/demo/releves', largeur: 360, plafond: 3753, plafondLarge: 3753 },
  { adresse: '/demo/cautions', largeur: 360, plafond: 2121, plafondLarge: 2121 },
  /* +16 px EN POLICE LARGE, LE 2026-09-26 — voir le point à 1280 pour le lot :
     la caution et les chantiers deviennent des pastilles conditionnelles. En
     pile, les deux tirets valaient deux lignes de valeur ; les pastilles en
     valent une de plus à elles deux sur les fiches qui les portent. Le gain du
     bureau vient de la grille à deux colonnes, qui n'existe pas ici. */
  { adresse: '/demo/locataires', largeur: 360, plafond: 4651, plafondLarge: 4380 },
  { adresse: '/demo/mes-donnees', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/demo/acces', largeur: 360, plafond: 2248, plafondLarge: 2209 },
  { adresse: '/demo/decisions', largeur: 360, plafond: 1591, plafondLarge: 1569 },
  { adresse: '/demo/prise-en-main', largeur: 360, plafond: 1633, plafondLarge: 1611 },
  { adresse: '/demo/systeme', largeur: 360, plafond: 2078, plafondLarge: 2078 },
  { adresse: '/demo/portail', largeur: 360, plafond: 1163, plafondLarge: 1163 },
  { adresse: '/adresse-qui-n-existe-pas', largeur: 360, plafond: 900, plafondLarge: 900 },
  /* 1280 px — 23 écrans */
  { adresse: '/inscription', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/connexion', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/mot-de-passe-oublie', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/reinitialiser', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/mentions-legales', largeur: 1280, plafond: 1520, plafondLarge: 1520 },
  { adresse: '/confidentialite', largeur: 1280, plafond: 2414, plafondLarge: 2371 },
  { adresse: '/conditions-generales', largeur: 1280, plafond: 3336, plafondLarge: 3250 },
  { adresse: '/demo', largeur: 1280, plafond: 1864, plafondLarge: 1865 },
  { adresse: '/demo/paiements', largeur: 1280, plafond: 1483, plafondLarge: 1483 },
  { adresse: '/demo/etats-des-lieux', largeur: 1280, plafond: 1552, plafondLarge: 1531 },
  /*
    +56 px SUR `/demo/travaux@1280`, LE 2026-09-26 : LES DEUX AXES DE FILTRE SE
    NOMMENT, ET SE RANGENT DONC SUR DEUX LIGNES.

    Cet écran est le seul du produit à porter DEUX groupes de filtres — origine
    et état. Leurs noms existaient depuis toujours, dans l'`aria-label` : un
    lecteur d'écran les distinguait, l'œil non. Vu à la capture : « Tout 6 » et
    « Tous les états 6 », deux pastilles en encre pleine à vingt-quatre pixels
    l'une de l'autre, qui se lisent comme une contradiction.

    Le dictionnaire portait déjà la trace du défaut : `filterAllStatuses` a été
    écrit parce que « Toutes » figurait deux fois côte à côte. On traitait le
    symptôme une pastille à la fois.

    LE NOM VISIBLE RANGE LA RANGÉE. À 1280 les deux groupes ne tiennent plus sur
    une ligne et se posent l'un sous l'autre, chacun sous son nom — ce qui est
    la forme qu'ils auraient dû avoir. À 1440 la ligne unique tient encore, et
    rien ne bouge ; au téléphone non plus — `/demo/travaux@360` mesure 3097 px
    en police large avant comme après, à son plafond exact, la rangée y étant
    déjà repliée.

    AUCUNE CHAÎNE NOUVELLE : les deux noms sont ceux de l'`aria-label`,
    raccourcis pour être lus — et corrigés au passage, ils disaient « trier »
    là où l'on filtre.
  */
  { adresse: '/demo/travaux', largeur: 1280, plafond: 1546, plafondLarge: 1479 },
  { adresse: '/demo/signalements', largeur: 1280, plafond: 1521, plafondLarge: 1521 },
  { adresse: '/demo/mon-espace', largeur: 1280, plafond: 1409, plafondLarge: 1409 },
  { adresse: '/demo/documents', largeur: 1280, plafond: 1187, plafondLarge: 1165 },
  { adresse: '/demo/signaler', largeur: 1280, plafond: 900, plafondLarge: 900 },
  /*
    +154 px SUR `/demo/parc@1280`, 2058 → 2212, LE 2026-09-26 : L'ÉCRAN TOTALISE
    CE QU'IL MONTRAIT DOUZE FOIS.

    La rangée portait UN indicateur, le taux d'occupation. Les fiches en dessous
    disaient déjà, logement par logement, le loyer attendu, les chantiers
    ouverts et la caution tenue — douze fois, sans que rien ne les additionne.
    Un propriétaire qui voulait le total devait le faire de tête ou aller le
    chercher sur deux autres écrans.

    LE COÛT EST UNE RANGÉE DE PLUS, ET SEULEMENT SOUS 1440. À cette largeur les
    quatre cartes tiennent sur une ligne — voir `GRILLE_QUATRE_INDICATEURS`,
    dont le cran est descendu à 1440 le même jour — et la rangée ne coûte alors
    que 26 px. À 1280 elle se replie en deux colonnes : deux rangs, 154 px.

    AU TÉLÉPHONE, RIEN. La rangée ne paraît qu'en vue tableau, et `/demo/parc@360`
    rend des fiches : sa hauteur ne bouge pas d'un pixel, vérifié — 4253 px avant
    comme après.

    RELEVÉ EN POLICE LARGE, la colonne reproductible : 2212 px, seule plainte de
    la porte sur cette passe. Les vingt-huit autres de la passe normale sont
    celles de la machine — elles rougissent à l'identique sur `main`.
  */
  { adresse: '/demo/parc', largeur: 1280, plafond: 2212, plafondLarge: 2212 },
  { adresse: '/demo/releves', largeur: 1280, plafond: 1402, plafondLarge: 1402 },
  { adresse: '/demo/cautions', largeur: 1280, plafond: 900, plafondLarge: 900 },
  /*
    −86 px AU BUREAU ET +16 AU TÉLÉPHONE, LE 2026-09-26 : LES DEUX FAITS QUI
    PORTAIENT UN TIRET SONT DEVENUS DES PASTILLES CONDITIONNELLES.

    La fiche de locataire rendait quatre couples libellé/valeur ; deux d'entre
    eux — la caution et les chantiers — affichaient un tiret sur huit fiches sur
    dix. Ils suivent désormais la convention de la fiche de LOGEMENT : des
    pastilles posées seulement là où elles existent, avec les mêmes clés.

    LE COMPTE A ÉTÉ FAIT DEUX FOIS, ET LE PREMIER ÉTAIT FAUX. Une première
    rédaction posait la rangée des pastilles SEULEMENT sur les fiches qui en
    ont, et relevait −189 px. Elle était cassée : la fiche partage cinq rangées
    par `subgrid`, et une section sans rangée se peint PAR-DESSUS les gestes —
    vu à la capture, « Dossier » à cheval sur « Caution 290 000 FCFA ». Le
    conteneur est donc toujours rendu, même vide ; il ne fait pas un pixel là
    où aucune voisine de sa ligne ne porte de pastille, et la ligne des boutons
    reste une ligne.

    LE PLAFOND SUIT LE MESURÉ, DANS LES DEUX SENS : 2386 au bureau (contre 2450
    avant le lot, donc la fiche reste plus courte qu'elle ne l'était), 4651 au
    téléphone en police normale. En police large — la colonne reproductible —
    2364 et 4380.

    POURQUOI LE TÉLÉPHONE GRANDIT DE SEIZE PIXELS : en pile, les deux tirets
    valaient deux lignes de valeur, et les pastilles en valent une de plus à
    elles deux sur les fiches qui les portent. Le gain du bureau vient de la
    grille à deux colonnes, où deux faits occupent une rangée au lieu de deux.
  */
  { adresse: '/demo/locataires', largeur: 1280, plafond: 2386, plafondLarge: 2364 },
  { adresse: '/demo/mes-donnees', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/demo/acces', largeur: 1280, plafond: 1213, plafondLarge: 1213 },
  { adresse: '/demo/decisions', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/demo/prise-en-main', largeur: 1280, plafond: 1358, plafondLarge: 1358 },
  { adresse: '/demo/systeme', largeur: 1280, plafond: 1199, plafondLarge: 1220 },
  { adresse: '/demo/portail', largeur: 1280, plafond: 1029, plafondLarge: 1029 },
  { adresse: '/adresse-qui-n-existe-pas', largeur: 1280, plafond: 900, plafondLarge: 900 },
]

/** La colonne que la machine qui tourne possède — voir l'en-tête. */
const COLONNE_A_NOUS = !POLICE_LARGE || Boolean(process.env.CI)

function plafondDe(p) {
  if (!POLICE_LARGE) return p.plafond
  if (typeof p.plafondLarge !== 'number' || p.plafondLarge <= 0) {
    throw new Error(
      `plafond-hauteurs : ${p.adresse}@${p.largeur} n'a pas de plafond en police large.\n` +
        "  Cette colonne se relève sur l'exécuteur de l'intégration continue, par le\n" +
        '  travail `polices` : `node scripts/plafond-hauteurs.mjs --relever`.\n' +
        "  Une entrée sans valeur passerait au vert sans être gardée, et c'est le seul\n" +
        '  état que cette porte ne doit jamais avoir.',
    )
  }
  return p.plafondLarge
}


/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les sources.
   Un paquet périmé rendrait un verdict sur le code d'AVANT, en silence. */
exigerUnPaquetAJour()


const routes = inventaireDesRoutes()
exigerUnInventairePlein(routes)
const ADRESSES = routes.map((r) => r.adresse)

/*
  ATTENDUS EST ÉCRIT, JAMAIS CALCULÉ.

  Le dériver de la liste mesurée rendrait la garde d'accord avec elle-même :
  vider l'inventaire, et l'inspection comparerait 0 à 0 puis se déclarerait
  verte. La même mutation a trouvé ce piège quatre fois dans ce dépôt.

  52 = (28 adresses du routeur − 2 hors portée) × 2 largeurs — la 25e est
       `/mentions-legales`, le 2026-09-12 ; la 26e `/confidentialite`, le
       2026-09-13 ; la 27e `/demo/mes-donnees`, le 2026-09-16 ; la 28e
       `/conditions-generales`, le 2026-09-18.
   4 = les deux adresses hors portée, à leurs deux largeurs.
*/
const ATTENDUS = 52
const HORS_PORTEE_ATTENDUS = 4
/*
  LES HUIT ÉCRANS QUI N'ANNONCENT AUCUNE ATTENTE — et la garde est ASYMÉTRIQUE.

  Ceux-ci ne lisent aucune donnée : les quatre écrans d'authentification,
  l'écran introuvable, et trois écrans de démonstration qui rendent des états
  écrits en dur. Aucune région occupée n'y paraît, et il n'y a donc rien à
  attendre.

  CE QUI FAIT ROUGIR est qu'un écran ABSENT de cette liste n'annonce rien : cela
  veut dire qu'un écran qui lisait des données ne le dit plus, et que sa hauteur
  vient peut-être d'être lue sur un squelette — le défaut que cette porte existe
  pour ne pas commettre.

  CE QUI NE FAIT PAS ROUGIR est l'inverse : un écran d'ici qui se met à annoncer
  une attente nous fait attendre davantage, ce qui ne coûte qu'un instant. Ce
  n'est donc qu'une ligne du rapport.

  ET CETTE ASYMÉTRIE EST MESURÉE, NON PRUDENTE. Le relevé du 2026-09-09 rend
  SEIZE points sans attente sur la machine de développement et QUINZE sur
  l'exécuteur de l'intégration continue : là-bas, `/demo/decisions` en annonce
  une à 360 px et pas à 1280. Le même écran, la même source, deux verdicts —
  c'est une course, pas une propriété. Un compte exact aurait donc fait rougir
  l'intégration continue le jour de sa naissance.

  ET IL AURAIT ROUGI ICI AUSSI, le même jour : deux exécutions consécutives sur
  la machine de développement ont rendu seize points muets puis quinze,
  `/demo/acces` ayant annoncé son attente à la seconde. La liste dit donc quels
  écrans PEUVENT se taire, jamais combien se taisent.
*/
const SANS_ATTENTE_DECLARES = new Set([
  '/inscription',
  '/connexion',
  '/mot-de-passe-oublie',
  '/reinitialiser',
  // Une page de faits écrits dans le paquet : elle n'attend aucune donnée.
  '/mentions-legales',
  // La politique de confidentialité, pour la même raison.
  '/confidentialite',
  // Les conditions générales, pour la même raison : des faits écrits dans le
  // paquet, et le délai d'effacement vient d'une constante, pas d'un appel.
  '/conditions-generales',
  '/adresse-qui-n-existe-pas',
  // L'écran de l'export n'appelle rien au montage : le dossier ne part qu'au geste.
  '/demo/mes-donnees',
  '/demo/acces',
  '/demo/decisions',
  '/demo/prise-en-main',
])

const serveur = await servirLaPrevisualisation('plafond-hauteurs', PORT)
const plaintes = []
const releve = []
let inspectes = 0
let horsPortee = 0
/** Combien de points ont été confrontés aux clôtures — voir leur garde. */
let cloturesSondees = 0
/** Les points lus alors que l'arbre bougeait encore. */
const arbresEnMouvement = []
/** Les écrans qui n'ont JAMAIS annoncé d'attente — voir leur garde plus bas. */
const sansAttenteAnnoncee = []
/** Les écrans qui se déroulent plus loin qu'ils ne peignent — voir leur garde. */
const fantomes = []
/** Les clôtures qui découpent et laissent sortir un absolu — voir leur garde. */
const cloturesPermeables = []

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: largeur, height: HAUTEUR_DE_VUE },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
    await neutraliserLApiLocale(contexte)
    /* L'OBSERVATEUR DE L'ATTENTE — voir le bloc qui le lit, plus bas. */
    await contexte.addInitScript(() => {
      window.__attenteVue = false
      const voir = () => {
        if (document.querySelector('[aria-busy="true"]')) window.__attenteVue = true
      }
      const armer = () => {
        voir()
        new MutationObserver(voir).observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-busy'],
        })
      }
      if (document.documentElement) armer()
      else document.addEventListener('DOMContentLoaded', armer, { once: true })
    })
    const page = await contexte.newPage()
    for (const adresse of ADRESSES) {
      const nom = `${adresse}@${largeur}`
      if (adresse in HORS_PORTEE) {
        horsPortee++
        continue
      }
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page
        .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
          timeout: 8000,
        })
        .catch(() => {})
      await page
        .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
        .catch(() => {})
      if (!(await page.evaluate(POSER_L_ARBRE))) arbresEnMouvement.push(nom)
      /*
        A-T-ON SEULEMENT VU L'ATTENTE ? Le drapeau est lu ICI, après que l'arbre
        s'est posé — au `domcontentloaded` la région occupée n'est pas encore
        montée, et il dirait « pas d'attente » sur des écrans qui en ont une.

        Cette question précède l'attente
        elle-même, et sans elle la suivante ne vaut rien : guetter la FIN d'une
        attente qui n'a jamais commencé rend vrai immédiatement, et l'on mesure
        le squelette en croyant mesurer l'écran. C'est exactement le défaut que
        `cas-negatif-vert-a-vide` décrit pour les cas de test.

        Ceux qui n'annoncent rien sont comptés et NOMMÉS, et ceux qui ne sont pas
        DÉCLARÉS muets font refuser la porte — voir `SANS_ATTENTE_DECLARES`, qui
        porte les huit écrans concernés et pourquoi la garde ne vaut que dans un
        sens.

        LE DRAPEAU EST POSÉ DANS LA PAGE, ET NON GUETTÉ DEPUIS ICI. Une course
        contre un délai — « a-t-on vu l'attente en deux secondes ? » — mesurerait
        la vitesse de la machine autant que le produit, et coûterait ces deux
        secondes sur chacun des seize points qui n'annoncent rien. L'observateur
        installé avant le premier rendu ne rate rien et ne coûte rien.

        CE QU'IL PEUT ENCORE RATER, et c'est écrit : une région occupée posée et
        retirée dans le même lot de mutations. La retenue de la démonstration
        dure 900 ms, donc le cas ne se présente pas aujourd'hui.
      */
      if (!(await page.evaluate(() => window.__attenteVue === true))) sansAttenteAnnoncee.push(nom)

      /*
        DEUX NOMBRES ET NON UN : CE QUI SE DÉROULE, ET CE QUI EST PEINT.

        Le second n'était pas mesuré, et son absence a laissé passer un défaut
        que la porte AVAIT SOUS LES YEUX : `/demo/portail` peint 1 163 px et se
        déroule jusqu'à 3 361. Deux mille cent quatre-vingt-dix-huit pixels de
        fond vide sous la dernière ligne, à 360 px de large, mesurés le
        2026-09-09 — le plafond les entérinait sans pouvoir les nommer.

        Sur un écran sain les deux nombres sont ÉGAUX au pixel : le corps
        s'étire avec son contenu, et la racine se déroule d'autant. L'écart ne
        peut donc venir que d'un contenu qui échappe à ce qui devait le borner.
      */
      const { hDoc, corps } = await page.evaluate(MESURER_DEROULEMENT)
      const p = PLAFONDS.find((x) => x.adresse === adresse && x.largeur === largeur)
      if (!p) {
        plaintes.push(
          `${nom} : cet écran n'a pas de plafond.\n` +
            "   Une adresse est apparue dans le routeur sans passer par ici : mesurez-la\n" +
            '   (`--relever`) et inscrivez-la, ou déclarez-la hors de portée avec son motif.',
        )
        continue
      }
      inspectes++
      /*
        LE DÉFILEMENT FANTÔME — une garde de CLASSE, pas un cas particulier.

        Elle ne connaît pas `/demo/portail` : elle connaît la règle « on ne
        déroule pas plus qu'on ne peint ». N'importe quel écran qui laisserait
        un descendant échapper au bornage de son conteneur défilant rougirait
        ici, y compris ceux qui n'existent pas encore.
      */
      /*
        LA CAUSE, ET NON LE SEUL SYMPTÔME. Le fantôme demande deux conditions ;
        celle-ci est la seule qu'on puisse voir AVANT qu'un descendant ne
        s'échappe. Elle est relevée à chaque point, comme la hauteur.
      */
      for (const c of await page.evaluate(RELEVER_LES_CLOTURES_PERMEABLES)) {
        cloturesPermeables.push({ nom, ...c })
      }
      cloturesSondees += 1

      if (corps > 0 && hDoc > corps) {
        /* LE DOSSIER, et seulement sur refus : il ne coûte rien tant que la
           porte est verte. C'est cette énumération qui a rendu le coupable en
           une ligne le 2026-09-09, après que trois mutations du CONTENEUR
           n'eurent rien déplacé. */
        fantomes.push({ nom, hDoc, corps, evades: await page.evaluate(RELEVER_LES_EVADES) })
      }
      /*
        EN MODE RELEVÉ, ON NE COMPARE À RIEN — et surtout pas au plafond de la
        colonne qu'on est justement en train de mesurer. `plafondDe` LÈVE quand
        la colonne large est vide : c'est exactement l'état dans lequel se
        trouve la machine qui relève cette colonne pour la première fois.
      */
      const plafond = RELEVER ? 0 : plafondDe(p)
      releve.push({ nom, hDoc, plafond, ...p })
      if (RELEVER) continue

      if (COLONNE_A_NOUS && plafond > hDoc) {
        plaintes.push(
          `${nom} : ${plafond - hDoc} px de MOU — le plafond (${plafond}) est au-dessus\n` +
            `   de la mesure (${hDoc}). Il ne refuse donc plus ce qu'il prétend refuser.\n` +
            `   Descendez-le à ${hDoc} : c'est un gain, et un gain non inscrit se redépense.`,
        )
      }
      if (hDoc > plafond) {
        plaintes.push(
          `${nom} : ${hDoc} px de document pour un plafond de ${plafond}.\n` +
            `   ${hDoc - plafond} px de plus qu'au dernier relevé. La coquille est gardée à part\n` +
            `   (plafond-coquille) : si elle est verte, ce sont ${hDoc - plafond} px de contenu.`,
        )
      }
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/* ═══ LES GARDES DU GARDE ═══ */
if (inspectes === 0) {
  plaintes.push(
    "AUCUN point inspecté. Absence d'inspection, et non absence de défaut : on refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} point(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}
if (horsPortee !== HORS_PORTEE_ATTENDUS) {
  plaintes.push(
    `${horsPortee} point(s) hors portée pour ${HORS_PORTEE_ATTENDUS} attendu(s).\n` +
      "   La liste des adresses hors portée est périmée dans un sens ou dans l'autre.",
  )
}
for (const c of cloturesPermeables) {
  plaintes.push(
    `${c.nom} : une CLÔTURE PERMÉABLE — <${c.balise}> ${c.classes}\n` +
      `   découpe ${c.decoupe} px sur ${c.axe}, et ${c.combien} descendant(s) absolu(s) lui\n` +
      '   échappent — leur bloc conteneur est en dehors, donc le découpage ne les atteint pas :\n' +
      c.evades
        .map((e) => `      <${e.balise}> ${e.classes} ${e.taille}  « ${e.texte} »`)
        .join('\n') +
      '\n   `position: relative` suffit : sans décalage ni `z-index`, rien ne bouge à l’œil,\n' +
      '   rien ne crée de contexte d’empilement, et plus rien ne sort.',
  )
}

if (cloturesSondees !== inspectes) {
  plaintes.push(
    `${cloturesSondees} point(s) confronté(s) aux clôtures pour ${inspectes} inspecté(s).\n` +
      "   La sonde a été sautée quelque part, et son silence se lit alors « aucune clôture ».",
  )
}

for (const { nom, hDoc, corps, evades } of fantomes) {
  plaintes.push(
    `${nom} : ${hDoc - corps} px de DÉFILEMENT FANTÔME — le document se déroule jusqu'à\n` +
      `   ${hDoc} px alors que le corps n'en peint que ${corps}. Sous la dernière ligne, ce\n` +
      "   sont autant de pixels de fond vide qu'on peut faire défiler pour rien.\n" +
      '   Les éléments hors du flux qui passent sous le corps :\n' +
      evades
        .map(
          (e) =>
            `      bas ${String(e.bas).padStart(5)} px  ${e.position.padEnd(8)} ` +
            `borné par ${e.borne}  <${e.balise}> ${e.texte || e.classes}`,
        )
        .join('\n') +
      "\n   Un élément absolu dont aucun ancêtre positionné ne borne le bloc conteneur sort\n" +
      "   du découpage de son conteneur défilant et tire la racine jusqu'à sa position\n" +
      '   statique.',
  )
}

const muetsNonDeclares = sansAttenteAnnoncee.filter(
  (nom) => !SANS_ATTENTE_DECLARES.has(nom.split('@')[0]),
)
if (muetsNonDeclares.length > 0) {
  plaintes.push(
    `${muetsNonDeclares.length} écran(s) n'ont annoncé AUCUNE attente sans être déclarés : ` +
      `${muetsNonDeclares.join(', ')}.\n` +
      "   Un écran qui lisait des données ne le dit plus : sa hauteur vient peut-être d'être\n" +
      '   lue sur un squelette. Vérifiez ce qu’il rend, puis déclarez-le ou réparez-le.',
  )
}
if (arbresEnMouvement.length > 0) {
  plaintes.push(
    `${arbresEnMouvement.length} point(s) lu(s) sur un arbre EN MOUVEMENT : ` +
      `${arbresEnMouvement.join(', ')}.\n` +
      "   La hauteur relevée là n'est pas celle de l'écran posé, et le verdict ne vaut rien.",
  )
}

if (RELEVER) {
  console.log(
    `\nRELEVÉ ${POLICE_LARGE ? 'EN POLICE LARGE' : 'en police du système'} — ` +
      `${inspectes} point(s), ${arbresEnMouvement.length} arbre(s) en mouvement.\n` +
      '  Ce mode NE REFUSE RIEN : il imprime ce que cette machine mesure, pour que la\n' +
      "  colonne qu'elle possède soit inscrite depuis sa mesure et non depuis une autre.\n",
  )
  for (const r of releve) {
    console.log(
      `  { adresse: '${r.adresse}', largeur: ${r.largeur}, ` +
        `${POLICE_LARGE ? 'plafondLarge' : 'plafond'}: ${r.hDoc} },`,
    )
  }
  if (sansAttenteAnnoncee.length > 0) {
    console.log(`\n  sans attente annoncée : ${sansAttenteAnnoncee.join(', ')}`)
  }
  exit(0)
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(32)} ${String(r.hDoc).padStart(6)} px  ` +
      `(plafond ${String(r.plafond).padStart(6)}${r.hDoc === HAUTEUR_DE_VUE ? ' · au plancher de la fenêtre' : ''})`,
  )
}
const bavardsDeclares = releve
  .map((r) => r.nom)
  .filter(
    (nom) => SANS_ATTENTE_DECLARES.has(nom.split('@')[0]) && !sansAttenteAnnoncee.includes(nom),
  )
console.log(
  `\n  ${sansAttenteAnnoncee.length} point(s) sans attente annoncée, ` +
    `${muetsNonDeclares.length} hors des huit écrans déclarés.` +
    (bavardsDeclares.length > 0
      ? `\n  ${bavardsDeclares.length} point(s) déclaré(s) muet(s) ont pourtant annoncé une attente : ` +
        `${bavardsDeclares.join(', ')}.\n` +
        "  On a donc attendu plus, jamais moins : ce n'est pas une plainte."
      : ''),
)

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-hauteurs : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  console.error(
    `  Colonne jugée : ${POLICE_LARGE ? 'plafondLarge' : 'plafond'} — ` +
      `${COLONNE_A_NOUS ? 'cette machine la possède' : "cette machine ne la possède PAS, le mou n'est pas jugé"}.\n`,
  )
  exit(1)
}

console.log(
  `\n✓ plafond-hauteurs : ${inspectes}/${ATTENDUS} points sous leur plafond de hauteur de document,\n` +
    '  et aucun plafond au-dessus de sa mesure. Ce script ne dit RIEN de ce que cette\n' +
    '  hauteur contient — voir son en-tête.',
)
