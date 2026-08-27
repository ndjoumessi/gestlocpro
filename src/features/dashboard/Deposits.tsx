import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input, Textarea } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { type Deposit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

const TONE: Record<Deposit['status'], StatusTone> = {
  held: 'info',
  settling: 'warn',
  returned: 'ok',
}

export function Deposits() {
  const t = useT()
  const { money } = useCurrency()
  const { role } = useRole()
  const { notify } = useToast()

  // Les cautions viennent de l'état partagé : arbitrer ici doit se voir dans
  // l'espace locataire, qui affiche la caution consignée du bail.
  const {
    deposits: TOUTES,
    settleDeposit,
    unsettleDeposit,
    unitById,
    isMine,
    loading,
  } = usePortfolio()

  /**
   * Le locataire ne voit que SA caution.
   *
   * L'écran vient de s'ouvrir à lui — c'est son argent — et il listait alors le
   * parc entier, noms compris. Le filtre est posé à la SOURCE et non à
   * l'affichage : les trois totaux du haut se calculent dessus, sans quoi il
   * lirait « total consigné » sur les cautions de ses voisins.
   */
  const deposits = TOUTES.filter((d) => role !== 'tenant' || isMine(d.unitId))
  const [settling, setSettling] = useState<Deposit | null>(null)

  /**
   * Arbitrer une caution est le droit qui distingue le propriétaire du
   * gestionnaire — c'est écrit dans la matrice des droits. L'écran ne
   * l'exposait nulle part : deux cautions étaient « en cours d'arbitrage »
   * sans moyen de les arbitrer.
   */
  const canSettle = role === 'owner'

  const totalHeld = deposits.reduce((sum, d) => sum + d.held, 0)
  const totalWithheld = deposits.reduce((sum, d) => sum + d.withheld, 0)

  const settle = (unitId: string, withheld: number, reason?: string) => {
    // La justification traverse jusqu'au serveur, qui l'exige dès qu'il y a une
    // retenue. Elle était saisie, rendue obligatoire par la modale — « un
    // décompte sans motif est indéfendable » — et perdue une ligne plus bas.
    settleDeposit(unitId, withheld, reason)
    setSettling(null)
    /**
     * L'annulation est offerte AVEC le message, et elle est réelle.
     *
     * C'est le geste le plus lourd du produit après la mise en demeure : il
     * retient l'argent de quelqu'un. Une retenue portée sur la mauvaise caution
     * ne se réparait que dans la base.
     *
     * Elle n'expire pas : une erreur de ligne se découvre en relisant sa liste,
     * pas dans les six secondes du message. Le journal garde LES DEUX
     * décisions — le locataire a pu voir la première.
     */
    notify(t('app.deposits.settled'), {
      tone: 'ok',
      action: { label: t('common.undo'), onClick: () => unsettleDeposit(unitId) },
    })
  }

  /**
   * Après la déclaration de `settle` — les crochets doivent tourner à chaque
   * rendu — et avant le moindre total.
   *
   * L'argument de retenue est de l'argent qui appartient à un locataire. Le
   * propriétaire voyait « 555 000 FCFA consignés » et deux cautions offertes à
   * l'arbitrage : cliquer aurait envoyé au serveur l'identifiant d'une caution
   * de démonstration — refusée, mais après avoir fait prendre une décision sur
   * des chiffres qui n'étaient pas les bons.
   */
  if (loading) return <DepositsSkeleton isManager={role === 'manager'} />

  return (
    <>
      <PageHeader title={t('app.deposits.title')} description={t('app.deposits.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          TROIS COLONNES SEULEMENT QUAND LA CARTE PEUT PORTER UN MONTANT.
      
          `sm:grid-cols-3` les posait dès 640 px. Mesuré à 700 px : la carte
          offre 159 px de contenu, « 1 397 000 FCFA » en demande 189, et le
          montant FRANCHIT la bordure de 9 px — les cautions le font deux fois
          sur le même écran. Rien ne pouvait le couper : `Intl.NumberFormat`
          pose une espace INSÉCABLE avant la devise, donc un montant est
          insécable de bout en bout et `whitespace-nowrap` n'y est pour rien.
          Le seul levier est la largeur de colonne.
      
          Deux colonnes jusqu'à `lg`, trois ensuite : `md` (768 px) ne suffit
          pas — il en faudrait environ 790 pour que trois cartes portent ce
          montant. C'est l'arbitrage du tableau de bord et du parc, qui
          attendent `xl` pour passer à quatre.
        */}
        {/* Le BOUCLIER pour ce qui est consigné — le même que porte « caution à
            arbitrer » sur le tableau de bord —, le CADENAS pour ce qui est
            retenu, la CARTE pour ce qui repart chez le locataire. Trois états
            d'un même argent : trois glyphes, sans quoi les trois cartes ne se
            distinguent que par leur intitulé. */}
        <StatCard
          icone="shield"
          label={t('app.deposits.totalHeld')}
          value={money(totalHeld, { round: true })}
        />
        <StatCard
          icone="lock"
          label={t('app.deposits.withheld')}
          value={money(totalWithheld, { round: true })}
        />
        <StatCard
          icone="card"
          label={t('app.deposits.balance')}
          value={money(totalHeld - totalWithheld, { round: true })}
        />
      </div>

      {/* Le gestionnaire voit les cautions mais ne les arbitre pas. On lui dit
          pourquoi le bouton lui manque, plutôt que de le laisser deviner. */}
      {role === 'manager' && (
        <p className="mt-6 flex items-start gap-2 rounded-md border border-accent-border bg-accent-tint px-3.5 py-3 text-body text-accent-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.deposits.managerNotice')}
        </p>
      )}

      <div className="mt-6">
        <DataTable<Deposit>
          caption={t('app.deposits.title')}
          rows={deposits}
          rowKey={(d) => d.unitId}
          /* Sans cela, l'écran servait des en-têtes de colonnes au-dessus du
             vide : ni ligne, ni message, ni indication de ce qui manque. Un
             tableau nu se lit comme une panne. */
          empty={
            <EmptyState
              icon="shield"
              level={2}
              title={t('app.deposits.emptyTitle')}
              /* Un seul corps : cet écran est réservé au propriétaire et au
                 gestionnaire — `Restricted allow={['owner','manager']}` — et un
                 texte écrit pour le locataire n'y serait jamais lu. */
              body={t('app.deposits.emptyBody')}
            />
          }
          columns={[
            {
              key: 'unit',
              header: t('app.portfolio.unit'),
              width: '5.5rem',
              // `unitId` est l'identifiant technique — un `uuid` une fois les
              // données servies par l'API. C'est le libellé qui s'affiche.
              render: (d) => (
                <span className="numeric font-medium">
                  {unitById(d.unitId)?.label ?? d.unitId}
                </span>
              ),
            },
            {
              key: 'tenant',
              header: t('app.portfolio.tenant'),
              render: (d) => d.tenant ?? t('app.deposits.formerTenant'),
            },
            {
              key: 'held',
              header: t('app.deposits.amountHeld'),
              numeric: true,
              render: (d) => money(d.held, { round: true }),
            },
            {
              key: 'withheld',
              header: t('app.deposits.withheld'),
              numeric: true,
              hideOnMobile: true,
              render: (d) =>
                d.withheld ? (
                  <span className="font-medium text-danger">
                    −{money(d.withheld, { round: true })}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'balance',
              header: t('app.deposits.balance'),
              numeric: true,
              render: (d) => (
                <span className="font-medium">{money(d.held - d.withheld, { round: true })}</span>
              ),
            },
            {
              key: 'status',
              header: t('app.portfolio.status'),
              render: (d) => (
                <div className="flex items-center justify-between gap-3">
                  <StatusPill tone={TONE[d.status]} size="sm">
                    {t(`app.deposits.${d.status}` as 'app.deposits.held')}
                  </StatusPill>
                  {d.status === 'settling' && canSettle && (
                    <Button size="sm" onClick={() => setSettling(d)}>
                      {t('app.deposits.settle')}
                    </Button>
                  )}
                  {/*
                    Défaire l'arbitrage : UN BOUTON, et pas seulement l'action
                    d'un message qui s'efface au bout de quatre secondes et
                    demie. C'est le geste le plus lourd du produit après la mise
                    en demeure — il retient l'argent de quelqu'un — et une
                    retenue portée sur la mauvaise ligne se découvre en relisant
                    sa liste, pas dans les secondes qui suivent le clic.
                  */}
                  {d.status === 'returned' && canSettle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        unsettleDeposit(d.unitId)
                        notify(t('app.deposits.unsettled_toast'), { tone: 'ok' })
                      }}
                    >
                      {t('app.deposits.unsettle')}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {settling && (
        <SettleModal deposit={settling} onClose={() => setSettling(null)} onConfirm={settle} />
      )}
    </>
  )
}

/**
 * Les cautions, le temps que le parc arrive.
 *
 * L'en-tête ne porte aucune action : rien à retenir de ce côté.
 *
 * L'avis destiné au gestionnaire ne dépend d'aucune donnée — c'est la règle de
 * délégation, qui se lit dans le rôle et non dans le parc. Il tient pourtant sa
 * place en squelette plutôt que d'être écrit : il vit à l'INTÉRIEUR de la zone
 * en attente, entre les cartes et le tableau, et la seule autre façon de le
 * rendre en clair serait d'ouvrir une deuxième `SkeletonRegion` — donc une
 * deuxième annonce d'attente pour un seul écran.
 */
function DepositsSkeleton({ isManager }: { isManager: boolean }) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.deposits.title')} description={t('app.deposits.subtitle')} />

      <SkeletonRegion>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((carte) => (
            <SkeletonStatCard key={carte} />
          ))}
        </div>

        {/* Même boîte que l'avis : `py-3` autour d'une ligne de corps réduit. */}
        {isManager && (
          <div className="mt-6 rounded-md border border-divider px-3.5 py-3">
            <Skeleton line="bodyS" className="w-80 max-w-full" />
          </div>
        )}

        <div className="mt-6">
          <SkeletonTable />
        </div>
      </SkeletonRegion>
    </>
  )
}

/**
 * Arbitrage d'une caution.
 *
 * Le solde se recalcule à la saisie : c'est le chiffre que le locataire
 * recevra, il doit être visible pendant qu'on décide, pas après. Une retenue
 * non justifiée est refusée — le locataire peut la contester, et un décompte
 * sans motif est indéfendable.
 */
function SettleModal({
  deposit,
  onClose,
  onConfirm,
}: {
  deposit: Deposit
  onClose: () => void
  onConfirm: (unitId: string, withheld: number, reason?: string) => void
}) {
  const t = useT()
  const { money, parseAmount } = useCurrency()
  const { unitById } = usePortfolio()

  /**
   * Pré-rempli par les RÉSERVES DE SORTIE, quand il y en a.
   *
   * C'est la moitié manquante de « imputation chiffrée sur la caution » : le
   * montant était relevé à l'état des lieux, journalisé, puis ressaisi ici à la
   * main. Deux saisies pour un seul fait, dont la seconde pouvait diverger de la
   * première sans que rien ne le dise.
   *
   * PROPOSÉ et non imposé : le champ reste modifiable, et la retenue demeure une
   * décision du propriétaire. L'état des lieux en est la pièce, pas l'auteur.
   */
  const [withheld, setWithheld] = useState(
    String(deposit.withheld || deposit.billable || ''),
  )
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ withheld?: string; reason?: string }>({})

  // Voir `parseMoney` : lire la virgule comme un séparateur décimal quelle que
  // soit la devise faisait d'une retenue de « 1,450 » une retenue de 1,45.
  //
  // LE `?? 0` EST PARTI, et c'est lui qui rendait le défaut muet : il ramenait
  // une saisie que personne n'avait su lire à une retenue NULLE. Les deux
  // erreurs de `submit` se règlent sur ce nombre — dépassement de la caution,
  // justification exigée — donc aucune ne pouvait se déclencher, et la caution
  // s'arbitrait à zéro retenue sur un montant fantôme. Un champ VIDE, lui, vaut
  // bien zéro : restituer l'intégralité est le cas normal, et c'est ce que
  // promet le libellé d'aide du champ.
  const parsed = withheld.trim() ? parseAmount(withheld) : 0
  // Tant que le montant ne se lit pas, le solde montré est la caution
  // ENTIÈRE — rien de lisible n'en est encore retenu. Le calculer sur un zéro
  // inventé aurait mis à l'écran un nombre sans donnée derrière.
  const balance = parsed === null ? deposit.held : deposit.held - parsed

  const submit = () => {
    // Le refus vient AVANT tout le reste : un montant qu'on ne sait pas lire ne
    // se compare à rien, et c'est de n'être jamais dit qu'il tirait sa nocivité.
    if (parsed === null || parsed < 0) {
      setErrors({ withheld: t('common.amountUnreadable') })
      return
    }

    const next: typeof errors = {}
    if (parsed > deposit.held) {
      next.withheld = t('app.deposits.errorTooHigh', {
        amount: money(deposit.held, { round: true }),
      })
    }
    if (parsed > 0 && reason.trim().length < 3) {
      next.reason = t('app.deposits.errorJustification')
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onConfirm(deposit.unitId, parsed, reason.trim() || undefined)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('app.deposits.settleTitle')}
      description={t('app.deposits.settleDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('app.deposits.confirmSettle')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-md border border-divider bg-surface-sunken px-4 py-3">
          <span className="numeric text-title-m font-medium">
            {unitById(deposit.unitId)?.label ?? deposit.unitId}
          </span>
          <span className="min-w-0 flex-1 truncate text-body text-muted">
            {deposit.tenant ?? t('app.deposits.formerTenant')}
          </span>
          <span className="numeric text-body font-medium">
            {money(deposit.held, { round: true })}
          </span>
        </div>

        <Field
          label={t('app.deposits.withheldAmount')}
          hint={t('app.deposits.withheldHint')}
          error={errors.withheld}
        >
          {(props) => (
            <Input
              {...props}
              name="withheld"
              inputMode="decimal"
              value={withheld}
              placeholder="0"
              onChange={(e) => setWithheld(e.target.value)}
              className="numeric"
            />
          )}
        </Field>

        <Field
          label={t('app.deposits.justification')}
          hint={t('app.deposits.justificationHint')}
          error={errors.reason}
          optional={parsed === 0}
        >
          {(props) => (
            <Textarea
              {...props}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>

        {/* Le solde est calculé sous les yeux de celui qui décide. */}
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3.5 ${
            balance < 0
              ? 'border-danger-border bg-danger-tint text-danger'
              : 'border-ok-border bg-ok-tint text-ok'
          }`}
        >
          <span className="text-body font-medium">{t('app.deposits.balanceToReturn')}</span>
          {/* `money()` porte déjà le symbole : en ajouter un second donnait
              « 185 000 FCFA FCFA ». */}
          <span className="numeric text-title-l font-medium">
            {money(balance, { round: true })}
          </span>
        </div>
      </div>
    </Modal>
  )
}
