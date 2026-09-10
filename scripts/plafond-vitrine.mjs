#!/usr/bin/env node
/**
 * LA PAGE PUBLIQUE NE REGROSSIT PAS.
 *
 * LE DÉFAUT, ET IL EST PASSÉ SOUS TOUS LES RADARS. Pendant que la refonte
 * retirait 159 à 232 px à chaque écran applicatif, la vitrine a GRANDI : le
 * repli du bas de l'échelle typographique — 13 px vers 14 — l'a payée, et rien
 * ne mesurait sa hauteur. Aucune garde ne surveillait le seul écran que voit un
 * visiteur qui n'a pas de compte, et c'est celui qui décide s'il en ouvre un.
 *
 * ═══ QUELLE REFONTE — nommée le 2026-09-09, elle ne l'était pas ═══
 *
 * Celle de la DENSITÉ, le 2026-08-22 : `2c30c52` fait passer le bas de
 * l'échelle typographique de cinq paliers à trois, `381570f` rend 203 px de
 * contenu sur les vingt-trois écrans, et `d41da71` répare les sept cas qu'elle
 * avait rompus. C'est elle qui retirait 159 à 232 px par écran applicatif
 * pendant que la vitrine grandissait.
 *
 * CES 159 À 232 PX SONT SOURCÉS, et je ne l'avais pas écrit : ils viennent du
 * relevé de `381570f` lui-même — « Après : 122 px à 360 comme à 1280. Hauteur
 * de document : −159 à −232 px par écran applicatif. » La coquille passait de
 * 325 px avant le premier pixel de contenu à 122.
 *
 * ET LEUR CAUSE EST GARDÉE AUJOURD'HUI : `plafond-coquille.mjs` refuse que
 * cette coquille remonte, écran par écran et largeur par largeur. Ce qui n'est
 * gardé nulle part, c'est le nombre DÉRIVÉ — la hauteur de document des
 * vingt-trois écrans applicatifs. Aucune porte ne la mesure ; la retrouver
 * demanderait de reconstruire l'arbre d'avant le 2026-08-22.
 *
 * `origine` est donc la hauteur de la vitrine AVANT le 2026-08-22. Elle a été
 * posée le lendemain, par `30896d3`, en même temps que cette porte.
 *
 * ═══ UN CHIFFRE DE CET EN-TÊTE NE SE RECOUPE PAS ═══
 *
 * Il disait « la vitrine a grandi de 53 px en français et de 170 px en
 * anglais ». Sa propre table dit autre chose : de `origine` à la mesure d'avant
 * la porte, +78 et +194 à 360 px, +60 et +48 à 1280. Aucun couple ne rend
 * 53/170 — les deux relevés ne décrivent pas le même instant, et rien dans le
 * dépôt ne dit lequel. Les nombres invérifiables sont retirés de cette phrase
 * plutôt que gardés pour leur allure ; ceux de la table, eux, portent leur date.
 *
 * NON REMESURÉ : je n'ai pas reconstruit un arbre d'avant le 2026-08-22 pour
 * vérifier que 11419 a été MESURÉ et non recopié. Cela demanderait une
 * installation et une construction complètes d'un dépôt vieux de trois semaines,
 * pour une colonne qui ne refuse rien.
 *
 * CE QUE CE SCRIPT MESURE. La hauteur de document de la vitrine, aux deux
 * largeurs de référence et dans LES DEUX LANGUES — parce que l'anglais y est
 * plus long que le français, et que c'est lui qui avait le plus grossi.
 *
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE :
 *   — la HAUTEUR DES SECTIONS prise une par une. Une section qui doublerait
 *     pendant qu'une autre disparaîtrait laisserait le total inchangé et ce
 *     script vert. Il garde une somme, pas une composition ;
 *   — la LISIBILITÉ, la hiérarchie, le nombre de tailles typographiques. Une
 *     page plus courte n'est pas une page mieux écrite, et prétendre le
 *     contraire ferait de cette garde une décoration ;
 *   — les neuf autres largeurs de `mesure-ui`. La vitrine se recompose à `sm`
 *     et à `lg` ; 360 et 1280 sont de part et d'autre des deux, et une
 *     troisième largeur mesurerait la même chose une troisième fois ;
 *   — les autres écrans publics — connexion, inscription, mot de passe oublié.
 *     Ils tiennent en une fenêtre et leur hauteur est portée par leur
 *     formulaire, pas par une composition éditoriale.
 *
 * CE QU'IL REFUSE AVANT DE MESURER : une page dont les titres sont rendus dans
 * la police de REPLI. Voir `FAMILLE_ATTENDUE` — sans cette garde du garde, une
 * machine sans sortie réseau rendait un verdict de plafond sur une page qui
 * n'est pas celle du visiteur, et se trompait dans les deux sens.
 *
 *   node scripts/plafond-vitrine.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { exit } from 'node:process'
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const PORT = 4193
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES PLAFONDS, ET CE QU'ILS CONCÈDENT.
 *
 * `avant` et `origine` sont deux JALONS DATÉS, et ils racontent d'où la page
 * vient : un plafond seul n'est qu'un nombre.
 *
 * ILS PORTENT LEUR DATE DEPUIS LE 2026-09-09, ET C'EST UNE CORRECTION. `avant`
 * s'annonçait comme « la mesure d'avant CE lot » — une phrase vraie le jour où
 * on l'écrit et fausse dès le lendemain. Elle n'avait pas bougé depuis le 28 et
 * le 29 août, quinze commits plus tôt : entre-temps, le lot de la police des
 * titres a poussé `fr@1280` de 7092 à 7169 sans que personne récrive la ligne.
 * Le nombre était juste ; c'est ce qu'il PRÉTENDAIT être qui avait vieilli.
 *
 * Datés, ils cessent de vieillir : « 7092 le 2026-08-29 » restera vrai quel que
 * soit le nombre de lots qui passent.
 *
 * LEUR PROVENANCE, ÉTABLIE PAR L'HISTORIQUE : machine de DÉVELOPPEMENT, police
 * NORMALE. Le fichier est né le 2026-08-23 et `plafondLarge` n'existe que
 * depuis le 2026-08-30 — ces jalons lui sont antérieurs, ils ne peuvent donc
 * venir que de la colonne normale.
 *
 * ILS NE REFUSENT RIEN, et c'est pourquoi aucune garde ne les tient : ils
 * n'apparaissent que dans deux chaînes imprimées. Une garde sur un champ qui
 * ne juge rien serait une décoration.
 *
 * Le plafond est le MESURÉ, sans marge : le faire monter demande de récrire ces
 * lignes, donc de dire pourquoi dans le diff.
 *
 * ═══ CHAQUE COLONNE APPARTIENT À UNE MACHINE, ET IL FAUT LE DIRE ═══
 *
 * `plafond` est mesuré sur la machine de DÉVELOPPEMENT, où `system-ui` vaut SF
 * Pro. `plafondLarge` est mesuré sur la porte PUBLIQUE, où le commutateur
 * impose Verdana — qui y retombe sur DejaVu. Aucun nombre ne vaut sur les deux :
 * c'est tout l'objet du commutateur que de leur donner une référence commune.
 *
 * CE SILENCE A COÛTÉ UNE JOURNÉE. Rien ne disait d'où venait chaque colonne, et
 * trois `plafondLarge` sur quatre avaient été posés depuis la machine de
 * développement — à quatre ou six pixels des mesures locales, donc jusqu'à
 * 327 px au-dessus de ce que la porte publique mesure vraiment.
 *
 * CONSÉQUENCE ASSUMÉE : `plafond` n'est vérifié QUE localement. Le CI ne lance
 * que la passe large — le travail `polices` du workflow est un relevé, pas une
 * porte. Y ajouter une passe normale demanderait une TROISIÈME colonne, celle
 * d'Ubuntu sans commutateur, pour ne rien garder de plus : une croissance de
 * CONTENU se voit dans les deux passes — le lot de la police des titres a
 * poussé `fr@1280` de 7092 à 7169 en normal ET de 7213 à 7247 en large. Ce que
 * la passe normale garde en propre, c'est la vue du développeur avant qu'il
 * pousse, et cela ne vaut que sur sa machine.
 */
