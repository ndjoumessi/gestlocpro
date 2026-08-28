import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Field } from '@/components/primitives/Field'
import { RadioCards } from '@/components/primitives/Choice'
import { Input, Textarea } from '@/components/primitives/Input'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { TRADES_REPORTABLE } from '@/data/portfolio'
import type { TradeKey, UrgencyKey, WorkOrder } from '@/data/portfolio'

/**
 * « Signaler » — l'écran que les maquettes décrivent.
 *
 * Le formulaire vivait en MODALE, derrière un bouton. Les maquettes le posent à
 * plat, à côté de « Mes signalements », et la raison n'est pas cosmétique : un
 * locataire qui déclare un problème veut d'abord savoir si le précédent a été
 * traité. Derrière une modale, la liste est masquée à l'instant précis où elle
 * sert — il redéclare donc ce qui est déjà en cours.
 *
 * Les signalements SONT les interventions de son logement : le produit n'a pas
 * deux objets pour un seul fait, et la chaîne « signalé → chiffré → validé →
 * clos » est celle que le bailleur voit de son côté.
 *
 * La modale survit pour le bailleur, dans l'écran des travaux : il déclare pour
 * un logement qu'il choisit, le locataire pour le sien. Le VOCABULAIRE des
 * corps de métier est importé et non recopié — deux présentations, une seule
 * source.
 */

const TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'warn',
  quoted: 'info',
  approved: 'info',
  done: 'ok',
}

const URGENCES: UrgencyKey[] = ['low', 'normal', 'blocking']

