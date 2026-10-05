-- AUCUNE ÉCHÉANCE DE BAIL NE PRÉVENAIT, ET LE LIBELLÉ EXISTAIT DÉJÀ.
--
-- `NotificationKind.lease` n'était émis qu'à UN seul endroit du routeur : la
-- mise en demeure. Pendant ce temps, `src/i18n/fr.ts` portait depuis des lots
-- un libellé complet et jamais écrit :
--
--   leaseRenewal: { title: 'Bail {unit} à renouveler dans {count} jours',
--                   detail: '{tenant} · échéance au {date}' }
--
-- Le tuyau d'aval était posé — libellé, pluriel, variables, rendu de la date
-- par `useAlertMessage` — et RIEN ne l'alimentait. C'est la forme de défaut que
-- ce dépôt a déjà payée deux fois : `RentCharge.waterMinor` servie par la
-- quittance et écrite par personne, et `AuditEvent` écrit à seize endroits et lu
-- nulle part.
--
-- Les deux dates existaient aussi, posées par le lot « congé, révision,
-- garant » : `Lease.endsOn` et `Lease.moveOutOn`. Un bail arrivait donc à son
-- terme, un locataire annonçait son départ, et le produit n'en disait rien à
-- personne — alors qu'un départ réclame un état des lieux de sortie et
-- l'arbitrage d'une caution, deux écrans que ce produit possède.
--
-- ═══ UNE TABLE D'IDEMPOTENCE, ET NON UNE COLONNE SUR LE BAIL ═══
--
-- Le cron passe TOUTES LES HEURES. Sans garde, un bail qui approche de son
-- terme produirait vingt-quatre avis par jour pendant soixante jours, soit
-- 1 440 lignes pour un seul fait.
--
-- Une colonne `renewalNoticedAt` sur `Lease` aurait suffi pour un avis. Elle ne
-- suffit pas pour deux, et surtout elle ne sait pas se PÉRIMER : un congé
-- retiré puis redonné à une autre date est une nouvelle échéance, et la colonne
-- aurait gardé la trace de l'ancienne en se taisant sur la neuve. D'où
-- `dueOn` DANS la clé d'unicité — c'est la date de l'échéance, pas celle de
-- l'avis. Déplacer l'échéance rouvre le droit d'en parler ; la laisser en place
-- le referme.
--
-- C'est la même forme que `RentReminderEmail`, qui porte son `sentOn` dans
-- l'unique pour tenir une idempotence QUOTIDIENNE. Ici la borne est l'ÉCHÉANCE
-- et non le jour : un avis « dans soixante jours » ne doit pas se répéter le
-- lendemain en disant « dans cinquante-neuf ».
--
-- ═══ CASCADE DEPUIS LE BAIL ═══
--
-- Un avis d'échéance sans bail ne garde rien — il ne pourrait plus même dire de
-- quelle échéance il parlait. La notification, elle, SURVIT : elle appartient au
-- parc et raconte un fait daté, et c'est le choix déjà fait partout ailleurs.
CREATE TYPE "LeaseDeadlineKind" AS ENUM ('term', 'moveOut');

CREATE TABLE "LeaseDeadlineNotice" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "kind" "LeaseDeadlineKind" NOT NULL,
    "dueOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseDeadlineNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaseDeadlineNotice_leaseId_kind_dueOn_key"
    ON "LeaseDeadlineNotice"("leaseId", "kind", "dueOn");

ALTER TABLE "LeaseDeadlineNotice" ADD CONSTRAINT "LeaseDeadlineNotice_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
