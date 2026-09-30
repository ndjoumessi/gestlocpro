-- CE QUI SORT, ET NON PLUS SEULEMENT CE QUI RENTRE.
--
-- Le produit savait l'entrant au centime : `RentCharge` appelle un loyer,
-- `Payment` l'encaisse, et deux tables suffisaient à dire ce qu'un parc a
-- perçu. Le sortant, lui, n'existait qu'à travers les chantiers —
-- `WorkOrder.approvedAmountMinor`. Taxe foncière, prime d'assurance,
-- quote-part de syndic, facture du distributeur réglée par le bailleur,
-- entretien courant : aucune de ces lignes n'avait de place en base.
--
-- La conséquence était mesurable dans le produit : aucun écran ne pouvait
-- afficher un résultat, aucun relevé ne pouvait être rendu à un mandant, et
-- le bailleur refaisait la soustraction dans un tableur — à côté d'un produit
-- qui connaissait déjà la moitié de l'opération.
--
-- UN CHANTIER EST DÉJÀ UNE DÉPENSE, ET N'EST PAS RECOPIÉ ICI.
--
-- Deux réponses étaient possibles. Dupliquer chaque chantier approuvé en
-- `Expense`, ce qui rendrait le sortant lisible d'une seule table. Ou faire
-- lire les DEUX tables à tout calcul de résultat. La seconde est retenue :
-- une copie peut diverger de son original, et une dépense qui doublerait un
-- chantier gonflerait le sortant sans qu'aucune porte ne puisse le voir — ni
-- le schéma, ni un test, ni un écran. Le prix de ce choix est que le résultat
-- interroge deux tables ; il se paie une fois, à l'endroit qui somme, et non
-- à chaque saisie.
--
-- LA PORTÉE EST EXCLUSIVE, ET LA BASE NE SAIT PAS LE DIRE.
--
-- `buildingId` et `unitId` sont tous deux NULLABLE, et les trois combinaisons
-- utiles sont : les deux vides (la dépense est du parc entier), l'immeuble
-- seul, le logement seul. La quatrième — les deux posés — est interdite, parce
-- qu'un résultat qui agrège par immeuble compterait alors la même dépense
-- deux fois : une fois par son immeuble, une fois par l'immeuble de son
-- logement.
--
-- PostgreSQL saurait l'exprimer par une contrainte de vérification, et Prisma
-- ne sait pas la déclarer : une `CHECK` posée ici disparaîtrait au prochain
-- `prisma migrate dev`, qui régénère le DDL depuis le schéma. Écrire la garde
-- uniquement en SQL reviendrait donc à la perdre en silence. Elle vit en zod,
-- à l'entrée de la route, et un cas la tient — c'est déclaré ici pour que
-- personne ne la cherche en base.
--
-- `unitId` N'IMPLIQUE PAS SON IMMEUBLE, volontairement : le résultat d'un
-- immeuble remonte ses logements par jointure. Dénormaliser le rattachement
-- ici ouvrirait deux vérités sur l'immeuble d'un même logement, et c'est
-- exactement le défaut n° 5 que l'en-tête du schéma dit avoir corrigé.
--
-- DEUX DATES, PARCE QU'ELLES RÉPONDENT À DEUX QUESTIONS. `incurredOn` dit
-- quand la dépense est née, `paidOn` quand elle a été réglée. Une taxe due en
-- janvier et payée en mars appartient à janvier dans un résultat et à mars
-- dans une trésorerie. `paidOn` vide se lit « engagée, pas encore payée » :
-- c'est un état du métier, pas une donnée manquante.
--
-- `recordedById` EN SET NULL, et non en cascade : l'effacement du compte d'un
-- gestionnaire ne doit pas emporter la comptabilité du parc qu'il tenait. La
-- ligne perd son auteur, jamais son montant.
--
-- AUCUNE CONTRAINTE D'UNICITÉ. Deux primes d'assurance du même montant, le
-- même jour, sur le même immeuble, sont possibles — deux lots distincts chez
-- deux assureurs. Imposer l'unicité forcerait à fusionner deux faits en une
-- ligne pour contourner la base, et c'est toujours la base qui perd.
CREATE TYPE "ExpenseCategory" AS ENUM ('tax', 'insurance', 'syndic', 'utility', 'upkeep', 'other');

CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "parkId" UUID NOT NULL,
    "buildingId" UUID,
    "unitId" UUID,
    "category" "ExpenseCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "incurredOn" DATE NOT NULL,
    "paidOn" DATE,
    "note" TEXT,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Le résultat se demande toujours par parc ET par intervalle de dates : c'est
-- la seule lecture que cette table connaisse, et elle la connaît par cœur.
CREATE INDEX "Expense_parkId_incurredOn_idx" ON "Expense"("parkId", "incurredOn");

-- Les deux portées, interrogées seules quand un écran descend d'un cran.
CREATE INDEX "Expense_buildingId_idx" ON "Expense"("buildingId");
CREATE INDEX "Expense_unitId_idx" ON "Expense"("unitId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
