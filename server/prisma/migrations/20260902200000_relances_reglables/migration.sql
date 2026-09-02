-- LA RELANCE AUTOMATIQUE SE RÈGLE DEPUIS LE PRODUIT.
--
-- `autoReminders` à VRAI pour tout parc antérieur : la relance existait déjà en
-- code, et un défaut à faux l'aurait éteinte pour tout le monde au moment même
-- où elle se met enfin à tourner. Aucun parc ne perd ce qui lui était promis.
--
-- `reminderMilestoneDays` à SEPT : c'est la valeur que la constante
-- `JALON_EMAIL_AUTOMATIQUE` imposait à tous. Aucun parc ne change de
-- comportement ; le nombre cesse seulement d'être hors de portée.
ALTER TABLE "Park" ADD COLUMN "autoReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Park" ADD COLUMN "reminderMilestoneDays" INTEGER NOT NULL DEFAULT 7;
