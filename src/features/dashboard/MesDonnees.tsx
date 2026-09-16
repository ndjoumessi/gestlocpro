import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
import { Checkbox } from '@/components/primitives/Choice'
import { DataTable, type Column } from '@/components/primitives/DataTable'
import { SkeletonTable } from '@/components/primitives/Skeleton'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDate } from '@/lib/dates'
import { useSession } from '@/api/SessionProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useCsvExport } from '@/lib/useCsvExport'
import { nouvelleMiseEnPage } from '@/lib/miseEnPage'
import { construirePdf } from '@/lib/pdf'
import { PDF_MIME, downloadBinaryFile } from '@/lib/download'
import { nomDeFichier } from '@/lib/nomDeFichier'
import {
  NATURES_DU_DOSSIER,
  cellulesDeLaLigne,
  cleDeNature,
  colonnesDeLaNature,
  type Dossier,
  type NatureDuDossier,
} from '@/data/dossier'
import { DELAI_D_EFFACEMENT_JOURS } from '@/data/fermeture'

/**
 * MES DONNÉES — le droit à la portabilité, rendu par le produit.
 *
 * ═══ POURQUOI UN ÉCRAN, ET NON UNE ENTRÉE DE MENU ═══
 *
 * La première rédaction le plaçait dans le menu du compte, à côté du retrait de
 * la lettre d'information. Sous `/demo`, ce menu ne rend RIEN — il exige une
 * session —, et `modales` n'ouvre que ce que la démonstration montre : la
 * géométrie de cet écran n'aurait été mesurée par aucune porte. Le dépôt a déjà
 * payé cette leçon ailleurs, et elle porte un nom : « un écran inatteignable
 * cache du code ».
 *
 * ═══ CE QUE L'ÉCRAN NE DÉCIDE PAS ═══
 *
 * Son étendue. Le serveur rend à chacun ce qu'il lit déjà — le propriétaire son
 * parc, le gestionnaire son périmètre, le locataire sa fiche et son bail — et
 * cet écran COMPTE ce qu'il reçoit sans jamais filtrer : un écran qui filtrerait
 * laisserait croire que ce qu'il cache n'a pas été envoyé.
 *
 * ═══ DEUX FORMES, ET CHACUNE SA RAISON ═══
 *
 * Le CSV est ce qu'un tableur ouvre, donc ce qu'on peut trier, vérifier et
 * porter ailleurs — c'est la portabilité au sens de l'article 20. Le PDF est ce
 * qu'on archive et qu'on relit dans dix ans sans outil : il porte le
 * RÉCAPITULATIF — qui a exporté, quand, et combien de lignes de chaque nature —
 * et non les tables, qu'un document de cent pages rendrait illisibles.
 */
