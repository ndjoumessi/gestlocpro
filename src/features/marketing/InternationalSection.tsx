import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { CURRENCIES, CURRENCY_DEFS } from '@/currency/currencies'
import { COUNTRIES } from '@/lib/countries'
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales'
import { useI18n, useT } from '@/i18n/I18nProvider'

/**
 * Nombre de pays nommés sous le chiffre, le reste étant compté.
 *
 * Les deux premières cartes énumèrent la totalité de ce qu'elles annoncent —
 * quatre devises, deux langues, cela tient. Vingt et un pays, non : la carte
 * affichait donc un nombre seul au-dessus d'un vide, alors que ses voisines
 * portaient une liste. Nommer les premiers et compter les autres rend la carte
 * comparable aux deux autres sans mentir sur ce qui est couvert.
 */
const PAYS_NOMMES = 4

/**
 * Portée internationale, énoncée en chiffres.
 *
 * La section portait deux cartes de sélection — devises et langues, chacune
 * cliquable. C'était la troisième copie des mêmes contrôles sur une seule page,
 * après l'en-tête et le hero, et le pied de page en tenait une quatrième.
 * Quatre moyens de faire la même chose n'en font pas une promesse plus forte :
 * ils diluent l'endroit où l'on sait la trouver. L'en-tête est collant, donc
 * toujours accessible ; c'est lui qui garde la fonction.
 *
 * Ce qui reste est ce que les contrôles ne disaient pas : **combien**. Les
 * trois nombres sont dérivés du code — pas écrits à la main — et les listes
 * qui suivent nomment ce qui est couvert, sans prétendre être des boutons.
 */
export function InternationalSection() {
  const t = useT()
  const { locale } = useI18n()

  // Le reste est CALCULÉ, jamais écrit. « et 17 autres » en dur deviendrait
  // faux au premier pays ajouté, exactement comme les trois nombres au-dessus
  // — dont c'est déjà la raison d'être.
  const nommes = COUNTRIES.slice(0, PAYS_NOMMES).map((p) => (locale === 'fr' ? p.nameFr : p.nameEn))
  const restants = COUNTRIES.length - nommes.length

  const facts = [
    { key: 'currencies', value: CURRENCIES.length, detail: CURRENCIES.map((c) => CURRENCY_DEFS[c].label) },
    { key: 'languages', value: LOCALES.length, detail: LOCALES.map((l) => LOCALE_LABELS[l].long) },
    {
      key: 'countries',
      value: COUNTRIES.length,
      detail:
        restants > 0
          ? [...nommes, t('marketing.international.andMore', { count: String(restants) })]
          : nommes,
    },
  ] as const

  return (
    <Section
      id="international"
      tone="paper"
      eyebrow={t('marketing.international.eyebrow')}
      title={t('marketing.international.title')}
      // Les nombres viennent de `CURRENCIES` et `LOCALES` : écrits en toutes
      // lettres dans le dictionnaire, ils devenaient faux en silence dès qu'on
      // ajoutait une devise.
      description={t('marketing.international.body', {
        currencies: CURRENCIES.length,
        locales: LOCALES.length,
      })}
    >
      {/* Trois chiffres en cartes, sur la même grille que le reste de la page.
          Posés à même le fond, ils flottaient dans une moitié de section vide,
          et le contraste d'échelle entre le nombre et son libellé ne suffisait
          pas à les rattacher les uns aux autres. */}
      <dl className="grid gap-5 sm:grid-cols-3">
        {facts.map((fact) => (
          <div
            key={fact.key}
            className="rounded-xl border border-divider bg-surface p-7 shadow-e1 sm:p-8"
          >
            <dt className="eyebrow flex items-center gap-2 text-muted">
              <Icon name="globe" size={13} className="text-gold-ink" />
              {t(`marketing.international.${fact.key}` as 'marketing.international.currencies')}
            </dt>
            <dd className="m-0">
              <p className="numeric mt-4 text-[2.75rem] leading-none font-medium">{fact.value}</p>
              {fact.detail.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-divider pt-4">
                  {fact.detail.map((label) => (
                    <li key={label} className="text-body-s text-muted">
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
