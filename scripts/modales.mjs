#!/usr/bin/env node
/**
 * LES MODALES TIENNENT DANS LA FENÊTRE, ET LEUR ACTION RESTE SOUS LES YEUX.
 *
 * TROIS DÉFAUTS MESURÉS, ET LE PLUS GRAVE NE VENAIT PAS DU CONTENU.
 *
 * 1. LE BLOC CONTENEUR VOLÉ. Le conteneur de la modale est `fixed inset-0` : il
 *    devrait couvrir la fenêtre. Il ne le faisait pas. `<main>` porte
 *    `animate-rise`, et une animation de `transform` laisse au repos une matrice
 *    IDENTITÉ — qui est une transformation. Un ancêtre transformé devient le
 *    bloc conteneur de ses descendants `position: fixed`. Relevé sur « Ajouter
 *    un immeuble », fenêtre de 900 px : la boîte se posait à y = 554 et
 *    finissait à 941, quarante et un pixels SOUS le bord. Le pied — donc
 *    l'action principale — était coupé, sur les vingt états mesurés.
 * 2. LES CARTES POUR UN MOT. « Ouvrir un chantier » rendait six corps de métier
 *    et trois urgences en tuiles pleine largeur, toutes avec `description: ''`
 *    et sans icône : 1517 px de contenu pour une fenêtre de 484, soit 1033 px
 *    de défilement pour neuf mots.
 * 3. UNE SEULE COLONNE À TOUTE LARGEUR. Sept champs empilés sur un écran de
 *    bureau, quand deux d'entre eux se lisent comme une paire.
 *
 * CE QUE CE SCRIPT MESURE. Il OUVRE chaque modale déclarée, aux deux largeurs
 * et dans les deux langues, puis vérifie quatre choses :
 *   — la boîte tient ENTIÈREMENT dans la fenêtre (bords compris, pas seulement
 *     la hauteur : c'est la distinction que le premier relevé avait ratée) ;
 *   — le pied reste visible corps en HAUT **et** corps en BAS ;
 *   — le corps ne demande pas plus de défilement qu'un plafond écrit ;
 *   — l'en-tête et le pied ne défilent pas avec le corps.
 *
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE — c'est la règle enfreinte à sa
 * première rédaction, qui inspectait CINQ modales sur douze en annonçant
 * « 20 états » :
 *
 *   — PLUS AUCUNE MODALE N'ÉCHAPPE À CE FICHIER, et c'est récent. Deux d'entre
 *     elles — `ParkSettingsModal`, puis `TariffsModal` — avaient leur bouton
 *     gardé par `adhesionActive`, c'est-à-dire par un COMPTE RÉEL : en
 *     démonstration l'adhésion est nulle, le bouton n'était pas rendu, et leur
 *     géométrie n'était mesurée par personne.
 *
 *     La même confusion dans les deux cas : « personne à qui écrire » — vrai
 *     d'un compte connecté sans parc — et « rien ne s'écrit » — vrai de la
 *     démonstration, comme de tous les gestes de leurs écrans. Les deux suivent
 *     désormais le rôle ACTIF.
 *
 *     Le second examen a rapporté un défaut de PRODUCTION que le premier n'avait
 *     pas : l'historique des prix datait chaque ligne d'un mois de trop, et la
 *     même conversion fautive servait la date de règlement d'une quittance.
 *
 *     `clavierDesModales.test.tsx` LES COUVRE TOUTES LES DEUX depuis.
 *
 *   — le CLAVIER. Piège de focus, Échap, retour du focus : ce sont les cas de
 *     `clavierDesModales.test.tsx`, joués sous jsdom où la tabulation est
 *     simulée fidèlement, et qui couvrent désormais les DOUZE. Les rejouer ici
 *     doublerait la couverture sans rien ajouter ;
 *
 *   — la PERTINENCE d'un champ, l'ordre des questions, le bien-fondé d'un
 *     libellé. Aucune garde ne sait cela, et celle-ci ne prétend pas le savoir ;
 *
 *   — ce que devient la modale au-delà de 1280 px, et entre 360 et 1280. Deux
 *     largeurs, choisies parce que la boîte a deux formes — feuille collée en
 *     bas sous `sm`, boîte centrée au-delà — et non parce que deux suffisent.
 *
 *   node scripts/modales.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici — ce script ne connaît que des rectangles.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
/* La MÊME sonde que `mesure-ui` et `espace-connecte`, bornée au dialogue. */
import {
  MESURER_CIBLES,
  MESURER_GABARITS,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
} from './sondes-de-rendu.mjs'
import { readFileSync } from 'node:fs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * L'AUDIT DE CONTRASTE, LU ET NON RECOPIÉ — le même fichier que la console,
 * `mesure-ui` et `espace-connecte`. Sa racine est posée sur le dialogue par
 * `__AUDIT_RACINE__` avant l'évaluation : lu sur le document, il verrait la page
 * derrière — que les deux autres portes tiennent déjà.
 */
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')
const PORT = 4192
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES MODALES INSPECTÉES, ET COMMENT ON LES OUVRE.
 *
 * Par le RÔLE et le nom accessible du bouton, jamais par une classe : c'est ce
 * qui fait que l'inspection survit à une refonte de la mise en page et meurt à
 * une refonte du vocabulaire — ce qui est le bon sens de la dépendance.
 *
 * Le plafond de défilement est ÉCRIT par modale, avec la mesure d'avant à côté.
 * Zéro n'est pas la cible : sept champs sur un téléphone défilent, et vouloir
 * l'interdire ferait rétrécir les champs ou disparaître l'aide. Ce qu'on refuse
 * est le défilement qui n'achète rien.
 */
