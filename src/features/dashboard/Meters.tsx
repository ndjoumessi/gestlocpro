import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatRow,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { NoteDePerimetre } from './NoteDePerimetre'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Notice } from '@/components/primitives/Notice'
import { Button } from '@/components/primitives/Button'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { useNumbers } from '@/lib/numbers'
import { type MeterReading } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { TariffsModal } from './TariffsModal'
import { RecordReadingModal } from './RecordReadingModal'

/**
 * Relevé des compteurs.
 *
 * Écran à part entière, et non une section de « Paiements » où il était
 * d'abord logé : c'est le geste de terrain le plus fréquent du gestionnaire,
 * et un relevé manquant bloque la facturation du mois — ce qui mérite d'être
 * visible sans avoir à faire défiler un autre écran.
 */
export function Meters() {
  const t = useT()
  const d = useDates()
  const n = useNumbers()
  const { money } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { role } = useRole()
  const { unitById, readings: TOUS, isMine, loading } = usePortfolio()
  const { adhesionActive, estDemo } = useSession()
  const [tarifsOuverts, setTarifsOuverts] = useState(false)
  /* LE GESTE QUI MANQUAIT SOUS TOUT L'ÉCRAN : aucune route n'écrivait de relevé,
     et aucun bouton n'en proposait un. Le tableau ci-dessous n'a jamais eu la
     moindre ligne sur un parc réel. */
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  /* LA LIGNE QU'ON CORRIGE. La même modale sert les deux gestes — voir son
     en-tête : saisir et corriger demandent exactement les mêmes champs. */
  const [ligneACorriger, setLigneACorriger] = useState<MeterReading | null>(null)

  /**
   * Poser un prix est un acte de PROPRIÉTAIRE, et il exige un vrai parc.
   *
   * Le rôle d'abord — fixer un prix engage l'argent du locataire, même partage
   * que la validation d'un devis.
   *
   * L'ADHÉSION ENSUITE, MAIS PAS TOUTE SEULE. La condition lisait
   * `adhesionActive !== null`, avec pour motif « la démonstration n'a pas de parc
   * à qui écrire ». C'est vrai d'un compte connecté SANS parc ; c'est la même
   * confusion que `Portfolio` portait pour la correction du parc — « personne à
   * qui écrire » et « rien ne s'écrit » sont deux choses, et la seconde vaut
   * pour tous les gestes de la démonstration.
   *
   * ELLE COÛTAIT PLUS QU'UN BOUTON, ET LE CAS EST PIRE QU'AILLEURS. Cet écran
   * AFFICHE les deux prix de la démonstration, en indicateurs, lus sur ses
   * relevés — mais la modale qui existe pour les montrer et les poser était
   * inatteignable, donc hors de portée de `scripts/modales.mjs`, de la mesure de
   * contraste et des cas clavier. Ouverte, elle aurait affiché « aucun prix
   * posé » : l'éditeur des prix démentant, à un clic, la page qui les affiche.
   */
  const peutPoserUnPrix = role === 'owner' && (adhesionActive !== null || estDemo)

  /**
   * RELEVER EST LE GESTE DU TERRAIN, donc il est aussi celui du gestionnaire.
   *
   * La lecture des tarifs le dit déjà : « le gestionnaire refacture au
   * quotidien ». C'est lui qui fait la tournée. Ce qu'il ne fait pas, c'est
   * FIXER le prix — le partage ne bouge pas, et le serveur le tient.
   *
   * Le LOCATAIRE en est exclu : il lit ses relevés, il ne les pose pas. Un index
   * saisi par celui qui paie n'est pas un relevé, c'est une déclaration.
   */
  const peutRelever = role === 'owner' || role === 'manager'

  /* Le locataire ne voit que SES relevés : l'écran vient de s'ouvrir à lui,
     puisque l'eau et l'électricité lui sont refacturées. */
  const READINGS = TOUS.filter((r) => role !== 'tenant' || isMine(r.unitId))

  /**
   * Libellé affichable d'une unité.
   *
   * Un relevé ne porte que l'identifiant technique de l'unité. Celui-ci vaut
   * « A1 » dans le jeu de démonstration, mais deviendra un `uuid` dès que les
   * données viendront du serveur : tout ce qui va sous les yeux — colonne,
   * export, alerte — passe donc par le `label`.
   *
   * Aucun repli sur l'identifiant : une unité introuvable laisse la cellule
   * vide, et le manque se voit. Se replier dessus réintroduirait exactement
   * l'uuid que ce détour supprime, au seul endroit où personne ne le
   * chercherait.
   */
  const unitLabel = (unitId: string) => unitById(unitId)?.label ?? ''

  /**
   * DEUX INDEX FONT UNE CONSOMMATION, UN SEUL N'EN FAIT PAS.
   *
   * Le calcul lisait `waterPrevious`, que la projection repliait sur 0 quand
   * aucun relevé antérieur n'existait : la consommation devenait alors l'INDEX
   * ENTIER du compteur. Le défaut ne se voit pas ici — la démonstration donne un
   * antérieur à chacun de ses relevés — et il ne coûtait rien tant que rien
   * n'était facturé. Le serveur facture désormais, et les deux doivent dire la
   * même chose : `montantsDeConsommation`, côté serveur, rend 0 sans point de
   * départ ; l'écran rend `null`, qui s'affiche au lieu de se chiffrer.
   */
  const consumption = (reading: MeterReading) => ({
    water:
      reading.waterCurrent === null || reading.waterPrevious === null
        ? null
        : reading.waterCurrent - reading.waterPrevious,
    power:
      reading.powerCurrent === null || reading.powerPrevious === null
        ? null
        : reading.powerCurrent - reading.powerPrevious,
  })

  /**
   * Le montant refacturé, ou `null` — relevé incomplet OU prix absent.
   *
   * Deux constantes tenaient ce rôle, servies à tous les parcs : le total
   * s'affichait donc toujours, y compris pour un propriétaire qui n'avait
   * jamais posé de prix. Le `null` du prix se propage maintenant jusqu'ici, et
   * l'écran montre la quantité seule — c'est la règle du produit, aucun chiffre
   * sans donnée derrière, appliquée à celui sur lequel quelqu'un paie.
   */
  /*
    DEUX CAUSES DE `null`, ET ELLES N'APPELLENT PAS LE MÊME GESTE.

    La fonction rendait `null` dans les deux cas, et la colonne affichait
    « Relevé manquant » pour l'un comme pour l'autre. Or un relevé manquant
    déclenche une TOURNÉE — ce fichier chiffre lui-même ce coût quelques lignes
    plus haut — tandis qu'un tarif non fixé se règle en trente secondes depuis
    l'écran des tarifs, sans que personne se déplace.

    Envoyer quelqu'un sur le terrain parce qu'un prix n'a pas été saisi est le
    genre de méprise qu'un libellé approximatif finance.
  */
  const rebilled = (
    reading: MeterReading,
  ): { montant: number } | { manque: 'reading' | 'price' | 'depart' } => {
    const c = consumption(reading)
    /* TROISIÈME CAUSE, ET ELLE N'APPELLE AUCUN GESTE. Un PREMIER relevé porte
       son index mais pas de point de départ : il n'y a rien à corriger, rien à
       aller chercher — la consommation naîtra le mois prochain. La confondre
       avec « relevé manquant » enverrait quelqu'un sur le terrain pour un
       compteur qu'on vient justement de relever. */
    if (
      (reading.waterCurrent !== null && reading.waterPrevious === null) ||
      (reading.powerCurrent !== null && reading.powerPrevious === null)
    )
      return { manque: 'depart' }
    if (c.water === null || c.power === null) return { manque: 'reading' }
    if (reading.waterPrice === null || reading.powerPrice === null) return { manque: 'price' }
    return { montant: c.water * reading.waterPrice + c.power * reading.powerPrice }
  }

  /** Le montant seul, pour les sommes — `null` quelle que soit la cause. */
  const montantRefacture = (reading: MeterReading) => {
    const r = rebilled(reading)
    return 'montant' in r ? r.montant : null
  }

  /**
   * Le prix en vigueur, lu sur les relevés plutôt que sur une constante.
   *
   * Tous les relevés d'un parc portent le même prix pour une énergie donnée à
   * une période donnée — c'est le serveur qui le choisit —, donc le premier
   * suffit. `null` quand aucun n'a été posé, et la vignette disparaît alors :
   * afficher « — / m³ » nommerait un prix qui n'existe pas.
   */
  const prixCourant = (energie: 'waterPrice' | 'powerPrice') =>
    READINGS.find((r) => r[energie] !== null)?.[energie] ?? null

  const aUnPrix = prixCourant('waterPrice') !== null && prixCourant('powerPrice') !== null
  const missing = READINGS.filter((r) => r.waterCurrent === null || r.powerCurrent === null)
  const total = READINGS.reduce((sum, r) => sum + (montantRefacture(r) ?? 0), 0)

  /**
   * L'écran affirmait « 2 relevés manquants — A3, B1 » sur des unités
   * inconnues du gestionnaire, et le nommait en jaune, ton d'une consigne. Un
   * relevé manquant déclenche une tournée : envoyer quelqu'un sur le terrain
   * pour des logements qui ne sont pas les siens est le coût le plus concret de
   * tout ce chantier.
   */
  if (loading) return <MetersSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.meters.title')}
        description={t('app.meters.subtitle')}
        actions={
          <>
            {peutRelever && (
              <Button icon="plus" onClick={() => setSaisieOuverte(true)}>
                {t('app.readings.title')}
              </Button>
            )}
          <Button
            variant="secondary"
            icon="download"
            onClick={() =>
              exportCsv({
                name: t('app.files.meters'),
                headers: [
                  t('app.portfolio.unit'),
                  t('app.portfolio.tenant'),
                  `${t('app.meters.utility.water')} · ${t('app.meters.previous')}`,
                  `${t('app.meters.utility.water')} · ${t('app.meters.current')}`,
                  `${t('app.meters.utility.water')} · ${t('app.meters.consumption')} (m³)`,
                  `${t('app.meters.utility.power')} · ${t('app.meters.previous')}`,
                  `${t('app.meters.utility.power')} · ${t('app.meters.current')}`,
                  `${t('app.meters.utility.power')} · ${t('app.meters.consumption')} (kWh)`,
                  csvMoney.header(t('app.meters.rebilled')),
                  t('app.meters.readAt'),
                ],
                rows: READINGS.map((r) => {
                  const c = consumption(r)
                  const amount = montantRefacture(r)
                  // Un relevé manquant laisse la cellule VIDE plutôt que le
                  // tiret de l'écran : « — » se compte comme une valeur dans un
                  // tableur, le vide se filtre.
                  // Index et consommations sortent en nombres bruts et non par
                  // `n.integer` : le groupement des milliers est fait pour
                  // l'œil, et il coupe « 4 120 » en deux colonnes à l'import.
                  return [
                    unitLabel(r.unitId),
                    unitById(r.unitId)?.tenant ?? t('app.portfolio.noTenant'),
                    r.waterPrevious,
                    r.waterCurrent,
                    c.water,
                    r.powerPrevious,
                    r.powerCurrent,
                    c.power,
                    amount === null ? null : csvMoney.amount(amount),
                    r.readAt ? d.fullDate(r.readAt) : null,
                  ]
                }),
              })
            }
          >
            {t('app.exportStatement')}
          </Button>
          </>
        }
        debordement={
          /* LA SECONDE ACTION RENTRE À LA MAISON. Elle vivait sur sa propre
             ligne, sous la description, dans un `<div className="mb-6">` — une
             barre d'outils d'un seul bouton, à un endroit où l'écran n'en
             attend aucun. Poser un prix de refacturation est un geste rare : il
             se demande, il ne s'affiche pas. */
          peutPoserUnPrix ? (
            <MenuDeDebordement libelle={t('common.moreActions')}>
              <MenuElement icone="card" onClick={() => setTarifsOuverts(true)}>
                {t('app.tariffs.open')}
              </MenuElement>
            </MenuDeDebordement>
          ) : undefined
        }
      />


      {tarifsOuverts && <TariffsModal open onClose={() => setTarifsOuverts(false)} />}
      {saisieOuverte && <RecordReadingModal onClose={() => setSaisieOuverte(false)} />}
      {ligneACorriger && (
        <RecordReadingModal aCorriger={ligneACorriger} onClose={() => setLigneACorriger(null)} />
      )}

      <NoteDePerimetre className="mb-4" />
      <div className={GRILLE_TROIS_INDICATEURS}>
        {/*
          Le total n'est un total QUE s'il y a un prix.
          `rebilled` rend `null` sans tarif, et la somme retombait alors à zéro :
          l'écran annonçait « 0 FCFA refacturés » là où la vérité est qu'on ne
          sait pas encore combien. Un zéro affirmé est le même défaut que 520
          affirmé, en plus discret — il a l'air d'un fait mesuré.

          Le compte des relevés saisis, lui, reste : il ne dépend d'aucun prix,
          et c'est l'information dont le gestionnaire a besoin pour sa tournée.
        */}
        <StatCard
          icone="gauge"
          /**
           * LA CARTE S'ACCORDE À LA BANNIÈRE QUI LA SUIT, à quinze pixels.
           *
           * « 8 sur 10 saisis » était en gris muet, et la bannière juste
           * dessous disait le même fait en ambre : « 2 relevés manquants pour
           * la période ». Deux traitements pour une seule information — l'œil
           * apprend que la carte est tranquille et que l'alerte est ailleurs,
           * alors que c'est le TOTAL de la carte qui est faux tant qu'il manque
           * un relevé.
           *
           * `warn` et non `danger` : rien n'est en retard, il manque une
           * saisie — c'est le ton que la bannière emploie déjà, et il n'y a pas
           * de raison d'en avoir deux pour un fait.
           *
           * SANS PASTILLE : la note de la carte dit « 8 sur 10 saisis », ce qui
           * nomme le fait en toutes lettres. Une pastille « Relevé manquant »
           * ferait la TROISIÈME formulation du même manque sur le même écran.
           */
          etat={missing.length > 0 ? { ton: 'warn' } : undefined}
          label={t('app.meters.totalRebilled')}
          value={aUnPrix ? money(total, { compact: true }) : '—'}
          note={t('app.meters.capturedCount', {
            done: READINGS.length - missing.length,
            total: READINGS.length,
          })}
        />
        {/* Ces tarifs sont des montants : ils passaient par une interpolation
            directe, donc sans devise ni groupement — « 520 » à côté d'un
            « 185 000 FCFA » formaté, sur la même ligne, et insensibles au
            changement de devise. */}
        {prixCourant('waterPrice') !== null && (
          <StatCard
            icone="droplet"
            label={t('app.meters.utility.water')}
            value={money(prixCourant('waterPrice')!, { compact: true })}
            unit="/ m³"
          />
        )}
        {prixCourant('powerPrice') !== null && (
          <StatCard
            icone="bolt"
            label={t('app.meters.utility.power')}
            value={money(prixCourant('powerPrice')!, { compact: true })}
            unit="/ kWh"
          />
        )}
      </div>

      {/* Un relevé manquant a une conséquence concrète : on la nomme, plutôt
          que d'afficher un simple compteur. C'est le TON qui porte le verdict —
          l'alerte quand il en manque, la coche quand la série est complète — et
          le glyphe le suit sans qu'on ait à le nommer. */}
      <Notice
        tone={missing.length ? 'warn' : 'ok'}
        titre={
          missing.length
            ? t('app.meters.missingCount', { count: missing.length })
            : t('app.meters.complete')
        }
        className="mt-6 mb-4"
      >
        {missing.length > 0 && (
          <>
            {t('app.meters.missingHint')} — {n.list(missing.map((r) => unitLabel(r.unitId)))}
          </>
        )}
      </Notice>

      <DataTable<MeterReading>
        caption={t('app.meters.title')}
        rows={READINGS}
        rowKey={(reading) => reading.unitId}
        fiches
        columns={[
          {
            key: 'unit',
            role: 'identite',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (r) => (
              <div>
                <span className="numeric font-medium">{unitLabel(r.unitId)}</span>
                {/* `data-donnee` : un nom de locataire est saisi, sa longueur
                    n'est bornée par rien — la coupe est assumée, contrairement
                    au vocabulaire du produit. Voir `MESURER_TRONCATURES`. */}
                <span data-donnee className="block truncate text-body text-muted sm:hidden">
                  {unitById(r.unitId)?.tenant}
                </span>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            hideOnMobile: true,
            render: (r) => <span className="text-muted">{unitById(r.unitId)?.tenant}</span>,
          },
          {
            key: 'water',
            header: `${t('app.meters.utility.water')} (m³)`,
            numeric: true,
            // Le garde porte sur `r.waterCurrent` et non sur la consommation
            // dérivée : les deux sont nuls ensemble, mais seul celui-ci permet
            // à TypeScript de conclure, sans assertion de non-nullité.
            render: (r) =>
              r.waterCurrent === null ? (
                <span className="text-muted">—</span>
              ) : r.waterPrevious === null ? (
                /* PREMIER RELEVÉ : on montre l'index posé, pas une consommation
                   qu'on ne sait pas calculer. */
                <span className="text-caps text-muted">{n.integer(r.waterCurrent)}</span>
              ) : (
                <span>
                  {n.integer(r.waterCurrent - r.waterPrevious)}{' '}
                  {/*
                    UN VRAI ESPACE, ET NON UNE MARGE. `ml-1.5` posait l'écart
                    VISUEL entre la consommation et la plage d'index sans créer
                    la moindre occasion de couper : « 178 » et « 4 120→4 298 »
                    formaient une seule suite insécable de quinze caractères.

                    Invisible tant que la cellule était large et que le tableau
                    entier défilait. Devenu visible le jour où la colonne est
                    passée en fiche : 19 px hors de la boîte à 320 px, seize
                    fois, trouvés par la sonde du débordement local.

                    L'espace se coupe dans la fiche et PAS dans le tableau, où
                    `numeric` pose encore `whitespace-nowrap` sur la cellule.
                    Une même valeur, deux comportements justes, et c'est la
                    colonne qui décide — pas le rendu.
                  */}
                  <span className="text-caps whitespace-nowrap text-muted">
                    {n.integer(r.waterPrevious)}→{n.integer(r.waterCurrent)}
                  </span>
                </span>
              ),
          },
          {
            key: 'power',
            header: `${t('app.meters.utility.power')} (kWh)`,
            numeric: true,
            render: (r) =>
              r.powerCurrent === null ? (
                <span className="text-muted">—</span>
              ) : r.powerPrevious === null ? (
                <span className="text-caps text-muted">{n.integer(r.powerCurrent)}</span>
              ) : (
                <span>
                  {n.integer(r.powerCurrent - r.powerPrevious)}{' '}
                  {/* Les index d'électricité sont à cinq chiffres : sans
                      groupement ils rendaient « 7640 » dans les deux langues,
                      là où le français écrit « 7 640 » et l'anglais « 7,640 ».
                      L'espace typographique remplace la marge pour la raison
                      dite au-dessus, sur l'eau. */}
                  <span className="text-caps whitespace-nowrap text-muted">
                    {n.integer(r.powerPrevious)}→{n.integer(r.powerCurrent)}
                  </span>
                </span>
              ),
          },
          {
            key: 'rebilled',
            role: 'valeur',
            header: t('app.meters.rebilled'),
            numeric: true,
            render: (r) => {
              const r2 = rebilled(r)
              if ('montant' in r2) {
                return <span className="font-medium">{money(r2.montant, { compact: true })}</span>
              }
              // Le libellé DIT la cause : une tournée d'un côté, une saisie de
              // tarif de l'autre.
              return (
                <StatusPill tone="warn" size="sm">
                  {r2.manque === 'reading'
                    ? t('app.meters.missing')
                    : r2.manque === 'depart'
                      ? t('app.meters.firstReading')
                      : t('app.meters.noPrice')}
                </StatusPill>
              )
            },
          },
          {
            key: 'readAt',
            header: t('app.meters.readAt'),
            hideOnMobile: true,
            render: (r) => (
              <span className="numeric text-muted">
                {r.readAt ? d.dayMonth(r.readAt) : '—'}
              </span>
            ),
          },
          {
            key: 'geste',
            /* UNE SEULE COLONNE DE GESTES : `DataTable` ÉPINGLE toute colonne
               `role: 'geste'` en `sticky right-0`, et deux se recouvrent —
               mesuré cette semaine sur l'écran des locataires, où « Corriger »
               rendait « Corı ». Le retrait vit donc DANS la modale, où il a de
               la place et où l'index à retirer est sous les yeux. */
            role: 'geste',
            header: '',
            render: (r) =>
              /* RIEN À CORRIGER SANS RELEVÉ. Une ligne sans aucun index posé
                 n'offre pas de geste : le bouton mènerait à une modale qui ne
                 saurait rien corriger. */
              peutRelever && (r.waterReadingId ?? r.powerReadingId) ? (
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="sliders"
                    /* LE LOGEMENT DANS LE NOM ACCESSIBLE : douze boutons
                       « Corriger » à la suite ne disent pas lequel on active. */
                    aria-label={t('app.readings.correctLine', { unit: unitLabel(r.unitId) })}
                    onClick={() => setLigneACorriger(r)}
                  >
                    {t('common.edit')}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
    </>
  )
}

/**
 * Les relevés, le temps qu'ils arrivent.
 *
 * L'export est retenu : il sortirait les index de compteurs d'un autre parc
 * dans un fichier qui, une fois enregistré, ne porte plus aucune trace de son
 * origine.
 *
 * Le bandeau de complétude est remplacé par un pavé de MÊME hauteur — une boîte
 * `py-3.5` à deux lignes de texte. Ne pas le reproduire ferait remonter le
 * tableau d'une soixantaine de pixels à l'arrivée des données, juste sous le
 * doigt qui vise la première ligne.
 */
function MetersSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.meters.title')}
        description={t('app.meters.subtitle')}
        actions={<Skeleton radius="md" className="h-11 w-44" />}
      />

      <SkeletonRegion>
        <SkeletonStatRow count={3} className={GRILLE_TROIS_INDICATEURS} />

        <div className="mt-6 mb-4 rounded-lg border border-divider px-4 py-3.5">
          <Skeleton line="body" className="w-56" />
          <Skeleton line="body" className="mt-0.5 w-72 max-w-full" />
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}
