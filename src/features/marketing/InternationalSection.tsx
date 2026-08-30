import { Section } from '@/components/layout/Section'
import { Card } from '@/components/primitives/Card'
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

  /*
    UN SIGNE PAR FAIT, ET NON LE MÊME TROIS FOIS.

    Les trois cartes portaient le MÊME globe. Un icône ne vaut que par ce qu'il
    sépare : répété à l'identique entre trois voisins, il n'apporte rien et
    occupe la place, la couleur et l'attention d'un signe qui en apporterait.

    `card` pour les devises — le moyen de paiement ; `monitor` pour les langues —
    ce sont celles de l'INTERFACE, pas celles du produit ; `globe` reste aux
    pays, où il dit enfin ce qu'il montre.
  */
  const facts = [
    { key: 'currencies', icone: 'card' as const, value: CURRENCIES.length, detail: CURRENCIES.map((c) => CURRENCY_DEFS[c].label) },
    { key: 'languages', icone: 'monitor' as const, value: LOCALES.length, detail: LOCALES.map((l) => LOCALE_LABELS[l].long) },
    {
      key: 'countries',
      icone: 'globe' as const,
      value: COUNTRIES.length,
      detail:
        restants > 0
          ? [...nommes, t('marketing.international.andMore', { count: String(restants) })]
          : nommes,
    },
  ] as const

  return (
    <Section
      // `serre` : trois nombres et leurs listes. C'est un appui — de quoi lever
      // un doute sur la couverture — et non une étape du raisonnement. Mesurée
      // à 683 px pour 256 de rembourrage, la section consacrait plus d'un tiers
      // de sa hauteur à ne rien dire, au même tarif que la grille des
      // fonctionnalités qui en dit six fois plus.
      rythme="serre"
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
          /* Par la primitive, et non recopiée à la main : cette carte EST
             `tone="default"` au jeton près — `bg-surface`, `border-divider`,
             `shadow-e1` —, si bien que la réécrire ici la condamnait à être
             corrigée à part à chaque lot de géométrie. `flush` retire le
             rembourrage par défaut de la primitive au lieu de le laisser en
             conflit avec celui d'ici : `cn` concatène, il ne fusionne pas, et
             deux `p-*` sur le même élément ne se départagent alors que par
             l'ordre d'émission de la feuille de style. */
          <Card key={fact.key} flush className="flex flex-col p-7 sm:p-8">
            {/* Le signe passe à 16 px et prend l'accent : à 13 px il n'était
                qu'une poussière bleue en concurrence avec le surtitre. */}
            <dt className="eyebrow flex items-center gap-2.5 text-muted">
              <Icon name={fact.icone} size={16} className="text-accent-ink" />
              {t(`marketing.international.${fact.key}` as 'marketing.international.currencies')}
            </dt>
            <dd className="m-0 flex flex-1 flex-col">
              <p className="numeric mt-4 text-[2.75rem] leading-none font-medium">{fact.value}</p>

              {/*
                LE DÉTAIL EN JETONS, ET NON EN LISTE QUI SE REPLIE.

                C'étaient des mots posés côte à côte, séparés par un écart. Sur la
                carte des pays, quatre noms plus « et 17 autres » se replient en
                deux lignes ragées où rien ne dit où finit un pays et où commence
                le suivant — « Congo-Brazzaville Tchad » se lit comme une seule
                entrée. Une bordure par valeur rend le compte visible : on VOIT
                quatre devises, deux langues, quatre pays nommés.

                `mt-auto` : les trois cartes n'ont pas le même nombre de valeurs,
                et sans lui le trait de séparation tombait à trois hauteurs
                différentes. Poussé en bas, il aligne les trois cartes sur leur
                partie basse — celle qu'on compare.
              */}
              {fact.detail.length > 0 && (
                <ul className="mt-auto flex flex-wrap gap-2 border-t border-divider pt-5">
                  {fact.detail.map((label, index) => (
                    <li
                      key={label}
                      className={
                        /* Le reste — « et 17 autres » — n'est pas une valeur : il
                           en compte d'autres. Lui donner la même gélule ferait
                           lire dix-sept pays comme un pays de plus. */
                        index === fact.detail.length - 1 && /\d/.test(label) && index >= PAYS_NOMMES
                          ? 'self-center text-body text-muted'
                          : 'rounded-md border border-divider bg-surface-sunken px-2.5 py-1 text-body text-ink'
                      }
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </Card>
        ))}
      </dl>
    </Section>
  )
}
