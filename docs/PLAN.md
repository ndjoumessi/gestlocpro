# GestLocPro — Plan de conception

> **État : livré.** Les quatre étapes sont construites et vérifiées.
> Décisions arbitrées : assistant d'inscription unique · XAF et XOF distincts ·
> grille tarifaire à l'unité gérée. Voir §9 pour les défauts trouvés en cours
> de route et §10 pour ce qui reste ouvert.


> Établi à partir des maquettes `GESLOC Mockup FR/EN (offline).html` (décodées : React 18 + tokens inline)
> et du skill `ui-ux-pro-max` (règles UX/A11Y ; palette générique écartée au profit de la marque existante).

---

## 1. Ce que les maquettes contiennent réellement

Palette effective extraite du code (au-delà des 4 couleurs annoncées) :

| Famille | Valeurs relevées |
| --- | --- |
| Encres | `#14201E` `#243733` `#3F4A48` `#4A5654` `#6B7573` |
| Or | `#C58E3E` `#A0722C` `#B07C1E` `#8A6218` `#E9C68B` `#EAD9B4` `#FBF3E2` |
| Papiers | `#FBF9F4` `#F7F4EE` `#F4F1EA` `#F2F0EA` `#EFEBE2` `#EDE7DB` `#E8E2D7` `#E5DFD3` `#CBBFA6` |
| Succès | `#2C6A4E` / `#EAF2EC` / `#DEE8E1` |
| Alerte | `#A63A2B` `#7E2A1E` / `#FAEDEA` / `#E4B3AA` |

Typographie réelle : **trois** familles, pas deux.
`Cormorant Garamond` (h1), `Manrope` (UI), `IBM Plex Mono` (chiffres — 341 usages, `tabular-nums`).

Écrans existants (12) : `dash` `parc` `pay` `edl` `trav` `caut` `tenants` `notif` `onboard` `states`
`web` (portail locataire, 5 onglets) `mobile` (app locataire).
Rôles : `proprio` `gest` `loc`. Devises : `FCFA` `Euro` `CAD` `USD`.

---

## 2. Corrections d'accessibilité (ratios vérifiés)

Trois défauts mesurés dans la maquette actuelle. Le système de design les corrige.

| Token | Maquette | Ratio | Remplacement | Nouveau ratio |
| --- | --- | --- | --- | --- |
| Texte secondaire | `#6B7573` sur `#F7F4EE` | **4.33** ✗ | `#5C6664` | **5.40** ✓ |
| Lien / label doré | `#A0722C` sur `#F7F4EE` | **3.87** ✗ | `#8A6218` | **4.98** ✓ |
| Or sur sombre élevé | `#C58E3E` sur `#243733` | **4.38** ✗ | `#D2A055` | **5.33** ✓ |

`#C58E3E` reste l'accent de marque, mais **jamais en texte sur fond clair** (2.87 sur blanc).
Il sert en fond, bordure, icône, et en texte sur `#14201E` (5.83 ✓).

