-- LES DEUX COLONNES QUE RIEN N'ÉCRIT.
--
-- Aucun chemin du code ne les pose, aucun ne les lit. Elles sont donc NULL pour
-- toutes les lignes de toutes les bases, et la preuve n'est pas une requête :
-- c'est un `grep` sur les sources, qui ne rend rien hors du client généré.
-- C'est ce qui rend ces deux `DROP` sûrs — on ne perd pas de la donnée, on
-- retire une promesse.

-- `displayCurrency` ne pourra JAMAIS être honorée, et c'est la raison du retrait.
--
-- Son commentaire annonçait « préférence d'affichage de la personne, distincte
-- de la devise du parc ». Or le produit ne convertit pas : les montants sont
-- stockés en unités mineures sans devise attachée, et un loyer de 180 000 relu
-- en euros reste 180 000 — six cent cinquante-six fois sa valeur. C'est
-- exactement ce que l'écran de correction du parc avertit avant de laisser
-- changer la devise d'un parc.
--
-- Honorer cette préférence exigerait une source de taux et une date de
-- référence SUR CHAQUE MONTANT. Ce n'est pas une colonne en attente de
-- branchement : c'est une promesse que le schéma faisait à la place d'une
-- fonctionnalité écartée, et le sélecteur de devise de la vitrine est déjà
-- réservé à la démonstration pour cette même raison.
ALTER TABLE "UserAccount" DROP COLUMN IF EXISTS "displayCurrency";

-- `emailVerifiedAt` part pour une autre raison : la fonctionnalité est réelle,
-- simplement non construite — et non livrable en l'état, faute de domaine
-- vérifié chez le fournisseur de courrier.
--
-- La garder ne coûte rien mais ne prouve rien. La rajouter le jour venu ne
-- coûtera rien non plus : une colonne nullable ajoutée après coup ne demande
-- aucune reprise de données, puisque « non vérifié » est le bon défaut pour
-- tout le monde. Le raisonnement inverse — celui qui a fait garder `readAt` sur
-- `NotificationRecipient` — ne s'applique pas ici : `readAt` vivait sur des
-- lignes qu'on créait déjà, et l'omettre aurait imposé une reprise le jour où
-- une route l'écrirait.
ALTER TABLE "UserAccount" DROP COLUMN IF EXISTS "emailVerifiedAt";
