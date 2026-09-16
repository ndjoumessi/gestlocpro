-- DEUX VERROUS QUI EMPÊCHAIENT D'EFFACER UN COMPTE.
--
-- `Invitation.issuedById` et `Payment.recordedById` étaient obligatoires et en
-- RESTRICT : un compte ayant émis un code ou saisi un encaissement ne pouvait
-- pas être supprimé. Le droit à l'effacement se heurtait donc au premier geste
-- de gestion jamais fait.
--
-- Les lignes RESTENT, leur auteur s'en va : c'est ce qu'un effacement doit
-- faire. Aucune ligne existante n'est modifiée — elles gardent toutes leur
-- auteur, la colonne devient seulement capable de l'oublier.
ALTER TABLE "Invitation" ALTER COLUMN "issuedById" DROP NOT NULL;
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_issuedById_fkey";
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ALTER COLUMN "recordedById" DROP NOT NULL;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_recordedById_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
