-- Le nom de l'auteur d'une décision, figé au moment où son compte s'efface.
-- Additif et nullable : aucune ligne existante ne change, et les décisions
-- prises par des comptes DÉJÀ effacés restent sans nom — il n'existe plus
-- nulle part, et aucune migration ne peut le retrouver.
ALTER TABLE "AuditEvent" ADD COLUMN "actorName" TEXT;
