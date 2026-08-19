-- L'ORIGINE d'une intervention, et l'auteur qui manquait.
--
-- Jusqu'ici une intervention naissait forcément d'un signalement de locataire :
-- c'était le seul chemin ouvert par l'interface. Le bailleur qui remplaçait un
-- chauffe-eau de sa propre initiative n'avait aucun endroit où l'enregistrer,
-- donc la dépense n'existait nulle part.
--
-- Le défaut `tenantReport` n'est pas une commodité : c'est la vérité des lignes
-- déjà en base, dont aucune ne peut avoir une autre origine.
CREATE TYPE "WorkOrigin" AS ENUM ('tenantReport', 'ownerInitiative');

ALTER TABLE "WorkOrder"
  ADD COLUMN "origin" "WorkOrigin" NOT NULL DEFAULT 'tenantReport',
  ADD COLUMN "reportedById" UUID;

-- `reportedByTenantId` existait en UUID NU, sans contrainte : rien n'empêchait
-- un identifiant orphelin, et surtout aucune jointure ne pouvait ramener le nom
-- du déclarant. Le champ était donc écrit depuis l'origine et lu nulle part.
--
-- SET NULL et non CASCADE : un locataire parti ne doit pas emporter avec lui
-- l'intervention qu'il a fait naître. Le travail reste, son déclarant s'efface —
-- comme `approvedById` le fait déjà pour qui a validé la dépense.
ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_reportedByTenantId_fkey"
  FOREIGN KEY ("reportedByTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La liste se filtre par origine ; sans index, chaque bascule de filtre
-- balaierait les interventions de toutes les unités du parc.
CREATE INDEX "WorkOrder_unitId_origin_idx" ON "WorkOrder"("unitId", "origin");