const PLAFONDS = [
  /*
    LES PLAFONDS LARGES ÉTAIENT CALIBRÉS SUR LA MAUVAISE MACHINE.

    Relevé le 2026-09-08, sur le premier CI vert depuis deux jours — les quatre
    mesures de la porte publique, en regard des plafonds qu'elles étaient
    censées avoir posés :

        fr@360    mesure 10197   plafond 10524   327 px de mou
        en@360    mesure  9950   plafond 10285   335 px de mou
        fr@1280   mesure  7247   plafond  7247   exact
        en@1280   mesure  7222   plafond  7291    69 px de mou

    Le motif se lit d'un coup : 10524 est à SIX pixels de la mesure LOCALE
    (10530), 10285 à six de la locale (10291), 7291 à quatre de la locale
    (7295). Ces trois plafonds ont été posés depuis une machine de
    développement, quand l'en-tête de ce fichier et le commentaire du workflow
    disent tous deux que la porte publique fait autorité.

    UN PLAFOND TROP HAUT NE ROUGIT PAS, IL GARDE MOINS BIEN : 327 px sur la page
    mobile, c'est trois pour cent qu'elle pouvait reprendre sans un mot, sur le
    seul écran que voit un visiteur sans compte.

    LE RESSERRAGE N'AJOUTE AUCUN FAUX ROUGE EN LOCAL. `MESURER_EN_POLICE_LARGE=1`
    y rougissait déjà sur ces trois points — 10530, 10291 et 7295 dépassaient
    les anciens plafonds de 6, 6 et 4 px. Ce sont les MÊMES trois qui rougissent
    après, de plus loin. La divergence locale se lit comme telle ; elle ne se
    corrige pas en desserrant.
  */
  { largeur: 360, langue: 'fr', plafond: 10197, plafondLarge: 10197, avant: 9979, avantLe: '2026-08-28', origine: 11419, origineLe: '2026-08-23' },
  { largeur: 360, langue: 'en', plafond: 10058, plafondLarge: 9950, avant: 9862, avantLe: '2026-08-28', origine: 11149, origineLe: '2026-08-23' },
  /*
    +73 px AU BUREAU, ET C'EST LE PRIX D'UNE GRILLE COMPARABLE.

    Les trois paliers partagent désormais leurs rangées — `grid-rows-subgrid` —
    donc chaque bande prend la hauteur de la plus haute des trois. Le palier sur
    devis réserve ainsi la place d'une mention d'arrondi et d'une ligne d'essai
    qu'il n'a pas.

    CE QU'ON ACHÈTE : les cinq lignes de caractéristiques étaient décalées de
    103 px d'une carte à l'autre, dans les deux langues. Une grille de prix se
    lit EN TRAVERS ; désalignée, elle demande au lecteur de faire lui-même le
    rapprochement qu'elle promet, sur la page dont c'est l'unique fonction.

    CE QU'ON A RENDU AVANT DE DEMANDER : `min-h-10` sur l'accroche réservait
    deux lignes à la main pour le même alignement. La rangée partagée le fait
    mieux — hauteur de la plus haute plutôt que minimum posé à l'œil — et rend
    dix-neuf pixels. Le solde net est celui-ci.

    Le mobile ne bouge pas : empilées, les cartes n'ont pas de rangées communes.
  */
  /*
    +34 px EN POLICE LARGE, ET SEUL LE CI POUVAIT LES VOIR.

    `plafondLarge` valait 7213 ; la porte publique mesure 7247 depuis le
    2026-09-07, commit `5c9ca32` — « la police des titres vient du produit ».
    Ce lot-là a remesuré les plafonds NORMAUX, qu'une machine de développement
    voit : fr@1280 y rend 7169 pour un plafond de 7170, exact au pixel. Il n'a
    pas remesuré les plafonds LARGES, que seule la porte publique produit.

    TRENTE-SIX EXÉCUTIONS ROUGES, deux jours durant, avec la MÊME plainte au
    pixel près — 7247 pour 7213, du premier échec au dernier. Ce n'est pas une
    mesure instable : c'est une hauteur nouvelle et constante, celle d'un
    changement de police délibéré, dont le plafond n'avait pas suivi.

    LE NOUVEAU PLAFOND EST LE MESURÉ, SANS MARGE, comme le dit l'en-tête de
    cette table — 7247 et non 7250. La porte publique fait autorité ; aucune
    mesure locale n'entre ici.
  */
  { largeur: 1280, langue: 'fr', plafond: 7169, plafondLarge: 7247, avant: 7092, avantLe: '2026-08-29', origine: 7110, origineLe: '2026-08-23' },
  { largeur: 1280, langue: 'en', plafond: 7244, plafondLarge: 7222, avant: 7166, avantLe: '2026-08-29', origine: 7106, origineLe: '2026-08-23' },
]
/*
  ═══ CE QUE CE RESSERREMENT DIT, ET CE QU'IL NE DIT PAS ═══

  LE TÉLÉPHONE A VRAIMENT MAIGRI, de 1 216 px en français et 1 213 en anglais —
  environ 11 %. Tout vient d'un seul endroit : la grille de tarifs, qui passait
  1 992 px à empiler trois cartes que personne ne pouvait comparer, et qui rend
  désormais une rangée d'onglets portant les trois prix. Le raisonnement est
  dans `PricingSection`, la garde dans `tarifsComparables.test.tsx`.

  LE BUREAU N'A PAS BOUGÉ, et les deux lignes du bas ne sont pas un gain. Elles
  étaient à 7 080 et 7 119 pour un mesuré de 7 017 et 7 091 : soixante-trois et
  vingt-huit pixels de MOU, laissés par un lot antérieur qui avait raccourci la
  page sans redescendre son plafond. Vérifié en remisant ce lot et en remesurant
  — la base valait déjà 7 017 / 7 091 sans lui.

  Les deux corrections sont écrites dans le même diff, mais elles ne sont pas de
  la même nature, et les confondre reviendrait à s'attribuer un gain qu'on n'a
  pas fait. `avant` porte la mesure réelle d'avant ce lot, y compris là où elle
  est égale au plafond : une colonne qui ne bouge pas est une information.

  ═══ LE TÉLÉPHONE REPREND 79 PX, ET C'EST UNE DETTE PAYÉE ═══

  Lot suivant, sens inverse : 9 869 → 9 948 en français, 9 743 → 9 838 en
  anglais. Les deux indicateurs du pied de l'accroche — taux d'occupation et
  reste à percevoir — cessent d'être divisés sans condition en deux colonnes et
  se replient sous un plancher.

  CE QUE LA DIVISION RIGIDE COÛTAIT, mesuré : à 320, deux colonnes de 111 px pour
  « 447 000 FCFA » qui en réclame 129 — le montant sortait de sa boîte de 18 px.
  À 360, 131 px pour 129 : deux pixels, ce qui n'est pas une marge. Le montant est
  composé par `Intl` avec des espaces insécables ; on ne le coupe pas, on lui rend
  la place.

  Quatre-vingts pixels sur près de dix mille, contre un montant qui débordait aux
  deux largeurs les plus étroites du marché visé. La page n'a pas grandi par
  négligence : elle a payé une dette que le plafond, seul, aurait laissée courir —
  il ne mesure qu'une somme, et une somme ne dit rien de ce qui déborde dedans.

  ═══ TRENTE ET UN PIXELS DE PLUS POUR UN SIGNE QUI SE VOIT ═══

  Lot suivant : 9 948 → 9 979 en français, 9 838 → 9 862 en anglais. Le dépliant
  de chaque question était un chevron de 18 px en `text-muted` — la teinte des
  textes SECONDAIRES, pour le seul signe qui dise « ceci s'ouvre ». Il devient un
  rond d'accent plein de 36 px, et la rangée passe de 56 à 68 px : douze pixels
  par question, cinq questions.

  On paie donc six pixels par question, et c'est le sens de l'échange : sur un
  téléphone, l'affordance de dépliement est ce que le doigt cherche, et un
  chevron gris de 18 px n'est pas ce qu'on trouve. Le pied, lui, a maigri de
  484 à 380 px — mais au-delà de `sm` seulement, où ses liens se replient en deux
  colonnes ; à 360 ils restent empilés, deux cibles de 44 px côte à côte dans
  360 px de fenêtre étant précisément ce que le plancher existe pour éviter. Le
  gain ne compense donc pas ici, et il ne doit pas.

  AU BUREAU, EN REVANCHE, LE PIED REND 44 px — et cette fois c'est bien un gain
  de ce lot, contrairement au resserrement précédent qui n'était que du mou.
  Vérifié : les deux largeurs de 1280 passent de 7 017 et 7 091 à 6 973 et 7 047,
  et rien d'autre n'y a changé.

  ═══ +230 px À 360, +119 AU BUREAU : TROIS SECTIONS ENRICHIES ═══

  Lot suivant, et c'est la plus forte hausse depuis la refonte. Elle est
  DEMANDÉE : trois sections dont le défaut était d'être maigres.

    LES QUATRE FRICTIONS — le numéro passe de `text-caps` à `text-kpi`, soit de
    douze à vingt-six pixels, et la carte gagne un filet d'accent de 4 px. Le
    chiffre était rendu au rang d'un SURTITRE, c'est-à-dire de ce qui nomme une
    section, alors qu'il ne nomme rien : il compte. À 360 les quatre cartes
    s'empilent, donc l'écart s'y multiplie par quatre.

    LES TROIS CHIFFRES DE COUVERTURE — les valeurs deviennent des gélules
    bordées. Quatre noms de pays posés côte à côte se repliaient en deux lignes
    ragées où « Congo-Brazzaville Tchad » se lisait comme une seule entrée. Une
    bordure par valeur rend le compte VISIBLE, au prix d'un rembourrage.

    LA CLÔTURE — l'appel est borné par un panneau. Il partageait l'encre du pied
    sans rien entre eux : le lecteur arrivait au bout de la page devant une masse
    indistincte. Le panneau coûte son rembourrage, et c'est ce rembourrage qui
    fait exister la limite.

  Deux virgule trois pour cent à 360. La page reste à 1 210 px sous son état
  d'avant la refonte, et c'est le seul repère qui compte ici : ce plafond garde
  une somme, il ne dit rien de ce que cette somme achète.
*/
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS `PLAFONDS.length`.

  Le dériver de la liste surveillée rend la garde d'accord avec elle-même :
  vider `PLAFONDS`, et l'inspection compare 0 à 0 puis se déclare verte. La même
  mutation a trouvé ce piège quatre lots de suite.

  4 = deux largeurs × deux langues.
