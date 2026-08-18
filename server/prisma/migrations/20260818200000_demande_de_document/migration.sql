-- Donne une entité à la demande de pièce administrative.
--
-- Elle partait jusqu'ici par `addWork`, le canal des signalements : une
-- attestation de résidence arrivait au gestionnaire sous la forme d'une
-- intervention, avec un métier, une urgence, une référence de chantier et un
-- cycle devis → validation → clôture dont rien ne s'applique. Elle s'affichait
-- dans « Travaux dans mon logement », à côté d'une fuite d'évier.
--
-- La clé porte sur le BAIL et non sur l'unité : une unité a autant de dossiers
-- que de locataires successifs, et la demande appartient à celui qui l'a faite.
CREATE TYPE "DocumentKind" AS ENUM ('residence', 'goodStanding', 'leaseCopy');
CREATE TYPE "DocumentRequestStatus" AS ENUM ('pending', 'fulfilled', 'declined');

CREATE TABLE "DocumentRequest" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentRequest_leaseId_status_idx" ON "DocumentRequest" ("leaseId", "status");

-- Une seule demande EN ATTENTE par bail et par pièce.
--
-- Index unique PARTIEL, et non une garde applicative : deux requêtes
-- simultanées — le double clic sur un réseau lent, exactement le geste du
-- marché visé — liraient toutes deux « aucune demande en cours » avant que
-- l'une n'écrive. La fenêtre est étroite, donc le défaut serait rare, donc
-- irreproductible. Prisma ne sait pas déclarer un index partiel, d'où ce SQL.
--
-- Les demandes RÉSOLUES ne sont pas concernées : redemander une attestation
-- six mois plus tard est légitime, et l'historique des précédentes doit rester.
CREATE UNIQUE INDEX "DocumentRequest_bail_piece_en_attente_unique"
  ON "DocumentRequest" ("leaseId", "kind")
  WHERE "status" = 'pending';

ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
