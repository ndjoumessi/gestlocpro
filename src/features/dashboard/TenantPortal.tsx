import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Select, Textarea } from '@/components/primitives/Input'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { Logo } from '@/components/primitives/Logo'
import { useToast } from '@/components/primitives/Toast'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { TENANT_RECEIPTS, UNITS, buildingById } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { useReceiptExport } from './receiptExport'

const TABS = ['space', 'myPayments', 'myWorks', 'documents', 'report'] as const
type Tab = (typeof TABS)[number]

/**
 * Pastilles du chrome de navigateur — voir `--chrome-dot-*` dans `tokens.css`.
 * Elles ressemblent au trio de statut mais n'en sont pas : ce décor ne doit
 * suivre ni `--color-danger`, ni `--color-warn`, ni `--color-ok`.
 */
const CHROME_DOTS = ['var(--chrome-dot-1)', 'var(--chrome-dot-2)', 'var(--chrome-dot-3)'] as const

/**
 * Documents du portail.
 *
 * Les quatre lignes portaient chacune un bouton « Télécharger » sans `onClick`.
 * Trois d'entre elles n'ont aucun fichier derrière : le produit ne sait ni
 * déposer un bail signé, ni générer un état des lieux, ni recevoir une
 * attestation d'assurance. Leur fabriquer un CSV aurait remplacé un bouton mort
 * par un faux document, ce qui est pire — on affiche donc l'état réel de la
 * case, et le bouton revient le jour où le dépôt de fichiers existe.
 *
 * La quittance du mois, elle, a bien une donnée derrière : c'est la même que
 * celle de l'onglet « Mes paiements », et elle se télécharge.
 */
const DOCUMENTS = [
  { key: 'app.portal.docLease', backed: false },
  { key: 'app.portal.docInspection', backed: false },
  { key: 'app.portal.docReceipt', backed: true },
  { key: 'app.portal.docInsurance', backed: false },
] as const

/**
 * Portail locataire, présenté dans un cadre de navigateur : c'est une
 * prévisualisation destinée au propriétaire, pas l'écran réel du locataire.
 * Le cadre évite l'ambiguïté — sans lui, on croirait avoir changé d'application.
 */
