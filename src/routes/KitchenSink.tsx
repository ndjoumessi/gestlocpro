import { useState } from 'react'
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
      <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <Logo caption="Système de design" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <div>
          <p className="eyebrow text-gold-ink">Design system</p>
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
            <p className="font-sans text-title-l font-semibold">Title L · 20 · Manrope 600</p>
            <p className="font-sans text-title-m font-semibold">Title M · 17 · Manrope 600</p>
            <p className="text-body-l">Body L · 16 — corps de la landing et des champs mobiles.</p>
            <p className="text-body">Body · 14 — corps de l’application.</p>
            <p className="text-body-s text-muted">Body S · 13 — annotations, en gris secondaire.</p>
            <p className="eyebrow text-muted">Mono label · 11 · suréminence</p>
            <p className="font-mono text-mono-kpi">1 415 000</p>
          </div>
        </Section>

        {/* ---- Couleurs ---- */}
        <Section title="Jetons de couleur">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="ink" hex="#14201E" className="bg-ink" dark />
            <Swatch name="ink-2" hex="#243733" className="bg-ink-2" dark />
            <Swatch name="muted" hex="#5C6664" className="bg-muted" dark />
            <Swatch name="gold" hex="#C58E3E" className="bg-gold" />
            <Swatch name="gold-ink" hex="#8A6218" className="bg-gold-ink" dark />
            <Swatch name="paper" hex="#F7F4EE" className="bg-paper" />
            <Swatch name="canvas" hex="#EFEBE2" className="bg-canvas" />
            <Swatch name="surface-sunken" hex="#F2F0EA" className="bg-surface-sunken" />
            <Swatch name="border" hex="#E5DFD3" className="bg-border" />
            <Swatch name="border-strong" hex="#CBBFA6" className="bg-border-strong" />
            <Swatch name="ok" hex="#2C6A4E" className="bg-ok" dark />
            <Swatch name="warn" hex="#8A6218" className="bg-warn" dark />
            <Swatch name="danger" hex="#A63A2B" className="bg-danger" dark />
            <Swatch name="gold-tint" hex="#FBF3E2" className="bg-gold-tint" />
            <Swatch name="ok-tint" hex="#EAF2EC" className="bg-ok-tint" />
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
            <Button variant="gold" icon="sparkle">
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
            <Button variant="gold">Sur fond sombre</Button>
            <Button variant="onDark">Secondaire sombre</Button>
            <LanguageSwitcher tone="dark" />
            <CurrencySwitcher tone="dark" />
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
            <Badge tone="gold">Pro</Badge>
            <Badge tone="ok">Actif</Badge>
            <Badge tone="danger">3</Badge>
            <Badge tone="dark">FCFA</Badge>
            <DeltaBadge value={165000} />
            <DeltaBadge value={95000} invert />
            <DeltaBadge value={-8} suffix="pts" />
          </div>
          <p className="mt-4 text-body-s text-muted">
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
              <div className="mt-2 font-mono text-mono-kpi">{money(1415000, { round: true })}</div>
              <div className="mt-2 flex items-center gap-2">
                <DeltaBadge value={165000} />
                <span className="text-body-s text-muted">12 baux actifs</span>
              </div>
            </Card>

            <Card tone="sunken">
              <CardHeader title="Ton creusé" description="Pour les zones secondaires." />
              <p className="text-body-s text-muted">Sans ombre, bordure plus marquée.</p>
            </Card>

            <Card tone="gold">
              <CardHeader title="Ton doré" description="Pour les mises en avant." />
              <p className="text-body-s text-muted">Teinte dorée, bordure dorée.</p>
            </Card>

            <Card tone="dark">
              <CardHeader title="Ton sombre" description="Pour les blocs de synthèse." />
              <p className="text-body-s text-on-dark-muted">
                L’or passe en <span className="text-gold">accent</span> sur fond sombre.
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
              <div key={name} className="flex w-16 flex-col items-center gap-1.5">
                <Icon name={name} size={20} />
                <span className="truncate font-mono text-[9px]">{name}</span>
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
      <h2 className="mb-5 font-sans text-title-l font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({
  name,
  hex,
  className,
  dark,
}: {
  name: string
  hex: string
  className: string
  dark?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div
        className={`flex h-16 items-end p-2 ${className} ${dark ? 'text-on-dark' : 'text-ink'}`}
      >
        <span className="font-mono text-[10px] opacity-80">{hex}</span>
      </div>
      <div className="bg-surface px-2 py-1.5 font-mono text-[10px] text-muted">{name}</div>
    </div>
  )
}
