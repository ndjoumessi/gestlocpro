import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import { useT } from '@/i18n/I18nProvider'

export type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info' | 'onDark'

/**
 * Pastille de statut.
 *
 * Règle `color-not-only` : chaque statut porte **une couleur, une icône et un
 * libellé**. Un daltonien lit l'icône, un lecteur d'écran lit le texte, et la
 * pastille reste compréhensible en impression noir et blanc.
 */
const TONES: Record<StatusTone, { classes: string; icon: IconName }> = {
  ok: { classes: 'bg-ok-tint text-ok border-ok-border', icon: 'checkCircle' },
  warn: { classes: 'bg-warn-tint text-warn border-warn-border', icon: 'clock' },
  danger: { classes: 'bg-danger-tint text-danger border-danger-border', icon: 'alert' },
  neutral: { classes: 'bg-neutral-tint text-neutral border-neutral-border', icon: 'info' },
  info: { classes: 'bg-accent-tint text-accent-ink border-accent-border', icon: 'info' },
  /**
   * LE TON DES PANNEAUX FIGÉS, et il manquait.
   *
   * Les cinq tons ci-dessus posent tous un lavis et une encre qui BASCULENT
   * avec le thème. Sous `.on-dark` — la carte sombre du tableau de bord, la
   * barre latérale — le fond, lui, est FIGÉ : `bg-ink` vaut #131a22 dans les
   * deux thèmes. Mesuré sur la répartition du parc : la pastille neutre rendait
   * un lavis à #f1f3f8 en clair (14:1, franche) et à #0d1116 en sombre —
   * 1,07:1 CONTRE SON PROPRE FOND. Elle disparaissait, et sa bordure avec elle
   * (1,37 pour 3:1 exigés d'une limite visuelle). Le texte restait lisible :
   * c'est la signature « deux échecs opposés sur un même fond », et aucune
   * garde ne couvrait ce site.
   *
   * Les trois jetons employés ici sont ceux que `.on-dark` fige lui-même, donc
   * la pastille rend la même chose quel que soit le thème — ce qui est
   * exactement ce qu'on attend d'un élément posé sur un fond qui ne bouge pas.
   */
  onDark: {
    classes: 'bg-on-dark-active text-on-dark border-on-dark-border',
    icon: 'info',
  },
}

export interface StatusPillProps {
  tone: StatusTone
  children: React.ReactNode
  /** Remplace l'icône par défaut du ton. */
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
}

export function StatusPill({ tone, children, icon, size = 'md', className }: StatusPillProps) {
  const config = TONES[tone]
  return (
    <span
      /* `data-ton` : un TON doit être interrogeable autrement que par sa
         peinture. Sans lui, un cas qui vérifie qu'une pastille ne rend pas un
         verdict doit inspecter `bg-warn-tint` — une assertion qui rougit sur un
         renommage d'utilitaire et qui passe au vert le jour où le même verdict
         revient sous une autre classe. Même idiome que `data-jauge` sur la
         grille des paiements et `data-etat` sur les indicateurs. */
      data-ton={tone}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        // Les deux tailles partagent le plancher de 12px : ce qui distingue la
        // pastille compacte n'est pas un texte plus petit — un statut se lit ou
        // ne sert à rien — mais son rembourrage et son icône. `text-label`
        // plutôt que `text-caps` : le libellé est en sans, il n'a que
        // faire de l'interlettrage d'un surtitre en capitales.
        size === 'sm' ? 'px-2 py-0.5 text-label' : 'px-2.5 py-1 text-label',
        config.classes,
        className,
      )}
    >
      <Icon name={icon ?? config.icon} size={size === 'sm' ? 11 : 13} />
      {children}
    </span>
  )
}

/** Statuts de paiement du domaine, traduits et tonalisés au même endroit. */
export type PaymentStatus = 'paid' | 'partial' | 'overdue' | 'vacant' | 'pending'

/**
 * EXPORTÉE, et pour une raison qui vaut mieux que la commodité.
 *
 * La carte du loyer de l'espace locataire porte le statut de paiement dans son
 * `etat`, qui attend un TON et non un statut. Le déduire chez elle recopierait
 * cette table — et le jour où « bail qui démarre » cesserait d'être `info`, les
 * deux se contrediraient sur le même écran, la pastille d'une ligne disant
 * autre chose que la bordure de la carte au-dessus.
 *
 * Une table de correspondance vit à un seul endroit ou elle diverge.
 */
export const PAYMENT_TONES: Record<PaymentStatus, StatusTone> = {
  paid: 'ok',
  partial: 'warn',
  overdue: 'danger',
  vacant: 'neutral',
  // Bail qui démarre : rien n'est encore dû, donc ni succès ni alerte.
  pending: 'info',
}

export function PaymentStatusPill({
  status,
  size,
}: {
  status: PaymentStatus
  size?: 'sm' | 'md'
}) {
  const t = useT()
  return (
    <StatusPill tone={PAYMENT_TONES[status]} size={size}>
      {t(`status.${status}` as 'status.paid')}
    </StatusPill>
  )
}

/**
 * LA JAUGE D'ÉTAT D'UN POSTE — la pastille de la grille des paiements.
 *
 * `StatusPill` ne convient pas ici et c'est une question de place, non de
 * goût : la grille pose TROIS états par cellule, sur douze mois et dix
 * lignes. Cent quatre-vingts pastilles nommées et bordées ne tiennent pas
 * dans une colonne de 70 px, et l'écran vaut par sa densité.
 *
 * Ce qui est partagé avec `StatusPill`, en revanche, c'est la règle : un
 * statut ne se distingue jamais par la seule couleur. Ici la seconde
 * dimension est le REMPLISSAGE — voir `.jauge` dans `tokens.css` pour la
 * mesure qui a écarté les glyphes.
 *
 * UN SEUL COMPOSANT POUR LA GRILLE ET POUR SA LÉGENDE, et c'est le point.
 * Une légende corrigée sur des cellules qui ne le sont pas est pire que le
 * défaut d'origine : elle donne une clé qui n'ouvre rien. Les deux appellent
 * la même fonction, donc les deux portent la même forme, par construction et
 * non par vigilance.
 *
 * `aria-hidden` : la jauge est muette, et elle doit l'être. Le nom accessible
 * est porté une fois par la cellule qui la contient — « Mars 2026 · Loyer
 * soldé, Eau soldé, Électricité soldé ». Trois annonces de plus par cellule
 * feraient soixante annonces par ligne pour la même information.
 *
 * `data-jauge` n'est pas décoratif : c'est par lui que la garde
 * `couleur-non-seule` retrouve les sites à inspecter et COMPTE ce qu'elle a
 * regardé. Le retirer d'un des deux sites fait chuter le compte et arrête la
 * porte.
 */
export type EtatDePoste = 'paid' | 'partial' | 'overdue'

/* « impayé » n'a pas de classe de remplissage : l'anneau nu EST son état, et
   `.jauge` le rend déjà. Voir `tokens.css`. */
const JAUGES: Record<EtatDePoste, string> = {
  paid: 'jauge-pleine text-ok',
  partial: 'jauge-demie text-warn',
  overdue: 'text-danger',
}

export function JaugeDePoste({ etat }: { etat: EtatDePoste }) {
  return <span aria-hidden="true" data-jauge={etat} className={cn('jauge', JAUGES[etat])} />
}
