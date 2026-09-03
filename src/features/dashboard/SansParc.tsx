import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/primitives/DataTable'
import { useT } from '@/i18n/I18nProvider'
import { DemanderLAcces, RejoindreUnParc } from './Onboarding'

/**
 * UN COMPTE QUI N'APPARTIENT À AUCUN PARC.
 *
 * ═══ CE QU'IL VOYAIT, ET C'EST GRAVE ═══
 *
 * `PortfolioProvider` monte le jeu de démonstration comme état INITIAL et ne
 * demande le serveur que si un `parkId` existe. Sans adhésion, ce jeu restait
 * donc à l'écran, SOUS `/app`, sans rien qui le dise : trois immeubles, douze
 * unités, deux millions neuf cent mille francs à percevoir, des cautions à
 * arbitrer. Rien de tout cela n'existe.
 *
 * Signalé sur la production par un gestionnaire fraîchement inscrit : « je vois
 * des données que je n'ai pas insérées ». L'en-tête du fournisseur assumait ce
 * repli — « sans parc, le jeu de démonstration reste servi » — et c'est juste
 * sous `/demo`, dont c'est le propos. Sous `/app`, l'adresse promet un espace
 * réel : la même donnée y devient un mensonge.
 *
 * ═══ ET IL N'AVAIT AUCUNE SORTIE ═══
 *
 * La carte « rejoindre un parc par code » vit sur « Prise en main et droits »,
 * réservée au PROPRIÉTAIRE. Un gestionnaire ou un locataire sans parc ne
 * pouvait donc ni voir ses vraies données — il n'en a pas — ni saisir le code
 * qui lui en donnerait. Elle est reprise ici TELLE QUELLE, sans copie : c'est
 * le même geste, avec le même appel et les mêmes refus.
 */
export function SansParc() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.noPark.title')} description={t('app.noPark.subtitle')} />
      {/* `level={2}` : le titre de page tient déjà le premier niveau. */}
      <EmptyState icon="info" level={2} title={t('app.noPark.body')} body={t('app.noPark.hint')} />
      <RejoindreUnParc />
      {/* ET LA SORTIE DE CEUX QUI N'ONT PAS DE CODE. La carte du dessus
          suppose qu'on vous en ait remis un ; ce compte-ci est peut-être
          arrivé avant, ou son propriétaire ne sait pas qu'il doit en
          émettre un. Sans elle, l'écran restait une impasse pour lui. */}
      <DemanderLAcces />
    </>
  )
}
