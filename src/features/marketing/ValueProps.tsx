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
      {/*
        ═══ QUATRE CARTES DEVIENNENT UNE LIGNE QUI S'ACCUMULE ═══

        Elles étaient quatre surfaces blanches à filet d'accent, posées sur le
        gris de la section. Le filet avait été ajouté pour qu'on voie « une
        SÉRIE avant de lire » — c'était le bon diagnostic, et la carte était le
        mauvais support : une carte BORNE son contenu, elle dit « ceci est un
        objet complet ». Quatre objets complets côte à côte se lisent comme
        quatre constats séparés, alors que l'argument de cette section est
        précisément qu'ils S'ADDITIONNENT.

        Le trait continu le dit sans rien écrire. Une seule règle horizontale
        traverse les quatre entrées ; chaque numéro s'y pose comme une graduation.
        On lit une progression, puis on lit les phrases.

        LA SECTION Y PERD AUSSI SES SURFACES, ce qui n'est pas un effet de bord
        mais l'autre moitié du geste : la grille de fonctionnalités qui suit
        IMMÉDIATEMENT est faite de cartes, et c'est elle qui répond. Deux
        rangées de cartes à la suite faisaient lire le problème et la réponse
        avec la même insistance.
      */}
      {/* `gap-y-8` ET NON `gap-y-10` : la pastille déborde de 16 px au-dessus
          de son trait, il en faut donc au moins autant entre deux entrées
          empilées. Trente-deux en laissent le double, et rendent 24 px au
          téléphone sur les quatre frictions, 16 sur les trois étapes — les deux
          listes graduées partagent cet écart, comme elles partagent tout le
          reste de leur forme. */}
      <ol className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {KEYS.map((key, index) => (
          <li key={key} className="relative border-t border-border pt-9">
            {/*
              LE NUMÉRO EST LE REPÈRE, PAS UNE ÉTIQUETTE — la note d'origine
              reste vraie et ne dépend pas du support. Ce qui change est qu'il
              se pose SUR le trait : une graduation n'est pas un titre, elle
              marque un endroit sur une échelle.

              `-top-4` pour une pastille de 32 px : elle est à cheval sur la
              règle, moitié au-dessus, moitié en dessous. `numeric` garde les
              chiffres à chasse fixe, sans quoi « 01 » et « 04 » ne se centrent
              pas pareil dans leur rond.
            */}
            <span
              aria-hidden="true"
              className="numeric absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full bg-accent text-caption font-medium text-on-accent"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="text-body-l text-pretty text-ink">
              {t(`marketing.value.before.${key}` as 'marketing.value.before.one')}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
