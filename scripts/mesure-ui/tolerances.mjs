/**
 * LES TOLÉRANCES DE `mesure-ui` — des DONNÉES, et rien d'autre.
 *
 * Chaque entrée est une dispense NOMMÉE : un écart que la porte connaît, a
 * arbitré, et laisse passer avec son motif écrit. Elles vivent à part depuis le
 * 2026-10-02, non pour alléger un compte de lignes mais parce qu'elles ne sont
 * pas du même ordre que le reste — on les LIT pour comprendre une décision, on
 * ne les suit pas pour comprendre un parcours.
 *
 * LA PORTE REFUSE UNE DISPENSE QUI NE SERT PLUS : `dispensesInutiles`,
 * `plafondsMenteurs`, `creuxOrphelins` et leurs voisines sont restées dans
 * `mesure-ui.mjs`, car elles comparent ces tables à ce qui a été MESURÉ. Une
 * tolérance oubliée est une tolérance qui ment, et elle rougit.
 *
 * `FIGER_LES_ANIMATIONS` y est aussi : ce n'est pas une tolérance mais une
 * CONDITION DE MESURE, du CSS injecté pour qu'une transition en cours ne rende
 * pas une géométrie intermédiaire. Elle a sa place avec ce qui décide de ce
 * qu'on accepte de voir.
 *
 * Module PUR : l'importer n'exécute rien.
 */

/**
 * Neutralise ce qui bouge, AVANT de mesurer.
 *
 * `contrast-audit.js` documente déjà le piège pour les modales : elles s'ouvrent
 * en `scale(0.96) → scale(1)`, `getBoundingClientRect` rend la taille APRÈS
 * transformation, et un bouton de 44 px se mesure alors à 42. Une transition de
 * couleur en vol fausse de même le contraste. On fige donc animations et
 * transitions plutôt que d'attendre qu'elles finissent — attendre serait un
 * délai, et un délai est un pari.
 */
