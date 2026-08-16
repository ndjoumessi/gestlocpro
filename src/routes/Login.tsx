import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, PasswordInput } from '@/components/primitives/Input'
import { Checkbox } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useT, type MessageKey } from '@/i18n/I18nProvider'
import { ApiError, NetworkError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'
import { validateEmail, validatePassword, type FieldError } from '@/features/auth/validation'

export function Login() {
  const t = useT()
  const navigate = useNavigate()
  const { notify } = useToast()
  const { connecter } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email: FieldError; password: FieldError }>({
    email: null,
    password: null,
  })
  // `touched` porte la règle `inline-validation` : on ne signale une erreur
  // qu'après que l'utilisateur a quitté le champ, jamais pendant la frappe.
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitting, setSubmitting] = useState(false)
  /** Échec de l'appel, distinct des erreurs de saisie champ par champ. */
  const [echec, setEchec] = useState<MessageKey | null>(null)

  const validate = () => ({
    email: validateEmail(email),
    password: validatePassword(password),
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    setTouched({ email: true, password: true })

    if (next.email || next.password) {
      // `focus-management` : on ramène le curseur sur le premier champ fautif.
      const target = next.email ? 'email' : 'password'
      document.querySelector<HTMLInputElement>(`[name="${target}"]`)?.focus()
      return
    }

    setSubmitting(true)
    setEchec(null)
    try {
      await connecter(email, password)
      notify(t('auth.login.success'), { tone: 'ok' })
      navigate('/app')
    } catch (err) {
      /**
       * L'échec porte sur le FORMULAIRE, pas sur un champ.
       *
       * Le serveur ne dit délibérément pas lequel des deux est faux : les
       * distinguer transformerait la connexion en oracle d'existence de
       * comptes. Poser l'erreur sous le champ e-mail rétablirait à l'écran ce
       * que l'API refuse de dire.
       */
      if (err instanceof NetworkError) {
        setEchec('auth.login.errorOffline')
      } else if (err instanceof ApiError && err.status === 401) {
        setEchec('auth.login.errorCredentials')
      } else {
        setEchec('auth.login.errorUnexpected')
      }
      // Le curseur revient au début du formulaire : l'erreur est au-dessus du
      // bouton, hors du champ de vision de qui vient de cliquer.
      document.querySelector<HTMLInputElement>('[name="email"]')?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/inscription" className="font-semibold text-gold-ink hover:text-gold-ink-hover">
            {t('auth.signUp')}
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {/* `role="alert"` : l'échec est annoncé, pas seulement affiché. Sans
            cela, un utilisateur de lecteur d'écran entend la fin du chargement
            du bouton et rien d'autre — le formulaire semble n'avoir rien fait. */}
        {echec && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-tint px-3.5 py-3 text-body-s text-danger"
          >
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {t(echec)}
          </p>
        )}

        <Field
          label={t('common.email')}
          required
          error={touched.email ? (errors.email ? t(errors.email) : undefined) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              icon="mail"
              autoComplete="email"
              placeholder={t('common.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, email: true }))
                setErrors((s) => ({ ...s, email: validateEmail(email) }))
              }}
            />
          )}
        </Field>

        <Field
          label={t('common.password')}
          required
          error={touched.password ? (errors.password ? t(errors.password) : undefined) : undefined}
        >
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, password: true }))
                setErrors((s) => ({ ...s, password: validatePassword(password) }))
              }}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox label={t('auth.login.remember')} name="remember" />
          {/* Lien autonome et non inséré dans une phrase : il porte donc une
              cible de 44px, contrairement aux liens en ligne du pied de carte
              que l'exception « lien dans un bloc de texte » couvre. */}
          <Link
            to="/mot-de-passe-oublie"
            className="-mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-body font-medium text-gold-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-gold-ink-hover"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.login.submit')}
        </Button>

      </form>
    </AuthLayout>
  )
}