*/
const ATTENDUS = 4

/**
 * LE NOMBRE DE SECTIONS, GARDÉ AVEC LA HAUTEUR.
 *
 * Sans lui, la façon la plus simple de passer sous le plafond serait de
 * SUPPRIMER une section — la page raccourcirait et la garde applaudirait. Ce
 * n'est pas ce qu'on veut : on veut la même page, plus dense. Le compte est
 * écrit, pas dérivé.
 */
/**
 * UN PLAFOND, DEUX POLICES — comme `plafond-coquille` et `modales`.
 *
 * `system-ui` designe un dessin different par systeme : « Creer mon espace »
 * rend 132,61 px sur macOS, 146,14 sur l'executeur Ubuntu ou il vaut DejaVu
 * Sans. Une page faite de texte est plus haute quand le texte est plus large —
 * de 315 px en francais a 360, de 43 a 1280.
 *
 * CE N'EST PAS UN DEFAUT : les huit sections sont la, la grille de prix se lit
 * toujours en travers, et l'action reste a 504 px du haut. C'est un COUT, et le
 * garder sous un plafond unique reviendrait soit a donner du mou a la mesure
 * locale, soit a refuser une page correcte. Les deux valeurs sont MESUREES.
 */
const SECTIONS_ATTENDUES = 8

