-- UNE DATE DE CONSENTEMENT NE DIT RIEN SANS LE TEXTE QU'ELLE DATE.
--
-- `termsAcceptedAt` affirmait de chaque compte qu'il avait accepté des
-- conditions générales. Depuis `efd8654` (2026-09-14), la case de l'inscription
-- ne fait plus confirmer que la LECTURE de la politique de confidentialité, et
-- les conditions générales n'existent toujours pas. La colonne disait donc faux
-- de tout compte créé depuis, et rien ne distinguait les deux textes.
--
-- LE RENOMMAGE NE PERD RIEN : `RENAME COLUMN` garde la valeur, le type et la
-- contrainte. Il n'affirme rien non plus — le nouveau nom ne prétend à aucun
-- contenu, c'est la colonne d'à côté qui le porte.
ALTER TABLE "UserAccount" RENAME COLUMN "termsAcceptedAt" TO "legalConfirmedAt";

CREATE TYPE "LegalConfirmation" AS ENUM ('acceptedTermsAndPrivacy', 'readPrivacy');

-- CE QUE LE REMPLISSAGE AFFIRME, ET C'EST UNE DATE DE COUPURE.
--
-- Les lignes d'avant `efd8654` ont vu « J'accepte les conditions générales et la
-- politique de confidentialité. » ; celles d'après, « J'ai lu la politique de
-- confidentialité. ». La frontière est l'instant où le nouveau texte a été
-- SERVI, que rien en base ne connaît. On prend l'horodatage du commit —
-- 2026-09-14 01:08:25+02, soit 23:08:25 UTC la veille — et le déploiement l'a
-- suivi de quelques minutes.
--
-- LE SENS DE L'ERREUR EST CHOISI. Une inscription tombée dans cet intervalle est
-- classée `readPrivacy` alors qu'elle a vu l'ancien texte : on lui prête MOINS
-- que ce qu'elle a fait. L'erreur inverse — prêter à quelqu'un l'acceptation de
-- conditions générales qu'on ne lui a jamais montrées — est celle que cette
-- migration existe pour effacer, et on ne va pas la réintroduire par le
-- remplissage.
ALTER TABLE "UserAccount" ADD COLUMN "legalConfirmation" "LegalConfirmation";

UPDATE "UserAccount"
SET "legalConfirmation" = CASE
  WHEN "legalConfirmedAt" < TIMESTAMPTZ '2026-09-13 23:08:25+00' THEN 'acceptedTermsAndPrivacy'::"LegalConfirmation"
  ELSE 'readPrivacy'::"LegalConfirmation"
END;

ALTER TABLE "UserAccount" ALTER COLUMN "legalConfirmation" SET NOT NULL;
