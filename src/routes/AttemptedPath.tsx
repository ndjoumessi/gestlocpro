import { useLocation } from 'react-router-dom'
import { useT } from '@/i18n/I18nProvider'

/**
 * DÉTACHÉ DE `NotFound.tsx`, pour la même raison que `PageHeader.tsx` a été
 * détaché d'`AppShell.tsx`.
 *
 * `routes/NotFound.tsx` (public) et `routes/NotFoundInApp.tsx` (réservé à
 * l'espace applicatif) partageaient ce composant en le import-ant l'un de
 * chez l'autre. La règle de fuite de `mesure-ui.mjs` — un module réservé à
 * l'application ne doit JAMAIS apparaître dans le paquet impatient — ne peut
 * se vérifier au niveau du FICHIER que si chaque fichier n'a qu'un public.
 * Un fichier qui sert les deux côtés à la fois rendrait la règle aveugle à
 * elle-même : elle devrait soit ignorer ce fichier par exception nommée, soit
 * le prendre pour un faux positif permanent. Le séparer une fois coûte moins
 * que de maintenir cette exception pour toujours.
 */

/** Longueur au-delà de laquelle l'adresse fautive est coupée. */
const MAX_PATH = 120

/**
 * Rappelle l'adresse demandée.
 *
 * Sans elle, l'utilisateur ne peut ni corriger sa saisie ni signaler utilement
 * le lien mort. Elle est coupée, car rien n'empêche une adresse arbitrairement
 * longue de repousser les boutons hors de l'écran ; React échappe le texte,
 * l'afficher est donc sans risque.
 */
export function AttemptedPath() {
  const t = useT()
  const { pathname } = useLocation()
  const shown = pathname.length > MAX_PATH ? `${pathname.slice(0, MAX_PATH)}…` : pathname

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-body text-muted">{t('notFound.attempted')}</p>
      <p className="mt-1 text-body break-all text-ink">{shown}</p>
    </div>
  )
}
