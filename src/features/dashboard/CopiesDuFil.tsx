import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import type { WorkOrder } from '@/data/portfolio'

/**
 * « LE COURRIEL EST-IL PARTI ? », SUR LES DEUX ÉCRANS QUI PORTENT LE FIL.
 *
 * ═══ POURQUOI UN COMPOSANT, ET NON DEUX FOIS LA MÊME PHRASE ═══
 *
 * Le dossier du logement et l'écran des travaux montrent le MÊME fil, avec le
 * même regroupement et le même ordre — « un échange n'a pas deux histoires
 * selon l'écran qui l'ouvre ». Sa trace d'envoi non plus, et deux copies de
 * cette logique divergeraient : ce dépôt a déjà payé exactement ce silence
 * ailleurs, et une garde y compte les conversions de date pour cette raison.
 *
 * ═══ TROIS ÉTATS, ET LE TROISIÈME PORTE LE PLUS ═══
 *
 * Tout remis, remis en partie, et RIEN TENTÉ. Le dernier n'est pas l'absence
 * des deux autres : un fil sans copie est le cas normal d'un chantier ouvert
 * par le bailleur — personne à prévenir — et « 0 remise » ferait lire un échec
 * dans un silence. La ligne ne paraît alors pas du tout.
 *
 * Deux phrases et non une : « 2 copies remises » quand tout est parti, « 1 sur
 * 3 tentées » sinon. La seconde n'est pas la première avec un chiffre en plus —
 * elle dit un ÉCART, et c'est ce que le lecteur doit voir sans compter.
 *
 * ═══ CE QUE LA LIGNE NE DIT PAS ═══
 *
 * Aucune adresse. Le serveur ne les rend pas — elles n'ajoutent rien à « a-t-il
 * été prévenu ? » et sortiraient de l'espace de qui les lit — et l'écran n'en
 * invente pas. Le champ est d'ailleurs ABSENT pour un locataire : un journal
 * d'envoi est une question de gestion.
 */
export function CopiesDuFil({
  copies,
  className,
}: {
  copies: WorkOrder['emailCopies']
  className?: string
}) {
  const t = useT()
  const d = useDates()
  if (!copies || copies.sent === 0) return null

  /* `partiesDeDateISO` et non un découpage à la main : la conversion ISO ne
     s'écrit qu'une fois dans ce dépôt, et une garde le compte. */
  const date = copies.lastAttemptAt ? d.fullDate(partiesDeDateISO(copies.lastAttemptAt)) : ''
  return (
    <span className={className ?? 'text-caption text-muted'}>
      {copies.delivered === copies.sent
        ? t('app.works.copiesDelivered', { count: copies.delivered, date })
        : t('app.works.copiesPartial', {
            count: copies.delivered,
            total: copies.sent,
            date,
          })}
    </span>
  )
}
