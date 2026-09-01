-- « Tout l'immeuble sauf ces logements. » `exclue` à faux par défaut : chaque
-- ligne existante reste un logement CONFIÉ, et aucun périmètre en place ne
-- change de sens au déploiement.
ALTER TABLE "MembershipUnit" ADD COLUMN "exclue" BOOLEAN NOT NULL DEFAULT false;
