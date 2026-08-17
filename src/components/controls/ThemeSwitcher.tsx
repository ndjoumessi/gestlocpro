import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { THEMES, useTheme, type Theme } from '@/theme/ThemeProvider'

export interface ThemeSwitcherProps {
  /** `dark` pour les fonds sombres (sidebar, hero, pied de page). */
  tone?: 'light' | 'dark'
  className?: string
}

const ICONS: Record<Theme, IconName> = {
  auto: 'monitor',
  light: 'sun',
  dark: 'moon',
}

const LABELS: Record<Theme, 'theme.auto' | 'theme.light' | 'theme.dark'> = {
  auto: 'theme.auto',
  light: 'theme.light',
  dark: 'theme.dark',
}

/**
 * Bascule Système / Clair / Sombre.
 *
 * Même grammaire que le sélecteur de langue : un segmenté, pas un menu — trois
 * états tiennent à l'œil, et l'état courant se lit sans ouvrir quoi que ce soit.
 *
 * Les icônes ne portent pas l'information seules. Chaque bouton garde son
 * libellé en `sr-only` et son `title`, et `aria-pressed` dit lequel est retenu :
 * un lecteur d'écran annonce « Sombre, activé », pas « bouton ».
 */
/**
 * Ce que « Système » donne EN CE MOMENT.
 *
 * Sans cette information, deux des trois boutons sont indiscernables : sur un
 * système réglé en sombre, « Système » et « Sombre » produisent exactement la
 * même page. Le produit fonctionne, mais rien ne l'explique — on clique l'un,
 * puis l'autre, et on conclut qu'un des deux est cassé.
 *
 * La préférence est écoutée plutôt que lue une fois : elle change sans
 * rechargement, notamment sur les systèmes qui basculent au coucher du soleil,
 * et une étiquette qui resterait sur « clair » à 21 h serait pire que pas
 * d'étiquette du tout.
 */
function useSystemeResolu(): Theme {
  const [sombre, setSombre] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const requete = matchMedia('(prefers-color-scheme: dark)')
    const auChangement = (e: MediaQueryListEvent) => setSombre(e.matches)
    requete.addEventListener('change', auChangement)
    return () => requete.removeEventListener('change', auChangement)
  }, [])

  return sombre ? 'dark' : 'light'
}

export function ThemeSwitcher({ tone = 'light', className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()
  const t = useT()
  const resolu = useSystemeResolu()

  return (
    <div
      role="group"
      aria-label={t('common.theme')}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-md border p-0.5',
        tone === 'dark' ? 'border-on-dark-border bg-on-dark-hover' : 'border-border bg-surface',
        className,
      )}
    >
      {THEMES.map((code) => {
        const active = code === theme
        // « Système » dit vers quoi il résout ; les deux autres se suffisent —
        // « Sombre — sombre actuellement » serait du bruit.
        const label =
          code === 'auto'
            ? t('theme.autoResolu', { resolu: t(LABELS[resolu]).toLowerCase() })
            : t(LABELS[code])
        return (
          <button
            key={code}
            type="button"
            onClick={() => setTheme(code)}
            aria-pressed={active}
            title={label}
            className={cn(
              // 44px de haut comme de large : cible tactile minimale tenue.
              'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm',
              'transition-colors duration-150 ease-out',
              active
                ? tone === 'dark'
                  ? 'bg-gold text-ink'
                  : 'bg-ink text-on-dark'
                : tone === 'dark'
                  ? 'text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark'
                  : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <Icon name={ICONS[code]} size={16} />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
