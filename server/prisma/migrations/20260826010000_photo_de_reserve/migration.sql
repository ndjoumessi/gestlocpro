-- LA PHOTO D'UNE RÉSERVE, ET L'HORODATAGE QUI LA REND OPPOSABLE.
--
-- Une réserve d'état des lieux n'est aujourd'hui qu'un texte : « rayure
-- profonde sur le plan de travail ». Opposée à une caution, elle vaut ce que
-- vaut la parole de celui qui l'a écrite. La photo la rend vérifiable — à
-- condition que sa DATE ne vienne pas du même endroit que la photo. Une date
-- d'appareil se change dans les réglages de l'appareil ; `confirmedAt` est
-- posée par le serveur, à l'instant où il a lui-même constaté les octets.
--
-- Elle est donc NULLABLE, et ce n'est pas une commodité : le dépôt se fait en
-- deux temps — une réservation, puis une confirmation — parce que les octets
-- ne passent pas par l'API. Entre les deux, la ligne existe et ne prouve rien.
-- Une date posée dès la réservation ferait mentir le dossier le jour où il
-- sert, en attestant d'une photo que le serveur n'a jamais vue.
--
-- `storageKey` est UNIQUE. Deux lignes visant le même objet transformeraient
-- la suppression de l'une en fuite pour l'autre : la seconde continuerait de
-- délivrer des adresses de lecture vers des octets effacés — ou pire, vers des
-- octets réattribués.
--
-- `contentType` et `sizeBytes` sont écrits deux fois dans la vie d'une ligne :
-- ce que le client ANNONCE à la réservation, puis ce que le serveur MESURE à
-- la confirmation. Les colonnes ne dédoublent pas l'annonce et la mesure —
-- distinguer les deux demanderait quatre colonnes pour une information qui n'a
-- de valeur qu'une fois vérifiée. `confirmedAt IS NULL` dit lequel des deux
-- états on regarde, et rien de non confirmé n'est jamais servi.
--
-- CASCADE depuis `InspectionFinding`, comme `InspectionFinding` cascade déjà
-- depuis `Inspection` et celle-ci depuis `Unit`. Sans elle, la photo survivrait
-- à la réserve qu'elle documente : sa ligne pointerait vers une clé que plus
-- aucune jointure ne relie à un parc, donc que plus aucun contrôle
-- d'appartenance ne saurait protéger. Un orphelin en base est ici un trou de
-- cloisonnement, pas seulement du désordre.
CREATE TABLE "InspectionPhoto" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InspectionPhoto_storageKey_key" ON "InspectionPhoto"("storageKey");

CREATE INDEX "InspectionPhoto_findingId_idx" ON "InspectionPhoto"("findingId");

-- L'index des RÉSERVATIONS MORTES.
--
-- Une réservation jamais confirmée laisse un objet monté, stocké et facturé au
-- gigaoctet-mois. La ligne en base est ce qui rend cet objet retrouvable : sans
-- elle, le serveur ne connaîtrait même pas la clé de ce qu'il paie. Cet index
-- est ce qui permettra au balayage de les lister sans parcourir la table.
CREATE INDEX "InspectionPhoto_confirmedAt_idx" ON "InspectionPhoto"("confirmedAt");

ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
