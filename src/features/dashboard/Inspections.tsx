import { useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Button } from '@/components/primitives/Button'
import { InspectionModal } from './InspectionModal'
import { Card } from '@/components/primitives/Card'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { TenantScopeNote } from './TenantDashboard'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useDates } from '@/lib/useDates'
import type { Finding, Inspection } from '@/data/portfolio'

import { usePortfolio } from '@/data/PortfolioProvider'

export function Inspections() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { unitById, isMine, units, inspections: INSPECTIONS, loading } = usePortfolio()
  const [ouverte, setOuverte] = useState(false)
  /* Le parc ENTIER descend dans la modale, qui demande lequel.
     Le commentaire qui vivait ici promettait de le demander « le jour où le
     parc en porte plusieurs » — il en portait douze, et l'écran envoyait le
     premier en dur. Le serveur ne pouvait rien y voir : l'unité qu'on lui
     donnait appartenait bien au parc. */
  const logements = units
  const isTenant = role === 'tenant'
  const source = isTenant ? INSPECTIONS.filter((i) => isMine(i.unitId)) : INSPECTIONS

  // Regroupé par unité : l'intérêt d'un état des lieux est la comparaison
  // entrée/sortie, pas la liste chronologique.
  const byUnit = source.reduce<Record<string, typeof INSPECTIONS>>((acc, inspection) => {
    ;(acc[inspection.unitId] ??= []).push(inspection)
    return acc
  }, {})

  /**
   * Un état des lieux est une pièce contradictoire : il porte des réserves
   * chiffrées, signées ou non, et c'est lui qui justifie ce qu'on retient sur
   * une caution. En servir de faux pendant l'attente — « 4 réserves », « en
   * attente de signature » — met sous les yeux du bailleur des griefs contre
   * des locataires qu'il n'a pas.
   */
  if (loading) return <InspectionsSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.inspections.title')}
        description={t('app.inspections.subtitle')}
        actions={
          /*
            La commande que cet écran n'a jamais eue.

            Son test d'état vide gardait explicitement son absence — « ne
            fabrique aucune action : le produit ne sait pas en établir un » — et
            il avait raison : AUCUNE route d'état des lieux n'existait. Le
            bouton arrive avec la fonction, pas avant.

            Le locataire ne l'établit pas : il le SIGNE. Son nom est ce que le
            champ « signé par » porte.
          */
          !isTenant && logements[0] ? (
            <Button icon="plus" onClick={() => setOuverte(true)}>
              {t('app.inspections.record')}
            </Button>
          ) : undefined
        }
      />

      {isTenant && <TenantScopeNote />}

      {!isTenant && logements[0] && (
        <InspectionModal
          open={ouverte}
          onClose={() => setOuverte(false)}
          unitIds={logements}
        />
      )}

      {/*
        Le titre valait pour le locataire et se servait aussi au propriétaire.
        Le corps dit à quoi sert un état des lieux — l'entrée, la sortie, et la
        comparaison qui justifie la retenue sur caution — parce que c'est
        précisément ce qu'ignore celui qui découvre cet écran vide.

        AUCUNE action, pour personne, et c'est le point : le produit ne sait pas
        établir un état des lieux. Un locataire n'en crée pas lui-même, et un
        bouton « nouvel état des lieux » côté bailleur ouvrirait sur du vide.
        On préfère un état vide honnête à un gabarit rempli.
      */}
      {Object.keys(byUnit).length === 0 ? (
        <EmptyState
          icon="clipboard"
          level={2}
          title={isTenant ? t('app.tenant.inspectionsEmpty') : t('app.inspections.emptyTitle')}
          body={
            isTenant ? t('app.tenant.inspectionsEmptyBody') : t('app.inspections.emptyBody')
          }
        />
      ) : (
      /*
        UNE LISTE, et son compte.

        Chaque carte est le dossier d'UN logement. À la lecture d'écran on
        entendait un titre, puis une liste, puis un tableau, sans jamais savoir
        COMBIEN de logements attendaient plus bas ni où s'arrêtait le dossier
        en cours. Le `h2` annonçait déjà le passage de l'un à l'autre — la
        navigation par titres est le geste le plus courant d'un lecteur
        d'écran — mais ni l'étendue ni le nombre.

        `role="list"` les donne tous deux : « États des lieux par logement,
        liste, 3 éléments », puis chaque dossier annoncé avec son rang.

        PAS `role="region"`, ni `role="group"`. Une région est un point de
        repère : dix logements encombreraient le sommaire de dix entrées. Et
        `group` est le rôle défini comme EXCLU des sommaires — il donne la
        frontière, jamais la navigation qu'on cherchait ici. Le reste du
        dépôt le réserve d'ailleurs aux groupes de CONTRÔLES, ce pour quoi il
        est fait ; un dossier est du contenu.

        Les rôles sont EXPLICITES et non portés par `<ul>` : la sémantique
        implicite d'une liste se perd sous certaines mises en page, un rôle
        écrit ne se perd pas.
      */
      <div
        role="list"
        aria-label={t('app.inspections.byUnit')}
        className="grid gap-4 lg:grid-cols-2"
      >
        {Object.entries(byUnit).map(([unitId, inspections]) => {
          const unit = unitById(unitId)
          // Le badge « comparer entrée et sortie » se déclenchait sur le
          // nombre de lignes : deux entrées successives l'auraient allumé
          // sans qu'aucune sortie n'existe. Il teste les deux natures.
          const hasBoth =
            inspections.some((i) => i.kind === 'entry') &&
            inspections.some((i) => i.kind === 'exit')
          // L'ordre venait du tableau source, qui plaçait la sortie de B4
          // avant son entrée — une comparaison à rebours du temps.
          const chronological = [...inspections].sort(
            (a, b) =>
              a.date.year - b.date.year || a.date.month - b.date.month || a.date.day - b.date.day,
          )

          return (
            /*
              Le dossier porte son rang dans la liste, et son `h2` le nomme.

              PAS d'`aria-labelledby` ici : nommer un `listitem` depuis l'auteur
              remplace, chez certains lecteurs, la lecture de son CONTENU — on
              perdrait les deux constats et le tableau pour ne garder que le
              titre qu'on entendait déjà. Le nom d'un dossier est son titre ;
              l'élément de liste n'a qu'à en marquer la frontière.

              Effet de bord qui n'en est pas un : les cas de test désignaient ce
              dossier par `closest('div')!.parentElement!`, une chaîne
              d'ancêtres anonymes qui s'était déjà révélée fausse une fois —
              elle s'arrêtait avant le tableau, et l'assertion d'absence qu'elle
              portait ne pouvait pas échouer. Un rôle écrit ne se déplace pas
              quand on ajoute une enveloppe.
            */
            <Card key={unitId} role="listitem">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  {/* Le regroupement se fait sur l'identifiant technique, mais
                      c'est le libellé de l'unité qui se lit dans le titre. */}
                  <h2 className="title-m">
                    {unit?.label ?? unitId} ·{' '}
                    {unit && t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
                  </h2>
                  <p className="text-caps text-muted">
                    {unit?.tenant ?? t('app.portfolio.noTenant')}
                  </p>
                </div>
                {/*
                  UN STATUT, ET NON UNE CONSIGNE.

                  Le badge portait « Comparer entrée et sortie » — une phrase de
                  vingt-huit caractères en anglais dans une pastille
                  `whitespace-nowrap`. À 320 px elle poussait la page huit pixels
                  au-delà de la fenêtre : mesuré, pas supposé. En français elle
                  passait de justesse, si bien que le défaut n'existait que dans
                  une langue — un décalage qu'une relecture ne trouve jamais.

                  Une pastille dit ce qu'une chose EST — « Payé », « Devis »,
                  « Relance n°2 » — et le `nowrap` est juste pour cela : un
                  statut ne se coupe pas en deux. Y loger une consigne ne pouvait
                  que déborder, dans n'importe quelle langue assez longue.
                  D'autant que la consigne était redondante : le tableau qui suit
                  porte déjà « Comparaison entrée / sortie » en titre.
                */}
                {hasBoth && <Badge tone="gold">{t('app.inspections.compare')}</Badge>}
              </div>

              <div className="flex flex-col gap-2.5">
                {chronological.map((inspection) => (
                  <div
                    key={`${inspection.kind}-${inspection.date.year}-${inspection.date.month}`}
                    className="flex items-center gap-3 rounded-md border border-divider bg-surface-sunken px-3.5 py-3"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                        inspection.kind === 'entry'
                          ? 'bg-ok-tint text-ok'
                          : 'bg-gold-tint text-gold-ink'
                      }`}
                    >
                      <Icon
                        name={inspection.kind === 'entry' ? 'arrowRight' : 'logout'}
                        size={16}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium">
                        {t(`app.inspections.${inspection.kind}` as 'app.inspections.entry')}
                      </p>
                      <p className="text-caps text-muted">
                        {d.fullDate(inspection.date)}{' · '}
                        {t('app.inspections.rooms', { count: inspection.rooms })}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill
                        tone={inspection.issues === 0 ? 'ok' : inspection.issues > 3 ? 'danger' : 'warn'}
                        size="sm"
                      >
                        {inspection.issues === 0
                          ? t('app.inspections.noIssues')
                          : t('app.inspections.issues', { count: inspection.issues })}
                      </StatusPill>
                      {!inspection.signed && (
                        <span className="text-caps text-warn">
                          {t('app.inspections.unsigned')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/*
                LA COMPARAISON, et c'est la raison d'être de ces deux documents.

                « Entrée et sortie comparées pièce par pièce » : le badge le
                promettait, l'écran ne montrait que deux lignes et un NOMBRE de
                réserves. La donnée était pourtant saisie depuis l'origine —
                pièce, description, gravité, coût — et la retenue proposée sur
                la caution en dérivait déjà. Le locataire à qui l'on retient
                38 000 pouvait lire la somme, jamais ce qui la compose.

                Elle ne s'affiche que si les deux documents existent ET qu'au
                moins l'un porte le détail : un serveur qui ne rend que le
                compte laisse l'écran tel qu'il était, plutôt que de dresser un
                tableau vide sous un badge qui promet une comparaison.
              */}
              {hasBoth && <Comparaison inspections={chronological} />}
            </Card>
          )
        })}
      </div>
      )}
    </>
  )
}

/**
 * Les états des lieux, le temps qu'ils arrivent.
 *
 * Aucune action à retenir : l'en-tête n'en porte pas.
 *
 * Deux cartes, pas quatre : la grille passe à deux colonnes au-delà de `lg`, et
 * deux remplissent une rangée sans promettre un parc plus grand qu'il ne l'est.
 * Chacune reprend le gabarit d'un regroupement par unité — l'en-tête de carte,
 * puis deux lignes de constat, la hauteur qui compte ici.
 */
function InspectionsSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.inspections.title')} description={t('app.inspections.subtitle')} />

      <SkeletonRegion className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((carte) => (
          <div
            key={carte}
            className="min-w-0 rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5"
          >
            <div className="mb-4">
              <Skeleton line="title" className="w-40" />
              <Skeleton line="eyebrow" className="mt-1 w-32" />
            </div>
            <div className="flex flex-col gap-2.5">
              {[0, 1].map((ligne) => (
                <div
                  key={ligne}
                  className="flex items-center gap-3 rounded-md border border-divider px-3.5 py-3"
                >
                  <Skeleton radius="md" className="size-9" />
                  <div className="min-w-0 flex-1">
                    <Skeleton line="body" className="w-20" />
                    <Skeleton line="eyebrow" className="mt-0.5 w-36 max-w-full" />
                  </div>
                  <Skeleton radius="md" className="h-7 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
    </>
  )
}

/**
 * Ce qui a changé entre l'entrée et la sortie, pièce par pièce.
 *
 * L'appariement se fait sur la PIÈCE et non sur la description : « robinetterie
 * salle de bain » à l'entrée et « mitigeur fuyant » à la sortie parlent du même
 * endroit sans partager un mot. Une pièce peut porter plusieurs réserves ; elles
 * s'empilent dans leur colonne plutôt que de multiplier les lignes, sans quoi
 * une même pièce apparaîtrait trois fois sans qu'on sache pourquoi.
 *
 * Le coût ne figure que dans la colonne de sortie, parce qu'il n'existe que là :
 * chiffrer une réserve d'entrée reviendrait à facturer au locataire les dégâts
 * du précédent, et le serveur le refuse en 422.
 */
function Comparaison({ inspections }: { inspections: Inspection[] }) {
  const t = useT()
  const { money } = useCurrency()

  const entree = inspections.find((i) => i.kind === 'entry')
  const sortie = inspections.find((i) => i.kind === 'exit')
  const reservesEntree = entree?.findings ?? []
  const reservesSortie = sortie?.findings ?? []

  // Sans détail, on ne dresse rien : le compte reste seul, comme avant.
  if (reservesEntree.length === 0 && reservesSortie.length === 0) return null

  /* L'ordre suit la SORTIE — c'est elle qui appelle une décision —, puis les
     pièces que seule l'entrée mentionne : elles disent ce qui était déjà abîmé
     et n'a rien coûté, ce qui est précisément le service que rend une entrée. */
  const pieces = [
    ...new Set([...reservesSortie.map((r) => r.room), ...reservesEntree.map((r) => r.room)]),
  ]

  const retenue = reservesSortie.reduce((somme, r) => somme + (r.costMinor ?? 0), 0)

  return (
    <div className="mt-4 border-t border-divider pt-4">
      <p className="eyebrow mb-2 text-muted">{t('app.inspections.comparison')}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('app.inspections.comparison')}</caption>
          <thead>
            <tr className="border-b border-divider">
              <th scope="col" className="py-2 text-left text-caps text-muted">
                {t('app.inspections.colRoom')}
              </th>
              <th scope="col" className="py-2 text-left text-caps text-muted">
                {t('app.inspections.entry')}
              </th>
              <th scope="col" className="py-2 text-left text-caps text-muted">
                {t('app.inspections.exit')}
              </th>
              <th scope="col" className="py-2 text-right text-caps text-muted">
                {t('app.inspections.colWithheld')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {pieces.map((piece) => {
              const avant = reservesEntree.filter((r) => r.room === piece)
              const apres = reservesSortie.filter((r) => r.room === piece)
              const cout = apres.reduce((somme, r) => somme + (r.costMinor ?? 0), 0)
              return (
                <tr key={piece}>
                  <th scope="row" className="py-2.5 pr-3 text-left text-body-s font-medium">
                    {piece}
                  </th>
                  <CelluleReserves reserves={avant} />
                  <CelluleReserves reserves={apres} />
                  <td className="numeric py-2.5 pl-3 text-right text-body-s">
                    {cout > 0 ? (
                      <span className="font-medium text-danger">{money(cout, { round: true })}</span>
                    ) : (
                      /* Rien à retenir se DIT : une cellule vide se lirait comme
                         un montant qu'on a oublié de porter. */
                      <span className="text-muted">{t('app.inspections.noWithhold')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {retenue > 0 && (
        <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-body-s text-muted">{t('app.inspections.proposed')}</span>
          <span className="numeric text-body font-medium">{money(retenue, { round: true })}</span>
        </p>
      )}
    </div>
  )
}

/**
 * Les réserves d'une pièce, dans une colonne.
 *
 * « Bon état » quand il n'y en a pas — et non une case vide : sur un tableau de
 * comparaison, le vide se lit comme une donnée manquante, alors qu'ici il dit
 * quelque chose de précis. C'est la formule de la maquette, et elle est juste.
 */
function CelluleReserves({ reserves }: { reserves: Finding[] }) {
  const t = useT()
  if (reserves.length === 0) {
    return <td className="py-2.5 pr-3 text-body-s text-muted">{t('app.inspections.asGood')}</td>
  }
  return (
    <td className="py-2.5 pr-3 text-body-s">
      <ul className="flex flex-col gap-0.5">
        {reserves.map((r) => (
          <li key={r.id} className={r.severity === 'major' ? 'text-warn' : undefined}>
            {r.description}
            {/* La gravité est écrite, pas seulement colorée. */}
            {r.severity === 'major' && (
              <span className="text-caps"> · {t('app.inspections.major')}</span>
            )}
          </li>
        ))}
      </ul>
    </td>
  )
}