Quatrième correction : la maquette descend à `9.5px` / `10px` sur les labels mono.
Plancher relevé à **12px**, corps dashboard **14px**, corps landing/mobile **16px** (évite l'auto-zoom iOS).

---

## 3. Tokens

### Couleurs sémantiques

```
--canvas         #EFEBE2   fond application
--paper          #F7F4EE   fond zone principale
--surface        #FFFFFF   cartes
--surface-sunken #F2F0EA   zones creusées, table headers
--border         #E5DFD3
--border-strong  #CBBFA6
--divider        #E8E2D7

--ink            #14201E   texte principal
--ink-2          #243733   surface sombre élevée / hover bouton sombre
--ink-3          #3F4A48
--muted          #5C6664   texte secondaire            (AA partout)
--muted-soft     #6B7573   ≥18px ou non-textuel uniquement

--gold           #C58E3E   accent de marque (fond/bordure/icône)
--gold-ink       #8A6218   liens + labels sur fond clair
--gold-ink-hover #7E571F
--gold-on-dark   #D2A055   or sur --ink-2
--gold-tint      #FBF3E2
--gold-border    #E9C68B

--ok      #2C6A4E   --ok-tint      #EAF2EC   --ok-border      #DEE8E1
--warn    #8A6218   --warn-tint    #FBF3E2   --warn-border    #EAD9B4
--danger  #A63A2B   --danger-tint  #FAEDEA   --danger-border  #E4B3AA
--neutral #5C6664   --neutral-tint #F2F0EA   --neutral-border #E5DFD3
```

Statuts : **couleur + icône + libellé**, jamais la couleur seule.
`À jour / Paid` · `Partiel / Partial` · `En retard / Overdue` · `Vacant / Vacant`

### Typographie

| Token | Police | Taille / interligne | Usage |
| --- | --- | --- | --- |
| `display-xl` | Cormorant 600 | 56 / 1.04 | hero landing |
| `display-l` | Cormorant 600 | 46 / 1.06 | h1 dashboard |
| `display-m` | Cormorant 600 | 32 / 1.10 | titres de section landing |
| `title-l` | Manrope 600 | 20 / 1.30 | titres de carte |
| `title-m` | Manrope 600 | 17 / 1.35 | sous-titres |
| `body-l` | Manrope 400 | 16 / 1.60 | landing, inputs mobile |
| `body` | Manrope 400 | 14 / 1.55 | corps dashboard |
| `body-s` | Manrope 400 | 13 / 1.50 | annotations |
| `label` | Manrope 600 | 12 / 1.40 | labels de formulaire |
| `mono-label` | Plex Mono 500 | 11 / 1.30, `.08em`, caps | eyebrows, en-têtes de colonne |
| `mono-data` | Plex Mono 400 | 13, `tabular-nums` | cellules chiffrées |
| `mono-kpi` | Plex Mono 500 | 26 / 1, `tabular-nums` | KPI |

### Espacement, rayons, ombres, mouvement

```
space   4 8 12 16 20 24 32 40 48 64 80 96          (échelle 4pt)
radius  bar 3 · sm 6 · md 9 · lg 14 · xl 20 · pill 999
e1  0 1px 2px rgba(20,32,30,.04), 0 6px 18px -12px rgba(20,32,30,.10)   cartes
e2  0 2px 6px rgba(20,32,30,.06), 0 12px 32px -16px rgba(20,32,30,.16)  popovers
e3  0 8px 24px rgba(20,32,30,.12), 0 32px 64px -24px rgba(20,32,30,.28) modales
motion  fast 150 · base 200 · slow 300 ; ease-out entrée, ease-in sortie (~70 %)
z       base 0 · sticky 20 · dropdown 40 · overlay 60 · modal 70 · toast 100
touch   cible minimale 44×44, écart minimal 8
```

---

## 4. Arborescence

```
src/
  design-system/
    tokens.css              source de vérité (variables CSS)
    tailwind.preset.ts      mapping tokens → Tailwind
  components/
    primitives/   Button Card Badge StatusPill Input Textarea Select Field
                  Checkbox Radio RadioCard Switch Table Progress Donut BarChart
                  Modal Toast Tooltip Skeleton EmptyState Avatar Logo
    controls/     LanguageSwitcher CurrencySwitcher CountrySelect PeriodPicker
                  RoleSwitcher SearchInput PhoneInput PasswordInput
    layout/       PublicHeader PublicFooter AuthLayout AppShell Sidebar Topbar
                  PageHeader Section Container
  features/
    marketing/    Hero ValueProps FeatureGrid RolesSection PricingTable
                  Testimonials Faq FinalCta
    auth/         RoleChooser SignUpWizard LoginForm ForgotPasswordForm
    dashboard/    Overview Portfolio Payments Meters Inspections Works
                  Deposits Tenants Alerts Onboarding SystemStates
    portal/       TenantPortal TenantMobilePreview
  i18n/           fr.ts en.ts I18nProvider useT
  currency/       CurrencyProvider useMoney formatMoney
  data/           mocks (parc, baux, paiements, relevés, travaux, cautions)
  routes/
```

### Routes

| Public | Auth | Application |
| --- | --- | --- |
| `/` landing | `/inscription` choix de rôle | `/app` tableau de bord |
| `/tarifs` | `/inscription/:role` assistant | `/app/parc` |
| `/fonctionnalites` | `/connexion` | `/app/paiements` |
| | `/mot-de-passe-oublie` | `/app/releves` ← promu |
| | `/reinitialiser?jeton=` | `/app/etats-des-lieux` |
| | | `/app/travaux` · `/cautions` · `/locataires` |
| | | `/app/signalements` · `/onboarding` · `/systeme` |
| | | `/portail` · `/app/apercu-mobile` |

---

## 5. Flow d'inscription — recommandation

**Choix de rôle en amont, puis un seul assistant adaptatif** (pas trois formulaires séparés).

1. **`/inscription`** — 3 `RadioCard` : Propriétaire · Gestionnaire délégué · Locataire.
   Chaque carte dit ce que le rôle peut faire (repris de `roleRights` dans la maquette).
2. **Identité** — nom, email, téléphone avec indicatif, mot de passe (toggle + jauge).
3. **Contexte** — pays → **pré-remplit devise et langue** (modifiables). Puis, selon le rôle :
   - *Propriétaire* : nom du parc, nombre d'unités (fourchette), « je gère seul » vs « je délègue ».
   - *Gestionnaire* : code d'invitation propriétaire **ou** demande d'accès + société.
   - *Locataire* : **code d'invitation** (dans la maquette il arrive par SMS avec la fiche locataire).
4. **Récapitulatif** + acceptation CGU.

*Pourquoi :* les trois rôles partagent ~80 % des champs ; trois formulaires dupliqueraient validation
et i18n. Le stepper satisfait `multi-step-progress`, et choisir le rôle d'abord évite de demander
un code d'invitation à un propriétaire.

---

## 6. Ordre de construction

1. Scaffold Vite + TS + Tailwind · tokens · i18n · devises · primitives · page `/kitchen-sink`
2. Landing
3. Inscription · connexion · mot de passe oublié
4. `AppShell` + tableau de bord + parc + paiements + relevés
5. Écrans restants + portail locataire + aperçu mobile

---

## 7. Hypothèses à valider

| # | Sujet | Hypothèse |
| --- | --- | --- |
| 1 | A11Y | 3 tokens de la maquette modifiés + plancher typographique relevé (§2) |
| 2 | Tarifs | Par unité gérée/mois, 3 paliers, prix ancrés par devise (§8) |
| 3 | Marketing | Tous les textes sont inventés |
| 4 | Témoignages | Placeholders **explicitement fictifs** — pas de faux logos ni de fausses citations attribuées |
| 5 | Locataire | S'inscrit par code d'invitation, pas librement |
| 6 | FCFA | XAF ≠ XOF (Sénégal, Côte d'Ivoire…) — à trancher |
| 7 | Relevés | Sous-section de « Paiements » dans la maquette → promue en page |
| 8 | Ville | « DOUALA » en dur dans le fil d'Ariane → devient dynamique |
| 9 | Dark mode | Hors périmètre (seule la sidebar est sombre dans la maquette) |

---

## 8. Grille tarifaire

**Abonnement + prix par unité gérée**, sans palier d'unités.

| | Essentiel | **Pro** (populaire) | Cabinet |
| --- | --- | --- | --- |
| XAF / XOF | 1 200 + 100 /unité | 2 000 + 160 /unité | sur devis |
| EUR | 4 € + 0,50 € /unité | 6 € + 0,80 € /unité | sur devis |
| CAD | 6 $ + 0,70 $ /unité | 9 $ + 1,10 $ /unité | sur devis |
| USD | 4 $ + 0,50 $ /unité | 6 $ + 0,80 $ /unité | sur devis |

**Pro vaut 1,6 × Essentiel** sur l'abonnement, et sur le prix unitaire des
devises à sous-unité : l'effort d'upgrade y est identique quelle que soit la
taille du parc.

En franc CFA, l'Essentiel est passé à **1 200 + 100 par unité** (auparavant
1 250 + 125) et Pro à **2 000 + 160** (auparavant 200).

**Le facteur 1,6 tient sur le prix unitaire, dans toutes les devises.** L'effort
d'upgrade ne croît donc pas avec la taille du parc — c'est l'objet du §
« Ce que la validation a corrigé » ci-dessous.

**L'arrondi ne peut pas disparaître partout.** Deux impossibilités arithmétiques,
et non des réglages à trouver.

- *Le facteur 1,6 contre la formule exacte.* Pour qu'un prix unitaire et son 1,6
  soient tous deux multiples de 100, il faudrait un multiple de 500 — hors
  d'échelle. L'Essentiel à 100 tombe juste, Pro à 160 décroche 48 fois sur 60 en
  mensuel. On a choisi le facteur constant, la mention d'arrondi couvrant l'écart.
- *La remise annuelle contre la formule exacte.* Multiplier par 4/5 conserve les
  multiples de 100 seulement si le montant est multiple de 125, donc de 500 pour
  l'être avant comme après. L'annuel décroche donc sur les deux paliers.

Le mensuel de l'Essentiel — l'entrée de gamme, sur l'onglet par défaut — est le
seul cas exact, et c'est celui que le prospect lit en premier.

**Reste un rapport d'abonnement de 1,667** (2 000 / 1 200), et non 1,6 : le
ramener demanderait 1 920, qui décrocherait à son tour. Non tranché.

Annuel −20 %, 30 jours d'essai sur les paliers tarifés. Portail locataire inclus
partout. Différenciateurs : relances automatiques, gestionnaires délégués,
export comptable, multi-sociétés — jamais la taille du parc.

La page tarifs porte un curseur d'unités : le prospect lit **son** prix, pas
celui d'un palier dans lequel il devine se ranger. La formule est affichée sous
chaque montant, pour qu'il soit vérifiable et non seulement constaté.

### Ce que la validation a corrigé

La grille initiale portait 4 900 et 14 900 FCFA. Trois défauts l'ont fait tomber.

**Le franc CFA est en parité fixe avec l'euro** (1 € = 655,957 FCFA, XAF comme XOF).
Il n'existe donc pas de prix FCFA « ancré indépendamment du taux du jour » —
4 900 FCFA *étaient* 7,47 €, mécaniquement. La justification inscrite dans le code
affirmait le contraire.

**Le bon dénominateur est le loyer encaissé**, pas le taux de change : c'est ce
que le produit administre. Sur cette mesure, l'ancienne grille faisait payer la
zone FCFA **2,6 à 2,8× plus cher** que la zone euro — une remise nominale de
17 % qui était en réalité une surtaxe, sur le marché au pouvoir d'achat le plus
faible.

| Palier | Zone | Quittancé/mois | Avant | Après | Part du loyer |
| --- | --- | --- | --- | --- | --- |
| Essentiel | FCFA | 1 366 667 FCFA | 4 900 | **2 500** | 0,359 % → **0,183 %** |
| | EUR | 7 000 € | 9 € | 9 € | 0,129 % |
| Pro | FCFA | 6 833 333 FCFA | 14 900 | **7 500** | 0,218 % → **0,110 %** |
| | EUR | 35 000 € | 29 € | 29 € | 0,083 % |

L'écart passe de 2,8× à 1,4×. La parité stricte donnerait ~1 800 FCFA, mais les
relances SMS et le support ont un coût réel par client sur ces marchés : le
rapport résiduel le couvre.

**Les points de prix suivaient une convention étrangère.** 4 900 et 14 900
imitaient la terminaison en « 9 » occidentale. Les coupures FCFA sont
500 / 1 000 / 2 000 / 5 000 / 10 000, et le mobile money favorise les montants
composables — d'où 2 500 et 7 500, dont la remise annuelle tombe elle aussi
juste (2 000 et 6 000).

### La frontière à 10 unités, validée puis supprimée

Le point restait ouvert. L'analyse a montré **deux** ruptures, pas une.

*En haut*, passer de 10 à 11 unités triplait la facture : 250 → 682 FCFA par
unité, et il fallait atteindre **30 unités** pour retrouver le coût unitaire
qu'on avait à 10. Vingt unités de croissance pour revenir au point de départ.

*En bas* — défaut plus grave et jamais nommé — le prix d'entrée était
forfaitaire : un bailleur d'**une** unité payait autant qu'un bailleur de dix,
soit **1,83 % de son loyer encaissé contre 0,18 %**. Dix fois plus cher en
proportion, sur le segment le plus nombreux de ces marchés.

| Unités | Ancienne grille | Part du loyer | Formule | Part du loyer |
| --- | --- | --- | --- | --- |
| 1 | 2 500 FCFA | **1,83 %** | 1 375 FCFA | 1,01 % |
| 10 | 2 500 FCFA | 0,18 % | 2 500 FCFA | 0,18 % *(inchangé)* |
| 11 | 7 500 FCFA | **0,50 %** | 2 625 FCFA | 0,17 % |
| 20 | 7 500 FCFA | 0,27 % | 3 750 FCFA | 0,14 % |
| 50 | 7 500 FCFA | 0,11 % | 7 500 FCFA | 0,11 % *(inchangé)* |

La formule retombe **exactement** sur les prix précédents aux deux points
d'ancrage : le niveau de prix ne bouge pas, il se redistribue. Le coût par unité
décroît de façon monotone sur toute la plage — aucune remontée — et l'écart de
traitement entre le client le plus lourdement facturé et le plus légèrement
passe de **×16,7 à ×9,2**.

**Contrepartie assumée** : le milieu de gamme paie nettement moins qu'avant
(20 unités : 7 500 → 3 750 FCFA, soit moitié moins). Ce segment subventionnait
les gros parcs ; la formule met fin à ce transfert. C'était la vraie décision,
pas la suppression de la falaise.

### Le supplément de Pro, validé puis rendu proportionnel

Il était posé en forfait : +2 500 FCFA, quel que soit le parc. Or **un forfait
plat est un supplément régressif**.

| Unités | Essentiel | Pro forfaitaire | Effort d'upgrade |
| --- | --- | --- | --- |
| 1 | 1 375 FCFA | 3 875 FCFA | **+182 %** |
| 10 | 2 500 FCFA | 5 000 FCFA | +100 % |
| 20 | 3 750 FCFA | 6 250 FCFA | +67 % |
| 50 | 7 500 FCFA | 10 000 FCFA | **+33 %** |

Le même montant pesait **5,5 fois plus lourd** sur un petit parc. Le choix de
palier dépendait donc de la taille — ce que la formule de base venait de
corriger, réintroduit un cran plus loin.

Et la valeur va dans l'autre sens. Le supplément achète surtout les relances
automatiques : avec ~30 % de baux en incident, un parc d'une unité a **0,3
locataire** à relancer par mois, un parc de cinquante en a **quinze**. Relancer
quinze personnes à la main est pénible, en relancer un tiers ne l'est pas. Le
gros parc valorisait le plus la fonction et la payait le moins cher.

Pro vaut désormais **1,6 × Essentiel**, même facteur sur l'abonnement et sur le
prix unitaire : l'effort d'upgrade est **constant à +60 %** sur toute la plage.
Contrepartie assumée : sous ~22 unités Pro coûte moins qu'avant, au-dessus il
coûte davantage — cohérent avec qui tire la valeur de la fonction.

> **Depuis, en franc CFA**, la grille est 1 200 + 100 pour l'Essentiel et
> 2 000 + 160 pour Pro. Le facteur 1,6 tient toujours sur le prix unitaire, donc
> ce raisonnement reste valable. L'abonnement, lui, est à 1,667 et non 1,6. Voir
> §8.

### Ce qui reste ouvert sur les tarifs

- **Le niveau absolu en zone euro** (9 € à 10 unités) n'a pas été confronté à la
  concurrence : il reste une hypothèse.
- **Le niveau du supplément de Pro** (60 %). C'est sa *proportionnalité* qui a
  été validée, pas son montant — celui-ci reste posé à dire d'expert.

Pays initiaux : zone FCFA (Cameroun, Gabon, Congo, Tchad, RCA, Guinée éq. — XAF ;
Sénégal, Côte d'Ivoire, Bénin, Burkina, Mali, Togo, Niger — XOF), France/Belgique/Luxembourg (EUR),
Canada (CAD), États-Unis (USD), + « Autre ». **22 pays** au total, dans
[`src/lib/countries.ts`](../src/lib/countries.ts).

---

## 9. Défauts trouvés en cours de construction

Au-delà des trois corrections de contraste prévues au §2, la vérification en
navigateur a fait apparaître six défauts réels. Tous corrigés.

| # | Défaut | Mesure | Correction |
| --- | --- | --- | --- |
| 1 | 14 cibles tactiles sous 44 px | bascule FR/EN à 36×35, œil du mot de passe à 40 | portées à 44 minimum |
| 2 | `--color-on-dark-faint` repris de la maquette | 4.02:1 sur `--ink`, **3.58** sur `--ink-2` | opacité 0.42 → **0.58** |
| 3 | Titre du hero en 56 px fixe | remplissait un écran de 375 px | échelle d'affichage en `clamp()` |
| 4 | Barres du graphe invisibles | hauteur en % contre un parent de hauteur automatique | zone de tracé en `flex-1` de hauteur définie |
| 5 | Table alternative `sr-only` | 347 px de large, invisible mais dans le flux | `sr-only` déplacé sur un `<div>` englobant |
| 6 | Barre applicative repliée sur deux lignes | mot « Devise » + bascule + avatar > 375 px | libellé masqué sous `sm`, conservé en `sr-only` |

Trois de ces défauts méritent un mot, parce qu'ils se reproduiront :

- **La bascule `.on-dark`** (texte secondaire lisible sur fond sombre) est
  définie **hors `@layer`**. Placée dans `@layer base`, elle perdait contre
  `.text-muted` de Tailwind malgré une spécificité supérieure : l'ordre des
  couches CSS prime sur la spécificité. Elle exclut aussi les éléments qui
  peignent leur propre fond (`:not([class*='bg-'])`), faute de quoi un bouton
  doré posé dans un panneau sombre voyait son libellé repeint en blanc,
  soit 2.87:1 sur l'or.
- **`sr-only` ne fonctionne pas sur un `<table>`** : sous `display: table`, la
  largeur de 1 px est traitée comme un minimum et non comme un maximum. Le
  masquage doit porter sur un bloc englobant.
- **`documentElement.scrollWidth` n'est pas un test de débordement fiable** :
  il compte la largeur de mise en page des descendants d'un conteneur à
  défilement, et signale donc un faux positif sur tout tableau large logé dans
  un `overflow-x-auto`. Le seul critère qui vaut est de tenter
  `window.scrollTo(400, 0)` et de vérifier que `window.scrollX` reste à 0.

L'outil de vérification est dans [`scripts/contrast-audit.js`](../scripts/contrast-audit.js).
Il a fallu deux itérations pour le rendre fiable : Tailwind v4 émet `oklab()`
dès qu'une couleur porte un alpha, et ni un parseur naïf ni `canvas.fillStyle`
ne le décodent — le canvas retombait silencieusement sur du noir, ce qui faisait
passer un fond crème pour un fond sombre.

**Résultat final : 0 échec de contraste et 0 cible sous 44 px** sur les
17 routes, en français comme en anglais.

---

## 10. Ce qui reste ouvert

- **Aucun backend.** Les formulaires valident et changent d'état localement ;
  aucune requête réseau n'est émise. Les latences (700–800 ms) sont simulées
  pour montrer les états de chargement.
- **Pas de conversion de change.** Un montant s'affiche tel quel dans la devise
  choisie. C'est le comportement de la maquette, assumé et expliqué à
  l'utilisateur dans la FAQ et sous la grille tarifaire.
- **Mode sombre complet hors périmètre.** Seules la barre latérale et certaines
  cartes sont sombres, comme dans la maquette.
- **Contenus validés.** Les témoignages restent des placeholders explicitement
  fictifs — pas de logo d'entreprise réelle, pas de citation attribuée à une
  personne existante. La liste des pays a été validée et corrigée (§12).
  La grille tarifaire a été validée et corrigée (§8) ; il y subsiste deux
  points ouverts, le niveau absolu en zone euro et la frontière à 10 unités.
  Les textes marketing ont été validés et corrigés (§11).

---

## 11. Validation des textes marketing

La copie promettait trois choses que le produit ne fait pas. Corrigées en
alignant le texte sur la construction, plutôt qu'en promettant de rattraper.

| Promesse | Réalité mesurée | Correction |
| --- | --- | --- |
| « formats de date locaux » | `DATE_LOCALE` défini mais **jamais utilisé** ; toutes les dates en dur au format français | mention retirée, puis **rétablie** une fois le formatage branché (§14) |
| « photos horodatées », « photo par photo » | **aucune photo** dans l'écran États des lieux | reformulé en « réserves relevées et horodatées » |
| « hors ligne **dans l'application** » | **aucune application** : `nav.tenantApp` existe, aucune route ne la sert | question de FAQ remplacée par « Faut-il installer quelque chose ? », vraie |
| « le portail **et l'application** locataire » (tarifs) | idem | « le portail locataire » |

Trois autres défauts corrigés :

- **Contradiction interne.** La carte « Relances automatiques » promettait
  J+1 / J+7 / J+15 sans réserve, alors que la grille vend l'automatisation à
  partir de Pro. La carte porte désormais « Automatiques à partir du palier Pro ».
- **Engagement isolé.** « 30 jours d'essai » n'apparaissait que dans la ligne de
  confiance du hero. Il figure maintenant sur chaque palier tarifé — pas sur
  « Cabinet », qui passe par un devis.
- **Prose fragile.** « Cinq devises, deux langues » était écrit en toutes
  lettres. Les deux comptes sont interpolés depuis `CURRENCIES` et `LOCALES`,
  comme l'était déjà le nombre de pays.

FR et EN sont alignés : 123 clés de part et d'autre, aucune divergence sur les
promesses chiffrées. Audit final : **0 échec de contraste dans les deux langues**.

> Piège de mesure rencontré : dans un onglet masqué (`visibilityState === 'hidden'`),
> les transitions CSS se figent en vol. Le fond calculé reste à sa valeur d'avant
> bascule alors que les classes sont à jour, ce qui fabrique de faux échecs de
> contraste après un changement de langue. Vérifier `visibilityState`, ou mesurer
> après rechargement plutôt qu'après une bascule en page.

---

## 13. Vue locataire

La bascule de profil filtrait la **navigation** mais pas le **contenu** : la
barre latérale affichait « Ses propres données uniquement » pendant que le
tableau de bord montrait 1 415 000 FCFA de loyers attendus, les impayés de
quatre autres locataires et les dix lignes de paiement du parc. Les routes
retirées du menu restaient par ailleurs atteignables à la main — `/app/parc`
affichait tout le parc à un locataire.

### Ce qui a été construit

- **Un écran distinct**, pas une variante filtrée du tableau de bord. Un
  locataire ne cherche ni taux d'occupation ni encaissé consolidé : il veut son
  échéance, ses quittances, sa consommation, sa caution et l'état de ses
  signalements. `CURRENT_TENANT_UNIT` tient lieu de session tant qu'il n'y a pas
  d'authentification.
- **Filtrage à la source** sur les écrans partagés — paiements, travaux, états
  des lieux, signalements. Le filtre est posé sur les données et non sur
  l'affichage, si bien que les compteurs d'onglets et les totaux se calculent
  eux aussi sur le seul périmètre du locataire.
- **Un garde de route** (`RoleGuard`) sur les cinq écrans de gestion, adossé à
  la même liste de rôles que la barre latérale pour que navigation et accès ne
  puissent pas diverger. Le refus est expliqué à l'écran plutôt que redirigé en
  silence — une redirection muette passe pour un bug.
- **La règle de confidentialité est dite**, pas seulement appliquée : un bandeau
  rappelle au locataire qu'il ne voit que son logement.

### Vérification

Dix écrans parcourus en profil locataire : **zéro mention d'un autre locataire**,
aucun indicateur de parc, et les cinq écrans de gestion rendent leur état de
refus. Les profils propriétaire et gestionnaire sont inchangés — 10 lignes de
paiement, 12 unités au parc. Contraste, cibles tactiles et débordement
horizontal : 0 défaut.

---

## 14. Formatage des dates

`DATE_LOCALE` était défini depuis le premier commit sans être appelé nulle part.
Toutes les dates du produit étaient des chaînes françaises figées, y compris
dans l'interface anglaise — ce qui avait motivé le retrait de la promesse
« formats de date locaux » de la landing (§11).

Six séries ont été converties en valeurs machine, la présentation se calculant à
l'affichage via `lib/dates` :

| Série | Avant | FR | EN |
| --- | --- | --- | --- |
| Quittances | `'Août 2026'` | Août 2026 | August 2026 |
| Travaux | `'12/08'` | 12/08 | 12/08 |
| États des lieux | `'22/07/2026'` | 22/07/2026 | 22/07/2026 |
| Relevés | `'20/08'` | 20/08 | 20/08 |
| Axe du graphe | `'sep'`, `'fév'` | sept · févr | Sept · Feb |
| Signalements | `'il y a 2 h'`, `'hier'` | il y a 2 heures · hier | 2 hours ago · yesterday |

Les formats jour/mois ne changent pas entre les deux langues du produit : `fr-FR`
et `en-GB` placent tous deux le jour en premier. Ce n'est pas du code inerte —
la même date rend `08/12` sous `en-US`, et il suffirait de changer `DATE_LOCALE`
là où il aurait fallu réécrire le jeu de données.

`Intl.RelativeTimeFormat` en `numeric: 'auto'` a produit un gain inattendu :
−2 jours donne « avant-hier » en français, plus idiomatique que le « il y a
2 jours » qui avait été écrit à la main.

### Le format suit le pays, pas seulement la langue

Première version : le formatage ne dépendait que de la langue, `DATE_LOCALE.en`
valant `en-GB`. Un bailleur américain lisait donc des dates jour-d'abord, et la
promesse « formats de date locaux » aurait été légèrement fausse — elle avait
été reformulée en conséquence.

Le pays d'inscription pilote désormais le formatage. `region` rejoint `locale`
dans le provider i18n — c'est le même sujet — et `resolveDateLocale()` compose
une étiquette BCP-47 complète. Sans pays connu (visiteur de la landing,
inscription en « Autre pays »), on retombe sur le repli plutôt que d'inventer
une région.

| Pays / langue | Étiquette | État des lieux |
| --- | --- | --- |
| Cameroun / français | `fr-CM` | 22/07/2026 |
| France / français | `fr-FR` | 22/07/2026 |
| États-Unis / anglais | `en-US` | **07/22/2026** |
| Canada / français | `fr-CA` | **2026-07-22** |

Vérifié de bout en bout dans l'application, pas seulement sur `Intl` : mêmes
données, rendu différent selon la région enregistrée.

Un hook `useDates()` expose les formateurs liés à la langue et au pays courants.
Les écrans appellent `d.dayMonth(work.reportedAt)` au lieu de reconstruire
l'étiquette et d'éclater la date en trois arguments : un seul endroit connaît la
résolution, donc un seul endroit à corriger.

La landing reprend donc le libellé d'origine — « indicatifs téléphoniques et
formats de date locaux » — qui est devenu exact.

---

## 15. État partagé du parc

Chaque écran gardait sa propre copie des travaux et des cautions. Valider un
devis sur l'écran Travaux laissait donc le tableau de bord réclamer la même
décision dans sa carte « Ce qui demande une décision », et arbitrer une caution
ne se voyait pas dans l'espace locataire.

Le défaut est apparu par étapes, et l'ordre importe :

1. Les actions se contentaient d'une notification. Rien ne changeait nulle part,
   mais les écrans étaient cohérents entre eux.
2. L'arbitrage des cautions a été rendu réel — l'écran Travaux est alors devenu
   visiblement creux par comparaison.
3. La validation des devis a été rendue réelle à son tour — le tableau de bord
   est alors devenu le seul à ne pas suivre.

`PortfolioProvider` tient la place qu'occuperait le serveur : une source,
plusieurs lecteurs. Monté à la racine et non dans `AppShell`, pour que l'état
survive à la navigation.

Les sélecteurs `worksForUnit` et `depositForUnit` ont été **retirés** du module
de données et ne vivent plus que dans le provider. Deux fonctions homonymes —
l'une lisant la constante figée, l'autre l'état partagé — auraient fini par être
confondues. Les collections non modifiables (états des lieux, signalements)
restent servies depuis le module.

Les **unités** l'ont rejoint dans un second temps : créer une fiche locataire
occupe une unité, ce qui déplace le taux d'occupation, la liste du parc et le
suivi des paiements. Comme pour les travaux et les cautions, `unitById` a été
retiré du module pour ne pas laisser deux homonymes divergents.

### Le statut « En attente »

Il existait dans le dictionnaire sans être employé nulle part. Un bail qui
démarre le porte désormais : marquer un nouveau locataire *À jour* d'un loyer
qu'il n'a pas encore payé fausserait les indicateurs d'encaissement, et le
marquer *En retard* serait injuste. Son solde s'affiche donc en gris et non en
rouge — c'est une échéance à venir, pas un impayé.

### Vérification

| Geste | Effet vérifié |
| --- | --- |
| Valider le devis SIG-2026-042 | statut → *Validé*, bouton retiré, et le tableau de bord affiche « Rien à arbitrer pour le moment » |
| Arbitrer la caution A3 avec 30 000 de retenue | ligne → *Restituée*, solde 200 000, et les totaux passent de 163 000 à 148 000 de retenu |
| Créer la fiche d'Awa Diallo sur B4 | 11 lignes au lieu de 10, B4 passe *En attente*, les vacantes tombent de 2 à 1, l'occupation de 83 % à 92 %, et le parc comme les paiements suivent |

---

## 12. Validation de la liste des pays

Deux erreurs de fait et quatre défauts. La liste passe de 22 à **21 pays**.

### Deux devises fausses

| Pays | Devise codée | Devise réelle | Décision |
| --- | --- | --- | --- |
| Maroc | `USD` | dirham marocain (MAD) | **retiré** |
| Royaume-Uni | `USD` | livre sterling (GBP) | **retiré** |

Les deux étaient rangés sous un commentaire « Autres marchés USD » qui actait
l'erreur. Un bailleur marocain aurait vu son parc libellé en dollars. Ils
reviendront le jour où MAD et GBP seront pris en charge — les ajouter
maintenant aurait élargi le périmètre produit (sélecteur, formatage, section
internationale) pour deux marchés secondaires.

### Quatre autres corrections

- **Ordre du menu d'indicatifs.** Le tri de chaînes plaçait `+32` après `+242` :
  la Belgique et la France se retrouvaient derrière tous les indicatifs
  africains à trois chiffres. `sortedDialCodes()` trie désormais sur l'entier —
  `+1 +32 +33 +34 +221 … +245 +351 +352`.
- **« Congo » désambiguïsé** en « Congo-Brazzaville » / « Republic of the
  Congo ». La RDC est un marché francophone bien plus grand : l'entrée non
  qualifiée aurait fait choisir le mauvais pays.
- **UEMOA complétée** avec la Guinée-Bissau (`GW`, `+245`, XOF) : 8/8. La CEMAC
  était déjà complète à 6/6.
- **Option « Autre pays »** épinglée en fin de liste. Elle ne pré-remplit rien —
  devise et langue restent au choix de l'utilisateur — plutôt que de bloquer
  l'inscription ou de forcer une déclaration de pays inexacte.

### Un choix révisé

Le **Canada** passe de `fr` à `en` par défaut. Environ trois quarts de la
population est anglophone ; un bailleur québécois bascule en un clic.

### Couverture finale

| Devise | Pays |
| --- | --- |
| XAF | 6 — CEMAC complète |
| XOF | 8 — UEMOA complète |
| EUR | 5 |
| CAD | 1 |
| USD | 1 |

Plus l'entrée « Autre pays ». Aucune erreur de rattachement monétaire.
