-- Rend à Prisma l'index d'unicité de l'e-mail.
--
-- La migration précédente l'avait remplacé par un index fonctionnel sur
-- `lower(email)`, pour rendre l'unicité insensible à la casse. L'intention est
-- juste — « Sarah@ » et « sarah@ » sont la même personne — mais le moyen est
-- mauvais : `@unique` reste déclaré dans le schéma, donc Prisma voit désormais
-- une dérive permanente et proposera de rétablir son index à chaque migration
-- suivante. Une dérive qu'on réintroduit à chaque fois finit par être ignorée,
-- puis par masquer une vraie divergence.
--
-- La règle ne disparaît pas, elle change de place : la normalisation en
-- minuscules se fait à l'écriture, dans l'application, à l'unique point
-- d'entrée que sont l'inscription et la connexion. Un seul endroit à tenir, et
-- le schéma redevient la description exacte de la base.
DROP INDEX IF EXISTS "UserAccount_email_key";
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount" ("email");
