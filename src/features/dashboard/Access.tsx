import { useCallback, useEffect, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Notice } from '@/components/primitives/Notice'
import { StatCard } from '@/components/primitives/Charts'
import { Field } from '@/components/primitives/Field'
import { Checkbox } from '@/components/primitives/Choice'
import { Select } from '@/components/primitives/Input'
import { Modal } from '@/components/primitives/Modal'
import { StatusPill } from '@/components/primitives/StatusPill'
import { SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useSession } from '@/api/SessionProvider'
import { ACCES_DEMO } from '@/data/portfolio'
import { api } from '@/api/client'
import { GRILLE_DEUX_INDICATEURS } from './grillesDIndicateurs'
import { InviteModal } from './InviteModal'
import { cn } from '@/lib/cn'

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
/**
 * Deux noms désignent-ils la même personne ?
 *
 * ═══ CE QU'ELLE COMPARE, ET CE QU'ELLE NE PRÉTEND PAS ═══
 *
 * Casse, accents, ponctuation et ORDRE des mots sont neutralisés : « BEKONO
 * LANDRY », « Bekono Landry » et « Landry Bekono » sont la même personne, et
 * l'état civil du marché visé écrit couramment le nom de famille en premier.
 *
 * Elle ne fait AUCUN rapprochement approximatif. Pas de distance d'édition, pas
 * de correspondance partielle : « Djoumessi Martial » et « Djoumessi Nelson »
 * partagent un mot sur deux et ne sont pas la même personne. Une garde qui
 * devine se trompe dans les deux sens, et c'est le sens permissif qui coûte
 * cher ici.
 *
 * ELLE NE REFUSE RIEN — voir ses deux appelants. Deux noms peuvent légitimement
 * différer : un nom d'épouse, une société qui loue pour un salarié, un
 * diminutif. Un refus se contournerait par un renommage ; une QUESTION posée au
 * bon moment coûte trois secondes et arrête la faute.
 */
function memePersonne(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true
  const cle = (n: string) =>
    n
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .sort()
      .join(' ')
  return cle(a) === cle(b)
}

/**
 * TROIS NOMS, PUIS UN COMPTE — le résumé d'un périmètre, replié.
 *
 * Un cabinet qui tient huit résidences les voyait toutes énumérées, et un
 * immeuble de trente logements moins douze donnait une phrase de douze noms :
 * juste, illisible. Trois noms suffisent à RECONNAÎTRE un périmètre — on lit
 * « Bonamoussadi, Akwa, Deïdo… » et l'on sait de quel cabinet il s'agit.
 * Au-delà, ce n'est plus de la lecture, c'est du dénombrement, et le compte le
 * fait mieux.
 *
 * LE RESTE N'EST PAS PERDU : la modale de délégation porte la liste entière,
 * cochée, à un clic. Elle répond à « lesquels, exactement ? » ; le résumé
 * répond à « à peu près quoi ? ».
 *
 * Une seule fonction pour les DEUX côtés de la phrase — les confiés et les
 * retranchés souffrent du même mal, et deux replis séparés divergeraient sur
 * le seuil.
 */
const PLAFOND_DE_NOMS = 3

function replier(noms: string[], t: ReturnType<typeof useT>) {
  if (noms.length <= PLAFOND_DE_NOMS) return noms.join(', ')
  /* Le compte est celui du RESTE, pas du total : « et 5 autres » se lit sans
     soustraction, là où « sur 8 » demande d'en faire une. */
  return (
    noms.slice(0, PLAFOND_DE_NOMS).join(', ') +
    ' ' +
    t('app.access.scopeMore', { count: noms.length - PLAFOND_DE_NOMS })
  )
}

