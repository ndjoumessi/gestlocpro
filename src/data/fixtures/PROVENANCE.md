# Provenance des images du jeu de démonstration

Sans ce fichier, personne ne saura demain qu'on avait le droit de verser ces
images dans un dépôt. Il est donc versionné avec elles, et il ne se supprime pas.

**CE DOSSIER N'EST PAS `server/src/stockage/fixtures`, ET LA DIFFÉRENCE COMPTE.**
Là-bas vit la fixture des MESURES — compression, transcodage, cible d'un geste de
`mesure-ui` — et son contenu est indifférent : ce qui est mesuré, ce sont des
octets. Ici vivent des images que le produit AFFICHE comme des preuves, à un
utilisateur, sous une légende qui dit ce qu'elles montrent. Elles doivent donc
montrer ce que la légende dit, et rien d'autre.

**REPRODUCTIBLE.** Les fenêtres de recadrage ci-dessous se rejouent avec
`scripts/recadrer-fixture.mjs`, qui vit dans le dépôt pour cette seule raison :
une provenance qu'on ne peut pas refaire est une provenance qu'on croit sur
parole.

## `peinture-ecaillee-1.jpg`, `-2`, `-3`

Servies dans la démonstration comme les preuves de la réserve **« Peinture
écaillée derrière la porte »**, état des lieux d'entrée du logement A1 — celui
du locataire connecté.

**Licence : domaine public** — œuvre d'un employé du gouvernement fédéral des
États-Unis produite dans l'exercice de ses fonctions. Aucune attribution n'est
juridiquement exigée ; elle est portée ici quand même, parce qu'une licence
qu'on ne peut plus retrouver est une licence qu'on ne peut plus prouver.

| | |
|---|---|
| Œuvre d'origine | `File:Peeling paint on the walls of the Our Lady of Purification Mission in Dona Ana, NM (dcfcdfe8-fe64-48fe-a7d2-3f609494786d).JPG` |
| Auteur | National Trails Office (US National Park Service) |
| Crédit | NPGallery |
| Page source | https://commons.wikimedia.org/wiki/File:Peeling_paint_on_the_walls_of_the_Our_Lady_of_Purification_Mission_in_Dona_Ana,_NM_(dcfcdfe8-fe64-48fe-a7d2-3f609494786d).JPG |
| Licence exacte | « Public domain » (`LicenseShortName` de l'API Commons), au titre de `PD-USGov` |
| Prise de vue | 2019-04-16 15:11:08 |
| Appareil | iPad Pro (10,5 pouces), iOS 12.1.4 |
| Résolution native | 3024 × 4032 |
| Poids d'origine | 2 397 068 octets |
| SHA-256 de l'original | `262088e930d7c8ad381fca92afe7e17986cdb4177135fb510abb24a4c7e703b7` |

### Les trois fenêtres, et le fait qu'elles ne se chevauchent pas

| Fixture | Fenêtre dans l'original | Emprise `x` | Emprise `y` |
|---|---|---|---|
| `-1` | 880 × 880 à (120, 900) | 120 – 1000 | 900 – 1780 |
| `-2` | 620 × 620 à (1800, 1450) | 1800 – 2420 | 1450 – 2070 |
| `-3` | 700 × 700 à (2100, 2600) | 2100 – 2800 | 2600 – 3300 |

`-1` est disjointe des deux autres **en `x`** ; `-2` et `-3` se recouvrent en `x`
mais sont disjointes **en `y`**. Deux rectangles dont une projection ne se
recoupe pas ne s'intersectent pas : les trois emprises sont donc distinctes, et
c'est de l'arithmétique, pas un coup d'œil.

**POURQUOI TROIS ZONES DU MÊME MUR, ET POURQUOI CE N'EST PAS UN FAUX.** Ce sont
trois endroits différents du même défaut — ce qu'un constat produit réellement,
où l'on photographie une même réserve sous plusieurs cadrages. Elles restent
toutes trois attachées à LA réserve qu'elles documentent ; les répartir sur des
réserves différentes aurait été le mensonge.

**CE QUI A EXIGÉ D'EN AVOIR TROIS.** Une seule vignette ne fait pas de rangée.
La rangée des preuves REPLIE quand elle déborde, et ce repli n'existe qu'à
partir de trois vignettes — 3 × 80 px et deux écarts de 8 px font 256 px, plus
que la place restante dans la carte à 320 px. Avec une seule photo, le repli
n'était jamais rendu, donc jamais mesuré. Vérifié après coup : à 320 px la
rangée montre deux vignettes puis une.

### Ce que le recadrage a retiré, et pourquoi

L'original est la FAÇADE D'UNE ÉGLISE en plein soleil : croix de faîtage,
clocher, oculus vitré, porte de bois, branchages et sol. Rien de tout cela n'a sa
place dans la démonstration d'une application de gestion locative — une croix
versée par inadvertance dans le jeu de données d'un produit est un signal qu'on
n'a pas voulu envoyer, et une façade identifiable désigne un lieu réel.

Les trois cadres ne gardent que du MUR : peinture blanche écaillée par plaques
sur un enduit beige, fissures capillaires, et sur `-3` une zone d'enduit à nu.
Deux candidats ont été écartés APRÈS rendu — l'un montrait des branchages, l'autre
un pan de mur sans écaillage visible, donc la preuve de rien.

### Ce que le ré-encodage a retiré

Le recadrage passe par un canevas, ce qui SUPPRIME tout le segment EXIF — donc
les coordonnées GPS de la mission et le boîtier. Vérifié sur chaque fichier
produit : `FFE0` (JFIF), `FFE2` (profil ICC sRGB), puis les tables de
quantification. **Aucun `FFE1`, aucune chaîne `Exif`, `GPS` ni `Apple`** — le
contrôle est fait par `recadrer-fixture.mjs` à chaque rendu, et il l'écrit.

### Ce qu'elles pèsent, et pourquoi cette taille

200 × 200, qualité 0,82. Ce qui compte n'est pas le poids sur disque mais le
**base64**, puisqu'elles sont inlinées :

| | disque | base64 |
|---|---|---|
| `-1` | 3 772 o | 5 032 o |
| `-2` | 4 608 o | 6 144 o |
| `-3` | 5 631 o | 7 508 o |
| **total** | **14 011 o** | **18 684 o** |

**CE QU'ELLES ONT COÛTÉ, MESURÉ PAR LA PORTE.** `poids-ecrans` relève **+25 427
octets** sur `/@360` et `/@1280` contre la course de référence — dont 12 285
imputables à ces trois fixtures, le reste étant le cumul antérieur. Zéro requête
de plus : le compte de requêtes est un VETO, et il n'a pas bougé.

**INLINÉES (`?inline`), et ce n'est pas une préférence :** `poids-ecrans` refuse
toute REQUÊTE de plus sur un écran mesuré — « les octets se rapportent, les
requêtes se refusent ». Trois fichiers servis à part seraient trois allers-retours,
donc un veto ; leurs octets dans le paquet ne sont qu'une ligne à arbitrer. Le
suffixe est ÉCRIT plutôt que laissé au seuil d'inlining de Vite (4 096 o par
défaut) : un seuil ferait basculer une image en requête le jour où quelqu'un la
retaille, sans que rien ne le dise avant la porte.

