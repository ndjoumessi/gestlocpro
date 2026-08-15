import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { PasswordInput, PasswordStrength } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import {
  isValidResetToken,
  validatePassword,
  validatePasswordConfirmation,
  type FieldError,
} from '@/features/auth/validation'

/**
 * Réinitialisation du mot de passe.
 *
 * L'écran manquait : la page « mot de passe oublié » annonçait « un lien de
 * réinitialisation valable une heure » et ce lien ne menait nulle part. Une
 * promesse sans destination.
 *
 * Le jeton se lit dans l'URL. Absent ou mal formé, on affiche l'écran « lien
 * expiré » avec le moyen d'en redemander un — plutôt qu'un formulaire qui
 * échouerait à l'envoi, après que l'utilisateur a choisi et retapé un mot de
 * passe pour rien.
 */
export function ResetPassword() {
  const t = useT()
  const [params] = useSearchParams()
  const token = params.get('jeton')

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ password: FieldError; confirmation: FieldError }>({
    password: null,
    confirmation: null,
  })
  const [touched, setTouched] = useState({ password: false, confirmation: false })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (!isValidResetToken(token)) {
    return (
      <AuthLayout title={t('auth.reset.invalidTitle')}>
        <div className="flex flex-col gap-6">
          <p className="flex items-start gap-3 rounded-lg border border-warn-border bg-warn-tint px-4 py-3.5 text-body text-warn">
            <Icon name="clock" size={18} className="mt-0.5 shrink-0" />
            {t('auth.reset.invalidBody')}
          </p>

          <Button size="lg" fullWidth to="/mot-de-passe-oublie" iconAfter="arrowRight">
            {t('auth.reset.askAnother')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title={t('auth.reset.successTitle')}>
        <div className="flex flex-col gap-6">
          <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
            <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
            {t('auth.reset.successBody')}
          </p>

          <Button size="lg" fullWidth to="/connexion" iconAfter="arrowRight">
            {t('auth.reset.goToLogin')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const next = {
      password: validatePassword(password, { requireStrong: true }),
      confirmation: validatePasswordConfirmation(confirmation, password),
    }
    setErrors(next)
    setTouched({ password: true, confirmation: true })

    if (next.password || next.confirmation) {
      const cible = next.password ? 'password' : 'confirmation'
      document.querySelector<HTMLInputElement>(`[name="${cible}"]`)?.focus()
      return
    }

    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 700)
  }

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={
        // Lien autonome et non inséré dans une phrase : il porte donc une
        // cible de 44px, comme celui de la page de connexion.
        <Link
          to="/connexion"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-semibold text-gold-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-gold-ink-hover"
        >
          <Icon name="chevronLeft" size={15} />
          {t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label={t('auth.reset.newPassword')}
          required
          error={touched.password && errors.password ? t(errors.password) : undefined}
        >
          {(props) => (
            <>
              <PasswordInput
                {...props}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => {
                  setTouched((s) => ({ ...s, password: true }))
                  setErrors((s) => ({
                    ...s,
                    password: validatePassword(password, { requireStrong: true }),
                  }))
                }}
              />
              <div className="mt-2.5">
                <PasswordStrength value={password} />
              </div>
            </>
          )}
        </Field>

        <Field
          label={t('auth.reset.confirm')}
          hint={t('auth.reset.confirmHint')}
          required
          error={touched.confirmation && errors.confirmation ? t(errors.confirmation) : undefined}
        >
          {(props) => (
            <PasswordInput
              {...props}
              name="confirmation"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, confirmation: true }))
                setErrors((s) => ({
                  ...s,
                  confirmation: validatePasswordConfirmation(confirmation, password),
                }))
              }}
            />
          )}
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.reset.submit')}
        </Button>

        <p className="flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('auth.reset.demoNotice')}
        </p>
      </form>
    </AuthLayout>
  )
}
