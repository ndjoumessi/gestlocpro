-- UNE DEMANDE D'ACCÈS DOIT POUVOIR SE DIRE DANS LA LISTE DES AVIS.
--
-- `ADD VALUE` et non une table : le genre n'affirme RIEN sur les lignes déjà en
-- base — aucune notification existante ne devient `access`, et la colonne garde
-- sa valeur. C'est pourquoi ce fichier n'entre pas au registre des colonnes
-- ajoutées, qui garde les phrases écrites sur le passé.
--
-- `IF NOT EXISTS` : cette migration doit pouvoir être rejouée sur une base qui
-- l'a déjà reçue sans faire échouer le déploiement entier.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'access';
