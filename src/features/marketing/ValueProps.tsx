import { Section } from '@/components/layout/Section'
import { useT } from '@/i18n/I18nProvider'

const KEYS = ['one', 'two', 'three', 'four'] as const

/**
 * Le constat, seul.
 *
 * La section tenait deux colonnes en vis-à-vis, « Aujourd'hui » et « Avec
 * GestLocPro ». La seconde a été retirée : ses quatre lignes redisaient les
 * cartes de fonctionnalités qui suivent immédiatement — relevés saisis sur
 * place, relance dès l'échéance, entrée et sortie comparées, registre unique à
 * droits distincts. Le visiteur lisait donc la réponse deux fois avant d'avoir
 * fini de comprendre le problème.
 *
 * Ce qui reste tient son rôle : poser la friction, et laisser la grille des
 * fonctionnalités y répondre. Une section qui pose une question et une section
 * qui y répond valent mieux qu'une section qui fait les deux, suivie d'une
 * autre qui refait la seconde moitié.
 */
export function ValueProps() {
  const t = useT()

  return (
    <Section
      id="value"
      tone="paper"
      eyebrow={t('marketing.value.eyebrow')}
      title={t('marketing.value.title')}
      description={t('marketing.value.body')}
    >
      {/* Quatre frictions, numérotées : le chiffre donne la mesure — quatre
          ruptures nommées, pas « des problèmes » en général.
          Sur une grille de quatre et non de deux : en deux colonnes, les
          entrées courtes laissaient des demi-lignes vides sous les longues. */}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KEYS.map((key, index) => (
          <li
            key={key}
            className="flex flex-col rounded-xl border border-divider bg-surface p-6 shadow-e1"
          >
            <span
              aria-hidden="true"
              className="font-mono text-mono-label text-gold-ink tabular-nums"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="mt-4 text-body-l text-pretty text-ink">
              {t(`marketing.value.before.${key}` as 'marketing.value.before.one')}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
