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
      className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border bg-ink px-5 py-3 text-body-s text-on-dark"
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <span>{t('common.newVersion')}</span>
      <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
        {t('common.newVersionReload')}
      </Button>
    </div>
  )
}
