import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

/**
 * ═══ LA PAGE DISAIT CE QUE LE PRODUIT FAIT, JAMAIS CE QU'IL DEMANDE ═══
 *
 * Sept sections, et pas une ne répondait à la question que se pose un
 * propriétaire qui tient déjà son parc dans un tableur : COMBIEN ÇA ME COÛTE DE
 * BASCULER. La grille des fonctionnalités décrit un régime de croisière ; les
 * tarifs chiffrent l'abonnement ; le portail locataire suppose des locataires
 * déjà rattachés. Le travail de reprise — décrire le parc, inviter, puis
 * seulement exploiter — n'était nommé nulle part, et c'est précisément
 * l'objection qui fait refermer l'onglet.
 *
 * TROIS ÉTAPES, ET LA PREMIÈRE EST LA SEULE QUI COÛTE. Le sous-titre le dit
 * sans le maquiller : la saisie initiale est du travail, le reste est du
 * quotidien. Une page de vente qui prétendrait le contraire serait démentie au
 * premier écran de création d'unité.
 *
 * ELLE SUIT LES FONCTIONNALITÉS, EN TEMPS `suite`. La grille nomme ce que le
 * produit tient ; celle-ci dit dans quel ordre on y arrive. Les séparer d'une
 * étape pleine ferait de la mise en route un sujet à part, alors qu'elle est la
 * MÊME phrase, prise par l'autre bout.
 *
 * PAS DE CARTES, ET C'EST LA MÊME RAISON QUE POUR LES QUATRE FRICTIONS : une
 * carte borne un objet complet, or ces trois étapes s'enchaînent. Le trait
 * gradué les relie, et il est déjà le vocabulaire de la section « Le problème »
 * — la page pose ses ruptures sur une règle, elle pose sa mise en route sur la
 * même.
 */
const ETAPES: { key: 'park' | 'invite' | 'run'; icone: IconName }[] = [
  { key: 'park', icone: 'building' },
  { key: 'invite', icone: 'key' },
  { key: 'run', icone: 'card' },
]

export function HowItWorks() {
  const t = useT()

  return (
    <Section
      id="how"
      rythme="suite"
      eyebrow={t('marketing.how.eyebrow')}
      title={t('marketing.how.title')}
      description={t('marketing.how.subtitle')}
    >
      <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {ETAPES.map(({ key, icone }, index) => (
          <li key={key} className="relative border-t border-border pt-9">
            {/* Le numéro se pose SUR le trait, comme les quatre frictions :
                une graduation marque un endroit sur une échelle, elle ne titre
                rien. `numeric` garde la chasse fixe, sans quoi « 01 » et « 03 »
                ne se centrent pas pareil dans leur rond. */}
            <span
              aria-hidden="true"
              className="numeric absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full bg-accent text-caption font-medium text-on-accent"
            >
              {String(index + 1).padStart(2, '0')}
            </span>

            <h3 className="flex items-center gap-2.5 title-l text-balance">
              {/* Le signe est SUBORDONNÉ au titre ici, et non porté par une
                  pastille pleine comme dans la grille des fonctionnalités : six
                  ronds bleus y donnent une trame à parcourir, trois de plus
                  entreraient en concurrence avec les numéros, qui sont déjà le
                  repère de cette section. Un seul système de repère par
                  section. */}
              <Icon name={icone} size={18} className="shrink-0 text-accent-ink" />
              {t(`marketing.how.${key}.title` as 'marketing.how.park.title')}
            </h3>
            <p className="mt-3 text-body text-pretty text-muted">
              {t(`marketing.how.${key}.body` as 'marketing.how.park.body')}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
