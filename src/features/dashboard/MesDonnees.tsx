import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
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
  const { etat: session, adhesionActive } = useSession()
  const courriel = session.statut === 'connecte' ? session.compte.email : ''
  const { exporterLeDossier } = usePortfolio()
  const exporterEnTableur = useCsvExport()
  const [etat, setEtat] = useState<'repos' | 'attente' | 'pret' | 'demonstration' | 'echec'>('repos')
  const [dossier, setDossier] = useState<Dossier | null>(null)

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
        </>
      )}
    </div>
  )
}
