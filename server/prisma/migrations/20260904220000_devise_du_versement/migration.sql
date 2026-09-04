-- LA DEVISE APPARTIENT À L'ARGENT REÇU, PAS AU RÉGLAGE DU JOUR OÙ ON L'IMPRIME.
--
-- Une quittance était mise en forme avec `Park.currency`, relu À CHAQUE
-- émission. La route autorise explicitement la réédition — « un document perdu
-- doit pouvoir être refait » — et le produit autorise le changement de devise
-- du parc, en avertissant que « les montants déjà saisis ne seront pas
-- convertis ». Un bailleur qui corrige sa devise rendait donc une quittance de
-- 145 000 EUR là où le locataire en détient une de 145 000 XAF, pour le MÊME
-- versement, sans que rien ne permette de les départager.
--
-- CE QUE CETTE COLONNE AFFIRME DU PASSÉ : tout versement antérieur a été reçu
-- dans la devise que son parc porte AUJOURD'HUI. C'est la reconstruction la
-- plus fidèle disponible, et elle est EXACTE tant qu'aucun parc n'a changé de
-- devise. Si l'un l'a fait, ses versements d'avant étaient DÉJÀ mal étiquetés —
-- rien ne le rattrape, et cette colonne fige l'état constaté plutôt que d'en
-- inventer un autre. C'est aussi ce qu'elle empêche de recommencer.
--
-- EN TROIS TEMPS, ET PAS DE DÉFAUT LITTÉRAL : un `DEFAULT 'XAF'` affirmerait
-- que tout versement passé est en francs CFA, ce qui est faux dès le premier
-- parc européen. La valeur se lit sur le parc, par jointure.
ALTER TABLE "Payment" ADD COLUMN "currency" "Currency";

UPDATE "Payment" AS p
SET "currency" = pk."currency"
FROM "RentCharge" rc, "Lease" l, "Unit" u, "Building" b, "Park" pk
WHERE p."chargeId" = rc."id"
  AND rc."leaseId" = l."id"
  AND l."unitId" = u."id"
  AND u."buildingId" = b."id"
  AND b."parkId" = pk."id";

ALTER TABLE "Payment" ALTER COLUMN "currency" SET NOT NULL;
