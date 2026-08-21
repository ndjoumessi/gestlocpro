import { useRef, useState, type KeyboardEvent } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Field } from '@/components/primitives/Field'
import { Input, Textarea } from '@/components/primitives/Input'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { cn } from '@/lib/cn'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { TRADES_REPORTABLE } from '@/data/portfolio'
import type { TradeKey, UrgencyKey, WorkOrder } from '@/data/portfolio'

/**
 * « Signaler » — l'écran que les maquettes décrivent.
 *
 * Le formulaire vivait en MODALE, derrière un bouton. Les maquettes le posent à
 * plat, à côté de « Mes signalements », et la raison n'est pas cosmétique : un
 * locataire qui déclare un problème veut d'abord savoir si le précédent a été
 * traité. Derrière une modale, la liste est masquée à l'instant précis où elle
 * sert — il redéclare donc ce qui est déjà en cours.
 *
 * Les signalements SONT les interventions de son logement : le produit n'a pas
 * deux objets pour un seul fait, et la chaîne « signalé → chiffré → validé →
 * clos » est celle que le bailleur voit de son côté.
 *
 * La modale survit pour le bailleur, dans l'écran des travaux : il déclare pour
 * un logement qu'il choisit, le locataire pour le sien. Le VOCABULAIRE des
 * corps de métier est importé et non recopié — deux présentations, une seule
 * source.
 */

const TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'warn',
  quoted: 'info',
  approved: 'info',
  done: 'ok',
}

const URGENCES: UrgencyKey[] = ['low', 'normal', 'blocking']

