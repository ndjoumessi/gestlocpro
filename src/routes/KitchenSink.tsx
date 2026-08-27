import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button, IconButton } from '@/components/primitives/Button'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Badge, DeltaBadge } from '@/components/primitives/Badge'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Field } from '@/components/primitives/Field'
import { Input, PasswordInput, PasswordStrength, Select, Textarea } from '@/components/primitives/Input'
import { Checkbox, RadioCards, SegmentedControl } from '@/components/primitives/Choice'
import { Modal } from '@/components/primitives/Modal'
import { useToast } from '@/components/primitives/Toast'
import { Logo } from '@/components/primitives/Logo'
import { Icon } from '@/components/primitives/Icon'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'

/**
 * Page de contrôle du système de design : chaque primitive dans ses états.
 * Sert de référence visuelle et de test de non-régression manuel.
 */
export function KitchenSink() {
  const t = useT()
  const { money } = useCurrency()
  const { notify } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'owner' | 'manager' | 'tenant' | null>('owner')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Page de contrôle, mais en-tête collant tout de même : c'est ici qu'on
          vérifie les primitives sur un téléphone, et une barre passée sous la
          barre d'état ferait douter du composant qu'on inspecte. Même partage
          qu'ailleurs : le vertical sur l'élément peint et pleine largeur, la
          gouttière sur la rangée bornée par `max-w-6xl`. */}
      <header
        // Le 20 écrit à la main VALAIT déjà `--z-sticky` : la page de contrôle
        // s'empilait par coïncidence avec le reste du produit. Le jeton ne
        // change pas le nombre, il dit qu'il n'est pas le sien.
        style={{ zIndex: 'var(--z-sticky)' }}
        className={cn(
          'sticky top-0 border-b border-border bg-paper/90 backdrop-blur-md',
          'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3',
        )}
      >
        <div
          className={cn(
            'mx-auto flex max-w-6xl flex-wrap items-center gap-3',
            'pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]',
          )}
        >
          <Logo caption="Système de design" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <div>
          <p className="eyebrow text-accent-ink">Design system</p>
          <h1 className="display-l mt-2">Contrôle des primitives</h1>
          <p className="mt-2 max-w-2xl text-body-l text-muted">
            Chaque composant dans ses états. Les montants suivent la devise choisie dans l’en-tête,
            les libellés suivent la langue.
          </p>
        </div>

        {/* ---- Typographie ---- */}
        <Section title="Échelle typographique">
          <div className="space-y-3">
            <p className="display-xl">Display XL · 56</p>
            <p className="display-l">Display L · 46</p>
            <p className="display-m">Display M · 32</p>
            <p className="title-l">Title L · 20 · Manrope 600</p>
            <p className="title-m">Title M · 17 · Manrope 600</p>
            <p className="text-body-l">Body L · 16 — corps de la landing et des champs mobiles.</p>
            <p className="text-body">Body · 14 — corps de l’application.</p>
            <p className="text-body text-muted">Body S · 13 — annotations, en gris secondaire.</p>
            <p className="text-label text-muted">Label · 12 · plancher typographique</p>
            <p className="eyebrow text-muted">Mono label · 12 · suréminence</p>
            <p className="numeric text-kpi">1 415 000</p>
          </div>
        </Section>

        {/* ---- Couleurs ---- */}
        <Section title="Jetons de couleur">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="ink" className="bg-ink" dark />
            <Swatch name="ink-2" className="bg-ink-2" dark />
            <Swatch name="muted" className="bg-muted" dark />
            <Swatch name="accent" className="bg-accent" />
            <Swatch name="accent-ink" className="bg-accent-ink" dark />
            <Swatch name="paper" className="bg-paper" />
            <Swatch name="canvas" className="bg-canvas" />
            <Swatch name="surface-sunken" className="bg-surface-sunken" />
            <Swatch name="border" className="bg-border" />
            <Swatch name="border-strong" className="bg-border-strong" />
            <Swatch name="ok" className="bg-ok" dark />
            <Swatch name="warn" className="bg-warn" dark />
            <Swatch name="danger" className="bg-danger" dark />
            <Swatch name="accent-tint" className="bg-accent-tint" />
            <Swatch name="ok-tint" className="bg-ok-tint" />
          </div>
        </Section>

        {/* ---- Boutons ---- */}
        <Section title="Boutons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon="plus">
              Primaire
            </Button>
            <Button variant="secondary" icon="download">
              Secondaire
            </Button>
            <Button variant="accent" icon="sparkle">
              Doré
            </Button>
            <Button variant="ghost">Fantôme</Button>
            <Button variant="danger" icon="alert">
              Destructif
            </Button>
            <Button loading>Chargement</Button>
            <Button disabled>Désactivé</Button>
            <IconButton icon="menu" label="Ouvrir le menu" variant="secondary" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Petit</Button>
            <Button size="md">Moyen</Button>
            <Button size="lg" iconAfter="arrowRight">
              Grand
            </Button>
          </div>
          <div className="on-dark mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-ink p-4">
            <Button variant="accent">Sur fond sombre</Button>
            <Button variant="onDark">Secondaire sombre</Button>
            <LanguageSwitcher tone="dark" />
            <CurrencySwitcher tone="dark" />
            <ThemeSwitcher tone="dark" />
          </div>
        </Section>

        {/* ---- Statuts ---- */}
        <Section title="Statuts et étiquettes">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="ok">{t('status.paid')}</StatusPill>
            <StatusPill tone="warn">{t('status.partial')}</StatusPill>
            <StatusPill tone="danger">{t('status.overdue')}</StatusPill>
            <StatusPill tone="neutral">{t('status.vacant')}</StatusPill>
            <StatusPill tone="info" icon="sparkle">
              Nouveau
            </StatusPill>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="neutral">12 unités</Badge>
            <Badge tone="accent">Pro</Badge>
            <Badge tone="ok">Actif</Badge>
            <Badge tone="danger">3</Badge>
            <Badge tone="dark">FCFA</Badge>
            <DeltaBadge value={165000} />
            <DeltaBadge value={95000} invert />
            <DeltaBadge value={-8} suffix="pts" />
          </div>
          <p className="mt-4 text-body text-muted">
            Chaque pastille porte une icône <em>et</em> un libellé : l’information ne repose jamais
            sur la seule couleur.
          </p>
        </Section>

        {/* ---- Formulaires ---- */}
        <Section title="Champs de formulaire">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('common.email')} required hint="Nous ne la partageons jamais.">
              {(props) => <Input type="email" icon="mail" placeholder="nom@domaine.com" {...props} />}
            </Field>

            <Field label={t('common.email')} error="Cette adresse ne semble pas valide.">
              {(props) => <Input type="email" invalid defaultValue="nom@" {...props} />}
            </Field>

            <Field label={t('common.password')} required>
              {(props) => (
                <>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    {...props}
                  />
                  <div className="mt-2">
                    <PasswordStrength value={password} />
                  </div>
                </>
              )}
            </Field>

            <Field label={t('common.country')}>
              {(props) => (
                <Select defaultValue="CM" {...props}>
                  <option value="CM">Cameroun</option>
                  <option value="SN">Sénégal</option>
                  <option value="FR">France</option>
                  <option value="CA">Canada</option>
                </Select>
              )}
            </Field>

            <Field label="Note interne" optional className="sm:col-span-2">
              {(props) => <Textarea placeholder="Contexte, consigne au gestionnaire…" {...props} />}
            </Field>
          </div>

          <div className="mt-5 space-y-1">
            <Checkbox label="J’accepte les conditions générales." defaultChecked />
            <Checkbox label="Recevoir les nouveautés produit." hint="Une fois par trimestre." />
            <Checkbox label="Case en erreur" error="Vous devez cocher cette case." />
          </div>

          <div className="mt-6">
            <SegmentedControl
              label="Période de facturation"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'monthly', label: 'Mensuel' },
                { value: 'yearly', label: 'Annuel', badge: '−20 %' },
              ]}
            />
          </div>
        </Section>

        {/* ---- Cartes radio ---- */}
        <Section title="Cartes radio (choix de rôle)">
          <RadioCards
            legend="Votre rôle"
            name="demo-role"
            value={role}
            onChange={setRole}
            options={[
              {
                value: 'owner',
                title: t('roles.owner.name'),
                description: t('roles.owner.short'),
                icon: 'building',
                footnote: t('roles.owner.rights'),
              },
              {
                value: 'manager',
                title: t('roles.manager.name'),
                description: t('roles.manager.short'),
                icon: 'users',
                footnote: t('roles.manager.rights'),
              },
              {
                value: 'tenant',
                title: t('roles.tenant.name'),
                description: t('roles.tenant.short'),
                icon: 'key',
                footnote: t('roles.tenant.rights'),
              },
            ]}
          />
        </Section>

        {/* ---- Cartes ---- */}
        <Section title="Cartes et élévation">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="eyebrow text-muted">Loyers attendus</div>
              <div className="mt-2 numeric text-kpi">{money(1415000, { round: true })}</div>
              <div className="mt-2 flex items-center gap-2">
                <DeltaBadge value={165000} />
                <span className="text-body text-muted">12 baux actifs</span>
              </div>
            </Card>

            <Card tone="sunken">
              <CardHeader title="Ton creusé" description="Pour les zones secondaires." />
              <p className="text-body text-muted">Sans ombre, bordure plus marquée.</p>
            </Card>

            <Card tone="accent">
              <CardHeader title="Ton doré" description="Pour les mises en avant." />
              <p className="text-body text-muted">Teinte dorée, bordure dorée.</p>
            </Card>

            <Card tone="dark">
              <CardHeader title="Ton sombre" description="Pour les blocs de synthèse." />
              <p className="text-body text-on-dark-muted">
                L’or passe en <span className="text-accent">accent</span> sur fond sombre.
              </p>
            </Card>
          </div>
        </Section>

        {/* ---- Superpositions ---- */}
        <Section title="Superpositions">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Ouvrir une modale
            </Button>
            <Button variant="secondary" onClick={() => notify('Relevé du mois exporté (PDF + CSV)')}>
              Notification neutre
            </Button>
            <Button
              variant="secondary"
              onClick={() => notify('Paiement enregistré', { tone: 'ok' })}
            >
              Notification succès
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                notify('Fiche locataire supprimée', {
                  tone: 'danger',
                  action: { label: 'Annuler', onClick: () => notify('Action annulée') },
                })
              }
            >
              Notification avec annulation
            </Button>
          </div>
        </Section>

        {/* ---- Icônes ---- */}
        <Section title="Icônes">
          <div className="flex flex-wrap gap-4 text-muted">
            {(
              [
                'grid', 'building', 'card', 'gauge', 'clipboard', 'wrench', 'shield', 'users',
                'bell', 'info', 'layers', 'phone', 'monitor', 'search', 'calendar', 'check',
                'alert', 'clock', 'droplet', 'bolt', 'globe', 'lock', 'mail', 'key', 'download',
                'trendUp', 'file', 'sparkle',
              ] as const
            ).map((name) => (
              /* La case s'élargit avec le libellé : à 12px, « clipboard » ne
                 tient plus dans les 64px d'origine, et une planche de contrôle
                 qui tronque le nom des icônes ne contrôle plus rien. */
              <div key={name} className="flex w-20 flex-col items-center gap-1.5">
                <Icon name={name} size={20} />
                <span className="truncate text-label">{name}</span>
              </div>
            ))}
          </div>
        </Section>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Enregistrer un paiement"
        description="Le locataire recevra sa quittance par e-mail."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false)
                notify('Paiement enregistré', { tone: 'ok' })
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Montant" required hint="Un règlement partiel est accepté.">
            {(props) => <Input inputMode="numeric" defaultValue="120 000" {...props} />}
          </Field>
          <Field label="Moyen de paiement">
            {(props) => (
              <Select defaultValue="mobile" {...props}>
                <option value="mobile">Mobile money</option>
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-8">
      <h2 className="mb-5 title-l">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Rend une couleur calculée en hexadécimal majuscule.
 *
 * Les navigateurs restituent `background-color` en `rgb()` ou `rgba()`, jamais
 * sous la forme d'origine. Ce qu'on veut afficher reste la notation dans
 * laquelle les jetons sont écrits — c'est celle qu'un lecteur va recopier.
 *
 * Toute forme non reconnue est rendue TELLE QUELLE plutôt que remplacée par un
 * repli plausible : sur cette page, une valeur inhabituelle est une information
 * (un jeton passé en `color(display-p3 …)`, par exemple), et la masquer
 * derrière un faux hexadécimal reproduirait exactement le mensonge qu'on vient
 * de retirer.
 */
function enHexadecimal(couleurCalculee: string): string {
  const canaux = /^rgba?\(([^)]+)\)$/.exec(couleurCalculee.trim())
  if (!canaux) return couleurCalculee

  const composantes = canaux[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3)
  if (composantes.length < 3) return couleurCalculee

  const octets = composantes.map((c) => Number(c))
  if (octets.some((o) => !Number.isFinite(o))) return couleurCalculee

  return `#${octets.map((o) => Math.round(o).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/**
 * Couleur RÉELLEMENT peinte par une pastille, relue à chaque bascule de thème.
 *
 * Trois précautions, chacune payée par un essai raté :
 *
 * 1. La lecture est différée d'une image. `ThemeProvider` pose `data-theme` dans
 *    son propre effet, et les effets d'un enfant s'exécutent AVANT ceux de son
 *    parent : lire ici sans attendre rendrait la couleur du thème précédent. La
 *    même image de décalage neutralise l'autre piège connu du dépôt, celui du
 *    style calculé lu au milieu d'une transition de couleur.
 * 2. On observe l'attribut sur `<html>` plutôt que de dépendre de `useTheme` :
 *    le script d'amorçage de `index.html` le pose aussi, hors de React.
 * 3. On écoute `prefers-color-scheme` en plus, parce qu'en mode `auto` aucun
 *    attribut ne change quand l'utilisateur bascule son système — c'est la
 *    requête média seule qui repeint, et rien ne la signale à React.
 */
function useCouleurPeinte() {
  const ref = useRef<HTMLDivElement>(null)
  const [couleur, setCouleur] = useState('')

  useEffect(() => {
    let image = 0

    const relire = () => {
      if (ref.current) setCouleur(enHexadecimal(getComputedStyle(ref.current).backgroundColor))
    }
    // Deux lectures, et les deux comptent.
    //
    // La lecture immédiate suffit dans le cas courant : `getComputedStyle`
    // force le recalcul des styles, la valeur est donc déjà celle du nouveau
    // thème. Elle est SEULE à s'exécuter dans un onglet d'arrière-plan, où le
    // navigateur n'appelle jamais `requestAnimationFrame` — sans elle, la page
    // restait vide au retour sur l'onglet.
    //
    // La lecture différée d'une image rattrape les deux cas que la première ne
    // couvre pas : le style calculé lu au milieu d'une transition de couleur,
    // qui rend la valeur d'AVANT (piège déjà rencontré ici), et l'attribut posé
    // par `ThemeProvider` dans un effet parent, qui s'exécute APRÈS celui-ci.
    const planifier = () => {
      relire()
      cancelAnimationFrame(image)
      image = requestAnimationFrame(relire)
    }

    planifier()

    const observateur = new MutationObserver(planifier)
    observateur.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', planifier)

    return () => {
      cancelAnimationFrame(image)
      observateur.disconnect()
      media.removeEventListener('change', planifier)
    }
  }, [])

  return [ref, couleur] as const
}

function Swatch({ name, className, dark }: { name: string; className: string; dark?: boolean }) {
  const [ref, couleur] = useCouleurPeinte()

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div
        ref={ref}
        className={`flex h-16 items-end p-2 ${className} ${dark ? 'text-on-dark' : 'text-ink'}`}
      >
        {/* Espace insécable avant la première lecture : la pastille garde sa
            hauteur de ligne, plutôt que de sursauter à l'arrivée de la valeur. */}
        <span className="numeric text-label opacity-80">{couleur || ' '}</span>
      </div>
      <div className="bg-surface px-2 py-1.5 text-label text-muted">{name}</div>
    </div>
  )
}
