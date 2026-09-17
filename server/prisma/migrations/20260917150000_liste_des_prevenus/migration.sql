-- QUI A ÉTÉ PRÉVENU D'UNE FERMETURE, et dans quelle langue.
--
-- L'annulation recalculait la liste des destinataires au lieu de la relire :
-- elle s'adressait donc à ceux qui étaient là au moment où l'on se ravise, pas à
-- ceux qu'on avait alarmés. Un locataire retiré du parc pendant le délai gardait
-- l'annonce de la disparition de ses quittances sans jamais apprendre qu'elle
-- n'aurait pas lieu.
--
-- L'ADRESSE EST COPIÉE et non reliée à un compte : une fiche sans compte en
-- porte une, et c'est celle qui n'a aucun autre moyen d'être rejointe.
CREATE TABLE "ClosureWarning" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parkId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureWarning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClosureWarning_userId_parkId_email_key" ON "ClosureWarning"("userId", "parkId", "email");
CREATE INDEX "ClosureWarning_userId_idx" ON "ClosureWarning"("userId");

ALTER TABLE "ClosureWarning" ADD CONSTRAINT "ClosureWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClosureWarning" ADD CONSTRAINT "ClosureWarning_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;