export function Signaler() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { notify } = useToast()
  const { works, units, isMine, addWork, loading } = usePortfolio()

  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState(false)
  const [metier, setMetier] = useState<TradeKey>('plumbing')
  const [urgence, setUrgence] = useState<UrgencyKey>('normal')
  const [detail, setDetail] = useState('')
  /* Le vol en cours : le bouton s'éteint, sans quoi une attente devenue visible
     ferait naître deux fiches d'intervention de la même fuite. */
  const [envoi, setEnvoi] = useState(false)

  const mesUnites = units.filter((u) => isMine(u.id))
  const miens = works.filter((w) => isMine(w.unitId))
  /* Le geste appartient au locataire : le bailleur ne signale pas un problème
     chez quelqu'un d'autre, il le reçoit. */
  const peutDeclarer = role === 'tenant' && mesUnites[0]

  async function envoyer() {
    if (!mesUnites[0]) return
    // La même borne que le serveur : le refus arrive avant l'aller-retour.
    if (titre.trim().length < 3) {
      setErreur(true)
      return
    }
    /**
     * « SIGNALEMENT ENVOYÉ » attend maintenant que le serveur l'ait accepté.
     *
     * La phrase partait avec l'appel et non avec sa réponse : sur un refus, le
     * locataire lisait qu'il avait signalé sa fuite PUIS que rien n'avait été
     * enregistré — et le formulaire s'était déjà vidé de ce qu'il venait
     * d'écrire, si bien qu'il ne restait même pas de quoi recommencer.
     */
    setEnvoi(true)
    const ouvert = await addWork(mesUnites[0].id, {
      title: titre.trim(),
      trade: metier,
      urgency: urgence,
      ...(detail.trim() ? { description: detail.trim() } : {}),
    })
    setEnvoi(false)
    // La saisie SURVIT au refus. Le motif est déjà dit par `signalerEchec` ;
    // faire retaper le locataire le punirait d'une panne qui n'est pas la sienne.
    if (!ouvert) return
    setTitre('')
    setDetail('')
    setErreur(false)
    notify(t('app.report.sent'), { tone: 'ok' })
  }

  return (
    <>
      <PageHeader title={t('app.report.title')} description={t('app.report.body')} />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {peutDeclarer ? (
          <Card className="flex flex-col gap-5">
            <Field
              label={t('app.report.what')}
              hint={t('app.report.whatHint')}
              required
              {...(erreur ? { error: t('app.report.whatError') } : {})}
            >
              {(champ) => (
                <Input
                  {...champ}
                  value={titre}
                  placeholder={t('app.report.whatPlaceholder')}
                  onChange={(e) => {
                    setTitre(e.target.value)
                    if (erreur) setErreur(false)
                  }}
                />
              )}
            </Field>

            {/* Pastilles plutôt que cartes radio : cinq métiers tiennent sur une
                rangée, et le locataire choisit — il n'arbitre pas.

                `radiogroup` et non une rangée de boutons : ces cinq choix sont
                EXCLUSIFS, et le rôle le dit au lecteur d'écran, qui annonce
                « 3 sur 5 ». `aria-checked` porte l'état ; la couleur ne le porte
                jamais seule. */}
            <Choix
              legende={t('app.report.trade')}
              valeurs={[...TRADES_REPORTABLE]}
              valeur={metier}
              onChange={setMetier}
              libelle={(cle) => t(`app.trades.${cle}` as 'app.trades.plumbing')}
            />

            <Choix
              legende={t('app.report.urgency')}
              valeurs={URGENCES}
              valeur={urgence}
              onChange={setUrgence}
              libelle={(cle) => t(`app.works.urgency_${cle}` as 'app.works.urgency_blocking')}
              // L'urgence maximale se distingue par sa TEINTE autant que par son
              // état : c'est le seul choix du formulaire qui engage un délai.
              tonPourValeur={(cle) => (cle === 'blocking' ? 'danger' : 'neutre')}
            />

            <Field label={t('app.report.detail')} optional hint={t('app.report.detailHint')}>
              {(champ) => (
                <Textarea {...champ} value={detail} onChange={(e) => setDetail(e.target.value)} />
              )}
            </Field>

            <div>
              <Button onClick={() => void envoyer()} loading={envoi}>
                {t('app.report.send')}
              </Button>
            </div>
          </Card>
        ) : (
          /* Le bailleur atteint cet écran depuis sa navigation : il y lit ce
             qu'on lui signale, sans pouvoir déclarer à la place d'un autre. */
          <Card>
            <EmptyState
              icon="bell"
              level={2}
              title={t('app.report.title')}
              body={t('app.report.body')}
            />
          </Card>
        )}

        <Card flush>
          <CardHeader
            title={t('app.report.mine')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />

          {/*
            L'état vide n'est PAS servi pendant l'attente.

            Un en-tête nu était rendu tant que `loading`, sans région
            `aria-busy` : rien n'annonçait l'attente, ni aux technologies
            d'assistance, ni au test qui l'écoute. Et « Aucun signalement »
            s'affichait alors sur des données pas encore arrivées — le locataire
            redéclare ce qu'il croit perdu.
          */}
          {loading ? (
            <div
              role="status"
              aria-busy="true"
              className="px-4 pb-4 text-body-s text-muted sm:px-5 sm:pb-5"
            >
              {t('common.loading')}
            </div>
          ) : miens.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <EmptyState
                icon="bell"
                title={t('app.report.emptyTitle')}
                body={t('app.report.emptyBody')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-divider border-t border-divider">
              {miens.map((work) => (
                <li key={work.id} className="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/*
                      Le STATUT, sans le montant. Le devis et le coût regardent
                      le bailleur ; ce qui intéresse le locataire est où en est
                      SA demande.
                    */}
                    <StatusPill tone={TONE[work.status]} size="sm">
                      {t(`app.works.${work.status}` as 'app.works.reported')}
                    </StatusPill>
                    {work.reference && (
                      <span className="numeric text-caps text-muted">{work.reference}</span>
                    )}
                  </div>
                  <p className="text-body font-medium">{workTitle(work, t)}</p>
                  <p className="text-caps text-muted">{d.dayMonth(work.reportedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/**
 * Un choix exclusif rendu en rangée de pastilles.
 *
 * `role="radiogroup"` et `role="radio"` plutôt qu'une rangée de `<button>` :
 * l'exclusivité est portée par la SÉMANTIQUE, et un lecteur d'écran annonce
 * « 3 sur 5 » au lieu de cinq boutons sans lien entre eux.
 *
 * Le motif est tenu EN ENTIER, et ce n'est pas une politesse. Première
 * version : `tabIndex` roulant, aucun gestionnaire de touches. La tabulation
 * entrait sur la pastille active, les flèches ne faisaient rien, et les autres
 * portaient `tabIndex={-1}` — donc la tabulation les sautait. Les deux choix
 * du formulaire étaient purement et simplement INUTILISABLES au clavier :
 * impossible de déclarer autre chose qu'une plomberie d'urgence normale sans
 * souris. C'est exactement ce que le portail avait déjà payé avec ses onglets,
 * et son commentaire le dit — annoncer une navigation aux flèches sans la
 * câbler est pire qu'une rangée de boutons ordinaires, qui au moins ne promet
 * rien et garde ses arrêts de tabulation.
 *
 * BORNAGE et non bouclage : la convention du dépôt, posée par `Combobox` et
 * reprise par les onglets du portail.
 */
function Choix<T extends string>({
  legende,
  valeurs,
  valeur,
  onChange,
  libelle,
  tonPourValeur,
}: {
  legende: string
  valeurs: T[]
  valeur: T
  onChange: (v: T) => void
  libelle: (v: T) => string
  tonPourValeur?: (v: T) => 'danger' | 'neutre'
}) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * La sélection SUIT le focus, comme les onglets du portail : les cinq choix
   * sont déjà en mémoire, changer d'avis ne coûte rien, et exiger une seconde
   * frappe pour valider ferait payer deux touches ce que la souris obtient en
   * un clic.
   */
  const allerA = (index: number) => {
    const cible = valeurs[index]
    if (cible === undefined) return
    onChange(cible)
    boutons.current[index]?.focus()
  }

  const auClavier = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const destination =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(index + 1, valeurs.length - 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? valeurs.length - 1
              : null

    if (destination === null) return
    // Les flèches feraient défiler la rangée débordante, `Début` et `Fin` le
    // document : dans les deux cas la page bougerait sous une commande qui ne
    // la concerne pas.
    e.preventDefault()
    allerA(destination)
  }

  return (
    <div>
      <p className="mb-2 text-label font-semibold">{legende}</p>
      <div role="radiogroup" aria-label={legende} className="flex flex-wrap gap-2">
        {valeurs.map((v, index) => {
          const actif = v === valeur
          const danger = tonPourValeur?.(v) === 'danger'
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={actif}
              // Un seul arrêt de tabulation pour le groupe, comme les onglets :
              // la tabulation traverse le formulaire, pas cinq métiers. Il ne
              // tient que parce que les flèches, elles, atteignent les autres.
              tabIndex={actif ? 0 : -1}
              ref={(node) => {
                boutons.current[index] = node
              }}
              onClick={() => onChange(v)}
              onKeyDown={(e) => auClavier(e, index)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3.5',
                'text-label font-medium transition-colors duration-150',
                actif && danger && 'border-danger-border bg-danger-tint text-danger',
                actif && !danger && 'border-ink bg-ink text-on-dark',
                !actif && 'border-border bg-surface-sunken text-ink hover:border-border-strong',
              )}
            >
              {libelle(v)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
