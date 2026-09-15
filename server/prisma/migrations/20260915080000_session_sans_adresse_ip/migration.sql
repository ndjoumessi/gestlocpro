-- La session ne garde plus d'adresse IP : rien ne la lisait, et derrière le
-- relais Vercel elle gardait l'adresse de Vercel. Les valeurs déjà enregistrées
-- disparaissent avec la colonne — c'est le but.
ALTER TABLE "Session" DROP COLUMN "ipAddress";
