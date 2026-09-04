import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Checkbox } from '@/components/primitives/Choice'
import { Input, PasswordInput } from '@/components/primitives/Input'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT, type MessageKey } from '@/i18n/I18nProvider'
import { ApiError, NetworkError } from '@/api/client'
import { useSession } from '@/api/SessionProvider'
import { validateEmail, validatePassword, type FieldError } from '@/features/auth/validation'
import { ecrireStockage, effacerStockage, lireStockage } from '@/lib/stockage'
import { adresseOuverteAuRole } from '@/app/adressesParRole'

/**
 * La mémoire du choix, sur CETTE machine.
 *
 * `local` et non `session` : `sessionStorage` meurt avec l'onglet, donc la
 * préférence serait oubliée juste avant le moment où elle sert. Les trois accès
 * passent par `lib/stockage`, qui absorbe le refus d'accès — navigation privée,
 * blocage des données de site — plutôt que de faire échouer le montage de
 * l'écran de connexion pour une préférence.
 */
const CLE_APPAREIL_RETENU = 'gestlocpro.session.persistante'
const OUI = 'oui'
const NON = 'non'

/**
 * L'ADRESSE RETENUE — et le mot de passe JAMAIS.
 *
 * Le lot précédent refusait de la garder : « retenir l'identifiant sur la
 * machine qu'on vient de déclarer partagée le dirait au suivant ». L'argument
 * est juste, et il ne vaut QUE dans le cas décoché. Cochée, la case dit
 * l'inverse — cet appareil est à moi. Refuser là aussi offrait une case qui
 * promet la continuité sans la donner, ce qui est le défaut que cet écran a
 * mis trois lots à perdre.
 *
 * LE MOT DE PASSE N'EST PAS ICI, et ne le sera pas. Un secret rangé dans
 * `localStorage` est à la portée de la première injection de script — c'est
 * l'argument même qui fait porter la session par un cookie `httpOnly` plutôt
 * que par ce stockage, écrit dans `auth/session.ts`. Le gestionnaire du
 * navigateur le garde déjà, chiffré, sous le contrôle de son propriétaire ; les
 * attributs `autoComplete` de ce formulaire sont posés pour qu'il le puisse.
 */
const CLE_ADRESSE_RETENUE = 'gestlocpro.session.adresse'

