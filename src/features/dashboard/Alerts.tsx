import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { lien, useBase } from '@/lib/base'
import { usePortfolio } from '@/data/PortfolioProvider'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { StatCard } from '@/components/primitives/Charts'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { cn } from '@/lib/cn'
import { TenantScopeNote } from './TenantDashboard'
import { useT, type TranslateVars } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { Badge } from '@/components/primitives/Badge'
import { useNumbers } from '@/lib/numbers'
import { useCurrency } from '@/currency/CurrencyProvider'
import { type Alert } from '@/data/portfolio'

/**
 * L'écran qui répond à chaque nature de notification.
 *
 * Un impayé se traite aux paiements, un devis aux travaux, un relevé manquant
 * aux relevés. Le bail renvoie aux cautions : les notifications de cette nature
 * portent sur la restitution, seul geste de bail que le produit sait faire.
 */
const ECRAN_PAR_NATURE: Record<Alert['kind'], string> = {
  payment: 'paiements',
  work: 'travaux',
  meter: 'releves',
  lease: 'cautions',
  /**
   * Un message groupé ne renvoie NULLE PART, et c'est voulu.
   *
   * Les autres natures désignent l'écran où l'on traite le problème ; une
   * annonce n'appelle aucun geste — elle informe. La renvoyer aux paiements ou
   * aux travaux ferait chercher une action qui n'existe pas.
   */
  announcement: '',
}

const KIND_ICON: Record<Alert['kind'], IconName> = {
  payment: 'card',
  work: 'wrench',
  meter: 'gauge',
  lease: 'file',
  announcement: 'phone',
}

const SEVERITY_TONE: Record<Alert['severity'], StatusTone> = {
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
}

/**
 * Rend le titre ou le détail d'une alerte.
 *
 * Les valeurs arrivent brutes — un nombre, des `DateParts` — et sont formatées
 * ici, avec la devise et la langue du moment. C'est le seul endroit qui sait
 * qu'un `amount` est de l'argent et qu'un `dueOn` porte une année : la donnée,
 * elle, ne présume plus de sa présentation.
 */
function useAlertMessage() {
  const t = useT()
  /* Pour résoudre le logement d'un avis ancien en LIBELLÉ — voir plus bas. */
  const { unitById } = usePortfolio()
  const d = useDates()
  const n = useNumbers()
  const { money } = useCurrency()

  return (alert: Alert, part: 'title' | 'detail') => {
    const { data } = alert
    const vars: TranslateVars = {}

    if (data.tenant) vars.tenant = data.tenant
    /*
      LE LOGEMENT, AVEC UN SECOURS — et le secours existe pour les avis ÉCRITS
      AVANT que le serveur ne pose ce champ.

      Une notification est une LIGNE : corriger celui qui l'écrit ne répare pas
      ce qui l'a été avant. Capturé sur un parc de production, sur un avis de la
      veille du correctif — « Signalement SIG-2026-002 · {unit} », accolades
      comprises.

      La donnée était pourtant là : l'avis porte `unitId` à SON niveau, la
      colonne que le serveur a toujours écrite. Elle tient un IDENTIFIANT, donc
      on le résout en libellé — c'est ce que le lecteur attend, pas un uuid.

      ON NE RÉPARE PAS `interpolate` POUR AUTANT : un jeton qui survit est
      exactement ce que `MESURER_GABARITS` cherche sur chaque écran, et c'est ce
      qui a rendu ce défaut visible. Le faire disparaître à la substitution
      éteindrait l'alarme pour toutes les variables renommées à venir.
    */
    if (data.unitId) vars.unit = data.unitId
    else if (alert.unitId) vars.unit = unitById(alert.unitId)?.label ?? alert.unitId
    if (data.workId) vars.workId = data.workId
    // `count` porte l'accord en nombre, d'où son nom : voir la convention
    // `_one` / `_other` de `I18nProvider`.
    if (data.count !== undefined) vars.count = data.count
    if (data.amount !== undefined) vars.amount = money(data.amount, { compact: true })
    if (data.total !== undefined) vars.total = money(data.total, { compact: true })
    if (data.on) vars.date = d.dayMonth(data.on)
    // Une échéance de bail porte l'année : « 30/09 » sans millésime ne dit pas
    // si le préavis court cette année ou la suivante.
    if (data.dueOn) vars.date = d.fullDate(data.dueOn)
    if (data.period) vars.period = d.monthYear(data.period)
    if (data.units) vars.units = n.list(data.units)
    // Le texte du bailleur, tel qu'il l'a écrit. Il n'est ni formaté ni
    // traduit : c'est la seule variable d'alerte qui porte une phrase humaine.
    if (data.text) vars.text = data.text
    if (data.reference) vars.reference = data.reference

    const rendu = t(
      `app.alerts.msg.${alert.message}.${part}` as 'app.alerts.msg.rentOverdue.title',
      vars,
    )

    /*
      CE QU'UNE LIGNE ANCIENNE NE PORTE PAS DEVIENT UN TIRET.

      Une notification est une LIGNE ÉCRITE : corriger celui qui l'écrit ne
      répare pas ce qui l'a été avant. Un avis d'août montrait « Signalement
      SIG-2026-002 · {unit} » sur un parc de production, accolades comprises,
      parce que le serveur ne posait pas encore ce champ la veille du
      correctif. Le secours d'alors ne valait que pour `{unit}` ; les douze
      autres familles restaient exposées à la même chose sur `{tenant}`,
      `{amount}` ou `{reference}`.

      `—` est le signe d'absence que le produit emploie déjà — les cartes d'eau
      et d'électricité sans relevé le portent. Il dit « on ne sait pas », ce qui
      est exactement vrai d'une ligne écrite avant le champ.

      ═══ ET CELA MASQUERAIT UNE FAUTE DE CODE, SI RIEN D'AUTRE NE LA TENAIT ═══

      Une variable renommée deviendrait un tiret sur TOUTES les données, sans
      que rien ne rougisse. C'est pourquoi `variablesDAvis.test.ts` existe : il
      confronte les libellés au bâtisseur et refuse si l'un réclame ce que
      l'autre ne pose jamais. La donnée périmée est absorbée ici, la faute de
      code est attrapée là-bas.

      `interpolate` n'est PAS touché : un jeton qui survit ailleurs reste
      l'alarme que `MESURER_GABARITS` cherche sur chaque écran.
    */
    return rendu.replace(/\{[A-Za-z]\w*\}/g, '—')
  }
}

