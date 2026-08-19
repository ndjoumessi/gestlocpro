import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Select } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { useRole } from '@/components/layout/AppShell'
import { api } from '@/api/client'

/**
 * Émission d'un code d'invitation.
 *
 * Le code n'est lisible QU'UNE FOIS, et l'écran doit le dire avant de le
 * montrer. Seule son empreinte est conservée côté serveur : une sauvegarde ou
 * un journal ne donnent accès à aucun parc, et personne — pas même le
 * propriétaire — ne peut le relire. Laisser croire qu'on le retrouvera dans une
 * liste ferait perdre l'accès à un locataire qui n'aurait pas noté.
 *
 * QUI PEUT INVITER QUOI. Le serveur réserve au propriétaire l'émission d'un
 * code de GESTIONNAIRE : sans cette règle, un gestionnaire faisait entrer un
 * pair sur tout le parc sans que le propriétaire l'apprenne, et rien ne
 * permettait de l'en retirer. L'écran, lui, offrait encore le choix — le
 * gestionnaire choisissait « Gestionnaire délégué », cliquait, et récoltait un
 * refus rendu par le `.catch()` générique en « L'action a échoué », sans
 * apprendre ni pourquoi ni que c'était définitif. On ne propose pas un geste
 * qu'on refusera : le champ disparaît, et une note dit qui recrute.
 */
export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { notify } = useToast()
  const { units } = usePortfolio()
  const { adhesionActive } = useSession()
  const { role } = useRole()
  const parkId = adhesionActive?.parkId ?? null

  // Même partage que les devis et les cautions : le gestionnaire OPÈRE, le
  // propriétaire ARBITRE. Recruter un pair est un acte de propriétaire.
  const peutRecruter = role === 'owner'

  const vacants = units.filter((u) => !u.tenant)

  // `roleInvite` est le rôle du FUTUR membre, à ne pas confondre avec `role`,
  // celui de la personne qui invite. Sa valeur initiale — locataire — est aussi
  // la seule qu'un gestionnaire puisse émettre : privé du champ, il n'a aucun
  // moyen de la changer, et l'appel part avec le seul rôle qu'on lui accorde.
  const [roleInvite, setRoleInvite] = useState<'tenant' | 'manager'>('tenant')
  const [unitId, setUnitId] = useState(vacants[0]?.id ?? '')
  const [code, setCode] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  const fermer = () => {
    setCode(null)
    setEnvoye(false)
    setEnvoi(false)
    onClose()
  }

  const emettre = () => {
    if (!parkId) return
    setEnvoi(true)
    void api
      .issueInvitation<{ code: string; envoye: boolean }>(parkId, {
        role: roleInvite,
        // L'unité n'accompagne qu'une invitation de LOCATAIRE : un gestionnaire
        // opère tout le parc, et lui en attacher une laisserait croire à un
        // périmètre qui n'existe pas.
        ...(roleInvite === 'tenant' && unitId ? { unitId } : {}),
      })
      .then(({ code: emis, envoye: parti }) => {
        setCode(emis)
        setEnvoye(parti)
      })
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={fermer}
      title={code ? t('app.invite.codeTitle') : t('app.invite.title')}
      description={code ? t('app.invite.codeOnce') : t('app.invite.description')}
      footer={
        code ? (
          <Button onClick={fermer}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={fermer}>
              {t('common.cancel')}
            </Button>
            <Button onClick={emettre} loading={envoi}>
              {t('app.invite.issue')}
            </Button>
          </>
        )
      }
    >
      {code ? (
        <div className="flex flex-col gap-4">
          {/* Le code en gros, en chiffres tabulaires : il se recopie à la main
              et se dicte au téléphone. */}
          <p className="numeric rounded-md bg-surface-sunken px-4 py-4 text-center text-h3 tracking-wider select-all">
            {code}
          </p>
          {/* Ce que l'écran dit de l'envoi vient du SERVEUR, jamais d'une
              supposition. Tant qu'aucun fournisseur n'est configuré, il dit
              qu'aucun SMS n'est parti — annoncer un envoi qui n'a pas eu lieu
              est le mensonge que ce produit a passé la journée à retirer. */}
          <p className="text-body-s text-muted">
            {envoye ? t('app.invite.sentBySms') : t('app.invite.notSent')} {t('app.invite.expires')}
          </p>
          <Button
            variant="secondary"
            icon="clipboard"
            onClick={() => {
              // `select-all` sur le code couvre déjà le cas où l'écriture dans
              // le presse-papiers est refusée — navigation privée, permission
              // absente : l'utilisateur peut toujours le sélectionner d'un clic.
              void navigator.clipboard
                ?.writeText(code)
                .then(() => notify(t('app.invite.copied'), { tone: 'ok' }))
                .catch(() => {})
            }}
          >
            {t('app.invite.copy')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {peutRecruter && (
            <Field label={t('app.invite.role')} required>
              {(props) => (
                <Select
                  {...props}
                  name="role"
                  value={roleInvite}
                  onChange={(e) => setRoleInvite(e.target.value as 'tenant' | 'manager')}
                >
                  <option value="tenant">{t('app.invite.roleTenant')}</option>
                  <option value="manager">{t('app.invite.roleManager')}</option>
                </Select>
              )}
            </Field>
          )}

          {/* Le champ ne devient pas un menu à un seul article : un choix qui
              n'en est pas un se lit comme une panne. La note prend sa place et
              dit ce qui va être émis — c'est le même geste que sur les devis et
              les cautions, où l'absence de bouton est expliquée plutôt que
              subie. */}
          {role === 'manager' && (
            <p className="flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
              <Icon name="info" size={15} className="mt-0.5 shrink-0" />
              {t('app.invite.managerNotice')}
            </p>
          )}

          {/* Ni `required` ni `optional` sur le logement.
              « Facultatif » invitait à passer outre, alors que l'omettre a une
              vraie conséquence : le locataire rejoint le parc sans bail. Et le
              marquer requis serait faux — on peut légitimement inviter d'abord
              et rattacher ensuite. L'aide porte la conséquence, ce qu'aucune
              étiquette ne sait dire. */}
          {roleInvite === 'tenant' && vacants.length > 0 && (
            <Field label={t('app.invite.unit')} hint={t('app.invite.unitHint')}>
              {(props) => (
                <Select
                  {...props}
                  name="unitId"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  {vacants.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}
