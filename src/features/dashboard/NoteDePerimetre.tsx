import { Notice } from '@/components/primitives/Notice'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * VOTRE VUE EST BORNÉE — la note qui suit les CHIFFRES.
 *
 * ═══ POURQUOI ELLE EXISTE ═══
 *
 * Le périmètre d'un gestionnaire est strict : il ne voit ni les immeubles ni les
 * logements qu'on ne lui a pas confiés, ni leurs chiffres. Il lit donc des
 * totaux entièrement COHÉRENTS qui ne portent que sur sa part.
 *
 * Le risque n'est pas qu'il voie trop, c'est qu'il MÉSINTERPRÈTE ce qu'il voit :
 * « le parc a encaissé 1,2 million » dit à un propriétaire qui en attend le
 * double. Un chiffre juste sur un périmètre inconnu est plus dangereux qu'un
 * chiffre absent, parce que rien en lui n'invite à le vérifier.
 *
 * ═══ ELLE SUIT LES TOTAUX, ET NON LES ÉCRANS ═══
 *
 * Le premier lot ne la posait que sur le tableau de bord, et le motif tenait :
 * « c'est là que vivent les chiffres consolidés, donc là que la mélecture
 * coûte ». Il était incomplet. Les cautions additionnent des dépôts, les
 * paiements additionnent des loyers, les relevés additionnent des
 * refacturations — trois totaux de plus, plus étroits mais additionnés eux
 * aussi, et chacun se cite dans un compte rendu au propriétaire.
 *
 * LA RÈGLE EST DONC : partout où un chiffre AGRÈGE plusieurs logements. Une
 * liste ne l'appelle pas — on y voit ce qu'on gère, ligne par ligne, et rien
 * n'y prétend au total.
 *
 * ═══ LE FAIT, JAMAIS SON ÉTENDUE ═══
 *
 * `scoped` est un booléen, et le reste. Pas de compte — « 2 sur 3 » dirait qu'un
 * troisième immeuble existe —, pas de nom, pas de chiffre de ce qui est caché.
 * C'est la ligne exacte que le périmètre strict autorise : cacher la DONNÉE sans
 * cacher le FAIT, parce que le fait est ce qui l'empêche de lire ses propres
 * chiffres de travers.
 *
 * ═══ CE QU'ELLE NE FAIT PAS ═══
 *
 * Elle ne dit pas QUOI FAIRE. « Demandez au propriétaire » serait une consigne,
 * et le produit n'a aucun écran où un gestionnaire réclame un immeuble.
 *
 * Et elle ne paraît pas chez le PROPRIÉTAIRE : ses chiffres sont complets. Ce
 * qu'il a besoin de savoir — qui voit quoi — est nommé personne par personne
 * dans le registre des accès, et le répéter en bandeau sur ses indicateurs
 * ajouterait du bruit à un écran qui ne ment pas.
 */
export function NoteDePerimetre({ className }: { className?: string }) {
  const t = useT()
  const { scoped, buildings } = usePortfolio()
  if (!scoped) return null
  /*
    ZÉRO N'EST PAS « UNE PARTIE ».

    `scoped` dit qu'on est borné, jamais à quoi : un gestionnaire dont rien
    n'est confié le porte comme celui qui tient deux immeubles sur trois. La
    phrase d'origine lui affirmait donc qu'il gère « une partie de ce parc »
    dans l'état de NAISSANCE de toute adhésion — celui où il ne gère rien.

    LA RÈGLE DU FAIT SANS L'ÉTENDUE TIENT. Dire « rien ne vous a été confié »
    ne révèle pas un immeuble de plus : c'est un fait sur SON périmètre, qu'il
    constate déjà en regardant des écrans vides. « 2 sur 3 », lui, dirait qu'un
    troisième existe — et reste refusé.
  */
  /*
    DEUX RETOURS ET NON UN TERNAIRE DANS L'APPEL, et ce n'est pas du style.
    `notes-conditionnelles.mjs` lit ces clés STATIQUEMENT sur le `<Notice>` qui
    les porte. Écrit `t(cond ? 'a' : 'b')`, il ne voyait plus aucune des deux et
    a refusé — « DÉCLARATION PÉRIMÉE : n'est portée par aucun <Notice> ». La
    porte avait raison : une clé qu'elle ne voit plus est une note qu'elle ne
    garde plus.
  */
  if (buildings.length === 0) {
    return (
      <Notice tone="neutral" icon="shield" className={className}>
        {t('app.dashboard.scopedNoticeNothing')}
      </Notice>
    )
  }
  return (
    <Notice tone="neutral" icon="shield" className={className}>
      {t('app.dashboard.scopedNotice')}
    </Notice>
  )
}
