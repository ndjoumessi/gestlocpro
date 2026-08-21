import { useEffect, useRef, useState } from 'react'
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
  //
  // ET ENCORE FAUT-IL QUE LE PARC DÉLÈGUE. `Park.delegation` décidait de rien :
  // un propriétaire ayant répondu « je gère seul » se voyait proposer le code
  // GESTIONNAIRE dans la minute, et le serveur l'émettait. Il refuse désormais
  // en 409 `delegation_off` — on ne propose donc plus ce geste, on dit ce qui le
  // rendrait possible.
  //
  // `?? 'delegate'` : un serveur antérieur au champ ne le rend pas, et le
  // supposer `solo` retirerait le recrutement à des parcs qui l'ont.
  const gereSeul = (adhesionActive?.delegation ?? 'delegate') === 'solo'
  const peutRecruter = role === 'owner' && !gereSeul

  const vacants = units.filter((u) => !u.tenant)

  // `roleInvite` est le rôle du FUTUR membre, à ne pas confondre avec `role`,
  // celui de la personne qui invite. Sa valeur initiale — locataire — est aussi
  // la seule qu'un gestionnaire puisse émettre : privé du champ, il n'a aucun
  // moyen de la changer, et l'appel part avec le seul rôle qu'on lui accorde.
  const [roleInvite, setRoleInvite] = useState<'tenant' | 'manager'>('tenant')
  const [unitId, setUnitId] = useState(vacants[0]?.id ?? '')
  const [code, setCode] = useState<string | null>(null)
  const codeRef = useRef<HTMLDivElement>(null)

  // Le panneau du code prend le focus dès qu'il paraît, et c'est ici que
  // cela compte le plus : ce code est LA chose que l'utilisateur venait
  // chercher, et le produit dit lui-même qu'il n'est plus lisible ensuite.
  // Sans replacement, la bascule démonte le formulaire et le focus retombe
  // sur `<body>` — le lecteur d'écran ne saura jamais que le code existe.
  useEffect(() => {
    codeRef.current?.focus()
  }, [code])
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
            <Button type="submit" form="invitation" loading={envoi}>
              {t('app.invite.issue')}
            </Button>
          </>
        )
      }
    >
      {code ? (
        <div ref={codeRef} tabIndex={-1} className="flex flex-col gap-4">
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
          id="invitation"
          onSubmit={(e) => {
            e.preventDefault()
            emettre()
          }}
          noValidate
          className="flex flex-col gap-5"
        >
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

          {/* Au PROPRIÉTAIRE d'un parc en gestion seule, la note dit autre chose
              que celle du gestionnaire : ce n'est pas un droit qui lui manque,
              c'est un réglage qu'il détient. Elle nomme donc l'écran où il se
              change plutôt que de le laisser deviner. */}
          {role === 'owner' && gereSeul && (
            <p className="flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
              <Icon name="info" size={15} className="mt-0.5 shrink-0" />
              {t('app.onboarding.delegationOffNotice')}
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
        </form>
      )}
    </Modal>
  )
}
