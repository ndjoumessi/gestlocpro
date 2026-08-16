-- `Lease.tenantId` devient une contrainte DIFFÉRÉE.
--
-- La migration précédente est passée de RESTRICT à NO ACTION en pariant que le
-- contrôle aurait lieu en fin d'instruction. Vérification faite en base : sans
-- `DEFERRABLE`, PostgreSQL contrôle une contrainte NO ACTION au même moment
-- qu'une RESTRICT, et supprimer un parc échouait toujours. Le pari était faux ;
-- c'est la déférabilité qui compte, pas le nom de l'action.
--
-- Différée au commit, la contrainte laisse les deux branches de la cascade se
-- dérouler — `Park → Tenant` d'un côté, `Park → Building → Unit → Lease` de
-- l'autre — avant de vérifier qu'il ne reste aucun bail orphelin.
--
-- Ce que cela ne change pas : supprimer un locataire qui a encore des baux
-- échoue. L'erreur survient simplement au commit et non à l'instruction, ce que
-- l'appelant doit savoir — une transaction peut désormais échouer après que
-- toutes ses requêtes ont réussi.
ALTER TABLE "Lease" DROP CONSTRAINT "Lease_tenantId_fkey";
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
