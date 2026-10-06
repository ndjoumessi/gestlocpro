-- UN COMPTE-RENDU REMIS À UN MANDANT NE DOIT PLUS BOUGER.
--
-- C'est la dette que la migration `20260930020000_honoraires_de_gestion` a
-- nommée en refusant cette table, et elle a écrit la condition de sa levée :
--
--   « CE QUE CE CHOIX LAISSE DEHORS, ET QU'IL FAUDRA : un relevé ÉMIS ne doit
--     plus bouger, c'est un document remis à un mandant. Le figer demande un
--     instantané, comme `RentCharge` fige son loyer à l'appel. Tant que personne
--     ne réédite un relevé passé, le calcul suffit — et figer sans besoin ferait
--     les quatre compteurs qu'on vient de refuser. »
--
-- ═══ POURQUOI CE N'EST PAS LE COMPTEUR QUI AVAIT ÉTÉ REFUSÉ ═══
--
-- Le refus d'alors visait quatre sommes qui prétendraient résumer l'état
-- COURANT : « quatre compteurs, libres de diverger des lignes qu'ils
-- résument ». Un paiement corrigé le mois suivant aurait laissé le relevé sur
-- son ancien chiffre, sans un mot. La règle de l'en-tête du schéma — « les
-- compteurs sont stockés au lieu d'être comptés […] aucun compteur ici » —
-- l'interdisait, et elle avait raison.
--
-- CETTE TABLE DÉCLARE UN ÉTAT PASSÉ, DATÉ, ET SON IMMOBILITÉ EST CE QU'ON LUI
-- DEMANDE. La divergence d'avec les lignes vivantes n'est plus un défaut, c'est
-- la propriété du document : un mandataire oppose le relevé qu'on lui a remis,
-- pas le recalcul du jour. C'est exactement le statut de `RentCharge.rentMinor`,
-- qui fige le loyer à l'appel « pour que le revaloriser plus tard ne réécrive
-- pas un mois déjà appelé ».
--
-- ET ELLE N'EXISTE QUE SUR UN GESTE. Aucune ligne ne naît d'une lecture : la
-- route de lecture continue de CALCULER tant que rien n'est émis, et elle le
-- DIT par `issuedAt: null`. Le produit n'a donc pas deux vérités en permanence,
-- il en a une seconde là où quelqu'un a décidé d'arrêter le temps.
--
-- ═══ LES TERMES DU BARÈME SONT FIGÉS AVEC LES MONTANTS ═══
--
-- C'est l'autre dette de la même migration, et elle se referme ici sans table
-- de plus :
--
--   « `membershipId` est UNIQUE. […] L'historique viendra avec le figeage des
--     relevés, pas avant. »
--
-- Chaque compte-rendu émis porte `feeBasis`, `feeRateBasisPoints` et
-- `feeFixedMinor` tels qu'ils étaient à l'émission. L'historique du barème est
-- donc la SUITE DES RELEVÉS ÉMIS — pas une table d'audit à part, qui aurait pu
-- diverger de ce qui a réellement été facturé. Changer de barème ne réécrit
-- aucun document déjà remis, et l'on peut dire sous quel taux chaque mois a été
-- facturé.
--
-- ═══ CE QUI N'EST PAS STOCKÉ, ET POURQUOI ═══
--
-- LE NET. Il vaut `collected − expenses − works − fee`, et les quatre sont
-- figés ensemble, du même calcul, dans la même transaction : ils ne peuvent pas
-- se contredire. Le stocker serait la cinquième somme que le refus d'origine
-- visait, pour zéro information de plus. Il se dérive à la lecture.
--
-- IL PEUT ÊTRE NÉGATIF, et il sort négatif : un mois de gros travaux sur un
-- parc peu encaissé laisse le propriétaire DEVOIR de l'argent à son mandataire.
--
-- ═══ UNICITÉ SUR (MANDAT, DÉBUT DE PÉRIODE) ═══
--
-- Un mandat ne peut pas émettre deux comptes-rendus pour le même mois. La borne
-- de FIN, elle, n'entre pas dans la clé mais est STOCKÉE et comparée à la
-- lecture : sans cela, demander le 1er au 15 mars quand le 1er au 31 est émis
-- rendrait le relevé du mois entier sous les bornes de la quinzaine.
--
-- `issuedById` EN `SetNull` : le compte qui a émis peut fermer, le document
-- reste. C'est le choix déjà fait pour `AuditEvent.actorId`, et pour la même
-- raison — l'histoire survit à son auteur.
--
-- CASCADE DEPUIS `Membership` : un compte-rendu sans mandat ne facture rien à
-- personne, et sa survie laisserait une ligne d'argent rattachée à un parc que
-- plus aucun contrôle d'appartenance ne protège. Même arbitrage que
-- `ManagementFee`.
CREATE TABLE "OwnerStatement" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" "Currency" NOT NULL,

    "collectedMinor" INTEGER NOT NULL,
    "expensesMinor" INTEGER NOT NULL,
    "worksMinor" INTEGER NOT NULL,
    "feeMinor" INTEGER NOT NULL,
    "managedUnits" INTEGER NOT NULL,

    "feeBasis" "FeeBasis" NOT NULL,
    "feeRateBasisPoints" INTEGER,
    "feeFixedMinor" INTEGER,

    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" UUID,

    CONSTRAINT "OwnerStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerStatement_membershipId_periodStart_key"
    ON "OwnerStatement"("membershipId", "periodStart");

ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
