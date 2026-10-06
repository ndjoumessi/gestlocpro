import { useCallback, useEffect, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
import { SkeletonRegion, SkeletonStatRow, SkeletonTable } from '@/components/primitives/Skeleton'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { NoteDePerimetre } from './NoteDePerimetre'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { api } from '@/api/client'
import { ANNONCES_DEMO } from '@/data/portfolio'
import { ListingModal, type AnnonceApi } from './ListingModal'

/**
 * LA VACANCE : CE QUI SE PASSE ENTRE DEUX BAUX.
 *
 * ═══ CE QUE LE PRODUIT SAVAIT, ET OÙ IL S'ARRÊTAIT ═══
 *
 * Il savait dire qu'un logement était vacant — « pas de bail en cours », déduit
 * et jamais écrit. À quel loyer on remet, à partir de quand, qui s'est
 * présenté, ce que la visite a appris : rien n'avait de place. Ces semaines-là
 * sont pourtant les plus coûteuses de la vie d'un logement — un mois de vacance
 * sur un loyer de 70 000 coûte plus que douze mois d'honoraires sur le même
 * bien —, et c'était la seule période où le produit ne servait à rien.
 *
 * ═══ POURQUOI UN ÉCRAN, ET PAS UNE SECTION DU PARC ═══
 *
 * L'écran du parc répond à « qu'est-ce que je possède ». Celui-ci répond à
 * « qu'est-ce qui ne rapporte rien, et où en est-on pour y remédier ». Le
 * lecteur n'est pas le même jour : on ouvre le parc pour trouver un logement, on
 * ouvre celui-ci pour savoir s'il faut baisser le prix.
 *
 * ═══ LE PREMIER INDICATEUR N'EST PAS UNE SOMME D'ANNONCES ═══
 *
 * « Logements vides » compte les logements SANS bail en cours, et non les
 * annonces ouvertes. Les deux divergent, et c'est exactement ce qu'on vient
 * voir : un logement vide SANS annonce est le cas qui coûte, et une somme
 * d'annonces l'aurait rendu invisible.
 */
export function Vacancy() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { role } = useRole()
  const { units, buildingById, loading: chargementDuParc } = usePortfolio()
  const { adhesionActive, estDemo } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [annonces, setAnnonces] = useState<AnnonceApi[]>(ANNONCES_DEMO)
  const [chargement, setChargement] = useState(false)
  const [ouverte, setOuverte] = useState<AnnonceApi | null>(null)
  const [nouvelleAnnonce, setNouvelleAnnonce] = useState(false)

  const relire = useCallback(() => {
    if (!parkId) return
    setChargement(true)
    void api
      .listings<{ listings: AnnonceApi[] }>(parkId)
      .then((lu) => setAnnonces(lu.listings))
      /* UNE LECTURE QUI ÉCHOUE REND LA LISTE VIDE, jamais la précédente : des
         annonces d'un autre parc sous l'étiquette de celui-ci seraient un fait
         faux, et c'est sur ces chiffres qu'on décide de baisser un prix. */
      .catch(() => setAnnonces([]))
      .finally(() => setChargement(false))
  }, [parkId])

  useEffect(() => {
    relire()
  }, [relire])

  /* PUBLIER EST OUVERT AUX DEUX RÔLES DE GESTION : relouer est l'administratif
     courant, le cœur de ce qu'on délègue, et une annonce n'engage aucune
     dépense. `adhesionActive !== null || estDemo` : sans cette moitié, l'écran
     offrirait un geste qui n'écrit nulle part. */
  const peutPublier =
    (role === 'owner' || role === 'manager') && (adhesionActive !== null || estDemo)

  const vides = units.filter((u) => u.status === 'vacant')
  const publiees = annonces.filter((a) => a.status === 'published')
  const candidats = annonces.reduce((s, a) => s + a.applicants.length, 0)
  /* LES LOGEMENTS VIDES SANS ANNONCE : le cas qui coûte, et celui qu'une somme
     d'annonces rendrait invisible. */
  const sansAnnonce = vides.filter(
    (u) => !annonces.some((a) => a.unitId === u.id && a.status !== 'closed'),
  )

  /* LE LOGEMENT D'UNE ANNONCE PEUT AVOIR DISPARU du portefeuille — une annonce
     fermée survit à son logement retiré, et c'est voulu : elle dit à quel prix
     on avait demandé. On le NOMME plutôt que de rendre une cellule vide, qui se
     lirait comme un défaut de chargement. */
  const nomDuLogement = (unitId: string) => {
    const logement = units.find((u) => u.id === unitId)
    const immeuble = logement ? buildingById(logement.buildingId) : undefined
    return logement && immeuble
      ? `${immeuble.name} — ${logement.label}`
      : t('app.vacancy.unitUnknown')
  }

  if (chargementDuParc || chargement) {
    return (
      <SkeletonRegion>
        <SkeletonStatRow count={3} className={GRILLE_TROIS_INDICATEURS} />
        {/* `fiches` : sous le seuil, le tableau devient une pile de fiches, et
            un squelette de RANGÉES annoncerait alors une forme qui ne viendra
            pas. La garde `squeletteAuSeuilDesFiches` l'exige de tout écran dont
            le `DataTable` porte `fiches`. */}
        <SkeletonTable fiches />
      </SkeletonRegion>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('app.vacancy.title')}
        description={t('app.vacancy.subtitle')}
        actions={
          peutPublier ? (
            <Button onClick={() => setNouvelleAnnonce(true)}>{t('app.vacancy.open')}</Button>
          ) : undefined
        }
      />

      <NoteDePerimetre />

      <div className={GRILLE_TROIS_INDICATEURS}>
        <StatCard
          icone="building"
          label={t('app.vacancy.kpiEmpty')}
          value={String(vides.length)}
          note={t('app.vacancy.kpiEmptyNote', { count: sansAnnonce.length })}
        />
        <StatCard
          icone="globe"
          label={t('app.vacancy.kpiPublished')}
          value={String(publiees.length)}
          note={t('app.vacancy.kpiPublishedNote', { count: annonces.length })}
        />
        <StatCard
          icone="users"
          label={t('app.vacancy.kpiApplicants')}
          value={String(candidats)}
          note={t('app.vacancy.kpiApplicantsNote')}
        />
      </div>

      {/* INCONDITIONNELLE, comme la note du sortant : un parc sans logement vide
          est précisément celui où l'on croirait cet écran complet. Il ne dit
          rien de ce que la vacance COÛTE — le produit ne sait pas ce qu'un
          logement aurait rapporté, seulement ce qu'il a rapporté. */}
      <Notice tone="accent" icon="info">
        {t('app.vacancy.scopeNote')}
      </Notice>

      <DataTable<AnnonceApi>
        caption={t('app.vacancy.title')}
        rows={annonces}
        rowKey={(a) => a.id}
        fiches
        empty={
          <div className="py-14 text-center">
            <p className="title-m">{t('app.vacancy.empty')}</p>
            <p className="text-body text-muted mt-2">{t('app.vacancy.emptyHint')}</p>
          </div>
        }
        columns={[
          {
            key: 'unit',
            header: t('app.vacancy.colUnit'),
            role: 'identite',
            render: (a) => (
              /* `block w-full min-w-0` SUR LE BOUTON, et c'est la moitié qu'on
                 oublie : `truncate` ne peut rétrécir que si TOUS ses parents
                 acceptent de rétrécir. Sans cela, le bouton garde la largeur de
                 son texte et déborde sa cellule — mesuré à 61 px sur
                 « Immeuble Akwa Nord — B4 » à 320 et 360 px, par `mesure-ui`,
                 qui est la seule garde à voir un débordement LOCAL : la page,
                 elle, ne défile pas pour autant. */
              <button
                type="button"
                onClick={() => setOuverte(a)}
                className="block min-h-11 w-full min-w-0 text-start underline-offset-2 hover:underline"
              >
                <span className="block truncate font-semibold" data-donnee>
                  {nomDuLogement(a.unitId)}
                </span>
              </button>
            ),
          },
          {
            key: 'status',
            header: t('app.vacancy.colStatus'),
            role: 'etat',
            /* LE MOT ET LA TEINTE, jamais la teinte seule : « publiée » et
               « fermée » ne se distinguent pas pour qui ne voit pas la couleur,
               et c'est la seule colonne qui dit si l'on attend des candidats. */
            render: (a) => (
              <StatusPill
                tone={a.status === 'published' ? 'ok' : a.status === 'draft' ? 'neutral' : 'info'}
                size="sm"
              >
                {t(`app.vacancy.status_${a.status}` as 'app.vacancy.status_draft')}
              </StatusPill>
            ),
          },
          {
            key: 'availableFrom',
            header: t('app.vacancy.colFrom'),
            role: 'contexte',
            /*
              LA DATE ENTIÈRE, PARCE QUE CE TABLEAU GARDE LES ANNONCES FERMÉES.

              `dayMonth` rendait « 1 août ». C'est juste tant qu'on ne regarde
              que ce qui vient — mais cet écran montre aussi les annonces
              FERMÉES, et il le fait exprès : « l'annonce RESTE en base, c'est
              elle qui dit à quel prix on avait demandé ». Un logement reloué
              l'an dernier portait donc une disponibilité indiscernable du 1er
              août qui arrive.

              L'ANNÉE NE SE DEVINE NULLE PART AILLEURS SUR CET ÉCRAN : pas de
              sélecteur de période, pas de mois affiché. Ici, elle est la
              donnée.
            */
            render: (a) => d.fullDate(partiesDeDateISO(a.availableFrom)),
          },
          {
            key: 'applicants',
            header: t('app.vacancy.colApplicants'),
            role: 'contexte',
            numeric: true,
            render: (a) => String(a.applicants.length),
          },
          {
            key: 'rent',
            header: t('app.vacancy.colRent'),
            role: 'valeur',
            numeric: true,
            render: (a) => money(a.rentMinor),
            /*
              CE QUE LE PARC DEMANDE EN CE MOMENT, et c'était le seul montant de
              cet écran que personne n'additionnait.

              Les trois cartes du haut comptent des logements, des annonces et
              des candidats : pas un franc. La colonne portait donc le seul
              argent de l'écran, ligne à ligne, et la question qu'on vient y
              poser — « combien de loyer est en attente de preneur » — n'avait de
              réponse nulle part.

              CE N'EST PAS LE COÛT DE LA VACANCE, et la note de l'écran continue
              de le dire : le produit ne sait pas ce qu'un logement AURAIT
              rapporté. Il sait ce qu'on en demande, parce que c'est le bailleur
              qui l'a écrit dans l'annonce.

              LA SOMME MÊLE LES TROIS ÉTATS parce que le tableau les montre tous
              les trois — un brouillon, une publiée, une fermée. Le pied somme ce
              qu'il montre, c'est son contrat ; séparer les états demanderait un
              filtre, que cet écran n'a pas encore.
            */
            total: (annonces) =>
              money(annonces.reduce((somme, a) => somme + a.rentMinor, 0)),
          },
        ]}
      />

      {(nouvelleAnnonce || ouverte) && (
        <ListingModal
          annonce={ouverte}
          logementsVides={vides.map((u) => ({
            id: u.id,
            libelle: `${buildingById(u.buildingId)?.name ?? ''} — ${u.label}`,
            loyer: u.rent,
          }))}
          onClose={() => {
            setNouvelleAnnonce(false)
            setOuverte(null)
          }}
          onEcrit={relire}
        />
      )}
    </div>
  )
}
