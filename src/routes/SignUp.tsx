import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Stepper } from '@/features/auth/Stepper'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, PasswordInput, PasswordStrength, Select } from '@/components/primitives/Input'
import { Checkbox, RadioCards } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { Card } from '@/components/primitives/Card'
import { useI18n, useT } from '@/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales'
import type { Locale } from '@/i18n/locales'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCIES, CURRENCY_DEFS, type CurrencyCode } from '@/currency/currencies'
import {
  OTHER_COUNTRY,
  countryName,
  findCountry,
  sortedCountries,
  sortedDialCodes,
} from '@/lib/countries'
import {
  formatInviteCode,
  validateEmail,
  validateInviteCode,
  validateName,
  validateParkName,
  validatePassword,
  validatePhone,
  type FieldError,
} from '@/features/auth/validation'
import {
  initialSignupState,
  ROLE_SLUGS,
  SLUG_TO_ROLE,
  UNIT_RANGES,
  type Role,
  type SignupState,
} from '@/features/auth/signupState'

const STEP_KEYS = ['role', 'identity', 'context', 'review'] as const
type StepKey = (typeof STEP_KEYS)[number]

/**
 * Assistant d'inscription.
 *
 * Un seul formulaire pour les trois rôles, plutôt que trois parcours séparés :
 * ils partagent l'identité, le pays, la devise, la langue et les conditions —
 * soit l'essentiel des champs. Seule l'étape « contexte » diverge. Choisir le
 * rôle en premier évite de demander un code d'invitation à un propriétaire, et
 * `/inscription/:role` permet d'entrer directement dans un parcours depuis la
 * landing en sautant l'étape 1.
 */