export function Alerts() {
  const base = useBase()
  const t = useT()
  const n = useNumbers()
  const d = useDates()
  const message = useAlertMessage()
  const { role } = useRole()
  const isTenant = role === 'tenant'

  /**
   * La liste se **dérive** du rôle à chaque rendu, elle ne s'y fige pas.
   *
   * Elle était initialisée dans un `useState` : l'initialiseur ne s'exécutant
   * qu'au montage, basculer de profil sans changer d'écran laissait le
   * locataire devant les notifications de tout le parc — les impayés de ses
   * voisins compris. Le défaut échappait à toute vérification manuelle qui
   * naviguait après la bascule, puisque naviguer remonte le composant.
   *
   * Seul l'état « lu » est conservé, sous forme d'identifiants — et il vit
   * désormais dans le provider et non ici : la pastille de la barre latérale
   * doit compter les mêmes alertes que cet écran.
   */
  const { readAlertIds, markAlertsRead, isMine, alerts: ALERTS, loading } = usePortfolio()

  /**
   * CETTE LISTE EST UNE BOÎTE AUX LETTRES, PAS UNE CONVERSATION.
   *
   * Les deux clés du fil ont chacune UN sens et UN destinataire : `workReply`
   * descend vers le locataire, `tenantReply` remonte vers la gestion. Rien ne
   * les filtrait, et chacun lisait donc SA PROPRE phrase revenir sous un titre
   * qui la présentait comme reçue — « Réponse à votre signalement », affiché au
   * gestionnaire, à propos de ce qu'il venait d'écrire.
   *
   * Ce n'était pas visible tant que le fil ne tournait que dans un sens : le
   * gestionnaire était le seul à s'auto-adresser, et personne ne l'avait relevé.
   * Ouvrir l'autre sens l'aurait donné au locataire aussi, en double.
   *
   * Le serveur le sait déjà — il nomme les destinataires — mais le portefeuille
   * rend aussi ce qui porte simplement l'unité, et c'est ce qui suffit à faire
   * revenir sa propre voix. On tranche donc ici, sur le RÔLE, ce que la donnée
   * ne dit pas.
   *
   * LE FIL, LUI, MONTRE TOUT : `Signaler` et `Travaux` rangent les deux clés
   * sous le chantier dont elles parlent, en nommant qui a parlé. C'est la
   * différence entre lire ce qui NOUS est adressé et relire un échange.
   */
  const MA_VOIX = isTenant ? 'tenantReply' : 'workReply'

  const toutes = (isTenant ? ALERTS.filter((a) => a.unitId && isMine(a.unitId)) : ALERTS)
    .filter((a) => a.message !== MA_VOIX)
    .map(
    (alert) => ({
      ...alert,
      read: alert.read || readAlertIds.includes(alert.id),
    }),
  )

  /**
   * ═══ LA SÉRIE DE RELANCES SE REPLIE, ET C'EST LA REFONTE DE CET ÉCRAN ═══
   *
   * MESURÉ SUR LA DÉMONSTRATION : cinq entrées visibles, dont QUATRE portent la
   * même dette — la détection « Loyer A3 en retard de 24 jours », puis les
   * relances 1, 2 et 3, toutes sur Serge Mbarga, toutes pour 115 000 FCFA. Le
   * devis qui attend une décision, seul autre événement de l'écran, arrivait en
   * cinquième position, enterré sous 80 % de répétition.
   *
   * CE QUE CET ÉCRAN LISTAIT N'ÉTAIT PAS CE QUI EST ARRIVÉ, mais ce que le
   * PRODUIT A FAIT : chaque relance qu'il émet y prend une carte de la taille de
   * l'événement qui l'a causée. Sur un parc de trois cents lots, un journal
   * construit ainsi ne contient plus que ses propres relances.
   *
   * LA RÈGLE EST ÉTROITE, ET C'EST VOULU. On ne replie QUE `rentReminder`, et
   * seulement entre relances du MÊME logement. Ce sont les seules entrées que le
   * produit émet en série sur un fait unique, et leur `rank` le dit dans la
   * donnée — on ne devine rien. Tout le reste garde une entrée par événement :
   * deux impayés distincts sont deux faits, et les confondre serait le défaut
   * inverse.
   *
   * LA PLUS RÉCENTE PORTE LA SÉRIE. Elle est la seule qui appelle un geste — les
   * précédentes sont de l'historique — et elle garde son rang, son montant et sa
   * date. Les autres deviennent un COMPTE sur cette carte, ce que `serie` rend
   * plus bas.
   *
   * L'ÉTAT « LU » SUIT LA SÉRIE ENTIÈRE : une carte repliée est non lue si l'une
   * quelconque de ses relances l'est. Sinon le compteur de la barre latérale
   * annoncerait des non-lues que l'écran ne montre plus.
   */
  const alerts: (typeof toutes)[number][] = []
  const serieDeRelances = new Map<string, number>()
  for (const alert of toutes) {
    const cle = alert.message === 'rentReminder' && alert.unitId ? `relance:${alert.unitId}` : null
    if (!cle) {
      alerts.push(alert)
      continue
    }
    const deja = serieDeRelances.get(cle)
    if (deja === undefined) {
      serieDeRelances.set(cle, alerts.length)
      alerts.push(alert)
      continue
    }
    /* La liste arrive du plus récent au plus ancien : la première rencontrée est
       donc celle qui porte la série, et les suivantes ne font que la compter. */
    const porteuse = alerts[deja]!
    alerts[deja] = { ...porteuse, read: porteuse.read && alert.read }
  }

  /** Les relances que replie une carte, la plus récente en tête. */
  const serieDe = (alert: (typeof toutes)[number]) =>
    alert.message === 'rentReminder' && alert.unitId
      ? toutes.filter((a) => a.message === 'rentReminder' && a.unitId === alert.unitId)
      : [alert]

  const unread = alerts.filter((alert) => !alert.read).length

  /**
   * Les NON LUES seulement, et non toute la liste.
   *
   * Le geste partait avec l'intégralité des identifiants affichés — désormais
   * jusqu'au serveur, qui les borne à deux cents. Un parc bavard aurait vu son
   * bouton échouer en validation, sur un écran où il n'y avait rien à échouer.
   * Et le corps de la requête dit maintenant ce que le geste fait : marquer ce
   * qui ne l'est pas.
   */
  const markAllRead = () =>
    markAlertsRead(alerts.filter((alert) => !alert.read).map((alert) => alert.id))

  /**
   * Une notification est une affirmation datée : « Loyer A3 en retard de 24
   * jours », « Bail B1 à renouveler ». Servies depuis la démonstration, ce sont
   * des faits inventés sur des gens qui n'existent pas, et le bailleur les lit
   * comme la liste de ses urgences du jour. La pastille de la barre latérale en
   * annonce déjà le compte, ce qui les rend d'autant plus crédibles.
   */
  if (loading) return <AlertsSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.alerts.title')}
        description={t('app.alerts.subtitle')}
        actions={
          unread > 0 && (
            <Button
              variant="secondary"
              icon="check"
              onClick={markAllRead}
            >
              {t('app.alerts.markRead')}
            </Button>
          )
        }
      />

      {/* Annoncé, et non seulement affiché : « tout marquer comme lu » fait
          disparaître ce compteur et le bouton qui l'accompagne, sans qu'un
          lecteur d'écran n'apprenne jamais que l'action a abouti.
          La région est rendue en permanence — un `aria-live` monté en même
          temps que son contenu n'annonce rien, puisqu'il n'y a pas eu de
          changement à observer depuis. */}
      {/*
        LA RÉGION RESTE MONTÉE, SON TEXTE NON — et la distinction est la clé.

        Ce paragraphe existe pour ANNONCER : « tout marquer comme lu » fait
        disparaître le compteur et son bouton, et un lecteur d'écran ne
        l'apprendrait jamais autrement. Il est donc rendu en permanence, un
        `aria-live` monté avec son contenu n'annonçant rien.

        Mais quand il n'y a AUCUNE notification, il n'y a jamais rien à
        annoncer, et son texte devient un doublon : « Toutes les notifications
        sont lues. » se lisait au-dessus de « Rien à signaler sur le parc. » —
        deux fois la même chose, dont une hors de la boîte. Vu sur une capture
        de production, jamais par une porte : la démonstration remplit toujours
        cet écran.

        On garde donc le NŒUD, qui est ce dont l'annonce a besoin, et on lui
        retire son TEXTE dans le seul cas où il n'a rien à dire.
      */}
      <p className="mb-4 text-caps text-muted" aria-live="polite">
        {alerts.length === 0
          ? ''
          : unread > 0
            ? t('app.alerts.unread', { count: unread })
            : t('app.alerts.allRead')}
      </p>

      {/* LE COMPTE LE PLUS UTILE DE LA PAGE VIVAIT EN PROSE. Il reste dans le
          paragraphe au-dessus, qui est une région annoncée — « tout marquer
          comme lu » doit se dire à un lecteur d'écran, et une carte ne
          l'annoncerait pas. Les deux cartes, elles, donnent l'échelle : non lues
          SUR combien, et ce qui est déjà traité. */}
      {alerts.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <StatCard
            icone="bell"
            label={t('app.alerts.kpiUnread')}
            value={String(unread)}
            etat={unread > 0 ? { ton: 'warn' } : undefined}
            note={t('app.alerts.kpiUnreadNote', { count: alerts.length })}
          />
          <StatCard
            icone="checkCircle"
            label={t('app.alerts.kpiRead')}
            value={String(alerts.length - unread)}
            note={t('app.alerts.kpiReadNote')}
          />
        </div>
      )}

      {isTenant && <TenantScopeNote className="mb-4" />}

      {alerts.length === 0 ? (
        // L'écran servait au propriétaire un texte écrit pour le locataire —
        // « aucune notification vous concernant » — alors qu'il voit tout le
        // parc. Le corps suit la même partition : il énumère ce qui se dépose
        // ici, ce qui répond à la question réelle — « est-ce que ça marche ? »
        // — que ne résout pas une phrase disant seulement qu'il n'y a rien.
        //
        // Aucune action côté parc : une notification est PRODUITE par le
        // produit, personne n'en crée. Le seul bouton honnête serait « tout
        // marquer comme lu », et il n'a rien à marquer.
        <EmptyState
          icon="bell"
          level={2}
          title={isTenant ? t('app.tenant.alertsEmpty') : t('app.alerts.empty')}
          body={isTenant ? t('app.tenant.alertsEmptyBody') : t('app.alerts.emptyBody')}
          action={
            isTenant ? (
              <Button to={base} icon="chevronLeft">
                {t('app.tenant.backToSpace')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        /* Voir `Works` : une colonne de cartes sœurs n'est une liste que pour
           l'œil. Ici le compte importe plus qu'ailleurs — la barre latérale
           annonce déjà « 2 non lues », et l'écran devait pouvoir le confirmer
           autrement qu'en comptant des titres à l'oreille.

           LE TITRE DE L'ÉCRAN, et non un libellé à elle. La liste porte les deux
           provenances que ce titre nomme — ce que le produit a détecté, ce qu'il
           a reçu — et « Notifications » seul n'en annonçait qu'une. Une seule
           chaîne pour les deux : elle ne peut pas dériver du titre. */
        <div role="list" aria-label={t('app.alerts.title')} className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              role="listitem"
              /*
                `accent-ink` ET NON `accent` pour le liseré.

                L'accent de marque était l'or, et il ne tenait que 2,87:1 sur
                la carte — la feuille de jetons le CONDAMNAIT elle-même en
                commentaire pour cet usage. Le bleu qui a pris sa place remonte
                à 5,17 sous du blanc, mais il retombe à 3,13 sur la carte du
                thème sombre, où il n'effleure plus que le seuil des éléments
                non textuels. Un liseré qui distingue une notification non lue
                est de la DONNÉE, pas de l'ornement : il doit se voir, et pas de
                justesse. `accent-ink` s'inverse avec le thème — #1d4ed8 sur
                fond clair, #93bbfd sur fond sombre — et c'est ce qui le tient
                franc des deux côtés : 6,30 sur le papier clair, 8,30 sur la
                surface sombre.
              */
              /*
                LA CARTE SE REPLIE, ET LE TITRE GARDE UNE LARGEUR PLANCHER.

                Elle ne se repliait pas : la colonne de droite — « il y a 2
                heures » et « Ouvrir » — porte `shrink-0`, et prenait donc 187
                px sur les 239 disponibles à 375 px. La colonne du titre, elle,
                est `flex-1 min-w-0` : elle acceptait tout ce qu'on lui laissait,
                c'est-à-dire 13 px. « Bail B1 à renouveler dans 45 jours » se
                lisait à un mot par ligne, et son texte sortait de sa boîte.

                MESURÉ : 121 px de débordement à 375 px. Aucune règle ne le
                voyait — la page ne défile pas — jusqu'à `MESURER_DEBORD_LOCAL`.

                `basis-48` (12 rem) est la largeur SOUS LAQUELLE LA COLONNE NE
                DESCEND PLUS. En dessous de cette base, `flex-wrap` renvoie la
                colonne de droite à la ligne suivante plutôt que de continuer à
                comprimer le titre. Le chiffre n'est pas rond par hasard : le
                plus long mot des titres du produit — « renouveler » — mesure
                85 px, et 192 px en laisse passer deux à trois par ligne, ce qui
                est le minimum pour qu'un titre se lise comme une phrase.

                `gap-y-3` : quand la colonne de droite descend, elle a besoin
                d'un souffle vertical que `gap-4` horizontal ne donnait pas.
              */
              className={cn(
                'flex flex-wrap items-start gap-x-4 gap-y-3',
                !alert.read && 'border-l-2 border-l-accent-ink',
              )}
            >
              {/*
                ET L'ÉTAT SE DIT, au lieu de n'être qu'une couleur.

                « Non lue » n'existait que dans le liseré. Un lecteur d'écran
                parcourait donc douze notifications rigoureusement identiques,
                sans jamais savoir lesquelles restaient à traiter — alors que
                c'est la seule question qu'on se pose sur cet écran, et que la
                barre latérale annonce le compte juste à côté.
              */}
              {!alert.read && <span className="sr-only">{t('app.alerts.unreadMark')}</span>}
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-md',
                  alert.severity === 'high'
                    ? 'bg-danger-tint text-danger'
                    : alert.severity === 'medium'
                      ? 'bg-warn-tint text-warn'
                      : 'bg-surface-sunken text-muted',
                )}
              >
                {/* La catégorie n'existait qu'en icône, et `Icon` est
                    `aria-hidden` : elle était invisible pour un lecteur
                    d'écran, et absente de l'i18n. */}
                <Icon name={KIND_ICON[alert.kind]} size={18} />
                <span className="sr-only">
                  {t(`app.alerts.kind.${alert.kind}` as 'app.alerts.kind.payment')}
                </span>
              </span>

              <div className="min-w-0 flex-1 basis-48">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className={cn(
                      'title-m',
                      alert.read ? 'font-medium' : 'font-semibold',
                    )}
                  >
                    {message(alert, 'title')}
                  </h2>
                  {/*
                    LE RANG, avant la sévérité.

                    « Relance envoyée à Serge Mbarga » ne disait pas si c'était
                    la première ou la quatrième. Les relances s'empilaient dans
                    un flux plat où N rappels sur le même bail produisaient N
                    cartes indistinctes, et le bailleur relançait une cinquième
                    fois sans savoir qu'il en avait déjà envoyé quatre.

                    Il se dérive à la lecture, par BAIL et non par unité : deux
                    locataires successifs dans le même logement ne partagent pas
                    un compteur de relances.
                  */}
                  {alert.rank != null && (
                    /*
                      LE RANG DIT AUSSI LA SÉRIE QU'IL REPLIE.

                      « Rappel n° 3 » seul laissait croire à une troisième carte
                      d'une suite qu'on allait retrouver plus bas — et elle y
                      était, deux fois. Maintenant que la série tient en une
                      carte, la pastille doit dire ce qui a disparu de l'écran :
                      trois relances, dont celle-ci est la dernière. Sans ce
                      compte, le repli MASQUERAIT de l'information au lieu de la
                      ranger, ce qui serait pire que la répétition.
                    */
                    <Badge tone="neutral">
                      {serieDe(alert).length > 1
                        ? t('app.alerts.rankOfSeries', {
                            n: n.integer(alert.rank),
                            total: n.integer(serieDe(alert).length),
                          })
                        : t('app.alerts.rank', { n: n.integer(alert.rank) })}
                    </Badge>
                  )}
                  {/* La sévérité est nommée, pas seulement colorée. */}
                  <StatusPill tone={SEVERITY_TONE[alert.severity]} size="sm">
                    {t(
                      `app.alerts.severity${alert.severity[0].toUpperCase()}${alert.severity.slice(1)}` as 'app.alerts.severityHigh',
                    )}
                  </StatusPill>
                </div>
                <p className="mt-1 text-body text-muted">{message(alert, 'detail')}</p>
                {/*
                  EST-ELLE PARTIE ? Le serveur le sait, la réponse le taisait.

                  `sentAt` n'est posé que si le fournisseur a confirmé l'envoi ;
                  le fournisseur de journal, lui, rend toujours faux. Une
                  relance peut donc porter `channel: 'sms'` SANS date d'envoi —
                  ce n'est pas une contradiction, c'est une tentative non
                  confirmée, et la distinction est celle que le bailleur doit
                  lire avant de croire que son locataire a été prévenu.

                  Rien ne s'affiche sur ce qui n'est pas une relance : une
                  notification de relevé manquant n'est envoyée à personne.

                  ═══ `in_app` EST EXCLU, ET C'EST LE MÊME RAISONNEMENT ═══

                  La borne portait sur la PRÉSENCE d'un canal, pas sur sa
                  nature. Or le serveur pose `channel: 'in_app'` sur le
                  signalement d'un locataire, sur l'annonce et sur la réponse du
                  gestionnaire : la ligne s'affichait donc sur trois avis que
                  personne n'a jamais eu l'intention d'expédier. Capturé sur la
                  production, sous « Signalement SIG-2026-002 · Manque de
                  courant » : « Pas encore parti · visible ici seulement ».

                  `in_app` EST le canal « visible ici seulement ». Le dire est
                  un pléonasme quand c'est le seul canal prévu, et un mensonge
                  quand ça laisse croire qu'un SMS a échoué — exactement le
                  défaut que cette ligne avait été écrite pour corriger.
                */}
                {alert.channel && alert.channel !== 'in_app' && (
                  <p className="mt-1 text-caps text-muted">
                    {/*
                      ═══ LE RÉSUMÉ D'EXPÉDITION DE TOUTE LA SÉRIE ═══

                      C'est la condition du repli, et deux gardes l'ont exigée.
                      Cet écran distingue ce qui est PARTI de ce qui n'est resté
                      qu'ici — le fournisseur de messagerie ne dépose rien
                      aujourd'hui, donc « pas encore parti » est le cas ORDINAIRE
                      et non l'exception. Replier trois relances en une carte qui
                      n'aurait montré que l'état de la dernière aurait masqué
                      qu'une seule des trois est réellement sortie : le repli
                      aurait rangé de l'information en en supprimant.

                      Une carte repliée porte donc les DEUX comptes — parties et
                      en attente — et la date de la dernière sortie. Une carte
                      seule garde la phrase qu'elle avait, mot pour mot.
                    */}
                    {(() => {
                      const serie = serieDe(alert)
                      if (serie.length === 1) {
                        return alert.sentAt
                          ? t('app.alerts.sentOn', {
                              channel: t(
                                `app.alerts.channel_${alert.channel}` as 'app.alerts.channel_sms',
                              ),
                              date: d.dayMonth(alert.sentAt),
                            })
                          : t('app.alerts.notSent')
                      }
                      const parties = serie.filter((a) => a.sentAt)
                      const derniere = parties[0]?.sentAt ?? parties[parties.length - 1]?.sentAt
                      if (parties.length === 0) return t('app.alerts.seriesNoneSent')
                      return t('app.alerts.seriesDispatch', {
                        sent: n.integer(parties.length),
                        waiting: n.integer(serie.length - parties.length),
                        date: derniere ? d.dayMonth(derniere) : '',
                      })
                    })()}
                  </p>
                )}
              </div>

              {/* `ml-auto` : renvoyée à la ligne, elle reste rangée à droite
                  plutôt que de se coller sous l'icône. */}
              <div className="ml-auto flex shrink-0 items-center gap-3">
                <span className="text-caps text-muted">{d.relative(alert.at)}</span>
                {/*
                  L'issue vers l'écran où la décision se prend.

                  Ces cartes n'avaient AUCUNE action : on lisait « loyer en
                  retard de 24 jours » et il fallait retrouver soi-même
                  l'écran des paiements, puis la ligne. Une notification qui
                  n'ouvre sur rien fait porter à l'utilisateur le travail de
                  navigation que le produit connaît déjà.

                  Un LIEN et non un bouton d'action : rien n'est décidé ici, on
                  se déplace. Le commentaire de l'état vide reste vrai — « une
                  notification est produite par le produit, personne n'en crée »
                  — et ce lien ne le contredit pas.
                */}
                {/*
                  PAS DE BOUTON QUAND IL NE MÈNE NULLE PART.

                  `ECRAN_PAR_NATURE` rend la chaîne vide pour une annonce, et
                  `lien(base, '')` renvoie à la racine de l'espace : le bouton
                  aurait dit « Ouvrir » et ramené le lecteur au tableau de bord,
                  lui faisant chercher un écran de traitement qui n'existe pas.
                  On teste la DESTINATION et non la nature — la prochaine
                  notification sans écran héritera de la règle sans qu'on y
                  repense.
                */}
                {ECRAN_PAR_NATURE[alert.kind] !== '' && (
                  <Button
                    to={lien(base, ECRAN_PAR_NATURE[alert.kind])}
                    variant="ghost"
                    size="sm"
                    iconAfter="arrowRight"
                  >
                    {t('app.alerts.open')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Les notifications, le temps qu'elles arrivent.
 *
 * « Tout marquer comme lu » est retenu : le geste porterait sur les
 * identifiants des alertes de démonstration, et il est irréversible côté
 * session — on effacerait un compteur sans jamais avoir montré ce qu'il
 * comptait.
 *
 * La ligne « n non lues » tient sa place en squelette. Elle porte un
 * `aria-live` dans l'écran réel ; ici, pas de région vivante à annoncer deux
 * fois — `SkeletonRegion` le fait déjà, une seule fois, pour tout le bloc.
 */
function AlertsSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.alerts.title')}
        description={t('app.alerts.subtitle')}
        actions={<Skeleton radius="md" className="h-11 w-52" />}
      />

      <SkeletonRegion>
        <Skeleton line="eyebrow" className="mb-4 w-28" />

        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((carte) => (
            <Card key={carte} className="flex items-start gap-4">
              <Skeleton radius="md" className="size-10" />
              <div className="min-w-0 flex-1">
                <Skeleton line="title" className="w-72 max-w-full" />
                <Skeleton line="body" className="mt-1 w-56 max-w-full" />
              </div>
              <Skeleton line="eyebrow" className="w-12" />
            </Card>
          ))}
        </div>
      </SkeletonRegion>
    </>
  )
}
