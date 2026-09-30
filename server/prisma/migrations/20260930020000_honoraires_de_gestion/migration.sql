-- LE GESTIONNAIRE NE SE PAYAIT PAS DANS LE PRODUIT.
--
-- `ParkRole` connaissait `manager` depuis l'origine, `MembershipBuilding` et
-- `MembershipUnit` bornaient son périmètre au logement près, et RIEN nulle part
-- ne portait ce qu'il gagne. Un cabinet pouvait donc suivre un parc avec ce
-- produit sans pouvoir facturer son mandant depuis ce produit — c'est-à-dire en
-- refaisant le calcul dans un tableur, ce que la grille tarifaire vend
-- précisément au palier « Cabinet ».
--
-- ═══ UNE SEULE TABLE, ET PAS DE `OwnerStatement` ═══
--
-- La première intention portait une seconde table : le compte-rendu de gestion,
-- avec son encaissé, ses dépenses, ses honoraires et son net. Elle est refusée
-- par une règle écrite dans l'en-tête du schéma :
--
--   « Les compteurs sont stockés au lieu d'être comptés : `Building.occupied`
--     se contredisait déjà avec l'écran Parc. Aucun compteur ici. »
--
-- Quatre sommes stockées sont quatre compteurs, libres de diverger des lignes
-- qu'ils résument : un paiement corrigé le mois suivant laisserait le relevé sur
-- son ancien chiffre, sans un mot. Le compte-rendu se CALCULE donc, à la lecture,
-- et cette migration ne crée que le barème — qui est un terme de contrat et non
-- un compteur.
--
-- CE QUE CE CHOIX LAISSE DEHORS, ET QU'IL FAUDRA : un relevé ÉMIS ne doit plus
-- bouger, c'est un document remis à un mandant. Le figer demande un instantané,
-- comme `RentCharge` fige son loyer à l'appel. Tant que personne ne réédite un
-- relevé passé, le calcul suffit — et figer sans besoin ferait les quatre
-- compteurs qu'on vient de refuser.
--
-- ═══ UN SEUL BARÈME PAR MANDAT ═══
--
-- `membershipId` est UNIQUE. Deux barèmes valables le même mois rendraient
-- indéterminable ce qu'on facture — exactement ce que l'unique de
-- `UtilityTariff` sur (parc, énergie, date) évite. La différence est que le tarif
-- GARDE son historique, parce qu'une quittance passée doit rester explicable,
-- tandis qu'un barème changé ne réécrit aucun document déjà remis. L'historique
-- viendra avec le figeage des relevés, pas avant.
--
-- ═══ LE TAUX EN POINTS DE BASE, JAMAIS EN FLOTTANT ═══
--
-- 8,5 % s'écrit 850. Même raison que les unités mineures, donnée par l'en-tête du
-- schéma : `0.085` n'existe pas en binaire, et 8,5 % d'un million rendrait un
-- entier différent selon la machine qui l'arrondit. Le point de base est la plus
-- petite unité qu'un contrat de gestion écrive réellement.
--
-- LES DEUX COLONNES DE MONTANT SONT NULLABLES, et leur `NULL` a un sens PLEIN :
-- « ce barème ne se compte pas de cette façon ». Un `0` aurait voulu dire « zéro
-- pour cent », qui est un barème valable et autre chose. La base ne peut pas
-- exprimer « l'une ou l'autre selon `basis` » — la garde est en zod, et un cas la
-- tient.
--
-- CASCADE DEPUIS `Membership` : un barème sans mandat ne facture rien à
-- personne, et sa survie laisserait une ligne d'argent rattachée à un parc que
-- plus aucun contrôle d'appartenance ne protège.
CREATE TYPE "FeeBasis" AS ENUM ('percentOfCollected', 'fixedPerUnit', 'fixedPerMonth');

CREATE TABLE "ManagementFee" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "basis" "FeeBasis" NOT NULL,
    "rateBasisPoints" INTEGER,
    "fixedMinor" INTEGER,
    "currency" "Currency" NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementFee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagementFee_membershipId_key" ON "ManagementFee"("membershipId");

ALTER TABLE "ManagementFee" ADD CONSTRAINT "ManagementFee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
