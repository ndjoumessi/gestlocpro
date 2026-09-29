/**
 * LA COLONNE DE LECTURE DE L'ESPACE CONNECTÉ.
 *
 * ═══ CE QUI SE MESURAIT AVANT ELLE ═══
 *
 * `<main>` n'avait aucune largeur maximale dans la coquille applicative : il
 * prenait toute la place que la fenêtre lui laissait, et tout ce qui s'aligne à
 * ses deux bords s'écartait d'autant. Mesuré à 1920 px le 2026-09-29, colonne
 * de 1 664 px :
 *
 *   /demo/decisions   « Devis validé » → « Arsène Nkolo »      588 à 818 px
 *   /demo/travaux     « Fuite sous l'évier » → « Valider »     857 à 1 061 px
 *   /demo/parc        « Résidence Bonamoussadi » → son loyer   1 009 px
 *
 * Ce sont des distances de LECTURE : ce qu'un œil doit parcourir pour apparier
 * un fait et ce qui le qualifie. Elles suivaient la fenêtre — 640 px de plus à
 * 2560 px — et rien ne les arrêtait.
 *
 * ═══ `max-w-7xl`, ET C'EST LE NOMBRE DE LA VITRINE ═══
 *
 * La vitrine borne ses sections à `max-w-7xl` depuis toujours, ce qui lui fait
 * 1 216 px de largeur utile, gouttière déduite. Posé ici sur `<main>`, qui
 * porte cette même gouttière, le jeton rend exactement la même : les deux
 * moitiés du produit cessent de se lire à deux chasses différentes.
 *
 * `w-full` et `mx-auto` ensemble, et les deux servent : sous 1 280 px la borne
 * ne mord pas et la colonne prend tout ; au-dessus, les marges automatiques la
 * centrent au lieu de la coller au bord de la barre latérale.
 *
 * ═══ CE QUE CETTE BORNE NE FAIT PAS ═══
 *
 * Elle réduit les trois vides ci-dessus, elle ne les ferme pas : mesuré après,
 * 368 à 598 px au registre, 488 à 692 px aux travaux. Un geste épinglé au bord
 * droit d'une rangée reste loin de son sujet, borne ou non — c'est un autre
 * sujet, et il a son propre lot.
 *
 * ═══ UNE DÉCISION CONTRAIRE, ET POURQUOI ON LA REMPLACE ═══
 *
 * `Portfolio.tsx` portait, depuis le 2026-09-06 : « Locale, pas globale :
 * contraindre `main` déplaçait le défaut sur les autres écrans (tenté et
 * retiré) ». Cette note ne portait AUCUN nombre, et rien dans l'historique ne
 * montre qu'elle ait été commitée — elle disait une tentative, pas une mesure.
 *
 * Remesuré à 1 280 px de plafond sur les dix écrans de la démonstration :
 * aucun débordement, nulle part. À 1 152 px en revanche, `/demo/locataires`
 * déborde de 14 px — sa rangée se replie plus bas et pas encore ici. La note
 * n'est donc peut-être pas fausse pour la borne qu'elle visait ; elle l'est
 * pour celle-ci, et c'est celle-ci qui est posée.
 *
 * `chasse-de-lecture.mjs` garde le nombre, à trois largeurs au-delà de 1 280 —
 * les trois portes existantes mesurent 320, 360 et 1280, c'est-à-dire
 * précisément les largeurs où ce défaut n'existe pas.
 *
 * PIÈGE TAILWIND v4 : les noms doivent apparaître ici en toutes lettres, ni
 * concaténés ni interpolés — le scanner lit les sources comme du texte, et un
 * utilitaire jamais généré est une panne silencieuse.
 */
export const COLONNE_DE_LECTURE = 'mx-auto w-full max-w-7xl'
