-- LES CHARGES QU'ON TAPE, ET LE DÉCOMPTE QUI LES ARRÊTE.
--
-- Le produit savait refacturer deux choses : l'eau et le courant, toutes deux
-- CALCULÉES — un index de compteur multiplié par un tarif. Tout le reste de ce
-- qu'un bailleur refacture se TAPE : ordures ménagères, gardiennage, ascenseur,
-- entretien des communs. Faute de place où l'écrire, ces sommes finissaient
-- ajoutées au loyer, et la quittance appelait « loyer » ce qui n'en était pas.
--
-- TROIS TABLES, ET C'EST LA MÊME RÈGLE QUE POUR LE LOYER QUI LES SÉPARE.
--
--   `LeaseChargeLine` est la DÉFINITION : ce qui sera appelé chaque mois.
--   `RentChargeLine`  en est la COPIE FIGÉE dans une échéance déjà émise.
--
-- Corriger un forfait en décembre ne doit pas réécrire la quittance de mars.
-- `rentMinor`, `waterMinor` et `powerMinor` sont figés à l'émission pour cette
-- raison exacte, et une ligne libre n'y échappe pas : sans la copie, servir une
-- quittance passée reviendrait à relire la définition COURANTE, c'est-à-dire à
-- mentir sur un papier déjà remis, en silence.
--
--   `ChargeSettlement` est le DÉCOMPTE ANNUEL.
--
-- `ExpenseCategory.utility` le nommait déjà sans qu'il existe — « la différence
-- entre les deux est exactement ce qu'une régularisation de charges cherche ».
-- Les provisions appelées d'un côté, les dépenses réellement engagées de
-- l'autre.
--
-- IL STOCKE SES DEUX SOMMES, là où le relevé de gestion se recalcule à chaque
-- lecture. Une régularisation est ARRÊTÉE : on la notifie, le locataire paie un
-- complément ou reçoit un remboursement. Recalculée six mois plus tard — une
-- facture arrivée en retard, une dépense ressaisie —, elle rendrait un autre
-- chiffre que celui qu'on lui a réclamé. Le relevé n'engage personne ; elle, si.
--
-- ET ELLE NE STOCKE PAS LE SOLDE. Il vaut `provisionedMinor - actualMinor`,
-- sans exception ni arrondi. Une troisième colonne ne pourrait que diverger des
-- deux premières, et rien ne dirait laquelle a raison.
--
-- AUCUNE COLONNE AJOUTÉE À UNE TABLE EXISTANTE : trois tables neuves, vides à
-- la migration. Il n'y a donc rien à affirmer sur des lignes préexistantes — un
-- bail sans ligne de charge se lit « aucune charge convenue », ce qui est
-- exactement l'état de tous les baux avant ce lot.

-- CreateEnum
CREATE TYPE "ChargeLineKind" AS ENUM ('provision', 'forfait');

-- CreateTable
CREATE TABLE "LeaseChargeLine" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "kind" "ChargeLineKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseChargeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentChargeLine" (
    "id" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "kind" "ChargeLineKind" NOT NULL,

    CONSTRAINT "RentChargeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeSettlement" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "provisionedMinor" INTEGER NOT NULL,
    "actualMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "settledOn" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseChargeLine_leaseId_label_key" ON "LeaseChargeLine"("leaseId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "RentChargeLine_chargeId_label_key" ON "RentChargeLine"("chargeId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeSettlement_leaseId_periodStart_key" ON "ChargeSettlement"("leaseId", "periodStart");

-- AddForeignKey
ALTER TABLE "LeaseChargeLine" ADD CONSTRAINT "LeaseChargeLine_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentChargeLine" ADD CONSTRAINT "RentChargeLine_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeSettlement" ADD CONSTRAINT "ChargeSettlement_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
