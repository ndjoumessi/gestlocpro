-- La TRACE des courriels du fil. `deliveredAt` nul = tentative sans livraison,
-- même règle que `RentReminderEmail` : une date posée par avance ferait mentir
-- le dossier. `ON DELETE CASCADE` : un chantier supprimé emporte ses traces.
CREATE TABLE "WorkThreadEmail" (
    "id" UUID NOT NULL,
    "workId" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkThreadEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkThreadEmail_workId_idx" ON "WorkThreadEmail"("workId");

ALTER TABLE "WorkThreadEmail" ADD CONSTRAINT "WorkThreadEmail_workId_fkey" FOREIGN KEY ("workId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
