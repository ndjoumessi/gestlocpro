/**
 * LES DEUX GRILLES DE RANGÉE D'INDICATEURS, écrites une fois.
 *
 * CE QU'ELLES REMPLACENT : douze littéraux de classes dans six écrans — la
 * rangée CHARGÉE et son SQUELETTE, deux fois par écran — et TROIS copies de la
 * même justification mesurée, recopiée mot pour mot dans les relevés, les
 * encaissements et les cautions.
 *
 * LE COÛT N'ÉTAIT PAS L'ESPACE, C'ÉTAIT LA DÉRIVE SILENCIEUSE. Un écran dont le
 * squelette et la rangée chargée portent deux littéraux distincts peut les voir
 * s'éloigner sans que rien le dise : le squelette n'apparaît jamais dans les
 * tests, jamais dans la vitrine, jamais sous une porte. C'EST ARRIVÉ. L'espace
 * locataire attendait sous quatre cartes égales et chargeait trois cartes
 * inégales — voir `SkeletonStatRow`.
 *
 * On ne partage QUE ce qui est réellement identique. L'espace locataire garde
 * sa grille propre, `lg:grid-cols-[1.4fr_1fr_1fr]`, parce que sa première carte
 * porte le loyer et les deux autres des consommations : la ranger de force ici
 * ferait une constante à trois cas, c'est-à-dire trois littéraux sous un seul
 * nom.
 */

/**
 * TROIS COLONNES SEULEMENT QUAND LA CARTE PEUT PORTER UN MONTANT.
 *
 * `sm:grid-cols-3` les posait dès 640 px. Mesuré à 700 px : la carte offre
 * 159 px de contenu, « 1 397 000 FCFA » en demande 189, et le montant FRANCHIT
 * la bordure de 9 px — les cautions le font deux fois sur le même écran. Rien
 * ne pouvait le couper : `Intl.NumberFormat` pose une espace INSÉCABLE avant la
 * devise, donc un montant est insécable de bout en bout et `whitespace-nowrap`
 * n'y est pour rien. Le seul levier est la largeur de colonne.
 *
 * Deux colonnes jusqu'à `xl`, trois ensuite. `md` (768 px) ne suffisait deja pas —
 * il en faudrait environ 790 pour que trois cartes portent ce montant avec la
 * police la plus etroite — et `lg` ne suffit plus avec la plus large : voir le
 * bloc juste au-dessus de la constante. C'est l'arbitrage de
 * `GRILLE_QUATRE_INDICATEURS`, qui attend `xl` puis `2xl`.
 *
 * Employée par les relevés, les encaissements et les cautions.
 */
/*
  ET LE MEME ARBITRAGE, REFAIT SUR UNE AUTRE POLICE — `lg` devient `xl`.

  Tout ce qui precede a ete mesure sur la police systeme de macOS. `--font-sans`
  commence par `system-ui`, qui designe un dessin DIFFERENT par systeme : sur un
  executeur Ubuntu, ou il vaut DejaVu Sans, « Creer mon espace » rend 146,14 px
  contre 132,61 ici — onze pour cent de plus. Le montant grandit d'autant, et la
  colonne calibree sur la police la plus etroite cesse de le porter.

  Mesure le 2026-08-30, `/demo/paiements@1024/en-US`, police large : le montant
  « 1 397 000 FCFA » franchit de nouveau la bordure. Les trois colonnes passent
  donc a `xl`.

  CE QUE CA COUTE, ET IL FAUT LE DIRE : entre 1024 et 1279 px, la rangee montre
  DEUX cartes au lieu de trois. C'est une perte de densite sur un ordinateur
  portable, consentie pour qu'un montant ne sorte pas de sa carte chez qui n'a
  pas les polices d'Apple — c'est-a-dire, sur le marche vise, presque tout le
  monde.
*/
export const GRILLE_TROIS_INDICATEURS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'

/**
 * TROIS COLONNES À `xl`, QUATRE À `2xl`, pour la raison ci-dessus portée d'un
 * cran : quatre cartes qui doivent chacune loger un montant reclament ~1050 px
 * avec la police la plus etroite, et sensiblement plus avec la plus large.
 *
 * Employée par le tableau de bord et le parc.
 */
/*
  DEUX COLONNES, PUIS QUATRE. JAMAIS TROIS — et le premier jet s'y était trompé.

  ═══ POURQUOI PAS TROIS ═══

  QUATRE CARTES NE SE RANGENT PAS EN TROIS COLONNES. La quatrième reste seule
  sur sa ligne, et ce n'est pas une imperfection de goût : une rangée
  d'indicateurs se lit EN TRAVERS, et l'orpheline se lit comme une cinquième
  chose, d'une autre nature.

  Ce cran a pourtant été posé ici, ce matin même, pour une raison qui était
  bonne — éviter deux cartes de six cents pixels entre 1280 et 1535 — et sans
  regarder ce qu'il produisait. Vu ensuite sur une CAPTURE DE PRODUCTION, à
  1440 px : trois cartes, puis « Taux d'occupation » tout seul dessous.

  ═══ LES DEUX MESURES QUI ENCADRENT LE CHOIX ═══

  Relevé le 2026-08-30 en police large, sur `/demo` :

    largeur   deux colonnes   quatre colonnes
     1280        472 px          186 px de contenu — « 1 397 000 FCFA » en
                                 demande 199 : DÉBORDE de treize pixels
     1440        552 px          tiendrait, mais voir ci-dessous
     1536        600 px          292 px de carte — tient largement

  Quatre colonnes ne peuvent donc pas commencer à `xl`. Elles commenceraient
  volontiers vers 1400, où elles cessent de déborder ; ESSAYÉ ET ABANDONNÉ.
  Tailwind range les points de rupture personnalisés AVANT les siens, quelle que
  soit leur position dans `@theme` : la règle était bien émise en
  `@media(min-width:1400px)` — vérifié dans la feuille livrée — et
  `sm:grid-cols-2`, écrite plus loin, l'emportait dans la cascade. Un jeton mort
  vaut moins que rien ; il a été retiré.

  ═══ CE QUE CE CHOIX COÛTE, ET IL EST RÉEL ═══

  De 1280 à 1535, chaque carte porte un nombre de deux cents pixels dans une
  boîte de cinq cents. C'est large. C'est aussi ce que la garde du BLANC IMPOSÉ
  de `mesure-ui` surveille, et elle balaie ces largeurs.

  On échange donc du blanc contre une rangée qui se lit. Entre une carte trop
  généreuse et une carte esseulée, la seconde est la seule qui fasse douter le
  lecteur de ce qu'il regarde.

  ═══ ET `2xl` DOIT ÊTRE MESURÉ ═══

  `LARGEURS`, dans `scripts/mesure-ui.mjs`, s'arrêtait à 1440 : porter les
  quatre colonnes à 1536 les mettait hors de portée de toute mesure. 1536 est
  entré dans les largeurs balayées le même jour.
*/
export const GRILLE_QUATRE_INDICATEURS = 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-4'
