-- La fermeture demandée par la personne elle-même. Distincte de `disabledAt`,
-- qui barre un compte du côté de l'éditeur : celle-ci s'annule à la reconnexion.
-- Un index parce que le travail quotidien d'effacement balaie cette colonne.
ALTER TABLE "UserAccount" ADD COLUMN "closureRequestedAt" TIMESTAMP(3);
CREATE INDEX "UserAccount_closureRequestedAt_idx" ON "UserAccount"("closureRequestedAt");
