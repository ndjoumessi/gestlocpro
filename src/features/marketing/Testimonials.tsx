import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const QUOTES = ['one', 'two', 'three'] as const

/**
 * Preuve sociale.
 *
 * Les personnes citées sont fictives et le disent. Pas de logos d'entreprises
 * réelles, pas de citation attribuée à quelqu'un qui existe, pas de photo de
 * banque d'images faisant passer un modèle pour un client : le produit n'a pas
 * encore d'utilisateurs, et une fausse preuve sociale se retourne contre celui
 * qui la publie. Le bandeau reste visible quand les vrais témoignages
 * arriveront — il suffira de le retirer.
 */
export function Testimonials() {
  const t = useT()

  return (
    <Section
      id="proof"
      eyebrow={t('marketing.proof.eyebrow')}
      title={t('marketing.proof.title')}
      centered
    >
      <p className="mx-auto -mt-6 mb-10 flex max-w-xl items-start justify-center gap-2 rounded-md border border-gold-border bg-gold-tint px-4 py-3 text-body-s text-gold-ink">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        {t('marketing.proof.disclaimer')}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {QUOTES.map((key) => (
          <figure
            key={key}
            className="flex flex-col rounded-lg border border-divider bg-surface p-6 shadow-e1"
          >
            <Icon name="sparkle" size={20} className="text-gold" />

            <blockquote className="mt-4 flex-1">
              <p className="text-body text-pretty text-ink">
                «&nbsp;{t(`marketing.proof.${key}.quote` as 'marketing.proof.one.quote')}&nbsp;»
              </p>
            </blockquote>

            <figcaption className="mt-5 flex items-center gap-3 border-t border-divider pt-4">
              {/* Silhouette neutre : pas de portrait d'emprunt. */}
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted"
              >
                <Icon name="users" size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-label font-semibold text-muted italic">
                  {t(`marketing.proof.${key}.name` as 'marketing.proof.one.name')}
                </span>
                <span className="block font-mono text-mono-label text-muted">
                  {t(`marketing.proof.${key}.role` as 'marketing.proof.one.role')}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}
