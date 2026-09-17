-- « SIG-2026-001 » APPARTIENT À UN PARC, PAS AU PRODUIT.
--
-- `WorkOrder.reference` était unique GLOBALEMENT alors que le compteur qui la
-- fabrique est par parc et par année. Le premier signalement du second parc
-- rendait donc 500 — relevé le 2026-09-16 en rejouant le geste du produit.
--
-- LE PARC EST RECOPIÉ SUR L'INTERVENTION. Il se déduit par
-- `unit.building.parkId`, mais aucune jointure ne peut porter une contrainte
-- d'unicité : c'est ce que cette colonne paie, et rien d'autre.
--
-- REMPLI DEPUIS LE CHEMIN EXISTANT avant d'être rendu obligatoire : aucune
-- intervention n'est perdue, et aucune ne change de parc — la valeur écrite est
-- celle que la jointure rendait déjà.
ALTER TABLE "WorkOrder" ADD COLUMN "parkId" UUID;

UPDATE "WorkOrder" AS w
SET "parkId" = b."parkId"
FROM "Unit" AS u
JOIN "Building" AS b ON b."id" = u."buildingId"
WHERE u."id" = w."unitId";

ALTER TABLE "WorkOrder" ALTER COLUMN "parkId" SET NOT NULL;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_parkId_fkey"
  FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- L'UNICITÉ CHANGE DE PORTÉE, elle ne disparaît pas : deux signalements d'un
-- même parc ne peuvent toujours pas porter le même numéro.
DROP INDEX "WorkOrder_reference_key";
CREATE UNIQUE INDEX "WorkOrder_parkId_reference_key" ON "WorkOrder"("parkId", "reference");
