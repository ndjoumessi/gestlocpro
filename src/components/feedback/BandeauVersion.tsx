import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Button } from '@/components/primitives/Button'
import { useNouvelleVersion } from '@/lib/version'

/**
 * « Une nouvelle version est disponible. »
 *
 * Posé en bas et non en haut : le haut porte déjà la barre de navigation et,
 * en démonstration, le bandeau ambre. Un troisième bandeau au même endroit
 * repousserait le contenu de trois rangs et se ferait ignorer avec les autres.
 *
 * Il ne se ferme pas, et ne recharge pas tout seul. Recharger d'autorité
 * jetterait un formulaire à moitié rempli — la mise à jour est importante, elle
 * ne l'est pas au point de détruire le travail de quelqu'un. Le choix reste à
 * l'utilisateur, le bandeau attend.
 */
export function BandeauVersion() {
  const nouvelle = useNouvelleVersion()
  const t = useT()

  if (!nouvelle) return null

  return (
    <div
      role="status"
      // `calc(base + env(…))` en bas, et non `max()` comme le toast : ce
      // bandeau est PEINT. Son encre doit descendre jusqu'au bord physique,
      // sinon la barre de gestes se détache sur une bande de page qui défile
      // derrière elle. L'addition fait les deux d'un coup — le fond déborde
      // dans la zone réservée, le texte et le bouton restent au-dessus.
      //
      // Latéralement en revanche, `max()` : le fond couvre déjà toute la
      // largeur, seul le contenu doit s'écarter de l'encoche, et en paysage
      // ajouter 20 px aux 59 px de l'inset volerait de la place à un écran qui
      // en manque déjà.
      //
      // Le bord bas n'est PAS le sien. La coquille de gestion y pose une barre
      // de navigation `fixed` au même `var(--z-sticky)`, et `main.tsx` rend ce
      // bandeau APRÈS `<App />` : à altitude égale, le dernier peint gagne. Le
      // bandeau recouvrait donc les cinq destinations mobiles — mesuré à
      // 375 px, `elementFromPoint` au centre du bord bas rendait « Recharger »
      // et non le lien. Il se pose désormais SUR la barre quand il y en a une ;
      // le jeton vaut 0 partout où il n'y en a pas, accueil, connexion et
      // inscription comprises, et le bandeau y touche le bord comme avant.
      //
      // Le repli `0px` couvre l'hôte qui monterait ce bandeau sans la feuille
      // de jetons — un banc d'essai, une page isolée. Il ne dispense pas de
      // l'y déclarer, et `empilement.test.ts` vérifie les deux moitiés.
      className={cn(
        'fixed inset-x-0 bottom-[var(--h-barre-basse,0px)] flex flex-wrap items-center justify-center gap-x-4 gap-y-2',
        'border-t border-border bg-ink text-body-s text-on-dark',
        'pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <span>{t('common.newVersion')}</span>
      <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
        {t('common.newVersionReload')}
      </Button>
    </div>
  )
}