export function SignUp() {
  const t = useT()
  const { locale, setLocale } = useI18n()
  const { currency, setCurrency } = useCurrency()
  const { role: roleSlug } = useParams()

  const presetRole = roleSlug ? (SLUG_TO_ROLE[roleSlug] ?? null) : null

  const [state, setState] = useState<SignupState>(() =>
    initialSignupState(presetRole, locale, currency),
  )
  const [stepIndex, setStepIndex] = useState(presetRole ? 1 : 0)
  const [errors, setErrors] = useState<Record<string, FieldError>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const step: StepKey = STEP_KEYS[stepIndex]
  const patch = (values: Partial<SignupState>) => setState((s) => ({ ...s, ...values }))

  const steps = useMemo(
    () => STEP_KEYS.map((key) => t(`auth.signup.steps.${key}` as 'auth.signup.steps.role')),
    [t],
  )

  // Le titre de la page change à chaque étape : sans cela, un utilisateur de
  // lecteur d'écran ne perçoit pas le changement de contexte.
  useEffect(() => {
    document.title = `${steps[stepIndex]} — ${t('auth.signup.title')} · GestLocPro`
  }, [stepIndex, steps, t])

  /** Erreurs de l'étape courante. */
  function validateStep(current: StepKey): Record<string, FieldError> {
    if (current === 'role') {
      return {}
    }

    if (current === 'identity') {
      return {
        name: validateName(state.name),
        email: validateEmail(state.email),
        phone: validatePhone(state.phone),
        password: validatePassword(state.password, { requireStrong: true }),
      }
    }

    if (current === 'context') {
      if (state.role === 'owner') return { parkName: validateParkName(state.parkName) }
      // Le gestionnaire sans code passe par une demande d'accès : on ne bloque
      // pas, on change de chemin.
      if (state.role === 'manager') return {}
      if (state.role === 'tenant') return { inviteCode: validateInviteCode(state.inviteCode) }
    }

    return { terms: state.terms ? null : 'auth.signup.termsError' }
  }

  const goNext = () => {
    if (step === 'role' && !state.role) return

    const next = validateStep(step)
    setErrors(next)
    setTouched((s) => ({ ...s, ...Object.fromEntries(Object.keys(next).map((k) => [k, true])) }))

    const firstBad = Object.entries(next).find(([, error]) => error !== null)
    if (firstBad) {
      document.querySelector<HTMLElement>(`[name="${firstBad[0]}"]`)?.focus()
      return
    }

    if (step === 'review') {
      setSubmitting(true)
      window.setTimeout(() => {
        setSubmitting(false)
        setDone(true)
      }, 800)
      return
    }

    setStepIndex((i) => i + 1)
    window.scrollTo({ top: 0 })
  }

  const goBack = () => {
    if (stepIndex === 0) return
    setStepIndex((i) => i - 1)
    window.scrollTo({ top: 0 })
  }

  const errorFor = (key: string) =>
    touched[key] && errors[key] ? t(errors[key]!) : undefined

  const blur = (key: string, error: FieldError) => () => {
    setTouched((s) => ({ ...s, [key]: true }))
    setErrors((s) => ({ ...s, [key]: error }))
  }

  if (done) {
    return <SignupSuccess role={state.role} />
  }

  return (
    <AuthLayout
      wide
      title={
        step === 'role'
          ? t('auth.signup.roleTitle')
          : step === 'identity'
            ? t('auth.signup.identityTitle')
            : step === 'context'
              ? t('auth.signup.contextTitle')
              : t('auth.signup.reviewTitle')
      }
      subtitle={
        step === 'role'
          ? t('auth.signup.roleSubtitle')
          : step === 'identity'
            ? t('auth.signup.identitySubtitle')
            : step === 'context'
              ? t('auth.signup.contextSubtitle')
              : t('auth.signup.reviewSubtitle')
      }
      above={<Stepper steps={steps} current={stepIndex} />}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to="/connexion" className="font-semibold text-gold-ink hover:text-gold-ink-hover">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          goNext()
        }}
        noValidate
        className="flex flex-col gap-6"
      >
        {step === 'role' && (
          <RadioCards
            legend={t('auth.signup.roleTitle')}
            hideLegend
            name="role"
            value={state.role}
            onChange={(role: Role) => patch({ role })}
            columns={3}
            options={[
              {
                value: 'owner',
                title: t('roles.owner.name'),
                description: t('roles.owner.pitch'),
                icon: 'building',
                footnote: t('roles.owner.rights'),
              },
              {
                value: 'manager',
                title: t('roles.manager.name'),
                description: t('roles.manager.pitch'),
                icon: 'users',
                footnote: t('roles.manager.rights'),
              },
              {
                value: 'tenant',
                title: t('roles.tenant.name'),
                description: t('roles.tenant.pitch'),
                icon: 'key',
                footnote: t('roles.tenant.rights'),
              },
            ]}
          />
        )}

        {step === 'identity' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t('common.fullName')}
              required
              error={errorFor('name')}
              className="sm:col-span-2"
            >
              {(props) => (
                <Input
                  {...props}
                  name="name"
                  autoComplete="name"
                  value={state.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onBlur={blur('name', validateName(state.name))}
                />
              )}
            </Field>

            <Field label={t('common.email')} required error={errorFor('email')}>
              {(props) => (
                <Input
                  {...props}
                  name="email"
                  type="email"
                  icon="mail"
                  autoComplete="email"
                  placeholder="nom@domaine.com"
                  value={state.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  onBlur={blur('email', validateEmail(state.email))}
                />
              )}
            </Field>

            <Field label={t('common.phone')} required error={errorFor('phone')}>
              {(props) => (
                <div className="flex gap-2">
                  {/* L'indicatif suit le pays choisi à l'étape suivante mais
                      reste modifiable : on peut résider ailleurs que son parc. */}
                  <Select
                    aria-label="Indicatif"
                    value={state.dial}
                    onChange={(e) => patch({ dial: e.target.value })}
                    className="w-28 shrink-0"
                  >
                    {sortedDialCodes().map((dial) => (
                      <option key={dial} value={dial}>
                        {dial}
                      </option>
                    ))}
                  </Select>
                  <Input
                    {...props}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={state.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    onBlur={blur('phone', validatePhone(state.phone))}
                  />
                </div>
              )}
            </Field>

            <Field
              label={t('common.password')}
              required
              error={errorFor('password')}
              className="sm:col-span-2"
            >
              {(props) => (
                <>
                  <PasswordInput
                    {...props}
                    name="password"
                    autoComplete="new-password"
                    value={state.password}
                    onChange={(e) => patch({ password: e.target.value })}
                    onBlur={blur(
                      'password',
                      validatePassword(state.password, { requireStrong: true }),
                    )}
                  />
                  <div className="mt-2.5">
                    <PasswordStrength value={state.password} />
                  </div>
                </>
              )}
            </Field>
          </div>
        )}

        {step === 'context' && (
          <ContextStep
            state={state}
            patch={patch}
            errorFor={errorFor}
            blur={blur}
            onCountryChange={(code) => {
              // « Autre » n'emporte aucun pré-remplissage : on enregistre le
              // choix et on laisse devise et langue à l'utilisateur.
              if (code === OTHER_COUNTRY) {
                patch({ country: code })
                return
              }
              const country = findCountry(code)
              if (!country) return
              // Le pays pré-remplit devise, langue et indicatif — et les
              // applique tout de suite à l'interface pour que le choix soit
              // visible, pas seulement enregistré.
              patch({
                country: code,
                currency: country.currency,
                locale: country.locale,
                dial: country.dial,
              })
              setCurrency(country.currency)
              setLocale(country.locale)
            }}
            onCurrencyChange={(currency) => {
              patch({ currency })
              setCurrency(currency)
            }}
            onLocaleChange={(next) => {
              patch({ locale: next })
              setLocale(next)
            }}
          />
        )}

        {step === 'review' && (
          <ReviewStep state={state} errorFor={errorFor} patch={patch} onEdit={setStepIndex} />
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <Button variant="ghost" size="lg" icon="chevronLeft" onClick={goBack}>
              {t('common.back')}
            </Button>
          ) : (
            <span />
          )}

          <Button
            type="submit"
            size="lg"
            iconAfter={step === 'review' ? undefined : 'arrowRight'}
            loading={submitting}
            disabled={step === 'role' && !state.role}
          >
            {step === 'review' ? t('auth.signup.submit') : t('common.next')}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}

