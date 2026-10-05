/**
 * LE REGISTRE DES MODALES — un seul, lu par deux mesures.
 *
 * ═══ POURQUOI IL A QUITTÉ `modales.mjs` LE 2026-09-30 ═══
 *
 * Il y vivait, et cela suffisait tant qu'une seule porte le lisait. Une seconde
 * est arrivée — la fumée, qui ouvre ces mêmes modales sur l'HÔTE VIVANT — et
 * deux listes finiraient par diverger. Une modale ajoutée d'un côté serait alors
 * mesurée en local et jamais en production, ou l'inverse, et le silence que
 * produirait l'oubli ressemblerait exactement à « aucun défaut ».
 *
 * C'est le même arbitrage que `scripts/inventaire/routes.mjs`, pour la même
 * raison, et il est fait ici avant que la divergence n'existe plutôt qu'après.
 *
 * `modales.mjs` NE PEUT PAS ÊTRE IMPORTÉ : il démarre un serveur de
 * prévisualisation au niveau supérieur. Lire son registre exigeait donc de
 * lancer la porte entière. Ce fichier-ci ne contient que des données.
 *
 * ═══ CE QU'IL PORTE, ET CE QU'IL NE PORTE PAS ═══
 *
 * Il porte l'adresse, le geste qui ouvre, les gestes qui suivent, et les
 * plafonds de défilement par largeur. Il NE MESURE RIEN : ce qu'on en fait vit
 * chez ses lecteurs. C'est cette frontière qui les garde disjoints — la fumée
 * ignore les plafonds, `modales` ignore l'hôte vivant.
 *
 * PIÈGE TAILWIND v4 : ce fichier est balayé par la détection automatique des
 * sources. Aucune classe n'y est citée en littéral — il n'y en a aucun besoin,
 * ce module ne tient que des rôles et des noms accessibles.
 */
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
export const MODALES = [
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
  /*
    11 → 82 px à 360, 76 → 126 en police large (2026-09-05) : LES DEUX GESTES DE
    RANGÉE. L'historique des prix était en LECTURE SEULE, et une faute de frappe
    y restait pour la vie du parc — la route de création le savait, son
    rattrapage d'erreur parle d'« un propriétaire qui corrige une faute de
    frappe » à qui elle rendait un 409.

    LES 71 PX SONT LE PRIX DU PLANCHER DE 44, ET C'EST TOUT. Deux boutons par
    ligne, chacun tenu à la cible minimale du dépôt, font passer une rangée de
    texte à une rangée de commandes : ~35 px par tarif. Les rendre plus petits
    tiendrait dans la boîte et ne se viserait plus au doigt, sur le téléphone
    d'entrée de gamme qui est le marché de ce produit.

    Refuser le geste au motif qu'il allonge la liste reviendrait à garder
    l'historique en lecture seule — c'est le même arbitrage que `ParkSettings`
    quatre entrées plus bas, et il se tranche pareil : le PIED RESTE TENU, donc
    l'action reste atteignable sans chercher.

    À 1280 la boîte a la place : zéro dans les deux polices, inchangé.
  */
  { nom: 'Tariffs', fichier: 'features/dashboard/TariffsModal.tsx', adresse: '/demo/releves', bouton: /^Prix de refacturation$|^Rebilling prices$/, defil: { 360: 82, 1280: 0 }, defilLarge: { 360: 126, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    48 → 325 px à 360, 0 → 70 à 1280 (2026-09-02) : LES RELANCES AUTOMATIQUES.

    Une case et un champ de jour entrent dans cette boîte, et le champ ne paraît
    que si la case est cochée — deux hauteurs de plus, dont une conditionnelle.

    Le défilement est celui d'un FORMULAIRE, pas d'un débordement : cette modale
    porte désormais le nom du parc, son pays, sa devise, sa politique de
    délégation et ses relances. Les refuser au motif qu'elles allongent
    reviendrait à interdire au parc d'avoir des réglages.

    325 → 581 px à 360, 70 → 294 à 1280 (2026-09-02, le même soir) : L'HEURE
    D'ENVOI ET SON FUSEAU. Deux champs de plus, conditionnés au même
    interrupteur que le jour. Le cron passe désormais toutes les heures et ne
    fait rien pour un parc dont ce n'est pas l'heure — c'est ce qui autorise
    l'heure à vivre ici plutôt que dans un tableau de bord d'hébergeur.

    CES QUATRE NOMBRES N'ONT PAS ÉTÉ RELEVÉS PAR CE SCRIPT. Un blocage
    d'autorisation du système de fichiers l'empêchait de servir `dist/` ; ils
    viennent d'une reproduction de sa méthode dans un navigateur — mêmes
    fenêtres 360×780 et 1280×900, langue posée en `localStorage`, et Verdana
    imposée comme le fait `police-large.mjs`. Les deux langues et les deux
    polices rendent la même valeur. La première exécution de CE script fait foi
    sur la mienne.
  */
  /*
    ═══ 581 → 603 ET 736 → 757 : LA PREMIÈRE EXÉCUTION DE CE SCRIPT A EU LIEU ═══

    Le paragraphe juste au-dessus le dit : « CES QUATRE NOMBRES N'ONT PAS ÉTÉ
    RELEVÉS PAR CE SCRIPT [...] La première exécution de CE script fait foi sur la
    mienne. » Elle a eu lieu le 2026-09-28, deux fois de suite, et elle rend :

      ParkSettings@360         fr 603  ·  en 517     (plafond tenu : 581)
      ParkSettings·devise@360  fr 757  ·  en 649     (plafond tenu : 736)
      ParkSettings@1280        fr 294  ·  en 251     (déjà juste)
      ParkSettings·devise@1280 fr 405  ·  en 362     (déjà juste)

    LA RÉPRODUCTION À LA MAIN S'ÉTAIT TROMPÉE SUR UN POINT PRÉCIS, et c'est celui
    qui compte : elle concluait que « les deux langues et les deux polices rendent
    la même valeur ». Les deux langues DIVERGENT de 86 px à 360 — le français
    compose plus long, et c'est lui qui fixe le plafond puisque l'entrée n'en porte
    qu'un par largeur. Un plafond calé sur l'anglais laisserait passer le
    français ; c'est exactement ce qui vient d'arriver.

    `defilLarge` N'EST PAS TOUCHÉ. Ce script n'a pas le témoin de machine que
    `plafond-hauteurs` et `plafond-vitrine` portent — il ne sait donc pas si la
    machine qui l'exécute possède la colonne qu'il juge. Faute de ce témoin, je
    n'écris que la colonne que les deux autres portes ont mesurée comme étant à
    nous, et je laisse la police large à l'intégration continue.

    CE QUE JE N'AI PAS FAIT, ET QUI SERAIT LE VRAI CORRECTIF : donner à ce script
    le témoin de machine de ses deux sœurs. C'est une pièce d'instrument, pas un
    correctif de produit, et ce lot n'a pas à la porter.
  */
  /*
    603 → 721 À 360, 294 → 408 À 1280, ET VOICI CE QUE LE PLAFOND ACHÈTE.

    Le CANAL de la relance, jusqu'ici écrit en dur dans la route : `sms` quand
    le message partait, `in_app` sinon. Une liste déroulante, son libellé et son
    aide, dans un formulaire qui en porte déjà dix.

    L'AIDE A ÉTÉ RACCOURCIE PLUTÔT QUE LE PLAFOND DESSERRÉ. Première rédaction :
    deux phrases, dont une qui expliquait que le produit écrit le canal
    RÉELLEMENT emprunté — 764 px. La seconde phrase dit une règle que la note du
    canal WhatsApp porte mieux, et au moment où elle compte ; la retirer rend 43
    px à 360 et 22 à 1280. Le reste est le champ lui-même, qui ne se réduit pas
    sans cesser d'être atteignable au doigt.

    CETTE BOÎTE EST DÉSORMAIS LA PLUS LONGUE DU REGISTRE, et je le dis plutôt que
    de le laisser découvrir : dix réglages dans une seule modale, dont cinq pour
    la seule relance. Un onglet ou une seconde boîte serait la réponse, et ce
    lot-ci n'est pas celui qui doit la faire — mais le prochain réglage qu'on y
    ajoute devrait payer ce découpage plutôt qu'un plafond de plus.
  */
  /* LA COLONNE LARGE VIENT DE L'EXÉCUTEUR : 699 et 591 à 360, 408 et 366 à
     1280. Elle avait gardé les 581 et 294 d'avant le canal de la relance, et la
     porte publique l'a refusé sur-le-champ — quatre états rouges. `complet` ne
     tourne QU'EN POLICE LARGE, donc cette machine ne fait jamais autorité ici. */
  /*
    ELLE A MAIGRI, ET C'EST CE FICHIER QUI L'A EXIGÉ.

    Le lot du canal de relance avait écrit ici : « CETTE BOÎTE EST DÉSORMAIS LA
    PLUS LONGUE DU REGISTRE […] le prochain réglage qu'on y ajoute devrait payer
    ce découpage plutôt qu'un plafond de plus. »

    Le 2026-10-05, l'appel automatique des loyers a été ce prochain réglage : la
    boîte est passée de 721 à 878 px à 360 en français, et cette porte l'a
    refusé sur ses douze états. Le découpage a donc été payé — les sept réglages
    d'automatisme sont partis dans `ParkAutomationModal`, et il ne reste ici que
    les quatre valeurs d'identité du parc : nom, pays, devise, délégation.

    LES DEUX COLONNES SONT MESURÉES, et non reproduites comme les nombres
    qu'elles remplacent. MAIS LA LARGE EST UN RELEVÉ *LOCAL* :
    `MESURER_EN_POLICE_LARGE=1` impose `Verdana, sans-serif`, que ce Mac possède
    et que l'exécuteur n'a pas — il retombe sur DejaVu. Mesuré ici sur une modale
    que ce lot ne touche pas, `Lease@1280` rend 268 px en local contre un plafond
    de 242 relevé là-bas : 26 px d'écart sur du code identique. Les `defilLarge`
    de ce lot peuvent donc être refusés par la porte publique, qui fait autorité —
    corriger alors depuis SON rapport, comme l'a fait le lot du canal de relance.
  */
  /* RELEVÉ : 48 px à 360 en français, 6 en anglais ; 0 aux deux langues à 1280.
     La colonne large rend 48 DANS LES DEUX LANGUES — Verdana amène l'anglais au
     niveau du français sans dépasser. 48 px de défilement sur une boîte de
     718 px est un corps normal, et le pied reste tenu aux quatre états. */
  { nom: 'ParkSettings', fichier: 'features/dashboard/ParkSettingsModal.tsx', adresse: '/demo/parc', bouton: /^Corriger le parc$|^Correct the park$/, defil: { 360: 48, 1280: 0 }, defilLarge: { 360: 48, 1280: 0 }, avant: { 360: 721, 1280: 408 } },
  /*
    LA MÊME MODALE, DEVISE CHANGÉE — un second état, et une note que personne
    n'atteignait.

    `notes-conditionnelles` avouait `app.parkSettings.currencyWarning` en
    désignant ce script : « le geste existe et il est mesurable ; il appartient
    à `modales`, qui tient déjà `ParkSettings` ». Il ne restait qu'à le faire.

    L'avertissement est purement CLIENT — `devise !== origine.currency` — donc
    la démonstration l'atteint sans serveur. Il change aussi le bouton de
    validation en `danger` : c'est un autre contenu ET une autre hauteur dans la
    même boîte.

    `note` est ce qui distingue cette entrée de la précédente : elle EXIGE que
    la note paraisse. Sans elle, un geste qui cesserait de changer la devise
    mesurerait l'état d'ouverture une seconde fois, en silence.
  */
  {
    nom: 'ParkSettings·devise', fichier: 'features/dashboard/ParkSettingsModal.tsx',
    adresse: '/demo/parc',
    bouton: /^Corriger le parc$|^Correct the park$/,
    apres: (page) =>
      page.locator('select[name="currency"]').selectOption('EUR'),
    note: /ne seront pas convertis|will not be converted/,
    /* 48 → 203 px à 360 en français, 138 en anglais : la note fait quatre lignes
       dans une langue et trois dans l'autre. C'est le prix d'un avertissement
       qu'on ne veut PAS raccourcir — il dit qu'aucun montant ne sera converti,
       et l'abréger sur un téléphone serait le rendre inoffensif là où il compte
       le plus. À 1280 il reste nul : la boîte a la place. */
    /* L'avertissement de devise s'ajoute aux relances : 480 px à 360, 178 à
       1280 — quatre lignes de plus dans une boîte qui en portait déjà six. */
    /* 480 → 736 px à 360, 178 → 405 à 1280 (2026-09-02, le même soir) :
       l'heure et son fuseau s'ajoutent à leur tour. L'écart avec l'entrée
       précédente reste celui de l'avertissement seul — 155 px à 360, 111 à
       1280 —, ce qui dit que les deux champs ont coûté la même hauteur dans
       les deux états, et non qu'ils interagissent avec la note.

       Mêmes réserves de provenance que ci-dessus : reproduction au navigateur,
       et non relevé par ce script. */
    /* 736 → 757 : voir le relevé du 2026-09-28, au-dessus de `ParkSettings`. */
    /* 757 → 875 à 360, 405 → 519 à 1280 : le canal de la relance s'ajoute à
       l'état d'ouverture, et cet état-ci le porte comme les autres. L'écart
       avec `ParkSettings` reste celui de l'avertissement de devise seul — 154
       px à 360, 111 à 1280 —, inchangé depuis le relevé précédent : le champ
       neuf coûte la même hauteur dans les deux états, il n'interagit pas avec
       la note. */
    /*
      875 → 203 À 360, 519 → 0 À 1280 (2026-10-05), après le départ des sept
      réglages d'automatisme. Les deux colonnes viennent du MÊME relevé, sur
      cette machine, à la même heure — et non d'une reproduction à la main comme
      les nombres qu'elles remplacent.

      LE NOMBRE EST EXACTEMENT CELUI DU 2026-09-02, avant que les relances
      n'entrent dans cette boîte : « 48 → 203 px à 360 en français, 138 en
      anglais ». Le découpage ne l'a pas amélioré, il l'a RENDU — c'est la
      géométrie de la note de devise seule, sur les quatre champs d'identité.
    */
    defil: { 360: 203, 1280: 0 },
    defilLarge: { 360: 203, 1280: 0 },
    avant: { 360: 875, 1280: 519 },
  },
  /*
    LE CANAL DE LA RELANCE, TROISIÈME ÉTAT DE LA MÊME BOÎTE — et il naît d'une
    contrainte que le code ne peut pas lever.

    Meta n'autorise un message WhatsApp SORTANT hors d'une fenêtre de 24 h après
    le dernier message du destinataire que s'il suit un MODÈLE qu'elle a
    approuvé. Une relance de loyer est non sollicitée : sans ce modèle, Twilio la
    refuse, la couture rend `false`, et la relance reste dans le produit.

    LA NOTE LE DIT AVANT LE CHOIX, et c'est pour cela qu'elle se mesure ici : la
    découverte naturelle de cette règle est un parc dont plus aucune relance ne
    part, sans rien à l'écran pour l'expliquer.

    `select[name="reminderChannel"]` — une VRAIE liste déroulante, comme la
    devise au-dessus. Le `Combobox` du dépôt pose son `name` sur un champ caché
    et n'aurait pas été atteignable ainsi.
  */
  {
    nom: 'ParkAutomation·whatsapp', fichier: 'features/dashboard/ParkAutomationModal.tsx',
    adresse: '/demo/parc',
    bouton: /^Automatismes du parc$|^Park automation$/,
    apres: (page) =>
      page.locator('select[name="reminderChannel"]').selectOption('whatsapp'),
    note: /modèle de message approuvé|message template approved/,
    /* 875 px à 360, 519 à 1280 — au pixel près les mêmes que l'état de la
       devise, et ce n'est pas une coïncidence utile : les deux ajoutent UNE
       note de quatre lignes en français à la même boîte. Les deux langues, en
       revanche, divergent : 875 contre 789, la phrase française portant
       « modèle de message approuvé par Meta » là où l'anglaise tient en moins.
       Le plafond retient la plus longue, comme partout dans ce fichier. */
    /*
      L'ÉTAT A CHANGÉ DE BOÎTE le 2026-10-05 : le canal de la relance est parti
      avec les six autres automatismes. Les deux colonnes sont remesurées — elles
      décrivent une boîte de sept réglages et non de onze.

      875 → 480 à 360, 519 → 181 à 1280. C'EST L'ÉTAT LE PLUS LONG DU REGISTRE,
      et il l'était déjà avant : la note de WhatsApp fait quatre lignes en
      français sous cinq réglages de relance. 480 px au lieu de 875, sans qu'une
      seule phrase ait été raccourcie.

      EN POLICE LARGE, L'ANGLAIS DÉPASSE LE FRANÇAIS À 1280 — 224 contre 181 —
      alors que l'inverse vaut à 360 et dans la colonne étroite. Verdana élargit
      « message template approved by Meta » plus que sa traduction, et à 1280 la
      boîte est assez large pour que la différence se joue sur le nombre de
      lignes. Le plafond retient la plus longue des deux langues, comme partout
      dans ce fichier : 501 à 360, 224 à 1280.
    */
    defil: { 360: 480, 1280: 181 },
    defilLarge: { 360: 501, 1280: 224 },
    avant: { 360: 875, 1280: 519 },
  },
  /*
    LES AUTOMATISMES DU PARC, À L'OUVERTURE — la boîte née du découpage.

    Elle porte les sept réglages qui faisaient de la correction du parc la plus
    longue boîte du registre : l'interrupteur des relances et ses quatre
    réglages, puis l'interrupteur de l'appel des loyers et son jour du mois.

    SON ÉTAT D'OUVERTURE N'EST PAS CELUI D'UNE BOÎTE VIDE : les deux
    interrupteurs décident de ce qui s'affiche sous eux. `autoReminders` naît à
    `true` — c'est l'ancien comportement du cron —, donc les quatre réglages de
    relance sont là. `autoRentCall` naît à `false`, donc le jour du mois ne l'est
    PAS, et c'est mesuré ainsi parce que c'est ce qu'un parc existant montre.
  */
  {
    nom: 'ParkAutomation', fichier: 'features/dashboard/ParkAutomationModal.tsx',
    adresse: '/demo/parc',
    bouton: /^Automatismes du parc$|^Park automation$/,
    /* RELEVÉ : 325 px à 360 en français, 260 en anglais ; 70 et 27 à 1280. En
       police large, 346 et 325 à 360, 70 et 113 à 1280 — et l'anglais y dépasse
       le français à 1280, pour la raison écrite à l'état WhatsApp ci-dessus. */
    defil: { 360: 325, 1280: 70 },
    defilLarge: { 360: 346, 1280: 113 },
    /* `avant` PORTE LES 721 DE LA CORRECTION DU PARC, et non un zéro : cette
       boîte ne naît pas de rien, elle naît d'un découpage. Le nombre dit d'où
       l'on vient — une seule boîte à 878 px — et non « ce lot a coûté ». */
    avant: { 360: 721, 1280: 408 },
  },
  { nom: 'AddBuilding', fichier: 'features/dashboard/AddBuildingModal.tsx', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$|^Add a building$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'AddUnit', fichier: 'features/dashboard/AddUnitModal.tsx', adresse: '/demo/parc', bouton: /^Ajouter un logement$|^Add a unit$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LES DEUX CORRECTIONS DU PARC, inscrites avec le lot qui les crée.

    Ce registre est ÉCRIT À LA MAIN et rien ne rougit quand une modale neuve
    l'oublie : deux boîtes de saisie neuves seraient restées hors de toute
    mesure de géométrie, de contraste et de cible — l'angle mort que
    `notes-conditionnelles` décrit pour les notes, ici transposé aux modales.

    Le bouton porte sa CIBLE — « Corriger le logement A1 » — parce que le geste
    se répète par ligne. Un motif large trouverait douze boutons.

    `note` sur la seconde : la note du loyer de référence ne paraît que sur un
    logement OCCUPÉ, et A1 en est un. Sans elle, un jour où la note cesserait
    d'être rendue, on mesurerait la modale nue en croyant mesurer les deux.
  */
  { nom: 'EditBuilding', fichier: 'features/dashboard/EditBuildingModal.tsx', adresse: '/demo/parc', bouton: /^Corriger l’immeuble Résidence Bonamoussadi$|^Edit building Résidence Bonamoussadi$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'EditUnit', fichier: 'features/dashboard/EditUnitModal.tsx', adresse: '/demo/parc', bouton: /^Corriger le logement A1$|^Edit unit A1$/, note: /ne changent pas|stay unchanged/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LA SAISIE D'UN RELEVÉ, née avec le lot qui rend vrai le mot « Refacturé ».
    Quatre états comme toute modale ordinaire. Les plafonds sont ceux du premier
    relevé de ce script — le geste n'a pas d'`apres`, la note de conséquence
    n'apparaissant qu'après un enregistrement, que la démonstration ne fait pas.
  */
  { nom: 'RecordReading', fichier: 'features/dashboard/RecordReadingModal.tsx', adresse: '/demo/releves', bouton: /^Saisir un relevé$|^Record a reading$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LA SAISIE D'UNE DÉPENSE, inscrite avec le lot qui la crée — et elle a failli
    ne pas l'être. `registresDesModales` était vert dès qu'elle entrait dans le
    registre CLAVIER : cette garde-là n'exige qu'une présence dans l'un des deux
    registres. Suffisant ne veut pas dire mesuré — ni sa hauteur, ni son pied
    atteignable, ni ses cibles au doigt n'auraient été relevés, exactement comme
    les quatre modales dont le commentaire plus bas raconte le rattrapage.
  */
  { nom: 'RecordExpense', fichier: 'features/dashboard/RecordExpenseModal.tsx', adresse: '/demo/depenses', bouton: /^Saisir une dépense$|^Record an expense$/, defil: { 360: 326, 1280: 103 }, defilLarge: { 360: 347, 1280: 125 }, avant: { 360: 0, 1280: 0 } },
  /* LES HONORAIRES — sur la ligne de Diane Fotso, la gestionnaire de la
     démonstration. Le bouton suit le RÔLE actif, donc il est ouvrable ici. */
  { nom: 'Fees', fichier: 'features/dashboard/FeesModal.tsx', adresse: '/demo/acces', bouton: /^Honoraires et relevé — Diane Fotso$|^Fees and statement — Diane Fotso$/, defil: { 360: 104, 1280: 0 }, defilLarge: { 360: 147, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LE BAIL ET SES SÛRETÉS — depuis le dossier d'un logement, derrière le menu de
    débordement de l'en-tête. `A1` a un bail courant ; un logement vacant ne rend
    pas l'entrée de menu.

    1196 → 434 px À 360, ET C'EST CETTE PORTE QUI L'A OBTENU. Première rédaction :
    les trois sections — congé, loyer, garants — déployées ensemble. Le pied
    tenait, la boîte ne débordait pas, aucune autre garde ne voyait rien ; il
    fallait simplement faire défiler tout le congé pour atteindre les garants, sur
    1196 px quand aucune autre boîte du produit ne dépasse 347.

    Inscrire 1196 comme plafond aurait désarmé la porte : elle existe pour refuser
    exactement ce corps-là. Trois boîtes séparées auraient coûté trois fois ces
    registres. Le dépliage — une seule section ouverte, le congé d'abord — est la
    troisième réponse, et la seule qui garde le panneau d'un bail dans une boîte.

    Le loyer COURANT reste visible même replié : c'est la donnée, pas le geste, et
    on ne décide pas d'une hausse sans elle sous les yeux. C'est ce qui explique
    les 153 px qui restent à 1280.

    434 → 523 À 360, ET CE QUE CES 89 px ACHÈTENT EST UNE QUATRIÈME SECTION.
    Le plan d'apurement s'installe ici plutôt que dans une boîte à lui : replié,
    il ne coûte que son en-tête — un bouton de 44 px, son filet et ses marges.
    C'est le prix EXACT du dépliage choisi au lot précédent, et c'est aussi ce
    qui le valide : une section de plus se paie en en-tête, pas en corps.

    À 1280 le relevé diverge par langue — 242 en français, 268 en anglais — et
    le plafond retient l'anglais, comme partout dans ce fichier : caler sur le
    français laisserait passer 26 px non vus sur la moitié du produit.

    LA COLONNE LARGE VIENT DE L'EXÉCUTEUR, ET ELLE EST PLUS BASSE QUE L'AUTRE.
    549 et 523 à 360 px en CI, 242 aux deux langues à 1280 ; la machine de
    développement rend 549 et 570, puis 268 et 268. Les deux colonnes ne se
    comparent pas : `complet` ne tourne QU'EN POLICE LARGE — c'est écrit dans le
    travail lui-même —, donc la CI ne mesure jamais `defil`, et cette machine ne
    fait jamais autorité sur `defilLarge`. Qu'un plafond large tombe SOUS son
    voisin étroit n'est donc pas une incohérence : ce sont deux relevés de deux
    machines, chacun gardé là où il est mesuré.
  */
  { nom: 'Lease', fichier: 'features/dashboard/LeaseModal.tsx', adresse: '/demo/parc/A1', bouton: /^Bail et sûretés$|^Lease and sureties$/, defil: { 360: 523, 1280: 268 }, defilLarge: { 360: 549, 1280: 242 }, avant: { 360: 1196, 1280: 747 } },
  /*
    LES CHARGES DU BAIL — et le premier lot de cette série à REFUSER une section
    de plus dans la boîte du dessus.

    `LeaseModal` porte quatre sections et 843 lignes, au-dessus du plafond de
    maintenabilité du dépôt. Une cinquième l'aurait poussée vers 1 100 lignes et
    son défilement de 523 à 612 px. Le dépliage repousse le moment où une boîte
    devient illisible ; il ne le supprime pas, et ce lot est celui où la
    repousser une fois de plus aurait coûté plus que séparer.

    DEUX SECTIONS ICI, dépliées comme là-haut : les charges convenues d'un côté,
    la régularisation de l'autre. Ouvertes ensemble, il faudrait parcourir toutes
    les lignes pour atteindre le décompte — exactement le défaut que la boîte du
    bail a payé en 1 196 px.
  */
  { nom: 'LeaseCharges', fichier: 'features/dashboard/ChargesModal.tsx', adresse: '/demo/parc/A1', bouton: /^Charges et régularisation$|^Charges and reconciliation$/, defil: { 360: 24, 1280: 0 }, defilLarge: { 360: 24, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    L'OUVERTURE D'UNE ANNONCE, sur l'écran de la vacance — né le même jour.
    Action PRIMAIRE et non menu de débordement : c'est le seul geste de cet
    écran, et on ne l'ouvre pas pour autre chose.
  */
  /* 80 px à 360 en français contre 37 en anglais — l'écart tient aux deux aides
     longues, celle qui dit que le loyer de référence du logement n'est PAS
     modifié et celle qui explique à quoi sert une date de disponibilité. Ni
     l'une ni l'autre ne se raccourcit : la première désamorce la crainte qui
     ferait renoncer à demander un autre prix, la seconde est tout l'intérêt du
     champ. Le plafond retient le français, comme partout ici. Zéro à 1280. */
  { nom: 'Listing', fichier: 'features/dashboard/ListingModal.tsx', adresse: '/demo/vacance', bouton: /^Ouvrir une annonce$|^Open a listing$/, defil: { 360: 80, 1280: 0 }, defilLarge: { 360: 80, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LES QUATRE MODALES QUE LE CLAVIER VIENT DE PRENDRE, et dont la géométrie ne
    l'était toujours pas. Leurs FICHIERS étaient couverts ici — `Tenants.tsx` par
    `RemoveTenant`, `Access.tsx` par `RevokeAccess` — ce qui suffisait à la garde
    de complétude, qui n'exige de ce registre-ci qu'une PRÉSENCE par fichier.
    Suffisant ne veut pas dire mesuré : ni la hauteur de « Créer une fiche
    locataire », ni son pied atteignable, ni ses cibles au doigt n'avaient jamais
    été relevés, sur le formulaire le plus long du produit.
  */
  /* Le nom accessible porte sa CIBLE depuis la refonte en fiches du
     2026-09-07 — « Corriger la fiche de Charles Ngassa » —, parce que dix
     entrées « Corriger » ne disent pas laquelle on active. Le script ouvre
     déjà les menus de débordement ; c'est le libellé qu'il fallait suivre. */
  { nom: 'CorrigerFiche', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Corriger la fiche de |’s record$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LE PLUS LONG FORMULAIRE DU PRODUIT, et il défile de 602 px à 360.

    Huit champs : le nom, l'indicatif, le numéro, le courriel, le compte à
    relier, le début du bail, le loyer, la caution. Le PIED RESTE TENU aux
    quatre états — c'est la propriété qui compte, et la seule qui rende un
    défilement acceptable : on atteint « Enregistrer » sans le chercher.

    Le raccourcir voudrait dire retirer des champs à la création d'une fiche, ou
    la couper en deux écrans. Ni l'un ni l'autre ne se décide dans un lot dont le
    sujet est la MESURE — le nombre est posé pour que la prochaine croissance se
    voie, pas pour la bénir.
  */
  { nom: 'CreerFiche', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Créer une fiche locataire$|^Create a tenant record$/, defil: { 360: 602, 1280: 239 }, defilLarge: { 360: 628, 1280: 261 }, avant: { 360: 0, 1280: 0 } },
  /* ANCRE EN PRÉFIXE, MÊME RAISON QUE `CorrigerFiche` CI-DESSUS : le nom
     accessible porte la PERSONNE depuis le lot du 2026-09-27 — « Relier à une
     fiche — Diane Fotso » —, parce que quatre boutons homonymes se suivaient sur
     cette liste. WCAG 2.5.3 impose que ce nom CONTIENNE le libellé visible, donc
     le libellé reste le début du nom et le préfixe est l'ancre exacte.

     TROUVÉE EN ROUGE, PAS ANTICIPÉE : ce lot-là a jugé cette porte hors de sa
     portée. Elle ne l'était pas — deux entrées de ce registre et une de
     `notes-conditionnelles` visaient les noms qu'il renommait. */
  { nom: 'RelierLaFiche', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Relier à une fiche|^Link to a record/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'OpenWork', fichier: 'features/dashboard/OpenWorkModal.tsx', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$|^Open a job$/, defil: { 360: 130, 1280: 0 }, defilLarge: { 360: 138, 1280: 0 }, avant: { 360: 1056, 1280: 913 } },
  { nom: 'RecordPayment', fichier: 'features/dashboard/RecordPaymentModal.tsx', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$|^Record a payment$/, defil: { 360: 460, 1280: 40 }, defilLarge: { 360: 493, 1280: 47 }, avant: { 360: 522, 1280: 236 } },
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
  { nom: 'Receipt', fichier: 'features/dashboard/ReceiptModal.tsx', adresse: '/demo/paiements', bouton: /Quittance|Receipt/, defil: { 360: 91, 1280: 0 }, defilLarge: { 360: 91, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
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
  { nom: 'Inspection', fichier: 'features/dashboard/InspectionModal.tsx', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$|^Record an inspection$/, defil: { 360: 345, 1280: 60 }, defilLarge: { 360: 425, 1280: 54 }, avant: { 360: 237, 1280: 0 } },
  { nom: 'Invite', fichier: 'features/dashboard/InviteModal.tsx', adresse: '/demo/locataires', bouton: /^Inviter par code$|^Invite by code$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    LE SECOND ÉTAT DE LA MÊME MODALE, et il en change la hauteur.

    Choisir « Gestionnaire délégué » retire le menu des logements et la note du
    code déjà pris, et pose à leur place une explication de quatre lignes — ce
    qu'on délègue vraiment. C'est un autre contenu dans la même boîte, donc un
    autre défilement, et il n'était mesuré nulle part.
  */
  {
    nom: 'InviteGestionnaire', fichier: 'features/dashboard/InviteModal.tsx',
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
    modale liste les logements sous chaque immeuble non coché.

    57 → 511 à 360, 0 → 331 à 1280 (2026-09-01, plus tard) : les EXCLUSIONS.
    Les cases restent visibles sous un immeuble coché — les décocher retranche —
    donc les douze logements de la démonstration paraissent tous, quel que soit
    l'état des coches. Le défilement est celui d'une LISTE qui dit tout le parc,
    et le refuser reviendrait à interdire les parcs de plus de trois logements.
    La grande chasse ne bouge pas : les cases sont étroites, la hauteur seule
    grandit — et c'est déjà ce que la première ligne de cette note disait.
  */
  /*
    NÉE AVEC `defilLarge` À ZÉRO, ET LA PORTE PUBLIQUE EN EST RESTÉE ROUGE
    QUATRE JOURS.

    `plafondDe` refuse une entrée SANS `defilLarge` — son commentaire dit
    pourquoi : « une modale ajoutée demain qui n'en porterait qu'un passerait au
    vert en mode police large sans être gardée ». Le cas prévu est l'ABSENCE.
    Celui-ci portait la clé, remplie de zéros : un gabarit qui se lit comme un
    relevé, et que rien ne distingue d'une modale qui ne défile vraiment pas —
    `AddBuilding` et `AddUnit` sont à zéro pour de bon.

    Conséquence : verte sur la machine de développement, qui ne pose pas le
    commutateur, et ROUGE sur chaque poussée depuis le 2026-08-31. Aucun de mes
    lots n'a lu ce rouge ; plusieurs ont écrit « check:navigateur à 0 ».

    LES CHIFFRES VIENNENT DE L'EXÉCUTEUR, PAS D'ICI. Relevé en police large —
    CI : 511 et 490 à 360 px, 331 aux deux langues à 1280. Machine de
    développement : 511 et 511, puis 379 et 357. On retient les valeurs de la
    CI, comme `ParkSettings` dont le plafond de 294 est déjà sous les 315 px
    d'ici : c'est la porte publique qui doit être verte, et un plafond posé sur
    la machine la plus large cesserait d'y refuser quoi que ce soit.
  */
  { nom: 'ConfierImmeubles', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Confier des immeubles$|^Assign buildings$/, defil: { 360: 511, 1280: 331 }, defilLarge: { 360: 511, 1280: 331 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Announce', fichier: 'features/dashboard/AnnounceModal.tsx', adresse: '/demo/locataires', bouton: /^Prévenir les locataires$|^Notify tenants$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Reply', fichier: 'features/dashboard/ReplyModal.tsx', adresse: '/demo/travaux', bouton: /^Répondre$|^Reply$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /* Le seul écran de la démonstration où le rôle change ce qui est rendu : la
     modale du locataire n'existe que pour lui. Le radio de profil est `sr-only`,
     donc invisible au sens de Playwright — d'où le clic FORCÉ, qui est ici la
     vérité du geste et non un contournement : à la souris, c'est l'étiquette
     qu'on vise, et elle est bien visible. */
  { nom: 'Report', fichier: 'features/dashboard/ReportModal.tsx', adresse: '/demo/travaux', profil: /Locataire|Tenant/, bouton: /^Signaler un problème$|^Report an issue$/, defil: { 360: 620, 1280: 250 }, defilLarge: { 360: 486, 1280: 189 }, avant: { 360: 0, 1280: 0 } },
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
  { nom: 'SettleDeposit', fichier: 'features/dashboard/Deposits.tsx', adresse: '/demo/cautions', bouton: /^Arbitrer$|^Settle$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 10, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'RemoveTenant', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Retirer la fiche de |^Remove .+’s record$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /* ANCRE EN PRÉFIXE — voir `RelierLaFiche`. « Retirer l'accès — Diane Fotso » :
     c'est le geste où l'homonymie coûtait le plus cher, quatre boutons
     identiques dont celui qu'on active retire l'accès de quelqu'un. */
  { nom: 'RevokeAccess', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Retirer l’accès|^Remove access/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
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
    nom: 'DeleteBuilding', fichier: 'features/dashboard/Portfolio.tsx',
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
  /*
    LE RETRAIT D'UN LOGEMENT, et son préalable est le même piège que celui de
    l'immeuble : les douze logements de la démonstration portent tous une
    histoire, donc leur croix est FERMÉE. Il faut en créer un pour que le geste
    s'ouvre — exactement comme `DeleteBuilding` crée son immeuble.

    LE MOTIF NE PEUT PAS ÊTRE LARGE. Treize croix portent un nom accessible sur
    cet écran, et douze disent « Retrait impossible — … ». C'est pourquoi le
    libellé fermé commence par l'ÉTAT et non par le geste : `^Retirer le
    logement ` ne trouve alors que celui qui s'ouvre. Le lot précédent s'est
    déjà fait prendre là-dessus du côté de l'immeuble, et cette garde l'avait
    signalé — « le bouton a été cliqué et aucune boîte de dialogue n'est
    apparue », quatre fois.
  */
  {
    nom: 'DeleteUnit', fichier: 'features/dashboard/Portfolio.tsx',
    adresse: '/demo/parc',
    bouton: /^Retirer le logement |^Remove unit /,
    prealable: async (page) => {
      await page.getByRole('button', { name: /^Ajouter un logement$|^Add a unit$/ }).first().click()
      await page.waitForTimeout(300)
      const boite = page.getByRole('dialog')
      await boite.getByLabel(/Numéro du logement|Unit number/).fill('Z9')
      await boite.getByLabel(/Surface \(m²\)/).fill('30')
      await boite.getByLabel(/Loyer mensuel|Monthly rent/).fill('90000')
      await boite.getByRole('button', { name: /^Enregistrer$|^Save$/ }).click()
      await page.waitForTimeout(400)
    },
    defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 },
    avant: { 360: 0, 1280: 0 },
  },
  /* LA RELANCE D'UN SEUL, née avec les fiches de locataire. Elle vit des deux
     côtés du seuil — sur la fiche de bureau et dans la colonne de geste des
     fiches mobiles —, sans quoi cette garde ne l'ouvrirait qu'à une largeur
     sur deux. Le geste ne paraît que sur un impayé ou un partiel ; la
     démonstration en porte quatre, donc le bouton existe aux deux largeurs. */
  { nom: 'RelancerLocataire', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Relancer .|^Send reminder — /, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'RemindOverdue', fichier: 'features/dashboard/Payments.tsx', adresse: '/demo/paiements', bouton: /^Relancer les retards$|^Chase arrears$/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
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
  /* ANCRE EN PRÉFIXE — voir `RelierLaFiche`. Le nom porte le LOGEMENT depuis le
     lot du 2026-09-27 : « Mettre en demeure — A3 ». Trois boutons se suivaient
     sous le même nom, sur le geste le plus lourd du produit. */
  { nom: 'FormalNotice', fichier: 'features/dashboard/Payments.tsx', adresse: '/demo/paiements', bouton: /^Mettre en demeure|^Serve notice/, defil: { 360: 0, 1280: 0 }, defilLarge: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
]