export function TenantPortal() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { notify } = useToast()
  const downloadReceipt = useReceiptExport()
  const [tab, setTab] = useState<Tab>('space')
  const [sent, setSent] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  /** Préfixe des identifiants qui lient onglets et panneau. */
  const tabsId = useId()
  const onglets = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * Sélection SUIVANT le focus — le comportement recommandé quand changer
   * d'onglet ne coûte rien, ce qui est le cas ici : les cinq vues sont déjà
   * en mémoire. L'alternative (flèche pour déplacer, Entrée pour activer)
   * ferait payer deux frappes ce que la souris obtient en un clic.
   */
  const allerA = (index: number) => {
    const cible = TABS[index]
    if (!cible) return
    setTab(cible)
    onglets.current[index]?.focus()
  }

  const auClavier = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Bornage, jamais bouclage : voir le commentaire du `tablist`.
    const destination =
      e.key === 'ArrowRight'
        ? Math.min(index + 1, TABS.length - 1)
        : e.key === 'ArrowLeft'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : null

    if (destination === null) return
    // `Home` et `End` défileraient le document, les flèches le feraient
    // horizontalement dans la rangée débordante : dans les deux cas la page
    // bougerait sous une commande qui ne la concerne pas.
    e.preventDefault()
    allerA(destination)
  }

  const { worksForUnit } = usePortfolio()

  const unit = UNITS.find((u) => u.id === 'A1')!
  const myWorks = worksForUnit('A1')

  return (
    <>
      <PageHeader title={t('app.portal.title')} description={t('app.portal.subtitle')} />

      <div className="overflow-hidden rounded-xl border border-border-strong bg-surface-sunken shadow-e2">
        {/* Chrome de navigateur */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            {CHROME_DOTS.map((dot) => (
              <span key={dot} className="size-2.5 rounded-full" style={{ background: dot }} />
            ))}
          </span>
          <span className="numeric truncate rounded-md bg-surface-sunken px-3 py-1 text-caps text-muted">
            {t('app.portal.demoUrl')}
          </span>
        </div>

        <div className="bg-canvas">
          {/* En-tête du portail */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-paper px-5 py-3">
            <Logo to="" size="sm" />
            <span
              aria-hidden="true"
              className="ml-auto flex size-8 items-center justify-center rounded-full bg-ink text-label font-semibold text-on-dark"
            >
              CN
            </span>
          </div>

          {/* Onglets — motif ARIA COMPLET, et non ses seuls rôles.
              `role="tab"` annonce au lecteur d'écran une navigation aux
              flèches ; la déclarer sans la câbler promet une commande qui
              n'existe pas, ce qui est pire qu'une rangée de boutons ordinaires.
              Le motif est donc tenu en entier : flèches, Début/Fin, `tabindex`
              roulant, `aria-controls` et le panneau qui répond.

              Le contenu s'y prête — cinq vues exclusives d'un même dossier,
              pas cinq destinations —, donc on l'implémente plutôt que de
              retirer les rôles.

              BORNAGE et non bouclage, comme `Combobox` : c'est la convention
              du dépôt, et sur cinq entrées visibles d'un coup, revenir au
              début en poussant à droite se lit comme un raté. */}
          <div
            role="tablist"
            aria-label={t('app.portal.title')}
            className="flex gap-1 overflow-x-auto border-b border-border bg-paper px-3"
          >
            {TABS.map((value, index) => {
              const active = tab === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`${tabsId}-tab-${value}`}
                  aria-selected={active}
                  aria-controls={`${tabsId}-panel-${value}`}
                  // Un seul arrêt de tabulation pour tout le groupe : la
                  // tabulation atteint le contenu du panneau, elle ne traverse
                  // pas cinq onglets pour y arriver.
                  tabIndex={active ? 0 : -1}
                  ref={(node) => {
                    onglets.current[index] = node
                  }}
                  onClick={() => setTab(value)}
                  onKeyDown={(e) => auClavier(e, index)}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 cursor-pointer items-center border-b-2 px-3',
                    'text-label font-semibold transition-colors duration-150',
                    active
                      ? // L'or de marque tenait 2,62:1 sur `paper` : cette
                        // barre est le SEUL repère de l'onglet courant, donc
                        // de la donnée. `gold-ink` la porte à 4,98:1 en clair
                        // et 8,50:1 en sombre.
                        'border-gold-ink text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t(`app.portal.${value}` as 'app.portal.space')}
                </button>
              )
            })}
          </div>

          <div
            id={`${tabsId}-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-tab-${tab}`}
            // Le panneau n'est pas focalisable : ses cinq vues contiennent
            // toutes au moins un élément atteignable au clavier, et la
            // tabulation depuis l'onglet actif y entre directement.
            className="p-5"
          >
            {tab === 'space' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <p className="eyebrow text-muted">{t('app.portal.myUnit')}</p>
                  <p className="mt-2 title-l">
                    {unit.label} · {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
                  </p>
                  {/* Le nom de l'immeuble était écrit en dur : il restait
                      « Résidence Bonamoussadi » quelle que soit l'unité. */}
                  <p className="mt-1 text-body-s text-muted">
                    {unit.surface} m² · {buildingById(unit.buildingId)?.name}
                  </p>
                </Card>

                <Card>
                  <p className="eyebrow text-muted">{t('app.portal.nextDue')}</p>
                  <p className="numeric mt-2 text-kpi font-medium">
                    {money(unit.rent, { round: true })}
                  </p>
                  <div className="mt-2">
                    <StatusPill tone="ok" size="sm">
                      {t('status.paid')}
                    </StatusPill>
                  </div>
                </Card>
              </div>
            )}

            {tab === 'myPayments' && (
              <Card flush>
                <ul className="divide-y divide-divider">
                  {TENANT_RECEIPTS.slice(0, 4).map((receipt) => (
                    <li
                      key={`${receipt.year}-${receipt.month}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 text-body font-medium">
                        {d.monthYear(receipt)}
                      </span>
                      <span className="numeric text-body">{money(unit.rent, { round: true })}</span>
                      <StatusPill tone="ok" size="sm">
                        {t('status.paid')}
                      </StatusPill>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="download"
                        onClick={() => downloadReceipt(unit, receipt)}
                      >
                        {t('app.portal.downloadReceipt')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {tab === 'myWorks' && (
              <div className="flex flex-col gap-3">
                {myWorks.map((work) => (
                  <Card key={work.id} className="flex items-center gap-3">
                    <Icon name="wrench" size={18} className="shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium">{workTitle(work, t)}</p>
                      <p className="text-caps text-muted">
                        {work.reference ?? work.id} ·{' '}
                        {d.dayMonth(work.reportedAt)}
                      </p>
                    </div>
                    <StatusPill tone={work.status === 'done' ? 'ok' : 'warn'} size="sm">
                      {t(`app.works.${work.status}` as 'app.works.reported')}
                    </StatusPill>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'documents' && (
              <Card flush>
                <ul className="divide-y divide-divider">
                  {DOCUMENTS.map(({ key, backed }) => (
                    <li key={key} className="flex items-center gap-3 px-4 py-3">
                      <Icon name="file" size={17} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-body">{t(key)}</span>
                      {backed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="download"
                          aria-label={t('app.portal.downloadReceipt')}
                          onClick={() => downloadReceipt(unit, TENANT_RECEIPTS[0])}
                        />
                      ) : (
                        <span className="shrink-0 text-caps text-muted">
                          {t('app.portal.docUnavailable')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {tab === 'report' && (
              <Card>
                <CardHeader
                  title={t('app.portal.reportIssue')}
                  description={t('app.portal.describeHint')}
                  level={2}
                />

                {sent ? (
                  <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
                    <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
                    {t('app.portal.reportSent')}
                  </p>
                ) : (
                  <div ref={reportRef} className="flex flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label={t('app.portal.category')} required>
                        {(props) => (
                          <Select {...props} defaultValue="plumbing">
                            <option value="plumbing">{t('app.trades.plumbing')}</option>
                            <option value="power">{t('app.trades.power')}</option>
                            <option value="lock">{t('app.trades.lock')}</option>
                            <option value="other">{t('app.trades.other')}</option>
                          </Select>
                        )}
                      </Field>

                      <Field label={t('app.portal.urgency')} required>
                        {(props) => (
                          <Select {...props} defaultValue="high">
                            <option value="high">{t('app.portal.urgencyHigh')}</option>
                            <option value="medium">{t('app.portal.urgencyMedium')}</option>
                            <option value="low">{t('app.portal.urgencyLow')}</option>
                          </Select>
                        )}
                      </Field>
                    </div>

                    {/* Le champ portait l'astérisque du champ obligatoire, mais
                        rien ne le vérifiait : soumis à vide, le formulaire
                        annonçait « signalement envoyé au gestionnaire et au
                        propriétaire » pour un message sans contenu. La fiche
                        locataire avait exactement ce défaut, et le même
                        remède — la règle des trois caractères est celle de la
                        justification d'une retenue de caution. */}
                    <Field
                      label={t('app.portal.describe')}
                      required
                      error={error ?? undefined}
                    >
                      {(props) => (
                        <Textarea
                          {...props}
                          name="description"
                          value={description}
                          onChange={(e) => {
                            setDescription(e.target.value)
                            if (error) setError(null)
                          }}
                        />
                      )}
                    </Field>

                    <Button
                      onClick={() => {
                        if (description.trim().length < 3) {
                          setError(t('app.portal.describeRequired'))
                          reportRef.current?.querySelector<HTMLElement>('[name="description"]')?.focus()
                          return
                        }
                        setError(null)
                        setSent(true)
                        notify(t('app.portal.reportSent'), { tone: 'ok' })
                      }}
                    >
                      {t('app.portal.report')}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
