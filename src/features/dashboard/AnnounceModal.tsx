import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Select, Textarea } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useNumbers } from '@/lib/numbers'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { api, ApiError } from '@/api/client'

/** Ce que le serveur rend : le compte de ceux qui liront, le nom des autres. */
interface Envoi {
  delivered: number
  unreachable: { tenantId: string; fullName: string }[]
}

/**
 * PRÉVENIR TOUS LES LOCATAIRES D'UN COUP.
 *
 * « Une intervention sur le réseau d'eau est prévue jeudi entre 8 h et 12 h ».
 * Le seul envoi à plusieurs destinataires qui existait était la relance
 * d'impayés, sans texte libre : un bailleur qui devait prévenir les quatre
 * locataires d'un immeuble le faisait au téléphone, quatre fois, et ce qu'il
 * avait dit ne laissait aucune trace opposable.
 *
 * TOUT LE PARC ou UN IMMEUBLE, et rien de plus fin : écrire à une personne se
 * fait depuis son signalement, où le message se rattache à un dossier. Un
 * sélecteur de destinataires individuels ici ferait doublon avec un canal qui
 * range mieux.
 */
export function AnnounceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const n = useNumbers()
  const { notify } = useToast()
  const { buildings } = usePortfolio()
  const { adhesionActive } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  /** `''` vaut TOUT LE PARC : c'est la valeur que le serveur lit comme l'absence
      de `buildingId`, et la valeur initiale du champ. */
  const [immeuble, setImmeuble] = useState('')
  const [issue, setIssue] = useState<Envoi | null>(null)
  const issueRef = useRef<HTMLDivElement>(null)

  // Le panneau d'issue prend le focus dès qu'il paraît. La bascule démonte le
  // formulaire, donc l'élément focalisé : sans replacement, le focus retombe
  // sur `<body>`, plus rien n'est annoncé, et la tabulation suivante repart
  // du haut du document. Un `aria-live` ne dirait rien — ce dépôt l'a déjà
  // écrit : monté en même temps que son contenu, il n'a aucun changement à
  // observer. La réponse est le focus.
  useEffect(() => {
    issueRef.current?.focus()
  }, [issue])

  const fermer = () => {
    setTexte('')
    setErreur(false)
    setEnvoi(false)
    setImmeuble('')
    setIssue(null)
    onClose()
  }

  const envoyer = () => {
    // La même borne que le serveur : trois caractères au moins, « ok » n'est pas
    // une annonce. Rognée, parce que le serveur la rogne aussi.
    const message = texte.trim()
    if (message.length < 3) {
      setErreur(true)
      return
    }

    /**
     * Sans parc serveur, rien ne part — et on le dit.
     *
     * La démonstration n'a pas de comptes locataires : il n'y a personne à
     * prévenir, et écrire la notification dans l'état local montrerait au
     * bailleur de démonstration un message qu'il vient de s'envoyer à lui-même.
     */
    if (!parkId) {
      notify(t('app.announce.demo'), { tone: 'neutral' })
      fermer()
      return
    }

    setEnvoi(true)
    void api
      .announce<Envoi>(parkId, { message, ...(immeuble ? { buildingId: immeuble } : {}) })
      .then(setIssue)
      /**
       * REFUS ou PANNE. `signalerEchec` (`PortfolioProvider`) le distingue
       * depuis l'origine — un `ApiError` est un refus du serveur, définitif
       * tant que la saisie ne change pas ; tout le reste est une panne, qui
       * peut se résoudre au prochain essai. Cette modale appelle `api`
       * directement plutôt que le provider, et rendait toujours « panne »,
       * même sur un refus — invitant à réessayer un message que le serveur
       * ne validera jamais tel quel.
       */
      .catch((cause: unknown) =>
        notify(t(cause instanceof ApiError ? 'common.actionRefused' : 'common.actionFailed'), {
          tone: 'danger',
        }),
      )
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={fermer}
      size="sm"
      title={t('app.announce.title')}
      description={issue ? t('app.announce.sentTitle') : t('app.announce.description')}
      footer={
        issue ? (
          <Button onClick={fermer}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={fermer}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="annonce" loading={envoi}>
              {t('app.announce.send')}
            </Button>
          </>
        )
      }
    >
      {issue ? (
        <div className="flex flex-col gap-4" ref={issueRef} tabIndex={-1}>
          {/* `icon="check"` : le ton `ok` porte la coche CERCLÉE par défaut, et ce
              site-ci disait la coche nue. Le glyphe est un choix d'origine et non
              une dérive — on le reporte plutôt que de le laisser changer. */}
          <Notice tone="ok" icon="check">
            {t('app.announce.delivered', { count: issue.delivered })}
          </Notice>

          {/*
            QUI N'A RIEN REÇU, NOMMÉMENT.

            Un locataire sans compte n'a pas d'espace où lire. Ne rendre que le
            nombre d'envois laisserait croire que tout l'immeuble est prévenu, et
            c'est exactement le mensonge que ce produit retire partout ailleurs :
            le bailleur a besoin de la liste de ceux qu'il lui reste à appeler.
            Les noms, et non un compte — on ne rappelle pas « deux personnes ».

            CE BANDEAU-CI RESTE ÉCRIT À LA MAIN. `Notice` connaît deux formes :
            une phrase seule, ou un titre en gras suivi d'un corps. Celle-ci
            n'est ni l'une ni l'autre — la première ligne n'est pas un titre, et
            la seconde s'aligne sous le TEXTE (`pl-6`), pas sous le glyphe. La
            passer en forme forte mettrait la phrase en gras et lui donnerait le
            rembourrage des conteneurs : ce serait redessiner l'objet, pas le
            factoriser.
          */}
          {issue.unreachable.length > 0 && (
            <div className="rounded-md border border-accent-border bg-accent-tint px-3.5 py-3 text-body text-accent-ink">
              <p className="flex items-start gap-2">
                <Icon name="info" size={15} className="mt-0.5 shrink-0" />
                {t('app.announce.unreachable', { count: issue.unreachable.length })}
              </p>
              <p className="mt-1.5 pl-6">{n.list(issue.unreachable.map((p) => p.fullName))}</p>
            </div>
          )}
        </div>
      ) : (
        /*
          UN VRAI `<form>`, ET LE BOUTON DU PIED LUI EST RATTACHÉ.

          `Modal` rend le corps et le pied dans deux `<div>` FRÈRES : un `<form>`
          autour du corps ne peut donc pas contenir le bouton du pied — et faute
          de l'avoir résolu, cette modale n'avait pas de formulaire du tout.
          Entrée n'y validait rien.

          Le coût n'est pas seulement au clavier. Sur un clavier virtuel de
          téléphone, un champ hors formulaire perd sa touche d'action « Aller » :
          le clavier reste ouvert par-dessus la barre d'actions, au moment précis
          où il faut l'atteindre.

          L'attribut `form` est fait pour ce cas. `noValidate` l'accompagne
          toujours : sans lui la validation native rouvre ses bulles à côté des
          messages de `Field`, deux refus pour la même faute.
        */
        <form
          id="annonce"
          onSubmit={(e) => {
            e.preventDefault()
            envoyer()
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* Le champ ne devient pas un menu à un seul article quand le parc n'a
              qu'un immeuble : « tout le parc » et « cet immeuble-là » y désignent
              alors les mêmes personnes, et le choix se lirait comme une panne.
              C'est la règle déjà appliquée au logement dans l'invitation. */}
          {buildings.length > 1 && (
            <Field label={t('app.announce.scope')} hint={t('app.announce.scopeHint')}>
              {(champ) => (
                <Select
                  {...champ}
                  name="immeuble"
                  value={immeuble}
                  onChange={(e) => setImmeuble(e.target.value)}
                >
                  <option value="">{t('app.announce.scopeAll')}</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field
            label={t('app.announce.message')}
            hint={t('app.announce.messageHint')}
            required
            {...(erreur ? { error: t('app.announce.error') } : {})}
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

          {/* CE QUE L'ENVOI NE FAIT PAS. Le message se dépose dans les
              notifications de l'application ; aucun SMS ne part, parce qu'aucun
              fournisseur n'est branché. Le dire avant l'envoi évite de compter
              sur un canal qui n'existe pas pour une coupure d'eau de jeudi. */}
          <p className="text-body text-muted">{t('app.announce.channelNotice')}</p>
        </form>
      )}
    </Modal>
  )
}
