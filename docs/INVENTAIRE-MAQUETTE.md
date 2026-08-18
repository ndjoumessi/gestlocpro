# La maquette, confrontée au produit

Inventaire tiré de `GESLOC_Mockup_FR_offline.html` (23 écrans, trois rôles, plus une
application mobile), confronté au dépôt à `d2b85b1`. Chaque point dit ce que la maquette
montre, ce que le produit fait, et ce que l'écart coûte.

Trois catégories, et l'ordre compte : **ce qui est cassé aujourd'hui**, **ce qui manque et
se construit sur des données déjà là**, **ce qui demande une brique que le produit n'a pas**.
Une quatrième liste ce qu'il ne faut PAS construire tel quel.

---

## 1. Ce que la maquette révèle en creux — trois défauts, déjà en production

Ces trois-là ne sont pas des fonctionnalités manquantes. Ce sont des promesses que le
produit fait déjà et ne tient pas. Ils passent avant tout le reste.

### 1.1 Une relance s'affiche en clé technique — DÉFAUT VISIBLE

Le serveur écrit `messageKey: 'notifications.rentReminder'` pour une relance
(`server/src/parks/routes.ts`, route `POST /parks/:parkId/reminders`) et
`'notifications.formalNotice'` pour une mise en demeure. Le jeu de démonstration, lui,
écrit `'rentOverdue'`, `'quotePending'`, `'metersMissing'` — **sans préfixe**.

L'écran des signalements construit sa clé ainsi (`Alerts.tsx`) :

```
app.alerts.msg.${alert.message}.title
```

Pour une relance réelle, cela donne `app.alerts.msg.notifications.rentReminder.title`, qui
n'existe dans aucun des deux dictionnaires. `I18nProvider` rend alors **la clé brute**.
Autrement dit : dès qu'un gestionnaire relance un impayé sur un vrai parc, sa liste de
signalements affiche `app.alerts.msg.notifications.rentReminder.title` à la place d'une
phrase.

Pourquoi personne ne l'a vu : **toute la suite du gestionnaire tourne en démonstration**, où
les clés sont les bonnes. C'est exactement l'angle mort qui avait laissé passer les quatre
fuites du jeu de démonstration dans le portail locataire.

Correctif : deux entrées dans `app.alerts.msg` (fr + en), et un cas dans un test qui monte
un parc servi par l'API. Une heure, tout compris.

### 1.2 « Le locataire recevra sa quittance par e-mail et par SMS » — il ne reçoit rien

`fr.ts` → `app.payments.modalDescription`. La route d'émission des quittances
(`POST /parks/:parkId/receipts`) n'appelle pas la messagerie, et l'unique implémentation de
celle-ci (`MessagerieDeJournal`) journalise et retourne `false` — rien ne part, nulle part.
Le produit est honnête ailleurs sur ce point (l'invitation affiche « Aucun SMS n'a été
envoyé ») ; cette phrase-ci est la seule qui affirme le contraire.

Correctif : réécrire la phrase, ou brancher un fournisseur SMS. La première est immédiate et
gratuite ; la seconde est un vrai chantier (voir §3.2).

### 1.3 « Le gestionnaire dépose la pièce dans cet espace » — il ne dépose rien

`fr.ts` → `app.documents.requestHint`, sous le formulaire de demande de document que nous
venons de livrer. Le gestionnaire marque « fournie » ; aucun fichier ne change de main,
parce que **le produit ne sait recevoir aucun fichier** (§3.1). La phrase date d'avant
l'entité et n'a pas suivi.

Correctif : une phrase, cinq minutes. C'est la même règle que celle qui gouverne l'écran —
on annonce la case vide plutôt que d'inventer la pièce.

---

## 2. Ce qui manque et se construit sur des données DÉJÀ présentes

Par ordre de valeur rendue par unité d'effort.

### 2.1 L'écran Paiements du gestionnaire, en grille par période ★★★

**La maquette** montre une grille : une ligne par bail, une colonne par mois, et dans chaque
cellule trois pastilles — loyer, eau, électricité. Plus une colonne SOLDE cumulée
(« −258 000 », « +165 000 ») qui distingue l'avance du retard.

**Le produit** montre une ligne par bail et une seule colonne de montant, sur **le mois
courant seulement**. Ni eau, ni électricité, ni cumul.

**Ce qui rend ce point exceptionnel** : la donnée est déjà là, entièrement. `leaseCharges`
— toutes les périodes de tous les baux, avec `rentMinor`, `waterMinor`, `powerMinor`,
`paidMinor` — est renvoyée par `/portfolio` depuis le commit `73f3fd4`, et le client la
convertit déjà. Le tableau par période **existe même déjà**, côté locataire
(`TenantDashboard`), imputation par poste comprise. Il s'agit de le porter dans l'écran du
gestionnaire, en le faisant tenir sur douze colonnes.

Zéro ligne de serveur. C'est le meilleur rapport de toute la liste.

### 2.2 Le solde cumulé par bail ★★★