**200 px, ET LE CHOIX A ÉTÉ REGARDÉ.** La vignette est affichée à 80 px CSS et
ne s'agrandit jamais — le lot des preuves n'offre ni plein écran ni zoom. Les
trois paliers ont été rendus à 80 px CSS sur un écran **3×**, puis comparés à
l'œil : entre 200 et 240 je ne vois pas de différence ; entre 160 et 200, les
bords d'écaille se ramollissent. C'est un JUGEMENT, sur un écran, pas une mesure.

Le total en base64 pour les trois : 13 348 o à 160 px, **18 684 à 200**, 23 884 à
240. Le premier arbitrage, quand il n'y avait qu'une image, avait retenu 240 pour
couvrir le 3× ; multiplié par trois, ce choix coûtait 5 200 octets pour une
différence que je ne vois pas.

### Ce qu'elles ne sont pas

Ce n'est pas ce que le produit sert en vrai. Une photo réelle passe par le
transcodage — 1 600 px de hauteur, qualité 0,82, 113 à 306 Kio mesurés — et vit
dans le dépôt d'objets. Celles-ci sont des VIGNETTES de démonstration, taillées
pour la seule taille où elles seront vues.

### Les onze autres réserves de la démonstration n'ont pas de photo

Et ce n'est pas un travail à moitié fait. Six requêtes sur Commons — joint de
silicone moisi, vitre fêlée, parquet rayé, moisissure murale, plan de travail
entaillé, robinetterie qui fuit — n'ont rendu AUCUNE image en CC0 ni en domaine
public. Ce qui existe est en CC BY-SA, dont le partage à l'identique suivrait
chaque recadrage et dont l'attribution devrait être portée dans l'interface,
puisqu'une image inlinée est redistribuée à chaque visiteur. Le jour où une image
en domaine public documente honnêtement l'une de ces réserves, elle s'ajoute ici.
En attendant, une réserve sans photo est la vérité : toutes ne sont pas
photographiées.