/** Le plafond effectif, selon la police imposee — et une entree sans son second
 *  plafond ne passe pas en silence. */
/**
 * LA MACHINE QUI TOURNE POSSÈDE-T-ELLE LA COLONNE EN VIGUEUR ?
 *
 * Sans commutateur, le plafond en force est `plafond`, mesuré ici : la machine
 * de développement le possède. Avec le commutateur ET sous `CI`, c'est
 * `plafondLarge`, que la porte publique possède. Le troisième cas — le
 * commutateur lancé à la main sur une machine de développement — est un
 * DIAGNOSTIC : les nombres y sont ceux d'une autre machine, et rien de ce qu'on
 * y lit ne juge un plafond.
 */
const COLONNE_A_NOUS = !POLICE_LARGE || Boolean(process.env.CI)

function plafondDe(point) {
  if (!POLICE_LARGE) return point.plafond
  if (typeof point.plafondLarge !== 'number') {
    console.error(
      `\n✗ plafond-vitrine : le point ${point.langue}@${point.largeur} n'a pas de \`plafondLarge\`.\n`,
    )
    exit(1)
  }
  return point.plafondLarge
}

/**
 * LA FAMILLE D'AFFICHAGE, ET POURQUOI SON ABSENCE DOIT ARRÊTER LE RELEVÉ.
 *
 * LE DÉFAUT, MESURÉ LE 2026-08-30. Ce script attend `networkidle` puis 800 ms,
 * et le `.catch(() => {})` posé sur cette attente AVALE l'échec. Réseau coupé —
 * intégration continue, pare-feu, train — la requête vers `fonts.googleapis.com`
 * meurt, la page rend ses titres dans la pile système, et le relevé sortait
 * quand même. Sur `/` à 360 px en français, avec exactement l'attente de ce
 * script, les deux origines de police routées vers `abort()` contre servies :
 *
 *   police servie   10191 px de document, h1 de 157 px, 4 faces
 *   police bloquée  10152 px de document, h1 de 118 px, 0 face
 *
 * Trente-neuf pixels, et ils viennent d'une ligne de titre en moins : la sans de
 * la fonderie est plus large que la pile système, donc l'accroche française se
 * replie une fois de plus avec elle que sans elle.
 *
 * UN POINT SUR QUATRE BOUGE, ET IL FAUT LE DIRE. Aux trois autres — en@360,
 * fr@1280, en@1280 — les deux relevés sont IDENTIQUES au pixel : 10052, 7165 et
 * 7240 dans les deux conditions. Les titres y tiennent sur le même nombre de
 * lignes avec l'une ou l'autre police, et une hauteur de ligne est portée par le
 * jeton, pas par la fonte. Cette garde n'attrape donc pas un écart permanent :
 * elle attrape le point, et le jour, où un titre se replie autrement.
 *
 * AUCUN VERDICT NE S'INVERSE AUJOURD'HUI, et l'écrire est le seul moyen de ne
 * pas vendre cette garde plus cher qu'elle ne vaut. À fr@360, 10191 comme 10152
 * passent sous le plafond de 10209. Le danger n'est pas le verdict : c'est la
 * RÉINSCRIPTION. Un plafond relevé depuis une exécution sans police vaudrait ici
 * 10152 ; la vraie page en fait 10191, et la porte rougirait ensuite POUR
 * TOUJOURS sur une vitrine dont rien n'aurait bougé. C'est ce que dit le message
 * de refus, et c'est la vraie dette que cette garde éteint.
 *
 * LE SENS DE L'ÉCART N'EST PAS UNE PROPRIÉTÉ DU MONDE. Il dépend du couple
 * famille/repli, donc d'un choix de marque, et il a déjà changé de signe dans ce
 * dépôt : du temps de Source Serif 4 sur un repli Georgia, la page SANS police
 * était plus HAUTE — l'absence de police faisait rougir ce script en désignant
 * la vitrine. Aujourd'hui elle est plus BASSE. Une garde calibrée sur le signe
 * observé un jour donné se serait retournée à la refonte typographique suivante.
 *
 * D'OÙ LE REFUS PLUTÔT QUE LA COMPARAISON. On ne compare pas la hauteur à son
 * plafond quand la police manque : le verdict porterait sur une page que
 * personne ne voit, et il peut se tromper dans les deux sens selon la fonderie
 * du moment. Le point n'est pas non plus compté comme inspecté — absence de
 * mesure valable, et non mesure sans défaut, ce que `ATTENDUS` fait alors
 * remonter tout seul.
 *
 * LE SEUL TÉMOIN QUI TRANCHE, et trois candidats mentent. Essayés dans les deux
 * conditions ci-dessus, sur cette base :
 *   — `getComputedStyle(h1).fontFamily` rend la DÉCLARATION, identique au
 *     caractère près : c'est le nom demandé, jamais le nom servi ;
 *   — `document.fonts.status` vaut `'loaded'` des deux côtés — il dit que plus
 *     rien n'est en vol, pas que quelque chose est arrivé ;
 *   — `document.fonts.check('700 40px "Plus Jakarta Sans"')` rend `true` des
 *     deux côtés : il répond sur la capacité à PEINDRE le texte, or le repli en
 *     est parfaitement capable.
 * Reste `document.fonts` lui-même, qui n'est peuplé que des faces réellement
 * livrées par la feuille de la fonderie : 4 contre 0.
 *
 * LA FAMILLE EST ÉCRITE ICI, ET NON LUE DANS `--font-display`. La dériver du
 * jeton reviendrait à demander à la page sous mesure ce qu'elle doit prouver :
 * renommer le jeton sans toucher au `<link>` d'`index.html` rendrait la garde
 * d'accord avec elle-même. C'est le piège que `ATTENDUS` documente déjà deux
 * écrans plus haut. Changer de fonderie oblige donc à récrire cette ligne, donc
 * à le dire dans un diff.
 *
 * CE QU'ELLE NE VOIT PAS : une police qui arrive mais DIFFÈRE de celle qu'on
 * croyait — graisse tronquée, sous-ensemble amputé, axe absent. Elle constate
 * qu'une face de ce nom est chargée, ce qui est vérifiable ; elle ne compare
 * aucun dessin.
 */
