-- L'HEURE DE LA RELANCE SORT DE LA PLANIFICATION ET ENTRE DANS LE PRODUIT.
--
-- `reminderHour` à SIX et `reminderTimeZone` à UTC pour tout parc antérieur :
-- c'est exactement l'heure à laquelle le cron partait jusqu'ici (`0 6 * * *`).
-- Aucun parc ne change d'heure au moment où le réglage apparaît — il cesse
-- seulement d'être hors de portée.
--
-- Le fuseau est une COLONNE et non une déduction du pays : ce produit a déjà un
-- parc qui porte `FR` et loue à Yaoundé. Deviner reviendrait à envoyer une heure
-- trop tôt à des gens qui dorment.
ALTER TABLE "Park" ADD COLUMN "reminderHour" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Park" ADD COLUMN "reminderTimeZone" TEXT NOT NULL DEFAULT 'UTC';
