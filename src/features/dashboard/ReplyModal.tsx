import { useEffect, useRef, useState } from 'react'
import { usePortfolio } from '@/data/PortfolioProvider'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Textarea } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { ApiError } from '@/api/client'
import { api } from '@/api/client'
import type { WorkOrder } from '@/data/portfolio'

/**
 * LA RÉPONSE AU LOCATAIRE QUI A SIGNALÉ.
 *
 * Le canal n'existait que dans un sens : le locataire déclarait une fuite, puis
 * regardait une pastille de statut avancer — « déclaré », « devisé », « validé »
 * — sans jamais apprendre quand quelqu'un passerait ni pourquoi rien ne
 * bougeait. Le gestionnaire, lui, n'avait que le téléphone, et les échanges qui
 * décident d'une dépense se perdaient hors du dossier.
 *
 * Une SEULE réponse par ouverture, et pas de fil affiché ici : les réponses
 * s'empilent dans les notifications du locataire, qui est l'endroit où il les
 * lit. Montrer un historique dans cette modale supposerait que le serveur le
 * rende — il ne le rend pas — et la seule chose qu'on saurait afficher serait
 * une liste vide, qui laisserait croire que rien n'a jamais été envoyé.
 */
export function ReplyModal({
  work,
  onClose,
}: {
  /** L'intervention à laquelle on répond. `null` ferme la modale. */
  work: WorkOrder | null
  onClose: () => void
}) {
  const t = useT()
  const { poserLaReponseDeGestion } = usePortfolio()
  const { notify } = useToast()
  const { adhesionActive } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const issueRef = useRef<HTMLParagraphElement>(null)

  /**
   * Ce que le serveur a répondu : `null` tant qu'on saisit, puis le sort réel de
   * l'envoi. On ne referme pas sur un toast — la distinction « lu » / « à
   * rappeler » ne tient pas dans une bulle qui disparaît en trois secondes.
   */
  const [issue, setIssue] = useState<{ delivered: boolean; fullName: string } | null>(null)

  // Le panneau d'issue prend le focus dès qu'il paraît : c'est lui, et non
  // le formulaire démonté, qui porte désormais la réponse à la question
  // qu'on venait de poser.
  useEffect(() => {
    issueRef.current?.focus()
  }, [issue])

  const fermer = () => {
    setTexte('')
    setErreur(false)
    setEnvoi(false)
    setIssue(null)
    onClose()
  }

  const envoyer = () => {
    if (!work) return
    // La même borne que le serveur — trois caractères au moins — pour que le
    // refus arrive avant l'aller-retour. `trim` parce qu'une réponse faite de
    // trois espaces n'en est pas une, et que le serveur la rognerait aussi.
    const message = texte.trim()
    if (message.length < 3) {
      setErreur(true)
      return
    }

    /**
     * Sans parc serveur, la démonstration ne prétend pas avoir envoyé.
     *
     * Le reste de l'application écrit localement quand `parkId` est absent —
     * un devis, une clôture. Ici il n'y a RIEN à écrire localement : le
     * destinataire est un compte, et la démonstration n'en a pas. Un toast de
     * succès inventerait une réponse partie vers personne.
     */
    if (!parkId) {
      notify(t('app.works.replyDemo'), { tone: 'neutral' })
      fermer()
      return
    }

    setEnvoi(true)
    void api
      .replyToWork<{ delivered: boolean; reporter: { fullName: string } }>(parkId, work.id, message)
      .then(({ delivered, reporter }) => {
        setIssue({ delivered, fullName: reporter.fullName })
        /* La phrase paraît DANS le fil, à l'instant — la modale disait
           « envoyée » et rien ne bougeait jusqu'au rechargement. Après le
           201, donc jamais avant que le serveur ait accepté. */
        poserLaReponseDeGestion(work.id, work.unitId, message)
      })
      .catch((cause: unknown) => {
        /**
         * 409 `no_reporter` a son propre message.
         *
         * Le bouton ne s'affiche que sur une intervention QUI PORTE un
         * déclarant, mais l'écran peut avoir vieilli — la liste vient d'un
         * chargement, la vérité vient du serveur. « L'action a échoué »
         * laisserait réessayer indéfiniment un geste qui n'aboutira jamais.
         */
        const code = cause instanceof ApiError ? cause.code : ''
        if (code === 'no_reporter') {
          notify(t('app.works.replyNoReporter'), { tone: 'danger' })
          return
        }
        /**
         * REFUS ou PANNE, et non toujours « panne ».
         *
         * Tout ce qui n'était pas `no_reporter` retombait sur
         * `common.actionFailed` — « impossible pour l'instant », qui invite à
         * réessayer. `signalerEchec` (`PortfolioProvider`) distingue pourtant
         * les deux depuis l'origine : un `ApiError` autre que 409 est un REFUS
         * du serveur (message trop court côté validation serveur, par
         * exemple), pas une panne réseau — réessayer à l'identique échouera
         * pareil. Cette modale appelle `api` directement, hors du provider, et
         * avait perdu la distinction en chemin.
         */
        notify(t(cause instanceof ApiError ? 'common.actionRefused' : 'common.actionFailed'), {
          tone: 'danger',
        })
      })
      .finally(() => setEnvoi(false))
  }

  if (!work) return null

  return (
    <Modal
      open
      onClose={fermer}
      size="sm"
      title={t('app.works.replyTitle')}
      description={
        issue
          ? t('app.works.replySentTitle')
          : t('app.works.replyBody', { reference: work.reference ?? work.id })
      }
      footer={
        issue ? (
          <Button onClick={fermer}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={fermer}>
              {t('common.cancel')}
            </Button>
            <Button onClick={envoyer} loading={envoi}>
              {t('app.works.replySend')}
            </Button>
          </>
        )
      }
    >
      {issue ? (
        /*
          CE QUI EST PARTI, ET CE QUI RESTE À FAIRE.

          Le serveur distingue la réponse consignée de la réponse LUE : un
          locataire dont la fiche n'est reliée à aucun compte n'a pas d'espace où
          la trouver. Les deux cas sont des succès d'écriture, et un seul est un
          succès de communication. Le second laisse un appel à passer, et c'est
          la seule chose que le gestionnaire a besoin de savoir en fermant.
        */
        /*
          LE FOCUS SUIT CE QUE LE GESTE A PRODUIT.

          La bascule vers ce panneau DÉMONTE le formulaire, donc l'élément qui
          portait le focus. Sans replacement, il retombe sur `<body>` : plus
          rien n'est annoncé, et la tabulation suivante repart du haut du
          document. L'utilisateur a cliqué, quelque chose a changé, et son
          lecteur d'écran ne le sait pas.

          Un `aria-live` ne serait PAS la réponse, et ce dépôt l'a déjà écrit
          ailleurs : « un `aria-live` monté en même temps que son contenu
          n'annonce rien, puisqu'il n'y a pas eu de changement à observer
          depuis ». La réponse est le focus.

          `tabIndex={-1}` : focalisable par programme, jamais à la tabulation.

          ET C'EST POURQUOI CE BANDEAU RESTE ÉCRIT À LA MAIN. `Notice` n'expose
          ni `ref` ni `tabIndex` : le passer à la primitive ferait perdre la
          cible de `issueRef.current?.focus()`, donc l'annonce même du résultat.
          On ne factorise pas au prix du focus.
        */
        <p
          ref={issueRef}
          tabIndex={-1}
          className={
            issue.delivered
              ? 'flex items-start gap-2 rounded-md border border-ok-border bg-ok-tint px-3.5 py-3 text-body text-ok'
              : 'flex items-start gap-2 rounded-md border border-accent-border bg-accent-tint px-3.5 py-3 text-body text-accent-ink'
          }
        >
          <Icon name={issue.delivered ? 'check' : 'info'} size={15} className="mt-0.5 shrink-0" />
          {issue.delivered
            ? t('app.works.replyDelivered', { name: issue.fullName })
            : t('app.works.replyUnreachable', { name: issue.fullName })}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* À QUI l'on écrit, nommément. Le gestionnaire peut avoir ouvert la
              modale depuis une liste de douze lignes ; le nom du déclarant est
              ce qui lui dit qu'il ne s'est pas trompé de ligne. */}
          {work.reportedBy && (
            <p className="text-body text-muted">
              {t('app.works.replyTo', { name: work.reportedBy })}
            </p>
          )}

          <Field
            label={t('app.works.replyLabel')}
            hint={t('app.works.replyHint')}
            required
            {...(erreur ? { error: t('app.works.replyError') } : {})}
          >
            {(champ) => (
              <Textarea
                {...champ}
                rows={5}
                value={texte}
                invalid={erreur}
                onChange={(e) => {
                  setTexte(e.target.value)
                  setErreur(false)
                }}
              />
            )}
          </Field>
        </div>
      )}
    </Modal>
  )
}
