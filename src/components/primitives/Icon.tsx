import type { SVGProps } from 'react'
import { cn } from '@/lib/cn'

/**
 * Jeu d'icônes maison, une seule grammaire de tracé :
 * grille 24, contour seul, `stroke-width` 1.7, extrémités arrondies.
 * Pas d'emoji, pas de mélange plein/contour au même niveau de hiérarchie.
 */
const PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="10" height="18" rx="1.6" />
      <path d="M14 8h6v13H4" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3M17 12h0M17 16h0" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6.5 14.5h4" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 18a8 8 0 1116 0" />
      <path d="M12 18l4.2-4.6" />
      <circle cx="12" cy="18" r="1.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="2" />
      <path d="M9 4V2.5h6V4" />
      <path d="M8.5 11l2 2 4-4" />
      <path d="M8.5 17h7" />
    </>
  ),
  wrench: (
    <>
      <circle cx="7" cy="17" r="3" />
      <path d="M9.2 14.8L19 5M15.5 4.5h4.5V9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8l7.5 3v6c0 4.2-3 8-7.5 9.4C7.5 19.8 4.5 16 4.5 11.8v-6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M3.5 20c0-3.2 2.5-5.4 5.5-5.4s5.5 2.2 5.5 5.4" />
      <path d="M16 5.4a3.3 3.3 0 010 5.2M18 20c0-2.6-1-4.4-2.6-5.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z" />
      <path d="M10 19a2.2 2.2 0 004 0" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2v.2M12 11.5v4.3" />
    </>
  ),
  layers: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
      <path d="M10.5 18.6h3" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 8.5h19" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h10M4 18h16" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.6 2.6L16 9.4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.6L21 19.4H3z" />
      <path d="M12 9.6v4M12 16.4v.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8V12l3.4 2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M5.5 9l6.5 6.5L18.5 9" />,
  chevronRight: <path d="M9 5.5L15.5 12 9 18.5" />,
  chevronLeft: <path d="M15 5.5L8.5 12 15 18.5" />,
  arrowRight: <path d="M4 12h15.5M13.5 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17L17 7M8.5 7H17v8.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.9A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3.3 4.1M6.4 7.6A16.6 16.6 0 002.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
  droplet: <path d="M12 3.2s6 6 6 9.6a6 6 0 11-12 0c0-3.6 6-9.6 6-9.6z" />,
  bolt: <path d="M13.2 2.8L5 13.4h5.6L10 21.2l8.2-10.6h-5.6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 10.5h17.6M3.2 14h17.6" />
      <path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2.4" />
      <path d="M8 10V7.6a4 4 0 018 0V10" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <path d="M3 6.6l9 6.2 9-6.2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.4M15.5 12v2.4" />
    </>
  ),
  download: <path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: <path d="M12 3l2.2 5.9L20 11l-5.8 2.1L12 19l-2.2-5.9L4 11l5.8-2.1z" />,
  trendUp: <path d="M3.5 16.5l6-6 4 4 7-7.5M15 7h5.5v5.5" />,
  file: (
    <>
      <path d="M13.5 3.5H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V9z" />
      <path d="M13.5 3.5V9H19" />
    </>
  ),
  logout: <path d="M15 7.5V5.4a2 2 0 00-2-2H6a2 2 0 00-2 2v13.2a2 2 0 002 2h7a2 2 0 002-2V16.5M10.5 12h10M17.5 8.5l3 3.5-3 3.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.3M12 19.1v2.3M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.6 12h2.3M19.1 12h2.3M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </>
  ),
  // Croissant d'un seul tracé : une lune « pleine + masque » aurait demandé un
  // remplissage, or ce jeu est en contour seul.
  moon: <path d="M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z" />,
} as const

export type IconName = keyof typeof PATHS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Taille en pixels. Aligné sur l'échelle : 14 / 16 / 20 / 24. */
  size?: number
}

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      {PATHS[name]}
    </svg>
  )
}
