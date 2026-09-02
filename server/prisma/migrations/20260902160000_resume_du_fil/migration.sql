-- LE RÉSUMÉ DU FIL, choisi par celui qui reçoit.
--
-- `threadEmailDigest` à FAUX pour tout compte antérieur, et c'est ce que ces
-- comptes vivaient : ils recevaient leurs copies une à une. Aucun ne change de
-- comportement, et la promesse faite au locataire — « reçu immédiatement » —
-- reste vraie par défaut.
--
-- `lastThreadDigestAt` NUL affirme qu'aucun résumé n'est jamais parti, ce qui
-- est vrai : la fonctionnalité n'existait pas. Le premier résumé d'un compte
-- prendra donc tout ce qu'il a reçu — borne assumée, et sans surprise
-- puisqu'il faut avoir coché le réglage pour en recevoir un.
ALTER TABLE "UserAccount" ADD COLUMN "threadEmailDigest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserAccount" ADD COLUMN "lastThreadDigestAt" TIMESTAMP(3);
