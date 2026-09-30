-- LA CAPTURE DU TRANSFERT N'AVAIT AUCUNE PLACE OÙ VIVRE.
--
-- Un paiement portait une `reference` et une `note`, toutes deux en texte. Sur
-- les marchés que ce produit vise, la pièce réellement échangée n'est pas une
-- référence : c'est la capture d'écran du transfert mobile, que le locataire
-- envoie et que le gestionnaire regarde. Le produit demandait donc de recopier
-- à la main un numéro lu sur une image qui continuait de circuler ailleurs — et
-- c'est cette image, pas le numéro, qu'un locataire produit quand il conteste
-- un encaissement.
--
-- CETTE TABLE EST LE TROISIÈME JUMEAU D'`InspectionPhoto`, après
-- `DocumentRequestFile`, et c'est délibéré : même dépôt d'objets, même contrat
-- en deux temps, mêmes colonnes, mêmes index. Une quatrième forme aurait
-- demandé un quatrième balayage des clés orphelines. Tout ce qui est écrit dans
-- la migration de la photo vaut ici mot pour mot, `confirmedAt` nullable et
-- `storageKey` unique compris.
--
-- CE QUI DIFFÈRE : le type attendu est une IMAGE, comme la photo de réserve et
-- non comme la pièce fournie. Une capture d'écran de transfert est un PNG ou un
-- JPEG ; le dépôt sait le reconnaître, et `transcoderPhoto` le ramènera sous le
-- plafond côté client avant l'envoi.
--
-- CASCADE DEPUIS `Payment`, qui cascade déjà depuis `RentCharge`. Sans elle la
-- preuve survivrait au paiement qu'elle prouve, et sa clé pointerait vers des
-- octets que plus rien ne relie à un parc — donc que plus aucun contrôle
-- d'appartenance ne saurait protéger.
CREATE TABLE "PaymentProof" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProof_storageKey_key" ON "PaymentProof"("storageKey");
CREATE INDEX "PaymentProof_paymentId_idx" ON "PaymentProof"("paymentId");
-- Le balayage des réservations jamais montées interroge cette colonne seule —
-- `confirmedAt IS NULL AND createdAt < …`. Voir `photosJamaisMontees`.
CREATE INDEX "PaymentProof_confirmedAt_idx" ON "PaymentProof"("confirmedAt");

ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
