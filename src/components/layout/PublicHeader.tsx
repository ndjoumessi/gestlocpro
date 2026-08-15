import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/primitives/Logo'
import { Button, IconButton } from '@/components/primitives/Button'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useT } from '@/i18n/I18nProvider'

const SECTIONS = [
  { id: 'features', key: 'marketing.nav.features' },
  { id: 'roles', key: 'marketing.nav.roles' },
  { id: 'pricing', key: 'marketing.nav.pricing' },
  { id: 'faq', key: 'marketing.nav.faq' },
] as const

export function PublicHeader() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Le menu mobile fige le fond : sans cela, la page défile derrière le panneau.
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <>
      {/* Lien d'évitement : première tabulation de la page. */}
      <a
        href="#main"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100',
          'focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-on-dark',
        )}
      >
        Aller au contenu
      </a>

      <header
        className={cn(
          'sticky top-0 border-b transition-colors duration-200',
          scrolled ? 'border-border bg-paper/92 backdrop-blur-md' : 'border-transparent bg-transparent',
        )}
        style={{ zIndex: 'var(--z-sticky)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-8">
          <Logo />

          <nav aria-label={t('nav.primaryNav')} className="ml-6 hidden items-center gap-1 lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-md px-3 text-body font-medium',
                  'text-muted no-underline transition-colors duration-150',
                  'hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {t(section.key as 'marketing.nav.features')}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" to="/connexion">
                {t('auth.signIn')}
              </Button>
              <Button to="/inscription">{t('auth.signUpFree')}</Button>
            </div>

            <IconButton
              icon={menuOpen ? 'close' : 'menu'}
              label={menuOpen ? t('marketing.nav.closeMenu') : t('marketing.nav.openMenu')}
              variant="secondary"
              onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden"
              aria-expanded={menuOpen}
            />
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-x-0 top-[65px] bottom-0 overflow-y-auto border-t border-border bg-paper lg:hidden"
          style={{ zIndex: 'var(--z-overlay)' }}
        >
          <nav aria-label={t('nav.primaryNav')} className="flex flex-col gap-1 p-5">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex min-h-14 items-center rounded-md px-4 font-sans text-title-m font-semibold',
                  'text-ink no-underline transition-colors duration-150 hover:bg-surface-sunken',
                )}
              >
                {t(section.key as 'marketing.nav.features')}
              </a>
            ))}

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <LanguageSwitcher />
                <CurrencySwitcher />
              </div>
              <Button variant="secondary" size="lg" fullWidth to="/connexion">
                {t('auth.signIn')}
              </Button>
              <Button size="lg" fullWidth to="/inscription">
                {t('auth.signUpFree')}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
