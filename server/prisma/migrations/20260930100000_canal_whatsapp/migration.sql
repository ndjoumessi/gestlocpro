-- WHATSAPP, ET CE QU'IL N'EST PAS ENCORE.
--
-- Le produit relançait par SMS et l'écrivait EN DUR : la route posait
-- `channel: 'sms'` quand le message partait, `'in_app'` sinon. Sur le marché
-- visé, WhatsApp atteint plus de gens que le SMS, et coûte moins.
--
-- MÊME API QUE LE SMS. Twilio sert les deux par la même requête HTTP ; seul
-- change un préfixe `whatsapp:` sur l'expéditeur et le destinataire. Aucun
-- paquet de plus, aucune surface de plus à tenir à jour.
--
-- CE QUE CE MEMBRE NE PROMET PAS, ET C'EST ÉCRIT DANS LE PRODUIT. Meta
-- n'autorise un message SORTANT hors d'une fenêtre de 24 h après le dernier
-- message du destinataire que s'il suit un MODÈLE qu'elle a approuvé. Une
-- relance de loyer est par nature non sollicitée. Sans modèle approuvé, Twilio
-- la refuse — code 63016 —, la couture rend `false`, le produit écrit `in_app`
-- et l'écran dit qu'elle n'est pas partie.
--
-- Le canal ne ment donc pas : il exige une démarche administrative que le code
-- ne peut pas faire à la place de l'exploitant. Le réglage le dit là où on le
-- choisit, plutôt que de le laisser découvrir à la première relance muette.
--
-- ═══ CE QUE LE DÉFAUT AFFIRME DES PARCS DÉJÀ EN BASE ═══
--
-- `reminderChannel` à `'sms'` affirme que tous relancent par SMS. VRAI sans
-- réserve, et vérifié plutôt que supposé : la valeur était écrite en dur dans
-- la route jusqu'à cette migration, sans aucun réglage ni aucune exception. Le
-- défaut ne fait donc que rendre EXPLICITE ce que le code imposait déjà, et
-- aucun parc ne change de comportement le jour où le réglage apparaît.
--
-- UN DÉFAUT À `'whatsapp'` AURAIT ÉTÉ UNE PANNE SILENCIEUSE : faute de modèle
-- approuvé, toutes les relances de tous les parcs auraient cessé de partir, et
-- rien dans l'écran n'aurait expliqué pourquoi.

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'whatsapp';

-- AlterTable
ALTER TABLE "Park" ADD COLUMN "reminderChannel" "NotificationChannel" NOT NULL DEFAULT 'sms';
