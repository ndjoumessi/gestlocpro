import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Stepper } from '@/features/auth/Stepper'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, PasswordInput, PasswordStrength, Select } from '@/components/primitives/Input'
import { Checkbox, RadioCards } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { Card } from '@/components/primitives/Card'
import { useI18n, useT, type MessageKey } from '@/i18n/I18nProvider'
import { ApiError, NetworkError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales'
import type { Locale } from '@/i18n/locales'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCIES, CURRENCY_DEFS, type CurrencyCode } from '@/currency/currencies'
import {
  OTHER_COUNTRY,
  countryName,
  findCountry,
  sortedCountries,
  dialOptions,
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
  const { locale, setLocale, setRegion } = useI18n()
  const { currency, setCurrency } = useCurrency()
  const { inscrire } = useSession()
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
  /** Échec de l'appel, distinct des erreurs de saisie champ par champ. */
  const [echec, setEchec] = useState<MessageKey | null>(null)

  const step: StepKey = STEP_KEYS[stepIndex]
  const patch = (values: Partial<SignupState>) => setState((s) => ({ ...s, ...values }))

  const steps = useMemo(
    () => STEP_KEYS.map((key) => t(`auth.signup.steps.${key}` as 'auth.signup.steps.role')),
    [t],
  )

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

  /**
   * Crée réellement le compte.
   *
   * L'assistant validait neuf champs puis faisait `setDone(true)` : le mot de
   * passe, l'acceptation des conditions, le pays, la langue, le nom du parc —
   * tout était jeté à la dernière étape. Le succès affiché ne recouvrait rien.
   */
  const creerLeCompte = async () => {
    setSubmitting(true)
    setEchec(null)
    try {
      await inscrire({
        email: state.email.trim(),
        password: state.password,
        fullName: state.name.trim(),
        // Le couple indicatif + numéro devient un E.164 unique : c'est la forme
        // que le serveur exige, et la seule qui se compose sans ambiguïté.
        ...(state.phone.trim()
          ? { phoneE164: `${state.dial}${state.phone.replace(/\D/g, '')}` }
          : {}),
        // `OTHER` est une sentinelle d'interface — « mon pays n'est pas dans la
        // liste » — et non un code ISO 3166-1. L'envoyer faisait échouer
        // l'inscription sur `length(2)`, et l'écran n'annonçait qu'une « erreur
        // inattendue » : le seul champ fautif était celui dont on ne parlait
        // pas. Un pays inconnu est une absence de pays, pas un pays nommé
        // « OTHER ».
        ...(state.country && state.country !== OTHER_COUNTRY
          ? { countryCode: state.country }
          : {}),
        locale,
        acceptTerms: true,
        newsletterOptIn: state.newsletter,
        // Le nom du parc était saisi, validé, puis affiché au récapitulatif —
        // et jeté à l'envoi. Le compte se créait sans parc, et le propriétaire
        // arrivait sur une application qui lui montrait le jeu de
        // démonstration : rien ne signalait que son parc n'existait pas.
        // Seul un propriétaire en fonde un ; les autres rejoignent celui d'un
        // tiers par invitation.
        ...(state.role === 'owner' && state.parkName.trim()
          ? { parkName: state.parkName.trim() }
          : {}),
      })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        /**
         * L'adresse est déjà prise : on ramène à l'étape « Vos informations ».
         *
         * Afficher l'erreur sur le récapitulatif la poserait là où le champ
         * n'existe pas — l'utilisateur lirait le problème sans pouvoir le
         * corriger, et devrait deviner qu'il faut revenir en arrière.
         */
        setErrors((s) => ({ ...s, email: 'auth.signup.emailTaken' }))
        setTouched((s) => ({ ...s, email: true }))
        setStepIndex(STEP_KEYS.indexOf('identity'))
        window.scrollTo({ top: 0 })
        return
      }
      setEchec(
        err instanceof NetworkError ? 'auth.signup.errorOffline' : 'auth.signup.errorUnexpected',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (step === 'role' && !state.role) return

    const next = validateStep(step)
    setErrors(next)
    setTouched((s) => ({ ...s, ...Object.fromEntries(Object.keys(next).map((k) => [k, true])) }))

    const firstBad = Object.entries(next).find(([, error]) => error !== null)
    if (firstBad) {
      /**
       * Le refus doit se lire LÀ OÙ L'ON VIENT DE CLIQUER.
       *
       * Le message existait déjà — « Vous devez accepter les conditions » —
       * mais uniquement à côté de la case, cent cinquante pixels au-dessus du
       * bouton. Le regard reste où le doigt a cliqué : l'utilisateur conclut
       * que le bouton ne fait rien, et il n'a pas tort de le conclure, puisque
       * rien ne change dans la zone qu'il observe.
       *
       * C'est arrivé pour de vrai, sur le premier compte du produit. Un bouton
       * principal qui paraît inerte est la pire des pannes : il n'y a rien à
       * lire, donc rien à corriger.
       */
      const champ = document.querySelector<HTMLElement>(`[name="${firstBad[0]}"]`)
      // `scrollIntoView` n'existe pas sous jsdom : l'appel est facultatif pour
      // que les tests n'aient pas à simuler une capacité du navigateur.
      champ?.scrollIntoView?.({ block: 'center' })
      champ?.focus()
      setEchec(firstBad[1])
      return
    }

    if (step === 'review') {
      void creerLeCompte()
      return
    }

    // Le message disparaît quand on avance : le garder afficherait le reproche
    // d'une étape précédente au-dessus d'un formulaire déjà corrigé.
    setEchec(null)

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
      // L'étape seule ne situe pas : « Vos informations » peut être n'importe
      // quel formulaire. Le titre d'onglet nomme le parcours.
      documentTitle={`${steps[stepIndex]} — ${t('auth.signup.title')}`}
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
                  placeholder={t('common.emailPlaceholder')}
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
                      reste modifiable : on peut résider ailleurs que son parc.

                      La largeur est portée par cette enveloppe et non par le
                      `<select>` : `Select` applique déjà `w-full` sur l'élément
                      interne, et deux utilitaires de largeur concurrents se
                      départagent par l'ordre du CSS généré, pas par l'ordre des
                      classes. Le champ tombait à 68px pour 52px de rembourrage,
                      et « +237 » n'avait plus la place de s'afficher. */}
                  {/* Élargi de 112 à 176px : l'étiquette porte désormais le
                      pays avant l'indicatif, et « Cameroun · +237 » ne tient
                      pas dans la largeur d'un nombre à quatre caractères. */}
                  <div className="w-44 shrink-0">
                    <Select
                      aria-label={t('common.dialCode')}
                      value={state.dial}
                      onChange={(e) => patch({ dial: e.target.value })}
                    >
                      {dialOptions(locale).map(({ dial, label }) => (
                        <option key={dial} value={dial}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
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
                // Pas de pays connu : on efface la région pour retomber sur le
                // repli de formatage plutôt que d'en inventer une.
                setRegion(null)
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
              // Le pays pilote aussi le format des dates : en-US rend 08/12
              // quand en-GB rend 12/08, et fr-CA rend 2026-08-12.
              setRegion(country.code)
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

        {/* Annoncé et non seulement affiché : sans `role="alert"`, un
            utilisateur de lecteur d'écran entend la fin du chargement du bouton
            et rien d'autre — l'assistant semble n'avoir rien fait. */}
        {echec && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-tint px-3.5 py-3 text-body-s text-danger"
          >
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {t(echec)}
          </p>
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

  /**
   * Les réponses propres au rôle manquaient au récapitulatif.
   *
   * L'écran annonce « dernière vérification avant la création de votre
   * espace », et taisait pourtant trois des réponses saisies juste avant : le
   * nom du parc, le nombre d'unités et le mode de gestion pour un
   * propriétaire, le cabinet et le code pour un gestionnaire, le code
   * d'invitation pour un locataire. Une vérification qui omet ce qu'on vient
   * de taper n'en est pas une — et c'est le nom du parc qui s'affichera en
   * tête de l'espace.
   */
  if (state.role === 'owner') {
    rows.push(
      { label: t('auth.signup.summaryPark'), value: state.parkName, step: 2 },
      { label: t('auth.signup.summaryUnits'), value: state.unitCount, step: 2 },
      {
        label: t('auth.signup.summaryManagement'),
        value:
          state.delegates === 'delegate'
            ? t('auth.signup.manageDelegate')
            : t('auth.signup.manageSolo'),
        step: 2,
      },
    )
  } else if (state.role === 'manager') {
    rows.push(
      { label: t('auth.signup.summaryCompany'), value: state.company, step: 2 },
      { label: t('auth.signup.summaryOwnerCode'), value: state.ownerCode, step: 2 },
    )
  } else if (state.role === 'tenant') {
    rows.push({ label: t('auth.signup.summaryInviteCode'), value: state.inviteCode, step: 2 })
  }

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
