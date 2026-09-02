-- LE TROISIÈME ÉTAT d'un périmètre de gestion.
--
-- `wholePark` pour toute adhésion antérieure, et c'est EXACTEMENT ce qu'elles
-- vivaient : « vide vaut tout le parc » était la règle. Aucune ne change de
-- vue, ce que la règle d'origine refusait déjà d'imposer.
--
-- Les adhésions qui NAISSENT par invitation seront `declared` : une liste vide
-- y veut dire vide, et un gestionnaire ne voit que ce qu'on lui a confié.
CREATE TYPE "ScopeMode" AS ENUM ('wholePark', 'declared');

ALTER TABLE "Membership" ADD COLUMN "scope" "ScopeMode" NOT NULL DEFAULT 'wholePark';
