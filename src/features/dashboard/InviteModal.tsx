import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Notice } from '@/components/primitives/Notice'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Select } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ACCES_DEMO } from '@/data/portfolio'
import { useSession } from '@/api/SessionProvider'
import { useRole } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
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
/** Une invitation du registre, réduite à ce que ce menu en lit. */
interface InvitationDuMenu {
  unitId: string | null
  unitLabel: string | null
}

/**
 * Les logements déjà pris par un code VIVANT.
 *
 * Le registre ne rend que les codes utilisables — `acceptedAt`, `revokedAt`
 * nuls et non expirés, c'est son propre en-tête qui le dit : « les invitations
 * rendues sont exactement celles que `/api/join` accepterait ». Il n'y a donc
 * rien à filtrer sur la validité ici, seulement à retenir celles qui portent un
 * logement — un code de gestionnaire n'en porte aucun.
 */
function logementsDesCodes(invitations: InvitationDuMenu[]): { id: string; label: string }[] {
  return invitations
    .filter((i): i is { unitId: string; unitLabel: string | null } => Boolean(i.unitId))
    .map((i) => ({ id: i.unitId, label: i.unitLabel ?? i.unitId }))
}

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { notify } = useToast()
  const { units } = usePortfolio()
  const { adhesionActive, estDemo } = useSession()
  const { role } = useRole()
  const base = useBase()
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

  /**
   * LES LOGEMENTS QUI PORTENT DÉJÀ UN CODE VIVANT.
   *
   * `bail_unique_par_unite` pose un index unique partiel sur `Invitation.unitId`
   * là où `acceptedAt` et `revokedAt` sont nuls : UN SEUL code vivant par
   * logement. La règle est bonne — deux codes valides pour un seul accès, on ne
   * saurait plus lequel reprendre — et le serveur la traduit en 409.
   *
   * Ce menu, lui, listait tout le parc. Un propriétaire dont le code pour A1
   * attend encore le voyait, le choisissait, et récoltait un refus. Signalé sur
   * la production : « je vois encore A1, donc je peux encore générer le code,
   * alors que le premier est toujours là — ce n'est pas logique. »
   *
   * ON NE PROPOSE PAS UN GESTE QU'ON REFUSERA : la règle que cette modale
   * applique déjà au champ de rôle, quelques lignes plus bas.
   */
  const [prisParUnCode, setPrisParUnCode] = useState<{ id: string; label: string }[]>([])

  /**
   * LE LOGEMENT QU'UN FORMULAIRE NEUF PROPOSE : le premier du parc.
   *
   * `units` et non `logements` : à l'instant qui compte — l'ouverture, avant
   * que le registre ne réponde — rien n'a encore été retiré, les deux listes
   * sont donc la même. C'est aussi une valeur PRIMITIVE, ce dont l'effet
   * ci-dessous a besoin pour la prendre en dépendance sans se rejouer à chaque
   * rendu du fournisseur de parc : l'identité d'un tableau change, l'identifiant
   * du premier logement ne change qu'à l'arrivée du parc.
   */
  const logementParDefaut = units[0]?.id ?? ''

  useLayoutEffect(() => {
    /**
     * LE FORMULAIRE NAÎT À L'OUVERTURE, ET NON AU MONTAGE.
     *
     * Les deux appelants montaient cette modale SOUS CONDITION —
     * `{inviteOuverte && <InviteModal open …>}` — et fermer la démontait. Chaque
     * état repartait donc de sa valeur initiale et cet effet se rejouait, non
     * parce que la modale savait se remettre à zéro, mais parce qu'il n'en
     * restait rien. Il n'y avait aucun défaut à l'écran : le montage faisait en
     * silence le travail que le composant ne faisait pas, et le `&&` qui le
     * cachait est exactement ce que la sortie en animation demande de retirer.
     *
     * DEUX CHOSES FUYAIENT, et elles sont réparées ici ensemble parce qu'elles
     * ont la même cause — une valeur établie une fois pour toutes au montage :
     *
     *  1. La fermeture remettait `code`, `envoye` et `envoi`, mais ni le rôle ni
     *     le logement. On rouvrait sur « Gestionnaire délégué » choisi la fois
     *     d'avant, sans le champ du logement, que ce rôle efface.
     *  2. Le registre, keyé `[parkId, estDemo]`, n'était lu qu'UNE fois par
     *     chargement de page. Un code émis pour A1 laissait A1 dans le menu à
     *     l'ouverture suivante — le 409 que l'en-tête ci-dessus raconte, et que
     *     cette lecture existe pour éviter.
     *
     * RIEN NE SE REMET À ZÉRO À LA FERMETURE, ET C'EST DÉLIBÉRÉ. Deux raisons,
     * et la seconde est celle qui se voit :
     *
     *  — Une remise à zéro à la fermeture ne couvre pas la PREMIÈRE ouverture,
     *    et celle-ci en a besoin : montée avec la page, la modale naît avant que
     *    le parc ne soit arrivé — `Access` ne retient son rendu que sur SA
     *    lecture du registre, pas sur celle du parc. Le `useState` du logement
     *    valait alors « aucun », définitivement, et la modale s'ouvrait sur
     *    « Aucun logement pour l'instant » là où elle proposait le premier
     *    logement du parc. Mesuré à l'écriture de la garde de ce lot.
     *
     *  — CE QUI S'EN VA DOIT RESSEMBLER À CE QU'IL ÉTAIT. La modale reste peinte
     *    150 ms pour sortir. Vider `code` sur le chemin de la fermeture
     *    remplaçait donc le code par un formulaire vide PENDANT que le panneau
     *    s'en allait : la personne regardait partir autre chose que ce qu'elle
     *    lisait. Une sortie anime un départ, pas une transformation. Tant que
     *    fermer démontait le composant, il n'y avait plus rien à repeindre et
     *    cela ne se voyait pas — c'est `open={…}` qui l'a rendu visible.
     *
     * Le prix est une image à l'ENTRÉE : le rôle, le logement et le code
     * d'avant peuvent rester peints le temps d'une trame pendant que la modale
     * entre. C'est la contrepartie assumée d'un seul point de remise à zéro, et
     * en écrire un second sur le chemin de la fermeture serait une mutation
     * qu'aucune garde ne tient, puisque celle-ci la couvre déjà.
     *
     * ET C'EST POURQUOI CET EFFET EST `useLayoutEffect`. `useEffect` s'exécute
     * APRÈS la peinture : à la seconde ouverture, le rôle, le logement et —
     * celui qui compte — le CODE émis la fois d'avant restent peints le temps
     * d'une trame environ. Sur le rôle ce serait du désordre ; sur le code
     * c'est autre chose, car cet écran promet lui-même qu'il « n'est plus
     * lisible ensuite, même par vous ». Le repeindre, si brièvement que ce
     * soit, contredit la promesse au lieu de la salir. `useLayoutEffect` court
     * avant que le navigateur ne peigne : la remise à zéro tombe dans la même
     * trame.
     *
     * CE CHANGEMENT N'EST PAS MESURÉ. Aucune garde de ce dépôt ne peut rougir
     * sur cette trame : sous jsdom il n'y a pas de peinture à observer, et les
     * cas de `secondeOuvertureDeLInvitation` lisent l'arbre une fois les effets
     * vidés — ce qu'ils voient ne distingue pas les deux formes d'effet. La
     * mesure dit une trame ; on agit par prudence non mesurée.
     */
    if (!open) return
    setRoleInvite('tenant')
    setUnitId(logementParDefaut)
    setCode(null)
    setEnvoye(false)
    setEnvoi(false)
    if (estDemo) {
      setPrisParUnCode(logementsDesCodes(ACCES_DEMO.invitations))
      return
    }
    if (!parkId) return
    let vivant = true
    void api
      .access<{ invitations: InvitationDuMenu[] }>(parkId)
      .then((registre) => {
        if (vivant) setPrisParUnCode(logementsDesCodes(registre.invitations))
      })
      /* SILENCIEUX, et la dégradation est la bonne : sans cette lecture le menu
         redevient ce qu'il était, et le serveur refuse toujours. On perd un
         avertissement, jamais une garde. Poser une erreur ici empêcherait
         d'émettre un code parce qu'on n'a pas pu lire les codes existants. */
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [open, logementParDefaut, parkId, estDemo])

  /**
   * TOUS LES LOGEMENTS DU PARC, ET NON LES SEULS VACANTS.
   *
   * Le filtre `units.filter((u) => !u.tenant)` racontait une lecture : inviter,
   * ce serait faire ENTRER quelqu'un dans un logement libre. C'est un des deux
   * cas. L'autre — celui de tout parc existant, donc de tout nouveau compte —
   * est un locataire DÉJÀ EN PLACE à qui l'on ouvre son espace.
   *
   * Et le produit prescrivait ce second geste tout en le rendant impossible :
   * la modale de création d'une fiche dit « pour lui ouvrir son espace, émettez
   * ensuite un code depuis Inviter par code », après quoi le logement qu'on
   * vient de rattacher avait disparu de cette liste-ci.
   *
   * Le serveur n'a jamais rien exigé de tel : il vérifie que l'unité appartient
   * au parc, et c'est tout. Le filtre était une règle du client seul.
   *
   * L'OCCUPANT EST NOMMÉ DANS L'OPTION. Les logements s'appellent « A1 »,
   * « B2 » : une liste d'étiquettes nues obligerait à se rappeler qui habite où
   * avant d'émettre un code qui n'est lisible qu'une seule fois. Le nom est ce
   * qui distingue le bon choix du mauvais.
   */
  const pris = new Set(prisParUnCode.map((u) => u.id))
  const logements = units.filter((u) => !pris.has(u.id))
  /* Nommés pour la note : un logement qui disparaît sans un mot se lit comme
     une panne — le défaut même que ce fichier a retiré du champ de rôle. */
  const retires = prisParUnCode.filter((p) => units.some((u) => u.id === p.id))

  // `roleInvite` est le rôle du FUTUR membre, à ne pas confondre avec `role`,
  // celui de la personne qui invite. Sa valeur initiale — locataire — est aussi
  // la seule qu'un gestionnaire puisse émettre : privé du champ, il n'a aucun
  // moyen de la changer, et l'appel part avec le seul rôle qu'on lui accorde.
  const [roleInvite, setRoleInvite] = useState<'tenant' | 'manager'>('tenant')
  const [unitId, setUnitId] = useState(logements[0]?.id ?? '')
  /**
   * LE CHOIX RETIRÉ RETOMBE SUR « AUCUN », JAMAIS SUR LE LOGEMENT SUIVANT.
   *
   * Le registre arrive APRÈS le premier rendu : la modale s'ouvre sur « A1 —
   * BEKONO LANDRY », puis A1 disparaît du menu. Basculer alors sur le logement
   * suivant changerait la valeur sous les yeux de quelqu'un qui a déjà lu le
   * champ — et un code émis pour le mauvais logement rattache un locataire au
   * bail d'un autre. « Aucun logement » est licite, et c'est le seul repli qui
   * ne décide rien à sa place.
   */
  const choix = unitId === '' || logements.some((u) => u.id === unitId) ? unitId : ''
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

  /* `onClose` PART DIRECTEMENT, sans intermédiaire : depuis que la remise à
     zéro vit à l'ouverture, fermer ne fait plus que fermer. Un `fermer()` qui se
     contenterait de rappeler `onClose()` serait un nom sans rien derrière. */

  const emettre = () => {
    if (!parkId) return
    setEnvoi(true)
    void api
      .issueInvitation<{ code: string; envoye: boolean }>(parkId, {
        role: roleInvite,
        // L'unité n'accompagne qu'une invitation de LOCATAIRE : un gestionnaire
        // opère tout le parc, et lui en attacher une laisserait croire à un
        // périmètre qui n'existe pas.
        ...(roleInvite === 'tenant' && choix ? { unitId: choix } : {}),
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
      onClose={onClose}
      /*
        UNE FOIS LE CODE AFFICHÉ, LE VOILE NE FERME PLUS.

        Le voile d'une modale est un `<button>` qui couvre TOUTE la fenêtre, et
        sous `sm` la feuille est collée en bas : le voile occupe donc tout le
        haut de l'écran. Un pouce qui rate, un Échap réflexe, et le code
        disparaît — alors que le produit dit lui-même qu'« il n'est plus lisible
        ensuite, même par vous ».

        La modale reste quittable : le pied porte un « Fermer » explicite. Ce
        qu'on retire, c'est le renvoi ACCIDENTEL, pas la sortie.
      */
      dismissible={!code}
      title={code ? t('app.invite.codeTitle') : t('app.invite.title')}
      description={code ? t('app.invite.codeOnce') : t('app.invite.description')}
      footer={
        code ? (
          <Button onClick={onClose}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
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
          <p className="text-body text-muted">
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
          {role === 'manager' && <Notice>{t('app.invite.managerNotice')}</Notice>}

          {/* CE QU'ON DÉLÈGUE, ET QUE LA MODALE NE DISAIT PAS.

              Le champ « Logement concerné » disparaît sur ce rôle, et le code
              le justifie plus haut : « un gestionnaire opère tout le parc ».
              Le raisonnement est juste, le SILENCE le trahit — un champ de
              logement qui s'efface se lit comme « pas demandé ici », pas comme
              « il n'y en a pas ».

              Signalé sur la production : « je peux générer le code pour le
              gestionnaire, comme je lui confie LE LOGEMENT ». Le propriétaire
              croyait déléguer un logement ; il délègue les douze écrans de
              gestion, tous les baux, tous les locataires. L'écart entre ce
              qu'il croit signer et ce qu'il signe est le pire que cette modale
              puisse laisser passer, et elle le laissait passer sans un mot.

              ON NE PEUT PAS LUI DONNER CE QU'IL ATTENDAIT : `Membership` porte
              un rôle et un parc, rien d'autre — le périmètre par logement
              n'existe pas dans le modèle. Ce qu'on peut, c'est le dire AVANT
              le clic, et dire aussi ce que ce rôle ne peut pas faire. */}
          {roleInvite === 'manager' && <Notice>{t('app.invite.managerScope')}</Notice>}

          {/* Au PROPRIÉTAIRE d'un parc en gestion seule, la note dit autre chose
              que celle du gestionnaire : ce n'est pas un droit qui lui manque,
              c'est un réglage qu'il détient. Elle nomme donc l'écran où il se
              change plutôt que de le laisser deviner. */}
          {role === 'owner' && gereSeul && (
            <Notice>
              {t('app.onboarding.delegationOffNotice')}
              {/* ET LE CHEMIN, QUE LA NOTE NE DONNAIT PAS.

                  « Changez la politique de délégation pour en recruter un »
                  dit quoi faire sans dire où : le réglage vit derrière les
                  TROIS POINTS de l'écran du parc, ce que personne ne devine.
                  Signalé sur la production comme une fonctionnalité absente —
                  la délégation existait, à trois écrans et un menu replié.

                  Un LIEN et non un bouton d'action : rien n'est décidé ici, on
                  se déplace. Même partition que sur « prise en main », qui
                  porte déjà ce renvoi et ce libellé. */}
              <span className="mt-2 block">
                <Button to={lien(base, 'parc')} variant="secondary" size="sm" iconAfter="arrowRight">
                  {t('app.onboarding.changeInSettings')}
                </Button>
              </span>
            </Notice>
          )}

          {/* Ni `required` ni `optional` sur le logement.
              « Facultatif » invitait à passer outre, alors que l'omettre a une
              vraie conséquence : le locataire rejoint le parc sans bail. Et le
              marquer requis serait faux — on peut légitimement inviter d'abord
              et rattacher ensuite. L'aide porte la conséquence, ce qu'aucune
              étiquette ne sait dire. */}
          {/* LES LOGEMENTS RETIRÉS SE NOMMENT. Un logement qui disparaît sans
              un mot se lit comme une panne, et le propriétaire chercherait le
              défaut au lieu de reprendre le code qui bloque. La note dit
              lesquels et où les reprendre. */}
          {roleInvite === 'tenant' && retires.length > 0 && (
            <Notice>
              {t('app.invite.unitTakenNotice', {
                units: retires.map((u) => u.label).join(', '),
              })}
              <span className="mt-2 block">
                <Button to={lien(base, 'acces')} variant="secondary" size="sm" iconAfter="arrowRight">
                  {t('app.invite.unitTakenAction')}
                </Button>
              </span>
            </Notice>
          )}

          {roleInvite === 'tenant' && logements.length > 0 && (
            <Field label={t('app.invite.unit')} hint={t('app.invite.unitHint')}>
              {(props) => (
                <Combobox
                  id={props.id}
                  aria-describedby={props['aria-describedby']}
                  invalid={props['aria-invalid']}
                  name="unitId"
                  value={choix}
                  onChange={setUnitId}
                  /* Dans une modale : la liste ne se déplie pas parce que le
                     dialogue vient de donner le focus. Voir `ouvrirAuFocus`. */
                  ouvrirAuFocus={false}
                  /* L'ABSENCE RESTE UNE ENTRÉE DE LA LISTE, et en tête.
                     L'AIDE DU CHAMP PROMET CE CHOIX — « sans logement, il
                     rejoint le parc sans bail, vous l'y rattacherez ensuite » —
                     et il n'était atteignable que par accident : quand AUCUN
                     logement n'était vacant, le champ disparaissait et
                     l'invitation partait sans unité. Ouvrir la liste à tout le
                     parc aurait donc supprimé un parcours que le produit
                     décrit, en réparant l'autre.

                     Elle porte `value: ''`, que `Combobox` retrouve comme
                     n'importe quelle autre : le champ affiche son libellé au
                     lieu de paraître vide, ce qui est la différence entre « je
                     n'ai pas choisi » et « je choisis de ne pas rattacher ».
                     Elle se filtre comme les autres — on revient à elle en
                     vidant le champ. */
                  autoComplete="off"
                  options={[
                    { value: '', label: t('app.invite.unitNone') },
                    ...logements.map((u) => ({
                      value: u.id,
                      label: u.tenant
                        ? `${u.label} — ${u.tenant}`
                        : `${u.label} — ${t('app.invite.unitVacant')}`,
                    })),
                  ]}
                />
              )}
            </Field>
          )}
        </form>
      )}
    </Modal>
  )
}
