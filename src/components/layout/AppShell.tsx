import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/primitives/Logo'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { IconButton } from '@/components/primitives/Button'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useT } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'

/* -------------------------------------------------------------------------- */
/* Rôle actif — pilote ce que la barre latérale montre et ce que les écrans
   autorisent. Repris du sélecteur de profil de la maquette.                   */
/* -------------------------------------------------------------------------- */

interface RoleContextValue {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextValue>({ role: 'owner', setRole: () => {} })

export function useRole() {
  return useContext(RoleContext)
}

/* -------------------------------------------------------------------------- */

interface NavItem {
  to: string
  labelKey: string
  icon: IconName
  badge?: { value: string; tone: 'danger' | 'onDark' }
  /** Rôles auxquels l'entrée est proposée. */
  roles?: Role[]
}

const SECTIONS: { headingKey: string; items: NavItem[] }[] = [
  {
    headingKey: 'nav.sectionSteering',
    items: [
      { to: '/app', labelKey: 'nav.dashboard', icon: 'grid' },
      { to: '/app/parc', labelKey: 'nav.portfolio', icon: 'building', roles: ['owner', 'manager'] },
    ],
  },
  {
    headingKey: 'nav.sectionOperations',
    items: [
      {
        to: '/app/paiements',
        labelKey: 'nav.payments',
        icon: 'card',
        badge: { value: '3', tone: 'danger' },
      },
      { to: '/app/releves', labelKey: 'nav.meters', icon: 'gauge', roles: ['owner', 'manager'] },
      { to: '/app/etats-des-lieux', labelKey: 'nav.inspections', icon: 'clipboard' },
      { to: '/app/travaux', labelKey: 'nav.works', icon: 'wrench' },
      { to: '/app/cautions', labelKey: 'nav.deposits', icon: 'shield', roles: ['owner', 'manager'] },
    ],
  },
  {
    headingKey: 'nav.sectionAdmin',
    items: [
      { to: '/app/locataires', labelKey: 'nav.tenants', icon: 'users', roles: ['owner', 'manager'] },
      {
        to: '/app/signalements',
        labelKey: 'nav.alerts',
        icon: 'bell',
        badge: { value: '2', tone: 'onDark' },
      },
      { to: '/app/onboarding', labelKey: 'nav.onboarding', icon: 'info', roles: ['owner'] },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  { to: '/app/portail', labelKey: 'nav.tenantPortal', icon: 'monitor' },
  { to: '/app/systeme', labelKey: 'nav.system', icon: 'layers' },
]

export function AppShell() {
  const t = useT()
  const location = useLocation()
  const [role, setRole] = useState<Role>('owner')
  const [railed, setRailed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // La navigation mobile se referme au changement de page : sans cela, le
  // panneau reste ouvert par-dessus l'écran qu'on vient de demander.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  // Le tiroir n'existe qu'en deçà de `lg`. Sans cette fermeture, un passage en
  // grand écran laisserait l'état ouvert : l'arrière-plan resterait neutralisé
  // alors que plus rien ne le recouvre.
  useEffect(() => {
    if (!drawerOpen) return
    const large = window.matchMedia('(min-width: 64rem)')
    const onChange = () => large.matches && setDrawerOpen(false)
    onChange()
    large.addEventListener('change', onChange)
    return () => large.removeEventListener('change', onChange)
  }, [drawerOpen])

  /**
   * Le tiroir se comportait comme une fenêtre modale sans en avoir les
   * obligations : le focus restait sur le bouton d'ouverture, et sept éléments
   * de la page restaient atteignables au clavier derrière l'assombrissement.
   * Un utilisateur au clavier tabulait donc dans du contenu qu'il ne voyait
   * pas.
   *
   * `inert` sur le contenu retire d'un coup tout l'arrière-plan du parcours de
   * tabulation — plus sûr qu'un piège à focus écrit à la main, qui doit
   * énumérer les éléments focalisables et se trompe dès qu'un composant en
   * ajoute un.
   */
  useEffect(() => {
    if (!drawerOpen) return

    const declencheur = document.activeElement as HTMLElement | null
    const contenu = contentRef.current
    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    contenu?.setAttribute('inert', '')
    drawerRef.current?.focus()

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      contenu?.removeAttribute('inert')
      document.removeEventListener('keydown', onKey)
      // Rendu au bouton d'ouverture : refermer ne doit pas laisser le focus
      // retomber sur le corps de la page, d'où l'on repartirait du début.
      declencheur?.focus()
    }
  }, [drawerOpen])

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <div className="flex min-h-dvh items-stretch">
        <Sidebar
          role={role}
          setRole={setRole}
          railed={railed}
          onToggleRail={() => setRailed((v) => !v)}
          className="hidden lg:flex"
        />

        {drawerOpen && (
          <>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 cursor-default bg-ink/45 backdrop-blur-[2px] lg:hidden"
              style={{ zIndex: 'var(--z-overlay)' }}
            />
            <Sidebar
              role={role}
              setRole={setRole}
              railed={false}
              onToggleRail={() => setDrawerOpen(false)}
              className="fixed inset-y-0 left-0 flex w-72 lg:hidden"
              style={{ zIndex: 'var(--z-overlay)' }}
              dialogLabel={t('nav.primaryNav')}
              innerRef={drawerRef}
            />
          </>
        )}

        <div ref={contentRef} className="flex min-w-0 flex-1 flex-col bg-paper">
          <Topbar onOpenDrawer={() => setDrawerOpen(true)} />
          <main id="main" className="animate-rise flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </RoleContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */

function Sidebar({
  role,
  setRole,
  railed,
  onToggleRail,
  className,
  style,
  dialogLabel,
  innerRef,
}: {
  role: Role
  setRole: (role: Role) => void
  railed: boolean
  onToggleRail: () => void
  className?: string
  style?: React.CSSProperties
  /**
   * Renseigné pour la variante tiroir. Elle assombrit la page et bloque le
   * défilement : c'est une fenêtre modale, elle doit donc le dire aux
   * technologies d'assistance et non seulement le paraître.
   */
  dialogLabel?: string
  innerRef?: Ref<HTMLElement>
}) {
  const t = useT()
  const wide = !railed

  const profiles: { value: Role; name: string }[] = [
    { value: 'owner', name: `${t('roles.owner.name')} · Arsène N.` },
    { value: 'manager', name: `${t('roles.manager.name')} · Diane F.` },
    { value: 'tenant', name: `${t('roles.tenant.name')} · Charles N.` },
  ]

  return (
    <aside
      ref={innerRef}
      // `tabIndex={-1}` sans quoi le conteneur ne peut pas recevoir le focus à
      // l'ouverture ; il reste hors du parcours de tabulation.
      tabIndex={dialogLabel ? -1 : undefined}
      role={dialogLabel ? 'dialog' : undefined}
      aria-modal={dialogLabel ? true : undefined}
      aria-label={dialogLabel}
      className={cn(
        'on-dark shrink-0 flex-col gap-4 overflow-y-auto bg-ink px-3 py-5 text-on-dark',
        'sticky top-0 h-dvh transition-[width] duration-200',
        railed ? 'w-[72px]' : 'w-64',
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-2 px-1.5">
        {wide ? (
          <Logo tone="dark" caption="Parc Arsène N. · Douala" to="/app" />
        ) : (
          <Logo tone="dark" markOnly to="/app" />
        )}
        <IconButton
          icon="menu"
          // Dans le tiroir, ce bouton ferme ; dans la barre latérale de
          // bureau, il replie. Deux actions, deux libellés.
          label={dialogLabel ? t('nav.closeNav') : t('nav.toggleNav')}
          variant="onDark"
          onClick={onToggleRail}
          className={cn('ml-auto', railed && 'hidden')}
        />
      </div>

      {wide && (
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow px-2 text-on-dark-faint">{t('nav.activeProfile')}</p>

          {/* Vrais boutons radio : la navigation par flèches et l'annonce
              « 2 sur 3 » sont natives, contrairement à des div cliquables. */}
          <fieldset className="rounded-md border-0 bg-on-dark-hover p-1">
            <legend className="sr-only">{t('nav.activeProfile')}</legend>
            {profiles.map((profile) => {
              const active = profile.value === role
              return (
                <label
                  key={profile.value}
                  className={cn(
                    'relative flex min-h-11 cursor-pointer items-center rounded-sm px-2.5 text-label',
                    'transition-colors duration-150',
                    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                    'has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-gold-on-dark',
                    active
                      ? 'bg-on-dark-active font-semibold text-on-dark shadow-[inset_2px_0_0_var(--color-gold)]'
                      : 'text-on-dark-muted hover:bg-on-dark-hover',
                  )}
                >
                  <input
                    type="radio"
                    name="active-profile"
                    value={profile.value}
                    checked={active}
                    onChange={() => setRole(profile.value)}
                    className="sr-only"
                  />
                  {profile.name}
                </label>
              )
            })}
          </fieldset>

          <p className="rounded-md bg-on-dark-hover px-2.5 py-2 font-mono text-mono-label leading-relaxed text-on-dark-muted">
            {t(`roles.${role}.rights` as 'roles.owner.rights')}
          </p>
        </div>
      )}

      <nav aria-label={t('nav.dashboard')} className="flex flex-col gap-3">
        {SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.roles || item.roles.includes(role))
          if (!items.length) return null

          return (
            <div key={section.headingKey} className="flex flex-col gap-0.5">
              {wide && (
                <p className="eyebrow px-2.5 pb-1 text-on-dark-faint">
                  {t(section.headingKey as 'nav.sectionSteering')}
                </p>
              )}
              {items.map((item) => (
                <SidebarLink key={item.to} item={item} wide={wide} />
              ))}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-on-dark-border pt-3">
        {FOOTER_ITEMS.map((item) => (
          <SidebarLink key={item.to} item={item} wide={wide} />
        ))}
        {railed && (
          <IconButton
            icon="menu"
            label={t('nav.toggleNav')}
            variant="onDark"
            onClick={onToggleRail}
            className="mt-1 self-center"
          />
        )}
      </div>
    </aside>
  )
}

function SidebarLink({ item, wide }: { item: NavItem; wide: boolean }) {
  const t = useT()
  const label = t(item.labelKey as 'nav.dashboard')

  return (
    <NavLink
      to={item.to}
      // `end` sur /app seulement : sinon le tableau de bord resterait actif
      // sur toutes les sous-routes.
      end={item.to === '/app'}
      title={wide ? undefined : label}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-label no-underline',
          'transition-colors duration-150',
          wide ? 'justify-start' : 'justify-center',
          isActive
            ? 'bg-on-dark-active font-semibold text-on-dark shadow-[inset_2px_0_0_var(--color-gold)]'
            : 'text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark',
        )
      }
    >
      <Icon name={item.icon} size={17} />
      {wide && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {wide && item.badge && <Badge tone={item.badge.tone}>{item.badge.value}</Badge>}
      {!wide && <span className="sr-only">{label}</span>}
    </NavLink>
  )
}

/* -------------------------------------------------------------------------- */

function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const t = useT()
  const location = useLocation()

  // Repli sur « Écran introuvable » et non sur le tableau de bord : toute
  // adresse sans entrée de navigation rend le 404 interne, et annoncer le
  // tableau de bord dans le fil situerait l'utilisateur là où il n'est pas.
  const crumb =
    [...SECTIONS.flatMap((s) => s.items), ...FOOTER_ITEMS].find(
      (item) => item.to === location.pathname,
    )?.labelKey ?? 'notFound.appTitle'

  return (
    <header
      className="sticky top-0 flex flex-wrap items-center gap-3 border-b border-border bg-paper/88 px-5 py-2.5 backdrop-blur-md sm:px-8"
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <IconButton
        icon="menu"
        label={t('nav.openNav')}
        variant="secondary"
        onClick={onOpenDrawer}
        className="lg:hidden"
      />

      <nav aria-label={t('nav.breadcrumb')} className="hidden items-center gap-2 sm:flex">
        <span className="eyebrow text-muted">Douala</span>
        <span aria-hidden="true" className="text-border-strong">
          /
        </span>
        <span className="eyebrow text-ink">{t(crumb as 'nav.dashboard')}</span>
      </nav>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher />
        <CurrencySwitcher />
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-label font-semibold text-on-dark"
        >
          AN
        </span>
      </div>
    </header>
  )
}

/**
 * Réserve un écran à certains rôles.
 *
 * Retirer une entrée de la barre latérale ne protège rien : les routes restent
 * atteignables à la main, et `/app/parc` affichait tout le parc à un locataire.
 * Le garde s'appuie sur la même liste `roles` que la navigation, pour que les
 * deux ne puissent pas diverger.
 */
export function RoleGuard({
  allow,
  children,
  fallback,
}: {
  allow: Role[]
  children: ReactNode
  fallback: ReactNode
}) {
  const { role } = useRole()
  return <>{allow.includes(role) ? children : fallback}</>
}

/** En-tête de page, commun à tous les écrans applicatifs. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="display-l text-balance">{title}</h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-body text-pretty text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
