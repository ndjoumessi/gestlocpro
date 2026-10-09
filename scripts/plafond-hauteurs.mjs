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
import { TEMOIN, laColonneNormalePeutEtreANous, releverLeTemoin } from './temoin-de-la-machine.mjs'
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
/*
  CE QUE LE PIED DES COLONNES COÛTE — ET POURQUOI AUCUN NOMBRE N'EST INSCRIT ICI.

  ═══ LE RELEVÉ, SUR LE CONTENEUR D'EXÉCUTION DU 2026-09-27 ═══

  Les cinq tableaux d'argent ont gagné une rangée de pied qui somme leurs
  colonnes — et, sous 1024 px où quatre d'entre eux passent en fiches, une carte
  de total à la place de cette rangée. Huit points grandissent :

    /demo/cautions@1280      900 →  946    +46
    /demo/paiements@1280    1483 → 1530    +47
    /demo/releves@1280      1402 → 1450    +48
    /demo/locataires@360    4380 → 4474    +94
    /demo/paiements@360     3373 → 3466    +93
    /demo/releves@360       3753 → 3847    +94
    /demo/parc@360          4232 → 4350   +118
    /demo/cautions@360      2121 → 2270   +149

  À 1280, les trois valeurs disent la même chose : UNE RANGÉE DE TABLEAU, au
  rembourrage près des autres. À 360, c'est une carte — intitulé, puis une ligne
  par colonne sommée — donc le prix suit le NOMBRE de colonnes d'argent de
  l'écran : un loyer sur le parc et les locataires, trois montants sur les
  cautions, qui est le point le plus cher de la liste et le seul à dépasser 100 px.

  CE QU'ILS ACHÈTENT : le seul nombre pour lequel on ouvre ces écrans. Les cinq
  offraient déjà leurs totaux en cartes d'indicateur, calculées sur la population
  ENTIÈRE, et les cinq tableaux filtrent — par état, et par recherche libre sur le
  parc. Dès qu'on filtrait, plus aucun nombre de l'écran ne décrivait ce qu'on
  regardait. Voir `Column.total` dans `DataTable`.

  POURQUOI LA CARTE PLUTÔT QUE LA SEULE RANGÉE, puisqu'elle coûte deux à trois
  fois plus cher : quatre de ces cinq écrans rendent des FICHES sous 1024 px, donc
  sur téléphone et tablette en portrait. Un total qui n'existerait qu'au large
  serait la faute que ce dépôt a déjà payée avec `hideOnMobile` — « sur le marché
  que ce produit vise, où le téléphone est l'appareil principal, la moitié de la
  donnée n'existait pas » —, cette fois sur le nombre qui résume tous les autres.

  ═══ AUCUN PLAFOND N'EST MODIFIÉ, ET C'EST LA RÈGLE DE CE FICHIER ═══

  Les deux colonnes appartiennent à deux machines, et l'en-tête ci-dessus le
  répète : `plafond` vient du portable de développement sous macOS, `plafondLarge`
  de l'exécuteur Ubuntu de l'intégration continue, et « la colonne large ne se
  déduit jamais de l'autre » — treize des quarante-quatre points differaient de
  −67 à +21 px, et deux pages juridiques composent PLUS SERRÉ sous DejaVu que sur
  le portable.

  LE CONTENEUR DE CE LOT NE REPRODUIT NI L'UNE NI L'AUTRE. Son témoin le dit :
  « Créer mon espace » mesure 146,13 px en `system-ui` comme en DejaVu nommée,
  donc `system-ui` EST le repli et la colonne normale ne peut pas être la sienne ;
  et `MESURER_EN_POLICE_LARGE` y impose Verdana, absente, qui retombe sur une face
  plus ÉTROITE que `system-ui`. Les huit nombres ci-dessus sont donc un RELEVÉ
  d'une troisième machine, utile comme ordre de grandeur — une rangée de tableau,
  une carte par colonne sommée — et non comme plafond.

  LES DEUX COLONNES ATTENDENT DONC UN RELEVÉ pour ces huit points : `plafond` sur
  la machine de développement, `plafondLarge` par le travail `polices` de
  l'intégration continue, comme les entrées précédentes de cet en-tête le citent
  avec leur numéro d'exécution. Un écart marqué avec les ordres de grandeur
  ci-dessus est lui-même un signal — le pied est une rangée de texte sur une
  ligne, il ne devrait pas dépendre beaucoup de la police.

  CE QUE LE MÊME CONTENEUR MESURE AU COMMIT PRÉCÉDENT, pour que ce lot ne se voie
  pas reprocher ce qui ne lui appartient pas : `/demo/acces@360` rend 3377 px pour
  2187, et `/demo/acces@1280` 1654 px pour 1192 — AUX MÊMES PIXELS, `src/` remonté
  au commit précédent. Cette dérive-là préexiste et n'est pas de ce lot ; elle
  n'est pas interprétable ici, puisque cette machine ne juge aucune des deux
  colonnes.
*/
/*
  NOMMER LA PÉRIODE QU'UN ÉCRAN MONTRE — lot du 2026-10-07.

  Deux écrans ne disaient pas de QUAND ils parlaient. Les paiements titrent six
  colonnes au mois seul et n'ont aucun sélecteur ; les dépenses supprimaient le
  leur hors session, donc n'annonçaient aucune période du tout.

    /demo/paiements@360   3672 → 3701   +29   la fenêtre, nommée une fois
    /demo/paiements@1280  1792 → 1822   +30
    /demo/depenses@360    1650 → 1714   +64   le sélecteur, rouvert en démo
    /demo/depenses@1280    900 →  900     0   déjà au plancher

  LES +29 SONT UN CORRECTIF DE SECONDE RÉDACTION, et c'est cette porte qui l'a
  obtenu. L'année était d'abord portée PAR LES COLONNES — « mai 26 » au départ de
  l'axe. Refus à 3828 px, soit +156 : dans la fiche, la grille donne 2,75rem par
  période, le libellé s'y replie, et les pastilles de mai tombent sur une
  TROISIÈME rangée sous leur propre en-tête. La capture l'a montré ; la suite
  chronologique que le rôle `serie` protège était rompue.

  Les deux bornes nommées UNE fois au-dessus de la grille coûtent 29 px au lieu
  de 156, sur une seule ligne au lieu de quinze pixels sur chacune des dix
  fiches, et laissent l'axe intact. On ne relève pas un plafond quand c'est le
  dessin qui est en cause.

  LA COLONNE LARGE VIENT DE L'EXÉCUTEUR, et son journal dit quelque chose de plus
  net qu'hier : en police imposée, il rend EXACTEMENT ce que cette machine mesure
  en police NORMALE — 3701, 1714, 1822, 900, aux quatre points. Le mou de la
  mesure locale était donc de 187 px sur /demo/paiements@360.

    écrit ici   exécuteur   mou
    3888        3701        187   /demo/paiements@360
    1735        1714         21   /demo/depenses@360
    1843        1822         21   /demo/paiements@1280
     907         900          7   /demo/depenses@1280

  Autrement dit, la DejaVu Sans du CI ne coûte rien de plus que la police système
  d'ici, quand la Verdana d'ici coûte jusqu'à 5 %. C'est la cinquième instance de
  cette divergence, et la troisième où la régler paie.
*/
/*
  LE PIED REVIENT SUR LES FORMES QUI L'AVAIENT PERDU — lot du 2026-10-06.

  Suite directe du bloc ci-dessus. Deux écrans ne rendent plus de table au-dessus
  de `lg` mais une grille de cartes bâtie à la main : rendue À LA PLACE du
  `DataTable`, elle emportait le pied avec elle, et ces deux écrans n'avaient donc
  aucune somme au large. La vacance, elle, n'en avait sur aucune largeur — sixième
  colonne d'argent du produit, et la seule dont le total n'était écrit nulle part.

  CE QUI GRANDIT, MESURÉ SUR CETTE MACHINE :

    colonne normale                     police large
    /demo/cautions@360   2270 → 2309    2270 → 2309    +39   l'écart des rendues
    /demo/vacance@360    1343 → 1436    1321 → 1414    +93   la carte de total
    /demo/parc@1280      1785 → 1878    1785 → 1878    +93   la carte de total
    /demo/cautions@1280   946 →  968     926 →  968    +22   l'écart des rendues
    /demo/locataires@1280 2386 → 2479   2364 → 2457    +93   la carte de total

  LES 93 px SONT LA MÊME CARTE QU'EN 2026-09-27, à l'unité près : intitulé, puis
  une ligne par colonne sommée, et ces trois écrans n'en somment qu'une. Les +39
  et +22 ne sont pas une carte mais une LIGNE de plus dans celle qui existait —
  le terme que les cautions rendues retirent à la soustraction du pied, replié sur
  deux lignes à 360 px et sur une seule à 1280.

  CE QU'ILS ACHÈTENT : à 1280, trois écrans passaient d'aucun total à un total.
  Mesuré sur `/demo/locataires?etat=overdue` — « Total · 3 lignes sur 10 — Loyer
  412 000 FCFA » à 375 px, et RIEN à 1280, où la seule carte visible annonce les
  dix baux.

  LA COLONNE LARGE VIENT DE L'EXÉCUTEUR, PAS DE CETTE MACHINE — et il a fallu la
  mesurer deux fois pour l'écrire. Première rédaction : les nombres relevés ici,
  sous Verdana, que cette machine possède ; le travail `polices` du passage CI
  37528794331 a rendu les siens, sous DejaVu Sans, et ils sont tous PLUS BAS :

    /demo/vacance@360     1479 ici → 1414 là-bas     65 px de mou
    /demo/parc@1280       1900 ici → 1878 là-bas     22 px
    /demo/locataires@1280 2479 ici → 2457 là-bas     22 px
    /demo/cautions@360    2330 ici → 2309 là-bas     21 px
    /demo/cautions@1280    968 ici →  968 là-bas      0

  Ce sont les SIENS qui sont inscrits : un plafond qui porte 65 px de mou ne
  refuse pas ce qu'il prétend refuser, et c'est l'exécuteur qui garde cette
  colonne à chaque poussée. La divergence des deux machines est écrite ailleurs
  dans ce dépôt ; c'est sa quatrième instance, et la deuxième où elle paie.

  À 1280, les mesures normale et large sont IDENTIQUES sur deux des trois points :
  à cette largeur, rien ne se replie.
*/
/**
 * ═══ LA COLONNE NORMALE RELEVÉE LE 2026-09-28 — HUIT CROISSANCES, TROIS MOUS ═══
 *
 * Le témoin de machine a d'abord répondu — « Colonne jugée : plafond — cette
 * machine la possède » —, et c'est la condition pour écrire ici. Onze plafonds
 * ont bougé :
 *
 *   croissances   /demo/parc@360      4232 → 4350   (+118)
 *                 /demo/cautions@360  2121 → 2270   (+149)
 *                 /demo/releves@360   3753 → 3847   (+94)
 *                 /demo/paiements@360 3373 → 3466   (+93)
 *                 /demo/paiements@1280 1483 → 1530  (+47)
 *                 /demo/releves@1280  1402 → 1450   (+48)
 *                 /demo/cautions@1280  900 →  946   (+46)
 *                 /confidentialite@360 3743 → 3744  (+1)
 *   mous          /demo/locataires@360 4651 → 4488  (−163)
 *                 /demo/decisions@360  1591 → 1521  (−70)
 *                 /demo/acces@360      2226 → 2205  (−21)
 *
 * ═══ LE 2026-09-28 — CINQ LOTS D'AUDIT, TROIS PLAFONDS ═══
 *
 *   /demo@360             3428 → 3478  (+50)
 *   /demo/paiements@1280  1530 → 1552  (+22)
 *   /demo/acces@360       2205 → 2183  (−22)
 *
 * LES DEUX HAUSSES SONT LE MÊME MOT, et il a été pesé. La carte « encaissé ce
 * mois » disait « vs. 1 250 000 le mois dernier » ; elle dit maintenant « au
 * MÊME JOUR le mois dernier », parce que l'ancienne comparait un mois entamé à
 * un mois complet et annonçait donc une baisse tous les mois. Quatre mots de
 * plus, deux lignes de repli dans une carte étroite. C'est cher pour du texte,
 * et c'est moins cher qu'une fausse alarme mensuelle : le nombre du haut ne
 * veut rien dire tant qu'on ignore à quoi il se compare.
 *
 * LA BAISSE EST UNE PHRASE RACCOURCIE. Le résumé de périmètre du registre
 * nommait l'immeuble des deux côtés de « sauf » — « Gère : Résidence
 * Bonamoussadi … — sauf Résidence Bonamoussadi · S2 » —, ce qui se lisait comme
 * son retrait. L'exception est désormais collée à ce qu'elle modifie :
 * « Résidence Bonamoussadi (sauf S2) », 120 caractères devenus 78.
 *
 * ═══ LE 2026-09-28, SECONDE SÉRIE — LES GESTES QUI MANQUAIENT AUX LIGNES ═══
 *
 *   /demo/paiements@1280  1552 → 1792  (+240)
 *   /demo/paiements@360   3466 → 3672  (+206)
 *   /demo/releves@360     3847 → 3902  (+55)
 *
 * CE QUE CES 240 PIXELS ACHÈTENT, et c'est le plus cher des trois : le geste le
 * plus FRÉQUENT de l'écran des paiements — encaisser — vivait dans un bouton
 * d'en-tête où il fallait rechoisir le logement dans une liste de douze. Il est
 * désormais au bout de la ligne qui le demande. Trois commandes ne tiennent plus
 * sur une seule ligne de cellule, et les trois rangées concernées se replient.
 *
 * LE REPLI EST CELUI QUI EXISTAIT DÉJÀ (`flex-wrap`, mesuré à 320 px pour deux
 * commandes) : ce lot ne fait que l'atteindre plus souvent. Le remède qui
 * rendrait ces pixels serait de replier les trois gestes derrière un menu, comme
 * l'écran du parc l'a fait pour ses vingt-six commandes — c'est un autre lot, et
 * il changerait aussi la présentation des deux gestes existants.
 *
 * Les 55 px des relevés sont les deux totaux de consommation au pied, en fiche.
 *
 * LA COLONNE LARGE DE CETTE SÉRIE VIENT DU TRAVAIL `polices`, exécution
 * 36429885059 — trois points, LES TROIS ÉCRANS DES LOTS, et aux MÊMES valeurs
 * que la colonne normale. Ce n'est pas une coïncidence : ces hausses viennent de
 * rangées de commandes qui se replient, pas de métriques de fonte. Une police
 * plus grande ne change pas le nombre de boutons qui tiennent sur une ligne dès
 * lors qu'ils n'y tenaient déjà plus.
 *
 * `plafond-vitrine`, le SECOND relevé du même travail, est vert sur ses quatre
 * points (fr@360 11384, en@360 10953, fr@1280 8177, en@1280 8131) : aucun lot de
 * cette série ne touche la vitrine.
 *
 * LA COLONNE LARGE VIENT DU TRAVAIL `polices`, exécution 36401092091 :
 *
 *   /demo@360             3428 → 3479  (+51)
 *   /demo/paiements@1280  1530 → 1552  (+22)
 *   /demo/acces@360       2187 → 2165  (−22)
 *
 * TROIS POINTS SUR CINQUANTE-DEUX, ET CE SONT LES TROIS ÉCRANS DU LOT. C'est
 * la signature qu'on attend d'un relevé juste, et c'est exactement ce qu'un
 * relevé LOCAL ne donne pas : le 2026-09-25, la même table mesurée sur la
 * machine de développement proposait trente-deux changements, dont +450 px sur
 * `/conditions-generales`, une page qu'aucun lot ne touchait. Cette colonne
 * appartient à l'exécuteur de l'intégration continue, et elle seule fait foi.
 *
 * LES DEUX COLONNES NE BOUGENT PAS DU MÊME NOMBRE — +50 ici, +51 là-bas sur
 * `/demo@360` — et ce n'est pas du bruit : la même phrase se replie une ligne
 * de plus quand la police racine grandit.
 *
 * `plafond-coquille` étant VERTE, ce sont des pixels de CONTENU et non de
 * coquille — la porte le dit elle-même à chaque plainte. La cause commune est la
 * bascule du neutre vers le froid, qui recompose les interlignes, plus les gestes
 * de ce lot sur le tableau de bord et les fiches. Je n'ai PAS décomposé les onze
 * écarts écran par écran : ce qui est mesuré est le total, et c'est lui qui borne.
 *
 * DIX-HUIT PLAINTES ONT DISPARU SANS QU'UN PLAFOND BOUGE, et elles valent d'être
 * nommées ici : la « clôture perméable » sur les dix-huit pages connectées à
 * 1280 px était une boîte de défilement restée `static` dans `AppShell`, d'où
 * s'échappait un `<legend class="sr-only">`. Un mot de classe — `relative` — les
 * a toutes refermées. Elles n'étaient pas de la hauteur : elles étaient de
 * l'étanchéité.
 *
 * LA COLONNE `plafondLarge` N'EST PAS TOUCHÉE. Elle se relève sur l'exécuteur de
 * l'intégration continue, et un relevé local en `MESURER_EN_POLICE_LARGE=1` l'a
 * confirmé de la pire façon : il rend des valeurs plus hautes sur TOUTES les
 * pages, y compris `/conditions-generales` (+450) et `/confidentialite` (+389),
 * que ce lot ne touche pas. Ce sont les polices de cette machine. Les écrire
 * aurait remplacé une mesure du CI par une mesure d'ici — exactement ce que
 * l'en-tête de ce fichier interdit deux paragraphes plus haut.
 */