Corollaire du précédent, et il vaut d'être nommé à part : « Paul K. · −258 000 » se lit d'un
coup d'œil quand « impayé ce mois-ci » ne dit pas si la dette est ancienne. La somme de
`receiptDue() − paidMinor` sur toutes les périodes du bail, rien de plus.

### 2.3 Le dossier d'un logement ★★★

**La maquette** : « Cliquez sur une unité pour ouvrir son dossier complet — historique
d'occupation, travaux, compteurs et baux archivés. »

**Le produit** : aucune route `/parc/:unitId`, aucun clic sur une ligne du parc. Les
informations d'un logement sont éparpillées sur cinq écrans, et l'historique des locataires
successifs n'est visible nulle part — alors que le modèle le porte (`Lease` est daté,
`endsOn` existe).

C'est l'écran qui manque le plus au métier : la question « que s'est-il passé dans ce
logement ? » n'a aujourd'hui aucune réponse. Une route, un écran, et une requête serveur qui
lit par unité au lieu de par parc.

### 2.4 Le détail chiffré d'un état des lieux, et sa comparaison entrée/sortie ★★

**La maquette** montre les deux constats côte à côte, élément par élément, avec la retenue
en regard de chaque écart : « Vitre fenêtre chambre 2 · Bon état → Cassée · 20 000 ».

**Le produit** saisit exactement cette donnée — `InspectionModal` enregistre
`room / description / severity / costMinor` — mais le serveur ne rend que
`_count.findings`, et l'écran n'affiche qu'un nombre. Le commentaire de `routes.ts` le dit :
« le détail n'a pas encore d'écran pour le montrer ».

La retenue proposée sur la caution est déjà calculée à partir de ces coûts (`billableMinor`).
Il ne manque que la lecture détaillée et la mise en regard. Le gain est direct : c'est la
pièce qu'on oppose au locataire dans un litige.

### 2.5 Les indicateurs de travaux, et l'origine d'une intervention ★★

**La maquette** : dépenses de l'année, % des loyers annuels, logement le plus coûteux, et
surtout une colonne ORIGINE — signalement locataire, état des lieux, entretien planifié,
remise en location.

**Le produit** : aucun indicateur sur l'écran des travaux, et une intervention ne peut
**naître que d'un signalement de locataire**. Un bailleur ne peut pas enregistrer un
entretien planifié ni des travaux de remise en location — ce qui est un vrai trou : les
travaux les plus coûteux de la maquette (réfection de toiture, 450 000) sont précisément
ceux-là.

Coût : un champ `origin` sur `WorkOrder` (migration + enum), une route de création ouverte
au bailleur, trois `StatCard`. Les montants existent déjà.

### 2.6 Le journal des relances ★★

**La maquette** : « Rappel #4 envoyé à Paul K. · SMS + notification · 240 000 dus », daté,
avec le rang.

**Le produit** trace déjà chaque relance (une `Notification` + un `AuditEvent`
`rent.remind`), mais **aucun écran ne les liste correctement** — et le défaut §1.1 fait que
celles qui apparaissent sont illisibles. Le rang (« #4 ») n'existe pas : il se compte
pourtant en une requête sur les `AuditEvent` du bail.

Corriger §1.1 puis ajouter le décompte : le journal existe déjà, il ne sait pas se dire.

### 2.7 La consommation du locataire sur douze mois ★

**La maquette** donne au locataire un histogramme eau/électricité sur douze mois, avec une
phrase qui l'interprète : « Août est votre mois le plus consommateur : +29 % d'eau par
rapport à mai. »

**Le produit** ne lui montre que le mois courant. Les `MeterReading` sont stockés par
période depuis l'origine : douze mois d'index existent en base dès que le parc tourne depuis
un an. Le composant d'histogramme existe (`StackedBarChart`).

---

## 3. Ce qui demande une brique que le produit n'a pas

Ces points ne sont pas plus « difficiles » : ils demandent une décision d'infrastructure, et
tant qu'elle n'est pas prise, aucune quantité de code d'écran ne les rapproche.

### 3.1 Le dépôt de fichiers — la brique manquante la plus structurante

La maquette met un PDF ou une photo à **onze endroits** : bail signé, état des lieux
d'entrée et de sortie, reçu de caution, quittances, photos de sortie (« vitre chambre 2 »,
« mitigeur SDB », « compteurs »), photos jointes à un signalement, pièces demandées, pièce
d'identité vérifiée.

Le produit n'a **rien** : aucun `input type="file"`, aucun `multipart`, aucun modèle de
média, aucun stockage. Trois écrans annoncent déjà honnêtement leur case vide — c'est la
bonne réponse tant que la brique n'existe pas, mais c'est aussi ce qui plafonne le produit.

Il y a **deux briques distinctes** derrière, et les confondre coûterait cher :

