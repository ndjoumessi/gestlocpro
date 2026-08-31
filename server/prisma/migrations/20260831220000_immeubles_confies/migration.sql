-- LE PÉRIMÈTRE D'UN GESTIONNAIRE — les immeubles qu'on lui a confiés.
--
-- Aucune ligne n'est créée : le vide vaut « tout le parc », et c'est ce qui rend
-- cette migration sûre à déployer. L'alternative — « aucun immeuble confié =
-- rien à voir » — aveuglerait tous les gestionnaires en place à la seconde du
-- déploiement.
--
-- `ON DELETE CASCADE` des deux côtés : un immeuble supprimé ou un accès révoqué
-- emporte le rattachement, qui ne décrit plus rien.
CREATE TABLE "MembershipBuilding" (
    "membershipId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipBuilding_pkey" PRIMARY KEY ("membershipId","buildingId")
);

CREATE INDEX "MembershipBuilding_buildingId_idx" ON "MembershipBuilding"("buildingId");

ALTER TABLE "MembershipBuilding" ADD CONSTRAINT "MembershipBuilding_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipBuilding" ADD CONSTRAINT "MembershipBuilding_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
