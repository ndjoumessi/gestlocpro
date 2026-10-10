/**
 * CE QUE REÇOIT QUELQU'UN QUI ARRIVE — le premier chargement, et sa fuite.
 *
 * Le budget porte sur ce qui part SUR LE FIL, pas sur ce qu'un fichier pèse au
 * repos : ce dépôt a déjà confondu les deux, et le bord de l'hébergeur
 * compressait déjà. `mesurerFuite` garde l'autre bout — un module réservé à
 * l'application qui entre dans le paquet de la vitrine est du poids payé par
 * quelqu'un qui n'en verra jamais l'usage.
 *
 * Module PUR : l'importer n'exécute rien.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { RACINE } from './contexte.mjs'
import { modulesReservesALaLangueParesseuse, modulesReservesALApplication } from './adresses.mjs'

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
export function mesurerFuite() {
  const chemin = join(RACINE, '.carte-des-paquets.json')
  const carte = JSON.parse(readFileSync(chemin, 'utf8'))
  const langue = modulesReservesALaLangueParesseuse()
  const reserves = [...modulesReservesALApplication(), ...langue]

  const fautifs = []
  for (const [nomPaquet, info] of Object.entries(carte)) {
    if (info.isDynamicEntry) continue // C'est là qu'ils ONT LE DROIT d'être.
    for (const module of info.modules) {
      if (reserves.includes(module)) fautifs.push({ module, paquet: nomPaquet })
    }
  }
  return { fautifs, reserves, langue }
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
export function mesurerPremierChargement() {
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

  /*
    LOCAUX SEULEMENT, ET L'EXCLUSION EST DÉSORMAIS CHIFFRÉE.

    Ce budget porte sur ce que CE dépôt construit et sert : une ressource d'une
    autre origine n'est pas dans `dist/`, donc `readFileSync` ne peut pas la
    peser. La règle est juste et elle reste.

    CE QUI NE L'ÉTAIT PAS : la ligne d'avant écartait la police en renvoyant à
    « l'argumentaire complet » d'`index.html`, en la disant « déjà mesurée et
    tranchée ailleurs ». L'argumentaire existe bel et bien — une seule famille,
    plage de graisse bornée, repli de même nature, `display=swap` — mais il
    argumente un CHOIX DE DESSIN et ne pèse rien. Aucun octet n'était écrit nulle
    part. Ce budget excluait donc un poids réel en s'appuyant sur un renvoi vers
    une mesure qui n'existait pas, ce qui est exactement la forme de silence que
    ce fichier reproche ailleurs à une garde qu'on ne lance pas.

    `RESSOURCES_EXTERNES_PESEES`, plus bas, porte les octets et la méthode. Ils
    ne sont pas ADDITIONNÉS au budget — le seuil de dérive garde la croissance
    des dictionnaires, pas le poids d'une fonderie qui ne bouge pas d'un lot à
    l'autre — mais ils sont IMPRIMÉS à côté de lui, à chaque passage, et une
    garde refuse dès que l'adresse pesée n'est plus celle qui est servie.
  */
  const tous = [...scripts, ...styles]
  const locaux = tous.filter((href) => href.startsWith('/'))
  const externes = tous.filter((href) => !href.startsWith('/'))

  const detail = locaux.map((href) => {
    const octets = gzipSync(readFileSync(join(RACINE, 'dist', href.replace(/^\//, '')))).length
    return { href, octets }
  })
  return { octets: detail.reduce((a, d) => a + d.octets, 0), detail, externes }
}

/**
 * CE QUE LE BUDGET N'EMBARQUE PAS, PESÉ ET DATÉ.
 *
 * MESURÉ LE 2026-08-30, agent utilisateur Android d'entrée de gamme, langue
 * française — c'est-à-dire le visiteur du marché visé :
 *
 *   1 708 o   la feuille `css2` elle-même, qui déclare QUATRE `@font-face`
 *             découpés par `unicode-range` ;
 *  27 272 o   le seul sous-ensemble que le français et l'anglais emploient
 *             (`U+0000-00FF`), en woff2 ;
 *  ────────
 *  28 980 o   ce qu'un premier visiteur télécharge EN PLUS des 155 430 o que
 *             cette garde compte — soit 19 % de plus, invisibles à elle.
 *
 * Les trois autres sous-ensembles — cyrillique, grec, vietnamien — ne sont
 * jamais demandés par ces deux langues, et ne sont donc pas comptés ici. Ils
 * le deviendraient le jour où le produit parlerait une de ces langues.
 *
 * CE QUE CES OCTETS COÛTENT EN PLUS DE LEUR TAILLE, et qui ne se mesure pas en
 * octets : DEUX origines à résoudre avant la première peinture
 * (`fonts.googleapis.com` puis `fonts.gstatic.com`), et une feuille de style
 * BLOQUANTE — `display=swap` gouverne le fichier de police, jamais la requête
 * CSS qui le déclare. Sur le réseau visé, c'est ce délai-là qui se voit, pas
 * les vingt-neuf kilo-octets.
 *
 * POURQUOI CE NOMBRE EST ÉCRIT ET NON MESURÉ À CHAQUE PASSAGE. Le mesurer
 * demanderait d'aller le chercher sur le réseau, donc de rendre cette porte
 * dépendante d'une sortie vers un tiers — exactement le défaut que
 * `plafond-vitrine.mjs` vient de fermer de l'autre côté. Un nombre écrit se
 * périme ; c'est pourquoi il ne vit pas seul, et que la garde ci-dessous refuse
 * dès que l'ADRESSE change. On ne peut pas oublier de remesurer sans que le
 * diff le dise.
 *
 * TRANCHÉ LE 2026-09-07, par Nelson : la police est hébergée dans le produit
 * (`public/polices/`, un sous-ensemble latin de 27 Ko, préchargé, rangé par
 * l'agent de service). Les deux origines et la feuille bloquante sont parties,
 * et ces octets entrent désormais dans les plafonds de `poids-ecrans` — relevés
 * avec ce motif. La table est VIDE, et la garde ci-dessous reste : le jour où
 * une ressource tierce reviendrait, elle arriverait « servie, jamais pesée ».
 */
export const RESSOURCES_EXTERNES_PESEES = {}

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
 *
 * ═══ LE SIGNAL EST TOMBÉ, ET IL AVAIT RAISON ═══
 *
 * La marge de 3 990 o s'est épuisée en vingt-six lots — la prévision disait
 * vingt-cinq. Le dépassement s'est produit à 149 071 o, soixante et onze
 * octets au-dessus, sur un lot qui ajoutait vingt-deux clés de dictionnaire
 * (quarante-quatre chaînes, français et anglais) pour la file du jour.
 *
 * REMESURÉ AVANT DE RELEVER, et cette fois par la STRUCTURE plutôt que par le
 * rythme — c'est une mesure plus forte, parce qu'elle dit ce qu'on peut
 * récupérer et non seulement à quelle vitesse on consomme. `src/i18n/fr.ts`,
 * gzippé section par section :
 *
 *   app         61 247 o bruts   20 223 o gzip   ← les écrans, jamais lus en vitrine
 *   marketing    9 419 o           3 845 o
 *   auth         8 207 o           3 239 o
 *   common       6 494 o           2 994 o
 *   nav          2 165 o           1 094 o
 *   le reste     2 145 o           1 343 o
 *
 * Un prospect qui lit la page d'accueil et ne s'inscrit jamais télécharge donc
 * 20 223 o de chaînes d'écrans — 13,6 % de son premier chargement — pour des
 * mots qu'il ne verra pas. C'est le chiffre qui manquait à la note d'origine,
 * et il est acquis : personne n'aura à le remesurer.
 *
 * LA SORTIE EST PRÊTE ET NON PRISE, et il faut dire pourquoi. La frontière
 * existe déjà — `App.tsx` charge `EspaceApplicatif` par `lazy()`, « la SEULE
 * frontière qui compte » selon son propre commentaire — et le dictionnaire ne
 * la respecte pas : `I18nProvider` importe `fr` en entier, impatiemment. Sortir
 * la section `app` dans un module chargé par la MÊME promesse rendrait ces
 * 20 Ko sans qu'aucun écran ne puisse se rendre avant ses mots.
 *
 * Ce lot ne le fait pas parce qu'il refait la MISE EN PAGE des écrans, et
 * qu'échanger ce chantier contre un chantier de chargement serait exactement la
 * dérive qu'on vient de reprocher à cette branche : faire le mesurable à la
 * place du demandé.
 *
 * LE NOUVEAU NOMBRE : 156 000, soit 6 929 o de marge sur le mesuré. À la
 * croissance moyenne relevée plus haut — 156 o par lot — cela couvre une
 * quarantaine de lots, et une dizaine au rythme du plus gros bond observé. La
 * refonte en cours touche encore une vingtaine d'écrans, chacun apportant ses
 * clés : la marge est dimensionnée pour ELLE, pas pour le régime ordinaire.
 *
 * ═══ LA SCISSION A ÉTÉ TENTÉE, ET REFUSÉE — VOICI CE QU'ELLE COÛTE ═══
 *
 * Le chiffre de 20 223 o tient. Ce qui ne tenait pas, c'est « la frontière
 * existe déjà, le dictionnaire ne la suit pas » : elle existe, mais le côté
 * IMPATIENT emprunte le dictionnaire applicatif à VINGT endroits, comptés.
 *
 *   app.crash.title / body / details          `FrontiereDErreur`
 *   app.offline.title / body                  `CadreDuParc`
 *   app.parkFailure.* (5 clés)                `CadreDuParc`, `RequireAuth`
 *   app.sessionFailure.* (3 clés)             `RequireAuth`
 *   app.dashboard.chartTitle / openMonth      `Hero` — la page d'accueil
 *   app.dashboard.scalePrimary / Secondary    `Charts`, primitive partagée
 *   app.works.samples.*                       `workTitle`, données de démo
 *   app.exported                              `useCsvExport`
 *
 * LE PREMIER GROUPE EST RÉDHIBITOIRE, et c'est lui qui a arrêté le lot : une
 * FRONTIÈRE D'ERREUR dont le message d'erreur vivrait dans un morceau chargé
 * paresseusement est une contradiction. Le cas où elle sert est précisément
 * celui où un morceau n'a pas pu se charger. Elle rendrait alors ses clés en
 * clair — « app.crash.title » sur un écran blanc — c'est-à-dire le pire écran
 * que ce produit puisse montrer, au pire moment.
 *
 * CE QU'IL FAUDRAIT VRAIMENT FAIRE, et pourquoi c'est un lot et non un geste :
 * ces vingt clés ne sont pas mal rangées par accident. Un message de panne, un
 * libellé d'export, la légende d'un graphique de vitrine ne sont PAS des
 * chaînes d'application — elles sont sous `app.` parce que tout y était. Les
 * sortir demande de les renommer, donc de toucher huit modules dont deux
 * primitives partagées, et de refaire passer `check-i18n` et la parité.
 *
 * Une scission faite À MOITIÉ — garder les vingt sous `app.` et fusionner en
 * profondeur les deux moitiés — marche, et j'ai commencé par là. Elle échoue
 * SILENCIEUSEMENT si l'on en oublie une : la clé s'affiche en clair, et rien
 * dans le typage ne le dit, puisque le TYPE reste entier des deux côtés.
 * Livrer ça en fin de course, sans garde capable de distinguer les modules
 * impatients des autres, aurait été un mauvais échange.
 *
 * Le budget reste donc à 156 000. Le prochain rouge n'aura plus à mesurer —
 * ni le prix, ni l'obstacle.
 *
 * ═══ LE PROCHAIN ROUGE A EU LIEU : 2026-09-05, À HUIT OCTETS ═══
 *
 *     ✗ premier chargement de la vitrine à 156 008 o, au-delà du budget de 156 000
 *
 * Le lot qui l'a déclenché — corriger une fiche locataire — ajoute dix-huit clés
 * dans les deux dictionnaires. REMESURÉ plutôt que supposé, en construisant deux
 * fois et en comparant les mêmes deux fichiers : 156 805 o sans le lot,
 * 156 949 o avec, soit +144 o. (Les absolus diffèrent de ceux du rapport — `gzip`
 * en ligne de commande ne compresse pas comme `zlib` ici — mais l'ÉCART, lui,
 * est mesuré par une seule et même méthode.)
 *
 * 144 OCTETS, SOUS LA MOYENNE DE 156 o PAR LOT relevée plus haut. Ce lot n'est
 * donc pas gourmand : la marge de 6 929 o est simplement DÉPENSÉE, et il n'en
 * restait que 136 avant lui. C'est exactement ce que ce nombre existe pour dire.
 *
 * LE NOUVEAU NOMBRE : 160 000, soit 3 992 o de marge sur le mesuré, environ
 * vingt-cinq lots au rythme documenté. Ce qu'il COÛTE, chiffré à la vitesse de
 * référence de `poids-ecrans` : 4 000 o de plus à 400 kb/s font 80 ms sur un
 * premier chargement qui en prend déjà 3 120. C'est le prix qu'on paie, et il
 * est dit plutôt que caché derrière un nombre relevé en silence.
 *
 * CE QUI RESTE LE VRAI CORRECTIF est écrit vingt lignes plus haut et n'a pas
 * bougé : sortir de `app.` les vingt clés qu'un module IMPATIENT emprunte, puis
 * scinder le dictionnaire. Relever le budget ne fait que reculer l'échéance —
 * une quatrième fois n'aura plus d'argument.
 *
 * ═══ LA SCISSION A ÉTÉ FAITE — 2026-10-09, ET LE BUDGET DESCEND ═══
 *
 *     159 992 o  avant          →     133 364 o  après
 *
 * 26 628 octets de moins sur CHAQUE première visite, soit 533 ms à la vitesse
 * de référence de ce relevé (400 kb/s). C'est le gain que les trois chapitres
 * ci-dessus annonçaient sans le prendre.
 *
 * L'OBSTACLE ÉTAIT CINQ FOIS PLUS PETIT QUE CE QUI EST ÉCRIT PLUS HAUT, et la
 * leçon vaut plus que le gain : la liste des « vingt clés, huit modules dont
 * deux primitives partagées » a été REMESURÉE avant d'être crue, et elle était
 * périmée. Le relevé du 2026-10-09 — marche du graphe d'imports depuis
 * `main.tsx`, puis vérification clé par clé dans le paquet construit — en
 * trouve CINQ, dans DEUX fichiers : `app.crash.*` (`FrontiereDErreur`) et
 * `app.dashboard.chartTitle` / `openMonth` (`Hero`). Elles vivent maintenant
 * dans `common.crash` et `common.chart`. Les groupes `app.offline.*`,
 * `app.parkFailure.*`, `app.sessionFailure.*`, `app.exported`,
 * `app.works.samples.*` et `app.dashboard.scale*` ne sont plus cités par aucun
 * module impatient ; `Charts.tsx` n'est même plus dans le paquet d'entrée.
 *
 * UN FAUX POSITIF A FAILLI COÛTER HUIT DÉPLACEMENTS INUTILES. `src/data/
 * portfolio.ts` cite huit clés `app.*` et paraissait impatient par
 * `useDates.ts` — qui n'en importe qu'un TYPE, effacé à la compilation. Le
 * paquet construit tranche : `app.payments.methodMobile`, zéro occurrence dans
 * `index.js`, deux dans `EspaceApplicatif.js`.
 *
 * LA GARDE QUE CE FICHIER RÉCLAMAIT EXISTE :
 * `scripts/check-dictionnaire-impatient.mjs`. Elle refuse toute citation de
 * `app.*` — et tout import de valeur de `fr-app` — depuis un module du paquet
 * d'entrée. Elle est née ROUGE sur les cinq clés, et sa seconde règle a été
 * éprouvée par mutation. C'était la condition posée ici : « livrer ça sans
 * garde capable de distinguer les modules impatients des autres aurait été un
 * mauvais échange ».
 *
 * ═══ LE NOUVEAU NOMBRE : 137 000, ET SA MARGE EST PROVISOIRE ═══
 *
 * 3 636 o au-dessus du mesuré. Les trois relèvements précédents dimensionnaient
 * leur marge sur une croissance de 156 o par lot, relevée sur quinze commits.
 * CE CHIFFRE NE S'APPLIQUE PLUS, et il faut le dire plutôt que de le recopier :
 * il mesurait la croissance des DEUX dictionnaires réunis, et le plus gros
 * contributeur — les chaînes d'écrans — ne tombe plus de ce côté-ci. Une clé
 * d'écran ajoutée aujourd'hui coûte ZÉRO octet au premier chargement.
 *
 * Je ne sais donc pas à quelle vitesse ce budget se consommera désormais, et je
 * ne l'invente pas : 3 636 o est une marge choisie par PRUDENCE NON MESURÉE,
 * du même ordre que les précédentes. Le premier rouge la remesurera pour de
 * bon, sur des lots d'après la scission.
 *
 * CE QUI RESTE À PRENDRE, mesuré le même jour, section par section de `fr.ts` :
 *
 *   common      5 578 o gzip      auth      4 775 o      marketing  4 404 o
 *   terms       3 511 o           privacy   2 141 o      nav        1 834 o
 *
 * `terms` + `privacy` + `legal` font 6 377 o de pages légales qu'un visiteur de
 * la page d'accueil n'ouvre presque jamais : c'est la prochaine scission
 * évidente, et elle n'est pas prise ici — un lot, un sujet.
 */
export const BUDGET_PREMIER_CHARGEMENT = 137_000