export function Login() {
  const t = useT()
  const navigate = useNavigate()
  const { notify } = useToast()
  const { connecter, etat } = useSession()
  const location = useLocation()

  /**
   * L'adresse voulue, ou le tableau de bord.
   *
   * Elle est validée avant d'être suivie : une valeur d'état de navigation
   * vient du client, et rediriger vers ce qu'elle contient ouvrirait une
   * redirection ouverte — un lien vers `/connexion` portant un état pointant
   * sur un site tiers renverrait l'utilisateur dehors juste après qu'il ait
   * saisi son mot de passe. On n'accepte donc qu'un chemin interne.
   */
  const demandee = (location.state as { from?: unknown } | null)?.from
  const destination =
    typeof demandee === 'string' && /^\/app(?:[/?]|$)/.test(demandee) ? demandee : '/app'


  const [email, setEmail] = useState(() => lireStockage('local', CLE_ADRESSE_RETENUE) ?? '')
  const [password, setPassword] = useState('')
  /**
   * « RESTER CONNECTÉ SUR CET APPAREIL », ET ELLE COMMANDE VRAIMENT.
   *
   * Une case du même libellé a vécu ici, cochable, que rien ne lisait — voir
   * `caseControlee.test.tsx`, qui garde cette leçon et refuse toute case du
   * formulaire dont l'état n'est pas lu. Celle-ci porte son `checked`, son
   * `onChange`, et son choix voyage jusqu'au serveur.
   *
   * ═══ LE CHOIX APPARTIENT À L'APPAREIL, PAS À LA VISITE ═══
   *
   * DÉFAUT SIGNALÉ EN PRODUCTION, ET PAYÉ DANS LE LOT PRÉCÉDENT : la case
   * naissait cochée à CHAQUE montage. Décochée, déconnexion, rechargement —
   * elle revenait cochée, à côté de champs vides qui, eux, n'avaient rien
   * gardé. Or cette case n'existe QUE pour le poste partagé, c'est-à-dire
   * exactement la machine où le choix doit tenir : pour que celui qui a décoché
   * hier ne recommence pas chaque matin, et pour que le SUIVANT n'hérite pas
   * d'une case cochée sur un poste déjà déclaré partagé.
   *
   * Une préférence qu'il faut redire à chaque visite n'est pas une préférence.
   *
   * L'absence vaut « oui » : une machine qui n'a jamais rien dit est une
   * machine ordinaire, et le défaut du produit reste la continuité.
   *
   * ON NE RETIENT QUE CE BOOLÉEN. Pas l'adresse : la garder sur la machine
   * qu'on vient de déclarer partagée dirait au suivant qui s'y connecte, ce qui
   * est le contraire exact de ce que la case demande. Le gestionnaire de mots
   * de passe du navigateur le fait déjà, sous le contrôle de son propriétaire.
   */
  const [persistante, setPersistante] = useState(
    () => lireStockage('local', CLE_APPAREIL_RETENU) !== NON,
  )
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
      const role = await connecter(email, password, persistante)
      /* ON RETIENT APRÈS COUP, JAMAIS À LA FRAPPE. Une adresse rangée avant
         d'être éprouvée serait une faute de frappe conservée pour toujours,
         resservie à chaque visite — et l'écran reprocherait alors un
         identifiant qu'il a lui-même proposé. */
      if (persistante) ecrireStockage('local', CLE_ADRESSE_RETENUE, email)
      notify(t('auth.login.success'), { tone: 'ok' })
      /**
       * Retour à l'adresse demandée, posée par la barrière d'accès.
       *
       * Sans elle, quelqu'un qui ouvre un lien vers `/app/cautions` atterrit
       * sur le tableau de bord et doit refaire le chemin — sur un lien reçu
       * par message, il ne sait même pas où il allait.
       *
       * `replace` : la page de connexion sort de l'historique. Le bouton
       * « retour » du navigateur y ramènerait sinon un utilisateur désormais
       * authentifié, devant un formulaire qui n'a plus lieu d'être.
       */
      /**
       * ET SEULEMENT SI CE RÔLE PEUT L'ATTEINDRE.
       *
       * L'adresse est retenue par la barrière AVANT que le rôle soit connu : un
       * poste partagé où le locataire s'est connecté la veille, un lien vers
       * `/app/mon-espace` transmis à la mauvaise personne, un onglet resté
       * ouvert. Le propriétaire se connectait, la barrière le renvoyait
       * fidèlement où il « allait », et le garde de rôle — juste, lui — lui
       * rendait « Écran introuvable ». Capturé en production : sa première
       * seconde dans le produit était un mur, sous une barre latérale complète.
       *
       * On ne desserre AUCUN garde pour autant. L'adresse tapée à la main rend
       * toujours son 404, qui est la vérité ; ce qu'on cesse d'infliger, c'est
       * un mur à quelqu'un qui n'a rien demandé d'autre que d'entrer.
       */
      navigate(adresseOuverteAuRole(destination, role) ? destination : '/app', { replace: true })
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

  /**
   * DÉJÀ CONNECTÉ : ON NE REDEMANDE PAS UN MOT DE PASSE.
   *
   * Cet écran rendait son formulaire à une session OUVERTE. Le parcours capturé
   * en production : un locataire dans son espace clique « Retour au site »,
   * arrive sur la vitrine, clique « Se connecter » — et lit un champ de mot de
   * passe vide sous son adresse pré-remplie. Il en conclut ce que n'importe qui
   * en conclurait, et il a tort : « Retour au site » est un lien, pas une
   * déconnexion, et son cookie est intact.
   *
   * L'ADRESSE PRÉ-REMPLIE RENDAIT LE MENSONGE PLUS CRÉDIBLE : elle vient de
   * l'e-mail mémorisé, jamais d'une session.
   *
   * APRÈS TOUS LES HOOKS, ET C'EST LE LINTER QUI ME L'A APPRIS. Posé en tête
   * de composant, ce retour rendait SEPT `useState` conditionnels — « React
   * Hooks must be called in the exact same order in every render ». Mes quatre
   * cas passaient au vert : ils montent l'écran avec un état déjà fixé, et ne
   * voient donc jamais l'ordre changer. Une session qui s'ouvre pendant que
   * l'écran est monté, elle, casse le rendu.
   *
   * `destination` PLUTÔT QUE `/app` : une barrière a pu retenir l'adresse
   * voulue, et elle est déjà validée au-dessus contre la redirection ouverte.
   * `replace` : cet écran n'est pas une étape du parcours de quelqu'un qui
   * n'avait rien à y faire.
   */
  if (etat.statut === 'connecte') return <Navigate to={destination} replace />

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          {/* `data-cible` : ce lien vit DANS une phrase, sa hauteur est celle de
              la ligne de texte qui le porte. L'agrandir à 44 px casserait
              l'interligne du paragraphe. WCAG 2.5.8 nomme l'exception ; la
              garde de `mesure-ui` la lit ici plutôt que de la deviner. */}
          <Link
            to="/inscription"
            data-cible="dans-une-phrase"
            className="font-semibold text-accent-ink hover:text-accent-ink-hover"
          >
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
          <Notice tone="danger" role="alert">
            {t(echec)}
          </Notice>
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
          /* LE LIEN REJOINT SON CHAMP. Il flottait seul entre le champ et le
             bouton d'envoi, à mi-chemin des deux, séparant le dernier champ de
             l'action qui le suit. Sur la ligne d'étiquette, il désigne le mot
             de passe dont il parle et ne coupe plus rien.

             LE LIEN GARDE SES 44 px, ET LA RANGÉE LES PREND. Une première
             rédaction les rattrapait par `-my-2`, pour ne pas écarter
             l'étiquette du champ : mesuré, le lien débordait alors de 8 px de
             sa rangée, en haut comme en bas, sur vingt-deux points du balayage.
             Une marge négative ne réduit pas une cible, elle la fait sortir.

             `-mr-2` est parti pour la même raison, et c'était lui le coupable :
             il tirait le lien huit pixels au-delà du bord droit de sa rangée
             pour aligner optiquement son rembourrage sur celui du champ. Le
             rembourrage l'écarte donc un peu du bord ; c'est le prix d'une
             boîte qui reste dans la sienne. */
          action={
            <Link
              to="/mot-de-passe-oublie"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-body font-medium text-accent-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-accent-ink-hover"
            >
              {t('auth.forgotPassword')}
            </Link>
          }
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

        {/*
          LA CASE VIT ENTRE LE MOT DE PASSE ET L'ENVOI, et pas ailleurs.

          C'est le dernier choix avant de confier ses identifiants, et il porte
          sur ce qu'il advient d'eux. Le poser après le bouton le ferait lire
          APRÈS la décision qu'il informe ; le poser plus haut le séparerait de
          l'action qu'il modifie.

          `Checkbox` fournit déjà la cible de 44 px et rattache son aide par
          `aria-describedby` — l'aide dit la durée, parce qu'une case dont on
          ignore ce qu'elle change est une case qu'on laisse comme on la
          trouve.
        */}
        <Checkbox
          label={t('auth.login.remember')}
          hint={t('auth.login.rememberHint')}
          checked={persistante}
          onChange={(e) => {
            setPersistante(e.target.checked)
            /* Écrit au CHANGEMENT et non à l'envoi : quelqu'un qui décoche puis
               renonce à se connecter a tout de même déclaré la machine. C'est
               le renseignement qui compte, pas la connexion qui le suit. */
            ecrireStockage('local', CLE_APPAREIL_RETENU, e.target.checked ? OUI : NON)
            /* DÉCOCHER EFFACE LA TRACE, il ne se contente pas de cesser
               d'écrire. C'est un geste de RETRAIT : sans cela, quelqu'un qui
               décoche par prudence laisserait quand même son identifiant
               derrière lui, et la case mentirait dans la direction la plus
               grave qui soit.

               MAIS IL NE TOUCHE PAS AU CHAMP, et la première rédaction s'y est
               trompée — elle le vidait « pour donner à voir ce qui vient d'être
               fait ». `sessionDeCetAppareil.test.tsx` l'a dit aussitôt : son
               cas tape l'adresse, tape le mot de passe, puis décoche, et la
               connexion n'est jamais partie. C'est le geste ORDINAIRE — on
               décoche au milieu de sa saisie parce qu'on se souvient que le
               poste est partagé — et il effaçait le travail en cours. Ce qui
               est à l'écran appartient à celui qui le tape ; ce qui est rangé
               sur la machine, non. */
            if (!e.target.checked) effacerStockage('local', CLE_ADRESSE_RETENUE)
          }}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.login.submit')}
        </Button>

      </form>
    </AuthLayout>
  )
}