export function MesDonnees() {
  const t = useT()
  const d = useDates()
  const { etat: session, adhesionActive, fermerLeCompte } = useSession()
  const naviguer = useNavigate()
  const courriel = session.statut === 'connecte' ? session.compte.email : ''
  const { exporterLeDossier } = usePortfolio()
  const exporterEnTableur = useCsvExport()
  const [etat, setEtat] = useState<'repos' | 'attente' | 'pret' | 'demonstration' | 'echec'>('repos')
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [compris, setCompris] = useState(false)
  /* PAS DE `demonstration` ICI, ET C'EST MESURÉ : ce bloc n'existe qu'avec un
     dossier préparé, donc avec un parc réel — la démonstration n'atteint jamais
     ce geste. Garder la branche aurait laissé une phrase que personne ne voit,
     et `notes-conditionnelles` la réclamerait à juste titre. */
  const [fermeture, setFermeture] = useState<'repos' | 'attente' | 'echec'>('repos')

  const preparer = useCallback(async () => {
    setEtat('attente')
    const issue = await exporterLeDossier()
    /* TROIS ISSUES, TROIS PHRASES. Rendre le même « rien à exporter » pour une
       démonstration et pour une panne ferait croire à un dossier vide là où la
       requête n'est jamais partie — le défaut que `callRent` a payé en
       production. */
    if (issue.issue === 'pret') {
      setDossier(issue.dossier)
      setEtat('pret')
      return
    }
    setDossier(null)
    setEtat(issue.issue)
  }, [exporterLeDossier])

  const telechargerLeCsv = useCallback(
    (nature: NatureDuDossier) => {
      if (!dossier) return
      const lignes = dossier[nature]
      const colonnes = colonnesDeLaNature(lignes)
      exporterEnTableur({
        name: [t('app.data.title'), t(cleDeNature(nature))],
        /* LES EN-TÊTES SONT LES NOMS DU SERVEUR, et ce n'est pas une paresse de
           traduction : un export de portabilité se relit avec le dossier qu'il
           documente, et traduire `rentMinor` en « loyer » couperait le fichier
           de la seule chose qui l'explique. Le libellé traduit, lui, nomme le
           FICHIER. */
        headers: colonnes,
        rows: lignes.map((ligne) => cellulesDeLaLigne(ligne, colonnes)),
        notice: 'app.data.csvReady',
      })
    },
    [dossier, exporterEnTableur, t],
  )

  const telechargerLePdf = useCallback(() => {
    if (!dossier) return
    const page = nouvelleMiseEnPage()
    const emisLe = d.fullDate(partiesDeDate(new Date()))
    page.titre(t('app.data.pdfTitle'), adhesionActive?.parkName ?? t('common.demoPark'))
    page.filet()
    page.ligne(t('app.data.pdfFor', { name: String(dossier.compte.fullName ?? '') }))
    page.ligne(t('app.data.pdfOn', { date: emisLe }), { petit: true })
    page.filet()
    page.paragraphe(t('app.data.pdfIntro'))
    page.saut(6)
    page.section(t('app.data.pdfCounts'))
    for (const nature of NATURES_DU_DOSSIER) {
      page.paire(t(cleDeNature(nature)), String(dossier[nature].length))
    }
    downloadBinaryFile(
      construirePdf(page.pages((n, total) => t('app.data.pdfFoot', { page: n, total }))),
      nomDeFichier([t('app.data.title')], emisLe, 'pdf'),
      PDF_MIME,
    )
  }, [adhesionActive, d, dossier, t])

  /**
   * FERMER SON COMPTE — le geste que la politique de confidentialité promettait
   * par courrier.
   *
   * IL EXIGE D'AVOIR PRÉPARÉ SON EXPORT. Nelson l'a tranché le 2026-09-16 :
   * « avertir et laisser exporter avant ». Sans le dossier, l'écran ne peut
   * même pas CHIFFRER ce qui va disparaître — et un avertissement sans chiffres
   * est une formule, pas un avertissement.
   */
  const fermer = useCallback(async () => {
    setFermeture('attente')
    const issue = await fermerLeCompte()
    if (issue.issue === 'fermee') {
      /* L'INTERFACE EST DÉJÀ ANONYME — le fournisseur l'a posée, et cela suffit
         à quitter l'espace applicatif : mesuré, une mutation qui retire cette
         navigation ne fait rougir aucun cas. Elle sert à autre chose, et c'est
         pour cela qu'elle reste : PORTER LA DATE jusqu'à l'écran de connexion,
         seul endroit où la personne peut encore lire ce qui va se passer. */
      naviguer('/connexion', { state: { fermetureLe: issue.effaceLe } })
      return
    }
    /* `demonstration` ne peut pas arriver ici — voir l'état ci-dessus — et
       l'écran ne peut rien faire de plus qu'avec un échec : il le dit. */
    setFermeture('echec')
  }, [fermerLeCompte, naviguer])

  /** Ce qui disparaîtra, chiffré depuis le dossier et non depuis une promesse. */
  const aEffacer = dossier
    ? NATURES_DU_DOSSIER.reduce((somme, nature) => somme + dossier[nature].length, 0)
    : 0

  const colonnes: Column<NatureDuDossier>[] = [
    {
      key: 'nature',
      header: t('app.data.nature'),
      render: (nature) => t(cleDeNature(nature)),
    },
    {
      key: 'lignes',
      header: t('app.data.rows'),
      numeric: true,
      render: (nature) => String(dossier?.[nature].length ?? 0),
    },
    {
      key: 'fichier',
      header: t('app.data.file'),
      render: (nature) => (
        <Button
          variant="ghost"
          onClick={() => telechargerLeCsv(nature)}
          disabled={(dossier?.[nature].length ?? 0) === 0}
        >
          {t('app.data.downloadCsv')}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('app.data.title')}
        description={t('app.data.subtitle')}
        actions={
          <Button onClick={() => void preparer()} disabled={etat === 'attente'}>
            {etat === 'attente' ? t('app.data.preparing') : t('app.data.prepare')}
          </Button>
        }
      />

      <p className="max-w-2xl text-body text-pretty text-muted">
        {/* SANS SESSION — la démonstration —, la phrase ne cite aucun compte :
            « votre compte () » était rendu tel quel, parenthèses vides
            comprises, mesuré au navigateur le 2026-09-16. */}
        {courriel ? t('app.data.body', { email: courriel }) : t('app.data.bodyAnonyme')}
      </p>

      {/* DÉCLARÉE MESURABLE : le geste qui la rend est le bouton ci-dessus, sous
          `/demo` où aucun parc réel n'existe. Voir `notes-conditionnelles`. */}
      {/* LE SQUELETTE EST EN FICHES, comme le tableau qu'il annonce : sous `sm`
          l'écran rend des fiches, et un squelette tabulaire y promettrait une
          forme que le contenu ne prend pas. */}
      {etat === 'attente' && <SkeletonTable rows={NATURES_DU_DOSSIER.length} fiches />}
      {etat === 'demonstration' && <Notice tone="accent">{t('app.data.demo')}</Notice>}
      {etat === 'echec' && <Notice tone="danger">{t('app.data.failed')}</Notice>}

      {dossier && (
        <>
          <Notice tone="ok">
            {t('app.data.ready', { date: d.fullDate(partiesDeDate(new Date(dossier.exporteLe))) })}
          </Notice>
          <DataTable
            caption={t('app.data.title')}
            columns={colonnes}
            rows={[...NATURES_DU_DOSSIER]}
            rowKey={(nature) => nature}
            fiches
          />
          <div>
            <Button variant="secondary" onClick={telechargerLePdf}>
              {t('app.data.downloadPdf')}
            </Button>
          </div>

          {/* LA FERMETURE VIENT APRÈS L'EXPORT, ET SUR LE MÊME ÉCRAN : c'est la
              seule disposition où l'on ne peut pas demander l'effacement sans
              avoir vu ce qu'on efface. Le bloc est SÉPARÉ par un filet et par sa
              couleur — un geste irréversible ne se range pas parmi les autres. */}
          <section
            aria-labelledby="fermeture-du-compte"
            className="mt-4 rounded-lg border border-danger-border bg-danger-tint p-4"
          >
            <h2 id="fermeture-du-compte" className="title-s text-ink">
              {t('app.data.closeTitle')}
            </h2>
            <p className="mt-2 text-body text-pretty text-ink">
              {t('app.data.closeBody', { lignes: aEffacer, jours: DELAI_D_EFFACEMENT_JOURS })}
            </p>
            <p className="mt-2 text-body text-pretty text-muted">{t('app.data.closeUndo', { jours: DELAI_D_EFFACEMENT_JOURS })}</p>
            <div className="mt-3">
              <Checkbox
                label={t('app.data.closeUnderstood')}
                checked={compris}
                onChange={(e) => setCompris(e.currentTarget.checked)}
              />
            </div>
            {fermeture === 'echec' && (
              <Notice tone="danger" className="mt-3">
                {t('app.data.closeFailed')}
              </Notice>
            )}
            <div className="mt-3">
              <Button
                variant="danger"
                disabled={!compris || fermeture === 'attente'}
                onClick={() => void fermer()}
              >
                {t('app.data.close')}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
