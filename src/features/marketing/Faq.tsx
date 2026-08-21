import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const QUESTIONS = ['one', 'two', 'three', 'four', 'five'] as const

/**
 * FAQ en `<details>` natifs : ouverture au clavier, indexables par les moteurs
 * de recherche et lisibles sans JavaScript. Aucun état React n'est nécessaire.
 */
export function Faq() {
  const t = useT()

  return (
    <Section
      id="faq"
      tone="paper"
      // `serre` : on lève des objections, on ne construit plus l'argument — la
      // décision s'est prise juste au-dessus. Cinq lignes repliées ne réclament
      // pas le temps qu'on accorde à une grille de six cartes, et l'aération
      // d'origine séparait la FAQ du tarif dont elle est le prolongement.
      rythme="serre"
      eyebrow={t('marketing.faq.eyebrow')}
      title={t('marketing.faq.title')}
      centered
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map((key) => (
          <details
            key={key}
            className="group rounded-lg border border-divider bg-surface px-5 shadow-e1 open:shadow-e2"
          >
            <summary
              className={cn(
                'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4',
                'title-m text-ink',
                'marker:content-none [&::-webkit-details-marker]:hidden',
              )}
            >
              {t(`marketing.faq.${key}.q` as 'marketing.faq.one.q')}
              <Icon
                name="chevronDown"
                size={18}
                className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            {/*
              `text-body-l` ET NON `text-body`.

              Le jeton de 16 px porte son usage dans son commentaire — « landing »
              — et celui de 14 s'appelle « corps application ». La réponse d'une
              FAQ est du texte PRINCIPAL sur une page de vitrine : elle se lit
              d'affilée, souvent sur un téléphone, par quelqu'un qui hésite
              encore. Quatorze pixels y sont la taille d'une interface qu'on
              parcourt, pas d'une prose qu'on lit.

              `max-w-[65ch]` : c'est la plus longue mesure de la page, environ
              cent quatre caractères. La section de la vitrine a déjà tranché ce
              point à 60ch après mesure ; on borne le PARAGRAPHE et non le
              `<details>`, dont la question et la flèche doivent rester alignées
              sur la largeur de la carte.
            */}
            <p className="max-w-[65ch] border-t border-divider py-4 text-body-l text-pretty text-muted">
              {t(`marketing.faq.${key}.a` as 'marketing.faq.one.a')}
            </p>
          </details>
        ))}
      </div>
    </Section>
  )
}
