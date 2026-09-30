-- LES SEMAINES OÙ LE PRODUIT NE SERVAIT À RIEN.
--
-- Le produit savait dire qu'un logement était vacant — « pas de bail en cours »,
-- déduit et jamais écrit — et s'arrêtait là. Tout ce qui se passe ENTRE un
-- départ et le bail suivant n'avait aucune place : à quel loyer on remet, à
-- partir de quand, qui s'est présenté, et ce que la visite a appris.
--
-- Ce sont pourtant les semaines les plus coûteuses de la vie d'un logement. Un
-- mois de vacance sur un loyer de 70 000 coûte plus que douze mois d'honoraires
-- de gestion sur le même bien.
--
-- ═══ DEUX TABLES, ET DEUX DISTINCTIONS QUI COMPTENT ═══
--
-- LE LOYER DEMANDÉ N'EST PAS `Unit.baseRentMinor`. On remet souvent à un autre
-- prix que le précédent — le marché a bougé, le logement a été refait. Écraser
-- la référence du logement pour y porter une INTENTION effacerait ce que le bail
-- en cours paie réellement. L'annonce porte donc son prix ; le bail signé posera
-- le sien, et l'écart entre les deux est ce qu'on vient lire l'année suivante.
--
-- UN CANDIDAT N'EST PAS UN `Tenant`. Il n'a signé aucun bail : le créer comme
-- locataire le ferait entrer dans les quittances, les relances et le registre
-- des accès d'un parc où il n'habite pas. Le jour où il signe, le produit crée
-- son locataire — et la candidature RESTE, comme trace de la façon dont il est
-- arrivé.
--
-- ═══ CE QUE LA BASE NE TIENT PAS, ET POURQUOI ═══
--
-- UN SEUL CANDIDAT ACCEPTÉ PAR ANNONCE n'est PAS tenu ici. Un accord se retire
-- et se redonne à un autre le lendemain — c'est même le cas courant, quand le
-- premier ne donne plus signe de vie. Un index unique partiel obligerait à
-- passer par un état intermédiaire pour un geste que le produit doit rendre
-- immédiat, et l'erreur qu'il préviendrait — deux accords simultanés — se voit
-- à l'écran, sur une liste qu'on a sous les yeux.
--
-- C'est l'inverse de l'arbitrage du plan d'apurement, où un second plan actif ne
-- se voyait nulle part et rendait « où en est-il ? » sans réponse.
--
-- AUCUNE COLONNE AJOUTÉE À UNE TABLE EXISTANTE : deux tables neuves, vides à la
-- migration. Il n'y a donc rien à affirmer sur des lignes préexistantes — un
-- logement sans annonce se lit « aucune annonce », ce qui est exactement l'état
-- de tous les logements avant ce lot.

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('received', 'visited', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "rentMinor" INTEGER NOT NULL,
    "depositMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "availableFrom" DATE NOT NULL,
    "description" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "note" TEXT,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'received',
    "appliedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_unitId_idx" ON "Listing"("unitId");

-- CreateIndex
CREATE INDEX "Applicant_listingId_idx" ON "Applicant"("listingId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
