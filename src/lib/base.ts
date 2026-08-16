import { useLocation } from 'react-router-dom'

/**
 * Où l'on se trouve : dans un vrai espace, ou dans la démonstration.
 *
 * La démonstration a d'abord vécu sous `/app`, avec un bandeau pour la
 * signaler. C'était le mauvais arbitrage, et il a été démenti par l'usage :
 * l'auteur du produit lui-même a pris la démonstration pour son espace **deux
 * fois dans la même après-midi**, malgré le bandeau et malgré « Parc de
 * démonstration » sous le logo. Un avertissement se lit ; une adresse se
 * regarde.
 *
 * Le prix à payer est cette base, qu'il faut désormais composer partout au lieu
 * d'écrire `/app/…` en dur. C'est mécanique, et c'est ce qui avait été refusé la
 * première fois — à tort : la barre d'adresse est le premier endroit où l'on
 * vérifie où l'on est, et le seul qui ne dépende pas de ce qu'on a pris la
 * peine de lire.
 */
export type Base = '/app' | '/demo'

export function baseDeChemin(pathname: string): Base {
  return pathname === '/demo' || pathname.startsWith('/demo/') ? '/demo' : '/app'
}

export function useBase(): Base {
  return baseDeChemin(useLocation().pathname)
}

/**
 * Compose une adresse d'écran depuis la base courante.
 *
 * `lien(base, '')` rend la base elle-même — le tableau de bord — et non un
 * chemin terminé par une barre oblique, qui ferait échouer la correspondance
 * de route.
 */
export function lien(base: Base, sous: string): string {
  return sous ? `${base}/${sous}` : base
}
