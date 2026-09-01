-- UN LOGEMENT CONFIÉ, quand l'immeuble est une maille trop large.
--
-- Aucune ligne n'est créée, et le vide garde son sens : le périmètre d'un
-- gestionnaire est l'UNION de ses immeubles et de ses logements, et vide des
-- deux côtés vaut « tout le parc ». La migration ne change donc le périmètre de
-- personne — c'est ce qui la rend sûre à déployer, exactement comme celle des
-- immeubles.
--
-- `ON DELETE CASCADE` des deux côtés : un logement supprimé ou un accès révoqué
-- emporte le rattachement, qui ne décrit plus rien.
CREATE TABLE "MembershipUnit" (
    "membershipId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipUnit_pkey" PRIMARY KEY ("membershipId","unitId")
);

CREATE INDEX "MembershipUnit_unitId_idx" ON "MembershipUnit"("unitId");

ALTER TABLE "MembershipUnit" ADD CONSTRAINT "MembershipUnit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipUnit" ADD CONSTRAINT "MembershipUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