const FAMILLE_ATTENDUE = 'Plus Jakarta Sans'

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`, qui porte les trois cas mesurés. */
exigerUnPaquetAJour()


const serveur = await servirLaPrevisualisation('plafond-vitrine', PORT)
const plaintes = []
const releve = []
let inspectes = 0
/* Combien de points ont vu leurs portes d'entrée comptées — voir leur garde. */
let portesMesurees = 0

try {
  const navigateur = await chromium.launch()
  for (const point of PLAFONDS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: point.largeur, height: 800 },
      locale: point.langue === 'fr' ? 'fr-FR' : 'en-US',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
    const page = await contexte.newPage()
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('gestloc.lang', l)
      } catch {
        /* stockage refusé : la langue reste celle du contexte */
      }
    }, point.langue)
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)

    const m = await page.evaluate((famille) => {
      /* Les faces RÉELLEMENT livrées, seule source qui distingue une police
         arrivée d'une police attendue — voir `FAMILLE_ATTENDUE`. */
      const faces = [...document.fonts]
      const main = document.querySelector('main')
      /* La première action visible du contenu : c'est elle qu'un visiteur doit
         atteindre sans défiler longtemps. */
      const cta = [...main.querySelectorAll('a')].find((a) => {
        const s = getComputedStyle(a)
        const r = a.getBoundingClientRect()
        return s.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.height > 20
      })
      /*
        LES TROIS PALIERS SE COMPARENT LIGNE À LIGNE, OU NE SE COMPARENT PAS.

        Une grille de prix existe pour qu'on lise EN TRAVERS : « Relances » chez
        l'un, en face de « Relances » chez les deux autres. Mesuré avant ce lot :
        les cinq lignes de caractéristiques étaient à cinq hauteurs différentes
        d'une carte à l'autre — le bloc de prix n'a pas la même hauteur partout
        (la mention d'arrondi n'existe que sur un palier, l'essai n'existe pas
        sur celui qui est sur devis), et tout ce qui suit glissait d'autant.

        L'œil doit alors faire le rapprochement lui-même, sur la page dont c'est
        l'unique fonction.

        On ne mesure QU'EN TROIS COLONNES : empilées, les cartes n'ont pas de
        rangées communes et la question ne se pose pas.
      */
      const grille = document.querySelector('[data-mesure="tarifs-grille"]')
      const cartes = grille ? [...grille.querySelectorAll('article')] : []
      const enColonnes =
        cartes.length === 3 &&
        Math.abs(
          cartes[0].getBoundingClientRect().top - cartes[2].getBoundingClientRect().top,
        ) < 40
      const desalignees = []
      let rangsCompares = 0
      if (enColonnes) {
        const listes = cartes.map((c) => [...c.querySelectorAll('ul > li')])
        const rangs = Math.min(...listes.map((l) => l.length))
        for (let k = 0; k < rangs; k++) {
          const hauts = listes.map((l) => l[k].getBoundingClientRect().top)
          rangsCompares++
          const ecart = Math.round(Math.max(...hauts) - Math.min(...hauts))
          if (ecart > 1)
            desalignees.push({
              rang: k + 1,
              libelle: (listes[0][k].textContent || '').trim().slice(0, 28),
              ecart,
            })
        }
      }

      return {
        hDoc: document.documentElement.scrollHeight,
        sections: main ? main.children.length : 0,
        actionY: cta ? Math.round(cta.getBoundingClientRect().top + window.scrollY) : null,
        enColonnes,
        rangsCompares,
        desalignees,
        policeChargee: faces.some((f) => f.family === famille && f.status === 'loaded'),
        faces: faces.length,
      }
    }, FAMILLE_ATTENDUE)

    /*
      LA POLICE D'ABORD, AVANT LA FAQ ET AVANT LE PLAFOND.

      Tout ce qui suit se mesure en pixels, et ces pixels ne veulent dire quelque
      chose que si la page rendue est celle du visiteur. On ferme le contexte, on
      se plaint, et l'on passe : le point n'est PAS compté comme inspecté, et sa
      hauteur n'est comparée à aucun plafond.
    */
    if (!m.policeChargee) {
      await contexte.close()
      releve.push({ nom: `${point.langue}@${point.largeur}`, ...m, ...point, repli: true })
      plaintes.push(
        `${point.langue}@${point.largeur} : aucune face chargée de « ${FAMILLE_ATTENDUE} » ` +
          `(${m.faces} face(s) dans document.fonts).\n` +
          `   Les titres ont été rendus dans le repli, et les ${m.hDoc} px relevés sont ceux de\n` +
          '   CETTE page-là, pas de la vitrine. Ne les lisez ni comme un plafond tenu ni comme\n' +
          '   un dépassement : ils ne disent rien, dans aucun des deux sens.\n' +
          '   Cause la plus probable : le fichier de `public/polices/` n\'a pas été servi — paquet\n' +
          "   construit sans lui, ou chemin changé. Rétablissez-le et remesurez ; ne réinscrivez\n" +
          '   JAMAIS un plafond depuis une exécution sans police.',
      )
      continue
    }
    /*
      UNE QUESTION OUVERTE EN FERME UNE AUTRE.

      Mesuré APRÈS la hauteur du document, et il le faut : ouvrir un repli
      allonge la page, et mesurer le plafond sur une FAQ dépliée mesurerait
      autre chose que ce qu'un visiteur voit en arrivant.

      La règle n'est pas décorative. Cinq réponses ouvertes en même temps
      poussent la suivante hors de l'écran : on cherche la question n° 4 en
      faisant défiler trois réponses qu'on a déjà lues. Un accordéon exclusif
      garde la LISTE lisible, qui est ce qu'on parcourt.

      Le geste est celui de l'utilisateur — deux clics sur deux résumés — et non
      la lecture d'un attribut : `name` sur `<details>` est l'accordéon exclusif
      du standard, mais c'est son EFFET qu'on garde, pas son orthographe.
    */
    const resumes = page.locator('#faq details > summary')
    let ouvertes = null
    if ((await resumes.count()) >= 2) {
      await resumes.nth(0).click()
      await page.waitForTimeout(200)
      await resumes.nth(1).click()
      await page.waitForTimeout(200)
      ouvertes = await page.evaluate(
        () => [...document.querySelectorAll('#faq details')].filter((d) => d.open).length,
      )
    }
    /*
      LES DEUX PORTES DU PRODUIT SONT-ELLES ATTEIGNABLES ?

      « Se connecter » et « Créer un compte » sont les seules entrées, et cet
      écran est celui qui décide si le visiteur en ouvre une. Les compter EN
      NAVIGATEUR, jamais en cas : la barre les cache par du CSS —
      `hidden … sm:flex` — que jsdom n'applique pas. Sous jsdom les deux boutons
      de la barre sont TOUJOURS dans le DOM, à toute largeur, et aucun cas ne
      peut donc distinguer un téléphone d'un bureau.

      DEUX CHEMINS, UN SEUL EXIGÉ. Au-dessus de `sm` la barre les porte ; en
      deçà, elle les cache et c'est le PANNEAU qui les reprend. On ouvre donc le
      panneau quand rien n'est visible, et l'on n'exige qu'une chose : qu'après
      ce geste, un visiteur puisse cliquer.

      MESURÉ le 2026-09-08. En forçant `barrePorteLesBoutons` à vrai — la barre
      croit les porter, le panneau ne les reprend plus, le CSS les cache quand
      même :

          320 px   0 visible barre fermée · 0 visible PANNEAU OUVERT
          375 px   0 visible barre fermée · 0 visible PANNEAU OUVERT
          700 px   2 visibles
         1280 px   2 visibles

      Sur un téléphone, les deux portes disparaissaient. Les 2000 cas et les
      quinze portes navigateur restaient VERTS.
    */
    const portes = await (async () => {
      const compter = () =>
        page.evaluate(() => {
          const entete = document.querySelector('header')?.parentElement ?? document.body
          const liens = [...entete.querySelectorAll('a[href="/connexion"], a[href="/inscription"]')]
          return liens.filter((a) => {
            if (a.closest('main') || a.closest('footer')) return false
            const r = a.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== 'hidden'
          }).length
        })
      const barre = await compter()
      if (barre > 0) return { visibles: barre, geste: 'barre' }
      /* Rien dans la barre : c'est le repli attendu sous `sm`, et le panneau
         doit alors les porter. On l'ouvre comme un visiteur le ferait. */
      const declencheur = page.locator('header button[aria-expanded]').first()
      if ((await declencheur.count()) === 0) return { visibles: 0, geste: 'aucun panneau' }
      await declencheur.click().catch(() => {})
      await page.waitForTimeout(300)
      return { visibles: await compter(), geste: 'panneau' }
    })()

    await contexte.close()

    const nom = `${point.langue}@${point.largeur}`
    inspectes++
    releve.push({ nom, ...m, ...point, ouvertes })

    if (ouvertes === null) {
      plaintes.push(
        `${nom} : moins de deux questions dépliables dans la FAQ — rien à mesurer.\n` +
          "   Une sonde qui ne trouve pas son sujet ne prouve pas qu'il va bien.",
      )
    } else if (ouvertes !== 1) {
      plaintes.push(
        `${nom} : ${ouvertes} question(s) ouverte(s) après avoir déplié la seconde.\n` +
          '   Une réponse lue devrait se replier quand on en ouvre une autre : empilées, elles\n' +
          '   poussent les questions suivantes hors de l’écran, et c’est la LISTE qu’on parcourt.',
      )
    }

    const plafond = plafondDe(point)
    /*
      UN PLAFOND AU-DESSUS DE SA MESURE ROUGIT AUSSI, et cette moitié manquait.
      « Le plafond est le MESURÉ, sans marge » était écrit en prose et appliqué
      NULLE PART : le script refusait le dépassement, jamais le mou.

      C'est ce silence qui a laissé trois `plafondLarge` sur quatre calibrés sur
      la mauvaise machine — jusqu'à 327 px que la page mobile pouvait reprendre
      sans un mot. Un plafond trop haut ne rougit pas, il garde moins bien, et
      il ne se voit que si on le cherche.

      MARGE ZÉRO, et c'est mesuré, non choisi : les deux colonnes sont
      reproductibles au pixel sur la machine qui les possède — deux passes
      normales identiques ici, deux passes larges identiques sur la porte
      publique. Toute tolérance serait un nombre qu'aucune mesure ne justifie.

      LE PRIX EST DIT : une page qui RÉTRÉCIT fait désormais rougir cette porte,
      et il faut récrire la ligne. C'est voulu — les 327 px sont entrés par là,
      un lot à la fois, sans que personne ait à rien récrire.
    */
    if (COLONNE_A_NOUS && plafond > m.hDoc) {
      plaintes.push(
        `${nom} : ${plafond - m.hDoc} px de MOU — le plafond (${plafond}) est au-dessus\n` +
          `   de la mesure (${m.hDoc}). Il ne refuse donc plus ce qu'il prétend refuser.\n` +
          '   Récrivez la ligne avec la mesure, et dites dans le diff ce qui a raccourci\n' +
          '   la page. Le plafond est le MESURÉ, sans marge.',
      )
    }
    if (m.hDoc > plafond) {
      plaintes.push(
        `${nom} : ${m.hDoc} px de document pour un plafond de ${plafond}.\n` +
          `   ${point.avant} le ${point.avantLe}. ${point.origine} le ${point.origineLe}, avant la refonte.\n` +
          "   C'est le seul écran que voit un visiteur sans compte, et celui qui décide\n" +
          "   s'il en ouvre un.",
      )
    }
    if (m.sections !== SECTIONS_ATTENDUES) {
      plaintes.push(
        `${nom} : ${m.sections} section(s) pour ${SECTIONS_ATTENDUES} attendue(s).\n` +
          '   Raccourcir la page en lui retirant une section n’est pas la densifier.',
      )
    }
    if (m.actionY === null) {
      plaintes.push(`${nom} : aucune action principale trouvée dans le contenu.`)
    }
    if (portes.visibles === 0) {
      plaintes.push(
        `${nom} : AUCUNE porte d'entrée atteignable dans l'en-tête — ` +
          `« Se connecter » ni « Créer un compte » (${portes.geste}).\n` +
          "   Ce sont les deux seules entrées du produit, sur le seul écran que voit un\n" +
          "   visiteur sans compte. La barre les cache par CSS sous `sm` ; si le panneau\n" +
          '   ne les reprend pas, elles ne sont NULLE PART.',
      )
    }
    portesMesurees += 1
    for (const d of m.desalignees) {
      plaintes.push(
        `${nom} : la ligne ${d.rang} des paliers — « ${d.libelle} » — est décalée de ${d.ecart} px\n` +
          "   d'une carte à l'autre. Une grille de prix se lit EN TRAVERS ; désalignée, elle\n" +
          '   demande au lecteur de faire lui-même le rapprochement qu’elle promet.',
      )
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

if (inspectes === 0) {
  plaintes.push(
    "AUCUN état inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} état(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}
/* GARDE DU GARDE — les portes ont-elles été comptées partout ? Une règle qui
   n'exige QUE « pas zéro visible » se tait aussi quand elle n'a rien regardé. */
if (portesMesurees !== ATTENDUS) {
  plaintes.push(
    `${portesMesurees} point(s) ont vu leurs portes d'entrée comptées pour ${ATTENDUS} attendu(s).`,
  )
}

for (const r of releve) {
  /* Le nombre est montré parce que le taire ferait croire à une panne de sonde,
     mais il est nommé pour ce qu'il est : un relevé de repli, sans valeur. */
  if (r.repli) {
    console.log(
      `  ${r.nom.padEnd(10)} ${String(r.hDoc).padStart(6)} px  RELEVÉ DE REPLI, sans valeur — ` +
        `« ${FAMILLE_ATTENDUE} » n'était pas là (plafond ${r.plafond}, NON comparé).`,
    )
    continue
  }
  console.log(
    `  ${r.nom.padEnd(10)} ${String(r.hDoc).padStart(6)} px  (plafond ${String(plafondDe(r)).padStart(6)} · ` +
      `${String(r.avant).padStart(6)} le ${r.avantLe} · ${String(r.origine).padStart(6)} le ${r.origineLe})  ` +
      `${r.sections} sections · action à ${r.actionY} px`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-vitrine : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ plafond-vitrine : ${inspectes}/${ATTENDUS} états sous leur plafond, ${SECTIONS_ATTENDUES} sections intactes,\n` +
  `  « ${FAMILLE_ATTENDUE} » chargée sur chacun — le relevé porte donc sur la vraie page.\n` +
  `  ${releve.reduce((n, r) => n + (r.rangsCompares ?? 0), 0)} rangée(s) de paliers comparées d'une carte à l'autre,\n` +
  `  toutes ALIGNÉES — une grille de prix se lit en travers.\n` +
  `  FAQ dépliée deux fois sur ${releve.length} états : une seule réponse ouverte à la fois.\n` +
    "  Ce script garde une SOMME, pas une composition, et ne dit rien de la lisibilité —\n" +
    '  voir son en-tête.',
)
