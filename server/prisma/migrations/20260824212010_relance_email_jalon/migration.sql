-- LA TABLE QUI TRANCHE LA COURSE, PAS LA TRACE QUI LA CONSTATE.
--
-- `Notification` porte déjà une trace de relance, mais son bail voyage dans
-- `params`, du JSON libre : rien n'y adosse une contrainte UNIQUE fiable. Or la
-- garde de ce lot EST une contrainte UNIQUE — deux exécutions simultanées de la
-- relance automatique par e-mail (le cron à venir et un déclenchement manuel,
-- ou deux passages du cron qui se chevauchent) doivent produire UN SEUL
-- courriel, jamais deux. Une lecture suivie d'une écriture ne le garantit pas :
-- les deux exécutions liraient « pas encore envoyé » avant que l'une n'écrive.
-- Un planificateur qui double ses envois est pire que pas de planificateur.
--
-- `leaseId` est donc une colonne réelle et non un champ de JSON, précisément
-- pour que `(leaseId, sentOn)` puisse porter l'UNIQUE ci-dessous : l'INSERT
-- perdant lève une violation de contrainte (code Postgres 23505, mappé P2002
-- par Prisma), que le code interprète comme « déjà pris en charge aujourd'hui »
-- plutôt que comme une panne.
--
-- `sentOn` est une DATE et non un TIMESTAMP : l'idempotence porte sur le JOUR,
-- comme celle déjà en place pour les relances SMS (`debutDuJour`, UTC). Deux
-- passages du cron le même jour UTC ne doivent produire qu'une ligne par bail.
--
-- `deliveredAt` reste NUL tant que `envoyerEmail` n'a pas rendu `true` — même
-- règle que `Notification.sentAt` : une date d'envoi posée par avance ferait
-- mentir le dossier le jour où un locataire contestera avoir été prévenu, qui
-- est exactement le jour où cette trace sert.
--
-- Cascade sur `Lease` : un bail supprimé n'a plus d'historique de relance à
-- justifier, comme `Deposit` et `Inspection` le font déjà pour le même bail.
CREATE TABLE "RentReminderEmail" (
    "id" UUID NOT NULL,
    "leaseId" UUID NOT NULL,
    "milestone" INTEGER NOT NULL,
    "sentOn" DATE NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentReminderEmail_pkey" PRIMARY KEY ("id")
);

-- La contrainte elle-même : un bail ne peut être « pris en charge » qu'une
-- fois par jour. C'est elle, et non le code applicatif, qui protège contre la
-- course — voir le commentaire ci-dessus.
CREATE UNIQUE INDEX "RentReminderEmail_leaseId_sentOn_key" ON "RentReminderEmail"("leaseId", "sentOn");

-- AddForeignKey
ALTER TABLE "RentReminderEmail" ADD CONSTRAINT "RentReminderEmail_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
