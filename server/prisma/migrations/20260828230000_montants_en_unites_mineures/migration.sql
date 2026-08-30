-- LES MONTANTS DES PARCS À DEVISE DÉCIMALE PASSENT EN UNITÉS MINEURES.
--
-- ═══ CE QUI S'EST PASSÉ ═══
--
-- Le schéma tient ces montants pour des unités mineures depuis toujours : des
-- colonnes `Int`, des schémas de validation en `z.number().int()`, des noms en
-- `…Minor`. Le client, lui, les écrivait en unités d'USAGE — un loyer de neuf
-- cents euros partait « 900 ». Les deux moitiés se contredisaient sans que rien
-- ne le montre, parce que tout — la démonstration, les tests, le marché visé —
-- tourne en franc CFA, où la mineure et l'usage coïncident.
--
-- Le client a été corrigé et lit désormais des mineures. Sans cette migration,
-- les parcs déjà enregistrés en euro, en dollar canadien ou en dollar américain
-- verraient chacun de leurs montants divisé par cent : un loyer de neuf cents
-- euros s'afficherait à neuf.
--
-- ═══ CE QU'ELLE FAIT, ET CE QU'ELLE NE TOUCHE PAS ═══
--
-- Elle multiplie par cent les montants des seuls parcs dont la devise porte des
-- décimales. `XAF` et `XOF` n'en ont pas : leurs lignes ne bougent pas, et c'est
-- l'immense majorité de la base.
--
-- Douze colonnes, sur huit tables, toutes rattachées à un parc par jointure. La
-- liste est exhaustive : elle vient de `grep Minor schema.prisma`, et toute
-- colonne monétaire ajoutée après coup devra être reprise ici si elle précède
-- ce déploiement.
--
-- ═══ ELLE N'EST PAS REJOUABLE, ET C'EST À PRENDRE AU SÉRIEUX ═══
--
-- Multiplier deux fois par cent est irréparable sans sauvegarde. Prisma tient le
-- registre des migrations appliquées et ne la rejouera pas d'elle-même ; ce qu'il
-- ne protège pas, c'est une exécution manuelle. Elle porte donc une garde : elle
-- ne s'applique qu'aux parcs qui n'ont pas encore été convertis, marqués par
-- `Park.amountsAreMinor`.
--
-- ═══ AVANT DE DÉPLOYER ═══
--
-- Compter ce qui va bouger :
--
--   SELECT p.currency, count(*) FROM "Park" p WHERE p.currency IN ('EUR','CAD','USD')
--   GROUP BY p.currency;
--
-- Le produit ne doit pas être servi entre le déploiement du client corrigé et
-- l'application de cette migration.

-- Le témoin de conversion. `true` par défaut : tout parc créé APRÈS ce
-- déploiement est écrit par un client qui compte déjà en mineures.
ALTER TABLE "Park" ADD COLUMN "amountsAreMinor" BOOLEAN NOT NULL DEFAULT true;

-- Les parcs existants ne le sont pas encore — sauf ceux dont la devise n'a pas
-- de sous-unité, pour qui la question ne se pose pas.
UPDATE "Park" SET "amountsAreMinor" = ("currency" NOT IN ('EUR', 'CAD', 'USD'));

-- Les parcs à convertir, une fois pour toutes.
CREATE TEMP TABLE "parcs_a_convertir" AS
  SELECT "id" FROM "Park" WHERE "amountsAreMinor" = false;

UPDATE "Unit" u SET "baseRentMinor" = u."baseRentMinor" * 100
  FROM "Building" b WHERE u."buildingId" = b."id"
  AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "Lease" l SET "rentMinor" = l."rentMinor" * 100
  FROM "Unit" u JOIN "Building" b ON u."buildingId" = b."id"
  WHERE l."unitId" = u."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "RentCharge" c
  SET "rentMinor" = c."rentMinor" * 100,
      "waterMinor" = c."waterMinor" * 100,
      "powerMinor" = c."powerMinor" * 100
  FROM "Lease" l JOIN "Unit" u ON l."unitId" = u."id" JOIN "Building" b ON u."buildingId" = b."id"
  WHERE c."leaseId" = l."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "Payment" p SET "amountMinor" = p."amountMinor" * 100
  FROM "RentCharge" c JOIN "Lease" l ON c."leaseId" = l."id"
    JOIN "Unit" u ON l."unitId" = u."id" JOIN "Building" b ON u."buildingId" = b."id"
  WHERE p."chargeId" = c."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "Deposit" d
  SET "heldMinor" = d."heldMinor" * 100, "withheldMinor" = d."withheldMinor" * 100
  FROM "Lease" l JOIN "Unit" u ON l."unitId" = u."id" JOIN "Building" b ON u."buildingId" = b."id"
  WHERE d."leaseId" = l."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "UtilityTariff" t SET "unitPriceMinor" = t."unitPriceMinor" * 100
  WHERE t."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

UPDATE "InspectionFinding" f SET "costMinor" = f."costMinor" * 100
  FROM "Inspection" i JOIN "Unit" u ON i."unitId" = u."id" JOIN "Building" b ON u."buildingId" = b."id"
  WHERE f."inspectionId" = i."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir")
  AND f."costMinor" IS NOT NULL;

UPDATE "WorkOrder" w
  SET "quotedAmountMinor" = w."quotedAmountMinor" * 100,
      "approvedAmountMinor" = w."approvedAmountMinor" * 100
  FROM "Unit" u JOIN "Building" b ON u."buildingId" = b."id"
  WHERE w."unitId" = u."id" AND b."parkId" IN (SELECT "id" FROM "parcs_a_convertir");

-- Convertis : la garde se referme.
UPDATE "Park" SET "amountsAreMinor" = true
  WHERE "id" IN (SELECT "id" FROM "parcs_a_convertir");

DROP TABLE "parcs_a_convertir";