const PLAFONDS = [
  /* 360 px — 23 écrans */
  { adresse: '/inscription', largeur: 360, plafond: 1371, plafondLarge: 1371 },
  { adresse: '/connexion', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/mot-de-passe-oublie', largeur: 360, plafond: 900, plafondLarge: 900 },
  { adresse: '/reinitialiser', largeur: 360, plafond: 900, plafondLarge: 900 },
  /* +25 px : la page porte enfin SA date de mise à jour, comme les deux autres
     pages légales. La seule date visible était celle de l'immatriculation, à
     l'intérieur de la fiche d'éditeur — un lecteur qui veut savoir si le
     document est à jour ne pouvait pas la lire comme telle. */
  { adresse: '/mentions-legales', largeur: 360, plafond: 1996, plafondLarge: 1970 },
  /*
    LE SOMMAIRE DES PAGES LÉGALES, LE 2026-09-26 — et c'est le plus gros relèvement
    de ce fichier, donc celui qui doit le mieux se justifier.

    Les treize rubriques des conditions générales et les neuf de la
    confidentialité portaient chacune un `id`, donc une destination utilisable,
    et RIEN ne les listait : sur 4 679 px à 360 px de large, quelqu'un qui
    cherche le délai d'effacement de son compte parcourait treize écrans en
    lisant les titres au passage. Un document juridique est exactement le lieu
    où une table des matières se paie.

    CE QU'ELLE COÛTE, MESURÉ : +470 px à 360 et +423 à 1280 sur les conditions,
    +360 et +335 sur la confidentialité. Un premier jet à UNE colonne sous `sm`
    coûtait 713 px ; les deux colonnes en rendent 243, et ce relevé-là est la
    raison pour laquelle la grille n'attend plus `sm`.
  */
  { adresse: '/confidentialite', largeur: 360, plafond: 3744, plafondLarge: 3657 },
  { adresse: '/conditions-generales', largeur: 360, plafond: 5248, plafondLarge: 5149 },
  /* 3454 → 3428 et 1864 → 1855 le 2026-09-27 : la page a RACCOURCI de 26 px à
     360 et de 9 px à 1280, et c'est un gain qu'il faut inscrire sous peine de le
     redépenser sans le voir. Ce qui l'a produit : la ligne de quartier des tuiles
     d'immeuble n'avait aucune troncature, donc un nom de quartier long passait à
     la ligne et poussait la tuile d'un cran. Elle se tronque depuis que la tuile
     porte aussi un montant — voir le docbloc de `Dashboard.tsx` —, et le retour
     à la ligne a disparu avec. `plafondLarge` suit du même écart. */
  { adresse: '/demo', largeur: 360, plafond: 3478, plafondLarge: 3479 },
  /* +30 px LE 2026-09-26, ET C'EST LA CARTE QUE L'ÉCRAN EXISTE POUR MONTRER.
     « En retard · 412 000 FCFA » ne portait rien sous son montant ; la note dit
     désormais combien de baux le composent et depuis combien de jours — les
     deux questions qu'il fallait aller compter dans la grille, et les deux qui
     distinguent la relance de la mise en demeure. Sur un téléphone, c'est la
     SEULE carte rendue : ses deux voisines partent sous `lg`. Trente pixels
     pour la réponse qu'on descendait chercher. */
  { adresse: '/demo/paiements', largeur: 360, plafond: 3701, plafondLarge: 3701 },
  { adresse: '/demo/etats-des-lieux', largeur: 360, plafond: 2746, plafondLarge: 2746 },
  { adresse: '/demo/travaux', largeur: 360, plafond: 3119, plafondLarge: 3097 },
  { adresse: '/demo/signalements', largeur: 360, plafond: 2961, plafondLarge: 2982 },
  /*
    3 249 → 3 220 LE 2026-10-01, ET CE GAIN N'EST PAS DE CE LOT.

    La garde du mou a dénoncé 29 px pendant le lot du manuel, et j'ai d'abord cru
    les avoir causés : la barre du locataire venait de passer de trois à quatre
    entrées. MESURÉ PLUTÔT QUE SUPPOSÉ, deux fois — retirer le lien du DOM ne
    change pas la hauteur d'un pixel, et la MÊME mesure de 3 220 sort d'un `main`
    remisé, sans aucune de ces modifications.

    C'est donc une dérive ANCIENNE que personne n'avait vue, et la raison tient en
    une ligne : l'intégration continue n'exécute `complet` qu'en POLICE LARGE.
    La colonne normale n'est mesurée que lorsqu'on lance la porte à la main sur la
    machine qui la possède. Entre deux de ces exécutions, un gain reste non
    inscrit et le plafond cesse de refuser ce qu'il prétend refuser.
  */
  { adresse: '/demo/mon-espace', largeur: 360, plafond: 3220, plafondLarge: 3198 },
  /* +48 px LE 2026-09-26 : chaque quittance porte son état de règlement.
     Six lignes annonçaient un mois et un montant DÛ — le fichier s'en
     expliquait — sans jamais dire si la période était soldée : le locataire
     téléchargeait une quittance de juin dont 5 058 FCFA restent impayés sans
     que rien, sur la ligne, ne l'en avertisse. Huit pixels par quittance pour
     le seul fait qui décide s'il doit payer ou ranger. */
  { adresse: '/demo/documents', largeur: 360, plafond: 2292, plafondLarge: 2292 },
  { adresse: '/demo/signaler', largeur: 360, plafond: 1227, plafondLarge: 1205 },
  { adresse: '/demo/parc', largeur: 360, plafond: 4350, plafondLarge: 4350 },
  { adresse: '/demo/releves', largeur: 360, plafond: 3902, plafondLarge: 3902 },
  { adresse: '/demo/cautions', largeur: 360, plafond: 2309, plafondLarge: 2309 },
  /* LES DÉPENSES — mesuré le 2026-09-30, avec le lot qui crée l'écran.
     1650 px en police système sur cette machine ; 1671 en police large, MESURÉ
     LOCALEMENT et non sur l'exécuteur. L'en-tête de ce fichier dit pourquoi
     c'est une réserve et non un résultat : sur les écrans applicatifs l'écart
     local/CI va de −67 à +21 px. Le travail `polices` corrigera la colonne
     large, et c'est lui qui fait autorité. */
  /* 1671 → 1650 EN POLICE LARGE, RELEVÉ PAR `polices` LE 2026-09-30, comme le
     commentaire ci-dessus l'annonçait. L'estimation locale avait 21 px de MOU,
     et un plafond au-dessus de la mesure ne refuse plus rien : c'est ce que
     cette garde appelle du mou, et elle le refuse au même titre qu'un
     dépassement. Les deux colonnes coïncident désormais — la police large ne
     rallonge pas cet écran sur cette machine-là. */
  { adresse: '/demo/depenses', largeur: 360, plafond: 1714, plafondLarge: 1714 },
  /* +16 px EN POLICE LARGE, LE 2026-09-26 — voir le point à 1280 pour le lot :
     la caution et les chantiers deviennent des pastilles conditionnelles. En
     pile, les deux tirets valaient deux lignes de valeur ; les pastilles en
     valent une de plus à elles deux sur les fiches qui les portent. Le gain du
     bureau vient de la grille à deux colonnes, qui n'existe pas ici. */
  { adresse: '/demo/locataires', largeur: 360, plafond: 4488, plafondLarge: 4488 },
  { adresse: '/demo/mes-donnees', largeur: 360, plafond: 900, plafondLarge: 900 },
  /* −22 px : le résumé de périmètre cesse de recopier le nom de l'immeuble
     devant chaque logement retranché. Mesuré ici à 2187 en police large ; la
     colonne normale, qui appartient à l'autre machine, reçoit le même écart. */
  /* +48 px le 2026-09-30 : le bouton « Honoraires et relevé » sur la ligne
     de chaque mandataire. Un bouton de rangée et rien d'autre — le relevé
     lui-même vit dans une modale, et n'allonge donc pas l'écran. */
  /* 2343 → 2213 EN POLICE LARGE, même relevé et même motif : 130 px de mou,
     le plus gros des deux. La colonne large reste SOUS l'étroite — 2213 contre
     2231 — et ce n'est pas une anomalie : c'est la dissymétrie de largeur de
     texte que `releve-polices-machine` mesure entre les deux machines, et qui
     va dans les deux sens. */
  { adresse: '/demo/acces', largeur: 360, plafond: 2231, plafondLarge: 2213 },
  /* L'ÉCRAN DE LA VACANCE, né avec le lot des annonces. Trois indicateurs, une
     note de portée inconditionnelle et un tableau d'annonces — la même forme
     que l'écran des dépenses, qui rend 1650 à la même largeur. */
  /* 1321 EN POLICE LARGE, RELEVÉ PAR `polices` : l'écran est PLUS COURT là-bas
     qu'ici (1343), comme `/demo/acces`. La dissymétrie de largeur de texte
     entre les deux machines va dans les deux sens, et recopier la colonne
     étroite aurait laissé 22 px de mou sur la porte publique. */
  { adresse: '/demo/vacance', largeur: 360, plafond: 1436, plafondLarge: 1414 },
  /* 1 521 → 1 387 LE 2026-10-09 : le registre se lit par journée, et la date
     cesse d'être répétée à chaque ligne. UN GAIN de 134 px à cette largeur, et
     un gain s'inscrit — « un gain non inscrit se redépense ».
     COLONNE LARGE : à relever sur le CI, pas à transposer. */
  { adresse: '/demo/decisions', largeur: 360, plafond: 1387, plafondLarge: 1387 },
  { adresse: '/demo/prise-en-main', largeur: 360, plafond: 1633, plafondLarge: 1611 },
  /*
    LE MANUEL, ET C'EST LE PLUS LONG ÉCRAN DU PRODUIT À CETTE LARGEUR — devant
    les conditions générales (5 248). C'est la nature de l'objet : un manuel se
    CHERCHE, et `Ctrl+F` ne trouve pas ce qu'un accordéon a replié. La longueur
    est donc un relevé, pas une ambition.

    7 594 → 6 018 EN DEUX CORRECTIONS MESURÉES, et aucune n'a retiré d'information :
    la section « les autres rôles » ne réexplique plus ce qu'elle nomme, et elle a
    perdu douze en-têtes et douze boutons d'écran qui invitaient à des gestes qui
    ne sont pas ceux du lecteur. Voir l'en-tête de `Manuel.tsx`.
  */
  /* COLONNE LARGE RELEVÉE SUR LE CI (exécution 36821681475, travail `polices`) :
     5 867, soit 151 px de MOINS qu'en police système sur la machine de
     développement. L'inverse de ce qu'on attend, et l'inverse de ce qui se passe
     à 1280 sur le même écran — c'est précisément pourquoi aucun de ces deux
     nombres ne se recopie dans l'autre colonne. */
  /* 6 018 → 6 112 LE 2026-10-01 : la visite filmée est entrée dans `public/` et
     l'écran porte désormais un lecteur avec son affiche. +94 px ici, +532 à
     1280 — l'écart tient à la largeur du lecteur, qui suit celle de la carte.
     La colonne LARGE est relevée sur le CI, exécution citée plus bas. */
  /*
    6 112 → 6 629 LE 2026-10-08 : le sommaire des gestes. Treize entrées en deux
    colonnes, +517 px relevés à cette largeur — le même ordre de grandeur que
    les 713 px qu'avait coûtés le sommaire des conditions générales empilé en
    UNE colonne, et la raison pour laquelle ce composant en rend deux dès 360.

    LA COLONNE LARGE A ÉTÉ TRANSPOSÉE, ET LA TRANSPOSITION ÉTAIT FAUSSE — 6 477
    inscrits (5 960 + 517, le delta de la machine de développement), 6 456
    mesurés sur le CI le 2026-10-08. Vingt et un pixels de MOU, et cette porte
    les refuse comme elle refuse un débordement : « un gain non inscrit se
    redépense ».

    LE RAISONNEMENT QUI A PRODUIT 6 477 ÉTAIT FAUX, ET DANS LE SENS QUE J'AVAIS
    DÉCLARÉ SÛR. J'avais écrit qu'une police plus large replie davantage
    d'entrées du sommaire sur deux lignes, donc que le vrai delta serait PLUS
    grand et la porte rougirait pour débordement. Elle rend l'inverse : 496 de
    delta au lieu de 517, la page est plus COURTE sous la police large. C'est la
    propriété que ce fichier écrit déjà pour cet écran deux lignes plus bas — le
    sens de l'écart s'inverse avec la largeur — et je l'ai contredite en pariant
    sur une intuition.

    CE QUI A SAUVÉ LE LOT n'est donc pas le sens de mon erreur, c'est que cette
    porte refuse le mou. Une porte qui n'aurait regardé que le débordement aurait
    laissé passer 21 px de plafond menteur, et personne ne l'aurait su.

    MORALE, pour la prochaine fois : une colonne que cette machine ne sait pas
    mesurer ne se transpose pas, elle se RELÈVE — `workflow_dispatch` sur
    `main.yml` fait tourner le travail `polices`, qui imprime la table.
  */
  { adresse: '/demo/manuel', largeur: 360, plafond: 6629, plafondLarge: 6456 },
  { adresse: '/demo/systeme', largeur: 360, plafond: 2078, plafondLarge: 2078 },
  { adresse: '/demo/portail', largeur: 360, plafond: 1163, plafondLarge: 1163 },
  { adresse: '/adresse-qui-n-existe-pas', largeur: 360, plafond: 900, plafondLarge: 900 },
  /*
    L'ANNONCE PUBLIQUE, et 900 N'EST PAS SA HAUTEUR : c'est le PLANCHER que cette
    porte applique, le même que les quatre écrans d'authentification. La page
    mesure moins — sous les portes, aucun serveur d'API ne répond, et ce qu'elles
    voient est l'état « cette annonce n'est plus disponible » : un en-tête et une
    note.

    L'ÉTAT CHARGÉ N'A DONC AUCUN PLAFOND, et c'est déclaré dans
    `scripts/inventaire/routes.mjs` à côté de l'adresse. La même limite que
    `mesure-ui`, qui ne voit que `/demo`.

    LA COLONNE LARGE EST À 900 AUSSI, et pour une raison et non par recopie : une
    police plus large ne raccourcit rien, et le contenu reste loin sous le
    plancher. C'est le seul cas de ce tableau où les deux colonnes coïncident
    sans qu'une mesure de l'exécuteur soit nécessaire.
  */
  { adresse: '/annonce/00000000-0000-4000-8000-000000000000', largeur: 360, plafond: 900, plafondLarge: 900 },
  /* 1280 px — 23 écrans */
  { adresse: '/inscription', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/connexion', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/mot-de-passe-oublie', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/reinitialiser', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/mentions-legales', largeur: 1280, plafond: 1544, plafondLarge: 1544 },
  { adresse: '/confidentialite', largeur: 1280, plafond: 2749, plafondLarge: 2706 },
  { adresse: '/conditions-generales', largeur: 1280, plafond: 3759, plafondLarge: 3673 },
  { adresse: '/demo', largeur: 1280, plafond: 1855, plafondLarge: 1856 },
  { adresse: '/demo/paiements', largeur: 1280, plafond: 1822, plafondLarge: 1822 },
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
  /* +34 px : les signalements qui attendent un prix ou un arbitrage disent
     DEPUIS QUAND. « 26 août » et « 5 août » se lisaient à l'identique sur une
     liste qu'on ouvre pour décider par quoi commencer ; « il y a 6 semaines »
     les sépare. La ligne s'allonge et se replie sur deux cartes à 1280. */
  { adresse: '/demo/travaux', largeur: 1280, plafond: 1580, plafondLarge: 1513 },
  { adresse: '/demo/signalements', largeur: 1280, plafond: 1521, plafondLarge: 1521 },
  { adresse: '/demo/mon-espace', largeur: 1280, plafond: 1409, plafondLarge: 1409 },
  /* +15 px, même cause qu'à 360 — la pastille tient sur la ligne du montant
     dès que la carte a sa largeur de bureau. */
  { adresse: '/demo/documents', largeur: 1280, plafond: 1202, plafondLarge: 1180 },
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
  /*
    −427 px LE 2026-09-27 : les logements d'un immeuble défilent en RANG au lieu
    de s'empiler. Une carte d'immeuble garde désormais la même hauteur qu'il
    porte trois logements ou douze, et les trois immeubles de la démonstration
    tiennent sur un écran au lieu d'une colonne qu'on descend. C'est le plus
    gros gain de hauteur de ce fichier, et il vient d'un changement de forme,
    pas d'un retrait de contenu : aucune fiche n'a perdu une ligne.
  */
  { adresse: '/demo/parc', largeur: 1280, plafond: 1878, plafondLarge: 1878 },
  { adresse: '/demo/releves', largeur: 1280, plafond: 1450, plafondLarge: 1450 },
  { adresse: '/demo/cautions', largeur: 1280, plafond: 968, plafondLarge: 968 },
  /* 900 px aux deux polices, et c'est la HAUTEUR DE VUE : à 1280 l'écran tient
     dans la fenêtre, il ne défile pas. Les deux colonnes coïncident donc sans
     que ce soit une coïncidence — il n'y a rien à dépasser. */
  { adresse: '/demo/depenses', largeur: 1280, plafond: 900, plafondLarge: 900 },
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
  { adresse: '/demo/locataires', largeur: 1280, plafond: 2479, plafondLarge: 2457 },
  { adresse: '/demo/mes-donnees', largeur: 1280, plafond: 900, plafondLarge: 900 },
  /* −21 px, même cause qu'à 360 : la phrase de périmètre passe de quatre
     lignes à deux sur la fiche du gestionnaire, qui est la plus haute de sa
     rangée et fixe donc la hauteur de la grille. */
  /* +48 px le 2026-09-30 : le bouton « Honoraires et relevé » sur la ligne
     de chaque mandataire. Un bouton de rangée et rien d'autre — le relevé
     lui-même vit dans une modale, et n'allonge donc pas l'écran. */
  { adresse: '/demo/acces', largeur: 1280, plafond: 1240, plafondLarge: 1240 },
  { adresse: '/demo/vacance', largeur: 1280, plafond: 900, plafondLarge: 900 },
  /*
    900 → 1 123 LE 2026-10-09, ET C'EST UNE HAUSSE ASSUMÉE. 900 était le
    PLANCHER de la fenêtre : le tableau tenait dessous. Le registre par journée
    n'y tient plus — six en-têtes de journée coûtent environ deux cents pixels,
    et c'est la fonction elle-même, pas un défaut.

    MESURÉ EN TROIS TEMPS, et chaque fois la mesure a commandé :

      1 327  l'auteur, qui était une COLONNE, devenu une ligne empilée ;
      1 123  rendu à la droite de l'acte au-delà de `sm` — la largeur était là,
             inoccupée. Deux lignes par acte au lieu de trois ;
      1 107  les pastilles du rail retirées et l'alignement ramené à
             `items-center`, pour tenir sous le budget du premier chargement.

    Les 16 derniers pixels sont donc un effet de bord d'un lot de poids, et non
    une intention de mise en page. Ils s'inscrivent quand même : un gain non
    inscrit se redépense.

    ═══ LA COLONNE LARGE EST RELEVÉE, ET LES DEUX COÏNCIDENT ═══

    1 107 des DEUX côtés — `workflow_dispatch` sur la branche, exécution
    37859411075, sur le commit exact qui a été poussé. Pas transposée : la leçon
    de la ligne du manuel a coûté un gel de production.

    ET LA COÏNCIDENCE EST UN RÉSULTAT, pas une commodité. Sur le code d'AVANT les
    dernières retouches, le CI rendait 1 131 contre 1 123 ici — huit pixels
    d'écart. Ils ont disparu avec `items-baseline`, remplacé par `items-center` :
    une ligne de base dépend de la police, un centrage non. C'est pourquoi les
    deux nombres sont égaux sans être recopiés l'un sur l'autre.
  */
  { adresse: '/demo/decisions', largeur: 1280, plafond: 1107, plafondLarge: 1107 },
  { adresse: '/demo/prise-en-main', largeur: 1280, plafond: 1358, plafondLarge: 1358 },
  /* 4 555 → 5 087 LE 2026-10-01, par l'entrée du lecteur vidéo. La colonne large
     relevée sur le CI (exécution 36861634587) rend 5 134 : +47 px ici quand elle
     en perd 152 à 360. LE SENS DE L'ÉCART S'INVERSE AVEC LA LARGEUR, et c'est
     exactement ce qu'avait rendu le relevé d'avant la vidéo — ce n'est donc pas
     un hasard de mesure, mais une propriété de cet écran. Aucune des deux
     colonnes ne se déduit de l'autre. */
  /*
    INCHANGÉ LE 2026-10-08, ET C'EST LE RÉSULTAT DU LOT, pas un oubli.

    La page a gagné une navigation et n'a pas grandi d'un pixel : 5 078 mesurés
    avant comme après. Au-delà de 64 rem elle ne porte pas le sommaire en tête
    — qui coûtait 423 px, relevés — mais un RAIL COLLANT en colonne latérale,
    là où rien n'occupait la largeur. Voir `TableDesMatieres.tsx`.

    Les DEUX colonnes sont donc laissées telles quelles, et aucune n'est
    transposée : rien ne les concerne.
  */
  { adresse: '/demo/manuel', largeur: 1280, plafond: 5087, plafondLarge: 5134 },
  { adresse: '/demo/systeme', largeur: 1280, plafond: 1199, plafondLarge: 1220 },
  { adresse: '/demo/portail', largeur: 1280, plafond: 1029, plafondLarge: 1029 },
  { adresse: '/adresse-qui-n-existe-pas', largeur: 1280, plafond: 900, plafondLarge: 900 },
  { adresse: '/annonce/00000000-0000-4000-8000-000000000000', largeur: 1280, plafond: 900, plafondLarge: 900 },
]

/**
 * LA COLONNE QUE LA MACHINE QUI TOURNE POSSÈDE — MESURÉE, PLUS SUPPOSÉE.
 *
 * Cette ligne s'écrivait `!POLICE_LARGE || Boolean(process.env.CI)` : sans
 * commutateur, TOUTE machine était réputée être la machine de développement, où
 * `system-ui` vaut SF Pro. Un conteneur d'exécution, la machine d'un nouveau
 * contributeur, n'importe quel Linux : la porte y jugeait des plafonds qu'aucune
 * de ses mesures ne concerne. `plafond-vitrine` en a rendu un verdict rouge le
 * 2026-09-27, rapporté comme une dette — voir `temoin-de-la-machine.mjs`, qui
 * porte les relevés et la preuve que la page n'avait rien gagné.
 *
 * `system-ui` est donc MESURÉ contre la face de repli, dans la même exécution et
 * sans aucune constante inscrite. Le commutateur garde sa règle : sa colonne
 * appartient à la porte publique, que `CI` désigne.
 */
let colonneANous = POLICE_LARGE ? Boolean(process.env.CI) : true
let temoinDeLaMachine = null

/**
 * ET LE DÉPASSEMENT NE SUIT PAS LA MÊME RÈGLE QUE LE MOU — deux questions, deux
 * conditions, et la première rédaction de ce lot les avait confondues.
 *
 * LE MOU (« le plafond est au-dessus de la mesure ») ne vaut que sur la machine
 * qui POSSÈDE la colonne : ailleurs, l'écart mesuré n'est pas du mou, c'est une
 * différence de police. Inchangé.
 *
 * LE DÉPASSEMENT, lui, garde sa valeur dès que la colonne mesurée est celle qui
 * s'applique à la passe en cours : une croissance de CONTENU se voit dans les
 * DEUX passes — l'en-tête de `plafond-vitrine` le montre sur le lot de la police
 * des titres, poussé en normal ET en large. On le juge donc en police large
 * MÊME hors `CI` : c'est la seule colonne qu'une machine autre que celle de
 * développement reproduise, et la taire supprimerait le dernier garde-fou
 * disponible en local. Sur le conteneur de ce lot, cette passe rend deux des
 * quatre plafonds de la vitrine EXACTS au pixel.
 *
 * Ce qui disparaît est le seul verdict qu'aucune mesure ne soutenait : le
 * dépassement de la colonne NORMALE sur une machine dont `system-ui` n'est pas
 * celui de la colonne. C'est celui qui a produit le faux rapport.
 */
let depassementJuge = true

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

  52 → 54 LE 2026-09-30 : `/demo/depenses`, l'écran de ce qui sort du parc.
  54 → 56 LE 2026-09-30 : `/demo/vacance`, l'écran de ce qui ne rapporte rien —
       le second écran du même jour, et le dernier des huit lots.
  56 → 58 LE 2026-10-01 : `/demo/manuel`, le manuel d'utilisation.
*/
/* 58 → 60 (2026-10-06) : l'annonce publique, aux deux largeurs. Premier écran
   de ce tableau qu'un inconnu peut ouvrir sans compte. */
const ATTENDUS = 60
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
  /*
    LE MANUEL N'APPELLE RIEN, et c'est sa nature même : son contenu vit dans le
    paquet — un registre de gestes et deux dictionnaires. Il ne lit ni parc, ni
    bail, ni paiement. Le seul fait qu'il consulte est le RÔLE de qui le lit,
    déjà porté par la coquille.

    LA VIDÉO N'Y CHANGE RIEN tant qu'aucune adresse n'est posée : sans
    `VITE_VIDEO_DEMO`, il n'y a pas d'élément `<video>`, donc aucune requête.
    Avec une adresse, `preload="metadata"` en déclencherait une — mais aucune
    machine du dépôt ne pose cette variable, et cet état n'est mesuré nulle part.
  */
  '/demo/manuel',
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
      /* UNE FOIS SUFFIT : le témoin décrit la MACHINE, pas l'écran. Il est relevé
         sur la première page ouverte plutôt que dans une page à lui. */
      if (temoinDeLaMachine === null) {
        temoinDeLaMachine = await releverLeTemoin(page)
        if (!POLICE_LARGE) {
        colonneANous = laColonneNormalePeutEtreANous(temoinDeLaMachine)
        depassementJuge = colonneANous
      }
      }
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

      if (colonneANous && plafond > hDoc) {
        plaintes.push(
          `${nom} : ${plafond - hDoc} px de MOU — le plafond (${plafond}) est au-dessus\n` +
            `   de la mesure (${hDoc}). Il ne refuse donc plus ce qu'il prétend refuser.\n` +
            `   Descendez-le à ${hDoc} : c'est un gain, et un gain non inscrit se redépense.`,
        )
      }
      /*
        JUGÉ SOUS LA MÊME CONDITION QUE LE MOU, et cette asymétrie était le
        défaut : le mou consultait la colonne, le dépassement non. Une machine
        étrangère ne pouvait donc pas signaler un plafond trop haut, mais pouvait
        REFUSER un écran sur un plafond qui n'est pas le sien — et c'est dans ce
        sens-là que l'erreur coûte, puisqu'elle s'annonce comme une dette.

        CE N'EST PAS UN ASSOUPLISSEMENT : une croissance de CONTENU se voit dans
        les DEUX passes, comme l'en-tête de `plafond-vitrine` le montre sur le lot
        de la police des titres. Ce qui disparaît est le verdict qu'aucune mesure
        ne soutenait.
      */
      if (depassementJuge && hDoc > plafond) {
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

/* AU VERT AUSSI, et c'est le point : un vert obtenu sur une colonne qui n'est
   pas la nôtre n'est pas une assurance. Il ne se disait qu'au rouge. */
if (!colonneANous) {
  const nom = POLICE_LARGE ? 'plafondLarge' : 'plafond'
  console.log(
    depassementJuge
      ? /* POLICE LARGE HORS `CI` : le dépassement vaut, le mou non — voir la note
           des deux conditions. */
        `\n  Colonne ${nom} : dépassement JUGÉ, mou NON jugé — cette machine ne\n` +
          '  possède pas la colonne, seule la porte publique la possède.\n'
      : `\n  Colonne ${nom} NON JUGÉE : cette machine ne la possède pas ` +
          `(« ${TEMOIN} » : system-ui ${temoinDeLaMachine?.systeme} px, ` +
          `repli ${temoinDeLaMachine?.repli} px).\n` +
          '  Les hauteurs sont un RELEVÉ, pas un verdict. Pour juger ici :\n' +
          '  MESURER_EN_POLICE_LARGE=1 node scripts/plafond-hauteurs.mjs\n',
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-hauteurs : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  console.error(
    `  Colonne jugée : ${POLICE_LARGE ? 'plafondLarge' : 'plafond'} — ` +
      `${
        colonneANous
          ? 'cette machine la possède'
          : `cette machine ne la possède PAS, aucun plafond n’est jugé — « ${TEMOIN} » : ` +
            `system-ui ${temoinDeLaMachine?.systeme} px, repli ${temoinDeLaMachine?.repli} px`
      }.\n`,
  )
  exit(1)
}

console.log(
  /* « SOUS LEUR PLAFOND » SERAIT FAUX quand aucun plafond n'est jugé : c'est ce
     genre de phrase qui a fait prendre un relevé pour un verdict. */
  `\n✓ plafond-hauteurs : ${inspectes}/${ATTENDUS} points ${
    colonneANous
      ? 'sous leur plafond de hauteur de document,\n  et aucun plafond au-dessus de sa mesure.'
      : depassementJuge
        ? 'sous leur plafond de hauteur de document\n  (le mou n’est pas jugé ici — voir la ligne ci-dessus).'
        : 'RELEVÉS — aucun plafond jugé ici, voir la ligne ci-dessus.'
  } Ce script ne dit RIEN de ce que cette\n` +
    '  hauteur contient — voir son en-tête.',
)
