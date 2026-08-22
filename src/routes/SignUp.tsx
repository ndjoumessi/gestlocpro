import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Stepper } from "@/features/auth/Stepper";
import { Button } from "@/components/primitives/Button";
import { Field } from "@/components/primitives/Field";
import {
  Input,
  PasswordInput,
  PasswordStrength,
  Select,
} from "@/components/primitives/Input";
import { Combobox } from "@/components/primitives/Combobox";
import { Checkbox, RadioCards } from "@/components/primitives/Choice";
import { Icon } from "@/components/primitives/Icon";
import { Card } from "@/components/primitives/Card";
import { useI18n, useT, type MessageKey } from "@/i18n/I18nProvider";
import { ApiError, NetworkError } from "@/api/client";
import { useSession } from "@/api/SessionProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { useCurrency } from "@/currency/CurrencyProvider";
import {
  CURRENCIES,
  CURRENCY_DEFS,
  type CurrencyCode,
} from "@/currency/currencies";
import {
  OTHER_COUNTRY,
  countryName,
  findCountry,
  countryOptions,
  dialOptions,
  paysDeLIndicatif,
} from "@/lib/countries";
import { INDICATIFS, nomDuPays } from "@/lib/indicatifs";
import {
  formatInviteCode,
  validateEmail,
  validateInviteCode,
  validateCountry,
  validateName,
  validateParkName,
  validatePassword,
  validatePhone,
  type FieldError,
} from "@/features/auth/validation";
import {
  initialSignupState,
  ROLE_SLUGS,
  SLUG_TO_ROLE,
  UNIT_RANGES,
  type Role,
  type SignupState,
} from "@/features/auth/signupState";

