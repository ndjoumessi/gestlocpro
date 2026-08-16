-- `Lease.tenantId` passe de RESTRICT à NO ACTION.
--
-- Les deux refusent de supprimer un locataire encore cité par un bail, ce qui
-- est l'intention : un bail sans locataire n'est pas un bail. La différence est
-- le MOMENT de la vérification. `RESTRICT` contrôle immédiatement, ligne à
-- ligne ; `NO ACTION` contrôle en fin d'instruction.
--
-- Conséquence observée : supprimer un parc échouait. La cascade descend vers
-- `Tenant` et, par `Building` puis `Unit`, vers `Lease` — mais `RESTRICT`
-- faisait échouer la première branche avant que la seconde n'ait supprimé les
-- baux. Le défaut ne tenait pas au modèle, seulement à l'instant du contrôle.
--
-- La protection est inchangée : supprimer un locataire qui a des baux échoue
-- toujours.
ALTER TABLE "Lease" DROP CONSTRAINT "Lease_tenantId_fkey";
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
