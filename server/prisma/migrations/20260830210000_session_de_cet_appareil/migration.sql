-- « Rester connecté sur cet appareil ».
--
-- Additive et rétrocompatible : DEFAULT true, donc toute session déjà ouverte
-- garde sa durée de trente jours. Ce lot ne déconnecte personne — il ouvre le
-- moyen de demander plus court, il ne l'impose pas.
ALTER TABLE "Session" ADD COLUMN "persistent" BOOLEAN NOT NULL DEFAULT true;