const STEP_KEYS = ["role", "identity", "context", "review"] as const;
type StepKey = (typeof STEP_KEYS)[number];

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
  const t = useT();
  const { locale, setLocale, setRegion } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const { inscrire } = useSession();
  const { role: roleSlug } = useParams();

  const presetRole = roleSlug ? (SLUG_TO_ROLE[roleSlug] ?? null) : null;

  const [state, setState] = useState<SignupState>(() =>
    initialSignupState(presetRole, locale, currency),
  );
  const [stepIndex, setStepIndex] = useState(presetRole ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  /** Échec de l'appel, distinct des erreurs de saisie champ par champ. */
  const [echec, setEchec] = useState<MessageKey | null>(null);

  const step: StepKey = STEP_KEYS[stepIndex];
  const patch = (values: Partial<SignupState>) =>
    setState((s) => ({ ...s, ...values }));

  const steps = useMemo(
    () =>
      STEP_KEYS.map((key) =>
        t(`auth.signup.steps.${key}` as "auth.signup.steps.role"),
      ),
    [t],
  );

  /** Erreurs de l'étape courante. */
  function validateStep(current: StepKey): Record<string, FieldError> {
    if (current === "role") {
      return {};
    }

    if (current === "identity") {
      return {
        name: validateName(state.name),
        email: validateEmail(state.email),
        phone: validatePhone(state.phone, state.dial),
        password: validatePassword(state.password, { requireStrong: true }),
      };
    }

    if (current === "context") {
      /**
       * Le PAYS est exigé pour les trois rôles.
       *
       * Il arrivait pré-rempli, déduit de la devise qu'affichait la vitrine, et
       * personne n'avait à le regarder. Le propriétaire y joue la devise de son
       * parc ; le locataire et le gestionnaire, leur indicatif et leur langue.
       * Aucun des trois ne gagne à ce qu'on le devine à sa place.
       */
      const pays = { country: validateCountry(state.country) };
      if (state.role === "owner")
        return { ...pays, parkName: validateParkName(state.parkName) };
      // Le gestionnaire REJOINT un parc, il n'en fonde pas : sans code, le
      // serveur n'a aucune branche pour lui — il crée alors un compte rattaché
      // à rien, sous un écran qui annonce « votre espace est prêt ». Le chemin
      // de repli qu'on invoquait ici n'existait que dans cette phrase.
      if (state.role === "manager")
        return { ...pays, ownerCode: validateInviteCode(state.ownerCode) };
      if (state.role === "tenant")
        return { ...pays, inviteCode: validateInviteCode(state.inviteCode) };
    }

    return { terms: state.terms ? null : "auth.signup.termsError" };
  }

  /**
   * Crée réellement le compte.
   *
   * L'assistant validait neuf champs puis faisait `setDone(true)` : le mot de
   * passe, l'acceptation des conditions, le pays, la langue, le nom du parc —
   * tout était jeté à la dernière étape. Le succès affiché ne recouvrait rien.
   */
  const creerLeCompte = async () => {
    /**
     * UN code d'invitation, sous deux noms de champ.
     *
     * Le gestionnaire saisit le sien dans `ownerCode`, le locataire dans
     * `inviteCode` : deux étiquettes à l'écran, un seul objet côté serveur.
     * L'envoi ne lisait que le second, si bien que le code du gestionnaire
     * était formaté, récapitulé, puis jeté — la faute même que le commentaire
     * ci-dessous déclare corrigée, rejouée sur l'autre branche.
     * `grep ownerCode server/src` ne rend rien : ce nom n'a jamais existé
     * ailleurs que dans cet état local, et rien ne reliait les deux.
     */
    const codeInvitation = (
      state.role === "manager" ? state.ownerCode : state.inviteCode
    ).trim();

    setSubmitting(true);
    setEchec(null);
    try {
      await inscrire({
        email: state.email.trim(),
        password: state.password,
        fullName: state.name.trim(),
        // Le couple indicatif + numéro devient un E.164 unique : c'est la forme
        // que le serveur exige, et la seule qui se compose sans ambiguïté.
        ...(state.phone.trim()
          ? { phoneE164: `${state.dial}${state.phone.replace(/\D/g, "")}` }
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
        ...(state.role === "owner" && state.parkName.trim()
          ? { parkName: state.parkName.trim() }
          : {}),
        // Le code REJOINT un parc, il n'en fonde pas : le serveur traite cette
        // branche en premier et exclusivement. Sans cet envoi, tout invité
        // devenait propriétaire d'un parc vide.
        /**
         * Le code était saisi, formaté au fil de la frappe, validé — et JETÉ à
         * l'envoi. Exactement ce que le commentaire voisin décrit pour le nom du
         * parc : la même faute, sur l'autre branche, et deux ans de tests la
         * gardaient sans jamais vérifier qu'elle partait.
         *
         * Conséquence : tout invité s'inscrivait sans code, tombait dans la
         * branche « fonde un parc » du serveur, et devenait propriétaire d'un
         * parc vide. Deux codes émis n'ont jamais pu être consommés.
         *
         * Le serveur traite cette branche EN PREMIER et exclusivement de la
         * création d'un parc : un code l'emporte sur un nom de parc.
         */
        ...(state.role !== "owner" && codeInvitation
          ? { invitationCode: codeInvitation }
          : {}),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        /**
         * L'adresse est déjà prise : on ramène à l'étape « Vos informations ».
         *
         * Afficher l'erreur sur le récapitulatif la poserait là où le champ
         * n'existe pas — l'utilisateur lirait le problème sans pouvoir le
         * corriger, et devrait deviner qu'il faut revenir en arrière.
         */
        setErrors((s) => ({ ...s, email: "auth.signup.emailTaken" }));
        setTouched((s) => ({ ...s, email: true }));
        setStepIndex(STEP_KEYS.indexOf("identity"));
        window.scrollTo({ top: 0 });
        return;
      }
      setEchec(
        err instanceof NetworkError
          ? "auth.signup.errorOffline"
          : "auth.signup.errorUnexpected",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (step === "role" && !state.role) return;

    const next = validateStep(step);
    setErrors(next);
    setTouched((s) => ({
      ...s,
      ...Object.fromEntries(Object.keys(next).map((k) => [k, true])),
    }));

    const firstBad = Object.entries(next).find(([, error]) => error !== null);
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
      /*
        ON CHERCHE CE QUI SE FOCALISE, pas ce qui porte le nom.

        `[name="pays"]` désignait l'entrée CACHÉE du combobox — celle qui
        transporte le code ISO à la soumission — et un champ caché ne prend pas
        le focus. L'appel ne faisait donc rien, en silence, sur le refus le plus
        fréquent de cet écran. `data-champ` désigne le champ VISIBLE, et
        l'exclusion des entrées cachées couvre le cas général plutôt que ce
        seul composant.
      */
      const champ = document.querySelector<HTMLElement>(
        `[data-champ="${firstBad[0]}"], [name="${firstBad[0]}"]:not([type="hidden"])`,
      );
      // `scrollIntoView` n'existe pas sous jsdom : l'appel est facultatif pour
      // que les tests n'aient pas à simuler une capacité du navigateur.
      champ?.scrollIntoView?.({ block: "center" });
      champ?.focus();
      setEchec(firstBad[1]);
      return;
    }

    if (step === "review") {
      void creerLeCompte();
      return;
    }

    // Le message disparaît quand on avance : le garder afficherait le reproche
    // d'une étape précédente au-dessus d'un formulaire déjà corrigé.
    setEchec(null);

    setStepIndex((i) => i + 1);
    window.scrollTo({ top: 0 });
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
    window.scrollTo({ top: 0 });
  };

  const errorFor = (key: string) =>
    touched[key] && errors[key] ? t(errors[key]!) : undefined;

  const blur = (key: string, error: FieldError) => () => {
    setTouched((s) => ({ ...s, [key]: true }));
    setErrors((s) => ({ ...s, [key]: error }));
  };

  if (done) {
    return <SignupSuccess role={state.role} />;
  }

  return (
    <AuthLayout
      wide
      // L'étape seule ne situe pas : « Vos informations » peut être n'importe
      // quel formulaire. Le titre d'onglet nomme le parcours.
      documentTitle={`${steps[stepIndex]} — ${t("auth.signup.title")}`}
      title={
        step === "role"
          ? t("auth.signup.roleTitle")
          : step === "identity"
            ? t("auth.signup.identityTitle")
            : step === "context"
              ? t("auth.signup.contextTitle")
              : t("auth.signup.reviewTitle")
      }
      subtitle={
        step === "role"
          ? t("auth.signup.roleSubtitle")
          : step === "identity"
            ? t("auth.signup.identitySubtitle")
            : step === "context"
              ? t("auth.signup.contextSubtitle")
              : t("auth.signup.reviewSubtitle")
      }
      above={<Stepper steps={steps} current={stepIndex} />}
      footer={
        <>
          {t("auth.hasAccount")}{" "}
          {/* Même exception que sur l'écran de connexion : lien DANS une phrase,
              hauteur portée par l'interligne. Voir `Login.tsx`. */}
          <Link
            to="/connexion"
            data-cible="dans-une-phrase"
            className="font-semibold text-gold-ink hover:text-gold-ink-hover"
          >
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          goNext();
        }}
        noValidate
        className="flex flex-col gap-6"
      >
        {step === "role" && (
          <RadioCards
            legend={t("auth.signup.roleTitle")}
            hideLegend
            name="role"
            value={state.role}
            onChange={(role: Role) => patch({ role })}
            columns={3}
            options={[
              {
                value: "owner",
                title: t("roles.owner.name"),
                description: t("roles.owner.pitch"),
                icon: "building",
                footnote: t("roles.owner.rights"),
              },
              {
                value: "manager",
                title: t("roles.manager.name"),
                description: t("roles.manager.pitch"),
                icon: "users",
                footnote: t("roles.manager.rights"),
              },
              {
                value: "tenant",
                title: t("roles.tenant.name"),
                description: t("roles.tenant.pitch"),
                icon: "key",
                footnote: t("roles.tenant.rights"),
              },
            ]}
          />
        )}

        {step === "identity" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("common.fullName")}
              required
              error={errorFor("name")}
              className="sm:col-span-2"
            >
              {(props) => (
                <Input
                  {...props}
                  name="name"
                  autoComplete="name"
                  value={state.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onBlur={blur("name", validateName(state.name))}
                />
              )}
            </Field>

            <Field label={t("common.email")} required error={errorFor("email")}>
              {(props) => (
                <Input
                  {...props}
                  name="email"
                  type="email"
                  icon="mail"
                  autoComplete="email"
                  placeholder={t("common.emailPlaceholder")}
                  value={state.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  onBlur={blur("email", validateEmail(state.email))}
                />
              )}
            </Field>

            <Field label={t("common.phone")} required error={errorFor("phone")}>
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
                    <Combobox
                      aria-label={t("common.dialCode")}
                      autoComplete="tel-country-code"
                      /**
                       * Deux cent cinquante indicatifs : un menu déroulant
                       * n'est plus parcourable. Taper « cam » ou « 237 » mène
                       * au Cameroun.
                       */
                      options={dialOptions(locale).map(
                        ({ dial, label, zone }) => ({
                          value: dial,
                          label,
                          groupe: t(
                            zone === "cfa"
                              ? "common.dialZoneCfa"
                              : "common.dialZoneOther",
                          ),
                        }),
                      )}
                      value={state.dial}
                      /**
                       * L'indicatif remonte vers le PAYS, et pas seulement
                       * l'inverse.
                       *
                       * La relation était à sens unique : choisir un pays
                       * réglait l'indicatif, choisir un indicatif ne réglait
                       * que lui-même. On pouvait donc saisir « France · +33 »
                       * et voir le récapitulatif annoncer « Pays : Cameroun » —
                       * la valeur déduite de la devise au premier rendu. Deux
                       * réponses contradictoires à la même question, sur le
                       * même écran, et c'est celle qu'on n'a pas choisie qui
                       * partait au serveur.
                       *
                       * La remontée n'a lieu que si l'indicatif désigne UN SEUL
                       * pays. Les indicatifs partagés — `+1` couvre les
                       * États-Unis, le Canada et une vingtaine de territoires —
                       * ne permettent aucune déduction : deviner y serait pire
                       * que se taire, puisque le pays pilote aussi la devise,
                       * la langue et le format des dates.
                       *
                       * « Un seul pays » se lit désormais sur le MONDE et non
                       * sur les seuls pays servis, puisque le champ pays s'y
                       * ouvre : `+234` nomme le Nigeria sans ambiguïté, et le
                       * taire laisserait à nouveau les deux champs se
                       * contredire. Ce qui reste réservé aux pays servis, c'est
                       * le pré-remplissage de la devise et de la langue.
                       */
                      onChange={(dial: string) => {
                        const code = paysDeLIndicatif(dial);
                        if (!code) {
                          patch({ dial });
                          return;
                        }
                        const pays = findCountry(code);
                        if (!pays) {
                          patch({ dial, country: code });
                          setRegion(code);
                          return;
                        }
                        patch({
                          dial,
                          country: pays.code,
                          currency: pays.currency,
                          locale: pays.locale,
                        });
                        setCurrency(pays.currency);
                        setLocale(pays.locale);
                        setRegion(pays.code);
                      }}
                    />
                  </div>
                  <Input
                    {...props}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={state.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    onBlur={blur("phone", validatePhone(state.phone, state.dial))}
                  />
                </div>
              )}
            </Field>

            <Field
              label={t("common.password")}
              required
              error={errorFor("password")}
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
                      "password",
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

        {step === "context" && (
          <ContextStep
            state={state}
            patch={patch}
            errorFor={errorFor}
            blur={blur}
            onCountryChange={(code) => {
              const country = findCountry(code);
              /**
               * Un pays hors du marché servi est un pays quand même.
               *
               * Il n'emporte ni devise ni langue — on ne les connaît pas pour
               * lui, et les deviner ferait pire que se taire. Mais il emporte
               * son indicatif et sa région : ce sont des données réelles, et
               * l'ancien « Autre pays » les jetait toutes les deux avec le
               * pays lui-même.
               */
              if (!country) {
                patch({
                  country: code,
                  ...(INDICATIFS[code] ? { dial: INDICATIFS[code] } : {}),
                });
                setRegion(code);
                return;
              }
              // Le pays pré-remplit devise, langue et indicatif — et les
              // applique tout de suite à l'interface pour que le choix soit
              // visible, pas seulement enregistré.
              patch({
                country: code,
                currency: country.currency,
                locale: country.locale,
                dial: country.dial,
              });
              setCurrency(country.currency);
              setLocale(country.locale);
              // Le pays pilote aussi le format des dates : en-US rend 08/12
              // quand en-GB rend 12/08, et fr-CA rend 2026-08-12.
              setRegion(country.code);
            }}
            onCurrencyChange={(currency) => {
              patch({ currency });
              setCurrency(currency);
            }}
            onLocaleChange={(next) => {
              patch({ locale: next });
              setLocale(next);
            }}
          />
        )}

        {step === "review" && (
          <ReviewStep
            state={state}
            errorFor={errorFor}
            patch={patch}
            onEdit={setStepIndex}
          />
        )}

        {/* Annoncé et non seulement affiché : sans `role="alert"`, un
            utilisateur de lecteur d'écran entend la fin du chargement du bouton
            et rien d'autre — l'assistant semble n'avoir rien fait. */}
        {echec && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-tint px-3.5 py-3 text-body text-danger"
          >
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {t(echec)}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <Button
              variant="ghost"
              size="lg"
              icon="chevronLeft"
              onClick={goBack}
            >
              {t("common.back")}
            </Button>
          ) : (
            <span />
          )}

          <Button
            type="submit"
            size="lg"
            iconAfter={step === "review" ? undefined : "arrowRight"}
            loading={submitting}
            disabled={step === "role" && !state.role}
          >
            {step === "review" ? t("auth.signup.submit") : t("common.next")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

/* -------------------------------------------------------------------------- */

interface StepProps {
  state: SignupState;
  patch: (values: Partial<SignupState>) => void;
  errorFor: (key: string) => string | undefined;
  blur: (key: string, error: FieldError) => () => void;
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
  onCountryChange: (code: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onLocaleChange: (locale: Locale) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const paysOptions = useMemo(() => countryOptions(locale), [locale]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label={t("common.country")}
          required
          // L'aide ne parle plus d'un pays absent — il n'y en a plus — mais du
          // seul écart qui subsiste : un pays réel dont on ignore la devise.
          hint={
            state.country && !findCountry(state.country)
              ? t("common.countryOtherHint")
              : undefined
          }
          /*
            LE PAYS RENDAIT SON AIDE ET JAMAIS SON ERREUR.

            `validateStep` produit bien une clé pour lui — c'est même la
            PREMIÈRE de l'étape « contexte », donc le refus le plus fréquent —
            et aucun rendu ne la lisait. Le champ voisin, lui, l'avait. Un
            formulaire qui refuse d'avancer sans dire lequel de ses champs
            bloque enseigne que le bouton ne marche pas, ce que ce fichier
            raconte avoir déjà payé une fois.
          */
          error={errorFor("country")}
        >
          {(props) => (
            <Combobox
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              // `invalid` ET `aria-invalid` manquaient tous les deux : le champ
              // voisin (l'indicatif) les reçoit via `{...props}`, mais celui-ci
              // les prend un par un et s'arrêtait avant ces deux-là. Le message
              // d'erreur s'affichait bien sous le champ — `error` le rend plus
              // haut — mais la bordure restait neutre et aucun lecteur d'écran
              // n'apprenait que LE champ visé par ce message était celui-ci,
              // sur le refus le plus fréquent de l'étape.
              aria-invalid={props["aria-invalid"]}
              invalid={!!errorFor("country")}
              name="country"
              /**
               * `country` et non `country-name` : le champ ENVOIE le code ISO
               * — c'est lui que porte l'entrée cachée du combobox, et lui que
               * le serveur attend. Le nom traduit n'est qu'un affichage.
               */
              autoComplete="country"
              /**
               * Deux cent quarante-deux pays : le menu nu de vingt-deux
               * entrées ne pouvait pas grandir sans devenir impraticable. Le champ
               * cherchable est déjà celui de l'indicatif, deux champs plus
               * haut — la même notion mérite le même geste.
               */
              options={paysOptions.map(({ code, label, servi }) => ({
                value: code,
                label,
                groupe: t(
                  servi
                    ? "common.countryGroupServed"
                    : "common.countryGroupOther",
                ),
              }))}
              value={state.country}
              onChange={onCountryChange}
            />
          )}
        </Field>

        <Field label={t("common.currency")}>
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

        <Field label={t("common.language")}>
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

      {state.role === "owner" && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <Field
            label={t("auth.signup.parkName")}
            hint={t("auth.signup.parkNameHint")}
            required
            error={errorFor("parkName")}
          >
            {(props) => (
              <Input
                {...props}
                name="parkName"
                value={state.parkName}
                onChange={(e) => patch({ parkName: e.target.value })}
                onBlur={blur("parkName", validateParkName(state.parkName))}
              />
            )}
          </Field>

          <Field
            label={t("auth.signup.unitCount")}
            hint={t("auth.signup.unitCountHint")}
          >
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
            legend={t("auth.signup.management")}
            name="delegates"
            columns={2}
            value={state.delegates}
            onChange={(delegates: "solo" | "delegate") => patch({ delegates })}
            options={[
              {
                value: "solo",
                title: t("auth.signup.manageSolo"),
                description: t("auth.signup.manageSoloHint"),
                icon: "shield",
              },
              {
                value: "delegate",
                title: t("auth.signup.manageDelegate"),
                description: t("auth.signup.manageDelegateHint"),
                icon: "users",
              },
            ]}
          />
        </div>
      )}

      {state.role === "manager" && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <Field
            label={t("auth.signup.company")}
            hint={t("auth.signup.companyHint")}
            optional
          >
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

          {/*
              La case « je n'ai pas de code » est partie avec le chemin qu'elle
              promettait : aucune route serveur ne reçoit de demande d'accès,
              rien dans le client n'en émet, et l'aide annonçait une validation
              par le propriétaire que personne n'aurait vue arriver. La cocher
              menait à un compte rattaché à aucun parc, sous l'écran « votre
              espace est prêt » — le mensonge que ce dépôt retire partout
              ailleurs. Le code devient donc requis, comme il l'est pour le
              locataire, parce que c'est la seule façon d'entrer.
          */}
          <Field
            label={t("auth.signup.ownerCode")}
            hint={t("auth.signup.ownerCodeHint")}
            required
            error={errorFor("ownerCode")}
          >
            {(props) => (
              <Input
                {...props}
                name="ownerCode"
                icon="key"
                placeholder="GES-4A7B-92CD"
                autoCapitalize="characters"
                spellCheck={false}
                value={state.ownerCode}
                // Mise en forme au fil de la frappe, comme pour le locataire :
                // les deux codes ont la même longueur et le même découpage, et
                // le `toUpperCase()` seul laissait l'utilisateur placer les
                // tirets à la main d'un côté et pas de l'autre.
                onChange={(e) =>
                  patch({ ownerCode: formatInviteCode(e.target.value) })
                }
                onBlur={blur("ownerCode", validateInviteCode(state.ownerCode))}
                className="tracking-[0.08em]"
              />
            )}
          </Field>
        </div>
      )}

      {state.role === "tenant" && (
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <p className="flex items-start gap-2.5 rounded-md border border-gold-border bg-gold-tint px-4 py-3 text-body text-gold-ink">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            {t("auth.signup.tenantNotice")}
          </p>

          <Field
            label={t("auth.signup.inviteCode")}
            hint={t("auth.signup.inviteCodeHint")}
            required
            error={errorFor("inviteCode")}
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
                onChange={(e) =>
                  patch({ inviteCode: formatInviteCode(e.target.value) })
                }
                onBlur={blur(
                  "inviteCode",
                  validateInviteCode(state.inviteCode),
                )}
                className="tracking-[0.08em]"
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  state,
  errorFor,
  patch,
  onEdit,
}: {
  state: SignupState;
  errorFor: (key: string) => string | undefined;
  patch: (values: Partial<SignupState>) => void;
  onEdit: (index: number) => void;
}) {
  const t = useT();
  const { locale } = useI18n();

  /**
   * Les lignes du CONTEXTE, dans l'ordre de ce qui pèse.
   *
   * Le parc, le nombre d'unités et le mode de gestion viennent d'abord : ce
   * sont les réponses propres au rôle, saisies à l'instant, et le nom du parc
   * s'affichera en tête de l'espace créé. Le pays suit, puis la devise et la
   * langue — deux réglages qu'on ne relit pas, qu'il pré-remplit, et qui se
   * changent en deux clics une fois dans l'application.
   */
  const contexte: { label: string; value: string }[] = [];

  if (state.role === "owner") {
    contexte.push(
      { label: t("auth.signup.summaryPark"), value: state.parkName },
      { label: t("auth.signup.summaryUnits"), value: state.unitCount },
      {
        label: t("auth.signup.summaryManagement"),
        value:
          state.delegates === "delegate"
            ? t("auth.signup.manageDelegate")
            : t("auth.signup.manageSolo"),
      },
    );
  } else if (state.role === "manager") {
    contexte.push(
      { label: t("auth.signup.summaryCompany"), value: state.company },
      { label: t("auth.signup.summaryOwnerCode"), value: state.ownerCode },
    );
  } else if (state.role === "tenant") {
    contexte.push({
      label: t("auth.signup.summaryInviteCode"),
      value: state.inviteCode,
    });
  }

  contexte.push(
    {
      label: t("auth.signup.summaryCountry"),
      // Le pays peut être hors du marché servi : son nom vient alors du
      // navigateur, comme dans la liste où il a été choisi. Afficher « Autre
      // pays » là où l'utilisateur a écrit « Zimbabwe » lui ferait relire une
      // réponse qui n'est pas la sienne.
      value: state.country
        ? (findCountry(state.country)
            ? countryName(findCountry(state.country)!, locale)
            : nomDuPays(state.country, locale))
        : "—",
    },
    {
      label: t("auth.signup.summaryCurrency"),
      value: CURRENCY_DEFS[state.currency].label,
    },
    {
      label: t("auth.signup.summaryLanguage"),
      value: LOCALE_LABELS[state.locale].long,
    },
  );

  /**
   * Trois groupes, un seul lien de correction chacun.
   *
   * L'écran alignait dix lignes suivies chacune d'un « Modifier » : dix fois le
   * même mot en colonne, à lire jusqu'au bout pour trouver la ligne qu'on veut
   * changer. La répétition ne donnait pourtant aucune précision utile — toutes
   * ces lignes viennent de trois écrans seulement, et c'est vers un écran que
   * le lien ramène, jamais vers un champ. Un lien par groupe dit donc
   * exactement ce que le geste fait, et rend le mot « Modifier » de nouveau
   * visible en ne l'écrivant plus qu'à trois endroits.
   */
  const groupes: {
    titre: string;
    step: number;
    entete?: string;
    lignes: { label: string; value: string }[];
  }[] = [
    {
      titre: t("auth.signup.steps.role"),
      step: 0,
      // Le rôle n'a pas d'étiquette : le titre du groupe la porte déjà, et
      // « Rôle : Propriétaire » sous un intertitre « Votre rôle » écrivait le
      // même mot deux fois pour une seule information.
      entete: t(`roles.${state.role ?? "owner"}.name` as "roles.owner.name"),
      lignes: [],
    },
    {
      titre: t("auth.signup.steps.identity"),
      step: 1,
      lignes: [
        { label: t("auth.signup.summaryName"), value: state.name },
        { label: t("auth.signup.summaryEmail"), value: state.email },
        {
          label: t("auth.signup.summaryPhone"),
          value: `${state.dial} ${state.phone}`,
        },
      ],
    },
    { titre: t("auth.signup.steps.context"), step: 2, lignes: contexte },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card flush className="overflow-hidden">
        <div className="divide-y divide-divider">
          {groupes.map((groupe) => (
            <section key={groupe.titre} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="eyebrow text-muted">{groupe.titre}</h3>
                {/* Cible de 44px, obtenue par la hauteur du contrôle et non par
                    du rembourrage vertical : les marges négatives la rendent
                    sans écarter les groupes les uns des autres. */}
                <button
                  type="button"
                  onClick={() => onEdit(groupe.step)}
                  aria-label={t("auth.signup.editSection", {
                    section: groupe.titre,
                  })}
                  className="-my-2.5 -mr-2 inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-sm px-2 text-label font-semibold text-gold-ink hover:text-gold-ink-hover"
                >
                  {t("common.edit")}
                </button>
              </div>

              {groupe.entete && (
                <p className="mt-0.5 text-body-l font-medium text-ink">
                  {groupe.entete}
                </p>
              )}

              {groupe.lignes.length > 0 && (
                <dl className="mt-1.5 flex flex-col gap-1.5">
                  {groupe.lignes.map((ligne) => (
                    <div
                      key={ligne.label}
                      className="flex items-baseline gap-3"
                    >
                      {/* L'étiquette n'est plus en capitales : dix intertitres
                          alignés en majuscules pesaient autant que les valeurs
                          qu'ils annonçaient, alors qu'on vient relire des
                          valeurs. Les capitales ne servent plus qu'aux trois
                          titres de groupe, où elles distinguent enfin quelque
                          chose. */}
                      <dt className="w-24 shrink-0 text-body text-muted">
                        {ligne.label}
                      </dt>
                      {/* `break-words` et non `truncate` : un récapitulatif
                          dont la valeur se termine par des points de suspension
                          ne se vérifie pas. Une adresse longue tient sur deux
                          lignes, c'est le prix juste. */}
                      <dd className="min-w-0 flex-1 break-words text-body font-medium text-ink">
                        {ligne.value || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-1">
        <Checkbox
          label={t("auth.signup.terms")}
          name="terms"
          checked={state.terms}
          onChange={(e) => patch({ terms: e.target.checked })}
          error={errorFor("terms")}
        />
        <Checkbox
          label={t("auth.signup.newsletter")}
          name="newsletter"
          checked={state.newsletter}
          onChange={(e) => patch({ newsletter: e.target.checked })}
        />
      </div>
    </div>
  );
}

function SignupSuccess({ role }: { role: Role | null }) {
  const t = useT();

  return (
    <AuthLayout title={t("auth.signup.successTitle")}>
      <div className="flex flex-col gap-6">
        <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
          <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
          {t("auth.signup.successBody", {
            role: t(
              `roles.${role ?? "owner"}.name` as "roles.owner.name",
            ).toLowerCase(),
          })}
        </p>

        <Button size="lg" fullWidth to="/app" iconAfter="arrowRight">
          {t("auth.signup.goToDashboard")}
        </Button>
      </div>
    </AuthLayout>
  );
}

export { ROLE_SLUGS };