/* -------------------------------------------------------------------------- */

interface StepProps {
  state: SignupState
  patch: (values: Partial<SignupState>) => void
  errorFor: (key: string) => string | undefined
  blur: (key: string, error: FieldError) => () => void
}

function ContextStep({
  state,
  patch,
  errorFor,
  blur,
  onCountryChange,
  onCurrencyChange,
  onLocaleChange,
}: StepProps & {
  onCountryChange: (code: string) => void
  onCurrencyChange: (currency: CurrencyCode) => void
  onLocaleChange: (locale: Locale) => void
}) {
  const t = useT()
  const { locale } = useI18n()
  const countries = useMemo(() => sortedCountries(locale), [locale])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label={t('common.country')}
          required
          hint={state.country === OTHER_COUNTRY ? t('common.countryOtherHint') : undefined}
        >
          {(props) => (
            <Select
              {...props}
              name="country"
              autoComplete="country"
              value={state.country}
              onChange={(e) => onCountryChange(e.target.value)}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {countryName(country, locale)}
                </option>
              ))}
              {/* Épinglé en fin de liste plutôt qu'alphabétisé : ce n'est pas
                  un pays, et il ne doit pas s'intercaler entre l'Autriche et
                  la Belgique. */}
              <option value={OTHER_COUNTRY}>{t('common.countryOther')}</option>
            </Select>
          )}
        </Field>

        <Field label={t('common.currency')}>
          {(props) => (
            <Select
              {...props}
              name="currency"
              value={state.currency}
              onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_DEFS[code].label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('common.language')}>
          {(props) => (
            <Select
              {...props}
              name="locale"
              value={state.locale}
              onChange={(e) => onLocaleChange(e.target.value as Locale)}
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_LABELS[code].long}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {state.role === 'owner' && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <Field
            label={t('auth.signup.parkName')}
            hint={t('auth.signup.parkNameHint')}
            required
            error={errorFor('parkName')}
          >
            {(props) => (
              <Input
                {...props}
                name="parkName"
                value={state.parkName}
                onChange={(e) => patch({ parkName: e.target.value })}
                onBlur={blur('parkName', validateParkName(state.parkName))}
              />
            )}
          </Field>

          <Field label={t('auth.signup.unitCount')} hint={t('auth.signup.unitCountHint')}>
            {(props) => (
              <Select
                {...props}
                name="unitCount"
                value={state.unitCount}
                onChange={(e) => patch({ unitCount: e.target.value })}
              >
                {UNIT_RANGES.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <RadioCards
            legend={t('auth.signup.management')}
            name="delegates"
            columns={2}
            value={state.delegates}
            onChange={(delegates: 'solo' | 'delegate') => patch({ delegates })}
            options={[
              {
                value: 'solo',
                title: t('auth.signup.manageSolo'),
                description: t('auth.signup.manageSoloHint'),
                icon: 'shield',
              },
              {
                value: 'delegate',
                title: t('auth.signup.manageDelegate'),
                description: t('auth.signup.manageDelegateHint'),
                icon: 'users',
              },
            ]}
          />
        </div>
      )}

      {state.role === 'manager' && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <Field label={t('auth.signup.company')} hint={t('auth.signup.companyHint')} optional>
            {(props) => (
              <Input
                {...props}
                name="company"
                autoComplete="organization"
                value={state.company}
                onChange={(e) => patch({ company: e.target.value })}
              />
            )}
          </Field>

          <Field
            label={t('auth.signup.ownerCode')}
            hint={t('auth.signup.ownerCodeHint')}
            optional={state.requestAccess}
          >
            {(props) => (
              <Input
                {...props}
                name="ownerCode"
                icon="key"
                placeholder="PROP-0000-0000"
                disabled={state.requestAccess}
                value={state.ownerCode}
                onChange={(e) => patch({ ownerCode: e.target.value.toUpperCase() })}
              />
            )}
          </Field>

          <Checkbox
            label={t('auth.signup.requestAccess')}
            name="requestAccess"
            checked={state.requestAccess}
            onChange={(e) => patch({ requestAccess: e.target.checked, ownerCode: '' })}
          />
        </div>
      )}

      {state.role === 'tenant' && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <p className="flex items-start gap-2.5 rounded-md border border-gold-border bg-gold-tint px-4 py-3 text-body-s text-gold-ink">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            {t('auth.signup.tenantNotice')}
          </p>

          <Field
            label={t('auth.signup.inviteCode')}
            hint={t('auth.signup.inviteCodeHint')}
            required
            error={errorFor('inviteCode')}
          >
            {(props) => (
              <Input
                {...props}
                name="inviteCode"
                icon="key"
                placeholder="LOC-4A7B-92CD"
                autoCapitalize="characters"
                spellCheck={false}
                value={state.inviteCode}
                // Mise en forme au fil de la frappe : l'utilisateur recopie le
                // code d'un SMS sans avoir à placer les tirets lui-même.
                onChange={(e) => patch({ inviteCode: formatInviteCode(e.target.value) })}
                onBlur={blur('inviteCode', validateInviteCode(state.inviteCode))}
                className="font-mono tracking-[0.08em]"
              />
            )}
          </Field>
        </div>
      )}
    </div>
  )
}

