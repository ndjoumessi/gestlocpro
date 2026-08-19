import { useCallback, useEffect, useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StatusPill } from '@/components/primitives/StatusPill'
import { SkeletonTable } from '@/components/primitives/Skeleton'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useSession } from '@/api/SessionProvider'
import { api } from '@/api/client'

/**
 * QUI PEUT ENTRER DANS CE PARC.
 *
 * Les routes existaient depuis deux lots et n'avaient aucun écran : voir les
 * membres, reprendre un code, retirer un accès se faisaient en `curl`. Un
 * propriétaire ne pouvait donc ni savoir qui détenait une clé de son parc, ni
 * la reprendre — et le premier ménage de codes de test a dû se faire à la main
 * dans la base de production, faute de cet écran.
 *
 * `codeHint` trouve ici sa raison d'être. Les quatre derniers caractères sont
 * écrits à chaque émission depuis l'origine du produit, et n'avaient jamais été
 * relus : ils existaient pour cette liste, qui n'était pas construite.
 */
export function Access() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { notify } = useToast()
  const { adhesionActive, etat } = useSession()
  const monAdresse = etat.statut === 'connecte' ? etat.compte.email : null
  const parkId = adhesionActive?.parkId ?? null

  const [registre, setRegistre] = useState<RegistreApi | null>(null)
  const [chargement, setChargement] = useState(true)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(async () => {
    if (!parkId) return
    setChargement(true)
    try {
      setRegistre(await api.access<RegistreApi>(parkId))
    } catch {
      notify(t('common.actionFailed'), { tone: 'danger' })
    } finally {
      setChargement(false)
    }
  }, [parkId, notify, t])

  useEffect(() => {
    void charger()
  }, [charger])

  /**
   * Chaque geste RECHARGE le registre au lieu de retoucher la liste en mémoire.
   *
   * Retirer une ligne à la main serait plus rapide et mentirait à la première
   * divergence : un code repris par quelqu'un d'autre entre-temps, une adhésion
   * déjà retirée depuis un second onglet. La liste vient du serveur, qui est le
   * seul à savoir ce qui reste valable.
   */
  const agir = async (id: string, geste: () => Promise<unknown>, succes: string) => {
    setEnCours(id)
    try {
      await geste()
      notify(succes, { tone: 'ok' })
      await charger()
    } catch {
      notify(t('common.actionFailed'), { tone: 'danger' })
    } finally {
      setEnCours(null)
    }
  }

  const estProprietaire = role === 'owner'
  const membres = registre?.members ?? []
  const invitations = registre?.invitations ?? []

  if (chargement) return <RegistreEnChargement />

  return (
    <>
      <PageHeader title={t('app.access.title')} description={t('app.access.subtitle')} />

      {/* Le gestionnaire voit le registre mais n'en retire personne. Comme sur
          les devis et les cautions, on lui dit pourquoi le bouton lui manque
          plutôt que de le laisser deviner. */}
      {role === 'manager' && (
        <p className="mb-6 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.access.managerNotice')}
        </p>
      )}

      <Card flush>
        <CardHeader
          title={t('app.access.membersTitle')}
          description={t('app.access.membersHint')}
        />
        <DataTable<MembreApi>
          caption={t('app.access.membersTitle')}
          rows={membres}
          rowKey={(m) => m.id}
          columns={[
            {
              key: 'nom',
              header: t('app.access.member'),
              render: (m) => (
                <div className="flex flex-col">
                  <span className="font-medium">{m.fullName}</span>
                  <span className="text-body-s text-muted">{m.email}</span>
                </div>
              ),
            },
            {
              key: 'role',
              header: t('app.invite.role'),
              render: (m) => (
                <StatusPill tone={m.role === 'owner' ? 'info' : 'neutral'} size="sm">
                  {t(`app.access.role_${m.role}` as 'app.access.role_owner')}
                </StatusPill>
              ),
            },
            {
              key: 'depuis',
              header: t('app.access.since'),
              hideOnMobile: true,
              render: (m) => d.fullDate(enParties(m.since)),
            },
            {
              key: 'geste',
              header: t('app.access.action'),
              render: (m) => {
                /**
                 * SA PROPRE LIGNE ne porte pas de bouton.
                 *
                 * Le serveur refuse l'auto-retrait — un parc dont le dernier
                 * propriétaire est parti n'est plus atteignable par personne —
                 * et l'écran ne propose pas un geste qu'on refusera. La
                 * comparaison porte sur l'adresse, qui est unique en base ; le
                 * registre ne rend pas l'identifiant du compte, seulement celui
                 * de l'adhésion.
                 */
                const soiMeme = monAdresse === m.email
                if (!estProprietaire || soiMeme) return null
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={enCours === m.id}
                    onClick={() =>
                      void agir(
                        m.id,
                        () => api.revokeMembership(parkId!, m.id),
                        t('app.access.memberRevoked'),
                      )
                    }
                  >
                    {t('app.access.revokeMember')}
                  </Button>
                )
              },
            },
          ]}
        />
      </Card>

      <div className="mt-8">
        <Card flush>
          <CardHeader
            title={t('app.access.invitesTitle')}
            description={t('app.access.invitesHint')}
          />
          <DataTable<InvitationApi>
            caption={t('app.access.invitesTitle')}
            rows={invitations}
            rowKey={(i) => i.id}
            empty={
              <EmptyState
                icon="key"
                title={t('app.access.noInvites')}
                body={t('app.access.noInvitesBody')}
              />
            }
            columns={[
              {
                key: 'code',
                header: t('app.access.code'),
                render: (i) => (
                  <div className="flex flex-col">
                    {/* L'indice, jamais le code : seule son empreinte est en
                        base, et personne — pas même le propriétaire — ne peut
                        le relire. Il sert à RECONNAÎTRE un code qu'on a
                        transmis, pas à le retrouver. */}
                    <span className="numeric font-medium">••••-{i.codeHint}</span>
                    <span className="text-body-s text-muted">
                      {i.unitLabel ?? t('app.access.noUnit')}
                    </span>
                  </div>
                ),
              },
              {
                key: 'role',
                header: t('app.invite.role'),
                render: (i) => (
                  <StatusPill tone="neutral" size="sm">
                    {t(`app.access.role_${i.role}` as 'app.access.role_owner')}
                  </StatusPill>
                ),
              },
              {
                key: 'expire',
                header: t('app.access.expires'),
                hideOnMobile: true,
                render: (i) => d.fullDate(enParties(i.expiresAt)),
              },
              {
                key: 'geste',
                header: t('app.access.action'),
                render: (i) => {
                  // Reprendre un code de gestionnaire, c'est décider qui
                  // n'entre pas — le pendant du recrutement, donc réservé au
                  // propriétaire. Les codes de locataire restent au
                  // gestionnaire, émission comme retrait.
                  if (i.role === 'manager' && !estProprietaire) return null
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={enCours === i.id}
                      onClick={() =>
                        void agir(
                          i.id,
                          () => api.revokeInvitation(parkId!, i.id),
                          t('app.access.inviteRevoked'),
                        )
                      }
                    >
                      {t('app.access.revokeInvite')}
                    </Button>
                  )
                },
              },
            ]}
          />
        </Card>
      </div>
    </>
  )
}

/**
 * Instant ISO vers les parties d'une date, dans le fuseau de qui regarde.
 *
 * Le fuseau LOCAL est ici le bon choix, à rebours de la règle qui vaut pour les
 * dates de bail : celles-ci sont des jours calendaires — le 1er du mois est le
 * 1er partout — et les lire par un fuseau les décale d'un jour. `since` et
 * `expiresAt` sont des INSTANTS : un code qui expire à minuit à Douala expire
 * à 23 h à Londres, et c'est bien l'heure de son lecteur qui l'intéresse.
 */
function enParties(iso: string) {
  const date = new Date(iso)
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

interface MembreApi {
  id: string
  role: 'owner' | 'manager' | 'tenant'
  fullName: string
  email: string
  since: string
}

interface InvitationApi {
  id: string
  role: 'tenant' | 'manager'
  codeHint: string
  expiresAt: string
  issuedAt: string
  unitId: string | null
  unitLabel: string | null
}

interface RegistreApi {
  members: MembreApi[]
  invitations: InvitationApi[]
}

function RegistreEnChargement() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.access.title')} description={t('app.access.subtitle')} />
      <SkeletonTable rows={3} />
    </>
  )
}
