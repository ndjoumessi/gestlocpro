-- LE BAIL SAVAIT COMMENCER ET FINIR, PAS SE TERMINER.
--
-- `LeaseStatus` passait de `active` à `ended` d'un coup, sans que rien ne porte
-- le congé : ni sa date, ni qui l'a donné, ni pourquoi, ni la date d'effet. Un
-- départ annoncé pour dans deux mois était donc INVISIBLE — le logement
-- comptait comme occupé jusqu'au jour où quelqu'un basculait le statut à la
-- main, et le propriétaire n'avait aucun moyen de voir venir la vacance qu'il
-- doit préparer. C'est le seul des défauts de ce lot qui se paie en argent :
-- un logement qu'on remet en location le jour du départ perd un mois de loyer.
--
-- ═══ CE QUE LE `NULL` DE CES QUATRE COLONNES AFFIRME DES LIGNES EXISTANTES ═══
--
-- Qu'AUCUN CONGÉ N'A ÉTÉ DONNÉ sur aucun bail déjà en base. C'est VÉRIFIÉ et
-- non supposé : aucune colonne, aucune route et aucun écran ne savait
-- enregistrer un congé avant cette migration, donc l'information n'existe
-- nulle part — ni sous une autre forme, ni dans une note, ni dans le registre
-- d'audit. Le `NULL` ne peut donc pas vouloir dire « écrit avant la colonne ».
--
-- LE SENS N'EST PAS DOUBLE, et c'est ce que la garde des colonnes ajoutées
-- demande d'établir : pour une ligne ancienne comme pour une ligne neuve,
-- `noticeGivenOn IS NULL` se lit « pas de congé ». Un bail `ended` sans congé
-- existe et reste juste : il a été terminé avant que le produit sache dire
-- comment, et inventer une date de congé rétroactive serait écrire un fait.
--
-- ═══ UN CONGÉ N'EST PAS UNE FIN ═══
--
-- `moveOutOn` est la date d'EFFET, et le bail reste `active` jusque-là : le
-- locataire habite encore, son loyer est encore appelé, ses charges encore
-- refacturées. Confondre les deux — basculer `ended` à la réception du congé —
-- ferait cesser l'appel de loyer sur un logement occupé, ce qui est exactement
-- l'erreur inverse de celle qu'on corrige.
--
-- AUCUN DÉFAUT NULLE PART. Quatre colonnes nullables, aucun `DEFAULT` : il n'y a
-- pas de valeur qui serait vraie des lignes anciennes, et en poser une écrirait
-- une phrase fausse dans le passé — ce que la migration de `origin` a fait une
-- fois, en déclarant que toute intervention antérieure venait d'un locataire.
CREATE TYPE "NoticeGiver" AS ENUM ('tenant', 'landlord');

ALTER TABLE "Lease" ADD COLUMN "noticeGivenOn" DATE;
ALTER TABLE "Lease" ADD COLUMN "noticeGivenBy" "NoticeGiver";
ALTER TABLE "Lease" ADD COLUMN "noticeReason" TEXT;
ALTER TABLE "Lease" ADD COLUMN "moveOutOn" DATE;

-- LES DÉPARTS À VENIR sont la seule lecture de ces colonnes : « quels baux
-- s'arrêtent dans les deux mois ». Un index sur la date d'effet, donc, et pas
-- sur les quatre.
CREATE INDEX "Lease_moveOutOn_idx" ON "Lease"("moveOutOn");

-- LE LOYER CHANGEAIT SANS LAISSER DE TRACE.
--
-- `Lease.rentMinor` est un scalaire : une augmentation l'écrasait. Les périodes
-- passées étaient sauvées — `RentCharge` fige son propre `rentMinor` à l'appel,
-- et c'est ce qui rendait le défaut discret — mais RIEN ne disait qu'une hausse
-- avait eu lieu, ni de combien, ni quand, ni qui l'avait décidée. Un locataire
-- qui contestait une augmentation n'avait en face de lui qu'un loyer courant.
--
-- `previousRentMinor` EST RECOPIÉ ICI, et c'est une duplication assumée : on
-- pourrait le lire sur la révision précédente, ou sur le bail avant écriture.
-- Le recopier rend chaque ligne lisible SEULE — « de 70 000 à 77 000 au
-- 1er avril » — là où une chaîne de révisions obligerait à toutes les lire dans
-- l'ordre pour comprendre la deuxième. C'est le même arbitrage que la charge
-- utile du registre d'audit, qui porte son `avant`.
CREATE TABLE "RentRevision" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "previousRentMinor" INTEGER NOT NULL,
    "newRentMinor" INTEGER NOT NULL,
    "reason" TEXT,
    "decidedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentRevision_pkey" PRIMARY KEY ("id")
);

-- UNE SEULE RÉVISION PAR BAIL ET PAR DATE D'EFFET. Deux hausses au même jour
-- rendraient indéterminable le loyer de ce jour-là — même raison que l'unique
-- de `UtilityTariff` sur (parc, énergie, date).
CREATE UNIQUE INDEX "RentRevision_leaseId_effectiveOn_key" ON "RentRevision"("leaseId", "effectiveOn");

-- LA CAUTION EN ARGENT N'EST PAS UNE PERSONNE.
--
-- `Deposit` existait depuis l'origine : c'est de l'argent retenu, restitué ou
-- arbitré. Le GARANT — celui qui s'engage à payer si le locataire ne paie pas —
-- n'existait nulle part. Sur les marchés que ce produit vise, c'est pourtant la
-- sûreté la plus courante, souvent la seule : un parent, un employeur, un
-- confrère. Un impayé n'avait donc aucun recours nommé dans le produit, et le
-- bailleur cherchait le numéro dans ses papiers.
--
-- PLUSIEURS GARANTS PAR BAIL, et non un seul : deux parents se portent garants
-- ensemble, et imposer l'unicité forcerait à écrire deux noms dans un champ.
CREATE TABLE "Guarantor" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guarantor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RentRevision_leaseId_idx" ON "RentRevision"("leaseId");
CREATE INDEX "Guarantor_leaseId_idx" ON "Guarantor"("leaseId");

ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
