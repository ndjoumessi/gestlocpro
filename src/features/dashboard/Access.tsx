import { useCallback, useEffect, useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Modal } from '@/components/primitives/Modal'
import { StatusPill } from '@/components/primitives/StatusPill'
import { SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
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
  /**
   * L'ÉCHEC DE LECTURE EST RETENU, au lieu de passer dans un toast qui s'efface.
   *
   * Ce qui restait derrière le toast, c'étaient deux tables vides et « Aucun
   * code en attente » — une phrase qui AFFIRME avoir regardé. L'écran n'avait
   * rien lu : un registre qu'on n'a pas pu ouvrir n'est pas un registre vide,
   * et la confusion coûte ici un code réémis en double pendant que le premier
   * ouvre toujours.
   */
  const [erreur, setErreur] = useState(false)
  /**
   * AUCUNE RÉVOCATION NE PART DU PREMIER CLIC.
   *
   * Retirer un accès et reprendre un code sont irréversibles : le serveur ne
   * sait pas défaire, et un code repris n'est pas réémis — il est perdu pour
   * celui à qui on l'avait transmis. Les deux boutons vivaient au bout d'une
   * colonne étroite, à côté de celui de la ligne voisine. Le motif est celui
   * de `Tenants`, repris tel quel plutôt que réinventé : la question se pose
   * avant le geste, et de la même façon partout.
   */
  const [aRetirer, setARetirer] = useState<ARetirer | null>(null)

  const charger = useCallback(async () => {
    /**
     * L'ATTENTE SE TERMINE AUSSI QUAND IL N'Y A RIEN À ATTENDRE.
     *
     * `chargement` naît à `true` et n'était remis à `false` que dans le
     * `finally`, en aval de ce retour : une session sans adhésion — la
     * démonstration, un compte dont le parc vient d'être retiré — laissait le
     * squelette tourner sans fin. C'est mot pour mot ce que `PortfolioProvider`
     * interdit : « Un squelette qu'aucune réponse ne vient effacer est pire
     * qu'une erreur : il promet que quelque chose arrive. »
     */
    if (!parkId) {
      setChargement(false)
      return
    }
    setChargement(true)
    setErreur(false)
    try {
      setRegistre(await api.access<RegistreApi>(parkId))
    } catch {
      setErreur(true)
    } finally {
      setChargement(false)
    }
  }, [parkId])

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
  // L'ordre compte : sans parc, aucune lecture n'a eu lieu, donc aucun échec à
  // dire. On nomme d'abord ce qui manque le plus en amont.
  if (!parkId) return <RegistreSansParc />
  if (erreur) return <RegistreIllisible onReessayer={() => void charger()} />

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
                    onClick={() => setARetirer({ genre: 'membre', membre: m })}
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
                      onClick={() => setARetirer({ genre: 'code', code: i })}
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

      {/* Le motif de confirmation de `Tenants` recopié plutôt que réécrit :
          `alertdialog`, taille `sm`, le refus à gauche et le geste destructeur
          à droite. Deux motifs de confirmation feraient de la question posée
          avant un geste irréversible une affaire de goût, et le second finirait
          par s'en passer. */}
      {aRetirer && (
        <Modal
          open
          onClose={() => setARetirer(null)}
          role="alertdialog"
          size="sm"
          title={
            aRetirer.genre === 'membre'
              ? t('app.access.confirmMemberTitle', { name: aRetirer.membre.fullName })
              : t('app.access.confirmInviteTitle', { hint: aRetirer.code.codeHint })
          }
          description={
            aRetirer.genre === 'membre'
              ? t('app.access.confirmMemberBody')
              : t('app.access.confirmInviteBody')
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setARetirer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                /**
                 * La modale se ferme AVANT que le geste parte, et non après.
                 *
                 * `agir` relit le registre, et cette relecture repose un
                 * `chargement` : l'écran redevient un squelette et la modale
                 * disparaît avec lui, pour reparaître au retour des données le
                 * temps d'un rendu — un dialogue qui redemande ce qu'on vient
                 * de lui accorder, et qui reprend le focus au passage. La
                 * réponse est donnée ; l'attente se lit sur la ligne, dont le
                 * bouton porte déjà `loading`.
                 */
                onClick={() => {
                  const cible = aRetirer
                  setARetirer(null)
                  void (cible.genre === 'membre'
                    ? agir(
                        cible.membre.id,
                        () => api.revokeMembership(parkId!, cible.membre.id),
                        t('app.access.memberRevoked'),
                      )
                    : agir(
                        cible.code.id,
                        () => api.revokeInvitation(parkId!, cible.code.id),
                        t('app.access.inviteRevoked'),
                      ))
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          {/* Ce que le titre ne dit pas : DE QUI, ou de quel logement. Deux
              lignes voisines portent le même libellé de bouton — c'est la
              donnée qui les distingue, pas la question. */}
          <p className="text-body-s text-muted">
            {aRetirer.genre === 'membre'
              ? aRetirer.membre.email
              : (aRetirer.code.unitLabel ?? t('app.access.noUnit'))}
          </p>
        </Modal>
      )}
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
      {/**
        * L'ATTENTE S'ANNONCE, comme sur les onze autres écrans.
        *
        * Le squelette était rendu nu : ni `role="status"` ni `aria-busy`, donc
        * un écran muet pendant les secondes qui séparent la navigation de
        * l'arrivée du registre — précisément ce que le commentaire de
        * `SkeletonRegion` désigne comme le deuxième plus mauvais choix.
        *
        * Le manque avait un second effet, invisible à l'usage : `PageHeader`
        * étant rendu à l'identique dans les deux états, RIEN ne distinguait
        * l'écran en attente de l'écran chargé. Le harnais de test n'avait donc
        * aucun point de synchronisation ici, et six exécutions sur vingt
        * tombaient sur cinq cas différents.
        */}
      <SkeletonRegion>
        <SkeletonTable rows={3} />
      </SkeletonRegion>
    </>
  )
}

/**
 * Ce qu'on s'apprête à retirer : une personne, ou un code.
 *
 * Une union plutôt que deux états jumeaux : les deux gestes posent la même
 * question au même endroit, et deux drapeaux indépendants laisseraient exister
 * l'état où l'on confirme les deux à la fois — celui qu'on n'écrit jamais et
 * qui finit par arriver.
 */
type ARetirer =
  | { genre: 'membre'; membre: MembreApi }
  | { genre: 'code'; code: InvitationApi }

/**
 * AUCUN PARC RATTACHÉ — un état, pas une attente.
 *
 * Il se rencontre sous `/demo`, dont la session ne porte aucune adhésion, et
 * sur un compte dont le dernier parc vient d'être retiré. L'écran n'a alors
 * rien à demander au serveur : il ne le dit pas en tournant, il le dit. « Un
 * squelette qu'aucune réponse ne vient effacer est pire qu'une erreur : il
 * promet que quelque chose arrive. »
 */
function RegistreSansParc() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.access.title')} description={t('app.access.subtitle')} />
      <Card>
        <EmptyState
          icon="key"
          level={2}
          title={t('app.access.noParkTitle')}
          body={t('app.access.noParkBody')}
        />
      </Card>
    </>
  )
}

/**
 * LA LECTURE A ÉCHOUÉ, et l'écran le dit plutôt que de montrer une liste vide.
 *
 * L'échec n'était signalé que par un toast, qui s'efface. Restaient deux tables
 * vides et « Aucun code en attente » : un propriétaire qui vient de transmettre
 * un code et ne le retrouve plus en émet un second, pendant que le premier
 * ouvre toujours. Le registre est justement l'écran où l'on ne devine pas.
 *
 * Le motif est celui de la vitrine des états du système : ce qui a échoué, ce
 * qui est préservé, et une sortie. La sortie RELIT au lieu de recharger la
 * page — il n'y a rien de saisi à perdre, mais rien non plus à jeter.
 */
function RegistreIllisible({ onReessayer }: { onReessayer: () => void }) {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.access.title')} description={t('app.access.subtitle')} />
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-tint px-4 py-3.5"
      >
        <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <p className="text-body font-medium text-danger">{t('app.access.loadFailedTitle')}</p>
          <p className="mt-1 text-body-s text-danger">{t('app.access.loadFailedBody')}</p>
          <Button
            variant="secondary"
            size="sm"
            icon="arrowRight"
            className="mt-3"
            onClick={onReessayer}
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    </>
  )
}