export function Access() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { notify } = useToast()
  const { adhesionActive, etat, estDemo } = useSession()
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
  /**
   * LE MEMBRE QU'ON S'APPRÊTE À RELIER À UNE FICHE.
   *
   * L'espace du locataire sans fiche lui dit de « demander à son propriétaire
   * de relier sa fiche à ce compte » — un geste qui n'existait nulle part.
   * Cet écran est le seul d'où l'anomalie se VOIT : il dit qui accède, et le
   * défaut est qu'une personne accède sans être reliée.
   */
  const [aRelier, setARelier] = useState<MembreApi | null>(null)
  /** La fiche choisie dans la modale ; la première par défaut. */
  const [ficheChoisie, setFicheChoisie] = useState('')
  /**
   * LE MEMBRE DONT ON S'APPRÊTE À DÉFAIRE LE LIEN.
   *
   * Irréversible dans son effet immédiat — l'intéressé perd son espace à la
   * seconde —, donc il passe par la même question que le retrait d'un accès et
   * la reprise d'un code. Ce qu'il n'est pas : définitif. Relier de nouveau
   * reste possible, et c'est tout l'objet de ce geste.
   */
  const [aDelier, setADelier] = useState<MembreApi | null>(null)
  /**
   * LE PÉRIMÈTRE EN COURS D'ÉDITION, et la sélection qui l'accompagne.
   *
   * La sélection est un `Set` recopié à l'ouverture plutôt que dérivé du membre
   * à chaque rendu : on édite un brouillon, et `Annuler` doit vraiment annuler.
   * Dérivée, une case cochée aurait écrit dans le registre avant tout envoi.
   */
  const [aConfier, setAConfier] = useState<MembreApi | null>(null)
  const [choixImmeubles, setChoixImmeubles] = useState<Set<string>>(new Set())
  /* Le second brouillon, à la maille du logement. Deux ensembles et non un :
     confier un immeuble et confier ses logements un à un ne veulent pas dire la
     même chose — le premier suit l'immeuble quand il grandit, le second non. */
  const [choixLogements, setChoixLogements] = useState<Set<string>>(new Set())
  /* Le TROISIÈME brouillon : les logements retranchés des immeubles cochés.
     Distinct des deux autres parce qu'il se lit à l'envers — coché veut dire
     « il le voit », et c'est l'ABSENCE de coche qui écrit une ligne. */
  const [exclusLogements, setExclusLogements] = useState<Set<string>>(new Set())
  /**
   * L'ÉMISSION D'UN CODE, ENFIN SUR L'ÉCRAN QUI PARLE DES CODES.
   *
   * « Inviter par code » n'existait que sur le fichier des locataires. Le choix
   * se défend pour un code de LOCATAIRE — on écrit à des gens, et c'est là
   * qu'on lit qui ils sont. Il ne se défend pas pour le second usage du même
   * bouton, RECRUTER UN GESTIONNAIRE : celui qui cherche à déléguer son parc
   * ouvre « Accès au parc », dont le sous-titre promet « quels codes attendent
   * encore d'être utilisés » — et cet écran listait des codes en attente sans
   * offrir d'en émettre un. Signalé sur la production comme une fonctionnalité
   * absente ; elle existait, trois écrans plus loin.
   *
   * LA MÊME MODALE, et non une copie : elle porte déjà tous les refus — qui
   * peut émettre quel rôle, ce qu'un parc en gestion seule interdit, le code
   * lisible une seule fois. En réécrire une seconde les ferait diverger.
   */
  const [inviteOuverte, setInviteOuverte] = useState(false)

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
      /*
        LA DÉMONSTRATION SERT SON PROPRE REGISTRE, et c'est le troisième écran
        de cette branche à sortir de l'ombre par le même geste.

        Sans parc, l'écran rendait « vous n'avez pas encore de parc » — dans une
        démonstration qui affiche trois immeubles, douze logements et dix
        locataires. La seule impasse du parcours, et surtout : ses deux tableaux
        n'étaient rendus NULLE PART, donc mesurés par personne, ni en géométrie
        ni en couleurs. Même motif que `ParkSettingsModal` et `TariffsModal`.

        Le registre n'est pas inventé : ce sont les trois personnages que la
        coquille nomme déjà dans son sélecteur de profil. Voir `ACCES_DEMO`.

        `estDemo` et non `!parkId` seul : un compte RÉEL sans parc doit continuer
        de lire « vous n'avez pas encore de parc », qui est vrai pour lui.
      */
      if (estDemo) setRegistre(ACCES_DEMO)
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
  }, [parkId, estDemo])

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
  /* Les fiches sans compte, telles que le serveur les rend. `?? []` : un
     serveur antérieur à ce lot ne rend pas le champ, et l'écran se contente
     alors de ne rien proposer plutôt que de tomber. */
  const fichesLibres = registre?.unlinkedTenants ?? []
  const invitations = registre?.invitations ?? []
  /* Les immeubles du parc, tels que le registre les rend. `?? []` pour la même
     raison que les fiches libres : un serveur d'avant ce lot n'en rend aucun, et
     l'écran ne propose alors pas un geste qu'il ne saurait pas remplir. */
  const immeublesDuParc = registre?.buildings ?? []

  if (chargement) return <RegistreEnChargement />
  // L'ordre compte : sans parc, aucune lecture n'a eu lieu, donc aucun échec à
  // dire. On nomme d'abord ce qui manque le plus en amont.
  /* La démonstration a un registre : elle passe donc au travers de ce garde,
     qui reste juste pour un compte réel dont le parc n'existe pas encore. */
  if (!parkId && !estDemo) return <RegistreSansParc />
  if (erreur) return <RegistreIllisible onReessayer={() => void charger()} />

  return (
    <>
      <PageHeader
        title={t('app.access.title')}
        description={t('app.access.subtitle')}
        /* SANS PARC, RIEN À ÉMETTRE : la modale a besoin d'un `parkId` et son
           bouton partirait dans le vide. La démonstration, elle, garde la
           commande — c'est ce qu'elle est là pour montrer. */
        actions={
          parkId || estDemo ? (
            <Button variant="secondary" icon="users" onClick={() => setInviteOuverte(true)}>
              {t('app.invite.button')}
            </Button>
          ) : undefined
        }
      />

      {inviteOuverte && <InviteModal open onClose={() => setInviteOuverte(false)} />}

      {/* Le gestionnaire voit le registre mais n'en retire personne. Comme sur
          les devis et les cautions, on lui dit pourquoi le bouton lui manque
          plutôt que de le laisser deviner. */}
      {role === 'manager' && (
        <Notice className="mb-6">{t('app.access.managerNotice')}</Notice>
      )}

      {/* LE REGISTRE COMPTAIT SANS JAMAIS ÉCRIRE. `membres` et `invitations`
          existaient en variables et ne servaient qu'à remplir deux tableaux :
          pour savoir combien de personnes ont une clé du parc, il fallait
          compter les lignes à l'œil. Deux cartes, parce qu'il y a deux
          populations — celles qui entrent aujourd'hui, et celles qui le
          pourraient. */}
      <div className={cn(GRILLE_DEUX_INDICATEURS, 'mb-6')}>
        <StatCard
          icone="users"
          label={t('app.access.kpiMembers')}
          value={String(membres.length)}
          note={t('app.access.kpiMembersNote')}
        />
        <StatCard
          icone="key"
          label={t('app.access.kpiInvitations')}
          value={String(invitations.length)}
          note={t('app.access.kpiInvitationsNote')}
        />
      </div>

      <Card flush>
        <CardHeader
          title={t('app.access.membersTitle')}
          description={t('app.access.membersHint')}
        />
        <DataTable<MembreApi>
          caption={t('app.access.membersTitle')}
          rows={membres}
          rowKey={(m) => m.id}
          fiches
          columns={[
            {
              key: 'nom',
              role: 'identite',
              header: t('app.access.member'),
              render: (m) => (
                <div className="flex flex-col">
                  <span className="font-medium">{m.fullName}</span>
                  <span className="text-body text-muted">{m.email}</span>
                  {/* LA FICHE QUE CE COMPTE DÉTIENT, NOMMÉE.

                      Le registre disait « relié » par une ABSENCE de bouton. Il
                      ne disait pas à QUOI, et c'est l'écart entre les deux noms
                      qui révèle une erreur : relevé sur la production, un compte
                      tenait la fiche d'un autre locataire — donc son bail, ses
                      quittances et ses relevés — et le seul symptôme visible
                      était que la bonne personne, elle, n'avait rien.

                      On ne corrige pas ce qu'on ne voit pas. La ligne le dit
                      donc à voix haute, sur la rangée de la personne. */}
                  {m.tenantName && (
                    <span className="text-body text-muted">
                      {t('app.access.holdsRecord', {
                        fiche: m.tenantName,
                        unit: m.tenantUnitLabel ?? '—',
                      })}
                    </span>
                  )}
                  {/* LE PRODUIT SAVAIT, ET NE LE DISAIT PAS.

                      Le registre porte les deux noms côte à côte depuis le lot
                      précédent : « Eloundou Charles » détenant « Bekono
                      Landry ». L'anomalie tient dans une comparaison, et il
                      existait même un second membre portant exactement ce
                      nom-là, sans fiche. Tout était là ; rien ne rapprochait
                      les deux chaînes.

                      UNE QUESTION, PAS UN VERDICT : voir `memePersonne`. */}
                  {/* SUR QUOI IL A LA MAIN — et le registre ne le disait pas.

                      Il disait qui accède, et depuis le lot précédent à quelle
                      fiche il est relié. Sur QUOI, jamais : un gestionnaire
                      borné à un immeuble sur trois y figurait exactement comme
                      celui qui les gère tous.

                      La ligne n'apparaît que pour le gestionnaire : le
                      propriétaire n'est jamais borné, et écrire « tout le parc »
                      sur sa rangée affirmerait un réglage là où il n'y a
                      qu'une évidence. Le locataire, lui, est borné par son
                      bail — une autre règle, qui ne se dit pas en immeubles. */}
                  {m.role === 'manager' && (
                    <span className="text-body text-muted">
                      {(m.buildingIds ?? []).length === 0 && (m.unitIds ?? []).length === 0
                        ? t('app.access.scopeAll')
                        : t('app.access.scopeSome', {
                            names: replier([
                              ...immeublesDuParc
                                .filter((i) => (m.buildingIds ?? []).includes(i.id))
                                .map((i) => i.name),
                              /* LES LOGEMENTS PORTENT LE NOM DE LEUR IMMEUBLE.
                                 « S1 » ne dit rien sur un parc de cinq
                                 résidences : trois d'entre elles ont un S1. */
                              ...immeublesDuParc.flatMap((i) =>
                                (i.units ?? [])
                                  .filter((u) => (m.unitIds ?? []).includes(u.id))
                                  .map((u) => `${i.name} · ${u.label}`),
                              ),
                            ],
                              t,
                            ),
                          })}
                      {/*
                        ET CE QU'ON A RETRANCHÉ — la seule phrase FAUSSE que
                        cet écran ait portée.

                        « Gère : Résidence Bonamoussadi » se lit « tout
                        l'immeuble », et le périmètre effectif en retranchait
                        un logement. Les autres manques du produit sont des
                        absences ; celui-ci était une AFFIRMATION incorrecte,
                        sur l'écran qu'on relit précisément pour vérifier ce
                        qu'on a confié. Le registre rendait déjà
                        `excludedUnitIds` : le serveur savait, le résumé
                        n'en tenait aucun compte.

                        RIEN QUAND RIEN N’EST RETRANCHÉ : « sauf — » ferait
                        chercher une exception qui n'existe pas.

                        Et le logement porte le nom de son immeuble, comme
                        dans la liste des confiés juste au-dessus : « S2 » ne
                        dit rien sur un parc où trois résidences en ont un.
                      */}
                      {(m.excludedUnitIds ?? []).length > 0 &&
                        ' ' +
                          t('app.access.scopeExcept', {
                            names: replier(
                              immeublesDuParc.flatMap((i) =>
                                (i.units ?? [])
                                  .filter((u) => (m.excludedUnitIds ?? []).includes(u.id))
                                  .map((u) => `${i.name} · ${u.label}`),
                              ),
                              t,
                            ),
                          })}
                    </span>
                  )}
                  {m.tenantName && !memePersonne(m.fullName, m.tenantName) && (
                    <span className="mt-1 flex">
                      <StatusPill tone="warn" size="sm">
                        {t('app.access.nameMismatch')}
                      </StatusPill>
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'role',
              role: 'contexte',
              /*
                SON RÔLE, ET NON LE RÔLE AVEC LEQUEL ON L'A INVITÉ.

                Cette colonne empruntait `app.invite.role`, « Rôle invité ». Dans
                un tableau, l'en-tête est écrit une fois tout en haut et se lit
                comme une étiquette de colonne ; passé en fiche, il se retrouve
                COLLÉ à chaque personne, et « Rôle invité · Propriétaire » se lit
                comme une affirmation fausse sur quelqu'un qui est membre depuis
                deux ans. Le registre des invitations, lui, garde la clé — elle y
                est juste.

                La forme n'a pas créé le défaut : elle l'a rendu lisible.
              */
              header: t('app.access.memberRole'),
              render: (m) => (
                <StatusPill tone={m.role === 'owner' ? 'info' : 'neutral'} size="sm">
                  {t(`app.access.role_${m.role}` as 'app.access.role_owner')}
                </StatusPill>
              ),
            },
            {
              key: 'depuis',
              role: 'contexte',
              header: t('app.access.since'),
              hideOnMobile: true,
              render: (m) => d.fullDate(enParties(m.since)),
            },
            {
              key: 'geste',
              role: 'geste',
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
                  /*
                    LE GLYPHE FAIT LIRE LA COMMANDE COMME UNE COMMANDE.

                    Ce bouton était fantôme et NU : de l'encre pleine, sans
                    bord, sans fond, sans signe. Dans une colonne de tableau, à
                    côté d'un nom et d'une date, cela se lit comme une donnée de
                    plus — et le survol est le premier moment où l'on apprend
                    que c'en est une. Trois fois de suite sur la même colonne.

                    Les deux autres colonnes de geste du produit — retirer une
                    fiche locataire, mettre en demeure — sont le MÊME bouton
                    fantôme AVEC une icône. Celles du registre étaient les
                    seules sans, et ce sont les seules qui retirent un accès.

                    PAS DE ROUGE ICI : le rouge du produit est celui de la
                    CONFIRMATION, dans la modale qui suit. L'avancer d'un cran
                    ferait de la couleur le signal, ce que `couleur-non-seule`
                    refuse partout ailleurs — et peindrait en danger une colonne
                    entière qu'on ne fait que lire, la plupart du temps.
                  */
                  <div className="flex items-center justify-end gap-1">
                    {/* LE GESTE DE RÉPARATION VIENT EN PREMIER, et il est
                        SECONDAIRE de ton : il rend un accès plutôt que de le
                        reprendre, et il ne s'affiche que sur la seule rangée
                        où il a un objet — un locataire membre dont aucune fiche
                        ne porte le compte. Sur les autres, l'offrir
                        proposerait de réécrire un lien existant, ce que le
                        serveur refuse en 409. */}
                    {/* CONFIER, et ce geste n'existait nulle part.

                        `Park.delegation` valait `solo` ou `delegate` : tout ou
                        rien sur le parc entier. Confier le premier immeuble à un
                        cabinet lui ouvrait les trois — baux, loyers, impayés et
                        cautions de logements dont il n'a jamais entendu parler.

                        Il ne s'affiche que s'il y a de quoi choisir : un parc
                        d'un seul immeuble n'a rien à répartir, et proposer le
                        geste y ferait promettre une finesse qui n'existe pas. */}
                    {m.role === 'manager' &&
                      (immeublesDuParc.length > 1 ||
                        immeublesDuParc.reduce((n, i) => n + (i.units ?? []).length, 0) > 1) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="building"
                        loading={enCours === m.id}
                        onClick={() => {
                          setAConfier(m)
                          setChoixImmeubles(new Set(m.buildingIds ?? []))
                          setChoixLogements(new Set(m.unitIds ?? []))
                          setExclusLogements(new Set(m.excludedUnitIds ?? []))
                        }}
                      >
                        {t('app.access.scopeAction')}
                      </Button>
                    )}
                    {m.role === 'tenant' && !m.tenantId && fichesLibres.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="users"
                        loading={enCours === m.id}
                        onClick={() => setARelier(m)}
                      >
                        {t('app.access.linkTenant')}
                      </Button>
                    )}
                    {/* DÉFAIRE UN LIEN, et il n'existait pas.

                        Relevé sur la production : un compte détenait la fiche
                        d'un AUTRE locataire — son bail, ses quittances, ses
                        relevés — pendant que l'intéressé ouvrait un espace
                        vide. `Tenant.userId` s'écrivait une fois pour toutes,
                        et relier la bonne personne rendait 409 pour toujours.

                        SANS `estProprietaire` ICI, ET C'EST LA MUTATION QUI L'A
                        DIT. La condition y était d'abord, par symétrie avec le
                        propos du geste — une décision, pas une opération. Elle
                        était MORTE : le rendu de cette cellule sort en `null`
                        vingt lignes plus haut pour quiconque n'est pas
                        propriétaire, donc la retirer ne changeait aucun verdict.
                        Une condition qui ne décide rien fait croire qu'elle
                        garde quelque chose ; c'est le partage de l'écran entier
                        qui garde, et lui seul. */}
                    {m.role === 'tenant' && m.tenantId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="users"
                        loading={enCours === m.id}
                        onClick={() => setADelier(m)}
                      >
                        {t('app.access.unlinkTenant')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="close"
                      loading={enCours === m.id}
                      onClick={() => setARetirer({ genre: 'membre', membre: m })}
                    >
                      {t('app.access.revokeMember')}
                    </Button>
                  </div>
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
            fiches
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
                role: 'identite',
                header: t('app.access.code'),
                render: (i) => (
                  <div className="flex flex-col">
                    {/* L'indice, jamais le code : seule son empreinte est en
                        base, et personne — pas même le propriétaire — ne peut
                        le relire. Il sert à RECONNAÎTRE un code qu'on a
                        transmis, pas à le retrouver. */}
                    <span className="numeric font-medium">••••-{i.codeHint}</span>
                    <span className="text-body text-muted">
                      {i.unitLabel ?? t('app.access.noUnit')}
                    </span>
                  </div>
                ),
              },
              {
                key: 'role',
                role: 'contexte',
                header: t('app.invite.role'),
                render: (i) => (
                  <StatusPill tone="neutral" size="sm">
                    {t(`app.access.role_${i.role}` as 'app.access.role_owner')}
                  </StatusPill>
                ),
              },
              {
                key: 'expire',
                role: 'contexte',
                header: t('app.access.expires'),
                hideOnMobile: true,
                render: (i) => d.fullDate(enParties(i.expiresAt)),
              },
              {
                key: 'geste',
                role: 'geste',
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
                      icon="close"
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
      {/* DÉFAIRE UN LIEN EST UNE ALERTE, et pas pour la même raison que le
          retrait d'un accès. Celui-ci n'est pas définitif — on relie de
          nouveau, c'est tout l'objet du geste — mais son effet est IMMÉDIAT sur
          quelqu'un d'autre : à la seconde, l'intéressé perd son bail, ses
          quittances et ses relevés. Un effet qui frappe un tiers se confirme,
          même quand il se répare. */}
      {aDelier && (
        <Modal
          open
          onClose={() => setADelier(null)}
          size="sm"
          role="alertdialog"
          title={t('app.access.unlinkTitle', { name: aDelier.fullName })}
          description={
            aDelier.tenantName
              ? t('app.access.unlinkBodyNamed', {
                  fiche: aDelier.tenantName,
                  unit: aDelier.tenantUnitLabel ?? '—',
                })
              : t('app.access.unlinkBody')
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setADelier(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const membre = aDelier
                  setADelier(null)
                  if (!membre.tenantId || !parkId) return
                  void agir(
                    membre.id,
                    () => api.unlinkTenantAccount(parkId, membre.tenantId!),
                    t('app.access.unlinked'),
                  )
                }}
              >
                {t('app.access.unlinkTenant')}
              </Button>
            </>
          }
        >
          {/* Le corps est VIDE : tout est déjà dit par le titre et la
              description, comme sur la confirmation de retrait juste dessous.
              Répéter la question dans le corps la ferait lire deux fois. */}
          <></>
        </Modal>
      )}

      {/* RELIER N'EST PAS UNE ALERTE. Le retrait d'un accès est irréversible et
          porte `role="alertdialog"` ; celui-ci DONNE un accès et se défait —
          il suffit de retirer l'adhésion. Une modale ordinaire, donc, et un
          bouton primaire plutôt que rouge. */}
      {/*
        CONFIER DES IMMEUBLES — des cases, et non un choix unique.

        Un gestionnaire peut en tenir deux sur trois : un `Select` ne saurait
        pas l'exprimer, et une liste de cases dit exactement ce que le serveur
        attend — la liste ENTIÈRE, jamais un ajout.

        AUCUNE CASE COCHÉE EST UNE VALEUR, pas un formulaire vide : c'est ainsi
        qu'on rend le parc entier. La note le dit à voix haute, parce que c'est
        le seul endroit du produit où « rien de sélectionné » veut dire « tout »,
        et que le deviner à l'envers retirerait un accès en croyant l'élargir.
      */}
      {aConfier && (
        <Modal
          open
          onClose={() => setAConfier(null)}
          size="sm"
          title={t('app.access.scopeTitle', { name: aConfier.fullName })}
          description={t('app.access.scopeBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAConfier(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  const membre = aConfier
                  const choisis = [...choixImmeubles]
                  /* Les logements d'un immeuble COCHÉ ne partent pas en double :
                     l'immeuble les couvre déjà, et le registre les afficherait
                     comme confiés un à un — un périmètre juste, dit de travers. */
                  const couverts = new Set(
                    immeublesDuParc
                      .filter((i) => choixImmeubles.has(i.id))
                      .flatMap((i) => (i.units ?? []).map((u) => u.id)),
                  )
                  const logements = [...choixLogements].filter((u) => !couverts.has(u))
                  /* Seules comptent les exclusions DANS un immeuble encore
                     coché : décocher l'immeuble emporte ses retranchements, qui
                     ne retranchaient que de lui. */
                  const exclus = immeublesDuParc
                    .filter((i) => choixImmeubles.has(i.id))
                    .flatMap((i) => (i.units ?? []).filter((u) => exclusLogements.has(u.id)))
                    .map((u) => u.id)
                  setAConfier(null)
                  /* `agir` relit le registre après coup plutôt que de retoucher
                     la liste en mémoire : le même geste que le lien, et pour la
                     même raison — deux écrans ouverts divergeraient. */
                  void agir(
                    membre.id,
                    () =>
                      api.setManagerBuildings(parkId!, membre.id, {
                        buildingIds: choisis,
                        unitIds: logements,
                        excludedUnitIds: exclus,
                      }),
                    t('app.access.scopeSaved'),
                  )
                }}
              >
                {t('app.access.scopeSave')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Notice tone="neutral">{t('app.access.scopeEmptyMeansAll')}</Notice>
            {immeublesDuParc.map((immeuble) => (
              <div key={immeuble.id} className="flex flex-col gap-2">
                <Checkbox
                  label={immeuble.name}
                  hint={immeuble.district}
                  checked={choixImmeubles.has(immeuble.id)}
                  onChange={(e) => {
                    const suivant = new Set(choixImmeubles)
                    if (e.target.checked) suivant.add(immeuble.id)
                    else suivant.delete(immeuble.id)
                    setChoixImmeubles(suivant)
                    /* Cocher l'immeuble change la LECTURE des cases de ses
                       logements — de « confiés un à un » à « tous sauf les
                       décochés » — sans toucher aux brouillons : décocher
                       l'immeuble rend leur premier sens aux mêmes cases. */
                  }}
                />
                {/*
                  SOUS UN IMMEUBLE COCHÉ, LES CASES RESTENT — cochées, et
                  décochables : en décocher une écrit une EXCLUSION.

                  Le lot précédent les faisait DISPARAÎTRE, au motif que le
                  périmètre est une union et qu'une case redondante invite à
                  décocher en croyant retirer. C'était juste — et c'est
                  exactement le geste qui manquait : « tout l'immeuble sauf
                  le rez-de-chaussée » ne se disait qu'en listant les autres,
                  liste qui ne SUIT pas l'immeuble quand il grandit.

                  Décocher retire donc VRAIMENT, désormais — l'intuition
                  qu'on refusait est devenue le contrat. Sous un immeuble NON
                  coché, les cases gardent leur premier sens : cocher confie
                  le logement seul.
                */}
                {(immeuble.units ?? []).length > 0 && (
                  <div className="ml-6 flex flex-col gap-1.5">
                    {(immeuble.units ?? []).map((logement) => {
                      const immeubleCoche = choixImmeubles.has(immeuble.id)
                      const coche = immeubleCoche
                        ? !exclusLogements.has(logement.id)
                        : choixLogements.has(logement.id)
                      return (
                        <Checkbox
                          key={logement.id}
                          label={logement.label}
                          checked={coche}
                          onChange={(e) => {
                            if (immeubleCoche) {
                              const suivant = new Set(exclusLogements)
                              if (e.target.checked) suivant.delete(logement.id)
                              else suivant.add(logement.id)
                              setExclusLogements(suivant)
                            } else {
                              const suivant = new Set(choixLogements)
                              if (e.target.checked) suivant.add(logement.id)
                              else suivant.delete(logement.id)
                              setChoixLogements(suivant)
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {aRelier && (
        <Modal
          open
          onClose={() => setARelier(null)}
          size="sm"
          title={t('app.access.linkTitle', { name: aRelier.fullName })}
          description={t('app.access.linkBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setARelier(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  const membre = aRelier
                  const ficheId = ficheChoisie || fichesLibres[0]?.id
                  setARelier(null)
                  if (!ficheId) return
                  /* Même geste que les autres : `agir` relit le registre après
                     coup, plutôt que de retoucher la liste en mémoire. Le lien
                     change DEUX lignes — la fiche disparaît des libres, le
                     membre cesse d'être orphelin — et les recalculer à la main
                     divergerait au premier écran ouvert en double. */
                  void agir(
                    membre.id,
                    () => api.linkTenantAccount(parkId!, ficheId, membre.userId),
                    t('app.access.linked'),
                  )
                }}
              >
                {t('app.access.linkTenant')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label={t('app.access.linkField')} hint={t('app.access.linkHint')}>
              {(props) => (
                <Select
                  {...props}
                  name="tenantId"
                  value={ficheChoisie || fichesLibres[0]?.id || ''}
                  onChange={(e) => setFicheChoisie(e.target.value)}
                >
                  {fichesLibres.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.unitLabel ? `${f.fullName} — ${f.unitLabel}` : f.fullName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {/* LE PIÈGE SE REFERMAIT UNE SECONDE FOIS, ET SANS UN MOT.

                Une fiche captive n'apparaît pas dans les libres : quand celle
                du bon logement est prise, ce menu ne propose que celle d'un
                AUTRE locataire — et il l'a présélectionnée. Le propriétaire qui
                cherchait à réparer était à un clic de refaire exactement la
                faute qu'il réparait. Relevé sur la production, deux fois de
                suite sur le même parc.

                APRÈS LE CHAMP, jamais avant : la note porte sur ce qui vient
                d'être choisi, et une note posée au-dessus d'un menu qu'on n'a
                pas encore ouvert parle d'un choix qui n'existe pas. */}
            {(() => {
              const choisie = fichesLibres.find(
                (f) => f.id === (ficheChoisie || fichesLibres[0]?.id),
              )
              if (!choisie || memePersonne(aRelier.fullName, choisie.fullName)) return null
              return (
                <Notice tone="warn">
                  {t('app.access.linkMismatch', {
                    compte: aRelier.fullName,
                    fiche: choisie.fullName,
                  })}
                </Notice>
              )
            })()}
          </div>
        </Modal>
      )}

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
          <p className="text-body text-muted">
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
  /** Le COMPTE, distinct de l'adhésion : c'est lui qu'on relie à une fiche. */
  userId: string
  /** Sa fiche locataire DANS CE PARC, ou `null` — voir `FicheOrphelineApi`. */
  tenantId: string | null
  /* Le NOM de la fiche détenue, distinct de celui du compte — et c'est leur
     ÉCART qui révèle une erreur de lien. Facultatifs : un serveur antérieur à
     ce lot ne les rend pas, et l'écran se tait alors plutôt que de tomber. */
  tenantName?: string | null
  tenantUnitLabel?: string | null
  fullName: string
  email: string
  /**
   * LES IMMEUBLES CONFIÉS, ou une liste VIDE qui vaut « tout le parc ».
   *
   * Le sens du vide vient du modèle et non de l'écran : le lire à l'envers ici
   * afficherait « aucun immeuble » à un gestionnaire qui les gère tous.
   *
   * Facultatif : un serveur antérieur à ce lot ne le rend pas, et l'écran se
   * tait alors plutôt que d'affirmer un périmètre qu'il ignore.
   */
  buildingIds?: string[]
  /**
   * Les LOGEMENTS confiés, l'autre moitié du périmètre.
   *
   * Le registre disait « il gère ces immeubles » et taisait « et ces deux
   * studios ». Facultatif, comme son voisin : un serveur d'avant ce lot ne le
   * rend pas, et l'écran se tait alors plutôt que d'affirmer un périmètre.
   */
  unitIds?: string[]
  /** Les logements EXCLUS des immeubles confiés — « tout sauf ceux-là ». */
  excludedUnitIds?: string[]
  since: string
}

/**
 * Une fiche locataire QUE PERSONNE N'HABITE — au sens du compte.
 *
 * Elle porte un bail, des quittances, des relevés, et aucun compte ne les voit.
 * L'espace du locataire concerné affiche « aucun logement rattaché à votre
 * compte » et lui dit de demander au propriétaire de relier sa fiche : ce geste
 * n'existait nulle part avant ce lot.
 *
 * `unitLabel` est indispensable au choix, et non décoratif : deux locataires
 * peuvent porter le même nom, jamais le même bail actif.
 */
interface FicheOrphelineApi {
  id: string
  fullName: string
  unitLabel: string | null
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

/** Un immeuble du parc, tel que le registre le rend — pour CONFIER. */
interface ImmeubleApi {
  id: string
  name: string
  district: string
  /** Ses logements, pour confier à la maille fine. Absent d'un serveur d'avant. */
  units?: { id: string; label: string }[]
}

interface RegistreApi {
  members: MembreApi[]
  /** Facultatif, même raison que `unlinkedTenants` : un serveur d'avant ce lot. */
  buildings?: ImmeubleApi[]
  invitations: InvitationApi[]
  /** Facultatif : un serveur antérieur à ce lot ne le rend pas, et l'écran se
      contente alors de ne rien proposer plutôt que de tomber. */
  unlinkedTenants?: FicheOrphelineApi[]
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
          <p className="mt-1 text-body text-danger">{t('app.access.loadFailedBody')}</p>
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