const MODALES = [
  /*
    PARKSETTINGS ENTRE DANS LA LISTE, ET C'EST UNE DETTE QUI SE LÈVE.

    Elle était comptée sous `NON_OUVRABLES` : son bouton était gardé par
    `adhesionActive`, c'est-à-dire par un COMPTE RÉEL, donc rien ne la rendait en
    démonstration et sa géométrie n'était mesurée par personne. L'en-tête de ce
    fichier annonçait la levée « le jour où la démonstration portera une adhésion
    fictive » ; ce n'est pas le chemin qui a été pris, et il vaut mieux.

    La condition confondait deux choses : « personne à qui écrire » — vrai d'un
    compte sans parc — et « rien ne s'écrit » — vrai de la démonstration, comme
    de TOUS les gestes de cet écran. Le bouton suit désormais le rôle ACTIF, et
    la modale, qui savait déjà qu'elle n'avait pas de parc, le DIT au lieu de ne
    rien faire.

    Ce qu'on y a trouvé le jour où elle s'est ouverte : ses deux listes
    déroulantes n'avaient pas d'option vide, donc elles affichaient la première —
    « Belgique » et « FCFA — Afrique centrale ». L'écran écrit pour réparer un
    pays déduit du premier de la liste le rejouait dans son propre formulaire.
    Personne ne pouvait le voir, faute de pouvoir l'ouvrir.
  */
  /*
    LE PLAFOND DE 48, ET CE QU'IL ACHÈTE.

    Première mesure de cette modale, à 360 px, en français : 35 px de défilement
    et « pied — » au relevé, c'est-à-dire une action QUI S'EN VA AVEC LE CORPS.
    Elle était la seule des onze dans ce cas — son bouton vivait sous les quatre
    champs au lieu du pied.

    Le bouton épinglé, le défilement MONTE à 48 : le pied prend la hauteur que le
    corps n'a plus. Ces treize pixels sont exactement le prix de la règle que ce
    fichier porte dans son titre — « leur action reste sous les yeux » — et c'est
    le meilleur des deux échanges : un corps qui défile de 48 px sur un écran de
    780 est un corps normal, une action qu'on doit aller chercher ne l'est pas.

    On n'a PAS raboté les indications des champs pour rentrer sous zéro. Elles
    disent ce que le pays suggère, ce que la devise engage et ce que la
    délégation borne — sur l'écran où une erreur se paie en relisant tous les
    montants du parc dans la mauvaise unité.

    `avant` porte le 35 : il ne dit pas « ce lot a coûté », il dit d'où l'on
    vient et pourquoi le nombre a grandi.
  */
  /*
    TARIFFS ENTRE À SON TOUR, ET SON EXAMEN A RAPPORTÉ PLUS QUE LE PRÉCÉDENT.

    Sa garde avait la même forme que celle de la correction du parc — `role ===
    'owner' && adhesionActive !== null` — et le même motif écrit : « la
    démonstration n'a pas de parc à qui écrire ». Même confusion, même remède.

    MAIS SON CAS ÉTAIT PIRE. L'écran des relevés AFFICHE les deux prix de la
    démonstration, en indicateurs, lus sur ses relevés. La modale qui existe
    pour les montrer et les poser était inatteignable — et, ouverte telle
    quelle, aurait affiché « aucun prix posé » : l'éditeur des prix démentant, à
    un clic, la page qui les affiche. Elle sert donc en démonstration les prix
    de la démonstration, dérivés de la même constante que les relevés.

    ET C'EST EN L'OUVRANT QU'ON A VU LE DÉFAUT DE PRODUCTION : son historique
    datait chaque prix d'un MOIS DE TROP. La conversion `AAAA-MM-JJ` vers les
    parties de date était recopiée quatre fois dans le dépôt, et trois copies
    oubliaient que les mois y sont indexés à partir de zéro — la quittance et
    l'état des lieux frais étaient touchés aussi. Voir `lib/datesISO.test.ts`.
  */
  /*
    LE PLAFOND DE 11, ET CE QU'IL NE GARDE PAS.

    Onze pixels à 360 px, dans les deux langues, pied tenu : c'est la dernière
    ligne de l'HISTORIQUE des prix qui dépasse. Trois champs et deux lignes de
    liste, sur un écran de 780 — la modale est courte, et son action ne bouge pas.

    CE CHIFFRE NE VAUT QUE POUR LA DÉMONSTRATION, et il faut le dire : la
    longueur de l'historique dépend des DONNÉES. La démonstration en porte deux
    lignes ; un parc qui aurait redaté ses prix vingt fois en porterait vingt, et
    le corps défilerait d'autant. Ce plafond garde la forme de la modale, pas
    celle d'un parc — aucune porte de ce dépôt ne visite un parc réel.
  */
  { nom: 'Tariffs', adresse: '/demo/releves', bouton: /^Prix de refacturation$|^Rebilling prices$/, defil: { 360: 11, 1280: 0 }, defilLarge: { 360: 76, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'ParkSettings', adresse: '/demo/parc', bouton: /^Corriger le parc$|^Correct the park$/, defil: { 360: 48, 1280: 0 }, defilLarge: { 360: 48, 1280: 0 }, avant: { 360: 35, 1280: 0 } },
  { nom: 'AddBuilding', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$|^Add a building$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'AddUnit', adresse: '/demo/parc', bouton: /^Ajouter un logement$|^Add a unit$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'OpenWork', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$|^Open a job$/, defil: { 360: 130, 1280: 0 }, defilLarge: { 360: 138, 1280: 0 }, avant: { 360: 1056, 1280: 913 } },
  { nom: 'RecordPayment', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$|^Record a payment$/, defil: { 360: 460, 1280: 40 }, defilLarge: { 360: 493, 1280: 47 }, avant: { 360: 522, 1280: 236 } },
  /*
    LE PLAFOND DE 0 ÉTAIT VACUEUX, et ce script vient de le prouver en rougissant.

    En démonstration, cette modale n'affichait rien : elle demandait son document
    au serveur, et il n'y a pas de parc serveur sous `/demo`. Elle rendait donc
    le mot « Chargement… », qui tient dans n'importe quelle fenêtre — d'où un
    plafond de zéro mesuré sur une modale VIDE, et une garde qui gardait le
    squelette d'une pièce plutôt que la pièce.

    Elle compose désormais son document localement, ET l'aperçu montre ce que la
    feuille montre : le détail poste par poste — loyer, eau, électricité —, le
    reste dû quand il existe, le statut, l'imputation des versements partiels.
    L'aperçu s'arrêtait à trois montants ; le fichier promettait pourtant que
    « ce qu'on voit ici est ce qui sortira ».

    91 px À 360 px, ET CE QU'ILS ACHÈTENT. Le détail est ce qu'un locataire
    conteste, le statut ce qu'un gestionnaire vérifie avant de remettre la
    pièce. Ce n'est donc pas « du défilement qui n'achète rien » : c'est le
    document. Le rythme a d'abord été resserré — `gap-5` au lieu de `gap-6`,
    comme se compose un relevé bancaire — ce qui a rendu 22 px des 113 mesurés
    à la première rédaction.

    ET LES ACTIONS NE DÉFILENT PAS : le pied de la modale est fixe, donc
    « Télécharger » et « Imprimer » restent atteignables sans lire la pièce.
    C'est ce qui distingue un document qu'on parcourt d'un formulaire dont le
    bouton se dérobe.

    L'ÉCART FRANÇAIS/ANGLAIS est réel et mesuré : 91 contre 39. La phrase
    d'imputation passe à trois lignes en français et à deux en anglais, et les
    intitulés français sont plus longs. On ne moyenne pas les deux — le plafond
    est déclaré par langue, comme partout dans ce fichier.
  */
  { nom: 'Receipt', adresse: '/demo/paiements', bouton: /Quittance|Receipt/, defil: { 360: 91, 1280: 0 }, defilLarge: { 360: 91, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    INSPECTION : LE PLAFOND MONTE, ET VOICI CE QU'IL ACHÈTE.

    Mesuré à 360 px : 237 px de défilement avant la rangée de photos, 323 avec
    elle dans sa première rédaction, 297 après avoir retiré le titre de rangée
    — qui répétait ce que le bouton dit déjà et que le lecteur d'écran
    annonçait deux fois. Les 60 px qui restent sont le BOUTON lui-même, ses
    44 px de cible et sa marge : ils ne se réduisent pas sans rendre la
    commande intouchable au doigt, ce que la porte des cibles refuserait à
    juste titre.

    Le plafond passe donc de 250 à 300, et de 0 à 20 à 1280 px. Ce n'est pas un
    défilement « qui n'achète rien » : il achète la seule façon de joindre une
    preuve à une réserve depuis le lieu où on la constate. Une vignette ajoutée
    coûte en plus sa hauteur, et c'est un choix de l'utilisateur, pas un défaut
    de l'écran — la mesure ci-dessous se fait sans photo choisie.
  */
  /*
     PLAFOND RELEVÉ — 300 → 345 à 360, 20 → 60 à 1280 — ET LE MOTIF EST ÉCRIT.

     Les réserves étaient une rangée de champs qui se replie, sans bord : trois
     réserves saisies, et rien ne disait où l'une finissait. Le rang n'existait
     que dans le nom accessible de la croix de retrait — « Retirer la réserve
     n° 2 » — donc pour l'oreille et pas pour l'œil.

     Chaque réserve est devenue un ÉLÉMENT DE LISTE : un filet à gauche, et une
     ligne d'en-tête portant le rang et le retrait. Cette ligne coûte 43 px par
     réserve à 360, et c'est tout le dépassement. Mesuré : la même chose en
     CARTE — bord complet et rembourrage — coûtait 50 px de plus, le
     rembourrage horizontal resserrant les champs et provoquant un repli
     supplémentaire. Le filet groupe autant pour un tiers du prix.

     43 px sur un formulaire qui en défile déjà 300, pour qu'un formulaire à
     trois réserves cesse d'être une file de champs indistincts : c'est le
     genre d'arbitrage que ce plafond existe pour faire écrire, et il est fait
     dans ce sens-là.
  */
  { nom: 'Inspection', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$|^Record an inspection$/, defil: { 360: 345, 1280: 60 }, defilLarge: { 360: 425, 1280: 54 }, avant: { 360: 237, 1280: 0 } },
  { nom: 'Invite', adresse: '/demo/locataires', bouton: /^Inviter par code$|^Invite by code$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LE SECOND ÉTAT DE LA MÊME MODALE, et il en change la hauteur.

    Choisir « Gestionnaire délégué » retire le menu des logements et la note du
    code déjà pris, et pose à leur place une explication de quatre lignes — ce
    qu'on délègue vraiment. C'est un autre contenu dans la même boîte, donc un
    autre défilement, et il n'était mesuré nulle part.
  */
  {
    nom: 'InviteGestionnaire',
    adresse: '/demo/locataires',
    bouton: /^Inviter par code$|^Invite by code$/,
    apres: (page) =>
      page.getByRole('combobox', { name: /Rôle invité|Invited role/ }).selectOption('manager'),
    defil: { 360: 0, 1280: 0 },
    defilLarge: { 360: 0, 1280: 0 },
    avant: { 360: 0, 1280: 0 },
  },
  /*
    CONFIER DES IMMEUBLES ET DES LOGEMENTS — une liste de CASES à deux niveaux.

    C'est la seule modale du produit dont le contenu grandit avec la donnée :
    trois immeubles dans la démonstration, mais un parc réel en porte dix. Le
    plafond de défilement ne dit donc pas qu'elle tiendra toujours ; il dit
    qu'elle tient POUR CE PARC-LÀ, et c'est déjà ce que ce script promet.

    0 → 57 px à 360 (2026-09-01) : la maille est descendue au LOGEMENT, et la
    modale liste désormais les logements sous chaque immeuble non coché. Quinze
    cases au lieu de trois. Le défilement est légitime ici — c'est une LISTE, et
    la refuser reviendrait à interdire au produit d'avoir plus de trois
    immeubles. À 1280 il reste nul, et en grande chasse aussi : les cases sont
    étroites, c'est la hauteur seule qui bouge.
  */
  { nom: 'ConfierImmeubles', adresse: '/demo/acces', bouton: /^Confier des immeubles$|^Assign buildings$/, defil: { 360: 57, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Announce', adresse: '/demo/locataires', bouton: /^Prévenir les locataires$|^Notify tenants$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Reply', adresse: '/demo/travaux', bouton: /^Répondre$|^Reply$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /* Le seul écran de la démonstration où le rôle change ce qui est rendu : la
     modale du locataire n'existe que pour lui. Le radio de profil est `sr-only`,
     donc invisible au sens de Playwright — d'où le clic FORCÉ, qui est ici la
     vérité du geste et non un contournement : à la souris, c'est l'étiquette
     qu'on vise, et elle est bien visible. */
  { nom: 'Report', adresse: '/demo/travaux', profil: /Locataire|Tenant/, bouton: /^Signaler un problème$|^Report an issue$/, defil: { 360: 620, 1280: 250 }, defilLarge: { 360: 486, 1280: 189 }, avant: { 360: 0, 1280: 0 } },
  /*
    LES CONFIRMATIONS ENTRENT, ET C'ÉTAIT LE PLUS GRAND TROU DE CETTE PORTE.

    Douze modales étaient mesurées : celles qu'un bouton d'en-tête ou de ligne
    ouvre du premier coup. Les CONFIRMATIONS ne s'ouvrent qu'après un premier
    geste — arbitrer une caution, retirer une fiche, retirer un accès, supprimer
    un immeuble, relancer les retards — et aucune des deux portes navigateur ne
    les atteignait. Or ce sont exactement celles qui engagent un geste
    irréversible : la seule famille de modales dont la géométrie compte parce
    qu'on y décide, et la seule que personne ne regardait.

    Trouvées par un relevé qui croisait les libellés de commande écrits dans
    `src/features` et les noms accessibles réellement rendus par un balayage de
    la démonstration. Elles y figuraient comme « jamais rendues », au milieu de
    faux positifs — et c'est en triant que le motif est apparu : toutes des
    confirmations, toutes destructrices.

    ELLES N'EXIGENT QU'UN CLIC, comme les autres : leur déclencheur est un
    bouton de LIGNE au lieu d'un bouton d'en-tête. Rien à ajouter à la mécanique
    d'ouverture ; il manquait seulement de les inscrire.

    « Reprendre » — le retrait d'un code d'invitation — ouvre la MÊME boîte que
    « Retirer l'accès », par le même état. Une entrée suffit donc pour les deux ;
    en ajouter une seconde mesurerait deux fois la même géométrie.
  */
  { nom: 'SettleDeposit', adresse: '/demo/cautions', bouton: /^Arbitrer$|^Settle$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 10, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'RemoveTenant', adresse: '/demo/locataires', bouton: /^Retirer$|^Remove$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'RevokeAccess', adresse: '/demo/acces', bouton: /^Retirer l’accès$|^Remove access$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    SUPPRIMER UN IMMEUBLE : LA SONDE EN CRÉE UN D'ABORD.

    L'issue n'apparaît que sur un immeuble VIDE — « le serveur refuse les
    autres, et offrir un geste qu'il refusera revient à promettre ce qu'on ne
    tient pas ». Les trois immeubles de la démonstration portent tous des
    logements, donc le déclencheur n'existe nulle part.

    DEUX RÉPONSES ÉTAIENT POSSIBLES, et le choix compte. Poser un quatrième
    immeuble vide dans `portfolio.ts` aurait rendu le geste mesurable — au prix
    de changer la forme du parc de démonstration pour la commodité d'une garde,
    et de faire bouger tous les comptes qui en dépendent. Le préalable, lui, ne
    touche à aucune donnée : il suit le chemin RÉEL — déclarer un immeuble,
    puis se raviser —, qui est exactement le cas que cette issue existe pour
    servir.

    Le prix est écrit : ce préalable dépend d'une autre modale — celle de
    l'ajout — donc il tombera si elle change. C'est une dépendance de garde à
    écran, et elle est visible ici plutôt que cachée dans une fixture.
  */
  {
    nom: 'DeleteBuilding',
    adresse: '/demo/parc',
    bouton: /^Supprimer l’immeuble |^Delete building /,
    prealable: async (page) => {
      await page.getByRole('button', { name: /^Ajouter un immeuble$|^Add a building$/ }).first().click()
      await page.waitForTimeout(300)
      const boite = page.getByRole('dialog')
      await boite.getByLabel(/Nom de l’immeuble|Building name/).fill('Immeuble sonde')
      await boite.getByLabel(/Quartier|District/).fill('Sonde')
      await boite.getByRole('button', { name: /^Enregistrer$|^Save$/ }).click()
      await page.waitForTimeout(400)
    },
    defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 },
    avant: { 360: 0, 1280: 0 },
  },
  { nom: 'RemindOverdue', adresse: '/demo/paiements', bouton: /^Relancer les retards$|^Chase arrears$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LA MISE EN DEMEURE ENTRE, ET C'EST UN LOT QUI L'A OUVERTE.

    Elle était la seule inscrite `NON_OUVRABLES` : son bouton était masqué en
    démonstration parce que `serveFormalNotice` rendait `false` sans parc, donc
    la boîte se serait ouverte sur une confirmation qui ne fait rien. Le
    fournisseur nomme maintenant cette troisième issue, l'écran écrit la phrase
    juste — « rien n'est enregistré » —, et le geste se joue entier.

    C'est le seul de ces gestes dont la démonstration ne peut RIEN retenir :
    l'acte est un enregistrement au dossier plus une notification à un compte,
    et elle n'a ni l'un ni l'autre. Elle le dit, au lieu de se taire.
  */
  { nom: 'FormalNotice', adresse: '/demo/paiements', bouton: /^Mettre en demeure$|^Serve notice$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
]

/**
 * LES DEUX QUI NE S'OUVRENT PAS, ET POURQUOI — voir l'en-tête.
 *
 * Écrites ici plutôt que passées sous silence : leur nombre entre dans le
 * compte gardé, donc une troisième modale qui deviendrait inatteignable ferait
 * rougir, et l'une de ces deux qui redeviendrait atteignable aussi.
 */
/*
  REDEVENUE VIDE, ET C'EST UN ÉTAT QUI SE GARDE COMME UN AUTRE.

  La mise en demeure y a passé un lot : son bouton était masqué en démonstration
  faute d'un chemin local honnête. Elle en est sortie par le haut — le
  fournisseur nomme désormais l'issue « démonstration », l'écran écrit « rien
  n'est enregistré », et la boîte s'ouvre. Les dix-huit modales du produit sont
  de nouveau toutes ouvrables.

  La liste reste, avec son compte : une dix-neuvième que la démonstration ne
  rendrait pas devrait s'y inscrire et faire bouger `NON_OUVRABLES_ATTENDUES`,
  donc apparaître dans un diff. Retirer la liste parce qu'elle est vide, c'est
  retirer le seul endroit où l'on remarquerait qu'elle a cessé de l'être.

  ANCIEN MOTIF, GARDÉ POUR MÉMOIRE.

  La mise en demeure est conditionnée à `unit.leaseId`, qu'aucun bail de la
  démonstration ne porte. C'est DÉLIBÉRÉ et il faut que ça le reste :
  `serveFormalNotice` rend `false` sans parc serveur, donc le bouton ouvrirait
  une boîte dont la confirmation ne ferait rien — un cul-de-sac sous un libellé
  qui promet un acte. Poser un `leaseId` fictif pour la faire entrer dans cette
  garde échangerait un trou de mesure contre un mensonge d'écran.

  C'est la différence avec le `tenantId` du lot précédent, où le chemin
  local existait : là-bas la donnée manquait sans raison, ici son absence EST la
  raison. La géométrie de cette boîte reste donc non mesurée, et c'est écrit.
*/
const NON_OUVRABLES = []

/**
 * Les libellés que `clavierDesModales.test.tsx` joue, recopiés pour que la ligne
 * de succès puisse nommer CE QUI RESTE dehors plutôt que de l'affirmer.
 *
 * Recopiés et non importés : ce script est un module Node, l'autre un fichier de
 * cas sous jsdom, et les relier ferait dépendre une porte du chargement de
 * l'autre. Le prix est cette liste ; le garde-fou est `COUVERTES_AU_CLAVIER`,
 * qui rougirait si les deux comptes cessaient de s'accorder, et la vérification
 * juste dessous, qui refuse un libellé sans modale correspondante ici.
 *
 * ELLE LES PORTE TOUTES LES DOUZE depuis que les six dernières sont entrées
 * dans les cas clavier. Trois d'entre elles demandaient plus qu'un clic : la
 * quittance et la réponse se répètent PAR LIGNE — dix et quatre boutons
 * mesurés — et le signalement n'existe que pour le LOCATAIRE.
 */
const COUVERTS = [
  'Ajouter un immeuble',
  'Ajouter un logement',
  'Ouvrir un chantier',
  'Enregistrer un paiement',
  'Corriger le parc',
  'Prix de refacturation',
  'Quittance',
  'Établir un état des lieux',
  'Inviter par code',
  'Prévenir les locataires',
  'Répondre',
  'Signaler un problème',
  /* LES QUATRE CONFIRMATIONS entrées avec elles : arbitrer, retirer une fiche,
     retirer un accès, relancer. La cinquième — supprimer un immeuble — demande
     qu'on en CRÉE un d'abord, ce que le fichier de cas ne sait pas faire ; elle
     reste donc mesurée ici et hors clavier, et la ligne de succès le dit. */
  'Arbitrer',
  'Retirer',
  'Retirer l’accès',
  'Relancer les retards',
  'Mettre en demeure',
]
/**
 * UN PLAFOND, DEUX POLICES — meme arbitrage que `plafond-coquille`.
 *
 * `--font-sans` commence par `system-ui`, qui designe un dessin DIFFERENT par
 * systeme : « Creer mon espace » rend 132,61 px sur macOS et 146,14 px sur
 * l'executeur Ubuntu, ou il vaut DejaVu Sans. Un corps de modale se compose de
 * texte : plus large, il est plus haut, et il defile davantage. Neuf des
 * trente-six etats depassaient leur plafond sous police large, jusqu'a +80 px
 * sur l'etat des lieux.
 *
 * CE N'EST PAS UN DEFAUT, C'EST UN COUT — le pied reste tenu, l'action reste
 * sous les yeux, et c'est ce que ce fichier garde. Relever le plafond unique
 * aurait donne du mou a la mesure locale ; rogner le contenu aurait cache des
 * indications qui disent ce qu'un champ engage. On garde donc LES DEUX MESURES
 * VRAIES, et `defilLarge` porte celle de la police large.
 *
 * LES TRENTE-SIX SONT MESUREES, sans marge, pas seulement les neuf qui
 * depassaient : un plafond recopie d'une autre colonne serait un nombre, pas un
 * releve.
 */
const LARGEURS = [360, 1280]
const LANGUES = ['fr', 'en']
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  `MODALES.length * LARGEURS.length * LANGUES.length` rendrait la garde
  d'accord avec elle-même : vider `MODALES`, et l'inspection comparerait 0 à 0
  puis se déclarerait verte. La même mutation a trouvé ce piège trois lots de
  suite. Ajouter une modale oblige à toucher ce nombre, et le diff le montre.

  48 = 12 modales ouvrables × 2 largeurs × 2 langues.
  0  = plus aucune modale hors de portée de la démonstration.

  Les deux nombres ont bougé ENSEMBLE, deux fois de suite : `ParkSettings` puis
  `Tariffs` sont passées de la seconde ligne à la première. C'est exactement ce
  que ce compte écrit à la main sert à rendre visible dans un diff.

  72 → 76 (2026-08-31) : `InviteGestionnaire`, le SECOND état de la modale
  d'invitation. Ce n'est pas une modale de plus, c'est un état de plus dans une
  modale déjà tenue — le premier que ce script mesure grâce au geste `apres`.

  76 → 80 (2026-08-31) : `ConfierImmeubles`, née avec la délégation par
  immeuble. Elle vient à quatre états comme toute modale ordinaire — deux
  largeurs, deux chasses.
  Une modale n'a pas un état, elle en a autant que ses champs, et le compte le
  dit maintenant.
*/
const ATTENDUS = 80
const NON_OUVRABLES_ATTENDUES = 0

/**
 * Le plafond effectif, selon la police imposee.
 *
 * La garde refuse une entree sans `defilLarge` : une modale ajoutee demain qui
 * n'en porterait qu'un passerait au vert en mode police large sans etre gardee,
 * ce qui est exactement le silence que ce fichier existe pour empecher.
 */
function plafondDe(modale, largeur) {
  if (!POLICE_LARGE) return modale.defil[largeur]
  if (!modale.defilLarge || typeof modale.defilLarge[largeur] !== 'number') {
    console.error(
      `\n✗ modales : « ${modale.nom} » n'a pas de \`defilLarge\` pour ${largeur} px.\n` +
        '   Chaque plafond a deux valeurs depuis que les deux polices sont mesurees.\n' +
        '   Relancez `MESURER_EN_POLICE_LARGE=1 node scripts/modales.mjs` et inscrivez le releve.\n',
    )
    exit(1)
  }
  return modale.defilLarge[largeur]
}

async function servir() {
  /*
    LE PORT DOIT ÊTRE LIBRE AVANT QU'ON LANCE QUOI QUE CE SOIT.

    `--strictPort` fait échouer Vite au lieu de le déplacer, et cela ne suffit
    PAS — un témoin l'a montré : port occupé par un intrus, Vite meurt, et la
    boucle d'attente reçoit un 200 de l'intrus AVANT que la mort du fils ne
    remonte. La porte mesurait un serveur qu'elle n'avait pas lancé, et rendait
    vert.

    Surveiller la sortie du fils ne corrige pas cette course : `npx` est le fils,
    Vite le petit-fils, et la réponse de l'intrus arrive la première. Le seul
    contrôle qui ne court pas est celui qui précède : si quelque chose répond
    déjà sur ce port, on refuse.

    CE N'EST PAS UNE HYPOTHÈSE. Relevé le 2026-09-01 : quatre prévisualisations
    orphelines tournaient encore — 4183, 4188, 4193, 4199 —, la plus ancienne
    depuis deux jours et dix-huit heures. Elles survivent à toute porte
    interrompue avant son `kill`.

    Le dégât est resté théorique ici : `vite preview` sert `dist/` au fil des
    requêtes, et l'orphelin rendait les mêmes octets. Il cesse de l'être dès
    qu'un orphelin vient d'un AUTRE dossier de travail — une seconde copie du
    dépôt, une branche comparée — et la porte rendrait alors un vert sur un
    paquet que personne n'a construit.
  */
  try {
    await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) })
    throw new Error(
      `modales : quelque chose répond déjà sur ${BASE}.\n` +
        `  Cette porte lance son propre serveur et refuse d'en mesurer un autre.\n` +
        `  Souvent une prévisualisation orpheline d'un passage interrompu :\n` +
        `    lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
    )
  } catch (erreur) {
    /* L'ABSENCE DE RÉPONSE EST CE QU'ON VEUT : `fetch` lève, et l'on continue.
       Seule notre propre plainte est relancée — la reconnaître par son message
       plutôt que par son type évite d'inventer une classe d'erreur pour une
       ligne. */
    if (erreur instanceof Error && erreur.message.includes('répond déjà')) throw erreur
  }
  /*
    `--strictPort` : UNE PORTE NE MESURE PAS UN SERVEUR QU'ELLE N'A PAS LANCÉ.

    Sans lui, `vite preview` trouve le port occupé et se déplace SANS BRUIT sur
    le suivant. La porte, elle, continue d'interroger le port qu'elle a demandé
    — et mesure donc ce qui s'y trouvait déjà.

    CE N'EST PAS UNE HYPOTHÈSE. Relevé le 2026-09-01 : QUATRE serveurs de
    prévisualisation orphelins tournaient encore, sur 4183, 4188, 4193 et 4199,
    le plus ancien depuis deux jours et dix-huit heures. Ils survivent quand une
    porte est interrompue avant son `kill` — un Ctrl-C, un délai dépassé, une
    session fermée.

    Ici le dégât est resté théorique : `vite preview` sert `dist/` au fil des
    requêtes, et l'orphelin rendait donc les mêmes octets que son successeur.
    Il cesse de l'être dès qu'un orphelin vient d'un AUTRE dossier de travail —
    une seconde copie du dépôt, une branche en cours de comparaison — et la
    porte rendrait alors un vert sur un paquet que personne n'a construit.

    Le drapeau fait échouer le démarrage au lieu de le déplacer. Une porte qui
    ne peut pas s'exécuter doit le DIRE, pas se rabattre sur autre chose.
  */
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('modales : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
/* Combien de modales la sonde des gabarits a lues — voir sa garde du garde. */
let gabaritsInspectes = 0
/* Ce que les deux audits de modale ont réellement examiné — leurs gardes. */
let textesDeModaleAudites = 0
let ciblesDeModaleSondees = 0
const releve = []
let inspectees = 0

try {
  const navigateur = await chromium.launch()
  for (const modale of MODALES) {
    for (const largeur of LARGEURS) {
      for (const langue of LANGUES) {
        const contexte = await navigateur.newContext({
          ...SANS_AGENT_DE_SERVICE,
          viewport: { width: largeur, height: largeur === 360 ? 780 : 900 },
          locale: langue === 'fr' ? 'fr-FR' : 'en-US',
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
        }, langue)
        await page.goto(BASE + modale.adresse, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(400)

        const nom = `${modale.nom}@${largeur}/${langue}`

        if (modale.profil) {
          /* SOUS `lg`, LE SÉLECTEUR VIT DANS LE TIROIR. La barre latérale n'est
             rendue qu'à partir de 1024 px ; en dessous, il faut l'ouvrir. Sans
             ce geste la garde ne trouvait rien à 360 et se plaignait d'un
             défaut qui n'en est pas un — l'écran est correct, c'est la garde
             qui ne savait pas y entrer. */
          const tiroir = page.getByRole('button', { name: /Ouvrir la navigation|Open navigation/ }).first()
          if ((await tiroir.count()) > 0 && (await tiroir.isVisible())) {
            await tiroir.click()
            await page.waitForTimeout(400)
          }
          const radio = page.getByRole('radio', { name: modale.profil }).first()
          if ((await radio.count()) === 0) {
            plaintes.push(
              `${nom} : le sélecteur de profil est introuvable — cette modale n'existe que pour ce profil.`,
            )
            await contexte.close()
            continue
          }
          /* Clic FORCÉ : le radio est `sr-only`, donc invisible au sens de
             Playwright. À la souris c'est l'étiquette qu'on vise, et elle est
             bien visible — le forçage est ici la vérité du geste. */
          await radio.click({ force: true })
          await page.waitForTimeout(500)
          /* Le tiroir se referme : il recouvre l'écran, et la modale s'ouvre
             derrière lui. */
          const fermer = page.getByRole('button', { name: /Fermer|Close/ }).first()
          if ((await fermer.count()) > 0 && (await fermer.isVisible())) {
            await fermer.click()
            await page.waitForTimeout(400)
          }
        }

        /*
          LE PRÉALABLE, quand la modale n'a rien à ouvrir sans lui.

          Une seule s'en sert : la suppression d'un immeuble, dont l'issue
          n'existe que sur un immeuble VIDE — voir son entrée. La sonde suit
          alors le chemin de l'utilisateur au lieu qu'on maquille les données.
        */
        if (modale.prealable) {
          try {
            await modale.prealable(page)
          } catch (erreur) {
            plaintes.push(
              `${nom} : le préalable a échoué — ${String(erreur).split('\n')[0]}\n` +
                "   La modale n'a pas pu être amenée à l'écran, donc rien n'a été mesuré.",
            )
            await contexte.close()
            continue
          }
        }

        /*
          LE MENU DE DÉBORDEMENT EST OUVERT D'ABORD, s'il faut.

          Trois de ces modales s'ouvrent depuis une action que l'en-tête replie
          derrière trois points — poser un prix, corriger le parc, prévenir les
          locataires. Le bouton n'a pas disparu : il vit une porte plus loin, et
          la sonde suit le même chemin que l'utilisateur.

          On ouvre le menu de L'EN-TÊTE, jamais le premier de la page : la
          coquille en porte déjà un pour le compte, et l'ouvrir mènerait à la
          déconnexion.
        */
        if ((await page.getByRole('button', { name: modale.bouton }).count()) === 0) {
          /*
            DEUX NIVEAUX REPLIENT : la rangée d'actions de la page, et les cartes
            d'intervention. On essaie donc les déclencheurs un par un, l'en-tête
            d'abord, et l'on REFERME celui qui ne portait pas ce qu'on cherche —
            un panneau laissé ouvert se poserait au-dessus du suivant.

            La coquille porte le même attribut tout en haut pour son menu de
            compte : ouvert par mégarde, il mène à la déconnexion. Les deux
            sélecteurs l'écartent par son ancêtre.
          */
          const candidats = await page
            .locator('[data-en-tete-de-page] [aria-haspopup="menu"], main [aria-haspopup="menu"]')
            .all()
          for (const trois of candidats) {
            await trois.click()
            await page.waitForTimeout(150)
            if ((await page.getByRole('menuitem', { name: modale.bouton }).count()) > 0) break
            await page.keyboard.press('Escape')
            await page.waitForTimeout(100)
          }
        }

        const bouton = page
          .getByRole('button', { name: modale.bouton })
          .or(page.getByRole('menuitem', { name: modale.bouton }))
          .first()
        if ((await bouton.count()) === 0) {
          plaintes.push(
            `${nom} : le bouton qui l'ouvre est introuvable.\n` +
              "   Une modale qu'on n'ouvre pas est une modale qu'on n'a pas mesurée, et\n" +
              "   « pas mesurée » ne doit jamais s'écrire comme « sans défaut ».",
          )
          await contexte.close()
          continue
        }
        await bouton.click().catch(() => {})
        await page.waitForTimeout(350)

        /*
          LE GESTE FAIT DANS LA MODALE, une fois qu'elle est ouverte.

          `prealable` amène la modale à l'écran ; il n'y avait rien pour agir
          DEDANS. Or une modale n'a pas un état, elle en a autant que ses
          champs : le choix « Gestionnaire délégué » remplace le menu des
          logements par une note de quatre lignes, et ce second état n'était
          mesuré par personne — c'est l'angle mort que `notes-conditionnelles`
          a nommé le 2026-08-31.

          On mesure donc l'état DEMANDÉ, pas seulement celui d'ouverture.
        */
        if (modale.apres) {
          try {
            await modale.apres(page)
            await page.waitForTimeout(250)
          } catch (erreur) {
            plaintes.push(
              `${nom} : le geste dans la modale a échoué — ${String(erreur).split('\n')[0]}\n` +
                "   L'état demandé n'a pas été atteint, donc c'est un AUTRE état qui aurait\n" +
                '   été mesuré — et « pas mesuré » ne doit jamais s’écrire comme « sans défaut ».',
            )
            await contexte.close()
            continue
          }
        }

        const m = await page.evaluate(async () => {
          const d = document.querySelector('[role="dialog"],[role="alertdialog"]')
          if (!d) return null
          const enfants = [...d.children]
          /*
            LES TROIS BANDES SE NOMMENT, ELLES NE SE DEVINENT PLUS.

            On cherchait le corps par son `overflow-y: auto` calculé, l'en-tête
            par « le premier enfant s'il n'est pas le corps », le pied par « le
            dernier, même règle ». Trois heuristiques qui tenaient tant que la
            modale avait exactement trois enfants à plat — et qui se seraient
            trompées SANS RIEN DIRE le jour où l'une des bandes gagne un
            enveloppe : le corps devenait introuvable, `defil` retombait à zéro,
            et le plafond de défilement passait au vert sur une mesure vide.

            `Modal` pose maintenant `data-entete-de-modale`,
            `data-corps-de-modale` et `data-pied-de-modale`. Le repli reste pour
            qu'un composant tiers reste mesurable.
          */
          const corps =
            d.querySelector('[data-corps-de-modale]') ??
            enfants.find((e) => getComputedStyle(e).overflowY === 'auto')
          const pied =
            d.querySelector('[data-pied-de-modale]') ??
            (enfants[enfants.length - 1] !== corps ? enfants[enfants.length - 1] : null)
          const entete =
            d.querySelector('[data-entete-de-modale]') ??
            (enfants[0] !== corps ? enfants[0] : null)
          /* Deux trames : l'état vient d'un écouteur de défilement puis d'un
             rendu React, et le lire tout de suite lirait celui d'avant. */
          const peint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          const voiles = () => ({
            haut: corps ? corps.hasAttribute('data-suite-au-dessus') : null,
            bas: corps ? corps.hasAttribute('data-suite-en-dessous') : null,
          })
          const r = d.getBoundingClientRect()
          const dansLaFenetre = (el) => {
            const b = el.getBoundingClientRect()
            return b.top >= -1 && b.bottom <= window.innerHeight + 1
          }
          /* Corps en haut puis en bas : un pied ÉPINGLÉ ne bouge pas, un pied
             qui suit le contenu sort du champ à la première molette. */
          let piedTenu = pied ? dansLaFenetre(pied) : null
          let enteteTenu = entete ? dansLaFenetre(entete) : null
          await peint()
          const voilesEnHaut = voiles()
          let voilesEnBas = voilesEnHaut
          if (corps) {
            corps.scrollTop = corps.scrollHeight
            if (pied) piedTenu = piedTenu && dansLaFenetre(pied)
            if (entete) enteteTenu = enteteTenu && dansLaFenetre(entete)
            await peint()
            voilesEnBas = voiles()
            corps.scrollTop = 0
          }
          /*
            LE PORTAIL, VÉRIFIÉ DIRECTEMENT ET NON PAR COÏNCIDENCE.

            Avant ce contrôle, retirer `createPortal` ne se voyait que TANT QUE
            `<main>` portait `animate-rise` : les deux retirés ensemble, la
            modale se replaçait correctement et la garde passait au vert avec le
            défaut réarmé pour le prochain `transform` posé n'importe où.

            On vérifie donc la STRUCTURE : le conteneur `fixed inset-0` de la
            modale est un enfant direct de `<body>`. C'est la seule position où
            aucun ancêtre ne peut lui voler son bloc conteneur, et c'est
            exactement ce que le portail garantit. La mesure ne dépend plus de
            ce que `<main>` décide.
          */
          const conteneur = d.parentElement
          /*
            UNE VALEUR COUPÉE DANS SON CHAMP, mesurée ICI aussi.

            `mesure-ui` porte la même règle depuis ce lot, sur 88 champs — mais
            il ne pousse aucune porte : les champs qui vivent DANS une modale
            lui échappent, et ce sont les plus contraints du produit, puisqu'ils
            partagent une boîte de 360 px avec un pied et un en-tête.

            `scrollWidth > clientWidth` est la mesure exacte du texte qui
            n'entre pas dans sa boîte de contenu. Un texte coupé DANS sa boîte
            ne déborde de rien : la page ne défile pas, le conteneur ne grandit
            pas, et le DOM porte la chaîne entière.
          */
          const valeursRognees = []
          for (const champ of d.querySelectorAll('input, select')) {
            if (['hidden', 'checkbox', 'radio'].includes(champ.type)) continue
            if (!champ.getClientRects().length) continue
            const montre = champ.value || champ.placeholder || ''
            if (!montre.trim()) continue
            const manque = Math.round(champ.scrollWidth - champ.clientWidth)
            if (manque <= 2) continue
            valeursRognees.push({
              texte: montre.trim().slice(0, 44),
              manque,
              offert: Math.round(champ.clientWidth),
            })
          }

          return {
            valeursRognees,
            enfantDeBody: conteneur?.parentElement === document.body,
            profondeur: (() => {
              let n = 0
              for (let e = conteneur; e && e !== document.body; e = e.parentElement) n++
              return n
            })(),
            boite: Math.round(r.height),
            debordeEnHaut: Math.round(Math.max(0, -r.top)),
            debordeEnBas: Math.round(Math.max(0, r.bottom - window.innerHeight)),
            defil: corps ? Math.max(0, corps.scrollHeight - corps.clientHeight) : 0,
            piedTenu,
            enteteTenu,
            voilesEnHaut,
            voilesEnBas,
          }
        })
        /**
         * AUCUN GABARIT NE SURVIT DANS UNE MODALE NON PLUS.
         *
         * Les deux portes qui cherchent les `{jeton}` non résolus balaient des
         * PAGES : `mesure-ui` sur la démonstration, `espace-connecte` derrière une
         * session. Ni l'une ni l'autre n'ouvre une boîte de dialogue, et l'en-tête
         * de la sonde le dit depuis le jour où elle est née — « les modales, qui
         * ne sont pas ouvertes par les balayages qui l'emploient ».
         *
         * Vingt modales, quatre-vingts états, et pas un seul regardé sous cet
         * angle. Ce script les ouvre déjà toutes : la sonde ne coûte qu'un
         * `evaluate` de plus dans une boîte qui est là.
         *
         * BORNÉE AU DIALOGUE. Lue sur `body`, elle verrait la page derrière — que
         * les deux autres portes tiennent déjà — et ferait rougir une modale
         * innocente pour le jeton de son fond.
         */
        const gabarits = await page.evaluate(MESURER_GABARITS, '[role="dialog"],[role="alertdialog"]')

        /**
         * CONTRASTE ET CIBLES, DANS LA BOÎTE OUVERTE — la dette que
         * `mesure-ui` déclarait à chaque passage : « les DIX modales du
         * produit n'en sont pas ; leur contraste et leurs cibles restent NON
         * audités ». Vingt modales aujourd'hui, quatre-vingts états, et tous
         * les gestes qu'on ne défait pas — arbitrer une caution, délier une
         * fiche, reprendre un accès — vivent précisément ici.
         *
         * LA SONDE DES CIBLES SE BORNE D'ELLE-MÊME : « une modale ouverte
         * borne le balayage à elle-même », écrit dans son propre en-tête,
         * pour la raison qu'`elementFromPoint` rend la couche derrière elle.
         * L'audit de contraste, lui, reçoit sa racine par
         * `__AUDIT_RACINE__` — même geste que `MESURER_GABARITS`.
         *
         * LES DEUX THÈMES, parce que la moitié des jetons ne vit qu'en
         * sombre — `warn` y vaut #e0b877 sur #54421f, aucun des deux
         * n'existant en clair. La bascule se fait à chaud sur la boîte déjà
         * ouverte, animations gelées : sans le gel, `mesure-ui` a mesuré
         * que 13 points sur 24 rendaient un relevé different — la page est
         * MIXTE pendant les 150 ms de transition, et l'audit invente des
         * fautes. Les cibles, elles, ne dépendent pas du thème : une fois.
         */
        await page
          .addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
          .catch(() => {})
        await page.evaluate(() => {
          window.__AUDIT_RACINE__ = '[role="dialog"],[role="alertdialog"]'
        })
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme })
          const contraste = await page.evaluate(AUDIT_CONTRASTE)
          if (!contraste || typeof contraste.examines !== 'number') {
            plaintes.push(
              nom + ' : `contrast-audit.js` n\'a pas rendu `{ failures, items, examines }`.',
            )
          } else {
            textesDeModaleAudites += contraste.examines
            for (const item of contraste.items) {
              plaintes.push(
                `${nom} · ${largeur}px · ${langue} · ${theme} : contraste ${item.ratio} sous le seuil ` +
                  `WCAG AA dans la modale — ${(item.text ?? '').slice(0, 44)} (${item.color} sur ${item.bg})`,
              )
            }
          }
        }
        await page.emulateMedia({ colorScheme: 'light' })

        const cibles = await page.evaluate(MESURER_CIBLES, {
          plancher: PLANCHER_CIBLE,
          rayon: RAYON_SONDAGE,
        })
        ciblesDeModaleSondees += cibles.sondees
        for (const defaut of cibles.defauts) {
          plaintes.push(
            `${nom} · ${largeur}px · ${langue} : cible touchable ${defaut.cible} px ` +
              `(boîte ${defaut.boite}) dans la modale, sous le plancher de ${PLANCHER_CIBLE} — ` +
              `<${defaut.balise}> ${defaut.texte || defaut.classes}`,
          )
        }

        await contexte.close()

        if (gabarits.vu) {
          gabaritsInspectes++
          if (gabarits.jetons.length > 0) {
            plaintes.push(
              `${nom} · ${largeur}px · ${langue} : gabarit NON RÉSOLU dans la modale — ` +
                `${gabarits.jetons.join(", ")}` +
                "\n   Le paramètre n'atteint pas t(), ou le message est écrit en ICU " +
                "imbriqué, que le fournisseur ne lit pas.",
            )
          }
        }

        if (!m) {
          plaintes.push(`${nom} : le bouton a été cliqué et aucune boîte de dialogue n'est apparue.`)
          continue
        }
        inspectees++
        releve.push({ nom, largeur, ...m, plafond: plafondDe(modale, largeur), avant: modale.avant[largeur] })

        if (!m.enfantDeBody) {
          plaintes.push(
            `${nom} : la modale n'est PAS un enfant direct de <body> — ${m.profondeur} niveau(x) au-dessus.\n` +
              "   Son conteneur `fixed` peut alors se faire voler son bloc conteneur par n'importe\n" +
              '   quel ancêtre portant transform, filter, contain ou will-change. Voir le portail\n' +
              "   de `Modal` et l'en-tête de ce script.",
          )
        }
        if (m.debordeEnHaut > 0 || m.debordeEnBas > 0) {
          plaintes.push(
            `${nom} : la boîte DÉBORDE de la fenêtre — ${m.debordeEnHaut} px en haut, ` +
              `${m.debordeEnBas} px en bas.\n` +
              "   Un ancêtre transformé a repris le bloc conteneur du `fixed`. Voir l'en-tête\n" +
              '   de ce script, et le portail de `Modal`.',
          )
        }
        if (m.piedTenu === false) {
          plaintes.push(
            `${nom} : le pied d'action sort du champ quand le corps défile.\n` +
              "   L'action principale doit rester sous les yeux, pas au bout du formulaire.",
          )
        }
        if (m.enteteTenu === false) {
          plaintes.push(`${nom} : l'en-tête sort du champ quand le corps défile.`)
        }
        /*
          LE CORPS DIT-IL QU'IL CONTINUE ?

          La coupe est NETTE aux deux bords : une ligne tranchée à mi-hauteur
          sous l'en-tête, un champ disparu sous le pied, et rien pour
          distinguer « le formulaire s'arrête là » de « il reste six champs ».
          Le liseré des bandes ne dit rien de la direction — posé en haut d'un
          corps déjà défilé, il ressemble même à un début.

          Cette mesure ne peut vivre qu'ICI : dans le rendu d'essai, un corps
          n'a ni hauteur ni défilement, donc la question n'a pas de réponse.

          On l'exige DANS LES DEUX SENS, et le second est celui qu'on oublie :
          un voile du bas qui ne s'éteint jamais annonce une suite qui n'existe
          pas, en bas d'un formulaire dont on cherche justement le bouton.
        */
        if (m.defil > 0) {
          if (m.voilesEnHaut.bas !== true)
            plaintes.push(
              `${nom} : ${m.defil} px à lire plus bas, et le corps ne le dit pas.\n` +
                '   La coupe sous le pied ne distingue pas la fin du formulaire de sa suite.',
            )
          if (m.voilesEnHaut.haut !== false)
            plaintes.push(`${nom} : le corps annonce une suite au-dessus alors qu'il est en haut.`)
          if (m.voilesEnBas.haut !== true)
            plaintes.push(
              `${nom} : défilé jusqu'en bas, le corps ne dit pas que quelque chose reste au-dessus.`,
            )
          if (m.voilesEnBas.bas !== false)
            plaintes.push(
              `${nom} : arrivé en bas, le corps annonce encore une suite.\n` +
                "   Un voile qui ne s'éteint pas fait chercher un contenu qui n'existe pas.",
            )
        } else if (m.voilesEnHaut.haut || m.voilesEnHaut.bas) {
          plaintes.push(
            `${nom} : le corps tient entier et annonce pourtant une suite ` +
              `(${m.voilesEnHaut.haut ? 'au-dessus' : ''}${m.voilesEnHaut.bas ? ' en dessous' : ''}).`,
          )
        }
        for (const v of m.valeursRognees) {
          plaintes.push(
            `${nom} : « ${v.texte} » est COUPÉ dans son champ — ${v.manque} px de trop pour ` +
              `${v.offert} px offerts.\n` +
              '   Un texte coupé DANS sa boîte ne déborde de rien : aucune autre règle ne le voit.\n' +
              "   Remèdes : élargir le champ ; raccourcir ce qu'il MONTRE une fois fermé, en\n" +
              '   gardant la forme longue dans sa liste (`OptionCombobox.resume`).',
          )
        }
        if (m.defil > plafondDe(modale, largeur)) {
          plaintes.push(
            `${nom} : ${m.defil} px de défilement pour un plafond de ${plafondDe(modale, largeur)}.\n` +
              `   Avant ce lot : ${modale.avant[largeur]} px.`,
          )
        }
      }
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/* ─── LA GARDE DU GARDE ─────────────────────────────────────────────────── */
if (inspectees === 0) {
  plaintes.push(
    "AUCUNE modale inspectée. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (NON_OUVRABLES.length !== NON_OUVRABLES_ATTENDUES) {
  plaintes.push(
    `${NON_OUVRABLES.length} modale(s) déclarée(s) non ouvrable(s) pour ${NON_OUVRABLES_ATTENDUES} attendue(s).\n` +
      "   La liste est périmée dans un sens ou dans l'autre : une modale redevenue atteignable\n" +
      '   doit rejoindre la mesure, une nouvelle inatteignable doit être nommée.',
  )
}
/**
 * GARDE DU GARDE — la sonde des gabarits a-t-elle lu une seule modale ?
 *
 * Elle est née VERTE : aucun jeton non résolu dans les quatre-vingts états. Un
 * vert de ce genre est indistinguable d'une sonde qui ne trouve plus son
 * dialogue — un sélecteur changé, une modale montée ailleurs qu'en portail. Le
 * compte est la seule chose qui les sépare, et il suit `ATTENDUS` sans le
 * doubler : ce sont les mêmes ouvertures.
 */
/**
 * GARDES DU GARDE des deux audits de modale — nés VERTS, donc sans rouge pour
 * prouver qu'ils regardent. Seuls ces comptes séparent « aucune faute » de
 * « rien d'examiné » : une racine qui ne résout plus, un sélecteur changé, et
 * les deux rendraient le même silence.
 *
 * Planchers très en dessous du relevé — ils prouvent que les audits trouvent
 * encore leurs éléments, jamais la richesse des boîtes.
 */
const TEXTES_DE_MODALE_ATTENDUS = 400
if (textesDeModaleAudites < TEXTES_DE_MODALE_ATTENDUS) {
  plaintes.push(
    `contraste des modales : ${textesDeModaleAudites} texte(s) examiné(s) pour ` +
      `${TEXTES_DE_MODALE_ATTENDUS} attendus au moins. Une racine qui ne résout plus rend le ` +
      'même vert que des boîtes saines.',
  )
}

const CIBLES_DE_MODALE_ATTENDUES = 150
if (ciblesDeModaleSondees < CIBLES_DE_MODALE_ATTENDUES) {
  plaintes.push(
    `cibles des modales : ${ciblesDeModaleSondees} sondée(s) pour ` +
      `${CIBLES_DE_MODALE_ATTENDUES} attendues au moins.`,
  )
}

if (gabaritsInspectes !== ATTENDUS) {
  plaintes.push(
    `la sonde des gabarits a lu ${gabaritsInspectes} modale(s) pour ${ATTENDUS} ouverture(s). ` +
      "Ce n'est pas « aucun jeton », c'est une sonde qui ne trouve plus son dialogue.",
  )
}

if (inspectees !== ATTENDUS) {
  plaintes.push(
    `${inspectees} état(s) inspecté(s) pour ${ATTENDUS} attendu(s).\n` +
      "   La garde n'a pas ouvert ce qu'elle prétend garder.",
  )
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(22)} boîte ${String(r.boite).padStart(4)} px  ` +
      `déborde ${String(r.debordeEnHaut).padStart(3)}/${String(r.debordeEnBas).padStart(3)}  ` +
      `défil ${String(r.defil).padStart(4)} (plafond ${String(r.plafond).padStart(4)} · avant ${String(r.avant).padStart(4)})  ` +
      `pied ${r.piedTenu === null ? '—' : r.piedTenu ? 'tenu' : 'PERDU'}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ modales : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

/*
  LA LIGNE DE SUCCÈS SUIT L'ÉTAT, elle ne le récite pas.

  Elle disait « TariffsModal et ParkSettingsModal ne sont pas couvertes par les
  cas clavier » et « sur QUATRE modales » — deux phrases écrites en dur, vraies
  le jour où on les a tapées et fausses depuis que les deux modales ont rejoint
  les cas clavier, qui sont six. Une porte dont le rapport se périme apprend à
  ne plus lire son rapport.

  `COUVERTES_AU_CLAVIER` est donc écrit ICI, à la main, comme `ATTENDUS` — et
  pour la même raison : dérivé de l'autre fichier il ne dirait rien, recopié
  sans compte il se périmerait encore. Le nombre force à toucher cette ligne le
  jour où la couverture bouge.
*/
const COUVERTES_AU_CLAVIER = 17
/*
  GARDE DU GARDE : le nombre écrit et la liste recopiée doivent s'accorder, et
  la liste doit désigner des modales qui EXISTENT. Sans cette vérification, un
  libellé mal recopié sortirait sa modale du compte des couvertes et la ferait
  passer pour non couverte — un rapport plus faux que celui qu'on vient de
  corriger, parce qu'il aurait l'air d'avoir été vérifié.
*/
const introuvables = COUVERTS.filter((c) => !MODALES.some((m) => m.bouton.test(c)))
if (COUVERTS.length !== COUVERTES_AU_CLAVIER || introuvables.length > 0) {
  console.error(
    `\n✗ modales : la liste des modales couvertes au clavier ne tient pas.\n` +
      `   ${COUVERTS.length} libellé(s) recopié(s) pour ${COUVERTES_AU_CLAVIER} annoncé(s).\n` +
      (introuvables.length
        ? `   Sans modale correspondante ici : ${introuvables.join(', ')}\n`
        : ''),
  )
  exit(1)
}
const horsClavier = MODALES.filter((m) => !COUVERTS.some((c) => m.bouton.test(c)))

console.log(
  `\n✓ modales : ${inspectees}/${ATTENDUS} états ouverts et mesurés sur ${MODALES.length} modales,\n` +
    `  ${textesDeModaleAudites} textes confrontés au seuil WCAG AA dans les boîtes, deux thèmes ;\n` +
    `  ${ciblesDeModaleSondees} cibles de modale sondées au doigt, plancher ${PLANCHER_CIBLE} px.\n` +
    (NON_OUVRABLES.length === 0
      ? '  et AUCUNE que la démonstration ne rende pas — la liste est vide et gardée vide.\n'
      : `  plus ${NON_OUVRABLES.length} que la démonstration ne rend pas : ${NON_OUVRABLES.join(', ')}.\n`) +
    '  Le CLAVIER est mesuré ailleurs — `clavierDesModales.test.tsx` — sur ' +
    `${COUVERTES_AU_CLAVIER} modales ;\n` +
    (horsClavier.length === 0
      ? '  TOUTES y sont — entrée du focus, piège, Échap, retour au bouton.\n'
      : `  ${horsClavier.length === 1 ? "l'autre non" : `les ${horsClavier.length} autres non`} : ` +
        `${horsClavier.map((m) => m.nom).join(', ')}.\n`) +
    "  La PERTINENCE d'un champ n'est mesurée nulle part : voir l'en-tête.",
)
