import { Link } from 'react-router-dom'
import { Logo } from '@/components/primitives/Logo'
import { useT } from '@/i18n/I18nProvider'

const COLUMNS = [
  {
    heading: 'marketing.footer.product',
    links: [
      { label: 'marketing.nav.features', to: '/#features' },
      { label: 'marketing.nav.pricing', to: '/#pricing' },
      { label: 'marketing.footer.demo', to: '/demo' },
    ],
  },
  {
    heading: 'marketing.footer.company',
    links: [
      { label: 'marketing.footer.about', to: '/#roles' },
      { label: 'marketing.footer.contact', to: '/#faq' },
    ],
  },
  {
    heading: 'marketing.footer.legal',
    links: [
      { label: 'marketing.footer.terms', to: '/#faq' },
      { label: 'marketing.footer.privacy', to: '/#faq' },
      { label: 'marketing.footer.cookies', to: '/#faq' },
    ],
  },
] as const

export function PublicFooter() {
  const t = useT()

  return (
    <footer className="on-dark bg-ink text-on-dark">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo tone="dark" />
            <p className="mt-4 text-body text-on-dark-muted">{t('brand.tagline')}.</p>
            {/* Les sélecteurs de langue et de devise étaient ici aussi —
                quatrième copie sur la page. L'en-tête est collant : il reste
                atteignable depuis le pied de page sans remonter. */}
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading as 'marketing.footer.product')}>
              <h2 className="eyebrow font-sans text-gold">
                {t(column.heading as 'marketing.footer.product')}
              </h2>
              <ul className="mt-4 flex flex-col gap-0.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="inline-flex min-h-11 items-center text-body text-on-dark-muted no-underline transition-colors duration-150 hover:text-on-dark"
                    >
                      {t(link.label as 'marketing.nav.features')}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-on-dark-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-mono-label text-on-dark-faint">
            {t('marketing.footer.rights', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  )
}
