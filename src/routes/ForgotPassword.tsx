import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import { validateEmail, type FieldError } from '@/features/auth/validation'
import { api } from '@/api/client'
import { useToast } from '@/components/primitives/Toast'

export function ForgotPassword() {
  const t = useT()
  const { notify } = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<FieldError>(null)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const next = validateEmail(email)
    setError(next)
    setTouched(true)
    if (next) {
      // Même geste que sur les trois autres écrans du parcours : le focus
      // revient au champ fautif après l'échec de la soumission. Un seul champ
      // ici ne rend pas le geste inutile — sans lui, le focus reste sur le
      // bouton et un clavier ou un lecteur d'écran doit chercher le champ à
      // la main, alors que `Login.tsx` et `ResetPassword.tsx` le lui évitent.
      document.querySelector<HTMLInputElement>('[name="email"]')?.focus()
      return
    }

    setSubmitting(true)
    /**
     * L'écran ne bascule QU'APRÈS que la demande est partie.
     *
     * Un `setTimeout` tenait ce rôle : il annonçait un envoi qui n'avait jamais
     * lieu, et la mécanique qui aurait dû le suivre n'existait pas côté
     * serveur. C'est le mensonge que ce lot retire.
     *
     * L'échec RÉSEAU se dit, et lui seul : le serveur rend le même 202 que
     * l'adresse existe ou non, si bien qu'aucune réponse ne peut trahir un
     * compte. Seule une requête qui ne part pas mérite d'être signalée, et elle
     * ne renseigne sur personne.
     */
    void api
      .forgotPassword(email)
      .then(() => setSent(true))
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
      .finally(() => setSubmitting(false))
  }

  const backLink = (
    <Link
      to="/connexion"
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-semibold text-accent-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-accent-ink-hover"
    >
      <Icon name="chevronLeft" size={15} />
      {t('auth.forgot.backToLogin')}
    </Link>
  )

  if (sent) {
    return (
      <AuthLayout title={t('auth.forgot.sentTitle')} footer={backLink}>
        <div className="flex flex-col gap-6">
          <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
            <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
            {/* Formulation volontairement conditionnelle : confirmer qu'un
                compte existe pour une adresse donnée renseignerait un attaquant
                sur la liste des comptes. */}
            {t('auth.forgot.sentBody', { email })}
          </p>

          <Button variant="secondary" size="lg" fullWidth onClick={() => setSent(false)}>
            {t('auth.forgot.resend')}
          </Button>

        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={backLink}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label={t('common.email')}
          required
          error={touched && error ? t(error) : undefined}
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
                setTouched(true)
                setError(validateEmail(email))
              }}
            />
          )}
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.forgot.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
