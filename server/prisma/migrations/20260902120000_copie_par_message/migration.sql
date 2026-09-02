-- LE MESSAGE que chaque copie accompagne. Nul pour le signalement lui-même, et
-- nul sur toutes les lignes ÉCRITES AVANT : une charge ancienne ne se répare
-- pas, et le rendu doit s'en accommoder — le fil garde donc son compte global.
-- `ON DELETE SET NULL` : un avis supprimé ne doit pas emporter la preuve
-- qu'un courriel a été tenté.
ALTER TABLE "WorkThreadEmail" ADD COLUMN "notificationId" UUID;

CREATE INDEX "WorkThreadEmail_notificationId_idx" ON "WorkThreadEmail"("notificationId");

ALTER TABLE "WorkThreadEmail" ADD CONSTRAINT "WorkThreadEmail_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
