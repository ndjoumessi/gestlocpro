-- Le désabonnement aux COPIES e-mail du fil. Vrai par défaut : ces copies
-- partent déjà en production, et un défaut à faux couperait tout le monde à la
-- seconde du déploiement — personne ne doit perdre ce qu'il recevait.
ALTER TABLE "UserAccount" ADD COLUMN "threadEmailOptIn" BOOLEAN NOT NULL DEFAULT true;
