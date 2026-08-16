-- Ventile les charges refacturées par fluide.
--
-- L'histogramme des douze mois empile loyer, eau et électricité. Un total
-- unique obligerait l'écran à inventer la répartition, ce que faisait la
-- constante `COLLECTIONS` : trois séries cohérentes entre elles et reliées à
-- aucun encaissement.
ALTER TABLE "RentCharge" DROP COLUMN "utilitiesMinor";
ALTER TABLE "RentCharge" ADD COLUMN "waterMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentCharge" ADD COLUMN "powerMinor" INTEGER NOT NULL DEFAULT 0;
