-- LA PIÈCE FOURNIE, ET NON PLUS LA PROMESSE D'UNE PIÈCE.
--
-- `DocumentRequest` savait passer à `fulfilled` sans qu'aucun fichier ne change
-- de main : le gestionnaire marquait « fournie », le locataire lisait
-- « fournie », et rien n'était fourni. L'écran l'avouait honnêtement — « le
-- gestionnaire reçoit la demande et vous répond dans cet espace » —, ce qui
-- était la bonne réponse tant que le produit ne savait rien recevoir.
--
-- CETTE TABLE EST LE JUMEAU D'`InspectionPhoto`, et c'est délibéré : même
-- dépôt d'objets, même contrat en deux temps, mêmes colonnes, mêmes index. Une
-- seconde forme aurait demandé un second balayage des clés orphelines, et
-- c'est le genre de duplication qu'on paie des années. Tout ce qui est écrit
-- dans la migration de la photo vaut ici mot pour mot :
--
--   * `confirmedAt` NULLABLE parce que les octets ne passent pas par l'API. La
--     réservation crée la ligne, la confirmation la date. Entre les deux, la
--     ligne existe et ne prouve rien, et rien de non confirmé n'est servi.
--
--   * `storageKey` UNIQUE, faute de quoi la suppression de l'une deviendrait
--     une fuite pour l'autre — adresses de lecture vers des octets effacés, ou
--     pire, réattribués.
--
--   * `contentType` et `sizeBytes` écrits deux fois dans la vie d'une ligne :
--     ANNONCÉS à la réservation, MESURÉS à la confirmation. Deux colonnes et
--     non quatre ; `confirmedAt IS NULL` dit lequel des deux états on regarde.
--
--   * CASCADE depuis `DocumentRequest`, qui cascade déjà depuis `Lease`. Sans
--     elle la pièce survivrait à la demande qu'elle honore, et sa ligne
--     pointerait vers une clé que plus rien ne relie à un parc — donc que plus
--     aucun contrôle d'appartenance ne saurait protéger.
--
-- CE QUI DIFFÈRE, ET C'EST LA SEULE CHOSE : le type attendu. Une photo de
-- réserve est une image ; une pièce fournie est normalement un PDF. Le dépôt
-- sait le reconnaître depuis `953eb65`, et le rend en pièce jointe plutôt qu'en
-- ligne — un PDF affiché exécuterait son propre JavaScript sur notre origine.
--
-- PLUSIEURS PIÈCES PAR DEMANDE, et non une seule. Un scan d'attestation tient
-- rarement en une page ; imposer l'unicité pousserait à fusionner les pages
-- HORS du produit, donc à déposer un fichier que personne n'a vu se former.
CREATE TABLE "DocumentRequestFile" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRequestFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRequestFile_storageKey_key" ON "DocumentRequestFile"("storageKey");

CREATE INDEX "DocumentRequestFile_requestId_idx" ON "DocumentRequestFile"("requestId");

-- Le balayage des réservations jamais montées interroge cette colonne seule :
-- `confirmedAt IS NULL AND createdAt < …`. Voir `photosJamaisMontees`.
CREATE INDEX "DocumentRequestFile_confirmedAt_idx" ON "DocumentRequestFile"("confirmedAt");

ALTER TABLE "DocumentRequestFile" ADD CONSTRAINT "DocumentRequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