function ReviewStep({
  state,
  errorFor,
  patch,
  onEdit,
}: {
  state: SignupState
  errorFor: (key: string) => string | undefined
  patch: (values: Partial<SignupState>) => void
  onEdit: (index: number) => void
}) {
  const t = useT()
  const { locale } = useI18n()
  const country = findCountry(state.country)

  const rows: { label: string; value: string; step: number }[] = [
    { label: t('auth.signup.summaryRole'), value: t(`roles.${state.role ?? 'owner'}.name` as 'roles.owner.name'), step: 0 },
    { label: t('auth.signup.summaryName'), value: state.name, step: 1 },
    { label: t('auth.signup.summaryEmail'), value: state.email, step: 1 },
    { label: t('auth.signup.summaryPhone'), value: `${state.dial} ${state.phone}`, step: 1 },
    {
      label: t('auth.signup.summaryCountry'),
      value: country
        ? countryName(country, locale)
        : state.country === OTHER_COUNTRY
          ? t('common.countryOther')
          : '—',
      step: 2,
    },
    { label: t('auth.signup.summaryCurrency'), value: CURRENCY_DEFS[state.currency].label, step: 2 },
    { label: t('auth.signup.summaryLanguage'), value: LOCALE_LABELS[state.locale].long, step: 2 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Card flush className="overflow-hidden">
        <dl className="divide-y divide-divider">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-4 px-4 py-3">
              <dt className="eyebrow w-32 shrink-0 text-muted">{row.label}</dt>
              <dd className="min-w-0 flex-1 truncate text-body font-medium">{row.value || '—'}</dd>
              {/* Chaque ligne est corrigeable sans repasser par tout le fil. */}
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-label font-semibold text-gold-ink hover:text-gold-ink-hover"
              >
                {t('common.edit')}
              </button>
            </div>
          ))}
        </dl>
      </Card>

      <div className="flex flex-col gap-1">
        <Checkbox
          label={t('auth.signup.terms')}
          name="terms"
          checked={state.terms}
          onChange={(e) => patch({ terms: e.target.checked })}
          error={errorFor('terms')}
        />
        <Checkbox
          label={t('auth.signup.newsletter')}
          name="newsletter"
          checked={state.newsletter}
          onChange={(e) => patch({ newsletter: e.target.checked })}
        />
      </div>
    </div>
  )
}

function SignupSuccess({ role }: { role: Role | null }) {
  const t = useT()

  return (
    <AuthLayout title={t('auth.signup.successTitle')}>
      <div className="flex flex-col gap-6">
        <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
          <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
          {t('auth.signup.successBody', {
            role: t(`roles.${role ?? 'owner'}.name` as 'roles.owner.name').toLowerCase(),
          })}
        </p>

        <Button size="lg" fullWidth to="/app" iconAfter="arrowRight">
          {t('auth.signup.goToDashboard')}
        </Button>
      </div>
    </AuthLayout>
  )
}

export { ROLE_SLUGS }
