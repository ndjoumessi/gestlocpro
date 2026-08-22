import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import { useT } from '@/i18n/I18nProvider'

export type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info'

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
  info: { classes: 'bg-gold-tint text-gold-ink border-gold-border', icon: 'info' },
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

const PAYMENT_TONES: Record<PaymentStatus, StatusTone> = {
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
