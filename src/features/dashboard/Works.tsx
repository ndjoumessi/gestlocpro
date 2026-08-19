import { useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { useBase } from '@/lib/base'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { TenantScopeNote } from './TenantDashboard'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { montantEngage, type WorkOrder } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { ReportModal } from './ReportModal'
import { OpenWorkModal } from './OpenWorkModal'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'

const STATUS_TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'neutral',
  quoted: 'warn',
  approved: 'info',
  done: 'ok',
}

export function Works() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { notify } = useToast()
  const { role } = useRole()

  // Seul le propriétaire arbitre : le gestionnaire propose. C'est la règle de
  // délégation, appliquée ici à l'affichage du bouton.
  const canApprove = role === 'owner'
  const isTenant = role === 'tenant'

  /**
   * Travaux et cautions vivent dans un état partagé : une décision prise ici
   * doit disparaître de la carte « Ce qui demande une décision » du tableau de
   * bord, qui la réclamait encore.
   */
  const {
    works,
    units,
    approveWork,
    quoteWork,
    unapproveWork,
    completeWork,
    reopenWork,
    unitById,
    isMine,
    loading,
  } = usePortfolio()
  const [signalementOuvert, setSignalementOuvert] = useState(false)
  const [chantierOuvert, setChantierOuvert] = useState(false)
  const [aChiffrer, setAChiffrer] = useState<WorkOrder | null>(null)
  const [montant, setMontant] = useState('')
  const [montantErreur, setMontantErreur] = useState(false)

  // Le locataire suit les interventions sur SON logement, pas celles du parc.
  // Le périmètre vient du provider, qui le tient du serveur : le client ne
  // connaît plus « son » unité par une constante.
  const visible = isTenant ? works.filter((w) => isMine(w.unitId)) : works

  const approve = (id: string) => {
    approveWork(id)
    // Valider engage une dépense, et se tromper de ligne dans une liste de
    // devis est ordinaire. Le retrait rend le devis à l'arbitrage sans effacer
    // la proposition : il n'y a rien à redemander à l'artisan.
    notify(t('app.works.approved_toast'), {
      tone: 'ok',
      action: { label: t('common.undo'), onClick: () => unapproveWork(id) },
    })
  }

  const mesUnites = units.filter((u) => isMine(u.id))

  /**
   * Retirer une validation, et rouvrir : DES BOUTONS, pas seulement un toast.
   *
   * Ces deux gestes n'existaient que comme action du message de confirmation,
   * lequel s'efface au bout de quatre secondes et demie. J'avais pourtant écrit
   * qu'une fenêtre qui expire en silence enseigne un filet qui n'existe pas —
   * puis livré exactement cela. La capacité était permanente côté serveur et
   * injoignable à l'écran passé le délai.
   */
  const reopen = (id: string) => {
    reopenWork(id)
    notify(t('app.works.reopened_toast'), { tone: 'ok' })
  }

  const unapprove = (id: string) => {
    unapproveWork(id)
    notify(t('app.works.unapproved_toast'), { tone: 'ok' })
  }

  const complete = (id: string) => {
    completeWork(id)
    /**
     * L'annulation est offerte AVEC le message, et elle est réelle.
     *
     * La maquette proposait une fenêtre de six secondes ; ce n'est pas ce qui
     * est livré. Une clôture prise pour une autre se découvre en relisant sa
     * liste, pas dans les six secondes — une fenêtre qui expire en silence
     * enseigne un filet qui n'existe pas. Le geste reste disponible ensuite par
     * la réouverture ; le toast n'en est que le chemin le plus court.
     */
    notify(t('app.works.completed_toast'), {
      tone: 'ok',
      action: { label: t('common.undo'), onClick: () => reopenWork(id) },
    })
  }

  /**
   * Cet écran porte un bouton qui engage de l'argent — « Valider le devis ».
   * Pendant l'attente, il en offrait deux, chiffrés, sur des interventions de
   * démonstration : le propriétaire validait une dépense de 185 000 FCFA qui ne
   * correspondait à rien, et le refus du serveur arrivait après la décision.
   */
  if (loading) return <WorksSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.works.title')}
        description={t('app.works.subtitle')}
        actions={
          /*
            DEUX gestes distincts, un par rôle — et le second est neuf.

            Ce commentaire disait : « le bailleur ne déclare toujours pas, c'est
            le locataire qui signale ». La prémisse était exacte à sa date et ne
            l'est plus : la route serveur acceptait les trois rôles depuis
            l'origine, seule l'interface refusait. Un bailleur qui remplaçait un
            chauffe-eau avant la panne n'avait aucun endroit où l'enregistrer,
            donc la dépense n'existait nulle part.

            Les deux verbes sont différents à dessein. Le locataire SIGNALE ce
            qu'il constate — il ne choisit ni le devis ni le corps de métier. Le
            bailleur OUVRE ce qu'il décide, sur un logement qu'il choisit.
            `origin` porte la distinction dans la donnée, ces deux boutons la
            portent à l'écran.

            `mesUnites[0]` : un locataire d'un seul logement n'a rien à choisir.
            Le jour où il en occupera deux, il faudra le lui demander — et le
            serveur, lui, revérifie déjà que le logement est bien le sien.
          */
          isTenant ? (
            mesUnites[0] ? (
              <Button icon="bell" onClick={() => setSignalementOuvert(true)}>
                {t('app.report.cta')}
              </Button>
            ) : undefined
          ) : (
            <Button icon="wrench" onClick={() => setChantierOuvert(true)}>
              {t('app.works.openCta')}
            </Button>
          )
        }
      />

      {isTenant && <TenantScopeNote />}

      {/* Le bouton de validation disparaissait sans un mot pour le
          gestionnaire, alors qu'il voit les devis en attente : il lui restait à
          deviner si l'action manquait par droit ou par défaut. L'écran des
          cautions traite déjà le cas symétrique — les deux se répondent
          maintenant, puisque c'est la même règle de délégation. */}
      {role === 'manager' && works.some((work) => work.status === 'quoted') && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.works.managerNotice')}
        </p>
      )}

      {/*
        L'état vide portait un titre et rien d'autre — et ce titre était écrit
        pour le locataire (« sur votre logement »), servi tel quel au
        propriétaire qui regarde tout le parc. Deux corrections tiennent
        ensemble : le texte se dit au bon destinataire, et il explique ce qui
        apparaîtra là plutôt que de répéter qu'il n'y a rien.

        L'action du bailleur, elle, a été CONSTRUITE depuis.

        Ce commentaire disait qu'aucune n'existait, et qu'un bouton « ajouter
        des travaux » serait « le mensonge d'interface habituel ». C'était juste
        tant que rien ne se passait derrière — la route serveur, elle, acceptait
        déjà. Le geste ouvre désormais sur une capacité réelle, et le corps du
        message change avec lui : il ne peut plus dire qu'une intervention naît
        d'un signalement, puisque la moitié des siennes naîtront d'une décision.
      */}
      {visible.length === 0 ? (
        <EmptyState
          icon="wrench"
          title={isTenant ? t('app.tenant.worksEmpty') : t('app.works.emptyTitle')}
          body={isTenant ? t('app.tenant.worksEmptyBody') : t('app.works.emptyBodyOwner')}
          // Le locataire, lui, est sur une impasse : rien à faire ici, et ses
          // données sont ailleurs. On le ramène là où elles sont — c'est le
          // même geste que `TenantRestricted`, et il existe vraiment.
          action={
            isTenant ? (
              <Button to={base} icon="chevronLeft">
                {t('app.tenant.backToSpace')}
              </Button>
            ) : (
              /* Le même geste que l'en-tête, à l'endroit où il manque le plus :
                 un parc sans aucune intervention est exactement celui où le
                 bailleur cherche par où commencer. */
              <Button icon="wrench" onClick={() => setChantierOuvert(true)}>
                {t('app.works.openCta')}
              </Button>
            )
          }
        />
      ) : (
      <div className="flex flex-col gap-3">
        {visible.map((work) => {
          const unit = unitById(work.unitId)
          return (
            <Card key={work.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                  work.urgent ? 'bg-danger-tint text-danger' : 'bg-surface-sunken text-muted'
                }`}
              >
                <Icon name="wrench" size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="title-m">{workTitle(work, t)}</h2>
                  {work.urgent && <Badge tone="danger">{t('app.works.urgent')}</Badge>}
                </div>
                <p className="mt-1 text-caps text-muted">
                  {/* `work.id` est une référence de signalement, pas une unité :
                      il reste tel quel. `work.unitId`, lui, est l'identifiant
                      technique de l'unité — c'est son libellé qui se lit. */}
                  {work.reference ?? work.id} · {unit?.label} {unit?.tenant ? `· ${unit.tenant}` : ''} ·{' '}
                  {t(`app.trades.${work.trade}` as 'app.trades.plumbing')} ·{' '}
                  {d.dayMonth(work.reportedAt)}
                </p>
                {/*
                  D'OÙ ELLE VIENT, et de qui.

                  L'écran ne le disait pas, et le serveur ne le rendait pas :
                  `reportedByTenantId` était écrit depuis l'origine et lu nulle
                  part. Le bailleur recevait donc un problème sans savoir qui
                  l'avait vu — il ne pouvait ni rappeler, ni faire ouvrir la
                  porte à l'artisan.

                  Rien ne s'affiche quand l'origine manque : une intervention
                  antérieure à ce champ n'a pas de déclarant connu, et écrire
                  « signalé par » sans nom serait pire que le silence.
                */}
                {work.origin && (
                  <p className="mt-1 text-body-s text-muted">
                    {work.reportedBy
                      ? t(
                          work.origin === 'ownerInitiative'
                            ? 'app.works.openedByNamed'
                            : 'app.works.reportedByNamed',
                          { name: work.reportedBy },
                        )
                      : t(
                          work.origin === 'ownerInitiative'
                            ? 'app.works.openedBy'
                            : 'app.works.reportedBy',
                        )}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {/*
                  LE MONTANT DIT CE QU'IL EST : proposé, ou engagé.

                  C'était un nombre nu à côté de la pastille de statut, et le
                  lecteur devait déduire du statut s'il regardait un devis ou une
                  dépense. Le client aplatissait d'ailleurs les deux champs du
                  serveur en un seul — le devis d'origine disparaissait dès
                  qu'une validation existait, alors que l'écart entre proposé et
                  engagé est exactement ce qu'un bailleur veut voir.
                */}
                {/*
                  ET PAS AU LOCATAIRE — une fuite qui précède ce chantier.

                  La règle est celle des maquettes, appliquée partout ailleurs :
                  « le coût des travaux n'est jamais exposé au locataire ». Son
                  espace ne l'affiche pas, l'écran Signaler non plus — et un cas
                  le garde là-bas. Mais l'écran des travaux, lui, le montrait à
                  qui l'ouvrait, sans aucune condition de rôle.
                  `coquilleLocataire` a retiré « Travaux » de sa navigation, ce
                  qui a rendu le défaut invisible sans le corriger : la route
                  reste atteignable, et `tenantIsolation` garde justement
                  qu'elle le reste.

                  Le devis et l'engagé regardent celui qui paie. Le locataire
                  voit le statut, ce qui répond à sa seule question : est-ce que
                  ça avance ?
                */}
                {!isTenant && <Montant work={work} />}

                <StatusPill tone={STATUS_TONE[work.status]} size="sm">
                  {t(`app.works.${work.status}` as 'app.works.reported')}
                </StatusPill>

                {/*
                  CHIFFRER : l'action centrale du gestionnaire, et elle n'avait
                  aucun bouton. La route existait, la méthode du fournisseur
                  aussi — rien ne les appelait. « Le locataire signale, le
                  gestionnaire chiffre, le propriétaire arbitre » dit le
                  sous-titre de cet écran ; le deuxième maillon manquait.
                */}
                {work.status === 'reported' && role !== 'tenant' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAChiffrer(work)
                      setMontant('')
                      setMontantErreur(false)
                    }}
                  >
                    {t('app.works.quote')}
                  </Button>
                )}

                {/* Retirer la validation : réservé à qui a le droit de valider. */}
                {work.status === 'approved' && canApprove && (
                  <Button variant="ghost" size="sm" onClick={() => unapprove(work.id)}>
                    {t('app.works.unapprove')}
                  </Button>
                )}

                {work.status === 'done' && role !== 'tenant' && (
                  <Button variant="ghost" size="sm" onClick={() => reopen(work.id)}>
                    {t('app.works.reopen')}
                  </Button>
                )}

                {work.status === 'quoted' && canApprove && (
                  <Button
                    size="sm"
                    onClick={() => approve(work.id)}
                  >
                    {t('app.works.approve')}
                  </Button>
                )}

                {/*
                  Clore : le geste qui manquait, et son absence se voyait.

                  `approved` était en pratique TERMINAL — un devis validé
                  engageait la dépense et restait « à faire » indéfiniment, donc
                  cette liste ne pouvait que grandir. Un logiciel de gestion dont
                  la liste de travaux ne se vide jamais cesse d'être lu.

                  Offert sur `reported` aussi : tout n'a pas de coût, et une
                  intervention jamais chiffrée n'a rien à faire arbitrer. Jamais
                  sur `quoted` — le serveur le refuse, parce que clore un devis
                  en attente le ferait disparaître de la carte du propriétaire
                  sans qu'il ait rien décidé.

                  Le locataire consulte : il ne constate pas l'achèvement des
                  travaux de son bailleur.
                */}
                {(work.status === 'approved' || work.status === 'reported') &&
                  role !== 'tenant' && (
                    <Button variant="secondary" size="sm" onClick={() => complete(work.id)}>
                      {t('app.works.complete')}
                    </Button>
                  )}
              </div>
            </Card>
          )
        })}
      </div>
      )}

      {aChiffrer && (
        <Modal
          open
          onClose={() => setAChiffrer(null)}
          size="sm"
          title={t('app.works.quoteTitle')}
          description={t('app.works.quoteBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAChiffrer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  const valeur = Number(montant.replace(/\s/g, ''))
                  // La même borne que le serveur — « un devis est strictement
                  // positif » — pour que le refus arrive avant l'aller-retour.
                  if (!Number.isFinite(valeur) || valeur <= 0) {
                    setMontantErreur(true)
                    return
                  }
                  quoteWork(aChiffrer.id, Math.round(valeur))
                  setAChiffrer(null)
                  notify(t('app.works.quoted_toast'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <Field
            label={t('app.works.quoteAmount')}
            hint={t('app.works.quoteHint')}
            required
            {...(montantErreur ? { error: t('app.works.quoteError') } : {})}
          >
            {(champ) => (
              <Input
                {...champ}
                inputMode="numeric"
                value={montant}
                invalid={montantErreur}
                onChange={(e) => {
                  setMontant(e.target.value)
                  setMontantErreur(false)
                }}
              />
            )}
          </Field>
        </Modal>
      )}

      {role === 'tenant' && mesUnites[0] && (
        <ReportModal
          open={signalementOuvert}
          onClose={() => setSignalementOuvert(false)}
          unitId={mesUnites[0].id}
        />
      )}

      {/* Le bailleur choisit son logement dans TOUT le parc : c'est la seule
          différence de forme entre les deux modales, et c'est celle qui
          interdisait de partager `ReportModal`, dont l'unité arrive toute faite
          en prop. `units` et non `visible` : on ouvre un chantier sur un
          logement, pas sur une intervention. */}
      {!isTenant && units.length > 0 && (
        <OpenWorkModal
          open={chantierOuvert}
          onClose={() => setChantierOuvert(false)}
          unitIds={units.map((u) => ({ id: u.id, label: u.label }))}
        />
      )}
    </>
  )
}

/**
 * Les travaux, le temps qu'ils arrivent.
 *
 * L'en-tête ne porte aucune action : rien à retenir de ce côté-là. Le bandeau
 * de périmètre du locataire et l'avis au gestionnaire ne sont pas reproduits —
 * tous deux se déclenchent sur les données (« a-t-il des devis en attente ? »),
 * donc les annoncer reviendrait à répondre à une question qu'on ne sait pas
 * encore trancher.
 *
 * Trois cartes, et non huit : ce sont des cartes hautes, trois remplissent déjà
 * l'écran d'un téléphone. Leur gabarit suit celui d'une intervention réelle —
 * la vignette de 44px, le titre, la ligne de références — pour que la liste ne
 * saute pas quand elle arrive.
 */
function WorksSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.works.title')} description={t('app.works.subtitle')} />

      <SkeletonRegion className="flex flex-col gap-3">
        {[0, 1, 2].map((carte) => (
          <div
            key={carte}
            className="flex min-w-0 items-center gap-4 rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5"
          >
            <Skeleton radius="md" className="size-11" />
            <div className="min-w-0 flex-1">
              <Skeleton line="title" className="w-64 max-w-full" />
              <Skeleton line="eyebrow" className="mt-1 w-48 max-w-full" />
            </div>
            <Skeleton line="title" radius="md" className="hidden w-28 sm:block" />
            <Skeleton radius="md" className="hidden h-7 w-24 sm:block" />
          </div>
        ))}
      </SkeletonRegion>
    </>
  )
}

/**
 * Ce qu'a coûté une intervention, ou ce qu'elle coûterait.
 *
 * Le devis RESTE visible sous l'engagé quand les deux diffèrent : un devis à
 * 78 000 validé à 78 000 se lit comme une dépense tenue, le même validé après
 * révision à 95 000 est une dérive. Les confondre effaçait la seule information
 * que ce couple porte.
 */
function Montant({ work }: { work: WorkOrder }) {
  const t = useT()
  const { money } = useCurrency()
  const { montant, nature } = montantEngage(work)

  if (montant === null) {
    return (
      <span className="text-body-s text-muted italic">{t('app.works.noQuote')}</span>
    )
  }

  const revise =
    nature === 'approved' && work.quotedAmount !== null && work.quotedAmount !== montant

  return (
    <span className="flex flex-col items-end">
      <span className="numeric text-title-m font-medium">{money(montant, { round: true })}</span>
      <span className="text-caps text-muted">
        {t(nature === 'approved' ? 'app.works.amountApproved' : 'app.works.amountQuoted')}
      </span>
      {revise && (
        <span className="numeric text-caps text-muted">
          {t('app.works.amountWasQuoted', { amount: money(work.quotedAmount!, { round: true }) })}
        </span>
      )}
    </span>
  )
}
