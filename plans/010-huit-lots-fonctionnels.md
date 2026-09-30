# Huit lots fonctionnels — conception des données

Commandés le 2026-09-30, à partir des huit absences relevées dans le schéma.
Un lot = un commit. L'ordre n'est pas négociable là où il porte une dépendance.

## Ordre et dépendances

| N° | Lot | Dépend de | Pourquoi cet ordre |
| --- | --- | --- | --- |
| 1 | Dépenses | — | Rien ne calcule un résultat sans lui |
| 2 | Honoraires + compte-rendu de gestion | **1** | Le compte-rendu soustrait des dépenses |
| 3 | Congé, révision, garant | — | Touche `Lease`, que 4 et 6 lisent |
| 4 | Plan d'apurement | 3 | Lit le bail et ses échéances |
| 5 | Justificatif de paiement | — | Réemploie le stockage en place |
| 6 | Lignes de charges + régularisation | 1 | La régularisation compare au réel payé |
| 7 | Canal WhatsApp | — | Transport de plus, aucun modèle métier |
| 8 | Vacance : annonce et candidats | — | Domaine neuf, isolé |

## Lot 1 — Dépenses

**La décision qui structure tout le reste : un chantier EST déjà une dépense.**
`WorkOrder.approvedAmountMinor` porte de l'argent engagé. Deux réponses possibles :
dupliquer le chantier en `Expense`, ou faire lire les DEUX tables au calcul du
résultat. La seconde est retenue — une dépense qui double un chantier fausserait
le résultat sans qu'aucune porte ne le voie. Un cas devra le dire.

```
enum ExpenseCategory { tax insurance syndic utility upkeep other }

model Expense {
  parkId, buildingId?, unitId?     -- portée : parc, immeuble OU logement
  category, label, amountMinor, currency
  incurredOn (Date), paidOn (Date)?
  note?, recordedById?
}
```

Portée exclusive : `buildingId` et `unitId` ne peuvent pas être tous deux posés.
Prisma ne sait pas dire « ou exclusif » — la garde est en zod ET dans un cas.

## Lot 2 — Honoraires et compte-rendu de gestion

```
enum FeeBasis { percentOfCollected fixedPerUnit fixedPerMonth }

model ManagementFee {
  membershipId (le gestionnaire), basis
  rateBasisPoints?   -- points de base, pour rester entier
  fixedMinor?, currency, startsOn, endsOn?
}

model OwnerStatement {
  parkId, membershipId, periodStart, periodEnd
  collectedMinor, expensesMinor, feeMinor, netRemittedMinor, currency
  status: draft | issued | settled
  @@unique([membershipId, periodStart])
}
```

Le taux en **points de base** et non en pourcentage flottant : 8,5 % s'écrit 850.
Même raison que les montants en unités mineures — aucun flottant sur de l'argent.

## Lot 3 — Congé, révision, garant

Sur `Lease`, quatre colonnes : `noticeGivenOn`, `noticeGivenBy` (enum
`tenant | landlord`), `noticeReason?`, `moveOutOn`. Un congé n'est pas une fin :
le bail reste `active` jusqu'à `moveOutOn`.

```
model RentRevision { leaseId, effectiveOn, previousRentMinor, newRentMinor, reason?, decidedById }
model Guarantor    { leaseId, fullName, phoneE164?, email?, relation? }
```

`Lease.rentMinor` reste le loyer COURANT ; `RentRevision` est la trace. Appliquer
une révision écrit les deux dans la même transaction, sinon l'historique ment.

## Lot 4 — Plan d'apurement

```
enum SettlementPlanStatus { active honoured broken cancelled }
model SettlementPlan       { leaseId, agreedOn, totalMinor, currency, status, note?, createdById }
model SettlementInstalment { planId, dueOn, amountMinor }
```

**Aucune colonne « payé » sur l'échéance.** Ce qui est payé se DÉDUIT des
paiements du bail sur l'intervalle : une colonne entretenue à la main divergerait
du jour où quelqu'un encaisse sans passer par le plan.

## Lot 5 — Justificatif de paiement

Réemploi exact du stockage de `DocumentRequestFile` — confirmation en deux temps,
plusieurs fichiers. Rien à inventer.

```
model PaymentProof { paymentId, storageKey, mimeType, byteSize, originalName?, uploadedById? }
```

## Lot 6 — Lignes de charges et régularisation

`RentCharge` porte `waterMinor` et `powerMinor` en dur. **Décision en suspens**
jusqu'au rapport de la porte `colonnesAjoutees` : migrer ces deux colonnes en
lignes (une seule vérité, migration de données) ou ajouter les lignes à côté
(deux vérités, aucune migration risquée). La première est juste, la seconde est
sûre. Ne pas trancher sans savoir ce que la porte exige.

```
model ChargeSettlement { leaseId, periodStart, periodEnd, provisionedMinor, actualMinor, balanceMinor, status, settledAt? }
```

## Lot 7 — Canal WhatsApp

`NotificationChannel` reçoit `whatsapp`. L'envoi passe par le client Twilio DÉJÀ
en place (`server/src/messagerie/twilio.ts`) : Twilio sert WhatsApp sur la même
clé. Aucun nouveau fournisseur, aucun nouveau secret à provisionner.

## Lot 8 — Vacance

```
enum UnitMarketStatus { off_market listed reserved }
enum ApplicantStatus  { received screening accepted rejected withdrawn }
model Listing   { unitId @unique, askingRentMinor, currency, availableOn, description?, publishedAt?, status }
model Applicant { listingId, fullName, phoneE164?, email?, status, note?, appliedAt, decidedAt?, decidedById? }
```

## Ce que je peux avoir raté

- Le loyer demandé d'une annonce double `Unit.baseRentMinor`. Voulu : le loyer
  affiché se négocie, le loyer de référence non. À dire dans un commentaire.
- Le lot 6 peut rendre le lot 1 partiellement redondant si une régularisation de
  charges est aussi une dépense. À trancher en écrivant le lot 6, pas avant.
- Aucun de ces huit lots ne touche à la facturation de l'abonnement, qui reste
  le trou nommé au point 1 de l'analyse précédente et n'est PAS commandé ici.
