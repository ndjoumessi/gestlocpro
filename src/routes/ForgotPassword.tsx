import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { Notice } from '@/components/primitives/Notice'
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
  const [resending, setResending] = useState(false)

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

  /**
   * ═══ « RENVOYER LE LIEN » N'ENVOYAIT RIEN ═══
   *
   * Le bouton faisait `setSent(false)` : il RAMENAIT AU FORMULAIRE, adresse
   * pré-remplie, et il fallait presser « Envoyer le lien » une seconde fois. Le
   * libellé est pourtant un impératif au singulier — il promet un envoi, pas un
   * retour en arrière. C'est la classe de défaut que ce dépôt a déjà nommée sur
   * le bouton « Nous contacter » de la grille de tarifs : le seul geste offert
   * promettait quelque chose qui n'avait pas lieu.
   *
   * ═══ LA CONFIRMATION NE PEUT PAS DIRE QUE LE COURRIEL EST PARTI ═══
   *
   * `POST /auth/forgot` rend 202 que l'adresse existe ou non — c'est délibéré,
   * et écrit côté serveur : « le client n'apprend rien de l'existence du compte,
   * pas même par le code de statut ». Une confirmation « Lien renvoyé » romprait
   * cette discipline depuis l'écran, en affirmant ce que la réponse se refuse à
   * dire. D'où « Demande renvoyée » : c'est la DEMANDE qui est repartie, ce que
   * l'on sait, et cela ne renseigne sur personne.
   *
   * Ton neutre et non `ok`, pour la même raison : un vert coche un succès, et le
   * succès dont il s'agirait — un courriel reçu — n'est pas connu ici.
   */
  const renvoyer = () => {
    setResending(true)
    void api
      .forgotPassword(email)
      .then(() => notify(t('auth.forgot.resent')))
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
      .finally(() => setResending(false))
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
          <Notice tone="ok" forte>
            {/* Formulation volontairement conditionnelle : confirmer qu'un
                compte existe pour une adresse donnée renseignerait un attaquant
                sur la liste des comptes. */}
            {t('auth.forgot.sentBody', { email })}
          </Notice>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={resending}
            onClick={renvoyer}
          >
            {t('auth.forgot.resend')}
          </Button>

          {/*
            LE RETOUR AU FORMULAIRE REDEVIENT UN GESTE À LUI.

            Rendre le bouton honnête lui retirait sa fonction d'origine, et le
            cas qu'elle servait est réel : l'adresse est ÉCRITE au-dessus, dans
            la note, précisément pour qu'on la relise — et donc pour qu'on y
            voie sa faute de frappe. Sans cette sortie, la corriger demanderait
            de repasser par la connexion puis par « mot de passe oublié », et de
            tout retaper.

            `min-h-11` : la cible tactile de 44 px vaut aussi pour un lien de
            texte. Elle n'est mesurée par aucune porte ici — cet état ne se rend
            qu'après une soumission, et le balayage ne soumet rien.
          */}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="-mt-1 inline-flex min-h-11 cursor-pointer items-center self-center rounded-md px-2 text-body text-muted transition-colors duration-150 hover:text-ink"
          >
            {t('auth.forgot.wrongEmail')}
          </button>
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
