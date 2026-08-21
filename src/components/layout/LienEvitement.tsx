import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

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
/*
  SON TEXTE ÉTAIT LE SEUL DU PRODUIT HORS DICTIONNAIRE, et il a tenu parce que le
  garde-fou ne pouvait pas le voir : `check-i18n` repère une chaîne visible à ses
  caractères accentués, et « Aller au contenu » n'en porte aucun. Un visiteur
  anglophone lisait donc du français à la première tabulation de chaque page — la
  toute première chose que le produit lui dise.
*/
export function LienEvitement() {
  const t = useT()

  return (
    <a
      href="#main"
      className={cn(
        // Le sommet de l'échelle, et par la valeur arbitraire plutôt que par
        // `style` : l'altitude ne doit exister QU'AU FOCUS, et un attribut de
        // style ne connaît pas les variantes. La pastille est la première
        // tabulation de la page ; elle apparaît par-dessus tout ce qui est déjà
        // à l'écran, sans quoi elle serait annoncée sans être vue.
        'sr-only focus:not-sr-only focus:fixed focus:z-[var(--z-toast)]',
        'focus:top-[calc(0.75rem+env(safe-area-inset-top))]',
        'focus:left-[calc(0.75rem+env(safe-area-inset-left))]',
        'focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-on-dark',
      )}
    >
      {t('common.skipToContent')}
    </a>
  )
}
