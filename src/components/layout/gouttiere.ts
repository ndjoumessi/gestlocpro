/**
 * Gouttière latérale des surfaces qui vont d'un bord de l'écran à l'autre.
 *
 * Onze attributs de classe portaient la même paire de retraits arbitraires,
 * recopiée à la main d'un écran à l'autre. Deux d'entre eux traitaient l'encoche
 * et neuf non : en portrait les insets latéraux valent 0, donc l'écart ne se
 * voyait nulle part, et il ressortait d'un coup en paysage sur iPhone, où
 * l'encoche mord à gauche OU à droite selon le sens de rotation. Une valeur
 * répétée onze fois n'est pas une convention, c'est onze occasions de diverger.
 *
 * Cette constante n'est pas une classe maison : c'est le MÊME empilement
 * d'utilitaires, écrit une fois. Le scanner de Tailwind lit les sources comme du
 * texte, donc les noms doivent apparaître ici en toutes lettres — ni concaténés
 * ni interpolés, sinon les utilitaires ne sont jamais générés et la panne est
 * silencieuse.
 *
 * `max()` et non `calc()` : la gouttière de base — 20 px, 32 px au-delà de `sm`
 * — dépasse déjà l'inset sur la quasi-totalité du parc. L'encoche ne s'AJOUTE
 * donc pas à elle, elle la remplace le jour où elle devient plus large. Le
 * `calc()` est réservé aux bords peints qui doivent déborder jusqu'au bord
 * physique, ce que ces surfaces ne font pas : elles ne portent que du texte.
 */
export const GOUTTIERE_LATERALE = [
  'pl-[max(1.25rem,env(safe-area-inset-left))]',
  'pr-[max(1.25rem,env(safe-area-inset-right))]',
  'sm:pl-[max(2rem,env(safe-area-inset-left))]',
  'sm:pr-[max(2rem,env(safe-area-inset-right))]',
].join(' ')