export function Signaler() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { notify } = useToast()
  const { works, units, isMine, addWork, loading } = usePortfolio()

  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState(false)
  const [metier, setMetier] = useState<TradeKey>('plumbing')
  const [urgence, setUrgence] = useState<UrgencyKey>('normal')
  const [detail, setDetail] = useState('')
  /* Le vol en cours : le bouton s'éteint, sans quoi une attente devenue visible
     ferait naître deux fiches d'intervention de la même fuite. */
  const [envoi, setEnvoi] = useState(false)

  /*
    L'ATTENTE PASSE AVANT LE FORMULAIRE, et pas seulement avant la liste.

    Le fournisseur sert le parc de DÉMONSTRATION tant que le vrai n'est pas
    arrivé — `TenantDocuments` le pose en toutes lettres : « pendant le
    chargement, le jeu de démonstration fournit toujours une unité, et l'écran
    montrerait le dossier d'un autre ». Ici c'était pire qu'un affichage : le
    formulaire restait vivant et postait sur `mesUnites[0]`, c'est-à-dire sur un
    logement qui n'est pas celui du locataire. Une fiche d'intervention ouverte
    chez quelqu'un d'autre.

    La liste, elle, attendait déjà. Le correctif n'avait traversé que la moitié
    de l'écran.
  */
  const mesUnites = loading ? [] : units.filter((u) => isMine(u.id))
  const miens = works.filter((w) => isMine(w.unitId))
  /* Le geste appartient au locataire : le bailleur ne signale pas un problème
     chez quelqu'un d'autre, il le reçoit. */
  const peutDeclarer = role === 'tenant' && mesUnites[0]

  async function envoyer() {
    if (!mesUnites[0]) return
    // La même borne que le serveur : le refus arrive avant l'aller-retour.
    if (titre.trim().length < 3) {
      setErreur(true)
      return
    }
    /**
     * « SIGNALEMENT ENVOYÉ » attend maintenant que le serveur l'ait accepté.
     *
     * La phrase partait avec l'appel et non avec sa réponse : sur un refus, le
     * locataire lisait qu'il avait signalé sa fuite PUIS que rien n'avait été
     * enregistré — et le formulaire s'était déjà vidé de ce qu'il venait
     * d'écrire, si bien qu'il ne restait même pas de quoi recommencer.
     */
    setEnvoi(true)
    const ouvert = await addWork(mesUnites[0].id, {
      title: titre.trim(),
      trade: metier,
      urgency: urgence,
      ...(detail.trim() ? { description: detail.trim() } : {}),
    })
    setEnvoi(false)
    // La saisie SURVIT au refus. Le motif est déjà dit par `signalerEchec` ;
    // faire retaper le locataire le punirait d'une panne qui n'est pas la sienne.
    if (!ouvert) return
    setTitre('')
    setDetail('')
    setErreur(false)
    notify(t('app.report.sent'), { tone: 'ok' })
  }

  return (
    <>
      <PageHeader title={t('app.report.title')} description={t('app.report.body')} />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {peutDeclarer ? (
          /*
            UN VRAI `<form>`, ET IL N'Y EN AVAIT PAS.

            Quatre champs et un `<Button onClick>` dans une carte nue : Entrée
            dans « Que se passe-t-il ? » ne validait rien, et le clavier virtuel
            d'un téléphone — l'appareil du marché visé — perdait sa touche
            d'action, qui n'a de sens que si le champ appartient à un formulaire.

            La modale jumelle porte le récit complet de ce défaut : « faute de
            l'avoir résolu, cette modale n'avait pas de formulaire du tout ». Le
            correctif ne l'avait pas quittée.

            `noValidate` : la validation est celle du produit — trois caractères
            minimum, la même borne que le serveur — et non celle du navigateur,
            dont les bulles ne se traduisent ni ne se stylent.
            `flush` : le rembourrage passe au `<form>`, sans quoi `cn` laisserait
            les deux jeux de classes cohabiter — il concatène, il ne fusionne
            pas, et c'est l'ordre du CSS émis qui trancherait.
          */
          <Card flush>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void envoyer()
              }}
              noValidate
              className="flex flex-col gap-5 p-4 sm:p-5"
            >
            <Field
              label={t('app.report.what')}
              hint={t('app.report.whatHint')}
              required
              {...(erreur ? { error: t('app.report.whatError') } : {})}
            >
              {(champ) => (
                <Input
                  {...champ}
                  value={titre}
                  placeholder={t('app.report.whatPlaceholder')}
                  onChange={(e) => {
                    setTitre(e.target.value)
                    if (erreur) setErreur(false)
                  }}
                />
              )}
            </Field>

            {/* Pastilles plutôt que cartes radio : cinq métiers tiennent sur une
                rangée, et le locataire choisit — il n'arbitre pas.

                `radiogroup` et non une rangée de boutons : ces cinq choix sont
                EXCLUSIFS, et le rôle le dit au lecteur d'écran, qui annonce
                « 3 sur 5 ». `aria-checked` porte l'état ; la couleur ne le porte
                jamais seule. */}
            {/*
              LA PRIMITIVE, ET NON UNE TROISIÈME COPIE.

              Ce groupe était refait à la main sur des `<button role="radio">`
              avec un clavier maison. `RadioCards variant="puces"` existe pour ce
              cas précis — son commentaire cite « six métiers et trois urgences »
              — et apporte trois choses que la copie n'avait pas : la COCHE, dont
              la raison est écrite (« sous deutéranopie, deux teintes de statut
              sont à 3,4 de ΔE00 »), l'ANNEAU DE FOCUS, et le clavier NATIF d'un
              vrai `input[type=radio]` — flèches, annonce « 3 sur 5 », saut des
              entrées désactivées, groupe atteignable à la tabulation.
            */}
            <RadioCards
              variant="puces"
              legend={t('app.report.trade')}
              name="metier"
              value={metier}
              onChange={setMetier}
              options={TRADES_REPORTABLE.map((cle) => ({
                value: cle,
                title: t(`app.trades.${cle}` as 'app.trades.plumbing'),
                description: '',
              }))}
            />

            {/*
              ET LES TROIS DESCRIPTIONS D'URGENCE REVIENNENT.

              Elles sont traduites, chargées, et affichées par la modale jumelle
              — `app.report.urgency_*` : « Le logement n'est pas utilisable en
              l'état », « Gênant, mais on peut vivre avec quelques jours ». Son
              commentaire les appelle « les seules phrases qui disent au locataire
              où placer son problème ». Cet écran-ci les jetait et ne rendait
              qu'un mot par urgence, laissant le choix au flair.

              `cartes` et non `puces` : trois options qui portent deux lignes
              d'explication sont exactement ce que le variant en tuiles sert, et
              c'est l'arbitrage que la primitive écrit elle-même.
            */}
            <RadioCards
              legend={t('app.report.urgency')}
              name="urgence"
              value={urgence}
              onChange={setUrgence}
              columns={3}
              options={URGENCES.map((cle) => ({
                value: cle,
                /* Le MÊME couple de clés que la modale jumelle : le titre vient
                   de `app.works.urgency_*`, la description de
                   `app.report.urgency_*`. Deux écrans, un vocabulaire. */
                title: t(`app.works.urgency_${cle}` as 'app.works.urgency_blocking'),
                description: t(`app.report.urgency_${cle}` as 'app.report.urgency_blocking'),
              }))}
            />

            <Field label={t('app.report.detail')} optional hint={t('app.report.detailHint')}>
              {(champ) => (
                <Textarea {...champ} value={detail} onChange={(e) => setDetail(e.target.value)} />
              )}
            </Field>

            <div>
              {/* `type="submit"` : c'est lui qui relie la touche Entrée au
                  geste, et qui donne au clavier virtuel sa touche d'action. */}
              <Button type="submit" loading={envoi}>
                {t('app.report.send')}
              </Button>
            </div>
            </form>
          </Card>
        ) : (
          /* Le bailleur atteint cet écran depuis sa navigation : il y lit ce
             qu'on lui signale, sans pouvoir déclarer à la place d'un autre. */
          <Card>
            <EmptyState
              icon="bell"
              level={2}
              title={t('app.report.title')}
              body={t('app.report.body')}
            />
          </Card>
        )}

        {/*
          `self-start` : LA LISTE FINIT OÙ FINIT LE DERNIER SIGNALEMENT.

          Le formulaire d'en face est long par nature — quatre champs, une zone
          de texte, un bouton. Étirée sur sa hauteur, cette carte portait 179 px
          de vide sous ses trois lignes, 53 % d'elle-même, et le locataire y
          lisait un cadre à moitié creux là où il n'a que trois signalements.
          Rien ne relie le socle d'un formulaire à celui d'une liste : une carte
          finit où son contenu finit. Mesuré par la sonde du BLANC IMPOSÉ.
        */}
        <Card flush className="self-start">
          <CardHeader
            title={t('app.report.mine')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />

          {/*
            L'état vide n'est PAS servi pendant l'attente.

            Un en-tête nu était rendu tant que `loading`, sans région
            `aria-busy` : rien n'annonçait l'attente, ni aux technologies
            d'assistance, ni au test qui l'écoute. Et « Aucun signalement »
            s'affichait alors sur des données pas encore arrivées — le locataire
            redéclare ce qu'il croit perdu.
          */}
          {loading ? (
            <div
              role="status"
              aria-busy="true"
              className="px-4 pb-4 text-body text-muted sm:px-5 sm:pb-5"
            >
              {t('common.loading')}
            </div>
          ) : miens.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <EmptyState
                icon="bell"
                title={t('app.report.emptyTitle')}
                body={t('app.report.emptyBody')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-divider border-t border-divider">
              {miens.map((work) => (
                <li key={work.id} className="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/*
                      Le STATUT, sans le montant. Le devis et le coût regardent
                      le bailleur ; ce qui intéresse le locataire est où en est
                      SA demande.
                    */}
                    <StatusPill tone={TONE[work.status]} size="sm">
                      {t(`app.works.${work.status}` as 'app.works.reported')}
                    </StatusPill>
                    {work.reference && (
                      <span className="numeric text-caps text-muted">{work.reference}</span>
                    )}
                  </div>
                  <p className="text-body font-medium">{workTitle(work, t)}</p>
                  <p className="text-caps text-muted">{d.dayMonth(work.reportedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

