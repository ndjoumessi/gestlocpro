import { Section } from '@/components/layout/Section'
import { Card } from '@/components/primitives/Card'
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
        {/* `as="li"` : ces cartes sont les items d'un `<ol>`, et un `<div>`
              enfant direct d'`<ol>` est du HTML invalide autant qu'une liste
              sans items pour un lecteur d'écran. */}
        {KEYS.map((key, index) => (
          <Card
            as="li"
            flush
            elevation="e1"
            key={key}
            /*
              UN FILET D'ACCENT EN TÊTE DE CARTE.

              Quatre cartes blanches sur un gris clair, portant chacune une
              phrase et un petit label bleu, se lisaient comme quatre fragments
              posés là. Rien ne les reliait, rien ne disait qu'elles s'ajoutent.
              Le filet donne à la rangée sa trame : on voit une SÉRIE avant de
              lire, ce qui est exactement ce qu'une énumération de frictions doit
              produire — l'accumulation est l'argument.

              `overflow-hidden` : sans lui le filet dépasse des coins arrondis de
              la carte, et ce sont eux qui portent la forme.
            */
            className="flex flex-col overflow-hidden p-0"
          >
            <span aria-hidden="true" className="block h-1 bg-accent" />
            <span className="flex flex-1 flex-col p-6">
              {/*
                LE NUMÉRO EST LE REPÈRE, PAS UNE ÉTIQUETTE.

                Il était en `text-caps` — douze pixels, la taille des surtitres,
                donc le rang de ce qui NOMME une section. Or ces quatre chiffres
                ne nomment rien : ils comptent, et c'est toute leur fonction. À
                `text-kpi` ils prennent le rang qui leur revient, celui d'un
                repère qu'on parcourt du regard avant de lire.

                `text-accent-ink` et non `text-accent` : c'est du TEXTE sur une
                surface claire, et le jeton d'action ne tient que 5,17:1 quand
                celui-ci est fait pour être lu.
              */}
              <span
                aria-hidden="true"
                className="numeric text-kpi leading-none font-medium text-accent-ink"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-4 text-body-l text-pretty text-ink">
                {t(`marketing.value.before.${key}` as 'marketing.value.before.one')}
              </p>
            </span>
          </Card>
        ))}
      </ol>
    </Section>
  )
}
