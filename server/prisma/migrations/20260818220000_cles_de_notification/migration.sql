-- Répare les notifications de relance et de mise en demeure déjà écrites.
--
-- Deux défauts se cumulaient sur ces deux chemins, et sur eux seuls :
--
--   1. La clé portait un préfixe — `notifications.rentReminder` — quand toutes
--      les autres n'en ont pas. L'écran compose `app.alerts.msg.<clé>.title` ;
--      la clé composée n'existait dans aucun dictionnaire, et le fournisseur
--      d'i18n rend alors la CLÉ BRUTE. Un gestionnaire qui relançait un impayé
--      lisait du texte technique dans sa liste de signalements.
--
--   2. Les paramètres portaient les noms du domaine — `overdueDays`,
--      `dueMinor` — quand le client n'interpole que `count`, `amount`,
--      `tenant`, `date`. Même avec la bonne clé, le gabarit aurait affiché ses
--      accolades.
--
-- Le code est corrigé pour les prochaines. Celles-ci sont déjà en base, et une
-- notification ne se réémet pas : on les répare là où elles sont, plutôt que de
-- laisser un parc réel afficher indéfiniment le défaut d'hier.
UPDATE "Notification"
SET "messageKey" = 'rentReminder',
    "params" = ("params" - 'overdueDays' - 'dueMinor')
      || jsonb_build_object('count', "params" -> 'overdueDays', 'amount', "params" -> 'dueMinor')
WHERE "messageKey" = 'notifications.rentReminder'
  AND "params" ? 'overdueDays';

-- Celles qui portaient déjà la bonne forme de paramètres — il n'y en a pas
-- aujourd'hui, mais l'ordre des correctifs ne doit pas dépendre de cette
-- certitude.
UPDATE "Notification"
SET "messageKey" = 'rentReminder'
WHERE "messageKey" = 'notifications.rentReminder';

UPDATE "Notification"
SET "messageKey" = 'formalNotice',
    "params" = ("params" - 'dueMinor')
      || jsonb_build_object('amount', "params" -> 'dueMinor')
WHERE "messageKey" = 'notifications.formalNotice'
  AND "params" ? 'dueMinor';

UPDATE "Notification"
SET "messageKey" = 'formalNotice'
WHERE "messageKey" = 'notifications.formalNotice';
