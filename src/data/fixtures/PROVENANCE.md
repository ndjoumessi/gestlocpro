# Provenance des images du jeu de démonstration

Sans ce fichier, personne ne saura demain qu'on avait le droit de verser cette
image dans un dépôt. Il est donc versionné avec elle, et il ne se supprime pas.

**CE DOSSIER N'EST PAS `server/src/stockage/fixtures`, ET LA DIFFÉRENCE COMPTE.**
Là-bas vit la fixture des MESURES — compression, transcodage, cible d'un geste de
`mesure-ui` — et son contenu est indifférent : ce qui est mesuré, ce sont des
octets. Ici vit une image que le produit AFFICHE comme une preuve, à un
utilisateur, sous une légende qui dit ce qu'elle montre. Elle doit donc montrer
ce que la légende dit, et rien d'autre.

## `peinture-ecaillee.jpg`

Servie dans la démonstration comme la preuve de la réserve **« Peinture écaillée
derrière la porte »**, état des lieux d'entrée du logement A1 — celui du
locataire connecté.

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

**CE QUE LE RECADRAGE A RETIRÉ, ET POURQUOI.** L'original est la FAÇADE D'UNE
ÉGLISE en plein soleil : croix de faîtage, clocher, oculus vitré, porte de bois,
et le ciel. Rien de tout cela n'a sa place dans la démonstration d'une
application de gestion locative — une croix versée par inadvertance dans le jeu
de données d'un produit est un signal qu'on n'a pas voulu envoyer, et une façade
identifiable désigne un lieu réel.

Le cadre — 880 × 880 pris à (120, 900) — ne garde qu'un pan de MUR : peinture
blanche écaillée par plaques sur un enduit beige, avec deux fissures capillaires.
C'est exactement ce que la réserve décrit, et c'est tout ce qu'on peut en dire.

**CE QUE LE RÉ-ENCODAGE A RETIRÉ.** Le recadrage passe par un canevas, ce qui
SUPPRIME tout le segment EXIF — donc les coordonnées GPS de la mission et le
boîtier. Vérifié sur le fichier produit : `FFE0` (JFIF), `FFE2` (profil ICC
sRGB, 472 octets), puis les tables de quantification. **Aucun `FFE1`, aucune
chaîne `Exif`, `GPS` ni `Apple`.**

**CE QU'ELLE PÈSE, ET POURQUOI CETTE TAILLE.** 240 × 240, qualité 0,82, 4 997
octets — 6 664 octets une fois en base64, ce qui est ce qui entre réellement
dans le paquet.

Elle est **inlinée** (`?inline`), et ce n'est pas une préférence : `poids-ecrans`
refuse toute REQUÊTE de plus sur un écran mesuré — « les octets se rapportent,
les requêtes se refusent ». Un fichier servi à part serait un aller-retour
supplémentaire, donc un veto ; ses octets dans le paquet ne sont qu'une ligne à
arbitrer.

**CE QU'ELLE A COÛTÉ, MESURÉ PAR LA PORTE.** `poids-ecrans` relève **+6 848
octets** sur `/@360` et `/@1280` — l'écart de ce lot seul, une fois retranché le
cumul déjà inscrit contre la course de référence. Zéro requête de plus : le
compte de requêtes est un VETO, et il n'a pas bougé. À 400 kb/s, ces octets
valent environ 137 ms sur le premier chargement de la vitrine.

La vignette est affichée à 80 px CSS et ne s'agrandit jamais — le lot des
preuves n'offre ni plein écran ni zoom. 240 px couvre donc les écrans jusqu'à
3×. Les paliers ont été pesés avant de choisir : 160 px → 3 808 o en base64,
200 → 5 032, **240 → 6 664**, 320 → 10 052.

**CE QU'ELLE N'EST PAS.** Ce n'est pas ce que le produit sert en vrai. Une
photo réelle passe par le transcodage — 1 600 px de hauteur, qualité 0,82, 113 à
306 Kio mesurés — et vit dans le dépôt d'objets. Celle-ci est une VIGNETTE de
démonstration, taillée pour la seule taille où elle sera vue.

**LES ONZE AUTRES RÉSERVES DE LA DÉMONSTRATION N'ONT PAS DE PHOTO,** et ce n'est
pas un travail à moitié fait. Six requêtes sur Commons — joint de silicone
moisi, vitre fêlée, parquet rayé, moisissure murale, plan de travail entaillé,
robinetterie qui fuit — n'ont rendu AUCUNE image en CC0 ni en domaine public.
Ce qui existe est en CC BY-SA, dont le partage à l'identique suivrait chaque
recadrage et dont l'attribution devrait être portée dans l'interface, puisqu'une
image inlinée est redistribuée à chaque visiteur. Le jour où une image en
domaine public documente honnêtement l'une de ces réserves, elle s'ajoute ici.
En attendant, une réserve sans photo est la vérité : toutes ne sont pas
photographiées.