- **Recevoir** un fichier (stockage objet, taille, type, antivirus, droits d'accès). C'est
  ce qui débloque : bail signé, photos de signalement, photos d'état des lieux, pièces
  fournies par le gestionnaire.
- **Fabriquer** un PDF opposable (quittance signée, mention légale). C'est un autre métier,
  et `receiptExport.ts` le dit déjà. La quittance CSV actuelle est un pis-aller assumé.

Recommandation : traiter la réception d'abord. Elle rend « fournie » vrai (§1.3), donne un
sens aux photos de signalement, et transforme l'état des lieux en pièce opposable.

### 3.2 Les envois réels — SMS et e-mail

`MessagerieDeJournal` journalise et rend `false`. Deux chemins l'appellent (code
d'invitation, relance d'impayé) ; les quittances ne l'appellent même pas, malgré ce
qu'annonce §1.2. Aucun ordonnanceur non plus : les jalons de relance J+1 / J+7 / J+15
existent comme filtre, **rien ne les déclenche** — la landing promet pourtant des relances
automatiques.

Deux décisions à prendre : le fournisseur (le marché visé rend le SMS plus utile que
l'e-mail), et l'ordonnanceur (cron du conteneur, ou service géré).

### 3.3 Le message groupé aux locataires

« Une intervention sur le réseau d'eau est prévue jeudi 20/08 entre 8 h et 12 h » envoyé aux
4 locataires d'un immeuble, par notification et SMS. **Rien de tel n'existe** : le seul envoi
multi-destinataires est la relance d'impayés, sans message libre.

La moitié « notification dans l'app » est faisable tout de suite (le modèle `Notification`
porte déjà des destinataires) ; la moitié SMS dépend de §3.2.

### 3.4 Le signalement collectif et la réponse au locataire

La maquette montre « Signalé par 2 locataires » sur une coupure d'eau d'immeuble, et un
bouton « Répondre au locataire ». Le modèle a un seul `reportedByTenantId` et une seule
`unitId` ; aucun fil de discussion nulle part.

Le locataire ne peut aujourd'hui que regarder un statut avancer. C'est la même nature de
manque que la demande de document avant sa correction : le canal existe dans un sens, pas
dans l'autre.

### 3.5 L'application mobile et le mode hors ligne

Quatre écrans mobiles dans la maquette, avec « Mode hors ligne — dernière synchronisation à
09:12 » et « Envoi possible hors ligne, transmis dès le retour du réseau ».

Le produit n'a **aucun** mécanisme hors ligne : pas de service worker, pas de file de
synchronisation. La section i18n `app.offline` sert à un bandeau « Serveur injoignable », et
la vitrine `SystemStates` porte son propre démenti : « La synchronisation différée n'est pas
encore implémentée. »

Sur le marché visé, c'est probablement le point le plus structurant de toute la maquette — et
le plus lourd. Il mérite une décision explicite, pas un glissement.

---

## 4. Ce qu'il ne faut PAS construire tel quel

La maquette contient des éléments qui, portés à l'identique, feraient régresser le produit.

- **« DERNIER ACCÈS · 12/08/2026 09:41 »** sur l'écran des documents. Rien ne journalise les
  consultations : cette ligne annoncerait une traçabilité inexistante, sur l'écran même où
  l'on promet la confidentialité. Déjà refusée, et un test la garde.
- **« l'action reste annulable pendant 6 secondes »**. Le dépôt a tranché l'inverse pour la
  réouverture d'une intervention : une décision prise pour une autre se découvre en relisant
  sa liste, pas dans les six secondes. Une fenêtre d'annulation courte donne l'illusion d'un
  filet.
- **« Vos pièces sont chiffrées au stockage »**. À n'écrire que le jour où c'est vrai.
- **La cloche décorative** de la barre du locataire — déjà écartée, faute de file de
  notifications à ouvrir.
- **Les moyens de paiement en dur** (« payé par Mobile Money ») : c'est désormais une donnée
  du serveur, et il ne faut pas la refiger dans un libellé.
- **« gestionnaire Diane F. »** dans l'en-tête du locataire : rien dans le modèle ne relie un
  gestionnaire à une unité. La ligne ne revient que le jour où `Membership` porte ce lien —
  ce qui est un vrai sujet, mais un sujet de modèle, pas d'affichage.

---

## 5. L'ordre que je propose

1. **Les trois défauts du §1** — une demi-journée, et le produit cesse de mentir. §1.1 est le
   seul vrai bug, les deux autres sont des phrases.
2. **§2.1 + §2.2, l'écran Paiements en grille** — zéro serveur, donnée déjà là, c'est le
   gain le plus visible pour le gestionnaire.
3. **§2.3, le dossier d'un logement** — le manque le plus criant côté métier.
4. **§3.1, recevoir un fichier** — la décision d'infrastructure à prendre en premier ; elle
   débloque cinq écrans d'un coup et rend vrai ce que trois d'entre eux annoncent.
5. **§2.4 et §2.5** — détail des états des lieux, origine et coût des travaux.
6. **§3.2 puis §3.3** — envois réels, puis message groupé.
7. **§3.5** — hors ligne, en décision explicite et non en glissement.

Le §2.6 (journal des relances) se fait naturellement en même temps que §1.1 ; le §2.7
(consommation du locataire) est un bonus peu coûteux à glisser quand on rouvre son espace.
