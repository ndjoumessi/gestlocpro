-- La fenêtre après le bail devient un réglage du parc. Trois mois par défaut :
-- la valeur que la constante du code imposait à tous, désormais discutable
-- parc par parc. Aucun parc existant ne change de comportement.
ALTER TABLE "Park" ADD COLUMN "leaseAccessMonths" INTEGER NOT NULL DEFAULT 3;
