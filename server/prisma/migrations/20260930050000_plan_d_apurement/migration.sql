-- UN IMPAYÉ N'AVAIT QUE DEUX ISSUES VISIBLES, ALORS QUE LA VRAIE EST LA TROISIÈME.
--
-- Les paiements partiels existaient déjà de fait — `Payment.amountMinor` est
-- libre —, la relance automatique et la mise en demeure étaient là. Ce qui
-- manquait était l'ACCORD : rien ne portait la promesse « 50 000 par mois
-- pendant quatre mois », ni le suivi de son respect. Le produit ne connaissait
-- que « payé » ou « pas payé ».
--
-- La conséquence était concrète et allait CONTRE ses utilisateurs : un locataire
-- qui respectait scrupuleusement un échelonnement convenu à l'oral continuait de
-- recevoir des relances pour la totalité de sa dette, et son solde s'affichait
-- en rouge. Le produit travaillait contre l'accord que ses utilisateurs avaient
-- passé sans lui.
--
-- ═══ AUCUNE COLONNE « PAYÉ » SUR L'ÉCHÉANCE, ET C'EST LE CŒUR DU MODÈLE ═══
--
-- `SettlementInstalment` porte une date et un montant, rien d'autre. Une colonne
-- `paidMinor` entretenue à la main divergerait le jour où quelqu'un encaisse
-- sans passer par le plan — ce qui est le cas NORMAL, l'argent arrivant par
-- `Payment` sur une échéance de loyer, pas sur une ligne de plan.
--
-- Ce qui est payé se DÉDUIT donc des paiements du bail sur l'intervalle de
-- l'échéance, et rien ne peut mentir : il n'y a qu'une source. Le prix est
-- qu'« est-ce respecté ? » devient un calcul et non une lecture ; il se paie
-- une fois, à l'endroit qui somme, et non à chaque encaissement.
--
-- ═══ UN SEUL PLAN ACTIF PAR BAIL, ET PRISMA NE SAIT PAS LE DIRE ═══
--
-- Deux plans en cours rendraient indéterminable ce qu'on attend ce mois-ci.
-- L'unicité est CONDITIONNELLE — elle ne porte que sur `status = 'active'`,
-- puisqu'un bail peut avoir eu trois plans honorés par le passé. PostgreSQL
-- l'exprime par un index unique PARTIEL ; Prisma ne sait pas le déclarer, et
-- c'est pourquoi il est écrit ici à la main.
--
-- IL SURVIVRA À `prisma migrate dev` : un index que le schéma ne connaît pas est
-- une DÉRIVE, et la prochaine migration générée proposerait de le supprimer.
-- C'est exactement ce que ce dépôt vient de corriger sur
-- `WorkThreadEmail_notificationId_idx`. La parade est de le déclarer AUSSI dans
-- le schéma, sous sa forme approchée — `@@index([leaseId, status])` —, de sorte
-- que Prisma voie un index sur ces colonnes et ne propose rien. L'unicité
-- partielle, elle, ne vit qu'ici, et `schema.test.ts` l'éprouve contre une vraie
-- base plutôt que de la supposer.
--
-- ═══ `broken` EST LA VALEUR LA PLUS IMPORTANTE ═══
--
-- Sans elle, un plan que le locataire ne respecte plus resterait `active`, et le
-- produit continuerait de retenir les relances au nom d'un accord mort. Ce
-- serait transformer une bienveillance en perte, et c'est le défaut que ce
-- modèle doit le plus éviter.
--
-- `honoured` et `cancelled` se distinguent, contrairement à ce qu'un seul
-- « clos » dirait : l'un est un locataire qui a payé, l'autre un accord que le
-- bailleur a retiré. Ce n'est pas la même personne qu'on rappelle l'an prochain.
CREATE TYPE "SettlementPlanStatus" AS ENUM ('active', 'honoured', 'broken', 'cancelled');

CREATE TABLE "SettlementPlan" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "agreedOn" DATE NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "SettlementPlanStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementInstalment" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "dueOn" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "SettlementInstalment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementPlan_leaseId_status_idx" ON "SettlementPlan"("leaseId", "status");

-- L'UNICITÉ CONDITIONNELLE, écrite à la main parce que Prisma ne la déclare pas.
-- Un bail peut avoir eu trois plans honorés ; il ne peut en avoir qu'UN actif.
CREATE UNIQUE INDEX "SettlementPlan_un_seul_actif_par_bail"
  ON "SettlementPlan"("leaseId") WHERE "status" = 'active';

-- UNE SEULE ÉCHÉANCE PAR PLAN ET PAR DATE : deux montants dus le même jour se
-- disent en une ligne, et les séparer rendrait le respect indécidable.
CREATE UNIQUE INDEX "SettlementInstalment_planId_dueOn_key" ON "SettlementInstalment"("planId", "dueOn");

ALTER TABLE "SettlementPlan" ADD CONSTRAINT "SettlementPlan_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementPlan" ADD CONSTRAINT "SettlementPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementInstalment" ADD CONSTRAINT "SettlementInstalment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SettlementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
