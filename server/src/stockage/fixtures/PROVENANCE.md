# Provenance des fixtures d'image

Sans ce fichier, personne ne saura demain qu'on avait le droit de verser cette
image dans un dépôt. Il est donc versionné avec elle, et il ne se supprime pas.

## `compteur-index.jpg`

**Licence : CC0 1.0** — Creative Commons Zero, Public Domain Dedication.
Aucune attribution n'est juridiquement exigée ; elle est portée ici quand même,
parce qu'une licence qu'on ne peut plus retrouver est une licence qu'on ne peut
plus prouver.

| | |
|---|---|
| Œuvre d'origine | `File:20251021 092826 Water meter.jpg` |
| Auteur | Rakoon (Wikimedia Commons), travail personnel |
| Page source | https://commons.wikimedia.org/wiki/File:20251021_092826_Water_meter.jpg |
| Fichier source | https://upload.wikimedia.org/wikipedia/commons/b/b1/20251021_092826_Water_meter.jpg |
| Licence exacte | CC0 (`LicenseShortName` de l'API Commons), « Creative Commons Zero, Public Domain Dedication » |
| Prise de vue | 2025-10-21 09:28:26 |
| Appareil | Samsung Galaxy A54 5G |
| Résolution native | 4080 × 2296 stockés, EXIF Orientation 6, donc 2296 × 4080 à l'affichage |
| Poids d'origine | 2 905 974 octets |

**CE QUE LE RECADRAGE A RETIRÉ, ET POURQUOI.** Le cadre serre la seule fenêtre
d'index — `00088,498 m³`. Il exclut le NUMÉRO DE SÉRIE du compteur, qui
surplombe l'index sur le cadran : un index se lit, un numéro de série désigne un
logement. Il exclut aussi le marquage de flanc, le mur, la tuyauterie et tout
contexte de pièce.

**CE QUE LE RÉ-ENCODAGE A RETIRÉ.** Le recadrage passe par un canevas, ce qui
CUIT la rotation dans les pixels et SUPPRIME tout le segment EXIF — donc les
coordonnées GPS et le boîtier. Vérifié sur le fichier produit : en-tête JFIF,
aucun APP1. La fixture fait 827 × 147, 24 062 octets.

**ORIGINAL D'APPAREIL, ET CE QUI LE LAISSE CROIRE.** `ExifImageWidth` et
`ExifImageHeight` de la source valent exactement ses dimensions réelles, le
champ `Software` porte un numéro de build Samsung (`A546EXXSFDYI1`) et non un
nom d'éditeur, et le GPS est intact. Rien n'indique un réencodage entre
l'appareil et Commons — mais un réencodeur qui réécrirait l'EXIF de façon
cohérente serait indiscernable, et ceci n'est donc pas une preuve.