export const FIGER_LES_ANIMATIONS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
`

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
export const CIBLES_EXEMPTES = {
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
export const CONTRASTES_TOLERES = {
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
export const TOLERES = {
}

/**
 * Débordements LOCAUX tolérés, par SIGNATURE et non par point.
 *
 * POURQUOI LA CLÉ N'EST PAS `adresse@largeur`, comme celle de `TOLERES`. Un
 * même défaut de mise en page se répète sur tous les écrans qui portent le
 * composant fautif : les libellés de la barre basse débordent sur les 23
 * écrans, à trois largeurs, dans deux langues. Une clé par point aurait demandé
 * soixante-quatre entrées pour UN défaut, et la soixante-cinquième occurrence —
 * la régression — se serait perdue dans la liste.
 *
 * La signature est `balise.classes`, c'est-à-dire ce que le rapport imprime :
 * une entrée se recopie depuis le refus sans avoir à traduire.
 *
 * CHAQUE ENTRÉE PORTE SON PLAFOND, EN PIXELS MESURÉS. C'est ce qui empêche une
 * tolérance de devenir un blanc-seing : le défaut connu passe, le même défaut
 * AGGRAVÉ rougit. Et la garde du garde, plus bas, fait rougir toute entrée qui
 * ne couvre plus rien.
 *
 * ─── CE REGISTRE N'EST PAS VIDE, ET C'EST UN AVEU ────────────────────────
 *
 * `TOLERES` porte fièrement « AUCUNE ENTRÉE, et c'est le but ». Celui-ci est né
 * avec QUINZE motifs, parce que la règle qui l'accompagne n'avait jamais été
 * appliquée : elle a découvert d'un coup tout ce que quinze lots avaient laissé
 * passer. Les fermer d'abord et poser la règle ensuite aurait été plus joli et
 * moins vrai — la règle serait née sans avoir rien attrapé, et personne
 * n'aurait su ce qu'elle valait.
 *
 * IL EN RESTE NEUF, ET C'EST LA GARDE DU GARDE QUI A COMPTÉ. Les QUATRE défauts
 * visibles découverts au premier passage sont réparés — barre basse dont les libellés se chevauchaient, carte
 * d'alerte et carte de chantier dont la colonne de titre tombait à zéro, rangée
 * de constat dont la pastille recouvrait la date. Chaque réparation a fait
 * rougir la porte pour la bonne raison : « cette tolérance ne couvre plus
 * rien ».
 *
 * UNE RÉPARATION N'EFFACE PAS UNE ENTRÉE, ELLE EN EFFACE CE QU'ELLE VEUT. La
 * carte de chantier en a emporté TROIS d'un coup — titre, ligne de référence,
 * ligne d'origine n'étaient qu'un seul défaut vu trois fois ; la rangée de
 * constat en a emporté deux. Six entrées pour quatre défauts : LE NOMBRE
 * D'ENTRÉES NE MESURE PAS LE NOMBRE DE DÉFAUTS, et il ne faut pas lire les neuf
 * restantes comme neuf choses à faire.
 *
 * LES NEUF ONT ÉTÉ REGARDÉES, une par une, à leur point et à leur largeur. UNE
 * SEULE franchissait une frontière visible — le montant d'une tuile de KPI, qui
 * sortait de sa carte de 9 px à 700 px ; elle est RÉPARÉE, et son entrée est
 * tombée de 30 px sur 28 occurrences à 7 sur 8. Les huit autres restent dans
 * leur carte, avec 3 à 185 px de marge, et aucune ne heurte un voisin.
 *
 * AUCUNE DES NEUF N'A DISPARU POUR AUTANT, et c'est le piège de ce registre :
 * réparer le franchissement n'a pas effacé la signature, il a seulement fait
 * baisser son maximum. Une entrée survit à sa propre réparation en devenant
 * MENTEUSE. C'EST DÉSORMAIS GARDÉ : la porte imprime à chaque passage le
 * maximum RÉELLEMENT mesuré à côté du plafond inscrit, et rougit dès que
 * l'écart dépasse quatre pixels — voir la garde du plafond menteur.
 *
 * L'ŒIL S'EST TROMPÉ TROIS FOIS AVANT LA MESURE, et c'est pour cela que chaque
 * motif porte désormais une DISTANCE et non un adjectif : sur une capture, un
 * liseré de débogage marque la boîte et non la carte, et un texte qui déborde
 * dans le rembourrage de son parent ressemble trait pour trait à un texte qui
 * sort de la carte.
 */
/**
 * LES CREUX TOLÉRÉS — voir `MESURER_BLANC_IMPOSE`.
 *
 * Même doctrine que `DEBORDS_LOCAUX_TOLERES` : le défaut CONNU passe, le même
 * défaut AGGRAVÉ ne passe pas, et une tolérance qui ne couvre plus rien meurt.
 * Le plafond est le MESURÉ, sans marge : `MARGE_DE_PLAFOND` refuse un plafond
 * qui dépasse la réalité, parce qu'un plafond plus haut que son défaut blanchit
 * d'avance l'écart entre les deux.
 */
export const BLANCS_IMPOSES_TOLERES = {
  'div.on-dark relative flex shrink-0 flex-col overflow-hidden bg-ink text-on-dark pt-[calc(1.5rem+env(safe-area-inset-top)':
    {
      /* 208 → 223, ET C'EST MON GESTE QUI L'A PAYÉ. L'accroche du panneau est
         passée de `display-m` à `display-app` sous `xl` : elle occupe quinze
         pixels de moins, donc le creux du bas en gagne autant. Le motif ci-dessous
         reste vrai mot pour mot — c'est la même couleur sans bord —, mais le
         chiffre a changé pour une raison qui n'est pas une dérive, et la taire
         reviendrait à faire passer une aggravation pour l'état d'origine.
         La contrepartie est écrite dans `AuthLayout` : à 1024, « management »
         sortait de sa colonne et se faisait couper par le séparateur. */
      plafond: 223,
      motif:
        'LA BANDE DE MARQUE DES ÉCRANS D’AUTHENTIFICATION. Ce n’est pas une carte creuse, ' +
        'c’est l’encre de la PAGE : sa hauteur vient de la fenêtre, pas de sa voisine, et le ' +
        'formulaire d’en face la fixe à `min-h-screen`. Le vide du bas est de la couleur, et il ' +
        'n’a pas de bord — il n’y a rien à remplir sous l’argumentaire, et le remplir serait ' +
        'ajouter du texte pour occuper des pixels. ' +
        'CE N’EST PAS UN AVEU D’IMPUISSANCE : `lg:justify-between` a été essayé et RETIRÉ, ' +
        'mesuré à 2000 × 1090 — il poussait l’argumentaire tout en bas et les huit cents ' +
        'premiers pixels de la bande étaient vides, le titre commençant là où le formulaire ' +
        'd’en face avait déjà fini. Le vide en bas est le moins mauvais des deux, et c’est le ' +
        'seul relevé du produit où la sonde mesure juste et conclut à faux. ' +
        'Plafond = mesuré à 1024 px, la largeur où la bande est la plus haute par rapport à ' +
        'son contenu.',
    },
}

/*
  DEUX TOLERANCES DE PLUS SONT PARTIES, ET C'EST LA GARDE DU GARDE QUI L'A DIT.

  « 2 tolerance(s) locale(s) ne couvrent plus aucun debordement » — le montant
  d'une tuile de KPI, et la rangee de commandes de l'accroche. Elles ne sont pas
  devenues inutiles toutes seules : le lot qui a repare cinq debordements sous
  une police 11 % plus large a ferme leurs deux causes du meme geste.

  Le montant : les grilles d'indicateurs sont passees d'un cran — `lg` a `xl`
  pour trois colonnes, `xl` a `2xl` pour quatre — parce que la colonne calibree
  sur la police la plus etroite cessait de porter « 1 397 000 FCFA ». La rangee
  de l'accroche : `Button` ne porte plus `whitespace-nowrap`, donc une etiquette
  trop longue se replie au lieu de sortir de sa rangee.

  Une tolerance qui survit a la reparation de sa cause devient un blanc-seing.
  Celles-ci partent le jour meme.
*/
export const DEBORDS_LOCAUX_TOLERES = {
  /*
    ── ET LES HUIT AUTRES, QUI RESTENT DANS LEUR CARTE ────────────────────

    REGARDÉS, et le critère n'est plus l'œil : pour chacun on mesure le bord
    droit du contenu, celui de la CARTE qui l'entoure, et le bord gauche du
    VOISIN le plus proche sur la même bande. Aucun ne franchit sa carte, aucun
    n'en heurte un autre.

    POURQUOI CE CRITÈRE PLUTÔT QU'UNE CAPTURE. Trois de ces huit avaient été
    jugés « visibles » sur capture d'écran, à tort : le liseré de débogage
    marque la BOÎTE, pas la carte, et un texte qui sort de sa boîte pour entrer
    dans le rembourrage de son parent ne se distingue pas, à l'œil, d'un texte
    qui sort de la carte. La mesure les sépare ; l'œil non.

    QUATRE PORTENT LE MÊME CHIFFRE — trois pixels. Ce n'est pas une coïncidence :
    le contenu mange exactement le rembourrage de sa carte et s'arrête sur la
    bordure. C'est la marge la plus mince du lot, et le premier mot de plus la
    franchira.

    CE QUE CETTE TOLÉRANCE NE DIT PAS : que ces mises en page soient BONNES. Un
    montant collé à la bordure de sa carte est laid ; il n'est pas coupé, et
    c'est tout ce que cette règle sait juger.
  */
  'dd.numeric text-body font-medium': {
    plafond: 14,
    motif:
      'La commande « Consulter » dans un `<dd>`, /demo/mon-espace à 320 px. 3 PX de marge ' +
      'avant la bordure de la carte, aucun voisin sur la bande.',
  },
  'div.mt-3 flex flex-wrap items-center justify-between gap-2': {
    plafond: 14,
    motif:
      'Pied d’une quittance — « Payé le 3 août par Mobile Money » et son lien, à 360 px. ' +
      '3 PX de marge avant la bordure de la carte.',
  },
  'li.flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0': {
    plafond: 14,
    motif:
      'Ligne de demande de document, /demo/locataires à 320 px. 3 PX de marge avant la ' +
      'bordure de la carte.',
  },
  /* RETIRÉE, ET LE DÉFAUT AVEC. Elle tolérait « Mot de passe oublié ? » posé
     entre le champ et le bouton, dont le `-mr-2` dépassait de 8 px
     l'alignement des champs — « un défaut d'alignement, pas de débordement »,
     disait le motif. Le lien a rejoint la rangée d'étiquette de son champ et a
     perdu sa marge négative : il n'y a plus rien à tolérer. */
}

/**
 * UN MOT PLUS LARGE QUE SA BOÎTE — le débordement qu'aucune des deux règles ne voit.
 *
 * ═══ CE QUI A OUVERT CE TROU, ET COMMENT IL A ÉTÉ TROUVÉ ═══
 *
 * Le fil d'étapes de l'inscription a reçu ses libellés sous `sm` : quatre
 * colonnes de 66 px à 320. « Récapitulatif » en demande 71 — treize lettres
 * qu'aucune espace ne coupe. Le mot sortait donc de sa colonne et passait sous
 * le voisin. Trouvé À L'ŒIL, au navigateur, sur un écran ; c'est-à-dire de la
 * façon dont on ne trouve pas les suivants.
 *
 * ═══ CE QUE LES TROIS RÈGLES EXISTANTES VOIENT, ET CE QU'ELLES MANQUENT ═══
 *
 * La première rédaction de cet en-tête n'en comptait que DEUX et concluait que
 * rien ne pouvait voir le défaut. C'était faux, et c'est une mutation qui l'a
 * dit : le fil d'étapes rendu sans césure fait rougir `DEBORDS_LOCAUX`, pas
 * cette règle-ci. Le partage est plus fin que « il manquait une garde ».
 *
 *  — LA RÈGLE DE PAGE mesure `documentElement`. Un mot qui sort DE SA BOÎTE ne
 *    sort pas du DOCUMENT : la colonne voisine absorbe la sortie, la page reste
 *    à 360 px. Relevé exactement ainsi ici — `document.scrollWidth -
 *    clientWidth` valait 0 pendant que le mot dépassait de 5 px.
 *
 *  — LA RÈGLE DE ROGNAGE (`MESURER_TRONCATURES`) est bornée à
 *    `[data-indicateur] [data-intitule]`, et regarde le défaut INVERSE : une
 *    boîte à `overflow: hidden` qui COUPE ce qu'elle ne peut pas montrer.
 *
 *  — LA RÈGLE DES DÉBORDS LOCAUX compare des BOÎTES : une forme dont le
 *    rectangle sort du rectangle de son conteneur. Elle voit donc le libellé du
 *    fil d'étapes, dont la boîte elle-même dépassait de son `<li>`.
 *
 * CE QU'AUCUNE DES TROIS NE VOIT, et c'est exactement ce trou-ci : une LIGNE DE
 * TEXTE plus large que sa boîte, quand la boîte, elle, reste sagement dans son
 * conteneur. L'accroche du panneau de marque en est le cas pur — le `<p>` fait
 * 284 px et ne dépasse de rien ; c'est la ligne rendue à l'intérieur qui en fait
 * 345 et vient couper « management » sur le séparateur. La porte était VERTE
 * avec ce défaut livré. Vérifié par mutation : rendre son `display-m` à cette
 * accroche fait rougir cette règle-ci, et elle seule.
 *
 * ═══ POURQUOI `overflow: visible` EST LE CRITÈRE, ET NON UN OUBLI ═══
 *
 * Une boîte qui déclare `hidden`, `auto` ou `scroll` a PRÉVU le débordement :
 * elle rogne, ou elle laisse défiler, et dans les deux cas quelqu'un l'a voulu.
 * `visible` est l'aveu contraire — rien n'était prévu, et le contenu sort sur
 * ses voisins. C'est ce qui distingue un défaut d'un choix, et c'est ce qui rend
 * cette règle silencieuse partout où le dépôt fait exprès.
 *
 * Les trois autres exclusions sont du même ordre :
 *   `nowrap`/`pre`   — le retour à la ligne est INTERDIT par l'auteur ; la
 *                      largeur du texte n'est alors plus une question de boîte.
 *   `display: inline`— une boîte en ligne n'a pas de largeur propre, son
 *                      `clientWidth` vaut 0, et tout y déborderait.
 *   les non-feuilles — `scrollWidth` d'un conteneur compte ses descendants, y
 *                      compris ceux qu'un enfant positionné fait sortir. On
 *                      mesure le TEXTE, pas la mise en page.
 *
 * ═══ CE QUE LA RÈGLE COÛTE, MESURÉ AVANT DE L'ÉCRIRE ═══
 *
 * 107 feuilles examinées sur `/demo/parc` à 360, 21 sur `/inscription` : zéro
 * défaut sur les deux. La règle n'est donc pas un filet à faux positifs qu'il
 * faudrait aussitôt doter d'un registre de tolérances — elle est muette là où
 * le produit va bien, ce qui est la seule preuve utile avant d'en ajouter une.
 *
 * ═══ CE QU'ELLE NE VOIT PAS ═══
 *
 * Le rognage EN HAUTEUR d'une boîte `visible` : un texte trop haut sort par le
 * bas sans que `scrollHeight` en dise rien, puisque la boîte grandit. C'est un
 * autre défaut, qui demande de connaître la hauteur ATTENDUE, et rien ici ne la
 * connaît. Non mesuré, et dit.
 */
/**
 * CE QUE LA RÈGLE A TROUVÉ LE JOUR OÙ ELLE EST NÉE, ET QUI N'EST PAS RÉPARÉ.
 *
 * ═══ LA TABLE EST VIDE, ET C'EST UN RÉSULTAT, PAS UN OUBLI ═══
 *
 * La règle a trouvé SEPT textes distincts à sa naissance, sur les 506 points du
 * balayage. Les sept ont été réparés, en trois lots, et chacun par un remède
 * différent — c'est ce qui rend la liste utile à garder ici :
 *
 *   « Rental management, held like an estate. »   une taille de corps en `vw`
 *      dans une colonne en `%` : `display-app` jusqu'à `xl`.
 *   « Récapitulatif »                             un interlettrage de CAPITALES
 *      appliqué à du bas-de-casse : `tracking-normal`, puis `hyphens-auto`.
 *   « Mes paiements par période », « Contrat de bail signé »
 *      un voisin `shrink-0` contre un texte `min-w-0` : repli à plancher.
 *   « 950 000 FCFA », « 447 000 FCFA »            même forme, dans l'accroche.
 *   « 17 622 FCFA »                               un seuil de FENÊTRE sur une
 *      grille rendue dans deux contenants de largeurs différentes : `@container`.
 *
 * AUCUN N'A ÉTÉ RÉPARÉ EN COUPANT LE TEXTE, et les trois montants disent pourquoi
 * la tentation devait être écartée : `Intl` les compose avec des espaces
 * INSÉCABLES — « 950 000 FCFA » est un seul jeton de douze caractères — et une
 * césure dans un nombre en change la lecture. Le remède d'un montant qui déborde
 * est toujours de lui rendre la place.
 *
 * ═══ CE QUE LA TABLE ATTEND D'UNE FUTURE LIGNE ═══
 *
 * Un plafond ÉGAL au mesuré, sans marge — `plafondsTropHauts` refuse le mou —
 * et une clé qui est le TEXTE EXACT : un libellé réécrit n'hérite pas de la
 * dispense accordée à un autre. La table est vide aujourd'hui ; la garde du
 * garde fait mourir toute ligne qui cesserait de couvrir quelque chose.
 */
export const MOTS_DEBORDANTS_TOLERES = [

  /* LES DEUX TITRES ÉCRASÉS SONT PARTIS, et leur remède mérite d'être gardé ici
     parce que la même forme reviendra ailleurs : un voisin `shrink-0` à côté
     d'un texte `min-w-0` ne négocie pas — le texte cède tout, jusqu'à zéro.
     Mesuré avant : 70 px pour le `<h2>` du portail pendant que sa légende en
     gardait 230 ; 46 px pour « Contrat de bail signé », dont le premier mot en
     réclame 49. Le remède n'est pas la troncature, qui ferait taire la garde en
     laissant l'écran mentir — c'est le REPLI, qu'il faut armer d'un plancher :
     sans `min-w`, `flex-wrap` ne se déclenche jamais. Voir `CardHeader`. */
]
