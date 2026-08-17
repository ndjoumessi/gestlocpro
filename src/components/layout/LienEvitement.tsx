import { cn } from '@/lib/cn'

/**
 * Lien d'évitement.
 *
 * Première tabulation de la page — donc la toute première chose qu'un
 * utilisateur au clavier voit apparaître. Il se posait en haut à gauche à 12 px
 * des bords, c'est-à-dire sous la barre d'état en portrait et sous l'encoche en
 * paysage à gauche : illisible au moment exact où il doit être lu. `calc()` :
 * la pastille est peinte, ses 12 px de retrait doivent s'AJOUTER à la zone
 * réservée, pas la remplacer.
 *
 * Il vivait dans la vitrine seule. L'espace connecté, où il sert POURTANT le
 * plus — la barre latérale y compte une dizaine de liens à franchir avant le
 * contenu, à chaque page — n'en avait pas. Le composant est partagé plutôt que
 * recopié : deux pastilles qui divergeraient de position ou de libellé seraient
 * pires qu'une seule, l'utilisateur apprend le geste une fois.
 */
export function LienEvitement() {
  return (
    <a
      href="#main"
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:z-100',
        'focus:top-[calc(0.75rem+env(safe-area-inset-top))]',
        'focus:left-[calc(0.75rem+env(safe-area-inset-left))]',
        'focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-on-dark',
      )}
    >
      Aller au contenu
    </a>
  )
}
