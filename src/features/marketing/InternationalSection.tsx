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
      {/*
        ═══ LES TROIS NOMBRES SONT PARTIS DANS L'ACCROCHE ═══

        Cette section portait trois cartes, chacune un grand chiffre au-dessus
        de ses valeurs : 4 devises, 2 langues, 21 pays. `HeroProof` énonce
        désormais les MÊMES trois nombres, avec les MÊMES libellés — ce sont
        littéralement les clés `marketing.international.*` —, au premier écran.
        Les garder ici en faisait une redondance, et une redondance coûteuse :
        385 des 1068 px que cette section occupait au téléphone servaient à
        redire ce qui était déjà lu au premier écran.

        CE QUI RESTE EST CE QUE L'ACCROCHE NE PEUT PAS PORTER. Un nombre dit
        combien ; il ne dit pas LESQUELS. « 4 devises » ne renseigne pas
        l'exploitant de Douala sur le franc CFA, ni celui de Dakar sur le fait
        que c'est le même sigle pour deux zones — la description de la section
        le dit, et ces trois listes le montrent. C'est le seul endroit de la
        page où la couverture est ÉNUMÉRÉE.

        LE COMPTE RESTE VISIBLE, SANS ÊTRE ÉCRIT : quatre gélules de devise se
        comptent d'un regard, et c'est exactement l'argument de la note sur les
        jetons ci-dessous. Le chiffre de 44 px ne faisait que le répéter en gros.

        LA CARTE PART AVEC LUI. Une carte borne un objet ; ce qui reste est une
        énumération à trois entrées, pas trois objets à comparer. Le surtitre et
        son signe suffisent à séparer les colonnes, et la page y gagne 385 px au
        téléphone (mesuré au DOM à 360 px : 1068 → 683).

        LES TROIS SIGNES RESTENT DISTINCTS, et une garde l'exige — voir
        `troisSectionsDeLaVitrine` : un icône ne vaut que par ce qu'il sépare, et
        les trois `dt` qui les portent sont ce que cette garde inspecte.
      */}
      <dl className="grid gap-x-6 gap-y-8 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.key} className="min-w-0">
            <dt className="eyebrow flex items-center gap-2.5 text-muted">
              <Icon name={fact.icone} size={16} className="text-accent-ink" />
              {t(`marketing.international.${fact.key}` as 'marketing.international.currencies')}
            </dt>
            <dd className="m-0 mt-4">
              {/*
                LE DÉTAIL EN JETONS, ET NON EN LISTE QUI SE REPLIE — la note
                d'origine reste vraie et ne dépendait pas de la carte. C'étaient
                des mots posés côte à côte, séparés par un écart : sur les pays,
                quatre noms plus « et 17 autres » se replient en deux lignes
                ragées où « Congo-Brazzaville Tchad » se lit comme une seule
                entrée. Une bordure par valeur rend le compte visible.

                `mt-auto` est parti avec la carte : il poussait le trait de
                séparation en bas pour aligner trois colonnes de hauteurs
                différentes. Sans surface ni trait, il n'y a plus rien à aligner
                — et trois listes qui commencent ensemble se comparent mieux que
                trois qui finissent ensemble.
              */}
              {fact.detail.length > 0 && (
                <ul className="flex flex-wrap gap-2">
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
          </div>
        ))}
      </dl>
    </Section>
  )
}
