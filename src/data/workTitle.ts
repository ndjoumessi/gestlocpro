import type { MessageKey } from '@/i18n/I18nProvider'
import type { WorkOrder } from './portfolio'

/**
 * Intitulé d'un signalement, quelle que soit sa provenance.
 *
 * Deux natures cohabitent, et c'est assumé :
 *
 *  - le jeu de démonstration porte une **clé** (`sinkLeak`), parce qu'il est
 *    servi dans les deux langues et n'est la saisie de personne ;
 *  - la donnée réelle porte un **texte libre**, écrit par le locataire qui
 *    signale — et une saisie ne se traduit jamais.
 *
 * Sans ce point de passage, chaque écran rend `t('app.works.samples.' +
 * work.titleKey)` : dès qu'un signalement arrive du serveur, `titleKey` vaut
 * `undefined` et l'utilisateur lit `app.works.samples.undefined`. Le défaut
 * compile parfaitement, ce qui est exactement pourquoi il faut le fermer ici.
 */
export function workTitle(
  work: Pick<WorkOrder, 'title' | 'titleKey'>,
  t: (key: MessageKey) => string,
): string {
  if (work.title) return work.title
  if (work.titleKey) return t(`app.works.samples.${work.titleKey}` as 'app.works.samples.sinkLeak')
  // Ni l'un ni l'autre : la donnée est abîmée. On rend une chaîne vide plutôt
  // qu'une clé brute — l'écran reste lisible, et le manque se voit.
  return ''
}
