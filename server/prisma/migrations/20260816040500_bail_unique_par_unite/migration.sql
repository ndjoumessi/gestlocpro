-- Une unité n'a qu'un bail en cours à la fois.
--
-- Prisma ne sait pas déclarer un index unique PARTIEL, et la règle ne peut pas
-- vivre dans le code applicatif : deux requêtes simultanées liraient toutes
-- deux « aucun bail actif » avant que l'une n'écrive. La fenêtre est étroite,
-- donc le défaut serait rare, donc irreproductible — la pire des catégories.
--
-- `pending` compte comme occupant : le bail est signé et l'unité n'est plus
-- disponible, même si la première quittance n'est pas due. C'est exactement ce
-- que fait déjà `addTenant` côté client en passant l'unité à « en attente ».
CREATE UNIQUE INDEX "Lease_unit_actif_unique"
  ON "Lease" ("unitId")
  WHERE "status" IN ('pending', 'active');

-- Un locataire ne peut pas être invité deux fois en même temps sur la même
-- unité : deux codes valides pour un seul accès, dont on ne saurait pas lequel
-- révoquer.
CREATE UNIQUE INDEX "Invitation_unite_en_attente_unique"
  ON "Invitation" ("unitId")
  WHERE "unitId" IS NOT NULL AND "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- L'e-mail est l'identifiant de connexion : « Sarah@ » et « sarah@ » sont la
-- même personne. Sans cet index, deux comptes coexistent et l'un des deux ne
-- peut jamais se connecter — selon la casse que la connexion normalise.
DROP INDEX IF EXISTS "UserAccount_email_key";
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount" (lower("email"));
