import { Card } from '@/components/primitives/Card'
import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

/**
 * ═══ CE QUI TIENT LIEU DE PREUVE QUAND ON N'A PAS DE CLIENTS À CITER ═══
 *
 * La demande était « preuve sociale », et ce composant n'en est PAS une. Il
 * faut l'écrire ici, parce que c'est la première chose qu'un relecteur
 * cherchera : ce dépôt n'a ni témoignage, ni logo client, ni chiffre d'usage
 * qu'on puisse vérifier. Les inventer aurait été la solution évidente, et elle
 * est exclue pour la raison qui a déjà coûté un lot à la carte d'aperçu du
 * hero — quatre chiffres écrits à la main y démentaient le jeu servi à `/demo`,
 * à un clic de là. Un faux témoignage ne se corrige pas : il se découvre.
 *
 * CE QUI RESTE EST VÉRIFIABLE, ET C'EST TOUT L'INTÉRÊT. Les quatre engagements
 * ci-dessous sont des faits du produit, chacun opposable dans l'application
 * elle-même — l'essai sans carte, l'absence de commission, l'export intégral,
 * la séparation des droits. Un visiteur peut les mettre à l'épreuve le jour
 * même ; aucun témoignage ne permet cela.
 *
 * ILS ÉTAIENT DÉJÀ DITS, ET C'EST LE DÉFAUT QUE CETTE SECTION CORRIGE. Un dans
 * la mention sous les actions du hero, un dans le sous-titre des tarifs, deux
 * dans des réponses de la FAQ — c'est-à-dire dispersés sur toute la hauteur de
 * la page, et les deux derniers seulement pour qui déplie. Or ce sont les
 * quatre objections qu'on oppose à un logiciel de gestion locative, et elles se
 * posent AVANT le prix, pas après. Les grouper n'est pas les redire : c'est
 * leur donner l'endroit où elles servent.
 *
 * SA PLACE EST DONC DEVANT LA GRILLE DE PRIX, en temps `serre` — un appui, pas
 * une étape. On y passe, on n'y décide pas ; c'est la section suivante qui
 * demande une décision.
 */
const ENGAGEMENTS: { key: 'trial' | 'commission' | 'exportable' | 'rights'; icone: IconName }[] = [
  { key: 'trial', icone: 'clock' },
  { key: 'commission', icone: 'card' },
  { key: 'exportable', icone: 'download' },
  { key: 'rights', icone: 'lock' },
]

export function ProofBand() {
  const t = useT()

  return (
    <Section
      id="proof"
      tone="paper"
      rythme="serre"
      eyebrow={t('marketing.proof.eyebrow')}
      title={t('marketing.proof.title')}
    >
      {/* Des cartes ici, et non la règle graduée des deux sections en amont :
          ces quatre engagements ne s'enchaînent pas et ne se comptent pas — ils
          tiennent chacun seul, dans n'importe quel ordre. Une graduation leur
          inventerait une progression qui n'existe pas. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENGAGEMENTS.map(({ key, icone }) => (
          <Card as="li" flush elevation="e1" key={key} className="flex gap-4 p-5">
            {/*
              LE SIGNE EST À GAUCHE, ET C'EST UNE ÉCONOMIE MESURÉE. Empilé
              au-dessus du titre, il ajoutait 60 px par carte — pastille, plus
              l'écart qui la sépare du texte — soit 240 px sur la seule colonne
              du téléphone, pour une section qui est un APPUI. Posé dans la
              gouttière du texte, il ne coûte plus que sa propre largeur, qui
              était de toute façon perdue en marge.

              Sa valeur reste la teinte d'accent, jamais l'accent plein : la
              grille des fonctionnalités porte déjà six pastilles pleines, et
              deux systèmes de pastilles sur une même page se disputent le rang.
            */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent-border bg-accent-tint text-accent-ink">
              <Icon name={icone} size={18} />
            </span>
            {/* `div` et non `span` : un `<h3>` est du contenu de FLUX, et le
                modèle de contenu d'un `<span>` n'accepte que du phrasé. Le
                balisage serait invalide, et c'est le genre d'invalidité qui ne
                se voit sur aucune capture. */}
            <div className="min-w-0">
              <h3 className="title-m text-balance">
                {t(`marketing.proof.${key}.title` as 'marketing.proof.trial.title')}
              </h3>
              <p className="mt-2 text-body text-pretty text-muted">
                {t(`marketing.proof.${key}.body` as 'marketing.proof.trial.body')}
              </p>
            </div>
          </Card>
        ))}
      </ul>
    </Section>
  )
}
