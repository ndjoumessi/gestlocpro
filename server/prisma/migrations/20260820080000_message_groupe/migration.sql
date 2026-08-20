-- Un message groupé n'est ni un paiement, ni un chantier, ni un relevé, ni un
-- bail : c'est le bailleur qui parle à ses locataires. Le loger sous une nature
-- existante l'aurait rendu indiscernable d'un événement du produit, et l'écran
-- des signalements n'aurait pas su le présenter autrement.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'announcement';
